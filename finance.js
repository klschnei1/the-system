// ── FINANCE DOMAIN (Chesed) ───────────────────────────────────────────
// Transaction logging: in/out toggle + amount + optional note.
// Widget: cumulative balance line chart (30 days) + today's running totals.

// ── LOG TRANSACTION ───────────────────────────────────────────────────
// Called from buildQuestInput's transaction case via onclick.
// Reads #finance-direction (hidden input), #finance-amount, #finance-note.
window.logTransaction = function(qid, xp) {
  const directionEl = document.getElementById('finance-direction');
  const amountEl = document.getElementById('finance-amount');
  const noteEl = document.getElementById('finance-note');

  const direction = directionEl?.value || 'out';
  const amount = parseFloat(amountEl?.value) || 0;
  const note = noteEl?.value?.trim() || '';

  if (!amount) { notify('Enter an amount.'); return; }

  const entry = {
    time: new Date().toISOString(),
    direction,
    amount,
    note
  };

  const isFirst = !todayLog[qid];
  if (isFirst) {
    todayLog[qid] = { xp, entries: [], time: entry.time, source: 'manual' };
    todayXpEarned += xp;
    data.xp = (data.xp || 0) + xp;
  }
  todayLog[qid].entries.push(entry);

  // Recompute totals
  let income = 0, expenses = 0;
  todayLog[qid].entries.forEach(e => {
    if (e.direction === 'in') income += e.amount;
    else expenses += e.amount;
  });
  todayLog[qid].totals = { net: income - expenses, income, expenses };
  todayLog[qid].note = `+$${income.toFixed(2)} in · -$${expenses.toFixed(2)} out`;

  // Auto-adjust Fifth Third balance
  const fifthThird = (data.accountBalances || []).find(a =>
    a.name.toLowerCase().includes('fifth third')
  );
  if (fifthThird) {
    fifthThird.amount = (fifthThird.amount || 0) + (direction === 'in' ? amount : -amount);
  }

  // Write to dailyLogs
  const today = getTodayStr();
  if (!data.dailyLogs) data.dailyLogs = {};
  if (!data.dailyLogs[today]) data.dailyLogs[today] = {};
  data.dailyLogs[today][qid] = todayLog[qid];

  saveData();
  renderHeader();
  renderQuests();

  // Clear inputs
  if (amountEl) amountEl.value = '';
  if (noteEl) noteEl.value = '';

  const sign = direction === 'in' ? '+' : '-';
  const label = isFirst ? `Logged. +${xp} XP.` : `Added.`;
  notify(`${label} ${sign}$${amount.toFixed(2)}${note ? ' — ' + note : ''}`);
};

// ── ACCOUNT BALANCES ──────────────────────────────────────────────────
window.editAccountBalances = function() {
  const accounts = JSON.parse(JSON.stringify(data.accountBalances || []));

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:20px;width:100%;max-width:380px;max-height:80vh;overflow-y:auto';

  function renderModal() {
    modal.innerHTML = `
      <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase;margin-bottom:16px">Account Balances</div>
      ${accounts.map((a, i) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <input class="log-input" value="${a.name}" placeholder="Account name"
            style="flex:1;font-size:12px;padding:6px 8px"
            oninput="window._accEdit(${i},'name',this.value)">
          <input class="log-input" type="number" value="${a.amount}" placeholder="0.00"
            style="width:90px;font-size:12px;padding:6px 8px;text-align:right"
            oninput="window._accEdit(${i},'amount',parseFloat(this.value)||0)">
          <button onclick="window._accDel(${i})"
            style="background:none;border:1px solid var(--border);color:var(--text3);padding:4px 8px;cursor:pointer;border-radius:2px;font-size:12px">✕</button>
        </div>
      `).join('')}
      <button onclick="window._accAdd()"
        class="btn" style="width:100%;margin-top:4px;font-size:11px">+ Add Account</button>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button onclick="window._accSave()"
          class="btn btn-primary" style="flex:1">Save</button>
        <button onclick="window._accCancel()"
          class="btn" style="flex:1">Cancel</button>
      </div>
    `;
  }

  window._accEdit = (i, key, val) => { accounts[i][key] = val; };
  window._accDel  = (i) => { accounts.splice(i, 1); renderModal(); };
  window._accAdd  = () => { accounts.push({ name: '', amount: 0 }); renderModal(); };
  window._accSave = () => {
    data.accountBalances = accounts.filter(a => a.name.trim());
    saveData();
    overlay.remove();
    const widgetEl = document.getElementById('domainWidget');
    if (widgetEl && window.renderFinanceWidget) {
      window.renderFinanceWidget(widgetEl, 'chesed', data.questDefinitions['chesed']);
    }
  };
  window._accCancel = () => overlay.remove();

  renderModal();
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
};

// ── FINANCE WIDGET ────────────────────────────────────────────────────
// Cumulative balance line chart + today's totals + entry log.
// Depends on globals: data, todayLog, getTodayStr (from system.html).
window.renderFinanceWidget = function(el, dk, domain) {
  const today = getTodayStr();

  // Build 30-day daily net array
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const dayData = data.dailyLogs?.[ds]?.f1;
    const net = dayData?.totals?.net || 0;
    days.push({ ds, net });
  }

  // Overlay today's unsaved log
  const todayF1 = todayLog['f1'];
  if (todayF1?.totals) {
    days[days.length - 1].net = todayF1.totals.net || 0;
  }

  // Build cumulative balance
  let running = 0;
  const points = days.map(d => {
    running += d.net;
    return { ...d, balance: running };
  });

  const todayTotals = todayF1?.totals || { net: 0, income: 0, expenses: 0 };
  const todayEntries = todayF1?.entries || [];

  // SVG chart
  const hasData = points.some(p => p.balance !== 0);
  const chartHtml = hasData ? buildBalanceChart(points, domain.color) : '';

  // Account balances section
  const accounts = data.accountBalances || [];
  const totalNet = accounts.reduce((s, a) => s + (a.amount || 0), 0);
  const accountsHtml = `
    <div style="margin-bottom:${hasData || accounts.length ? '12px' : '0'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">Where it lives</div>
        <button onclick="window.editAccountBalances()"
          style="background:none;border:1px solid var(--border);color:var(--text3);font-size:9px;letter-spacing:1px;padding:2px 8px;cursor:pointer;border-radius:2px;text-transform:uppercase">Edit</button>
      </div>
      ${accounts.length > 0 ? `
        ${accounts.map(a => `
          <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--text2)">${a.name}</span>
            <span style="color:var(--text);font-weight:bold">$${(a.amount||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</span>
          </div>
        `).join('')}
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;margin-top:2px">
          <span style="color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-size:9px">Total</span>
          <span style="color:var(--text);font-weight:bold">$${totalNet.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</span>
        </div>
      ` : `<div style="font-size:11px;color:var(--text3);padding:4px 0">No accounts — tap Edit to add.</div>`}
    </div>
  `;

  el.innerHTML = `
    <div class="domain-widget" style="border-color:${domain.color}">
      ${accountsHtml}
      ${chartHtml}
      <!-- Today's totals -->
      <div style="display:flex;justify-content:space-around;text-align:center;margin-top:${hasData ? '12px' : '0'};margin-bottom:${todayEntries.length > 0 ? '12px' : '0'}">
        <div>
          <div style="font-size:22px;font-weight:bold;color:var(--green)">+$${todayTotals.income?.toFixed(2) || '0.00'}</div>
          <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">in</div>
        </div>
        <div style="width:1px;background:var(--border)"></div>
        <div>
          <div style="font-size:22px;font-weight:bold;color:#e05555">-$${todayTotals.expenses?.toFixed(2) || '0.00'}</div>
          <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">out</div>
        </div>
        <div style="width:1px;background:var(--border)"></div>
        <div>
          <div style="font-size:22px;font-weight:bold;color:${todayTotals.net >= 0 ? 'var(--green)' : '#e05555'}">
            ${todayTotals.net >= 0 ? '+' : ''}$${todayTotals.net?.toFixed(2) || '0.00'}
          </div>
          <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">net today</div>
        </div>
      </div>
      <!-- Entry log -->
      ${todayEntries.length > 0 ? `
        <div style="border-top:1px solid var(--border);padding-top:8px">
          ${todayEntries.map(e => {
            const time = new Date(e.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const sign = e.direction === 'in' ? '+' : '-';
            const color = e.direction === 'in' ? 'var(--green)' : '#e05555';
            return `
              <div style="font-size:10px;color:var(--text3);padding:3px 0;display:flex;justify-content:space-between">
                <span>${time}${e.note ? ' — ' + e.note : ''}</span>
                <span style="color:${color}">${sign}$${e.amount.toFixed(2)}</span>
              </div>`;
          }).join('')}
        </div>
      ` : ''}
    </div>
  `;
};

function buildBalanceChart(points, accentColor) {
  const W = 300, H = 80, PAD = 8;
  const balances = points.map(p => p.balance);
  const minB = Math.min(0, ...balances);
  const maxB = Math.max(0, ...balances);
  const range = maxB - minB || 1;

  const toX = i => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const toY = b => PAD + (1 - (b - minB) / range) * (H - PAD * 2);

  const zeroY = toY(0);

  // Build SVG path
  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.balance).toFixed(1)}`
  ).join(' ');

  // Fill area under/above zero line
  const fillD = pathD +
    ` L${toX(points.length - 1).toFixed(1)},${zeroY.toFixed(1)}` +
    ` L${toX(0).toFixed(1)},${zeroY.toFixed(1)} Z`;

  const lastBalance = points[points.length - 1].balance;
  const lineColor = lastBalance >= 0 ? '#4ade80' : '#e05555';
  const fillColor = lastBalance >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(224,85,85,0.15)';

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">
      <!-- Zero line -->
      <line x1="${PAD}" y1="${zeroY.toFixed(1)}" x2="${W - PAD}" y2="${zeroY.toFixed(1)}"
        stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2,3"/>
      <!-- Fill -->
      <path d="${fillD}" fill="${fillColor}"/>
      <!-- Line -->
      <path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
      <!-- Today dot -->
      <circle cx="${toX(points.length - 1).toFixed(1)}" cy="${toY(lastBalance).toFixed(1)}"
        r="3" fill="${lineColor}"/>
      <!-- Balance label -->
      <text x="${W - PAD}" y="${PAD + 8}" text-anchor="end"
        style="font-size:9px;fill:${lineColor};font-family:monospace;letter-spacing:1px">
        ${lastBalance >= 0 ? '+' : ''}$${lastBalance.toFixed(2)}
      </text>
    </svg>
  `;
}

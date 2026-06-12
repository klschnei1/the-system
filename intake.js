// ── INTAKE DOMAIN (Malkuth) ──────────────────────────────────────────
// What enters the body: fluid (oz), food (calories + protein).
// Quests: m1 (hydration accumulator — total oz), g2 (nutrition accumulator).
// Widget: single row oz · kcal · g protein + merged chronological entry log.
// Food bank: every named g2 entry auto-saves to data.foodBank; top foods
// render as one-tap chips in the nutrition quest input.

(function() {
  'use strict';

  const BANK_CHIP_LIMIT = 8;
  const BANK_QUESTS = ['m1', 'g2'];   // intake accumulators that learn entries

  // Derived index over every named entry in dailyLogs — never persisted.
  // dailyLogs is the source of truth; rebuilding on load means the bank
  // automatically contains everything ever logged, no migration, no schema field.
  // Shape: { qid: { normalizedName: { name, values:{fieldKey:n}, count, lastUsed } } }
  let bank = null;

  function bankFields(qid) {
    return data.questDefinitions?.malkuth?.quests?.[qid]?.accumFields || [];
  }

  function learnEntry(qid, entry) {
    if (!BANK_QUESTS.includes(qid) || !entry.note) return;
    const values = {};
    let any = false;
    bankFields(qid).forEach(f => {
      values[f.key] = entry[f.key] || 0;
      if (values[f.key] > 0) any = true;
    });
    if (!any) return;   // also skips pre-schema entries (old water/other keys)
    const key = entry.note.trim().toLowerCase().replace(/\s+/g, ' ');
    const slot = bank[qid][key];
    bank[qid][key] = {
      name: slot?.name || entry.note.trim(),
      values,   // latest values win — entries refine over time
      count: (slot?.count || 0) + 1,
      lastUsed: entry.time
    };
  }

  function ensureBank() {
    if (bank) return bank;
    bank = {};
    BANK_QUESTS.forEach(q => { bank[q] = {}; });
    Object.keys(data.dailyLogs || {}).sort().forEach(day => {
      BANK_QUESTS.forEach(qid => {
        (data.dailyLogs[day]?.[qid]?.entries || []).forEach(e => learnEntry(qid, e));
      });
    });
    return bank;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Called by addAccumEntry (system.html) after the entry is in dailyLogs.
  // If the bank is built lazily right now, the scan already includes this
  // entry — learning it again would double-count.
  window.captureAccumEntry = function(qid, entry) {
    const fresh = !bank;
    ensureBank();
    if (!fresh) learnEntry(qid, entry);
  };

  // Chip strip for an intake accumulator. `query` (from the note field)
  // live-filters by substring; empty query shows the most-used entries.
  // Always returns the container div for bank quests so filtering can
  // re-render in place; '' only for quests with no bank.
  window.getAccumQuickChips = function(qid, query) {
    if (!BANK_QUESTS.includes(qid)) return '';
    ensureBank();
    const all = Object.entries(bank[qid]);
    if (!all.length) return '';
    const q = (query || '').trim().toLowerCase();
    const matches = all
      .filter(([key]) => !q || key.includes(q))
      .sort((a, b) => (b[1].count - a[1].count) || (new Date(b[1].lastUsed) - new Date(a[1].lastUsed)))
      .slice(0, BANK_CHIP_LIMIT);
    return `<div id="chips-${qid}" style="display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 8px">` +
      matches.map(([key, f]) => {
        const vals = bankFields(qid)
          .map(f2 => f.values[f2.key] ? f.values[f2.key] + f2.units : '')
          .filter(Boolean).join(' · ');
        return `<button class="btn" style="font-size:10px;padding:4px 10px"
          onclick="event.stopPropagation();quickLogIntake('${qid}','${encodeURIComponent(key)}')">
          ${escapeHtml(f.name)}${vals ? ' <span style="color:var(--text3)">' + vals + '</span>' : ''}</button>`;
      }).join('') + '</div>';
  };

  // oninput handler on the accumulator note field (wired in system.html)
  window.filterAccumChips = function(qid, query) {
    const el = document.getElementById('chips-' + qid);
    if (el) el.outerHTML = window.getAccumQuickChips(qid, query);
  };

  window.quickLogIntake = function(qid, encodedKey) {
    ensureBank();
    const f = bank[qid]?.[decodeURIComponent(encodedKey)];
    if (!f) return;
    window.addAccumEntry(qid, f.values, f.name);
  };

  // Render the Intake domain widget.
  // Called from system.html's DOMAIN_WIDGETS.malkuth.
  // Depends on globals: todayLog (from system.html inline script).
  window.renderIntakeWidget = function(el, dk, domain) {
    const waterLog = todayLog['m1'];
    const nutritionLog = todayLog['g2'];

    const waterTotals = waterLog?.totals || { oz: 0 };
    const nutritionTotals = nutritionLog?.totals || { calories: 0, protein: 0 };

    const waterEntries = (waterLog?.entries || []).map(e => ({ ...e, kind: 'fluid' }));
    const foodEntries = (nutritionLog?.entries || []).map(e => ({ ...e, kind: 'food' }));
    const allEntries = [...waterEntries, ...foodEntries].sort((a, b) =>
      new Date(a.time) - new Date(b.time)
    );

    el.innerHTML = `
      <div class="domain-widget" style="border-color:${domain.color}">
        <!-- oz · kcal · protein -->
        <div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:${allEntries.length > 0 ? '12px' : '0'}">
          <div>
            <div style="font-size:28px;font-weight:bold;color:var(--text)">${waterTotals.oz || 0}</div>
            <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">oz</div>
          </div>
          <div style="width:1px;background:var(--border)"></div>
          <div>
            <div style="font-size:28px;font-weight:bold;color:var(--text)">${nutritionTotals.calories || 0}</div>
            <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">kcal</div>
          </div>
          <div style="width:1px;background:var(--border)"></div>
          <div>
            <div style="font-size:28px;font-weight:bold;color:var(--text)">${nutritionTotals.protein || 0}</div>
            <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">g protein</div>
          </div>
        </div>
        <!-- Merged entry log -->
        ${allEntries.length > 0 ? `
          <div style="border-top:1px solid var(--border);padding-top:8px">
            ${allEntries.map(e => {
              const time = new Date(e.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
              if (e.kind === 'fluid') {
                const parts = [];
                if (e.water) parts.push(`${e.water}oz water`);
                if (e.other) parts.push(`${e.other}oz other`);
                return `
                  <div style="font-size:10px;color:var(--text3);padding:3px 0;display:flex;justify-content:space-between">
                    <span>${time}${e.note ? ' — ' + e.note : ''}</span>
                    <span style="color:var(--text2)">${parts.join(' · ')}</span>
                  </div>`;
              } else {
                return `
                  <div style="font-size:10px;color:var(--text3);padding:3px 0;display:flex;justify-content:space-between">
                    <span>${time}${e.note ? ' — ' + e.note : ''}</span>
                    <span style="color:var(--text2)">${e.calories || 0} kcal · ${e.protein || 0}g</span>
                  </div>`;
              }
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  };
})();

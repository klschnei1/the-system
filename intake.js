// ── INTAKE DOMAIN (Malkuth) ──────────────────────────────────────────
// What enters the body: fluid (oz), food (calories + protein).
// Quests: m1 (hydration accumulator — total oz), g2 (nutrition accumulator).
// Widget: single row oz · kcal · g protein + merged chronological entry log.
// Food bank: every named g2 entry is indexed (in memory, from dailyLogs);
// top foods render as one-tap chips in the nutrition quest input.
// Batch prep ("the fridge"): persisted finite meal-prep objects in
// data.batches. A recipe → per-serving chip; tapping logs+decrements;
// at zero servings the chip clears. Batch servings are excluded from the bank.

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
    if (entry.batchId) return;   // batch servings are finite fridge state, not permanent bank foods
    const values = {};
    let any = false;
    // Entries store the consumed total (macros × servings). The bank stores
    // PER-SERVING values so tapping a saved chip logs exactly one serving.
    const servings = entry.servings > 0 ? entry.servings : 1;
    bankFields(qid).forEach(f => {
      values[f.key] = Math.round((entry[f.key] || 0) / servings);
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
    const q = (query || '').trim().toLowerCase();

    // Batch chips (nutrition only), pinned to the front. Persisted, finite,
    // self-clearing: per-serving macros · servings left · age. Newest first.
    let batchHtml = '';
    if (qid === 'g2') {
      activeBatches()
        .filter(b => !q || b.name.toLowerCase().includes(q))
        .sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn))
        .forEach(b => {
          const left = b.servingsMade - b.servingsLogged;
          const age = daysSince(b.createdOn);
          const macros = `${b.perServing.calories || 0}kcal · ${b.perServing.protein || 0}g`;
          batchHtml += `<button class="btn" style="font-size:10px;padding:4px 10px;border-color:var(--accent)"
            onclick="event.stopPropagation();logBatchServing('${b.id}')">
            🍱 ${escapeHtml(b.name)} <span style="color:var(--text3)">${macros} · ${left} left${age >= 1 ? ' · ' + age + 'd' : ''}</span></button>`;
        });
    }

    const bankHtml = Object.entries(bank[qid])
      .filter(([key]) => !q || key.includes(q))
      .sort((a, b) => (b[1].count - a[1].count) || (new Date(b[1].lastUsed) - new Date(a[1].lastUsed)))
      .slice(0, BANK_CHIP_LIMIT)
      .map(([key, f]) => {
        const vals = bankFields(qid)
          .map(f2 => f.values[f2.key] ? f.values[f2.key] + f2.units : '')
          .filter(Boolean).join(' · ');
        return `<button class="btn" style="font-size:10px;padding:4px 10px"
          onclick="event.stopPropagation();quickLogIntake('${qid}','${encodeURIComponent(key)}')">
          ${escapeHtml(f.name)}${vals ? ' <span style="color:var(--text3)">' + vals + '</span>' : ''}</button>`;
      }).join('');

    if (!batchHtml && !bankHtml) return '';
    return `<div id="chips-${qid}" style="display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 8px">${batchHtml}${bankHtml}</div>`;
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

  // ── BATCH PREP — the "fridge" ────────────────────────────────────────
  // A batch converts a recipe (ingredient lines + servings) into ONE
  // per-serving chip. Unlike derived bank chips, a batch is persisted STATE
  // (servingsMade, servingsLogged, createdOn) living in data.batches: finite
  // and self-clearing. Tapping its chip logs a serving to g2 AND decrements
  // the batch; at zero servings left the chip disappears.

  const today = () => (typeof getTodayStr === 'function' ? getTodayStr() : new Date().toISOString().slice(0, 10));

  function ensureBatches() {
    if (!data.batches) data.batches = [];
    return data.batches;
  }
  function activeBatches() {
    return ensureBatches().filter(b => (b.servingsMade - b.servingsLogged) > 0);
  }
  function daysSince(dateStr) {
    if (!dateStr) return 0;
    const a = new Date(dateStr + 'T00:00:00');
    const b = new Date(today() + 'T00:00:00');
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  // "+ Batch prep" button — nutrition quest only.
  window.getBatchButton = function(qid) {
    if (qid !== 'g2') return '';
    return `<button class="btn" style="font-size:10px;padding:4px 10px;margin-bottom:6px"
      onclick="event.stopPropagation();openBatchCalculator()">+ Batch prep</button>`;
  };

  // Tap a batch chip: log one serving to g2, then decrement the batch.
  window.logBatchServing = function(batchId) {
    const b = ensureBatches().find(x => x.id === batchId);
    if (!b || (b.servingsMade - b.servingsLogged) <= 0) return;
    const ok = window.addAccumEntry('g2',
      { calories: b.perServing.calories, protein: b.perServing.protein },
      b.name + ' (1 serving)',
      { batchId: b.id });   // tag: kept out of the derived bank
    if (ok) {
      b.servingsLogged++;
      saveData();
      if (typeof renderQuests === 'function') renderQuests();
    }
  };

  window.openBatchCalculator = function() {
    ensureBank();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

    const modal = document.createElement('div');
    modal.className = 'modal';
    overlay.appendChild(modal);

    const bankNames = Object.values(bank.g2 || {});
    modal.innerHTML = `
      <div class="modal-title">Batch prep <span class="modal-close">✕</span></div>
      <div class="modal-section">
        <div class="modal-label">Batch name</div>
        <input type="text" id="batch-name" class="log-input" style="width:100%;padding:8px"
          placeholder="e.g. Slime — tiramisu" autocomplete="off">
      </div>
      <div class="modal-section">
        <div class="modal-label">Ingredients · kcal · protein</div>
        <datalist id="batch-bank-list">
          ${bankNames.map(f => `<option value="${escapeHtml(f.name)}">`).join('')}
        </datalist>
        <div id="batch-lines"></div>
        <button class="btn" id="batch-add-line" style="font-size:10px;padding:4px 10px;margin-top:4px">+ ingredient</button>
      </div>
      <div class="modal-section" style="display:flex;align-items:center;gap:10px">
        <div class="modal-label" style="margin:0">Servings made</div>
        <input type="number" id="batch-servings" class="log-input"
          style="width:70px;padding:6px 8px;text-align:right" placeholder="0" min="1">
      </div>
      <div id="batch-preview" style="font-size:12px;color:var(--text2);margin:0 0 14px;text-align:center"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" id="batch-save" style="flex:1">Save batch</button>
        <button class="btn btn-ghost" id="batch-cancel">Cancel</button>
      </div>
    `;

    const linesEl = modal.querySelector('#batch-lines');

    function addLine(prefill) {
      const row = document.createElement('div');
      row.className = 'batch-line';
      row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
      row.innerHTML = `
        <input type="text" class="bl-name log-input" list="batch-bank-list"
          style="flex:1;min-width:0;padding:6px 8px;font-size:12px" placeholder="ingredient" autocomplete="off">
        <input type="number" class="bl-kcal log-input"
          style="width:60px;padding:6px;font-size:12px;text-align:right" placeholder="kcal" min="0">
        <input type="number" class="bl-protein log-input"
          style="width:50px;padding:6px;font-size:12px;text-align:right" placeholder="g" min="0">
        <span class="bl-remove" style="cursor:pointer;color:var(--text3);font-size:14px;padding:0 2px">✕</span>`;
      const nameI = row.querySelector('.bl-name');
      const kcalI = row.querySelector('.bl-kcal');
      const protI = row.querySelector('.bl-protein');
      if (prefill) {
        nameI.value = prefill.name || '';
        if (prefill.calories) kcalI.value = prefill.calories;
        if (prefill.protein) protI.value = prefill.protein;
      }
      // Pull from the bank: choosing a known food fills its macros.
      nameI.addEventListener('change', () => {
        const key = nameI.value.trim().toLowerCase().replace(/\s+/g, ' ');
        const hit = bank.g2 && bank.g2[key];
        if (hit) {
          if (hit.values.calories) kcalI.value = hit.values.calories;
          if (hit.values.protein) protI.value = hit.values.protein;
          recompute();
        }
      });
      kcalI.addEventListener('input', recompute);
      protI.addEventListener('input', recompute);
      row.querySelector('.bl-remove').onclick = () => { row.remove(); recompute(); };
      linesEl.appendChild(row);
    }

    function totals() {
      let kcal = 0, protein = 0;
      linesEl.querySelectorAll('.batch-line').forEach(r => {
        kcal += parseFloat(r.querySelector('.bl-kcal').value) || 0;
        protein += parseFloat(r.querySelector('.bl-protein').value) || 0;
      });
      return { kcal, protein };
    }

    function recompute() {
      const s = parseInt(modal.querySelector('#batch-servings').value) || 0;
      const t = totals();
      const prev = modal.querySelector('#batch-preview');
      if (s >= 1 && (t.kcal > 0 || t.protein > 0)) {
        prev.innerHTML = `Per serving: <b style="color:var(--text)">${Math.round(t.kcal / s)}</b> kcal · ` +
          `<b style="color:var(--text)">${Math.round(t.protein / s)}</b> g protein ` +
          `<span style="color:var(--text3)">· makes ${s}</span>`;
      } else {
        prev.innerHTML = `<span style="color:var(--text3)">Add ingredients + servings to preview</span>`;
      }
    }

    addLine(); addLine();   // start with two empty lines
    recompute();

    modal.querySelector('#batch-add-line').onclick = () => addLine();
    modal.querySelector('#batch-servings').addEventListener('input', recompute);
    modal.querySelector('.modal-close').onclick = () => overlay.remove();
    modal.querySelector('#batch-cancel').onclick = () => overlay.remove();

    modal.querySelector('#batch-save').onclick = () => {
      const name = modal.querySelector('#batch-name').value.trim() || 'Batch';
      const s = parseInt(modal.querySelector('#batch-servings').value) || 0;
      const t = totals();
      if (s < 1) { notify('Set servings made (1 or more).'); return; }
      if (t.kcal <= 0 && t.protein <= 0) { notify('Add at least one ingredient with values.'); return; }
      ensureBatches().push({
        id: 'b' + Date.now(),
        name: name,
        createdOn: today(),
        servingsMade: s,
        servingsLogged: 0,
        perServing: { calories: Math.round(t.kcal / s), protein: Math.round(t.protein / s) }
      });
      saveData();
      overlay.remove();
      notify(`Batch "${name}" prepped — ${s} servings in the fridge.`);
      if (typeof renderQuests === 'function') renderQuests();
    };

    document.body.appendChild(overlay);
    modal.querySelector('#batch-name').focus();
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

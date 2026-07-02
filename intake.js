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
    if (BANK_QUESTS.includes(qid)) pendingJuice = { qid, entry, at: Date.now() };
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

  // Tap a batch chip: log one serving to g2, then decrement the batch.
  window.logBatchServing = function(batchId) {
    const b = ensureBatches().find(x => x.id === batchId);
    if (!b || (b.servingsMade - b.servingsLogged) <= 0) return;
    const ok = window.addAccumEntry('g2',
      { calories: b.perServing.calories, protein: b.perServing.protein,
        carbs: b.perServing.carbs, fat: b.perServing.fat },
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
        <div class="modal-label">Ingredient · qty · kcal · protein</div>
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
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px';
      // autocomplete="off" on every input: without it the browser refills a
      // freshly-added line with the previous line's values (the "doubling" bug).
      row.innerHTML = `
        <input type="text" class="bl-name log-input" list="batch-bank-list"
          style="flex:1;min-width:90px;padding:6px 8px;font-size:12px" placeholder="ingredient" autocomplete="off">
        <input type="number" class="bl-qty log-input"
          style="width:38px;padding:6px;font-size:12px;text-align:right" placeholder="1" min="0" step="any" autocomplete="off">
        <input type="number" class="bl-kcal log-input"
          style="width:50px;padding:6px;font-size:12px;text-align:right" placeholder="kcal" min="0" autocomplete="off">
        <input type="number" class="bl-protein log-input"
          style="width:40px;padding:6px;font-size:12px;text-align:right" placeholder="P" min="0" autocomplete="off">
        <input type="number" class="bl-carbs log-input"
          style="width:40px;padding:6px;font-size:12px;text-align:right" placeholder="C" min="0" autocomplete="off">
        <input type="number" class="bl-fat log-input"
          style="width:40px;padding:6px;font-size:12px;text-align:right" placeholder="F" min="0" autocomplete="off">
        <span class="bl-remove" style="cursor:pointer;color:var(--text3);font-size:14px;padding:0 2px">✕</span>`;
      const nameI = row.querySelector('.bl-name');
      const qtyI = row.querySelector('.bl-qty');
      const kcalI = row.querySelector('.bl-kcal');
      const protI = row.querySelector('.bl-protein');
      const carbI = row.querySelector('.bl-carbs');
      const fatI = row.querySelector('.bl-fat');
      if (prefill) {
        nameI.value = prefill.name || '';
        if (prefill.qty) qtyI.value = prefill.qty;
        if (prefill.calories) kcalI.value = prefill.calories;
        if (prefill.protein) protI.value = prefill.protein;
        if (prefill.carbs) carbI.value = prefill.carbs;
        if (prefill.fat) fatI.value = prefill.fat;
      }
      // Pull from the bank: choosing a known food fills its macros.
      nameI.addEventListener('change', () => {
        const key = nameI.value.trim().toLowerCase().replace(/\s+/g, ' ');
        const hit = bank.g2 && bank.g2[key];
        if (hit) {
          if (hit.values.calories) kcalI.value = hit.values.calories;
          if (hit.values.protein) protI.value = hit.values.protein;
          if (hit.values.carbs) carbI.value = hit.values.carbs;
          if (hit.values.fat) fatI.value = hit.values.fat;
          recompute();
        }
      });
      qtyI.addEventListener('input', recompute);
      kcalI.addEventListener('input', recompute);
      protI.addEventListener('input', recompute);
      carbI.addEventListener('input', recompute);
      fatI.addEventListener('input', recompute);
      row.querySelector('.bl-remove').onclick = () => { row.remove(); recompute(); };
      linesEl.appendChild(row);
    }

    function totals() {
      let kcal = 0, protein = 0, carbs = 0, fat = 0;
      linesEl.querySelectorAll('.batch-line').forEach(r => {
        const q = parseFloat(r.querySelector('.bl-qty').value);
        const mult = q > 0 ? q : 1;   // blank qty counts as one serving
        kcal += mult * (parseFloat(r.querySelector('.bl-kcal').value) || 0);
        protein += mult * (parseFloat(r.querySelector('.bl-protein').value) || 0);
        carbs += mult * (parseFloat(r.querySelector('.bl-carbs').value) || 0);
        fat += mult * (parseFloat(r.querySelector('.bl-fat').value) || 0);
      });
      return { kcal, protein, carbs, fat };
    }

    function recompute() {
      const s = parseInt(modal.querySelector('#batch-servings').value) || 0;
      const t = totals();
      const prev = modal.querySelector('#batch-preview');
      if (s >= 1 && (t.kcal > 0 || t.protein > 0 || t.carbs > 0 || t.fat > 0)) {
        const macroTail = (t.carbs > 0 || t.fat > 0)
          ? ` · <b style="color:var(--text)">${Math.round(t.carbs / s)}</b> C · <b style="color:var(--text)">${Math.round(t.fat / s)}</b> F`
          : '';
        prev.innerHTML = `Per serving: <b style="color:var(--text)">${Math.round(t.kcal / s)}</b> kcal · ` +
          `<b style="color:var(--text)">${Math.round(t.protein / s)}</b> g protein${macroTail} ` +
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
        perServing: {
          calories: Math.round(t.kcal / s),
          protein: Math.round(t.protein / s),
          carbs: Math.round(t.carbs / s),
          fat: Math.round(t.fat / s)
        }
      });
      saveData();
      overlay.remove();
      notify(`Batch "${name}" prepped — ${s} servings in the fridge.`);
      if (typeof renderQuests === 'function') renderQuests();
    };

    document.body.appendChild(overlay);
    modal.querySelector('#batch-name').focus();
  };

  // ── CARB/FAT ESTIMATOR ───────────────────────────────────────────────
  // Derives plausible carbs/fat from a food name + its recorded calories and
  // protein, using the 4/4/9 kcal split. EXPLICITLY an estimate, never silent:
  // it only seeds the Food Manager's inputs, which Karl reviews before saving.
  // carbFrac = fraction of the NON-protein energy assumed to be carbohydrate.
  const HI_CARB = /rice|bread|bagel|pasta|noodle|oat|granola|cereal|potato|fries|fruit|banana|apple|berr|pancake|waffle|toast|cookie|oreo|cracker|twinkie|cake|pie|muffin|sugar|cand(y|ie)|donut|honey|juice|soda|biscoff|palmier|bundt|tiramisu|parfait|graham|mac and cheese|slime|gainer|chocolate milk|\bmilk/;
  const HI_FAT  = /oil|butter|cheese|alfredo|cream|\bnut|almond|peanut|avocado|bacon|sausage|charcuterie|pesto|mayo|palmier/;
  const LEAN    = /chicken|beef|steak|fish|salmon|tuna|\begg|whey|protein shake|protein|greek yogurt|turkey|pork|jerky/;
  function carbFrac(name) {
    const n = (name || '').toLowerCase();
    if (LEAN.test(n) && !HI_CARB.test(n)) return 0.25;
    if (HI_FAT.test(n) && !HI_CARB.test(n)) return 0.20;
    if (HI_CARB.test(n)) return 0.80;
    return 0.50;   // mixed / unknown
  }
  window.estimateMacros = function(name, calories, protein) {
    const C = calories || 0, P = protein || 0;
    const R = Math.max(0, C - 4 * P);   // energy not accounted for by protein
    const cf = carbFrac(name);
    return { carbs: Math.round(R * cf / 4), fat: Math.round(R * (1 - cf) / 9) };
  };

  // ── WRITE-BACK: edit a food's macros on its most-recent entry ─────────
  // The bank is derived ("latest values win"), so correcting a food = editing
  // its latest dailyLogs entry. Inputs are PER-SERVING (what the chip shows);
  // entries store the consumed total, so scale by that entry's servings.
  function recomputeDayTotals(day, qid) {
    const log = data.dailyLogs?.[day]?.[qid];
    if (!log) return;
    const totals = {};
    bankFields(qid).forEach(f => {
      totals[f.key] = (log.entries || []).reduce((s, e) => s + (e[f.key] || 0), 0);
    });
    log.totals = totals;
    log.note = bankFields(qid).map(f => `${totals[f.key]} ${f.units}`).join(' | ');
  }

  function updateFoodMacros(key, vals) {
    let target = null, targetDay = null;
    Object.keys(data.dailyLogs || {}).sort().forEach(day => {
      (data.dailyLogs[day]?.g2?.entries || []).forEach(e => {
        if (e.batchId) return;   // batch servings aren't editable "foods"
        const nk = (e.note || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (nk === key) { target = e; targetDay = day; }   // keep last = most recent
      });
    });
    if (!target) return false;
    const servings = target.servings > 0 ? target.servings : 1;
    ['calories', 'protein', 'carbs', 'fat'].forEach(f => {
      if (vals[f] !== undefined && vals[f] !== null && vals[f] !== '') {
        target[f] = Math.round(parseFloat(vals[f]) * servings);
      }
    });
    recomputeDayTotals(targetDay, 'g2');
    // keep the live today view in sync if we edited today's log
    if (typeof getTodayStr === 'function' && targetDay === getTodayStr()
        && typeof todayLog !== 'undefined' && data.dailyLogs[targetDay]?.g2) {
      todayLog['g2'] = data.dailyLogs[targetDay].g2;
    }
    return true;
  }

  // ── FOOD MANAGER MODAL ───────────────────────────────────────────────
  // Lists every saved food (per-serving cal/P/C/F, editable). "Estimate
  // missing C/F" seeds blanks from estimateMacros for review. Save writes
  // changed rows back via updateFoodMacros, then rebuilds the bank.
  window.openFoodManager = function() {
    ensureBank();
    const rows = Object.entries(bank.g2 || {})
      .sort((a, b) => (b[1].count - a[1].count) || (new Date(b[1].lastUsed) - new Date(a[1].lastUsed)));

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    const modal = document.createElement('div');
    modal.className = 'modal';
    overlay.appendChild(modal);

    const F = ['calories', 'protein', 'carbs', 'fat'];
    const missing = rows.filter(([, f]) => !f.values.carbs && !f.values.fat).length;

    modal.innerHTML = `
      <div class="modal-title">Saved foods <span class="modal-close">✕</span></div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
        Per-serving macros. Edit any value; tap <b>Estimate missing C/F</b> to seed blanks
        (estimates — review before saving). ${rows.length} foods${missing ? ` · ${missing} missing carbs/fat` : ''}.
      </div>
      ${missing ? `<button class="btn" id="fm-estimate" style="width:100%;font-size:11px;margin-bottom:12px;border-color:var(--accent)">⚗ Estimate missing C/F (${missing})</button>` : ''}
      <div style="display:flex;gap:6px;font-size:8px;letter-spacing:1px;color:var(--text3);text-transform:uppercase;padding:0 2px 4px">
        <span style="flex:1">food</span><span style="width:46px;text-align:right">kcal</span>
        <span style="width:34px;text-align:right">P</span><span style="width:34px;text-align:right">C</span><span style="width:34px;text-align:right">F</span>
      </div>
      <div id="fm-rows" style="max-height:50vh;overflow-y:auto"></div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-primary" id="fm-save" style="flex:1">Save changes</button>
        <button class="btn btn-ghost" id="fm-cancel">Cancel</button>
      </div>`;

    const rowsEl = modal.querySelector('#fm-rows');
    rows.forEach(([key, f]) => {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
      r.dataset.key = key;
      r.dataset.name = f.name;   // for the estimator
      r.innerHTML = `
        <span style="flex:1;min-width:0;font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(f.name)}</span>
        ${F.map(fk => {
          const w = fk === 'calories' ? 46 : 34;
          return `<input type="number" class="log-input fm-${fk}" data-base="${f.values[fk] || ''}"
            style="width:${w}px;padding:5px;font-size:11px;text-align:right" min="0" autocomplete="off"
            value="${f.values[fk] || ''}" placeholder="—">`;
        }).join('')}`;
      rowsEl.appendChild(r);
    });

    const estBtn = modal.querySelector('#fm-estimate');
    if (estBtn) estBtn.onclick = () => {
      rowsEl.querySelectorAll('[data-key]').forEach(r => {
        const cEl = r.querySelector('.fm-carbs'), fEl = r.querySelector('.fm-fat');
        if (cEl.value || fEl.value) return;   // already has macros — leave it
        const cal = parseFloat(r.querySelector('.fm-calories').value) || 0;
        const prot = parseFloat(r.querySelector('.fm-protein').value) || 0;
        const est = window.estimateMacros(r.dataset.name, cal, prot);
        cEl.value = est.carbs; fEl.value = est.fat;
        cEl.style.color = 'var(--accent)'; fEl.style.color = 'var(--accent)';   // mark as estimate
      });
      notify('Estimates filled — review, then Save.');
    };

    modal.querySelector('#fm-cancel').onclick = () => overlay.remove();
    modal.querySelector('.modal-close').onclick = () => overlay.remove();
    modal.querySelector('#fm-save').onclick = () => {
      let changed = 0;
      rowsEl.querySelectorAll('[data-key]').forEach(r => {
        const vals = {}; let diff = false;
        F.forEach(fk => {
          const el = r.querySelector('.fm-' + fk);
          vals[fk] = el.value;
          if ((el.value || '') !== (el.dataset.base || '')) diff = true;
        });
        if (diff && updateFoodMacros(r.dataset.key, vals)) changed++;
      });
      bank = null; ensureBank();          // rebuild derived index from edited logs
      saveData();
      overlay.remove();
      if (typeof renderQuests === 'function') renderQuests();
      notify(changed ? `Updated ${changed} food${changed !== 1 ? 's' : ''}.` : 'No changes.');
    };

    document.body.appendChild(overlay);
  };

  // ── JUICE — entry-landing choreography ──────────────────────────────
  // One-shot feedback the moment an intake entry lands: the totals the
  // entry moved count up and pop, the widget frame glows (blue for fluid,
  // domain gold for food), and the new log row slides in under a colored
  // bar. captureAccumEntry sets pendingJuice on EVERY intake entry path
  // (manual log, bank chip, batch serving); the next renderIntakeWidget
  // consumes it. A stale flag (>2s — the entry was logged from the
  // overview tab, where the widget isn't mounted) is dropped so opening
  // the domain page later doesn't replay the show.
  // Ported July 2 from the phone session's deploy-repo branch
  // (claude/juice-intake-widget-gi7ncf); this repo is the source of truth.
  // Tier-2 intake moment per cold_harbor/juice.md — no reward roll here, so
  // no conflict with the reveal-first rule. Fold countUp into juice.rollup
  // when juice.js lands.
  const FLUID_JUICE = '#57a7e0';
  let pendingJuice = null;

  function ensureJuiceCss() {
    if (document.getElementById('intake-juice-css')) return;
    const s = document.createElement('style');
    s.id = 'intake-juice-css';
    s.textContent = `
      @keyframes intakeStatPop {
        0% { transform: scale(1); }
        30% { transform: scale(1.22); color: var(--juice-color, var(--accent));
              text-shadow: 0 0 14px var(--juice-color, var(--accent)); }
        100% { transform: scale(1); }
      }
      .intake-stat-pop { animation: intakeStatPop 0.6s cubic-bezier(.22,1.2,.36,1); }
      @keyframes intakeWidgetGlow {
        0%, 100% { box-shadow: none; }
        25% { box-shadow: 0 0 18px -2px var(--juice-color, var(--accent)); }
      }
      .intake-widget-juice { animation: intakeWidgetGlow 0.9s ease-out; }
      @keyframes intakeEntryIn {
        0% { opacity: 0; transform: translateY(-4px); }
        100% { opacity: 1; transform: none; }
      }
      @keyframes intakeEntryBar {
        0%, 55% { box-shadow: inset 3px 0 0 var(--juice-color, var(--accent)); }
        100% { box-shadow: inset 3px 0 0 transparent; }
      }
      .intake-entry-new { animation: intakeEntryIn 0.35s ease-out, intakeEntryBar 1.6s ease-out; }`;
    document.head.appendChild(s);
  }

  function countUp(el, from, to, ms) {
    from = Math.max(0, from);
    if (from === to) return;
    const t0 = performance.now();
    (function frame(t) {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(frame);
    })(t0);
  }

  // Fresh-DOM assumption: renderIntakeWidget just rebuilt el.innerHTML, so
  // every animated node is new — classes are added, never removed (the next
  // render wipes them). No animationend bookkeeping needed.
  function applyIntakeJuice(el, domain) {
    const j = pendingJuice;
    pendingJuice = null;
    if (!j || Date.now() - j.at > 2000) return;
    // Even the prison gets juice (Karl, July 2 — the black_iron skip felt
    // like a bug, not atmosphere). Only an OS reduced-motion preference
    // suppresses it now.
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const widget = el.querySelector('.domain-widget');
    if (!widget) return;
    widget.style.setProperty('--juice-color', j.qid === 'm1' ? FLUID_JUICE : domain.color);
    widget.classList.add('intake-widget-juice');

    // Count up + pop each headline stat the entry moved. The widget already
    // shows the NEW total; roll in from (total − what this entry added).
    const gains = j.qid === 'm1'
      ? { oz: j.entry.oz }
      : { calories: j.entry.calories, protein: j.entry.protein };
    Object.entries(gains).forEach(([key, gained]) => {
      if (!(gained > 0)) return;
      const stat = el.querySelector(`.intake-stat[data-stat="${key}"]`);
      if (!stat) return;
      const to = parseFloat(stat.textContent) || 0;
      countUp(stat, to - gained, to, 600);
      stat.classList.add('intake-stat-pop');
    });
    if (j.qid === 'g2' && (j.entry.carbs || j.entry.fat)) {
      const line = el.querySelector('.intake-macro-line');
      if (line) line.classList.add('intake-stat-pop');
    }

    // The new entry is the newest timestamp → last row of the merged log.
    const rows = el.querySelectorAll('.intake-entry');
    if (rows.length) rows[rows.length - 1].classList.add('intake-entry-new');
  }

  // Render the Intake domain widget.
  // Called from system.html's DOMAIN_WIDGETS.malkuth.
  // Depends on globals: todayLog (from system.html inline script).
  window.renderIntakeWidget = function(el, dk, domain) {
    ensureJuiceCss();
    const waterLog = todayLog['m1'];
    const nutritionLog = todayLog['g2'];

    const waterTotals = waterLog?.totals || { oz: 0 };
    const nutritionTotals = nutritionLog?.totals || { calories: 0, protein: 0 };

    const waterEntries = (waterLog?.entries || []).map(e => ({ ...e, kind: 'fluid' }));
    const foodEntries = (nutritionLog?.entries || []).map(e => ({ ...e, kind: 'food' }));
    const allEntries = [...waterEntries, ...foodEntries].sort((a, b) =>
      new Date(a.time) - new Date(b.time)
    );

    // Batch prep — a small unlabeled glyph (an affordance, not a labeled
    // button): a vessel holding three portions. Opens the calculator. Lives
    // between the log forms and the summary, out of the quick-log chip strip.
    const c = domain.color;
    const batchGlyph = `
      <button class="batch-glyph" onclick="openBatchCalculator()" title="Batch prep" aria-label="Batch prep" style="color:${c}">
        <svg width="26" height="26" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.3" stroke-dasharray="3,3"/>
          <polygon points="7,9 25,9 16,25" fill="none" stroke="${c}" stroke-width="1" opacity="0.75"/>
          <circle cx="12" cy="13" r="1.1" fill="${c}" opacity="0.85"/>
          <circle cx="16" cy="13" r="1.1" fill="${c}" opacity="0.85"/>
          <circle cx="20" cy="13" r="1.1" fill="${c}" opacity="0.85"/>
        </svg>
      </button>`;

    el.innerHTML = `
      ${batchGlyph}
      <div class="domain-widget" style="border-color:${domain.color}">
        <!-- oz · kcal · protein (primary); carbs · fat (secondary) -->
        <div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:${(nutritionTotals.carbs || nutritionTotals.fat) ? '4px' : (allEntries.length > 0 ? '12px' : '0')}">
          <div>
            <div class="intake-stat" data-stat="oz" style="font-size:28px;font-weight:bold;color:var(--text)">${waterTotals.oz || 0}</div>
            <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">oz</div>
          </div>
          <div style="width:1px;background:var(--border)"></div>
          <div>
            <div class="intake-stat" data-stat="calories" style="font-size:28px;font-weight:bold;color:var(--text)">${nutritionTotals.calories || 0}</div>
            <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">kcal</div>
          </div>
          <div style="width:1px;background:var(--border)"></div>
          <div>
            <div class="intake-stat" data-stat="protein" style="font-size:28px;font-weight:bold;color:var(--text)">${nutritionTotals.protein || 0}</div>
            <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">g protein</div>
          </div>
        </div>
        ${(nutritionTotals.carbs || nutritionTotals.fat) ? `
          <div class="intake-macro-line" style="text-align:center;font-size:11px;color:var(--text3);letter-spacing:0.5px;margin-bottom:${allEntries.length > 0 ? '12px' : '0'}">
            ${nutritionTotals.carbs || 0}g carbs · ${nutritionTotals.fat || 0}g fat
          </div>` : ''}
        <!-- Merged entry log -->
        ${allEntries.length > 0 ? `
          <div style="border-top:1px solid var(--border);padding-top:8px">
            ${allEntries.map(e => {
              const time = new Date(e.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
              if (e.kind === 'fluid') {
                const parts = [];
                if (e.oz) parts.push(`${e.oz}oz`);
                if (e.water) parts.push(`${e.water}oz water`);
                if (e.other) parts.push(`${e.other}oz other`);
                return `
                  <div class="intake-entry" style="font-size:10px;color:var(--text3);padding:3px 0;display:flex;justify-content:space-between">
                    <span>${time}${e.note ? ' — ' + e.note : ''}</span>
                    <span style="color:var(--text2)">${parts.join(' · ')}</span>
                  </div>`;
              } else {
                const macroTail = (e.carbs || e.fat) ? ` · ${e.carbs || 0}c/${e.fat || 0}f` : '';
                return `
                  <div class="intake-entry" style="font-size:10px;color:var(--text3);padding:3px 0;display:flex;justify-content:space-between">
                    <span>${time}${e.note ? ' — ' + e.note : ''}</span>
                    <span style="color:var(--text2)">${e.calories || 0} kcal · ${e.protein || 0}g${macroTail}</span>
                  </div>`;
              }
            }).join('')}
          </div>
        ` : ''}
        <div style="text-align:center;margin-top:10px">
          <button onclick="openFoodManager()"
            style="background:none;border:none;color:var(--text3);font-size:9px;letter-spacing:1px;cursor:pointer;text-transform:uppercase;text-decoration:underline">✎ Edit saved foods</button>
        </div>
      </div>
    `;

    applyIntakeJuice(el, domain);
  };
})();

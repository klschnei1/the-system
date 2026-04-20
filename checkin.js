// checkin.js — Weekly Check-In Engine
// Live conversational interview (per-turn API) + deterministic write-back on close.
// Globals consumed: data, todayLog, saveData, getTodayStr, calcDomainScores,
//                   SENSEI, selectCommunionSensei, isSunday, notify

(function () {

  // ── ISO week helpers ─────────────────────────────────────────────────────

  function dateToISOWeek(d) {
    d = new Date(+d);
    d.setHours(12, 0, 0, 0);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - jan1) / 86400000) + 1) / 7);
    return d.getFullYear() + '-W' + String(week).padStart(2, '0');
  }

  function currentISOWeek() { return dateToISOWeek(new Date()); }

  function addISOWeeks(isoWeek, n) {
    const m = isoWeek.match(/^(\d{4})-W(\d{2})$/);
    if (!m) return isoWeek;
    const year = parseInt(m[1]), week = parseInt(m[2]);
    const jan4 = new Date(year, 0, 4);
    const dayOfJan4 = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayOfJan4 + 1 + (week - 1) * 7 + n * 7);
    return dateToISOWeek(monday);
  }

  // ── State ────────────────────────────────────────────────────────────────

  let CI = null;
  let _gradeState = {};

  function checkinDoneThisWeek() {
    return (data.checkinLog || []).some(e => e.isoWeek === currentISOWeek());
  }

  // ── Week analysis ────────────────────────────────────────────────────────

  function buildCheckinWeekData() {
    const today = typeof getTodayStr === 'function' ? getTodayStr() : new Date().toLocaleDateString('en-CA');
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today + 'T12:00:00');
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('en-CA'));
    }

    const domainHits = {};
    const questHits = {};
    let weekXP = 0;

    Object.entries(data.questDefinitions || {}).forEach(([dk, domain]) => {
      domainHits[dk] = { name: domain.name, daysActive: 0, color: domain.color };
      Object.keys(domain.quests || {}).forEach(qid => {
        questHits[qid] = { domain: dk, name: domain.quests[qid].name, count: 0 };
      });
    });

    days.forEach(day => {
      const log = data.dailyLogs?.[day] || {};
      const activeDomains = new Set();
      Object.entries(log).forEach(([qid, entry]) => {
        if (questHits[qid]) {
          questHits[qid].count++;
          activeDomains.add(questHits[qid].domain);
          weekXP += entry.xp || 0;
        }
      });
      activeDomains.forEach(dk => { if (domainHits[dk]) domainHits[dk].daysActive++; });
    });

    const darkDomains = Object.entries(domainHits)
      .filter(([, d]) => d.daysActive === 0).map(([dk]) => dk);
    const scores = typeof calcDomainScores === 'function' ? calcDomainScores() : {};

    return { days, domainHits, questHits, weekXP, darkDomains, scores };
  }

  // ── Sensei selection ─────────────────────────────────────────────────────

  function selectCheckinSensei(week) {
    if (typeof selectCommunionSensei === 'function') {
      const weekForSensei = {
        domains: Object.fromEntries(
          Object.entries(week.domainHits).map(([dk, d]) => [dk, { daysActive: d.daysActive }])
        )
      };
      return selectCommunionSensei(weekForSensei);
    }
    return 'hekate';
  }

  // ── System prompt ─────────────────────────────────────────────────────────

  function buildSystemPrompt(week, senseiKey) {
    const sensei = (typeof SENSEI !== 'undefined' && SENSEI[senseiKey]) ? SENSEI[senseiKey] : null;
    const persona = sensei?.prompt || 'You are a direct, perceptive behavioral coach.';

    const domainLines = Object.entries(week.domainHits)
      .map(([, d]) => `${d.name}: ${d.daysActive}/7`)
      .join(', ');

    const nudgeLines = (data.activeNudges || [])
      .filter(n => n.status === 'active')
      .map(n => {
        const dname = (data.questDefinitions[n.domain] || {}).name || n.domain;
        const grades = (n.grades || []).slice(-1)[0];
        const gradeStr = grades ? ` (last: stuck=${grades.stuck}, worked=${grades.worked})` : '';
        return `  [${n.type}] ${dname}: if ${n.if} → ${n.then}${gradeStr}`;
      }).join('\n') || '  None active';

    return `${persona}

You are conducting the weekly check-in for a personal cybernetic self-regulation system. The user tracks 9 life domains daily.

WEEK ${currentISOWeek()} DATA:
${domainLines}
XP earned: ${week.weekXP}

ACTIVE IF-THEN INTERVENTIONS:
${nudgeLines}

You already have the data — don't ask the user to report their stats. Conduct a natural, focused conversation:
- What drove the strongest domain this week
- What caused the biggest gap
- How the active interventions felt in practice
- What they want to prioritize

Keep responses short — 2-4 sentences max. No bullet lists. Stay in character. The user will end the conversation when ready and then set targets.`;
  }

  // ── Overlay management ───────────────────────────────────────────────────

  function getOrCreateOverlay() {
    let el = document.getElementById('checkinOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'checkinOverlay';
      el.className = 'communion-overlay';
      el.innerHTML = `
        <div class="communion-header">
          <span id="checkinSenseiLabel">∴ Weekly Check-In</span>
          <button onclick="window.closeCheckin()" style="background:none;border:none;color:var(--text3);font-family:inherit;font-size:14px;cursor:pointer">✕</button>
        </div>
        <div class="communion-thread" id="checkinThread"></div>
        <div id="checkinInput" style="padding:12px 20px;border-top:1px solid var(--border)"></div>`;
      document.body.appendChild(el);
    }
    return el;
  }

  function appendSenseiMsg(html) {
    const thread = document.getElementById('checkinThread');
    const div = document.createElement('div');
    div.className = 'communion-msg sensei';
    div.innerHTML = html;
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
    return div;
  }

  function appendUserBubble(text) {
    const thread = document.getElementById('checkinThread');
    const div = document.createElement('div');
    div.className = 'communion-msg user';
    div.textContent = text;
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
  }

  function appendNote(text) {
    const thread = document.getElementById('checkinThread');
    const div = document.createElement('div');
    div.className = 'communion-msg system-note';
    div.textContent = text;
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
  }

  function setInput(html) {
    const el = document.getElementById('checkinInput');
    if (el) el.innerHTML = html;
  }

  // ── Style helpers ─────────────────────────────────────────────────────────

  function chipBtn(label, onclick) {
    return `<button onclick="${onclick}" style="background:var(--accent);color:#000;border:none;padding:8px 16px;font-family:inherit;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;border-radius:3px">${label}</button>`;
  }

  function ghostBtn(label, onclick) {
    return `<button onclick="${onclick}" style="background:var(--bg3);color:var(--text2);border:1px solid var(--border);padding:6px 12px;font-family:inherit;font-size:10px;letter-spacing:1px;cursor:pointer;border-radius:3px">${label}</button>`;
  }

  function adjBtn(label, onclick) {
    return `<button onclick="${onclick}" style="background:var(--bg2);color:var(--text);border:1px solid var(--border);padding:2px 8px;font-family:inherit;font-size:12px;cursor:pointer;border-radius:2px">${label}</button>`;
  }

  function gradeChip(label, groupId, value) {
    const selected = _gradeState[groupId] === value;
    return `<button onclick="window._ci_selectGrade('${groupId}','${value}',this)"
      style="background:${selected ? 'var(--accent)' : 'var(--bg3)'};color:${selected ? '#000' : 'var(--text2)'};border:1px solid var(--border);padding:5px 10px;font-family:inherit;font-size:10px;cursor:pointer;border-radius:3px">${label}</button>`;
  }

  function inputCSS() {
    return 'width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);font-family:inherit;font-size:12px;padding:8px 10px;border-radius:3px;outline:none;box-sizing:border-box';
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Live chat ─────────────────────────────────────────────────────────────

  function renderChatInput() {
    setInput(`
      <div style="display:flex;gap:8px;align-items:flex-end">
        <textarea id="ciMsgInput" rows="2" placeholder="..."
          style="flex:1;background:var(--bg3);border:1px solid var(--border);color:var(--text);font-family:inherit;font-size:12px;padding:8px 10px;border-radius:3px;outline:none;resize:none;box-sizing:border-box"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window._ci_sendMsg()}"></textarea>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button id="ciSendBtn" onclick="window._ci_sendMsg()"
            style="background:var(--accent);color:#000;border:none;padding:8px 14px;font-family:inherit;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;border-radius:3px">Send</button>
          <button id="ciWrapBtn" onclick="window._ci_showWrapUp()"
            style="display:none;background:var(--bg3);color:var(--text2);border:1px solid var(--border);padding:6px 14px;font-family:inherit;font-size:10px;letter-spacing:1px;cursor:pointer;border-radius:3px">Wrap Up</button>
        </div>
      </div>
    `);
    setTimeout(() => document.getElementById('ciMsgInput')?.focus(), 50);
  }

  async function sendTurn(userText) {
    if (!CI || CI.inWrapUp) return;
    CI.messages.push({ role: 'user', content: userText });
    appendUserBubble(userText);

    const sendBtn = document.getElementById('ciSendBtn');
    const wrapBtn = document.getElementById('ciWrapBtn');
    if (sendBtn) sendBtn.disabled = true;
    if (wrapBtn) wrapBtn.disabled = true;

    const typingDiv = appendSenseiMsg('<span style="color:var(--text3);letter-spacing:2px">...</span>');

    const apiKey = localStorage.getItem('css_anthropic_key');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          system: CI.systemPrompt,
          messages: CI.messages
        })
      });

      if (res.ok) {
        const json = await res.json();
        const text = json.content?.[0]?.text || '';
        typingDiv.className = 'communion-msg sensei';
        typingDiv.textContent = text;
        CI.messages.push({ role: 'assistant', content: text });
      } else {
        typingDiv.textContent = 'Signal lost.';
        CI.messages.pop();
      }
    } catch (e) {
      typingDiv.textContent = 'Signal lost.';
      CI.messages.pop();
    }

    if (sendBtn) sendBtn.disabled = false;
    // Show wrap-up after 2+ user turns
    if (wrapBtn && CI.messages.filter(m => m.role === 'user').length >= 2) {
      wrapBtn.style.display = 'block';
      wrapBtn.disabled = false;
    }
    document.getElementById('checkinThread')?.scrollTo(0, 9999);
  }

  window._ci_sendMsg = function () {
    const el = document.getElementById('ciMsgInput');
    const text = (el?.value || '').trim();
    if (!text || !CI) return;
    el.value = '';
    sendTurn(text);
  };

  // ── Wrap-up form ──────────────────────────────────────────────────────────

  window._ci_showWrapUp = function () {
    if (!CI) return;
    CI.inWrapUp = true;
    _gradeState = {};

    // Initialize targets from last week's actuals
    if (!CI.responses.targets) {
      CI.responses.targets = {};
      Object.keys(data.questDefinitions || {}).forEach(dk => {
        const daysActive = CI.week.domainHits[dk]?.daysActive || 0;
        CI.responses.targets[dk] = {
          floor: Math.max(1, daysActive),
          reach: Math.min(7, daysActive + 1)
        };
      });
    }
    if (!CI.responses.newNudges) CI.responses.newNudges = [];

    const thisWeek = currentISOWeek();
    const activeNudges = (data.activeNudges || []).filter(n => n.status === 'active');
    const toGrade = activeNudges.filter(n => n.trialEndsISO > thisWeek);
    const toDecide = activeNudges.filter(n => n.trialEndsISO <= thisWeek);

    let html = '<div style="overflow-y:auto;max-height:55vh;padding-right:4px">';

    if (toGrade.length) {
      html += '<div style="font-size:9px;letter-spacing:2px;color:var(--text3);margin-bottom:8px;text-transform:uppercase">Grade Interventions</div>';
      toGrade.forEach(n => {
        const dname = (data.questDefinitions[n.domain] || {}).name || n.domain;
        const color = n.type === 'sludge' ? 'var(--red)' : 'var(--accent)';
        html += `
          <div style="border-left:3px solid ${color};padding:8px 10px;background:var(--bg2);margin-bottom:8px;border-radius:0 3px 3px 0">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">${n.type.toUpperCase()} · ${dname}</div>
            <div style="font-size:11px;color:var(--text2);margin-bottom:8px">if ${escHtml(n.if)} → ${escHtml(n.then)}</div>
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
              <span style="font-size:10px;color:var(--text3);min-width:56px">Stuck to it?</span>
              ${['yes','partial','no'].map(v => gradeChip(v, 'ciGradeStuck_'+n.id, v)).join('')}
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <span style="font-size:10px;color:var(--text3);min-width:56px">Did it work?</span>
              ${['yes','mixed','no'].map(v => gradeChip(v, 'ciGradeWorked_'+n.id, v)).join('')}
            </div>
          </div>`;
      });
    }

    if (toDecide.length) {
      html += '<div style="font-size:9px;letter-spacing:2px;color:var(--text3);margin:12px 0 8px;text-transform:uppercase">Trial Ended — Decide</div>';
      toDecide.forEach(n => {
        const dname = (data.questDefinitions[n.domain] || {}).name || n.domain;
        const grades = (n.grades || []).map(g => `W${g.isoWeek.split('-W')[1]}: ${g.stuck}/${g.worked}`).join(' · ') || 'no grades';
        html += `
          <div style="border:1px solid var(--border);padding:8px 10px;margin-bottom:8px;border-radius:3px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:2px">${dname} · ${grades}</div>
            <div style="font-size:11px;color:var(--text2);margin-bottom:8px">if ${escHtml(n.if)} → ${escHtml(n.then)}</div>
            <div id="ciDecisionBtns_${n.id}" style="display:flex;gap:6px">
              ${ghostBtn('Renew', `window._ci_submitTrialDecision('${n.id}','renew')`)}
              ${ghostBtn('Archive', `window._ci_submitTrialDecision('${n.id}','archive')`)}
              ${ghostBtn('Mutate', `window._ci_showMutate('${n.id}')`)}
            </div>
            <div id="ciMutateInputs_${n.id}" style="display:none;margin-top:8px">
              <input id="ciMutateIf_${n.id}" placeholder="if..." style="${inputCSS()}" value="${escHtml(n.if)}">
              <input id="ciMutateThen_${n.id}" placeholder="then..." style="${inputCSS()};margin-top:4px" value="${escHtml(n.then)}">
              <div style="margin-top:6px;text-align:right">${chipBtn('Confirm', `window._ci_submitTrialDecision('${n.id}','mutate')`)}</div>
            </div>
          </div>`;
      });
    }

    html += '<div style="font-size:9px;letter-spacing:2px;color:var(--text3);margin:12px 0 8px;text-transform:uppercase">Targets — floor / reach (days/week)</div>';
    Object.entries(data.questDefinitions || {}).forEach(([dk, domain]) => {
      const t = CI.responses.targets[dk];
      html += `
        <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">
          <span style="flex:1;font-size:11px;color:${domain.color}">${domain.name}</span>
          ${adjBtn('−', `window._ci_adjTarget('${dk}','floor',-1)`)}
          <span id="ciFloor_${dk}" style="min-width:14px;text-align:center;font-size:12px">${t.floor}</span>
          ${adjBtn('+', `window._ci_adjTarget('${dk}','floor',1)`)}
          <span style="font-size:10px;color:var(--text3);margin:0 3px">/</span>
          ${adjBtn('−', `window._ci_adjTarget('${dk}','reach',-1)`)}
          <span id="ciReach_${dk}" style="min-width:14px;text-align:center;font-size:12px">${t.reach}</span>
          ${adjBtn('+', `window._ci_adjTarget('${dk}','reach',1)`)}
        </div>`;
    });

    const domainOpts = Object.entries(data.questDefinitions || {})
      .map(([dk, d]) => `<option value="${dk}">${d.name}</option>`).join('');
    CI._domainOpts = domainOpts;

    html += `
      <div style="margin-top:12px">
        <div id="ciNudgeSlots"></div>
        <button onclick="window._ci_addNudgeSlot()"
          style="background:var(--bg3);color:var(--text2);border:1px solid var(--border);padding:6px 12px;font-family:inherit;font-size:10px;letter-spacing:1px;cursor:pointer;border-radius:3px;margin-top:4px">
          + Add intervention
        </button>
      </div>
      <div style="margin-top:14px;text-align:right">${chipBtn('Lock In', 'window._ci_lockIn()')}</div>
    </div>`;

    setInput(html);
  };

  // ── Wrap-up event handlers ────────────────────────────────────────────────

  window._ci_selectGrade = function (groupId, value, btn) {
    _gradeState[groupId] = value;
    const group = btn.parentElement;
    if (!group) return;
    group.querySelectorAll('button').forEach(b => {
      b.style.background = 'var(--bg3)';
      b.style.color = 'var(--text2)';
    });
    btn.style.background = 'var(--accent)';
    btn.style.color = '#000';
  };

  window._ci_adjTarget = function (dk, field, delta) {
    const t = CI.responses.targets[dk];
    if (!t) return;
    t[field] = Math.max(0, Math.min(7, t[field] + delta));
    if (field === 'floor' && t.floor > t.reach) t.reach = t.floor;
    if (field === 'reach' && t.reach < t.floor) t.floor = t.reach;
    const floorEl = document.getElementById('ciFloor_' + dk);
    const reachEl = document.getElementById('ciReach_' + dk);
    if (floorEl) floorEl.textContent = t.floor;
    if (reachEl) reachEl.textContent = t.reach;
  };

  window._ci_showMutate = function (nudgeId) {
    const el = document.getElementById('ciMutateInputs_' + nudgeId);
    if (el) el.style.display = 'block';
  };

  window._ci_submitTrialDecision = function (nudgeId, decision) {
    let mutatedIf = null, mutatedThen = null;
    if (decision === 'mutate') {
      mutatedIf = (document.getElementById('ciMutateIf_' + nudgeId)?.value || '').trim();
      mutatedThen = (document.getElementById('ciMutateThen_' + nudgeId)?.value || '').trim();
      if (!mutatedIf || !mutatedThen) { notify('Fill both fields.'); return; }
    }
    CI.responses.trialDecisions.push({ id: nudgeId, decision, mutatedIf, mutatedThen });
    const btnsEl = document.getElementById('ciDecisionBtns_' + nudgeId);
    const mutateEl = document.getElementById('ciMutateInputs_' + nudgeId);
    if (btnsEl) btnsEl.innerHTML = `<span style="font-size:10px;color:var(--text3)">${decision}${decision === 'mutate' ? `: if ${escHtml(mutatedIf)} → ${escHtml(mutatedThen)}` : ''}</span>`;
    if (mutateEl) mutateEl.style.display = 'none';
  };

  window._ci_addNudgeSlot = function () {
    if (!CI.responses.newNudges) CI.responses.newNudges = [];
    if (CI.responses.newNudges.length >= 3) { notify('Max 3 interventions.'); return; }
    const idx = CI.responses.newNudges.length;
    const firstDomain = Object.keys(data.questDefinitions || {})[0] || '';
    CI.responses.newNudges.push({ type: 'nudge', domain: firstDomain, if: '', then: '' });
    renderNudgeSlot(idx);
  };

  function renderNudgeSlot(idx) {
    const slotsEl = document.getElementById('ciNudgeSlots');
    if (!slotsEl || document.getElementById('ciSlot_' + idx)) return;
    const n = CI.responses.newNudges[idx];
    const el = document.createElement('div');
    el.id = 'ciSlot_' + idx;
    el.style.cssText = 'border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:8px';
    el.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
        <select onchange="window._ci_updateNudge(${idx},'type',this.value)"
          style="background:var(--bg3);color:var(--text);border:1px solid var(--border);font-family:inherit;font-size:11px;padding:4px 6px;border-radius:2px">
          <option value="nudge">nudge</option>
          <option value="sludge">sludge</option>
        </select>
        <select onchange="window._ci_updateNudge(${idx},'domain',this.value)"
          style="background:var(--bg3);color:var(--text);border:1px solid var(--border);font-family:inherit;font-size:11px;padding:4px 6px;border-radius:2px;flex:1">
          ${CI._domainOpts || ''}
        </select>
        <button onclick="window._ci_removeNudgeSlot(${idx})"
          style="background:var(--bg2);color:var(--text3);border:1px solid var(--border);padding:2px 8px;font-family:inherit;font-size:12px;cursor:pointer;border-radius:2px">✕</button>
      </div>
      <input id="ciSlotIf_${idx}" oninput="window._ci_updateNudge(${idx},'if',this.value)"
        placeholder="if..." style="${inputCSS()};display:block;margin-bottom:6px">
      <input id="ciSlotThen_${idx}" oninput="window._ci_updateNudge(${idx},'then',this.value)"
        placeholder="then..." style="${inputCSS()};display:block">`;
    slotsEl.appendChild(el);
  }

  window._ci_updateNudge = function (idx, field, value) {
    if (CI.responses.newNudges[idx]) CI.responses.newNudges[idx][field] = value;
  };

  window._ci_removeNudgeSlot = function (idx) {
    CI.responses.newNudges.splice(idx, 1);
    const el = document.getElementById('ciSlot_' + idx);
    if (el) el.remove();
  };

  // ── Lock in: deterministic adjustments + API call ─────────────────────────

  window._ci_lockIn = async function () {
    setInput('<div style="font-size:11px;color:var(--text3);letter-spacing:2px;padding:8px 0">Processing...</div>');

    const thisWeek = currentISOWeek();
    if (!data.activeNudges) data.activeNudges = [];

    // Collect nudge grades from _gradeState
    const nudgeGrades = [];
    (data.activeNudges || []).filter(n => n.status === 'active' && n.trialEndsISO > thisWeek).forEach(n => {
      const stuck = _gradeState['ciGradeStuck_' + n.id];
      const worked = _gradeState['ciGradeWorked_' + n.id];
      if (stuck && worked) nudgeGrades.push({ id: n.id, stuck, worked });
    });

    // 1. Apply nudge grades
    nudgeGrades.forEach(grade => {
      const nudge = data.activeNudges.find(n => n.id === grade.id);
      if (nudge) {
        if (!nudge.grades) nudge.grades = [];
        nudge.grades.push({ isoWeek: thisWeek, stuck: grade.stuck, worked: grade.worked });
      }
    });

    // 2. Apply trial decisions
    CI.responses.trialDecisions.forEach(dec => {
      const idx = data.activeNudges.findIndex(n => n.id === dec.id);
      if (idx === -1) return;
      const nudge = data.activeNudges[idx];
      if (dec.decision === 'renew') {
        nudge.trialEndsISO = addISOWeeks(thisWeek, 2);
        nudge.finalDecision = null;
      } else if (dec.decision === 'archive') {
        nudge.status = 'archived';
        nudge.finalDecision = 'archive';
      } else if (dec.decision === 'mutate') {
        nudge.status = 'archived';
        nudge.finalDecision = 'mutate';
        const newId = 'n_' + Date.now();
        nudge.mutatedTo = newId;
        data.activeNudges.push({
          id: newId, type: nudge.type, domain: nudge.domain,
          if: dec.mutatedIf, then: dec.mutatedThen,
          createdISO: thisWeek, trialEndsISO: addISOWeeks(thisWeek, 2),
          status: 'active', grades: [], finalDecision: null, mutatedTo: null
        });
      }
    });

    // 3. Create new nudges
    (CI.responses.newNudges || []).filter(n => n.if && n.then).forEach(n => {
      data.activeNudges.push({
        id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        type: n.type || 'nudge', domain: n.domain,
        if: n.if, then: n.then,
        createdISO: thisWeek, trialEndsISO: addISOWeeks(thisWeek, 2),
        status: 'active', grades: [], finalDecision: null, mutatedTo: null
      });
    });

    // 4. Auto-apply weight deltas (hysteresis: consistent 2-week error, magnitude ≥ 2)
    const weightDeltas = {};
    const lastCheckin = (data.checkinLog || []).slice(-1)[0];

    Object.keys(data.domainWeights || {}).forEach(dk => {
      const thisActual = CI.week.domainHits[dk]?.daysActive || 0;
      const thisTarget = (CI.responses.targets[dk] || {}).floor || 3;
      const thisError = thisTarget - thisActual;

      let prevError = thisError;
      if (lastCheckin?.targets?.[dk]) {
        const prevActual = lastCheckin.weekData?.domainHits?.[dk] || 0;
        const prevTarget = (lastCheckin.targets[dk] || {}).floor || 3;
        prevError = prevTarget - prevActual;
      }

      if (Math.sign(thisError) === Math.sign(prevError) && Math.abs(thisError) >= 2) {
        const delta = Math.max(-0.05, Math.min(0.05, thisError * 0.02));
        if (Math.abs(delta) >= 0.02) {
          data.domainWeights[dk] = Math.max(0.2, Math.min(2.0, (data.domainWeights[dk] || 1.0) + delta));
          weightDeltas[dk] = parseFloat(delta.toFixed(3));
        }
      }
    });

    // 5. Regenerate currentWeekQuests
    data.currentWeekQuests = data.activeNudges
      .filter(n => n.status === 'active')
      .map(n => {
        const dname = (data.questDefinitions[n.domain] || {}).name || n.domain;
        return `${dname.toUpperCase()}: if ${n.if} → ${n.then}`;
      });

    // 6. Write checkinLog entry
    const logEntry = {
      isoWeek: thisWeek,
      completedAt: new Date().toISOString(),
      weekData: {
        domainScores: CI.week.scores,
        domainHits: Object.fromEntries(
          Object.entries(CI.week.domainHits).map(([k, v]) => [k, v.daysActive])
        ),
        xpEarned: CI.week.weekXP
      },
      targets: CI.responses.targets || {},
      nudgeActions: [
        ...nudgeGrades.map(g => ({ id: g.id, action: 'grade' })),
        ...CI.responses.trialDecisions.map(d => ({ id: d.id, action: d.decision })),
        ...(CI.responses.newNudges || []).filter(n => n.if && n.then).map(() => ({ action: 'create' }))
      ],
      weightDeltas,
      senseiResponse: null
    };

    if (!data.checkinLog) data.checkinLog = [];
    data.checkinLog.push(logEntry);
    data._meta.lastUpdated = typeof getTodayStr === 'function' ? getTodayStr() : new Date().toLocaleDateString('en-CA');
    saveData();

    // 7. Single pattern-detection API call
    const apiKey = localStorage.getItem('css_anthropic_key');
    if (apiKey) {
      appendNote('∴ Analyzing patterns...');
      try {
        const last4 = (data.checkinLog || []).slice(-5, -1).map(e => ({
          isoWeek: e.isoWeek,
          topGaps: Object.entries(e.weekData?.domainHits || {}).filter(([, v]) => v === 0).map(([k]) => k),
          nudgeActions: e.nudgeActions
        }));

        const persistentGaps = Object.entries(CI.week.domainHits)
          .filter(([, d]) => d.daysActive === 0).map(([dk]) => dk);

        const senseiName = (typeof SENSEI !== 'undefined' && SENSEI[CI.senseiKey])
          ? SENSEI[CI.senseiKey].name : 'Cybernetica';

        const analysisPrompt = `You are ${senseiName}. Review this weekly data and propose one targeted if-then intervention.

Respond ONLY with a JSON code block:
\`\`\`json
{
  "patternFlag": "brief pattern description or null",
  "proposedNudge": {"type":"nudge","domain":"geburah","if":"condition","then":"action"} or null,
  "reasoning": "one sentence"
}
\`\`\`
Valid domain keys: ${Object.keys(data.questDefinitions || {}).join(', ')}.`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 400,
            temperature: 0.4,
            system: analysisPrompt,
            messages: [{
              role: 'user',
              content: JSON.stringify({
                last_4_weeks: last4,
                this_week: { isoWeek: thisWeek, domainHits: logEntry.weekData.domainHits },
                persistent_gaps: persistentGaps,
                conversation_summary: CI.messages.filter(m => m.role === 'user').map(m => m.content).join(' | ')
              })
            }]
          })
        });

        if (res.ok) {
          const json = await res.json();
          const text = json.content?.[0]?.text || '';
          const match = text.match(/```json\s*([\s\S]*?)```/);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              const idx = data.checkinLog.findIndex(e => e.isoWeek === thisWeek);
              if (idx !== -1) data.checkinLog[idx].senseiResponse = parsed;
              saveData();
              if (parsed.proposedNudge) { showProposal(parsed); return; }
            } catch (e) { /* malformed */ }
          }
        }
      } catch (e) { console.warn('Check-in API error:', e); }
    }

    finalize();
  };

  // ── Proposal handling ─────────────────────────────────────────────────────

  function showProposal(parsed) {
    const p = parsed.proposedNudge;
    const domainName = (data.questDefinitions[p.domain] || {}).name || p.domain;
    let msg = '';
    if (parsed.patternFlag) msg += `Pattern: ${parsed.patternFlag}<br><br>`;
    msg += `Proposed ${p.type} (${domainName}):<br><em>if ${escHtml(p.if)}</em><br><em>→ ${escHtml(p.then)}</em>`;
    if (parsed.reasoning) msg += `<br><span style="font-size:10px;color:var(--text3)">${parsed.reasoning}</span>`;
    appendSenseiMsg(msg);
    setInput(`
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${chipBtn('Accept', 'window._ci_acceptProposal()')}
        ${ghostBtn('Edit', 'window._ci_editProposal()')}
        ${ghostBtn('Reject', 'window._ci_rejectProposal()')}
      </div>
      <div id="ciProposalEdit" style="display:none;margin-top:10px">
        <input id="ciPropIf" placeholder="if..." style="${inputCSS()};display:block" value="${escHtml(p.if)}">
        <input id="ciPropThen" placeholder="then..." style="${inputCSS()};display:block;margin-top:6px" value="${escHtml(p.then)}">
        <div style="margin-top:8px;text-align:right">${chipBtn('Confirm', 'window._ci_acceptProposalEdited()')}</div>
      </div>
    `);
    CI._proposal = p;
  }

  window._ci_acceptProposal = function () {
    if (!CI._proposal) { finalize(); return; }
    const thisWeek = currentISOWeek();
    data.activeNudges.push({
      id: 'n_' + Date.now(), type: CI._proposal.type || 'nudge', domain: CI._proposal.domain,
      if: CI._proposal.if, then: CI._proposal.then,
      createdISO: thisWeek, trialEndsISO: addISOWeeks(thisWeek, 2),
      status: 'active', grades: [], finalDecision: null, mutatedTo: null
    });
    _patchSenseiResponse(thisWeek, { accepted: true });
    saveData();
    appendUserBubble('Accepted');
    finalize();
  };

  window._ci_editProposal = function () {
    const el = document.getElementById('ciProposalEdit');
    if (el) el.style.display = 'block';
  };

  window._ci_acceptProposalEdited = function () {
    const ifVal = (document.getElementById('ciPropIf')?.value || '').trim();
    const thenVal = (document.getElementById('ciPropThen')?.value || '').trim();
    if (!ifVal || !thenVal) { notify('Fill both fields.'); return; }
    CI._proposal = Object.assign({}, CI._proposal, { if: ifVal, then: thenVal });
    window._ci_acceptProposal();
  };

  window._ci_rejectProposal = function () {
    _patchSenseiResponse(currentISOWeek(), { accepted: false });
    saveData();
    appendUserBubble('Rejected');
    finalize();
  };

  function _patchSenseiResponse(isoWeek, patch) {
    const entry = (data.checkinLog || []).find(e => e.isoWeek === isoWeek);
    if (entry) entry.senseiResponse = Object.assign({}, entry.senseiResponse, patch);
  }

  function finalize() {
    appendNote('Check-in complete. Changes written.');
    setInput(chipBtn('Close', 'window.closeCheckin()'));
    notify('Check-in complete.');
    if (typeof renderHeader === 'function') renderHeader();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.startCheckin = function () {
    const overlay = getOrCreateOverlay();
    const thread = document.getElementById('checkinThread');
    if (thread) thread.innerHTML = '';

    const week = buildCheckinWeekData();
    const senseiKey = selectCheckinSensei(week);
    const senseiName = (typeof SENSEI !== 'undefined' && SENSEI[senseiKey])
      ? SENSEI[senseiKey].name : 'Cybernetica';

    const label = document.getElementById('checkinSenseiLabel');
    if (label) label.textContent = `∴ ${senseiName} // Week ${currentISOWeek().split('-W')[1]}`;

    CI = {
      senseiKey,
      week,
      systemPrompt: buildSystemPrompt(week, senseiKey),
      messages: [],
      inWrapUp: false,
      responses: { targets: null, trialDecisions: [], newNudges: [] },
      _proposal: null,
      _domainOpts: null
    };

    overlay.classList.add('open');
    appendNote(senseiName + ' presiding');
    renderChatInput();

    // Kick off the first sensei message
    const apiKey = localStorage.getItem('css_anthropic_key');
    if (apiKey) {
      const openingDiv = appendSenseiMsg('<span style="color:var(--text3);letter-spacing:2px">...</span>');
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          system: CI.systemPrompt,
          messages: [{ role: 'user', content: 'Begin the check-in.' }]
        })
      }).then(r => r.json()).then(json => {
        const text = json.content?.[0]?.text || '';
        openingDiv.className = 'communion-msg sensei';
        openingDiv.textContent = text;
        CI.messages.push({ role: 'user', content: 'Begin the check-in.' });
        CI.messages.push({ role: 'assistant', content: text });
      }).catch(() => {
        openingDiv.textContent = 'Signal lost on open.';
      });
    }
  };

  window.closeCheckin = function () {
    const overlay = document.getElementById('checkinOverlay');
    if (overlay) overlay.classList.remove('open');
    CI = null;
    _gradeState = {};
    const banner = document.getElementById('checkinBanner');
    if (banner) banner.remove();
  };

  window.renderCheckinCard = function (containerEl) {
    if (!containerEl) return;
    if (typeof isSunday === 'function' && !isSunday()) return;
    if (checkinDoneThisWeek()) return;
    if (!localStorage.getItem('css_anthropic_key')) return;
    if (document.getElementById('checkinBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'checkinBanner';
    banner.className = 'communion-banner';
    banner.innerHTML = `∴ Week ${currentISOWeek().split('-W')[1]} Check-In — Begin`;
    banner.onclick = window.startCheckin;
    containerEl.insertBefore(banner, containerEl.firstChild);
  };

  window.renderNudgeChecklist = function (domainKey) {
    const nudges = (data.activeNudges || []).filter(n => n.domain === domainKey && n.status === 'active');
    if (!nudges.length) return;

    const widgetEl = document.getElementById('domainWidget');
    if (!widgetEl) return;

    const domain = (data.questDefinitions || {})[domainKey] || {};
    const domainColor = domain.color || 'var(--accent)';
    const today = typeof getTodayStr === 'function' ? getTodayStr() : new Date().toLocaleDateString('en-CA');

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid var(--border)';
    wrapper.innerHTML = '<div style="font-size:9px;letter-spacing:2px;color:var(--text3);margin-bottom:8px;text-transform:uppercase">Active Interventions</div>';

    nudges.forEach(nudge => {
      const checkKey = nudge.id + '_' + today;
      const isChecked = !!todayLog[checkKey];
      const color = nudge.type === 'sludge' ? '#e05555' : domainColor;
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-left:3px solid ${color};margin-bottom:6px;background:var(--bg2);border-radius:0 3px 3px 0`;
      row.innerHTML = `
        <input type="checkbox" id="nudgeCheck_${nudge.id}" ${isChecked ? 'checked' : ''}
          onchange="window._ci_toggleNudgeCheck('${nudge.id}',this.checked)"
          style="margin-top:3px;cursor:pointer;accent-color:${color};flex-shrink:0">
        <div>
          <div style="font-size:9px;color:var(--text3);letter-spacing:1px;text-transform:uppercase">${nudge.type}</div>
          <div style="font-size:11px;color:var(--text2)">if ${escHtml(nudge.if)}</div>
          <div style="font-size:11px;color:var(--text)">→ ${escHtml(nudge.then)}</div>
        </div>`;
      wrapper.appendChild(row);
    });

    widgetEl.appendChild(wrapper);
  };

  window._ci_toggleNudgeCheck = function (nudgeId, checked) {
    const today = typeof getTodayStr === 'function' ? getTodayStr() : new Date().toLocaleDateString('en-CA');
    const checkKey = nudgeId + '_' + today;
    if (checked) todayLog[checkKey] = { time: new Date().toISOString() };
    else delete todayLog[checkKey];
    if (typeof saveData === 'function') saveData();
  };

})();

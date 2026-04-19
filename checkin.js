// checkin.js — Weekly Check-In / Nudge-Sludge Engine
// Replaces live-per-turn communion with scripted chat + single API call.
// Globals consumed: data, todayLog, saveData, getTodayStr, calcDomainScores,
//                   SENSEI, selectCommunionSensei, isSunday, notify

(function () {

  // ── ISO week helpers ────────────────────────────────────────────────────

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

  // ── State ───────────────────────────────────────────────────────────────

  let CI = null;
  let _gradeState = {};

  function checkinDoneThisWeek() {
    return (data.checkinLog || []).some(e => e.isoWeek === currentISOWeek());
  }

  // ── Week analysis ───────────────────────────────────────────────────────

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

  // ── Sensei selection ────────────────────────────────────────────────────

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

  // ── Copy bank (keyed by sensei) ─────────────────────────────────────────

  const CHECKIN_COPY = {
    leviathan: {
      opening: 'Week {W}. State the data first.',
      hitPrompt: 'What made that possible. One specific thing.',
      missPrompt: 'What happened instead of {domain}.',
      gradeIntro: 'Your active interventions. Grade them.',
      targetIntro: 'Targets. Adjust if last week was wrong.',
      newNudgeIntro: 'New interventions. If-then. No more than three.',
      lockInPrompt: 'Lock in.',
      closingLine: 'The system has updated.',
    },
    asclepius: {
      opening: 'Week {W}. Systems check.',
      hitPrompt: 'What physiological or environmental condition enabled that.',
      missPrompt: 'What upstream condition caused the {domain} gap.',
      gradeIntro: 'Active protocols. Efficacy assessment.',
      targetIntro: 'Adjust targets to reflect actual capacity.',
      newNudgeIntro: 'New protocols to test this cycle.',
      lockInPrompt: 'Confirm parameters.',
      closingLine: 'Parameters updated.',
    },
    hermes: {
      opening: 'Week {W}. What\'s the structure of what happened.',
      hitPrompt: 'What was the deciding variable.',
      missPrompt: 'What path was taken instead of {domain}.',
      gradeIntro: 'Review your conditionals. What held structurally.',
      targetIntro: 'Recalibrate.',
      newNudgeIntro: 'New conditionals to run.',
      lockInPrompt: 'Commit.',
      closingLine: 'Structure updated.',
    },
    hekate: {
      opening: 'Week {W}. The threshold between what was and what begins.',
      hitPrompt: 'What opened that door.',
      missPrompt: 'What threshold wasn\'t crossed in {domain}.',
      gradeIntro: 'Your rituals. What held, what didn\'t.',
      targetIntro: 'Set the markers for the week ahead.',
      newNudgeIntro: 'New thresholds to cross.',
      lockInPrompt: 'Commit to the crossing.',
      closingLine: 'The threshold shifts.',
    },
    gojo: {
      opening: 'Week {W}. Let\'s make this fast.',
      hitPrompt: 'Why did that work. Real reason.',
      missPrompt: 'Why didn\'t {domain} happen. Be honest.',
      gradeIntro: 'Active plays. Honest assessment.',
      targetIntro: 'Targets. Don\'t lowball yourself.',
      newNudgeIntro: 'New plays.',
      lockInPrompt: 'Lock it.',
      closingLine: 'Updated. Go.',
    },
    sapolsky: {
      opening: 'Week {W}. What conditions produced what behaviors.',
      hitPrompt: 'What upstream conditions made that the path of least resistance.',
      missPrompt: 'What conditions made {domain} high-friction this week.',
      gradeIntro: 'Your environmental modifications. Did conditions change.',
      targetIntro: 'Adjust targets to match environment, not intention.',
      newNudgeIntro: 'New environmental modifications to test.',
      lockInPrompt: 'Commit.',
      closingLine: 'Conditions updated.',
    }
  };

  function getCopy() {
    return CHECKIN_COPY[CI.senseiKey] || CHECKIN_COPY.hekate;
  }

  // ── Step builder ────────────────────────────────────────────────────────

  function buildSteps(week) {
    const steps = [];
    const thisWeek = currentISOWeek();

    steps.push({ type: 'readback', week });
    steps.push({ type: 'attribution', key: 'hit' });
    steps.push({ type: 'attribution', key: 'miss' });

    const active = (data.activeNudges || []).filter(n => n.status === 'active');

    // Nudges still in trial (grade only)
    active.filter(n => n.trialEndsISO > thisWeek)
      .forEach(n => steps.push({ type: 'grade_nudge', nudgeId: n.id }));

    // Nudges at end of trial (decision required)
    active.filter(n => n.trialEndsISO <= thisWeek)
      .forEach(n => steps.push({ type: 'trial_decision', nudgeId: n.id }));

    steps.push({ type: 'domain_targets', week });
    steps.push({ type: 'new_nudges' });
    steps.push({ type: 'lock_in' });

    return steps;
  }

  // ── Overlay management ──────────────────────────────────────────────────

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

  // ── Style helpers ───────────────────────────────────────────────────────

  function chipBtn(label, onclick, disabled) {
    return `<button onclick="${onclick}" ${disabled ? 'disabled' : ''} style="background:var(--accent);color:#000;border:none;padding:8px 16px;font-family:inherit;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;border-radius:3px${disabled ? ';opacity:0.4' : ''}">${label}</button>`;
  }

  function ghostBtn(label, onclick) {
    return `<button onclick="${onclick}" style="background:var(--bg3);color:var(--text2);border:1px solid var(--border);padding:6px 12px;font-family:inherit;font-size:10px;letter-spacing:1px;cursor:pointer;border-radius:3px">${label}</button>`;
  }

  function adjBtn(label, onclick) {
    return `<button onclick="${onclick}" style="background:var(--bg2);color:var(--text);border:1px solid var(--border);padding:2px 8px;font-family:inherit;font-size:12px;cursor:pointer;border-radius:2px">${label}</button>`;
  }

  function inputCSS() {
    return 'width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);font-family:inherit;font-size:12px;padding:8px 10px;border-radius:3px;outline:none;box-sizing:border-box';
  }

  // ── Step renderers ──────────────────────────────────────────────────────

  function renderStep(step) {
    switch (step.type) {
      case 'readback':       return renderReadback(step);
      case 'attribution':    return renderAttribution(step);
      case 'grade_nudge':    return renderGradeNudge(step);
      case 'trial_decision': return renderTrialDecision(step);
      case 'domain_targets': return renderDomainTargets(step);
      case 'new_nudges':     return renderNewNudges();
      case 'lock_in':        return renderLockIn();
    }
  }

  function renderReadback(step) {
    const copy = getCopy();
    const w = step.week;
    const isoW = currentISOWeek();

    const domainLines = Object.entries(w.domainHits).map(([dk, d]) => {
      const daysActive = w.scores[dk]?.daysActive ?? d.daysActive;
      return `<span style="color:${d.color}">${d.name}</span>: ${daysActive}/7`;
    }).join(' &nbsp;·&nbsp; ');

    const dark = w.darkDomains.map(dk => (data.questDefinitions[dk] || {}).name || dk).join(', ');

    appendSenseiMsg(
      copy.opening.replace('{W}', isoW) +
      `<br><br><div style="font-size:10px;color:var(--text2);line-height:2">${domainLines}</div>` +
      `<div style="margin-top:6px;font-size:10px;color:var(--text2)">Week XP: +${w.weekXP}` +
      (dark ? ` &nbsp;·&nbsp; Dark: ${dark}` : '') + '</div>'
    );

    setInput(chipBtn('Continue', 'window._ci_advance(null)'));
  }

  function renderAttribution(step) {
    const copy = getCopy();
    const isHit = step.key === 'hit';

    let prompt;
    if (isHit) {
      prompt = copy.hitPrompt;
    } else {
      const week = CI.steps[0].week;
      const darkDks = week.darkDomains;
      let domainName = 'the gap domain';
      if (darkDks.length) {
        domainName = (data.questDefinitions[darkDks[0]] || {}).name || darkDks[0];
      } else {
        let minDk = null, minScore = Infinity;
        Object.entries(week.domainHits).forEach(([dk, d]) => {
          if (d.daysActive < minScore) { minScore = d.daysActive; minDk = dk; }
        });
        if (minDk) domainName = (data.questDefinitions[minDk] || {}).name || minDk;
      }
      prompt = copy.missPrompt.replace('{domain}', domainName);
    }

    appendSenseiMsg(prompt);
    setInput(`
      <textarea id="ciAttrInput" rows="2" style="${inputCSS()};display:block" placeholder=""></textarea>
      <div style="margin-top:8px;text-align:right">${chipBtn('Submit', 'window._ci_submitAttribution()')}</div>
    `);
    setTimeout(() => { const el = document.getElementById('ciAttrInput'); if (el) el.focus(); }, 50);
  }

  function renderGradeNudge(step) {
    const copy = getCopy();
    const nudge = (data.activeNudges || []).find(n => n.id === step.nudgeId);
    if (!nudge) { advanceStep(null); return; }

    const typeLabel = nudge.type === 'sludge' ? 'SLUDGE' : 'NUDGE';
    const domainName = (data.questDefinitions[nudge.domain] || {}).name || nudge.domain;

    _gradeState = {};
    appendSenseiMsg(`<span style="font-size:10px;color:var(--text3)">${typeLabel} · ${domainName}</span><br>if ${escHtml(nudge.if)}<br>→ ${escHtml(nudge.then)}`);
    setInput(`
      <div style="margin-bottom:6px;font-size:11px;color:var(--text2)">Stuck to it?</div>
      <div id="ciGradeStuck" style="display:flex;gap:6px;margin-bottom:10px">
        ${gradeChip('yes', 'ciGradeStuck', 'yes')}
        ${gradeChip('partial', 'ciGradeStuck', 'partial')}
        ${gradeChip('no', 'ciGradeStuck', 'no')}
      </div>
      <div style="margin-bottom:6px;font-size:11px;color:var(--text2)">Did it work?</div>
      <div id="ciGradeWorked" style="display:flex;gap:6px;margin-bottom:10px">
        ${gradeChip('yes', 'ciGradeWorked', 'yes')}
        ${gradeChip('partial', 'ciGradeWorked', 'mixed')}
        ${gradeChip('no', 'ciGradeWorked', 'no')}
      </div>
      <div style="text-align:right">${chipBtn('Next', 'window._ci_submitGrade()')}</div>
    `);
  }

  function renderTrialDecision(step) {
    const nudge = (data.activeNudges || []).find(n => n.id === step.nudgeId);
    if (!nudge) { advanceStep(null); return; }

    const domainName = (data.questDefinitions[nudge.domain] || {}).name || nudge.domain;
    const gradesText = (nudge.grades || [])
      .map(g => `W${g.isoWeek.split('-W')[1]}: stuck=${g.stuck}, worked=${g.worked}`)
      .join(' · ') || 'no grades';

    appendSenseiMsg(
      `Trial ended: <em>${escHtml(nudge.if)} → ${escHtml(nudge.then)}</em> (${domainName})` +
      `<br><span style="font-size:10px;color:var(--text3)">${gradesText}</span>`
    );
    setInput(`
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${ghostBtn('renew', `window._ci_submitTrialDecision('${step.nudgeId}','renew')`)}
        ${ghostBtn('archive', `window._ci_submitTrialDecision('${step.nudgeId}','archive')`)}
        ${ghostBtn('mutate', `window._ci_showMutate('${step.nudgeId}')`)}
      </div>
      <div id="ciMutateInputs" style="display:none;margin-top:10px">
        <input id="ciMutateIf" placeholder="if..." style="${inputCSS()}" value="${escHtml(nudge.if)}">
        <input id="ciMutateThen" placeholder="then..." style="${inputCSS()};margin-top:6px" value="${escHtml(nudge.then)}">
        <div style="margin-top:8px;text-align:right">
          ${chipBtn('Confirm', `window._ci_submitTrialDecision('${step.nudgeId}','mutate')`)}
        </div>
      </div>
    `);
  }

  function renderDomainTargets(step) {
    const copy = getCopy();
    appendSenseiMsg(copy.targetIntro);

    const domains = Object.entries(data.questDefinitions || {});
    let html = '<div style="font-size:10px;color:var(--text3);margin-bottom:8px">floor = minimum, reach = stretch</div>';

    domains.forEach(([dk, domain]) => {
      const t = CI.responses.targets[dk];
      html += `
        <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">
          <span style="flex:1;font-size:11px;color:${domain.color}">${domain.name}</span>
          <span style="font-size:10px;color:var(--text3)">floor</span>
          ${adjBtn('−', `window._ci_adjTarget('${dk}','floor',-1)`)}
          <span id="ciFloor_${dk}" style="min-width:14px;text-align:center;font-size:12px">${t.floor}</span>
          ${adjBtn('+', `window._ci_adjTarget('${dk}','floor',1)`)}
          <span style="font-size:10px;color:var(--text3);margin-left:4px">reach</span>
          ${adjBtn('−', `window._ci_adjTarget('${dk}','reach',-1)`)}
          <span id="ciReach_${dk}" style="min-width:14px;text-align:center;font-size:12px">${t.reach}</span>
          ${adjBtn('+', `window._ci_adjTarget('${dk}','reach',1)`)}
        </div>`;
    });

    html += `<div style="margin-top:10px;text-align:right">${chipBtn('Confirm', 'window._ci_advance(null)')}</div>`;
    setInput(html);
  }

  function renderNewNudges() {
    const copy = getCopy();
    appendSenseiMsg(copy.newNudgeIntro);

    const domainOpts = Object.entries(data.questDefinitions || {})
      .map(([dk, d]) => `<option value="${dk}">${d.name}</option>`).join('');

    setInput(`
      <div id="ciNudgeSlots"></div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
        ${ghostBtn('+ Add intervention', 'window._ci_addNudgeSlot()')}
        ${chipBtn('Done', 'window._ci_advance(null)')}
      </div>
    `);

    CI._domainOpts = domainOpts;
  }

  function renderLockIn() {
    const copy = getCopy();
    appendSenseiMsg(copy.lockInPrompt);
    setInput(chipBtn('Lock In', 'window._ci_lockIn()'));
  }

  // ── Component helpers ───────────────────────────────────────────────────

  function gradeChip(label, groupId, value) {
    return `<button onclick="window._ci_selectGrade('${groupId}','${value}',this)"
      style="background:var(--bg3);color:var(--text2);border:1px solid var(--border);padding:6px 12px;font-family:inherit;font-size:10px;cursor:pointer;border-radius:3px">${label}</button>`;
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Advance step ────────────────────────────────────────────────────────

  function advanceStep(response) {
    if (response !== null) {
      const step = CI.steps[CI.step];
      if (step.type === 'attribution') {
        if (step.key === 'hit') CI.responses.hit = response;
        else CI.responses.miss = response;
        appendUserBubble(response);
      }
    }
    CI.step++;
    if (CI.step < CI.steps.length) renderStep(CI.steps[CI.step]);
  }

  // ── Event handlers ──────────────────────────────────────────────────────

  window._ci_advance = advanceStep;

  window._ci_submitAttribution = function () {
    const el = document.getElementById('ciAttrInput');
    const val = (el ? el.value : '').trim();
    if (!val) return;
    advanceStep(val);
  };

  window._ci_selectGrade = function (groupId, value, btn) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('button').forEach(b => {
      b.style.background = 'var(--bg3)';
      b.style.color = 'var(--text2)';
    });
    btn.style.background = 'var(--accent)';
    btn.style.color = '#000';
    _gradeState[groupId] = value;
  };

  window._ci_submitGrade = function () {
    const stuck = _gradeState['ciGradeStuck'];
    const worked = _gradeState['ciGradeWorked'];
    if (!stuck || !worked) { notify('Select both grades.'); return; }

    const step = CI.steps[CI.step];
    CI.responses.nudgeGrades.push({ id: step.nudgeId, stuck, worked });

    const stuckLabel = stuck === 'yes' ? 'stuck to it' : stuck === 'partial' ? 'partial' : 'didn\'t stick';
    const workedLabel = worked === 'yes' ? 'worked' : worked === 'mixed' ? 'mixed' : 'didn\'t work';
    appendUserBubble(`${stuckLabel} · ${workedLabel}`);
    _gradeState = {};

    CI.step++;
    if (CI.step < CI.steps.length) renderStep(CI.steps[CI.step]);
  };

  window._ci_showMutate = function (nudgeId) {
    const el = document.getElementById('ciMutateInputs');
    if (el) el.style.display = 'block';
  };

  window._ci_submitTrialDecision = function (nudgeId, decision) {
    let mutatedIf = null, mutatedThen = null;
    if (decision === 'mutate') {
      mutatedIf = (document.getElementById('ciMutateIf')?.value || '').trim();
      mutatedThen = (document.getElementById('ciMutateThen')?.value || '').trim();
      if (!mutatedIf || !mutatedThen) { notify('Fill both fields.'); return; }
    }
    CI.responses.trialDecisions.push({ id: nudgeId, decision, mutatedIf, mutatedThen });
    appendUserBubble(decision + (decision === 'mutate' ? `: if ${mutatedIf} → ${mutatedThen}` : ''));
    CI.step++;
    if (CI.step < CI.steps.length) renderStep(CI.steps[CI.step]);
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
        placeholder="if..." style="${inputCSS()};display:block;margin-bottom:6px" value="">
      <input id="ciSlotThen_${idx}" oninput="window._ci_updateNudge(${idx},'then',this.value)"
        placeholder="then..." style="${inputCSS()};display:block" value="">
    `;
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

  // ── Lock in: deterministic adjustments + API call ───────────────────────

  window._ci_lockIn = async function () {
    setInput('<div style="font-size:11px;color:var(--text3);letter-spacing:2px">Processing...</div>');

    const thisWeek = currentISOWeek();
    if (!data.activeNudges) data.activeNudges = [];

    // 1. Apply nudge grades
    CI.responses.nudgeGrades.forEach(grade => {
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
          id: newId,
          type: nudge.type,
          domain: nudge.domain,
          if: dec.mutatedIf,
          then: dec.mutatedThen,
          createdISO: thisWeek,
          trialEndsISO: addISOWeeks(thisWeek, 2),
          status: 'active',
          grades: [],
          finalDecision: null,
          mutatedTo: null
        });
      }
    });

    // 3. Create new nudges
    CI.responses.newNudges.filter(n => n.if && n.then).forEach(n => {
      data.activeNudges.push({
        id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        type: n.type || 'nudge',
        domain: n.domain,
        if: n.if,
        then: n.then,
        createdISO: thisWeek,
        trialEndsISO: addISOWeeks(thisWeek, 2),
        status: 'active',
        grades: [],
        finalDecision: null,
        mutatedTo: null
      });
    });

    // 4. Auto-apply weight deltas (hysteresis: require consistent 2-week error)
    const weightDeltas = {};
    const checkins = data.checkinLog || [];
    const lastCheckin = checkins[checkins.length - 1];

    Object.keys(data.domainWeights || {}).forEach(dk => {
      const thisActual = CI.steps[0].week.domainHits[dk]?.daysActive || 0;
      const thisTarget = (CI.responses.targets[dk] || {}).floor || 3;
      const thisError = thisTarget - thisActual;

      let prevError = thisError;
      if (lastCheckin?.targets?.[dk] && lastCheckin?.weekData?.domainHits?.[dk] !== undefined) {
        const prevActual = lastCheckin.weekData.domainHits[dk] || 0;
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

    // 5. Regenerate currentWeekQuests from active nudges
    data.currentWeekQuests = data.activeNudges
      .filter(n => n.status === 'active')
      .map(n => {
        const dname = (data.questDefinitions[n.domain] || {}).name || n.domain;
        return `${dname.toUpperCase()}: if ${n.if} → ${n.then}`;
      });

    // 6. Build and write checkinLog entry
    const logEntry = {
      isoWeek: thisWeek,
      completedAt: new Date().toISOString(),
      weekData: {
        domainScores: CI.steps[0].week.scores,
        domainHits: Object.fromEntries(
          Object.entries(CI.steps[0].week.domainHits).map(([k, v]) => [k, v.daysActive])
        ),
        xpEarned: CI.steps[0].week.weekXP
      },
      attributions: { biggestHit: CI.responses.hit || '', biggestMiss: CI.responses.miss || '' },
      targets: CI.responses.targets || {},
      nudgeActions: [
        ...CI.responses.nudgeGrades.map(g => ({ id: g.id, action: 'grade' })),
        ...CI.responses.trialDecisions.map(d => ({ id: d.id, action: d.decision })),
        ...CI.responses.newNudges.filter(n => n.if && n.then).map(() => ({ action: 'create' }))
      ],
      weightDeltas,
      senseiResponse: null
    };

    if (!data.checkinLog) data.checkinLog = [];
    data.checkinLog.push(logEntry);
    data._meta.lastUpdated = typeof getTodayStr === 'function' ? getTodayStr() : new Date().toLocaleDateString('en-CA');
    saveData();

    // 7. Single API call
    const apiKey = localStorage.getItem('css_anthropic_key');
    if (apiKey) {
      appendNote('∴ Analyzing patterns...');
      try {
        const last4 = (data.checkinLog || []).slice(-5, -1).map(e => ({
          isoWeek: e.isoWeek,
          attributions: e.attributions,
          topGaps: Object.entries(e.weekData?.domainHits || {})
            .filter(([, v]) => v === 0).map(([k]) => k),
          nudgeActions: e.nudgeActions
        }));

        const persistentGaps = Object.entries(CI.steps[0].week.domainHits)
          .filter(([, d]) => d.daysActive === 0).map(([dk]) => dk);

        const senseiName = (typeof SENSEI !== 'undefined' && SENSEI[CI.senseiKey])
          ? SENSEI[CI.senseiKey].name : 'Cybernetica';

        const systemPrompt = `You are ${senseiName}, reviewing the weekly check-in data for the Cybernetic Self System.

Look for a single meaningful behavioral pattern across the data. Propose one targeted intervention (nudge or sludge) as a JSON object.

Respond ONLY with a JSON code block:
\`\`\`json
{
  "patternFlag": "brief description of pattern, or null if none worth flagging",
  "proposedNudge": {
    "type": "nudge",
    "domain": "geburah",
    "if": "condition",
    "then": "action"
  },
  "reasoning": "one sentence"
}
\`\`\`
Set proposedNudge to null if no intervention is warranted. Domain must be a valid key from: ${Object.keys(data.questDefinitions || {}).join(', ')}.`;

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
            system: systemPrompt,
            messages: [{
              role: 'user',
              content: JSON.stringify({
                last_4_weeks: last4,
                this_week: {
                  isoWeek: thisWeek,
                  domainHits: logEntry.weekData.domainHits,
                  attributions: logEntry.attributions,
                  nudgeGrades: CI.responses.nudgeGrades,
                  newNudges: CI.responses.newNudges.filter(n => n.if && n.then)
                },
                domains_with_persistent_gaps: persistentGaps
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

              if (parsed.proposedNudge) {
                CI._proposal = parsed.proposedNudge;
                showProposal(parsed);
                return;
              }
            } catch (e) { /* malformed JSON — skip */ }
          }
        }
      } catch (e) {
        console.warn('Check-in API error:', e);
      }
    }

    finalize();
  };

  function showProposal(parsed) {
    const copy = getCopy();
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
        <div style="margin-top:8px;text-align:right">
          ${chipBtn('Confirm Edit', 'window._ci_acceptProposalEdited()')}
        </div>
      </div>
    `);
  }

  window._ci_acceptProposal = function () {
    if (!CI._proposal) { finalize(); return; }
    const thisWeek = currentISOWeek();
    data.activeNudges.push({
      id: 'n_' + Date.now(),
      type: CI._proposal.type || 'nudge',
      domain: CI._proposal.domain,
      if: CI._proposal.if,
      then: CI._proposal.then,
      createdISO: thisWeek,
      trialEndsISO: addISOWeeks(thisWeek, 2),
      status: 'active',
      grades: [],
      finalDecision: null,
      mutatedTo: null
    });
    _updateSenseiResponse(thisWeek, { accepted: true });
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
    _updateSenseiResponse(currentISOWeek(), { accepted: false });
    saveData();
    appendUserBubble('Rejected');
    finalize();
  };

  function _updateSenseiResponse(isoWeek, patch) {
    const entry = (data.checkinLog || []).find(e => e.isoWeek === isoWeek);
    if (entry) entry.senseiResponse = Object.assign({}, entry.senseiResponse, patch);
  }

  function finalize() {
    appendSenseiMsg(getCopy().closingLine);
    setInput(chipBtn('Close', 'window.closeCheckin()'));
    notify('Check-in complete.');
    if (typeof renderHeader === 'function') renderHeader();
  }

  // ── Public API ──────────────────────────────────────────────────────────

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

    // Initialize targets from last week's actuals
    const defaultTargets = {};
    Object.keys(data.questDefinitions || {}).forEach(dk => {
      const daysActive = week.domainHits[dk]?.daysActive || 0;
      defaultTargets[dk] = {
        floor: Math.max(1, daysActive),
        reach: Math.min(7, daysActive + 1)
      };
    });

    CI = {
      senseiKey,
      step: 0,
      steps: [],
      responses: {
        hit: '',
        miss: '',
        nudgeGrades: [],
        trialDecisions: [],
        targets: defaultTargets,
        newNudges: []
      },
      _proposal: null,
      _domainOpts: null
    };
    CI.steps = buildSteps(week);

    overlay.classList.add('open');
    appendNote(senseiName + ' presiding');
    renderStep(CI.steps[0]);
  };

  window.closeCheckin = function () {
    const overlay = document.getElementById('checkinOverlay');
    if (overlay) overlay.classList.remove('open');
    CI = null;
    _gradeState = {};
    // Remove banner so it doesn't re-appear until next check
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

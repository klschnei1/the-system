// THE FORECAST — Pillar 2: cognitive challenge (cold_harbor/stakes.md).
// A daily self-prediction game: two seeded one-tap calls about YOUR day,
// scored against real dailyLogs at the 3:30 rollover. The Internal Model
// Principle made playable — you must log to find out if you were right.
//
// Exposes:
//   window.renderForecastCard(container)      — called by renderQuestsOverview
//   window.forecastRollover(yStr, yLogged)    — called by runDayRollover
//   window.Forecast                           — pure core, for tests + sleeves
//
// Every constant here is meant to move. Judge by the standing loop.
(function () {
  'use strict';

  const TUNE = {
    windowEndHour: 14,   // calls accepted until 2 PM (day starts 3:30 AM)
    leanXp: 4,           // correct lean
    lockXp: 10,          // correct lock
    boldMult: 2,         // correct call AGAINST your own base rate (<40%)
    participateXp: 2,    // sealing the forecast at all
    baseRateDays: 14,    // trailing window for thresholds + base rates
    calWindow: 30,       // scored calls counted in the calibration readout
    calMinimum: 6,       // hide the readout until this many calls are scored
  };

  // One tap = a side AND a confidence. p is always P(yes/over).
  const CONF = [
    { p: 0.10, label: 'NO — LOCK',  alt: 'UNDER — LOCK'  },
    { p: 0.35, label: 'LEAN NO',    alt: 'LEAN UNDER'    },
    { p: 0.65, label: 'LEAN YES',   alt: 'LEAN OVER'     },
    { p: 0.90, label: 'YES — LOCK', alt: 'OVER — LOCK'   },
  ];

  // ── pure helpers ─────────────────────────────────────────────────────
  function seedFor(dayKey) {           // same hash as getDailySeed(), any day
    const d = dayKey.replace(/-/g, '');
    let h = 0;
    for (let i = 0; i < d.length; i++) { h = ((h << 5) - h) + d.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  function trailingDays(dayKey, n) {   // the n calendar days BEFORE dayKey
    const out = [];
    const d = new Date(dayKey + 'T12:00:00');
    for (let i = 0; i < n; i++) {
      d.setDate(d.getDate() - 1);
      out.push(d.toLocaleDateString('en-CA'));
    }
    return out;
  }

  function qidLogged(data, day, qid) {
    return !!(data.dailyLogs && data.dailyLogs[day] && data.dailyLogs[day][qid]);
  }

  function accumTotal(data, day, qid, key) {
    const e = data.dailyLogs && data.dailyLogs[day] && data.dailyLogs[day][qid];
    return (e && e.totals && e.totals[key]) || 0;
  }

  function domainsLogged(data, day) {  // distinct domains with ≥1 quest logged
    const log = (data.dailyLogs && data.dailyLogs[day]) || {};
    let count = 0;
    Object.values(data.questDefinitions || {}).forEach(dom => {
      if (Object.keys(dom.quests || {}).some(qid => log[qid])) count++;
    });
    return count;
  }

  // Median of the NONZERO trailing values rounded to step; fallback until
  // there are 3 real days of history so early thresholds aren't degenerate.
  function thresh(values, fallback, step) {
    const v = values.filter(x => x > 0).sort((a, b) => a - b);
    if (v.length < 3) return fallback;
    const mid = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
    return Math.max(step, Math.round(mid / step) * step);
  }

  // ── question pool ────────────────────────────────────────────────────
  // Only OPEN domains may appear (locked domains are dead — NARSIL rule).
  // Each question carries its threshold + base rate AT PREDICTION TIME so
  // scoring is reproducible no matter when it runs.
  function buildPool(data, dayKey, openDomains) {
    const days = trailingDays(dayKey, TUNE.baseRateDays);
    const rate = fn => {
      const hits = days.filter(fn).length;
      return days.length ? hits / days.length : 0.5;
    };
    const open = dk => openDomains.indexOf(dk) !== -1;
    const pool = [];

    if (open('geburah')) pool.push({
      id: 'train', kind: 'bool', metric: 'g1',
      text: 'Will you log a workout today?',
      baseRate: rate(d => qidLogged(data, d, 'g1')),
    });
    if (open('malkuth')) {
      const pt = thresh(days.map(d => accumTotal(data, d, 'g2', 'protein')), 120, 10);
      pool.push({
        id: 'protein', kind: 'over', metric: 'g2.protein', threshold: pt,
        text: 'Protein: over or under ' + pt + 'g?',
        baseRate: rate(d => accumTotal(data, d, 'g2', 'protein') > pt),
      });
      const ft = thresh(days.map(d => accumTotal(data, d, 'm1', 'oz')), 60, 10);
      pool.push({
        id: 'fluid', kind: 'over', metric: 'm1.oz', threshold: ft,
        text: 'Fluid: over or under ' + ft + ' oz?',
        baseRate: rate(d => accumTotal(data, d, 'm1', 'oz') > ft),
      });
      const ct = thresh(days.map(d => accumTotal(data, d, 'g2', 'calories')), 2000, 100);
      pool.push({
        id: 'calories', kind: 'over', metric: 'g2.calories', threshold: ct,
        text: 'Calories: over or under ' + ct + '?',
        baseRate: rate(d => accumTotal(data, d, 'g2', 'calories') > ct),
      });
    }
    if (open('chesed')) pool.push({
      id: 'ledger', kind: 'bool', metric: 'f1',
      text: 'Will you log a transaction today?',
      baseRate: rate(d => qidLogged(data, d, 'f1')),
    });
    pool.push({
      id: 'spread', kind: 'bool', metric: 'domains3',
      text: 'Will you log in 3 or more domains today?',
      baseRate: rate(d => domainsLogged(data, d) >= 3),
    });
    return pool;
  }

  // Two distinct questions per day, seeded — same day always deals the
  // same hand, so a mid-tap re-render can't shuffle the board.
  function pickQuestions(pool, seed) {
    if (pool.length < 2) return pool.slice();
    const i = seed % pool.length;
    let j = Math.floor(seed / 13) % pool.length;
    if (j === i) j = (j + 1) % pool.length;
    return [pool[i], pool[j]];
  }

  function outcome(data, dayKey, q) {  // 1 if yes/over actually happened
    if (q.metric === 'domains3') return domainsLogged(data, dayKey) >= 3 ? 1 : 0;
    if (q.kind === 'bool') return qidLogged(data, dayKey, q.metric) ? 1 : 0;
    const parts = q.metric.split('.');   // 'g2.protein' → quest, totals key
    return accumTotal(data, dayKey, parts[0], parts[1]) > q.threshold ? 1 : 0;
  }

  // ── scoring ──────────────────────────────────────────────────────────
  // XP scales with boldness × correctness: locks pay more than leans, and a
  // correct call against your own base rate doubles. Wrong calls pay zero —
  // the Brier trail is the skill stat, XP is the reward.
  function scoreDay(data, dayKey) {
    const day = data.forecast && data.forecast.days && data.forecast.days[dayKey];
    if (!day || day.scored) return null;
    let xp = TUNE.participateXp, correct = 0;
    day.qs.forEach(q => {
      const o = outcome(data, dayKey, q);
      const predYes = q.p > 0.5;
      const hit = predYes ? o === 1 : o === 0;
      let pay = 0;
      if (hit) {
        pay = Math.max(q.p, 1 - q.p) > 0.8 ? TUNE.lockXp : TUNE.leanXp;
        const sideRate = predYes ? q.baseRate : 1 - q.baseRate;
        if (sideRate < 0.4) pay *= TUNE.boldMult;
      }
      q.o = o; q.hit = hit; q.payout = pay;
      q.brier = (q.p - o) * (q.p - o);
      xp += pay;
      if (hit) correct++;
    });
    day.scored = true;
    day.revealed = false;
    day.xpEarned = xp;
    data.xp = (data.xp || 0) + xp;
    return { xp: xp, correct: correct, n: day.qs.length };
  }

  // Calibration readout over the last calWindow scored calls:
  // how often locks land vs leans, plus the mean Brier as a 0-100 skill stat.
  function calibration(data) {
    const days = (data.forecast && data.forecast.days) || {};
    const calls = [];
    Object.keys(days).sort().forEach(dk => {
      if (days[dk].scored) days[dk].qs.forEach(q => calls.push(q));
    });
    const recent = calls.slice(-TUNE.calWindow);
    if (recent.length < TUNE.calMinimum) return null;
    const bucket = isLock => {
      const b = recent.filter(q => (Math.max(q.p, 1 - q.p) > 0.8) === isLock);
      return b.length ? Math.round(100 * b.filter(q => q.hit).length / b.length) : null;
    };
    const brier = recent.reduce((s, q) => s + q.brier, 0) / recent.length;
    return {
      n: recent.length,
      locks: bucket(true),
      leans: bucket(false),
      skill: Math.round(100 * (1 - brier)),
    };
  }

  // ── runtime glue (globals from system.html exist by call time) ───────
  function ensureState() {
    if (!data.forecast) data.forecast = { days: {}, streak: 0, best: 0 };
    if (!data.forecast.days) data.forecast.days = {};
  }

  function openDomains() {
    return Object.keys(data.questDefinitions || {}).filter(dk => domainGate(dk) === 'open');
  }

  function todaysQuestions(dayKey) {
    return pickQuestions(buildPool(data, dayKey, openDomains()), seedFor(dayKey));
  }

  function windowOpen() {
    const h = new Date().getHours();
    // The forecast day runs 3:30 AM → windowEndHour. Before 3:30 we're still
    // in yesterday's day (getTodayStr), and yesterday's window is long shut.
    const m = new Date().getMinutes();
    if (h < 3 || (h === 3 && m < 30)) return false;
    return h < TUNE.windowEndHour;
  }

  // Called by runDayRollover BEFORE lastDate flips: scores every pending past
  // day, then settles the streak. No log yesterday = unscorable = the streak
  // breaks — logging is load-bearing, that's the whole point.
  window.forecastRollover = function (yStr, yLoggedCount) {
    ensureState();
    const f = data.forecast;
    const today = getTodayStr();
    Object.keys(f.days).sort().forEach(dk => {
      if (dk < today && !f.days[dk].scored) scoreDay(data, dk);
    });
    if (f.days[yStr] && yLoggedCount > 0) {
      f.streak = (f.streak || 0) + 1;
      f.best = Math.max(f.best || 0, f.streak);
    } else {
      f.streak = 0;
    }
    // Only the freshest scored day gets a reveal moment; older ones settle
    // silently so a gap doesn't queue a backlog of ceremonies.
    const scored = Object.keys(f.days).filter(dk => f.days[dk].scored && !f.days[dk].revealed).sort();
    scored.slice(0, -1).forEach(dk => { f.days[dk].revealed = true; });
    if (typeof checkSeals === 'function') checkSeals();  // payout may break a seal
  };

  // ── card UI ──────────────────────────────────────────────────────────
  let pending = {};        // in-memory taps before the seal — never persisted
  let pendingDay = null;   // taps die with the day they were made for

  window.forecastSelect = function (idx, p) {
    const today = getTodayStr();
    if (pendingDay !== today) { pending = {}; pendingDay = today; }
    pending[idx] = p;
    renderQuests();
  };

  window.sealForecast = function () {
    ensureToday(false);
    ensureState();
    const today = getTodayStr();
    if (data.forecast.days[today]) return;
    if (!windowOpen()) { notify('The forecast window is closed for today.'); return; }
    const qs = todaysQuestions(today);
    if (pendingDay !== today || qs.some((q, i) => pending[i] === undefined)) {
      notify('Make every call first.');
      return;
    }
    qs.forEach((q, i) => { q.p = pending[i]; });
    data.forecast.days[today] = { qs: qs, sealed: new Date().toISOString() };
    pending = {}; pendingDay = null;
    saveData();
    renderQuests();
    if (window.juice) juice.thud();
    notify('Forecast sealed. Log your day to find out if you were right.');
  };

  window.forecastAcknowledge = function (dayKey) {
    const day = data.forecast && data.forecast.days && data.forecast.days[dayKey];
    if (day) { day.revealed = true; saveData(); }
    renderQuests();
  };

  function confLabel(q, p) {
    const c = CONF.find(c => c.p === p);
    return c ? (q.kind === 'over' ? c.alt : c.label) : '?';
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  const S = {
    card: 'border:1px solid var(--border);background:var(--bg2);border-radius:8px;padding:12px 14px;margin-bottom:14px;border-left:3px solid var(--gold)',
    title: 'font-size:10px;letter-spacing:3px;color:var(--gold);margin-bottom:2px',
    sub: 'font-size:9px;color:var(--text3);margin-bottom:10px',
    q: 'font-size:12px;color:var(--text);margin:10px 0 6px',
    btnRow: 'display:flex;gap:5px;flex-wrap:wrap',
    btn: 'flex:1;min-width:70px;padding:7px 4px;font-size:9px;letter-spacing:1px;font-family:var(--font-family);cursor:pointer;border-radius:4px;text-align:center',
    seal: 'width:100%;margin-top:12px;padding:10px;font-size:11px;letter-spacing:3px;font-family:var(--font-family);cursor:pointer;background:var(--gold);color:var(--bg);border:none;border-radius:4px',
    foot: 'margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:9px;color:var(--text2)',
  };

  function btnStyle(selected) {
    return S.btn + (selected
      ? ';background:var(--gold);color:var(--bg);border:1px solid var(--gold)'
      : ';background:var(--bg3);color:var(--text2);border:1px solid var(--border)');
  }

  function streakLine(f) {
    const cal = calibration(data);
    let s = 'Streak: ' + (f.streak || 0) + (f.best > 2 && f.best > f.streak ? ' (best ' + f.best + ')' : '');
    if (cal) s += ' · Locks hit ' + (cal.locks === null ? '—' : cal.locks + '%')
             + ' · Leans ' + (cal.leans === null ? '—' : cal.leans + '%')
             + ' · Calibration ' + cal.skill;
    return s;
  }

  window.renderForecastCard = function (container) {
    ensureState();
    const f = data.forecast;
    const today = getTodayStr();
    const card = document.createElement('div');
    card.style.cssText = S.card;

    // 1) A scored day awaiting its reveal outranks everything.
    const unrevealed = Object.keys(f.days).filter(dk => f.days[dk].scored && !f.days[dk].revealed).sort().pop();
    if (unrevealed) {
      const day = f.days[unrevealed];
      const rows = day.qs.map(q =>
        '<div style="' + S.q + ';display:flex;justify-content:space-between;gap:8px">'
        + '<span style="flex:1">' + esc(q.text)
        + ' <span style="color:var(--text3)">— you called ' + confLabel(q, q.p) + '</span></span>'
        + '<span style="color:' + (q.hit ? 'var(--green)' : 'var(--red)') + ';white-space:nowrap">'
        + (q.hit ? '✓ +' + q.payout : '✗ 0') + '</span></div>'
      ).join('');
      card.innerHTML =
        '<div style="' + S.title + '">THE FORECAST — RESULTS</div>'
        + '<div style="' + S.sub + '">' + unrevealed + '</div>'
        + rows
        + '<div style="' + S.q + ';color:var(--gold)">+<span id="fcXp">0</span> XP</div>'
        + '<button style="' + S.seal + '" onclick="forecastAcknowledge(\'' + unrevealed + '\')">CONTINUE</button>'
        + '<div style="' + S.foot + '">' + streakLine(f) + '</div>';
      container.appendChild(card);
      const xpEl = card.querySelector('#fcXp');
      if (window.juice && xpEl) juice.rollup(xpEl, 0, day.xpEarned || 0);
      else if (xpEl) xpEl.textContent = day.xpEarned || 0;
      return;
    }

    // 2) Today already sealed — calls are riding.
    if (f.days[today]) {
      const day = f.days[today];
      const rows = day.qs.map(q =>
        '<div style="' + S.q + '">' + esc(q.text)
        + ' <span style="color:var(--gold)">' + confLabel(q, q.p) + '</span></div>'
      ).join('');
      card.innerHTML =
        '<div style="' + S.title + '">THE FORECAST — SEALED</div>'
        + '<div style="' + S.sub + '">Scored at day\'s end. Log your day to find out.</div>'
        + rows
        + '<div style="' + S.foot + '">' + streakLine(f) + '</div>';
      container.appendChild(card);
      return;
    }

    // 3) Window open — deal today's hand.
    if (windowOpen()) {
      if (pendingDay !== today) { pending = {}; pendingDay = today; }
      const qs = todaysQuestions(today);
      if (qs.length < 2) return;   // not enough open metrics to play
      const blocks = qs.map((q, i) =>
        '<div style="' + S.q + '">' + esc(q.text) + '</div>'
        + '<div style="' + S.btnRow + '">'
        + CONF.map(c =>
            '<button style="' + btnStyle(pending[i] === c.p) + '" '
            + 'onclick="forecastSelect(' + i + ',' + c.p + ')">'
            + (q.kind === 'over' ? c.alt : c.label) + '</button>'
          ).join('')
        + '</div>'
      ).join('');
      const ready = qs.every((q, i) => pending[i] !== undefined);
      card.innerHTML =
        '<div style="' + S.title + '">THE FORECAST</div>'
        + '<div style="' + S.sub + '">Two calls on your own day. Locks pay more — and cost more credibility.</div>'
        + blocks
        + (ready ? '<button style="' + S.seal + '" onclick="sealForecast()">SEAL THE FORECAST</button>' : '')
        + '<div style="' + S.foot + '">' + streakLine(f) + '</div>';
      container.appendChild(card);
      return;
    }

    // 4) Missed the window. Say so only if there's a streak worth mourning.
    if ((f.streak || 0) > 0) {
      card.innerHTML =
        '<div style="' + S.title + '">THE FORECAST</div>'
        + '<div style="' + S.sub + '">The window closed at ' + TUNE.windowEndHour + ':00. It opens with the day.</div>'
        + '<div style="' + S.foot + '">' + streakLine(f) + '</div>';
      container.appendChild(card);
    }
  };

  // Pure core, exported for tests and future sleeves.
  window.Forecast = {
    TUNE: TUNE, CONF: CONF,
    seedFor: seedFor, trailingDays: trailingDays, thresh: thresh,
    buildPool: buildPool, pickQuestions: pickQuestions,
    outcome: outcome, scoreDay: scoreDay, calibration: calibration,
    domainsLogged: domainsLogged,
  };
})();

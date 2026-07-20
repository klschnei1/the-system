// ═══════════════════════════════════════════════════════════════════════
// SleeveCore — headless mutation verbs (spine.md Phase 2)
//
// The data half of logging, with ZERO DOM. No getElementById, no render,
// no notify, no juice. A verb takes state + a payload, mutates, persists,
// and returns a Result rich enough for ANY sleeve to animate from.
//
// Created July 19, 2026 by MOVING the data half out of system.html's
// finishLogQuest — not by rewriting a clean version alongside it. That
// distinction is the whole lesson of Phase 1: datastore.js was written
// once as a parallel "clean" copy, never consumed, and rotted for four
// months while the inline fork carried every real fix. So: extract by
// moving, and land the caller in the same commit. No orphan window.
//
// ── STATE OWNERSHIP — closed July 19, 2026 ─────────────────────────────
// The core OWNS the state (SleeveCore.state) and publishes it as window
// accessors at the bottom of this file. It no longer borrows it.
//
// What it used to be: `data`, `todayLog`, `todayXpEarned` were bare
// top-level `let`s in system.html. A top-level `let` lands in the global
// DECLARATIVE record — reachable as a bare identifier from any classic
// script, but absent from `window` (which is why `window.data` read
// undefined and wedged juice's mode()). intake.js / finance.js /
// forecast.js all reached `data` that way: invisible coupling that made
// each look self-contained while silently requiring system.html first.
//
// The migration looked enormous and wasn't. ~300 of the reference sites are
// READS, and reads never had to change — an accessor keeps every bare
// reference working verbatim. Only 3 declarations and 12 assignments were
// real work. Counting the reads is what made this look unaffordable for
// four months; the estimate was the obstacle, not the code.
//
// It also deletes a whole bug class. Under the old borrow-a-ctx design,
// `data`/`todayLog` mutated in place (objects) but `todayXpEarned` copied
// (primitive), so the Result had to carry `newToday` back and every caller
// had to remember to assign it — forget once and XP vanishes silently.
// With one owned copy that asymmetry does not exist.
//
// Depends on globals from other files: getTodayStr() + saveData()
// (system.html), rollQuestReward() (sensei.js).
// ═══════════════════════════════════════════════════════════════════════

const SleeveCore = {

  // ── THE STATE. The core owns it; sleeves borrow references. ──────────
  // Previously three bare `let`s in system.html, which made every module
  // that touched them a hidden fragment of that file. Now there is one
  // owner and the identifiers below are views onto it.
  state: {
    data: {},          // the persisted document (CSS_DATA.json shape)
    todayLog: {},      // questId -> entry, for the current 3:30am-boundary day
    todayXpEarned: 0   // XP earned today; a PRIMITIVE, hence the accessor
  },

  // ── logQuest's data half ─────────────────────────────────────────────
  // Everything finishLogQuest did EXCEPT rendering. Behavior must be
  // byte-identical to the pre-extraction version — system.html is the
  // golden reference (spine.md).
  //
  // args: { qid, xp, quest, domainKey, note, extraData, targetDate }
  // → Result {
  //     ok, kind: 'workout'|'quest', total, prevToday, newToday, reward,
  //     writeDate, isFirst, domainKey, workoutCount?, allDoneDomain, error?
  //   }
  finishLog(args) {
    const { data, todayLog } = this.state;
    let todayXpEarned = this.state.todayXpEarned;
    const { qid, xp, quest, domainKey, note, extraData, targetDate } = args;

    const today = getTodayStr();
    if (!data.dailyLogs) data.dailyLogs = {};

    // ── strong-paste: multiple workouts per day ────────────────────────
    // Each parsed workout is appended to g1.workouts. Only the FIRST workout
    // of a given day awards XP + rolls a reward; later adds just stack data
    // (same first-of-day semantics as the finance/intake accumulators). A
    // late workout (targetDate in the past) is filed on its OWN day and does
    // NOT mark today done — so today's quest stays open for today's session.
    if (extraData && extraData.workout) {
      const writeDate = (targetDate && targetDate !== today) ? targetDate : today;
      if (!data.dailyLogs[writeDate]) data.dailyLogs[writeDate] = {};
      let dayLog = data.dailyLogs[writeDate][qid];
      // migrate a legacy single-workout day to the array shape in place
      if (dayLog && dayLog.workout && !dayLog.workouts) {
        dayLog.workouts = [dayLog.workout];
        delete dayLog.workout;
      }
      const isFirst = !dayLog;
      // First-of-today rolls the reward; the roll decides the payout, and the
      // full amount (incl. any multiplier) is folded into dayLog.xp so undo
      // and reload see the truth (July 3 audit fix).
      const reward = (isFirst && writeDate === today) ? rollQuestReward(qid, xp) : null;
      const totalXp = (reward && reward.type === 'xp_multiplier') ? xp * reward.multiplier : xp;
      const prevToday = todayXpEarned;
      if (isFirst) {
        dayLog = { xp: totalXp, workouts: [], time: new Date().toISOString(), source: extraData.source || 'manual' };
        if (reward && reward.roll !== undefined) dayLog.roll = reward.roll;
        data.dailyLogs[writeDate][qid] = dayLog;
        data.xp = (data.xp || 0) + totalXp;
        if (writeDate === today) todayXpEarned += totalXp;
      }
      if (!Array.isArray(dayLog.workouts)) dayLog.workouts = [];
      dayLog.workouts.push(extraData.workout);
      dayLog.note = `${dayLog.workouts.length} workout${dayLog.workouts.length !== 1 ? 's' : ''}`;
      if (writeDate === today) todayLog[qid] = dayLog;   // past-date log leaves today open

      this.state.todayXpEarned = todayXpEarned;   // commit the primitive
      saveData();

      return {
        ok: true, kind: 'workout',
        total: totalXp, prevToday, newToday: todayXpEarned,
        reward, writeDate, isFirst, domainKey,
        workoutCount: dayLog.workouts.length,
        allDoneDomain: false   // workout path never auto-collapsed
      };
    }

    // ── every other quest type ─────────────────────────────────────────
    // Roll BEFORE payout (juice.md sequence rule): the roll DECIDES the
    // amount, so multiplier bonuses fold into the entry's xp — undo and
    // reload now see the true total (fixes the July 3 audit's phantom-XP
    // leak).
    const reward = rollQuestReward(qid, xp);
    const totalXp = (reward && reward.type === 'xp_multiplier') ? xp * reward.multiplier : xp;

    const logEntry = { xp: totalXp, note, time: new Date().toISOString(), source: 'manual', ...extraData };
    if (reward && reward.roll !== undefined) logEntry.roll = reward.roll;
    const prevToday = todayXpEarned;
    todayXpEarned += totalXp;
    data.xp = (data.xp || 0) + totalXp;

    if (targetDate && targetDate !== today) {
      // Retro log: write to the past date; stub todayLog so the quest shows
      // done. The stub has no .workout so the strength widget doesn't
      // double-count it for today.
      if (!data.dailyLogs[targetDate]) data.dailyLogs[targetDate] = {};
      data.dailyLogs[targetDate][qid] = logEntry;
      todayLog[qid] = { xp: totalXp, note: `logged to ${targetDate}`, time: logEntry.time, source: 'retro', retroDate: targetDate };
    } else {
      todayLog[qid] = logEntry;
      if (!data.dailyLogs[today]) data.dailyLogs[today] = {};
      data.dailyLogs[today][qid] = logEntry;
    }

    // Does this complete the domain? The CORE decides (it's a data question);
    // the sleeve decides what to DO about it (system.html auto-collapses).
    let allDoneDomain = false;
    if (domainKey && data.questDefinitions[domainKey]) {
      const domain = data.questDefinitions[domainKey];
      allDoneDomain = Object.keys(domain.quests).every(q => !!(q === qid ? true : todayLog[q]));
    }

    // Data first, ceremony second (never gate the write on the animation).
    this.state.todayXpEarned = todayXpEarned;   // commit the primitive
    saveData();

    return {
      ok: true, kind: 'quest',
      total: totalXp, prevToday, newToday: todayXpEarned,
      reward, writeDate: (targetDate && targetDate !== today) ? targetDate : today,
      isFirst: true, domainKey, allDoneDomain
    };
  }
};

window.SleeveCore = SleeveCore;

// ── PUBLISH THE STATE ──────────────────────────────────────────────────
// `data`, `todayLog` and `todayXpEarned` used to be bare top-level `let`s in
// system.html. A top-level `let` lands in the global DECLARATIVE record —
// reachable as a bare identifier from any classic script, but absent from
// `window`. That is how intake.js/finance.js/forecast.js read `data` today,
// and it is invisible coupling: those files look self-contained while
// silently requiring system.html to have loaded first.
//
// Defining them as accessors on `window` keeps every existing bare reference
// working verbatim (~300 reads across system.html + the domain modules) while
// routing all of them through the core's single owned copy. So the migration
// touches declarations and assignments only — reads never had to change, and
// the ownership question is settled rather than deferred again.
//
// Sleeves that don't load system.html read SleeveCore.state directly.
['data', 'todayLog', 'todayXpEarned'].forEach(key => {
  Object.defineProperty(window, key, {
    get() { return SleeveCore.state[key]; },
    set(v) { SleeveCore.state[key] = v; },
    configurable: true,
    enumerable: true
  });
});

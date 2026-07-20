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
// ── STATE OWNERSHIP (the honest caveat) ────────────────────────────────
// system.html holds `data`, `todayLog`, `todayXpEarned` as bare top-level
// `let`s. A top-level `let` lives in the global DECLARATIVE record: shared
// across every classic script on the page, but NOT a property of window.
// So `window.data` is undefined (the bug that wedged juice's mode()), while
// a bare `data` reference from this file WOULD resolve — which is exactly
// how intake.js / finance.js / forecast.js reach it today.
//
// This file deliberately does not do that. Reaching for a binding that
// another file happened to declare is invisible coupling: it makes this
// module look self-contained while silently requiring system.html to have
// loaded first (drop it in a page without system.html and every bare `data`
// throws ReferenceError). That is the same cosmetic independence that let
// datastore.js rot. So verbs take an explicit ctx instead:
//
//   ctx = { data, todayLog, todayXpEarned }
//
// `data` and `todayLog` are object references, so in-place mutation is
// visible to the caller. `todayXpEarned` is a number (copied), so the
// Result carries `newToday` back and the caller MUST assign it — a verb
// that forgets loses XP silently. That asymmetry is a bug farm and is the
// clearest argument for the core owning state outright.
//
// This is a seam, not a finished boundary: the core borrows state, so a
// second sleeve still can't stand alone (it would have to produce `data`
// itself, duplicating initDataStore + rollover + re-entry). Closing it =
// moving ownership here and rewriting ~316 reference sites in system.html.
// Deliberately NOT bundled with this extraction: mixing a semantic change
// with a vast mechanical rename destroys bisectability if XP math breaks.
// That is also the exact reasoning that deferred this work for four months,
// so it is logged as a named open gap in spine.md, not as prose.
//
// Depends on globals from other files: getTodayStr() + saveData()
// (system.html), rollQuestReward() (sensei.js).
// ═══════════════════════════════════════════════════════════════════════

const SleeveCore = {

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
  finishLog(ctx, args) {
    const { data, todayLog } = ctx;
    let todayXpEarned = ctx.todayXpEarned;
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

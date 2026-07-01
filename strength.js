// ── STRENGTH DOMAIN (Geburah) ─────────────────────────────────────────
// Workout logging: Strong app parser, exercise→muscle group mapping,
// unknown exercise classifier, 7-day volume widget.

// ── EXERCISE MUSCLE MAP ───────────────────────────────────────────────
// Maps exercise name patterns to muscle groups with tiers.
// { m: 'muscle', t: 1 } = primary (1 set), { m: 'muscle', t: 0.5 } = secondary (0.5 sets).
// Checked in order; first match wins. User overrides checked before this table.
const EXERCISE_MUSCLE_MAP = [
  // Legs — quad-dominant
  [/leg extension/i, [{m:'quads',t:1}]],
  [/hack squat/i, [{m:'quads',t:1},{m:'glutes',t:0.5}]],
  [/front squat/i, [{m:'quads',t:1},{m:'glutes',t:0.5}]],
  [/goblet squat/i, [{m:'quads',t:1},{m:'glutes',t:0.5}]],
  [/split squat/i, [{m:'quads',t:1},{m:'glutes',t:0.5}]],
  [/lunge/i, [{m:'quads',t:1},{m:'glutes',t:0.5}]],
  [/step up/i, [{m:'quads',t:1},{m:'glutes',t:0.5}]],
  // Legs — balanced squat variants
  [/leg press/i, [{m:'quads',t:1},{m:'glutes',t:1}]],
  [/squat/i, [{m:'quads',t:1},{m:'glutes',t:1}]],
  // Legs — posterior chain / back extensions
  [/back extension/i, [{m:'hamstrings',t:1},{m:'glutes',t:0.5},{m:'erectors',t:0.5}]],
  [/hyperextension/i, [{m:'hamstrings',t:1},{m:'glutes',t:0.5},{m:'erectors',t:0.5}]],
  [/45.?degree.*(extension|hyper)/i, [{m:'hamstrings',t:1},{m:'glutes',t:0.5},{m:'erectors',t:0.5}]],
  // Legs — hamstrings
  [/leg curl/i, [{m:'hamstrings',t:1}]],
  [/stiff.?leg.?dead/i, [{m:'hamstrings',t:1},{m:'glutes',t:1}]],
  [/romanian.?dead/i, [{m:'hamstrings',t:1},{m:'glutes',t:1}]],
  [/good morning/i, [{m:'hamstrings',t:1},{m:'glutes',t:0.5}]],
  [/nordic/i, [{m:'hamstrings',t:1}]],
  // Legs — glutes
  [/hip thrust/i, [{m:'glutes',t:1}]],
  [/glute/i, [{m:'glutes',t:1}]],
  [/hip abduct/i, [{m:'glutes',t:1}]],
  // Legs — adductors
  [/hip adduct/i, [{m:'adductors',t:1}]],
  // Legs — calves
  [/calf raise/i, [{m:'calves',t:1}]],
  [/tib(i|e)al/i, [{m:'calves',t:1}]],
  [/tib raise/i, [{m:'calves',t:1}]],
  // Chest
  [/close.?grip bench/i, [{m:'triceps',t:1},{m:'chest',t:0.5}]],
  [/bench press/i, [{m:'chest',t:1},{m:'triceps',t:0.5},{m:'shoulders',t:0.5}]],
  [/chest fly/i, [{m:'chest',t:1}]],
  [/chest press/i, [{m:'chest',t:1},{m:'triceps',t:0.5}]],
  [/cable cross/i, [{m:'chest',t:1}]],
  [/push.?up/i, [{m:'chest',t:1},{m:'triceps',t:0.5}]],
  [/pec/i, [{m:'chest',t:1}]],
  // Back
  [/pull.?up/i, [{m:'lats',t:1},{m:'biceps',t:0.5}]],
  [/chin.?up/i, [{m:'lats',t:1},{m:'biceps',t:0.5}]],
  [/lat pull/i, [{m:'lats',t:1},{m:'biceps',t:0.5}]],
  [/cable row/i, [{m:'lats',t:1},{m:'biceps',t:0.5}]],
  [/seated row/i, [{m:'lats',t:1},{m:'biceps',t:0.5}]],
  [/barbell row/i, [{m:'lats',t:1},{m:'traps',t:0.5},{m:'biceps',t:0.5}]],
  [/pendlay/i, [{m:'lats',t:1},{m:'traps',t:0.5},{m:'biceps',t:0.5}]],
  [/t.?bar/i, [{m:'lats',t:1},{m:'traps',t:0.5},{m:'biceps',t:0.5}]],
  [/row/i, [{m:'lats',t:1},{m:'biceps',t:0.5}]],
  [/deadlift/i, [{m:'glutes',t:1},{m:'hamstrings',t:1},{m:'erectors',t:1},{m:'traps',t:0.5}]],
  [/shrug/i, [{m:'traps',t:1}]],
  [/face pull/i, [{m:'rear delts',t:1}]],
  [/rear delt/i, [{m:'rear delts',t:1}]],
  // Shoulders
  [/overhead press/i, [{m:'shoulders',t:1},{m:'triceps',t:0.5}]],
  [/shoulder press/i, [{m:'shoulders',t:1},{m:'triceps',t:0.5}]],
  [/military press/i, [{m:'shoulders',t:1},{m:'triceps',t:0.5}]],
  [/lateral raise/i, [{m:'shoulders',t:1}]],
  [/front raise/i, [{m:'shoulders',t:1}]],
  [/arnold/i, [{m:'shoulders',t:1},{m:'triceps',t:0.5}]],
  [/upright row/i, [{m:'shoulders',t:1},{m:'traps',t:0.5}]],
  // Biceps
  [/curl/i, [{m:'biceps',t:1}]],
  [/hammer/i, [{m:'biceps',t:1}]],
  // Triceps
  [/tricep/i, [{m:'triceps',t:1}]],
  [/skull crush/i, [{m:'triceps',t:1}]],
  [/pushdown/i, [{m:'triceps',t:1}]],
  [/cable extension/i, [{m:'triceps',t:1}]],
  // Core
  [/plank/i, [{m:'core',t:1}]],
  [/crunch/i, [{m:'core',t:1}]],
  [/leg raise/i, [{m:'core',t:1}]],
  [/ab wheel/i, [{m:'core',t:1}]],
  [/russian twist/i, [{m:'core',t:1}]],
  // Dips
  [/dip/i, [{m:'triceps',t:1},{m:'chest',t:0.5}]],
];

// ── USER EXERCISE OVERRIDES ───────────────────────────────────────────
function getUserExerciseMap() {
  try { return JSON.parse(localStorage.getItem('css_exercise_map') || '{}'); } catch { return {}; }
}
function saveUserExerciseMap(map) {
  localStorage.setItem('css_exercise_map', JSON.stringify(map));
}

function classifyExercise(name) {
  const userMap = getUserExerciseMap();
  const key = name.toLowerCase().trim();
  if (userMap[key]) return userMap[key];
  for (const [pattern, groups] of EXERCISE_MUSCLE_MAP) {
    if (pattern.test(name)) return groups;
  }
  return [{m:'other',t:1}];
}

// ── STRONG APP PARSER ─────────────────────────────────────────────────
// Parses Strong's date line (e.g. "Jan 15, 2024" or "January 15, 2024 3:30 PM") → "YYYY-MM-DD"
function parseStrongDate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/([A-Za-z]+)\s+(\d+),?\s+(\d{4})/);
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]}, ${m[3]}`);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD, same format as getTodayStr
}
window.parseStrongDate = parseStrongDate;

function parseStrongExport(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 4) return null;

  const hasSetPattern = lines.some(l => /^(Set \d+|W\d+):/i.test(l.trim()));
  if (!hasSetPattern) return null;

  const result = {
    name: lines[0].trim(),
    date: lines[1]?.trim() || '',
    exercises: [],
    muscleGroupSets: {},
    totalSets: 0
  };

  let currentExercise = null;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { currentExercise = null; continue; }
    if (line.startsWith('http')) continue;

    const setMatch = line.match(/^(Set \d+|W\d+):\s*(?:(\d+(?:\.\d+)?)\s*(?:lb|kg)\s*[×x\u00d7\u2715\u2a09]\s*)?(\d+)(?:\s*\[.*\])?/i);
    if (setMatch) {
      if (!currentExercise) continue;
      const isWarmup = /^W\d+/i.test(line) || /\[warm/i.test(line);
      const weight = setMatch[2] ? parseFloat(setMatch[2]) : 0;
      const reps = parseInt(setMatch[3]) || 0;
      currentExercise.sets.push({ weight, reps, warmup: isWarmup });
      continue;
    }

    currentExercise = {
      name: line,
      muscleGroups: classifyExercise(line),
      sets: []
    };
    result.exercises.push(currentExercise);
  }

  result.exercises.forEach(ex => {
    const workingSets = ex.sets.filter(s => !s.warmup).length;
    ex.workingSets = workingSets;
    result.totalSets += workingSets;
    ex.muscleGroups.forEach(({m, t}) => {
      if (!result.muscleGroupSets[m]) result.muscleGroupSets[m] = 0;
      result.muscleGroupSets[m] += workingSets * t;
    });
  });

  return result;
}

// ── EXERCISE CLASSIFY MODAL ───────────────────────────────────────────
const KNOWN_MUSCLES = ['quads','hamstrings','glutes','calves','adductors',
  'chest','lats','traps','erectors','rear delts','shoulders','triceps','biceps','core'];

function showExerciseClassifyModal(unknownNames, onComplete) {
  const selections = {};
  unknownNames.forEach(n => { selections[n] = {}; });

  const overlay = document.createElement('div');
  overlay.className = 'classify-overlay';

  const modal = document.createElement('div');
  modal.className = 'classify-modal';

  function render() {
    modal.innerHTML = `
      <div class="classify-title">Unknown Exercises</div>
      <div class="classify-subtitle">Tap once for primary · tap again for secondary · tap again to clear</div>
    `;

    unknownNames.forEach(exName => {
      const block = document.createElement('div');
      block.className = 'classify-exercise';
      const nameEl = document.createElement('div');
      nameEl.className = 'classify-ex-name';
      nameEl.textContent = exName;
      block.appendChild(nameEl);

      const pillRow = document.createElement('div');
      pillRow.className = 'classify-muscles';

      KNOWN_MUSCLES.forEach(muscle => {
        const tier = selections[exName][muscle] || 0;
        const pill = document.createElement('button');
        pill.className = 'classify-pill' + (tier === 1 ? ' primary' : tier === 0.5 ? ' secondary' : '');
        pill.textContent = muscle + (tier === 1 ? ' ●' : tier === 0.5 ? ' ◌' : '');
        pill.onclick = () => {
          const cur = selections[exName][muscle] || 0;
          selections[exName][muscle] = cur === 0 ? 1 : cur === 1 ? 0.5 : 0;
          render();
        };
        pillRow.appendChild(pill);
      });

      block.appendChild(pillRow);
      modal.appendChild(block);
    });

    const btnRow = document.createElement('div');
    btnRow.className = 'classify-btn-row';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Save & Log';
    saveBtn.onclick = () => {
      const userMap = getUserExerciseMap();
      const result = {};
      unknownNames.forEach(name => {
        const groups = Object.entries(selections[name])
          .filter(([, t]) => t > 0)
          .map(([m, t]) => ({m, t}));
        result[name] = groups.length ? groups : [{m:'other', t:1}];
        userMap[name.toLowerCase().trim()] = result[name];
      });
      saveUserExerciseMap(userMap);
      overlay.remove();
      onComplete(result);
    };

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn';
    skipBtn.textContent = 'Skip';
    skipBtn.onclick = () => {
      const result = {};
      unknownNames.forEach(n => { result[n] = [{m:'other', t:1}]; });
      overlay.remove();
      onComplete(result);
    };

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(skipBtn);
    modal.appendChild(btnRow);
  }

  render();
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// ── MULTI-WORKOUT READER ──────────────────────────────────────────────
// A day's g1 log can hold MORE THAN ONE workout (multiple sessions, or a
// late-logged workout from a prior day plus today's). New shape: g1.workouts
// is an array. Legacy shape: g1.workout is a single object. This reader
// normalizes both so every consumer iterates a list and old data still renders.
function g1Workouts(g1) {
  if (!g1) return [];
  if (Array.isArray(g1.workouts)) return g1.workouts;
  if (g1.workout) return [g1.workout];   // legacy single-workout shape
  return [];
}
window.g1Workouts = g1Workouts;

// ── STRENGTH WIDGET ───────────────────────────────────────────────────
// 7-day rolling workout volume. Called from system.html DOMAIN_WIDGETS.geburah.
// Depends on globals: data, todayLog, getTodayStr (from system.html inline script).
window.renderStrengthWidget = function(el, dk, domain) {
  const today = getTodayStr();
  const base = new Date(today + 'T12:00:00');   // local-noon anchor — avoids UTC date-shift
  const weekVolume = {};
  let weekSessions = 0;
  let weekTotalSets = 0;

  const addWorkout = (w) => {
    weekSessions++;   // each workout counts as a session (two-a-days count twice)
    weekTotalSets += w.totalSets || 0;
    Object.entries(w.muscleGroupSets || {}).forEach(([mg, sets]) => {
      weekVolume[mg] = (weekVolume[mg] || 0) + sets;
    });
  };

  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const ds = d.toLocaleDateString('en-CA');
    g1Workouts(data.dailyLogs?.[ds]?.g1).forEach(addWorkout);
  }

  // Defensive: surface today's workouts if they're in todayLog but not yet
  // written through to dailyLogs (normally they are — finishLogQuest writes both).
  if (!data.dailyLogs?.[today]?.g1) {
    g1Workouts(todayLog['g1']).forEach(addWorkout);
  }

  const hasVolume = Object.keys(weekVolume).length > 0;
  const volumeGroups = Object.entries(weekVolume).sort((a,b) => b[1] - a[1]);

  // ── 8-BIT MODE (arcade sleeve) ────────────────────────────────────────
  if (window.fromArcade) {
    const maxSets = volumeGroups.length ? volumeGroups[0][1] : 1;
    const abbrev = s => s.replace('hamstrings','hams').replace('shoulders','shldrs')
                         .replace('adductors','addctrs').replace('rear delts','r.delts')
                         .replace('erectors','erctrs');

    el.innerHTML = `
      <style>
        .px-widget { background:#0a0a14; border:3px solid #c8372d; padding:16px; font-family:'Press Start 2P',monospace; margin-top:12px; }
        .px-header { color:#c8372d; font-size:9px; margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid #c8372d; }
        .px-stat { color:#f0e6d3; font-size:7px; margin-bottom:6px; }
        .px-divider { color:#c8b97a; font-size:7px; margin:12px 0 10px; }
        .px-row { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .px-label { color:#f0e6d3; font-size:6px; width:68px; flex-shrink:0; text-transform:uppercase; overflow:hidden; white-space:nowrap; }
        .px-track { flex:1; height:10px; background:#1a1a2e; border:1px solid #333; }
        .px-fill { height:100%; background:#c8372d; }
        .px-val { color:#c8b97a; font-size:7px; width:20px; text-align:right; flex-shrink:0; }
        .px-empty { color:#444; font-size:7px; margin-top:12px; }
      </style>
      <div class="px-widget">
        <div class="px-header">⚔ STRENGTH LOG</div>
        <div class="px-stat">SESSIONS : ${String(weekSessions).padStart(2,'0')} / 07</div>
        <div class="px-stat">TOTAL SETS: ${String(weekTotalSets).padStart(3,'0')}</div>
        ${hasVolume ? `
          <div class="px-divider">— MUSCLE VOL —</div>
          ${volumeGroups.map(([mg, sets]) => `
            <div class="px-row">
              <div class="px-label">${abbrev(mg)}</div>
              <div class="px-track"><div class="px-fill" style="width:${Math.round((sets/maxSets)*100)}%"></div></div>
              <div class="px-val">${sets}</div>
            </div>
          `).join('')}
        ` : '<div class="px-empty">NO DATA</div>'}
      </div>
    `;
    return;
  }

  // ── DEFAULT MODE ──────────────────────────────────────────────────────
  el.innerHTML = hasVolume ? `
    <div class="domain-widget" style="border-color:${domain.color}">
      <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase;margin-bottom:8px">7-day volume · ${weekSessions} sessions · ${weekTotalSets} sets</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${volumeGroups.map(([mg, sets]) => `
          <div style="flex:1;min-width:70px;text-align:center;padding:6px 4px;border:1px solid var(--border);border-radius:2px">
            <div style="font-size:18px;font-weight:bold;color:var(--text)">${sets}</div>
            <div style="font-size:8px;letter-spacing:1px;color:var(--text3);text-transform:uppercase">${mg}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';
};

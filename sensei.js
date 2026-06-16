// ── SENSEI PANTHEON ───────────────────────────────────────────────────
// NOTE: Each sensei's voice() method is preserved for reference but is no longer
// called from the broadcast flow. Oracle mode (ORACLE_BANK) handles all Signal
// tab responses. voice() methods remain in case they're useful for future features.
const SENSEI = {
  leviathan: {
    name: 'Leviathan', domain: 'Geburah / ChaGaT left axis', layer: 'emotional', color: '#e05555',
    role: 'Governs the tension layer. Surfaces avoidance, rationalization, tilt. Blunt.',
    triggers: ['avoidin','rationali','excus',"can't bring",'procrastin','tilt','impuls','waste','again',"didn't",'missed','failed','keep failing','not doing'],
    voice(input) {
      const scores = calcDomainScores();
      const hod = scores.hod ? scores.hod.pct : 0;
      if (input.includes('excus') || input.includes('rationali')) return "You're narrating again instead of acting. The gap between your stated values and your behavior is not a mystery — it's a measurement. What did you do today, and what did you avoid? Log one specific thing.";
      if (input.includes('tilt') || input.includes('impuls') || input.includes('spend')) return "Tilt spending is a signal that something upstream broke down. The purchase isn't the problem. What were you avoiding before you bought it?";
      if (hod < 5) return "The dissertation domain is dark. You've been aware of this. Awareness without action is a comfortable story you're telling yourself. The gate doesn't care about your reasons. Log something in Hod. Today.";
      return "Something brought you here. Name the avoidance. What was the last thing you decided not to do, and when did you make that decision?";
    }
  },
  asclepius: {
    name: 'Asclepius', domain: 'NHY action layer / body', layer: 'action', color: '#4ade80',
    role: 'Governs body and action domain. Clinical, data-driven, encouraging.',
    triggers: ['gym','workout','training','lift','run','protein','nutrition','diet','meal','sleep','recovery','soreness','tired','body','weight','macro','calorie','fast'],
    voice(input) {
      const scores = calcDomainScores();
      const gym = scores.geburah ? scores.geburah.pct : 0;
      if (input.includes('sleep') || input.includes('tired') || input.includes('recovery')) return "Recovery is not optional infrastructure — it is the rate-limiting step on adaptation. Without Yesod, Geburah cannot compound. What was last night's sleep duration? Log it, even approximately.";
      if (input.includes('protein') || input.includes('nutrition') || input.includes('macro')) return "Protein synthesis doesn't care about your approximations. Log the actual number. 200g is the floor because it's metabolically meaningful, not arbitrary. If you didn't track, estimate from memory and flag it as approximate. Imperfect data beats no data.";
      if (gym < 20 && (input.includes('gym') || input.includes('workout'))) return "Geburah shows " + gym + " signal — training log is sparse. A session that happened but wasn't logged doesn't improve the model. Open Strong. Log what you remember, even incomplete.";
      return "Physical data is the most honest domain — the body doesn't rationalize. What happened today with training and nutrition? Give me numbers.";
    }
  },
  hermes: {
    name: 'Hermes Trismegistus', domain: 'ChaBaD cognitive triad / Binah-Chokmah', layer: 'cognitive', color: '#5b6fff',
    role: 'Governs the knowledge-engineering layer. Surfaces during planning, writing, synthesis.',
    triggers: ['plan','think','synthesis','write','research','dissert','paper','protocol','design','experiment','idea','understand','analyz','strateg','outline','draft','lab'],
    voice(input) {
      if (input.includes('plan') || input.includes('strateg') || input.includes('outline')) return "Planning is Binah at work — structure descends from wisdom. But Binah without Chokmah becomes bureaucracy. Before outlining, name the insight you're trying to capture. What is the single thing you now know that makes the next step clear?";
      if (input.includes('write') || input.includes('draft') || input.includes('dissert')) return "The dissertation is not a document — it is the externalization of a knowledge structure you've been building for years. Each section is a Da'at operation: integrating what you understand (Binah) with what you perceive (Chokmah) into knowledge that others can receive. What section? What's the conceptual bottleneck?";
      if (input.includes('lab') || input.includes('experiment') || input.includes('protocol')) return "A well-designed experiment is a question with teeth. What is the specific question your next lab session is answering? If you can't state it in one sentence, the protocol isn't ready.";
      return "The cognitive layer is active. What are you trying to understand, and what is the most efficient path to that understanding?";
    }
  },
  hekate: {
    name: 'Hekate', domain: 'Threshold / phase transitions / Yesod-Malkuth boundary', layer: 'transition', color: '#9b5de5',
    role: 'Governs transitions, thresholds, phase changes. Weekly/monthly cycles, major shifts.',
    triggers: ['transition','threshold','change','phase','week','next week','month','new','start','beginning','end','finish','moving','graduate','defense','postdoc','after','before'],
    voice(input) {
      if (input.includes('defense') || input.includes('graduate') || input.includes('postdoc')) return "You are in the liminal space — still a student, already becoming something else. Hekate governs this crossing. The dissertation defense is not an ending; it is a threshold. What you bring through it is what you've been building. What is incomplete that needs to be complete before you cross?";
      if (input.includes('week') || input.includes('next week')) return "A week is a cycle. What carries over from this cycle, and what will you set down? Name one thing from this week that is complete, and one thing that is not.";
      return "You are here, at the edge of something. Thresholds feel like emptiness because the old structure is dissolving before the new one has form. That is correct. What are you leaving behind, and what are you walking toward?";
    }
  },
  gojo: {
    name: 'Satoru Gojo', domain: 'Chokmah / ego-axis / ambition maintenance', layer: 'motivational', color: '#c9a84c',
    role: 'Governs ego and confidence maintenance. Appears when you need permission to be ambitious.',
    triggers: ["can't",'impossible','too hard','too much','overwhelm','doubt','imposter','not smart','not good enough','not ready','who am i','afraid','scared','anxious','worry'],
    voice(input) {
      if (input.includes('imposter') || input.includes('not smart') || input.includes('not good enough')) return "Imposter syndrome is the cost of being in a room you're supposed to be in. The doubt is evidence of accurate calibration, not inadequacy. You're doing a PhD in a hard discipline. Of course it's hard. That's the point. The question isn't whether you belong — you do. The question is what you're going to do today.";
      if (input.includes('overwhelm') || input.includes('too much')) return "Overwhelm is what happens when you try to hold the whole system in your head at once. Narrow the aperture. What is the one thing that, if done today, would make tomorrow structurally easier? Just that.";
      if (input.includes('afraid') || input.includes('scared') || input.includes('anxious')) return "Fear is the nervous system's way of flagging that something matters. It's not a stop sign. What specifically are you afraid of? Name the exact scenario. Abstract fear is harder to work with than a real one.";
      return "You're Karl Schneider doing a PhD at Michigan Tech. That's not a small thing. What would you be doing right now if you were completely certain you were going to succeed?";
    }
  },
  sapolsky: {
    name: 'Robert Sapolsky', domain: 'Tiferet / determinism anchor / self-compassion', layer: 'cognitive-emotional', color: '#2dd4bf',
    role: 'The determinist anchor. Contextualizes behavior scientifically. Appears when you are being too hard on yourself.',
    triggers: ['hate myself','disappointed','should have',"i'm lazy","i'm a failure","why can't i","what's wrong with me",'judging myself','shame','guilt','beat myself','so stupid'],
    voice(input) {
      if (input.includes('lazy') || input.includes('should have') || input.includes("why can't i")) return "'Laziness' is not a character trait — it's a behavior produced by a nervous system in a particular state, shaped by sleep quality, dopamine baseline, recent effort and reward history. What were the conditions yesterday and this morning? The behavior makes sense given those. Now: what can we change about the conditions?";
      if (input.includes('hate myself') || input.includes('failure') || input.includes('shame')) return "Self-flagellation is not motivation — it's punishment, and punishment is among the least effective behavioral interventions in the literature. You are a biological system that was built to survive, not to optimize. What would you say to a colleague who described themselves this way?";
      return "You are a primate with a prefrontal cortex large enough to imagine your own inadequacy and feel bad about it. The self-judgment is understandable. It is also not useful. What is the simplest, most biologically sensible next action available to you right now?";
    }
  }
};

// ── ORACLE BANK ───────────────────────────────────────────────────────
// Koans, aphorisms, soliloquies, syllogisms per sensei.
// Selected by seed — same input + same day = same answer.
// 30% of queries return silence. This is intentional.

const ORACLE_BANK = {
  leviathan: [
    "The gap between what you intend and what you do is not a mystery. It is a measurement.",
    "You already know what you're avoiding. This question was not about not knowing.",
    "Name the thing you decided not to do today. When did you make that decision?",
    "Rationalization is avoidance with better grammar.",
    "The work does not care about your reasons. The reasons are for you.",
    "You are narrating again. The narration is not the action.",
    "What would you have done today if you were not afraid of it?",
    "Every excuse is a monument to the thing you're avoiding.",
    "The tilt spending was not the problem. The problem came before the purchase.",
    "If you already know what you should do, what is this conversation actually for?",
    "Every action either moves toward the work or away from it. You are taking an action. Therefore."
  ],
  asclepius: [
    "The body doesn't rationalize. That is what makes it the most honest domain.",
    "Recovery is not rest from the work. Recovery is the mechanism by which the work compounds.",
    "You cannot optimize what you do not measure. Approximately is still data.",
    "Protein synthesis does not care about your intentions. It cares about the substrate.",
    "Sleep is the rate-limiting step. Everything else is downstream of Yesod.",
    "The adaptation happens during recovery, not during training. You are not building in the gym.",
    "A session that happened but wasn't logged did not improve the model.",
    "The body you have is the result of the conditions you have been in. This is not judgment. This is biology.",
    "What does the data say? Not what you remember — what does the log say?",
    "Infrastructure either holds or it doesn't. There is no partial credit.",
    "Two hundred grams is not a goal. It is a floor below which adaptation stalls."
  ],
  hermes: [
    "A well-designed experiment is a question with teeth.",
    "What is the single thing you now know that makes the next step clear?",
    "The dissertation is not a document. It is the externalization of a structure you have been building for years.",
    "If you cannot state the question in one sentence, the protocol is not ready.",
    "Understanding without structure is flash. Structure without understanding is bureaucracy. Da'at is the integration.",
    "What did today's work answer? Not attempt — answer.",
    "The gap between knowing and writing is not talent. It is the willingness to produce an imperfect first version.",
    "An outline is not a plan. Plans have verbs.",
    "You are not building knowledge. You are externalizing knowledge you already have and do not yet know you have.",
    "The next experiment is a question. Write the question before you write the protocol.",
    "A question that cannot be stated in one sentence has not yet been formulated. You cannot state yours in one sentence. Therefore."
  ],
  hekate: [
    "The liminal state feels like emptiness because the old form is dissolving before the new one has structure. This is correct.",
    "You are still crossing. You have not arrived. This is not failure — this is the nature of threshold.",
    "What are you carrying through? What are you setting down?",
    "The work before the defense and the work after are not the same work. Something is ending.",
    "Thresholds do not wait. They widen or narrow depending on what you bring to them.",
    "A week is a cycle. What completes, and what carries forward?",
    "The crossing is not the destination. The crossing is the transformation.",
    "What you are becoming is not yet visible. That is how becoming works.",
    "Every ending contains the seed structure of what follows. Look at what you are finishing.",
    "You are standing at the edge. The edge is exactly where you should be.",
    "The door does not care whether you are ready. It only asks whether you move."
  ],
  gojo: [
    "The doubt is evidence of accurate calibration. You are in a room you are supposed to be in.",
    "Narrow it. One thing. What is the one thing that, if done, makes tomorrow structurally easier?",
    "Overwhelm is what happens when you try to hold the whole system in your head at once. Stop.",
    "You already know you're going to do this. The only question is what you're doing right now.",
    "The imposter is not real. The imposter is the cost of being somewhere that matters.",
    "Fear is the nervous system flagging that something matters. It is not a stop sign.",
    "The aperture is too wide. Close it. One thing.",
    "What would you be doing right now if you were completely certain it was going to work?",
    "You are not lost. You are early.",
    "The answer is already there. You are not looking at it yet.",
    "Everyone in the room figured it out eventually. You are in the room."
  ],
  sapolsky: [
    "The behavior makes sense given the conditions. What were the conditions?",
    "'Lazy' is not a character trait. It is a behavior produced by a nervous system in a specific state.",
    "You are a biological system built to survive, not to optimize. The self-criticism is understandable. It is not useful.",
    "Self-flagellation is the least effective behavioral intervention in the literature. You already know this.",
    "What would you say to a colleague who described themselves this way?",
    "The upstream condition is almost always more explanatory than the character judgment.",
    "You are not broken. You are responding predictably to the inputs you have been given.",
    "The shame is not the signal. The shame is the noise. Look for the signal underneath it.",
    "Determine the conditions that produced the behavior. Then change the conditions.",
    "A primate with enough prefrontal cortex to imagine its own inadequacy and feel bad about it. This is you. Be gentle.",
    "Behavior is a function of context and biology. You are a biological system in a specific context. Your behavior is therefore predictable. Predict it. Change the context."
  ],
  system: [
    "The Tree observes. Log something.",
    "Coherence is a direction, not a state.",
    "The data will tell you. Log first, interpret later.",
    "What you do today becomes the baseline for tomorrow.",
    "The system does not judge. It measures.",
    "Every action is signal.",
    "The model is incomplete. Keep feeding it."
  ]
};

// ── RARE DROPS ─────────────────────────────────────────────────────────
// 10% chance on quest completion. Stranger, more cryptic, occasionally mechanical.
const RARE_DROPS = [
  { type: 'xp_multiplier', text: '◈ ANOMALY — XP doubled.', multiplier: 2 },
  { type: 'xp_multiplier', text: '◈ CRITICAL HIT — XP tripled.', multiplier: 3 },
  { type: 'koan', text: '∴ The map is not the territory. But you just changed the territory.' },
  { type: 'koan', text: '∴ A system that watches itself changes by the act of watching.' },
  { type: 'koan', text: '∴ The streak is a story you tell. The log is what happened.' },
  { type: 'koan', text: '∴ You are not behind. There is no schedule. There is only the next action.' },
  { type: 'koan', text: '∴ What you just did cannot be undone. This is the only direction.' },
  { type: 'glitch', text: '▓▓▓ SIGNAL INTERCEPT ▓▓▓ — Someone is watching the watcher.' },
  { type: 'glitch', text: '▓▓▓ PATTERN MATCH ▓▓▓ — This exact sequence has occurred before. Check the date.' },
  { type: 'glitch', text: '▓▓▓ ECHO ▓▓▓ — The system remembers something you forgot.' },
  { type: 'prophecy', text: '⧫ Something is about to change. The data hasn\'t shown it yet, but the Tree can feel it.' },
  { type: 'prophecy', text: '⧫ A door is opening that you haven\'t noticed. It will be obvious by Sunday.' },
];

function rollQuestReward(qid, baseXp) {
  const seed = Math.abs((getDailySeed() ^ (qid.charCodeAt(0) * 7919 + qid.charCodeAt(1) * 104729)) >>> 0);
  const roll = seed % 100;

  if (roll < 70) return null; // 70% — nothing

  if (roll < 90) {
    // 20% — sensei one-liner from the oracle bank
    const senseiKey = getTodaySensei();
    const bank = ORACLE_BANK[senseiKey] || ORACLE_BANK.system;
    return { type: 'sensei', text: bank[seed % bank.length], senseiKey };
  }

  // 10% — rare drop
  const drop = RARE_DROPS[seed % RARE_DROPS.length];
  return { ...drop };
}

function queryOracle(input) {
  // Seed: daily hash XOR'd with input hash — same input + same day = same result
  const inputHash = input.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const seed = Math.abs(getDailySeed() ^ inputHash);

  // 60% silence
  if (seed % 10 < 6) return null;

  // Route to sensei category
  const senseiKey = routeToSensei(input);

  // Revived: prefer the context-aware voice() — it reads live domain scores and
  // branches on what was actually said, so the reply tracks your real state
  // instead of returning a fixed aphorism. Local-only (no API). Falls back to the
  // static oracle bank if voice() is unavailable or throws.
  const s = SENSEI[senseiKey];
  if (s && typeof s.voice === 'function') {
    try {
      const text = s.voice(input.toLowerCase());
      if (text) return { text, senseiKey };
    } catch (e) { /* fall through to the static bank */ }
  }

  const bank = ORACLE_BANK[senseiKey] || ORACLE_BANK.system;
  return { text: bank[seed % bank.length], senseiKey };
}

function routeToSensei(input) {
  const lower = input.toLowerCase();
  let best = null, bestScore = 0;
  for (const [key, s] of Object.entries(SENSEI)) {
    const score = s.triggers.filter(t => lower.includes(t)).length;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  if (!best || bestScore === 0) best = getTodaySensei();
  return best;
}

function getTodaySensei() {
  const seed = getDailySeed();
  const scores = calcDomainScores();
  const hod = scores.hod ? scores.hod.pct : 0;
  const geb = scores.geburah ? scores.geburah.pct : 0;
  const keys = Object.keys(SENSEI);
  if (hod < 15) return 'leviathan';
  if (geb < 15) return 'asclepius';
  return keys[seed % keys.length];
}

function systemAnalysis() {
  const scores = calcDomainScores();
  const hod = scores.hod ? scores.hod.pct : 0;
  const geb = scores.geburah ? scores.geburah.pct : 0;
  const coherence = calcCoherence();
  const activeCount = Object.values(scores).filter(s => s.pct > 0).length;
  if (hod === 0 && geb === 0) return "<strong>System baseline: zero.</strong> All major domains are dark. The only action that matters is the first log. Pick one quest, any domain, and complete it.";
  if (hod === 0) return "<strong>Hod is dark. The gate is closed.</strong> The dissertation domain shows no logged signal in 7 days. Until Hod accumulates, all other domain progress is bounded. Complete one Hod quest today.";
  if (hod > 60 && geb < 20) return "<strong>Hod burns, Geburah sleeps.</strong> Intellectual output is high but the body is unattended. Left pillar imbalance. Physical neglect creates cognitive degradation in the medium term.";
  if (coherence > 60) return "<strong>Coherence is building.</strong> Multi-domain signal detected. The internal model is forming. The Yetzirah threshold is approaching.";
  return "<strong>Signal assessment ongoing.</strong> " + activeCount + " domains active. Coherence: " + Math.round(coherence) + "%. Pattern recognition requires 7+ days of consistent logging.";
}


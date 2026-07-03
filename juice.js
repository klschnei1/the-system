// ═══════════════════════════════════════════════════════════════════════
// juice.js — shared sensory feedback module (cold_harbor/juice.md, Tier 1)
// Ported from the confirmed mockups: prototypes/log-juice-mockup.html (reveal,
// ghost, rollup, voices) + prototypes/unlock-juice-mockup.html (seal-break).
//
// Contract (juice.md):
//   window.juice = { rollup, reveal, ghost, playLogMoment, sealBreak,
//                    tick, thud, chime, rare, setMode }
// - All audio synthesized, zero assets. Master gain ~0.15 — textures, not
//   notifications.
// - Mode from data.settings.juice ('full'|'quiet'|'off') via DataStore.
//   'quiet' = visuals only. prefers-reduced-motion degrades to instant text.
// - NEVER gates a data write — callers save first, then play.
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── TUNING — every felt constant in one place (evolves with Karl) ──────
  const TUNE = {
    rollupMs: 600,
    ghostMs: 550,
    reelClean: 500,    // "nothing" settles fast — most logs feel clean/quick
    reelHit: 1400,     // sensei / rare / near-miss get the long deceleration
    masterGain: 0.15,
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mode() {
    try { return (window.data && data.settings && data.settings.juice) || 'full'; }
    catch (e) { return 'full'; }
  }
  function setMode(m) {
    if (!window.data) return;
    if (!data.settings) data.settings = {};
    data.settings.juice = m;
    if (typeof saveData === 'function') saveData();
  }
  const visualsOn = () => mode() !== 'off';
  const audioOn = () => mode() === 'full';

  // ── AUDIO — lazy AudioContext, unlocked by first gesture (iOS) ─────────
  let AC = null;
  function ctx() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  document.addEventListener('pointerdown', ctx, { once: true });

  function voice(fn) { if (audioOn()) { try { const a = ctx(); if (a) fn(a); } catch (e) {} } }
  function env(a, gain, t0, dur) {
    const g = a.createGain();
    g.gain.setValueAtTime(gain * TUNE.masterGain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    g.connect(a.destination);
    return g;
  }
  function tick(i) {              // rising square blip per counted step
    voice(a => {
      const o = a.createOscillator(); o.type = 'square';
      o.frequency.value = 700 + (i || 0) * 55;
      o.connect(env(a, 0.35, a.currentTime, 0.05));
      o.start(); o.stop(a.currentTime + 0.05);
    });
  }
  function thud() {               // low sine drop — reel settles / mass lands
    voice(a => {
      const o = a.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, a.currentTime);
      o.frequency.exponentialRampToValueAtTime(55, a.currentTime + 0.12);
      o.connect(env(a, 1.6, a.currentTime, 0.16));
      o.start(); o.stop(a.currentTime + 0.16);
    });
  }
  function heavyThud() {          // seal-break floor hit (unlock mockup)
    voice(a => {
      const o = a.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(90, a.currentTime);
      o.frequency.exponentialRampToValueAtTime(38, a.currentTime + 0.28);
      o.connect(env(a, 4, a.currentTime, 0.28));
      o.start(); o.stop(a.currentTime + 0.3);
      noiseBurst(a, 0.13, 420, 2, false);
    });
  }
  function kachunk() {            // lock mechanism (unlock mockup)
    voice(a => {
      noiseBurst(a, 0.05, 3200, 1.2, true);
      const o = a.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(150, a.currentTime);
      o.frequency.exponentialRampToValueAtTime(70, a.currentTime + 0.12);
      o.connect(env(a, 1.8, a.currentTime, 0.12));
      o.start(); o.stop(a.currentTime + 0.12);
    });
  }
  function chime() {              // sensei — two soft sines a fifth apart
    voice(a => {
      [660, 990].forEach((f, i) => {
        const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        o.connect(env(a, 0.5, a.currentTime + i * 0.07, 0.35));
        o.start(a.currentTime + i * 0.07); o.stop(a.currentTime + i * 0.07 + 0.35);
      });
    });
  }
  function rare() {               // detuned saw chord + noise burst
    voice(a => {
      [110, 165, 221.5].forEach(f => {
        const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        o.connect(env(a, 0.7, a.currentTime, 0.5));
        o.start(); o.stop(a.currentTime + 0.5);
      });
      noiseBurst(a, 0.15, 8000, 0.9, false);
    });
  }
  function noiseBurst(a, dur, cut, peak, hp) {
    const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(); s.buffer = b;
    const f = a.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = cut;
    s.connect(f); f.connect(env(a, peak, a.currentTime, dur));
    s.start();
  }

  // ── STYLE (self-contained; no system.html CSS edits) ───────────────────
  const style = document.createElement('style');
  style.textContent = `
    #juiceFlash { position: fixed; inset: 0; background: var(--gold, #f4dc8c);
      opacity: 0; pointer-events: none; z-index: 150; }
    #juiceFlash.go { animation: juiceFlashFade 0.45s ease-out; }
    @keyframes juiceFlashFade { 0% { opacity: 0.35; } 100% { opacity: 0; } }
    body.juice-shake { animation: juiceShake 0.22s linear; }
    @keyframes juiceShake {
      0%,100% { transform: translate(0,0); } 20% { transform: translate(-5px,2px); }
      40% { transform: translate(4px,-3px); } 60% { transform: translate(-3px,-2px); }
      80% { transform: translate(3px,2px); } }
    body.juice-shake-heavy { animation: juiceShakeHeavy 0.36s cubic-bezier(.36,.07,.19,.97); }
    @keyframes juiceShakeHeavy {
      10%{transform:translate(-5px,3px)}20%{transform:translate(6px,-4px)}
      30%{transform:translate(-6px,3px)}40%{transform:translate(5px,2px)}
      50%{transform:translate(-4px,-3px)}60%{transform:translate(4px,2px)}
      70%{transform:translate(-3px,1px)}85%{transform:translate(2px,-1px)}100%{transform:translate(0,0)} }
    .juice-reveal { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
    .juice-reel-window { width: 44px; height: 44px; overflow: hidden; flex-shrink: 0;
      border: 1px solid var(--border, #23233a); background: rgba(0,0,0,0.35); position: relative; }
    .juice-reel-window::after { content: ''; position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(rgba(0,0,0,0.55) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.55) 100%); }
    .juice-reel { will-change: transform; }
    .juice-sym { height: 44px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .juice-sym.nothing { color: var(--text3, #5a5a72); }
    .juice-sym.sensei { color: var(--accent, #7c5cff); }
    .juice-sym.rare { color: var(--gold, #f4dc8c); }
    .juice-caption { font-size: 10px; color: var(--text3, #5a5a72); line-height: 1.5; flex: 1; min-width: 0; }
    .juice-caption b { color: var(--text, #e8e8f0); font-weight: normal; }
    .juice-rare-stamp { display: inline-block; color: var(--gold, #f4dc8c); font-size: 12px;
      font-weight: bold; animation: juiceStamp 0.3s ease-out; }
    @keyframes juiceStamp { 0% { transform: scale(2.4); opacity: 0; }
      60% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1); } }
    .juice-ghost { position: fixed; z-index: 140; font-size: 14px; font-weight: bold;
      color: var(--green, #4ade80); pointer-events: none; will-change: transform, opacity; }
    .juice-punch { animation: juicePunch 0.25s ease-out; }
    @keyframes juicePunch { 30% { transform: scale(1.35); color: var(--green, #4ade80); }
      100% { transform: scale(1); } }
    .juice-card-squash { animation: juiceCardSquash 0.18s ease-out; }
    @keyframes juiceCardSquash { 40% { transform: scale(0.965, 0.93); } 100% { transform: scale(1); } }
    #juiceSeal { position: fixed; inset: 0; z-index: 200; background: rgba(3,3,8,0.94);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.3s ease; }
    #juiceSeal.in { opacity: 1; }
    #juiceSeal .seal-stage { position: relative; width: 300px; height: 300px; }
    #juiceSeal .seal-title { margin-top: 18px; font-size: 14px; letter-spacing: 4px;
      text-transform: uppercase; opacity: 0; transition: opacity 0.8s ease; text-align: center; }
    #juiceSeal .seal-sub { margin-top: 8px; font-size: 9px; letter-spacing: 2px;
      color: var(--text3, #5a5a72); text-transform: uppercase; opacity: 0; transition: opacity 0.8s ease 0.4s; }
  `;
  document.head.appendChild(style);
  const flash = document.createElement('div');
  flash.id = 'juiceFlash';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(flash));

  // ── COUNTER ROLL-UP (shared; intake/finance fold in later, Tier 2) ─────
  // opts: { format: v => string, quietTicks: bool }
  function rollup(el, from, to, done, opts) {
    opts = opts || {};
    const fmt = opts.format || (v => String(v));
    if (!el || !visualsOn() || reduceMotion || from === to) {
      if (el) el.textContent = fmt(to);
      if (done) done(); return;
    }
    const t0 = performance.now(); let lastShown = from, steps = 0;
    (function frame(t) {
      const p = Math.min(1, (t - t0) / TUNE.rollupMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (to - from) * eased);
      if (v !== lastShown) { lastShown = v; el.textContent = fmt(v); if (!opts.quietTicks) tick(steps++); }
      if (p < 1) requestAnimationFrame(frame);
      else {
        el.textContent = fmt(to);
        el.classList.remove('juice-punch'); void el.offsetWidth; el.classList.add('juice-punch');
        if (done) done();
      }
    })(t0);
  }

  // ── +XP GHOST ──────────────────────────────────────────────────────────
  function ghost(fromEl, toEl, text, done) {
    if (!fromEl || !toEl || !visualsOn() || reduceMotion) { if (done) done(); return; }
    const f = fromEl.getBoundingClientRect(), t = toEl.getBoundingClientRect();
    const g = document.createElement('div');
    g.className = 'juice-ghost'; g.textContent = text;
    g.style.left = (f.left + f.width / 2) + 'px';
    g.style.top = f.top + 'px';
    document.body.appendChild(g);
    const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
    const dy = t.top - f.top;
    const t0 = performance.now();
    (function frame(now) {
      const p = Math.min(1, (now - t0) / TUNE.ghostMs);
      const e = 1 - Math.pow(1 - p, 2);
      g.style.transform = `translate(${dx * e}px, ${dy * e - Math.sin(p * Math.PI) * 30}px)`;
      g.style.opacity = p > 0.75 ? String(1 - (p - 0.75) / 0.25) : '1';
      if (p < 1) requestAnimationFrame(frame);
      else { g.remove(); if (done) done(); }
    })(t0);
  }

  // ── REVEAL REEL ────────────────────────────────────────────────────────
  // outcome: full rollQuestReward return — { type, roll, text?, multiplier? }.
  // Near-miss display DERIVES from the actual roll (juice.md honesty rule):
  //   roll 60–69 → passed ∴ ("N short of a signal"), 85–89 → passed ◈.
  const SYMS = { nothing: '◇', sensei: '∴', rare: '◈' };
  function reveal(outcome, anchorEl, done) {
    if (!visualsOn() || !anchorEl) { if (done) done(); return; }
    const roll = outcome.roll;
    const isRare = outcome.type === 'xp_multiplier' || outcome.type === 'koan'
      || outcome.type === 'glitch' || outcome.type === 'prophecy';
    const landKind = outcome.type === 'sensei' ? 'sensei' : isRare ? 'rare' : 'nothing';
    const nearMiss = landKind === 'nothing' && roll !== undefined
      ? (roll >= 85 && roll <= 89 ? { glyph: 'rare', away: 90 - roll, what: '◈' }
        : roll >= 60 && roll <= 69 ? { glyph: 'sensei', away: 70 - roll, what: 'a signal' } : null)
      : null;

    const wrap = document.createElement('div');
    wrap.className = 'juice-reveal';
    wrap.innerHTML = '<div class="juice-reel-window"><div class="juice-reel"></div></div>'
      + '<div class="juice-caption"></div>';
    anchorEl.appendChild(wrap);
    const reel = wrap.querySelector('.juice-reel');
    const cap = wrap.querySelector('.juice-caption');

    const strip = [];
    for (let i = 0; i < 14; i++) strip.push(['nothing', 'sensei', 'rare'][i % 3]);
    if (nearMiss) strip.push(nearMiss.glyph, 'nothing');
    else strip.push('nothing', landKind);
    reel.innerHTML = strip.map(k => `<div class="juice-sym ${k}">${SYMS[k]}</div>`).join('');

    const H = 44, dist = (strip.length - 1) * H;
    const dur = (landKind === 'nothing' && !nearMiss) ? TUNE.reelClean : TUNE.reelHit;

    function settle() {
      thud();
      if (landKind === 'sensei') {
        chime();
        typewrite(cap, outcome.text || '∴');
      } else if (landKind === 'rare') {
        rare();
        if (!reduceMotion) {
          document.body.classList.remove('juice-shake'); void document.body.offsetWidth;
          document.body.classList.add('juice-shake');
          flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        }
        cap.innerHTML = `<span class="juice-rare-stamp">${outcome.text || '◈ RARE DROP'}</span>`;
      } else if (nearMiss) {
        cap.innerHTML = `no drop. <b>${nearMiss.what === '◈' ? '◈ was ' + nearMiss.away + ' away.' : nearMiss.away + ' short of a signal.'}</b>`;
      } else {
        cap.textContent = 'no drop.';
        setTimeout(() => { wrap.style.transition = 'opacity 0.6s'; wrap.style.opacity = '0.35'; }, 2000);
      }
      if (done) done();
    }

    if (reduceMotion) { reel.style.transform = `translateY(${-dist}px)`; settle(); return; }
    const t0 = performance.now(); let lastRow = 0;
    (function frame(t) {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      reel.style.transform = `translateY(${-dist * e}px)`;
      const row = Math.floor(dist * e / H);
      if (row !== lastRow) { lastRow = row; if (row % 2 === 0) tick(4); }
      if (p < 1) requestAnimationFrame(frame);
      else settle();
    })(t0);
  }
  function typewrite(el, text) {
    if (reduceMotion) { el.textContent = text; return; }
    el.textContent = ''; let i = 0;
    (function step() {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, 16);
    })();
  }

  // ── THE LOG MOMENT (Tier-1 choreography, juice.md sequence rule) ───────
  // Caller has ALREADY written + saved data and re-rendered. The reveal owns
  // the thunder: reveal settles → ghost carries the revealed amount → tally
  // rolls up old→new. Header tally is held at the old value until payout.
  // args: { qid, reward, total, prevToday, newToday }
  function playLogMoment(args) {
    const tallyEl = document.getElementById('todayXp');
    const fmt = v => '+' + v + ' today';
    if (tallyEl) tallyEl.textContent = fmt(args.prevToday);   // hold back until reveal pays out
    const card = document.getElementById('log-' + args.qid);
    const anchor = card ? card.closest('.quest-card') : null;
    const finish = () => {
      ghost(anchor || tallyEl, tallyEl, '+' + args.total + ' XP', () => {
        rollup(tallyEl, args.prevToday, args.newToday, null, { format: fmt });
      });
    };
    if (!anchor || !visualsOn()) {           // no visible card (edge path) — pay out directly
      if (tallyEl) tallyEl.textContent = fmt(args.newToday);
      return;
    }
    // Press-squash beat (mockup fidelity): the card absorbs the press as the
    // reveal opens. The original button is gone by now (re-render), so the
    // card is the persistent body that takes the impact.
    if (!reduceMotion) {
      anchor.classList.remove('juice-card-squash'); void anchor.offsetWidth;
      anchor.classList.add('juice-card-squash');
    }
    reveal(args.reward, anchor, finish);
  }

  // ── SEAL-BREAK (ported from unlock-juice-mockup REV 2) ─────────────────
  // Fullscreen: heavy chain + brass lock → kachunk, shackle pops → the whole
  // assembly DROPS → heavy thud + shake + ash → "{NAME} · UNLOCKED".
  // Data is already written by the caller; this is pure ceremony.
  function sealBreak(name, color, done) {
    if (!visualsOn() || reduceMotion) {
      if (typeof notify === 'function') notify('◈ ' + name.toUpperCase() + ' — SEAL BROKEN. The instrument is yours.', 8000);
      if (done) done(); return;
    }
    const ov = document.createElement('div');
    ov.id = 'juiceSeal';
    ov.innerHTML = `
      <div class="seal-stage">
        <div class="seal-assembly" style="position:absolute;inset:0;will-change:transform">
          <svg viewBox="0 0 280 280" width="100%" height="100%" style="overflow:visible">
            <defs>
              <linearGradient id="jsMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4d5e0"/><stop offset="0.34" stop-color="#9092a0"/><stop offset="0.63" stop-color="#54545f"/><stop offset="1" stop-color="#23232c"/></linearGradient>
              <linearGradient id="jsBrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4dc8c"/><stop offset="0.42" stop-color="#cba94e"/><stop offset="1" stop-color="#6a5620"/></linearGradient>
            </defs>
            <g class="seal-chains"></g>
            <g transform="translate(140 140) scale(1.18)">
              <ellipse cx="2" cy="40" rx="30" ry="7" fill="#000" opacity="0.4"/>
              <g class="seal-shackle" style="transform-origin:0px -18px;transition:transform .26s cubic-bezier(.34,1.7,.5,1)"><path d="M-21 -6 V-27 a21 21 0 0 1 42 0 V-6" fill="none" stroke="url(#jsBrass)" stroke-width="11" stroke-linecap="round"/></g>
              <rect x="-28" y="-12" width="56" height="50" rx="9" fill="url(#jsBrass)" stroke="#4a3c14" stroke-width="2.5"/>
              <rect x="-24" y="-9" width="48" height="14" rx="6" fill="#fbe6a8" opacity="0.28"/>
              <circle cx="0" cy="10" r="6.5" fill="#3a2e0e"/>
              <rect x="-2.8" y="12" width="5.6" height="15" rx="2.4" fill="#3a2e0e"/>
            </g>
          </svg>
        </div>
        <canvas class="seal-ash" width="300" height="300" style="position:absolute;inset:0;pointer-events:none"></canvas>
      </div>
      <div class="seal-title" style="color:${color}">${name} · Unlocked</div>
      <div class="seal-sub">the seal is broken — tap to enter</div>`;
    document.body.appendChild(ov);

    // heavy chain, corner to corner both ways (mockup link-builder, string form)
    (function () {
      const NS = 'http://www.w3.org/2000/svg', g = ov.querySelector('.seal-chains');
      function chain(x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy),
          a = Math.atan2(dy, dx) * 180 / Math.PI, n = Math.round(len / 15);
        let s = '';
        for (let i = 0; i <= n; i++) {
          const t = i / n, edge = i % 2, L = 36, H = edge ? 12 : 24;
          s += `<g transform="translate(${x1 + dx * t} ${y1 + dy * t}) rotate(${a})">`
            + `<rect x="${-L / 2}" y="${-H / 2}" width="${L}" height="${H}" rx="${H / 2}" fill="none" stroke="#07070c" stroke-width="${edge ? 12 : 16}"/>`
            + `<rect x="${-L / 2}" y="${-H / 2}" width="${L}" height="${H}" rx="${H / 2}" fill="none" stroke="url(#jsMetal)" stroke-width="${edge ? 8 : 11}"/>`
            + `</g>`;
        }
        g.innerHTML += s;
      }
      chain(2, 8, 278, 272); chain(278, 8, 2, 272);
    })();

    const assembly = ov.querySelector('.seal-assembly');
    const shackle = ov.querySelector('.seal-shackle');
    const cvs = ov.querySelector('.seal-ash'), c2d = cvs.getContext('2d');
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function ash(cx, cy) {
      const parts = [];
      for (let i = 0; i < 150; i++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 0.5 + Math.random() * 2.6,
          ember = Math.random() < 0.18;
        parts.push({ x: cx + (Math.random() - 0.5) * 120, y: cy + (Math.random() - 0.5) * 26,
          vx: Math.cos(ang) * sp + (Math.random() - 0.5) * 1.2, vy: Math.sin(ang) * sp - 0.4,
          life: 1, decay: 0.006 + Math.random() * 0.012, sz: 1 + Math.random() * 3,
          col: ember ? [232, 104, 60] : [140, 140, 150] });
      }
      (function step() {
        c2d.clearRect(0, 0, cvs.width, cvs.height);
        let alive = 0;
        for (const p of parts) {
          if (p.life <= 0) continue; alive++;
          p.vy += 0.018; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
          c2d.globalAlpha = Math.max(0, p.life);
          c2d.fillStyle = `rgb(${p.col[0]},${p.col[1]},${p.col[2]})`;
          c2d.fillRect(p.x, p.y, p.sz, p.sz);
        }
        c2d.globalAlpha = 1;
        if (alive > 0 && document.body.contains(ov)) requestAnimationFrame(step);
      })();
    }

    (async function () {
      requestAnimationFrame(() => ov.classList.add('in'));
      await sleep(700);
      kachunk();
      shackle.style.transform = 'translateY(-13px) rotate(34deg)';
      await sleep(400);
      assembly.style.transition = 'transform .44s cubic-bezier(.55,0,.85,.42)';
      assembly.style.transform = 'translateY(320px) rotate(15deg)';
      await sleep(430);
      heavyThud();
      document.body.classList.add('juice-shake-heavy');
      await sleep(380);
      document.body.classList.remove('juice-shake-heavy');
      assembly.style.transition = 'opacity .18s ease'; assembly.style.opacity = '0';
      ash(150, 200);
      await sleep(300);
      ov.querySelector('.seal-title').style.opacity = '1';
      ov.querySelector('.seal-sub').style.opacity = '1';
      ov.addEventListener('click', function close() {
        ov.style.opacity = '0';
        setTimeout(() => { ov.remove(); if (done) done(); }, 320);
      }, { once: true });
    })();
  }

  window.juice = { rollup, reveal, ghost, playLogMoment, sealBreak, tick, thud, chime, rare, setMode };
})();

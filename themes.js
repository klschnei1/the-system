// ── THEME ENGINE ─────────────────────────────────────────────────────
const THEME_BANK = [
  {
    id: 'protocol',
    name: 'PROTOCOL STANDARD',
    description: 'Default configuration. Sacred geometry. Clean.',
    palette: {
      '--bg': '#07070f', '--bg2': '#0d0d1a', '--bg3': '#111128',
      '--border': '#1e1e3a', '--text': '#d8d8f0', '--text2': '#7878aa', '--text3': '#4444aa',
      '--gold': '#c9a84c', '--teal': '#2dd4bf', '--red': '#e05555', '--green': '#4ade80',
    },
    font: { family: "'Courier New', monospace", titleTransform: 'uppercase', letterSpacing: '4px' },
    container: { borderStyle: 'solid', borderWidth: '1px', borderRadius: '4px' },
    background: { overlay: null, bodyFilter: null },
    animation: { pulseSpeed: '1.5s', transitionSpeed: '0.2s', injectedKeyframes: null },
    sigil: { style: 'geometric' },
    mutations: { tabLabels: null, tabOrder: null, hideAnchors: false, hideTiers: false, hideDailyXp: false, hideDomainNames: false, headerGlitch: false }
  },
  {
    id: 'surveillance',
    name: 'SURVEILLANCE STATE',
    description: 'Terminal green. Scanlines. You are being watched.',
    palette: {
      '--bg': '#000000', '--bg2': '#0a0a0a', '--bg3': '#0f0f0f',
      '--border': '#003300', '--text': '#00ff41', '--text2': '#00aa2a', '--text3': '#005500',
      '--gold': '#00ff41', '--teal': '#00ff41', '--red': '#ff0000', '--green': '#00ff41',
      '--accent': '#00ff41', '--accent2': '#00cc33',
      '--glow-accent': '0 0 30px rgba(0,255,65,0.3)',
      '--hod': '#00ff41', '--geburah': '#ff0000', '--chesed': '#00ff41',
      '--malkuth': '#00aa2a', '--yesod': '#00cc33', '--binah': '#00ff41',
      '--netzach': '#00ff41', '--pillar': '#00ff41',
    },
    font: { family: "'Courier New', monospace", titleTransform: 'uppercase', letterSpacing: '6px' },
    container: { borderStyle: 'solid', borderWidth: '1px', borderRadius: '0px' },
    background: {
      overlay: 'scanlines',
      bodyFilter: null
    },
    animation: {
      pulseSpeed: '0.8s',
      transitionSpeed: '0.1s',
      injectedKeyframes: `
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        @keyframes glitch { 0%,86%,100% { text-shadow:none; filter:none; } 87% { text-shadow:-3px 0 #ff003c, 3px 0 #00ffff; filter:brightness(1.3); } 88% { text-shadow:3px 0 #ff003c, -3px 0 #00ffff; } 89% { text-shadow:-1px 0 #ff003c, 1px 0 #00ffff; filter:brightness(1.1); } 90% { text-shadow:none; filter:none; } 94% { text-shadow:-2px 0 #ff003c, 2px 0 #00ffff; } 95% { text-shadow:none; } }
        @keyframes flicker { 0%,100% { opacity:1; } 92% { opacity:1; } 93% { opacity:0.8; } 94% { opacity:1; } 97% { opacity:0.9; } 98% { opacity:1; } }
      `
    },
    sigil: { style: 'circuit' },
    mutations: {
      tabLabels: { quests:'SUBJECTS', tree:'NETWORK', transmit:'INTERCEPT' },
      tabOrder: null,
      hideAnchors: true,
      hideTiers: false,
      hideDailyXp: false,
      headerGlitch: true
    }
  },
  {
    id: 'laboratory',
    name: 'THE LABORATORY',
    description: 'Alchemical. Parchment tones. Double borders. Planetary symbols.',
    palette: {
      '--bg': '#1a1610', '--bg2': '#211d15', '--bg3': '#2a2519',
      '--border': '#4a3f2a', '--text': '#d4c9a8', '--text2': '#9e8e6a', '--text3': '#6b5d3f',
      '--gold': '#c9a84c', '--teal': '#8faa6e', '--red': '#a0522d', '--green': '#8faa6e',
      '--accent': '#c9a84c', '--accent2': '#a08030',
      '--glow-accent': '0 0 20px rgba(201,168,76,0.25)',
      '--hod': '#c9a84c', '--geburah': '#a0522d', '--chesed': '#8faa6e',
      '--malkuth': '#6b5d3f', '--yesod': '#7b68ae', '--binah': '#5a7a9a',
      '--netzach': '#c9a84c', '--pillar': '#d4c9a8',
    },
    font: { family: "'Georgia', 'Times New Roman', serif", titleTransform: 'uppercase', letterSpacing: '3px' },
    container: { borderStyle: 'double', borderWidth: '3px', borderRadius: '2px' },
    background: { overlay: 'noise', bodyFilter: 'sepia(0.08)' },
    animation: {
      pulseSpeed: '2.5s',
      transitionSpeed: '0.4s',
      injectedKeyframes: `
        @keyframes candleflicker { 0%,100% { opacity:1; } 50% { opacity:0.92; } 75% { opacity:0.97; } }
      `
    },
    sigil: { style: 'alchemical' },
    mutations: {
      tabLabels: { quests:'OPUS', tree:'ARBOR', transmit:'ORACLE' },
      tabOrder: null,
      hideAnchors: false,
      hideTiers: false,
      hideDailyXp: false,
      hideDomainNames: false,
      headerGlitch: false
    }
  },
  {
    id: 'viscera',
    name: 'VISCERA',
    description: 'Biological. Bioluminescent teal. Breathing. Sigils only.',
    palette: {
      '--bg': '#050e0e', '--bg2': '#0a1414', '--bg3': '#0f1a1a',
      '--border': '#0f3333', '--text': '#a0d4d4', '--text2': '#5a9e9e', '--text3': '#2a6666',
      '--gold': '#2dd4bf', '--teal': '#2dd4bf', '--red': '#ff6b6b', '--green': '#4ade80',
      '--accent': '#2dd4bf', '--accent2': '#0fa89a',
      '--glow-accent': '0 0 30px rgba(45,212,191,0.2)',
      '--hod': '#2dd4bf', '--geburah': '#ff6b6b', '--chesed': '#4ade80',
      '--malkuth': '#5a9e9e', '--yesod': '#a78bfa', '--binah': '#60a5fa',
      '--netzach': '#f0abfc', '--pillar': '#2dd4bf',
    },
    font: { family: "'Courier New', monospace", titleTransform: 'lowercase', letterSpacing: '2px' },
    container: { borderStyle: 'solid', borderWidth: '1px', borderRadius: '20px' },
    background: { overlay: 'breathing', bodyFilter: null },
    animation: {
      pulseSpeed: '3s',
      transitionSpeed: '0.5s',
      injectedKeyframes: `
        @keyframes breathe { 0%,100% { opacity:0.03; } 50% { opacity:0.08; } }
        @keyframes cellpulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.02); } }
      `
    },
    sigil: { style: 'geometric' },
    mutations: {
      tabLabels: null,
      tabOrder: ['tree','quests','transmit'],
      hideAnchors: false,
      hideTiers: false,
      hideDailyXp: false,
      hideDomainNames: true,
      headerGlitch: false
    }
  },
  {
    id: 'dead_signal',
    name: 'DEAD SIGNAL',
    description: 'Vaporwave. Hot pink/purple. Dashed borders. VHS drift.',
    palette: {
      '--bg': '#0a0012', '--bg2': '#100018', '--bg3': '#180025',
      '--border': '#3a0060', '--text': '#e0c0ff', '--text2': '#a060d0', '--text3': '#6030a0',
      '--gold': '#ff6ec7', '--teal': '#00ffff', '--red': '#ff0066', '--green': '#00ff99',
      '--accent': '#ff6ec7', '--accent2': '#c050ff',
      '--glow-accent': '0 0 30px rgba(255,110,199,0.3)',
      '--hod': '#ff6ec7', '--geburah': '#ff0066', '--chesed': '#00ffff',
      '--malkuth': '#a060d0', '--yesod': '#c050ff', '--binah': '#00ffff',
      '--netzach': '#ff6ec7', '--pillar': '#ffff00',
    },
    font: { family: "'Courier New', monospace", titleTransform: 'uppercase', letterSpacing: '5px' },
    container: { borderStyle: 'dashed', borderWidth: '1px', borderRadius: '0px' },
    background: { overlay: 'vhs', bodyFilter: null },
    animation: {
      pulseSpeed: '1s',
      transitionSpeed: '0.15s',
      injectedKeyframes: `
        @keyframes vhsdrift { 0% { transform:translateX(0); } 25% { transform:translateX(-1px); } 50% { transform:translateX(1px); } 75% { transform:translateX(-0.5px); } 100% { transform:translateX(0); } }
        @keyframes chromatic { 0%,100% { text-shadow: -1px 0 #ff0066, 1px 0 #00ffff; } 50% { text-shadow: -2px 0 #ff0066, 2px 0 #00ffff; } }
        @keyframes staticnoise { 0% { opacity:0.03; } 50% { opacity:0.06; } 100% { opacity:0.03; } }
      `
    },
    sigil: { style: 'geometric' },
    mutations: {
      tabLabels: { quests:'RITUALS', tree:'MEMORY', codex:'ARCHIVE', transmit:'CHANNEL', system:'VOID' },
      tabOrder: null,
      hideAnchors: false,
      hideTiers: false,
      hideDailyXp: true,
      hideDomainNames: false,
      headerGlitch: false
    }
  },
  {
    id: 'black_iron',
    name: 'BLACK IRON PRISON',
    description: 'Gnostic. Blood red on iron dark. Heavy borders. No mercy.',
    palette: {
      '--bg': '#0a0505', '--bg2': '#120808', '--bg3': '#1a0c0c',
      '--border': '#3a1515', '--text': '#c8a0a0', '--text2': '#8a5555', '--text3': '#5a2a2a',
      '--gold': '#8b0000', '--teal': '#c8a0a0', '--red': '#ff0000', '--green': '#8b0000',
      '--accent': '#8b0000', '--accent2': '#660000',
      '--glow-accent': '0 0 20px rgba(139,0,0,0.3)',
      '--hod': '#c8a0a0', '--geburah': '#ff0000', '--chesed': '#8b0000',
      '--malkuth': '#5a2a2a', '--yesod': '#8a5555', '--binah': '#660000',
      '--netzach': '#8b0000', '--pillar': '#c8a0a0',
    },
    font: { family: "'Courier New', monospace", titleTransform: 'uppercase', letterSpacing: '6px' },
    container: { borderStyle: 'solid', borderWidth: '2px', borderRadius: '0px' },
    background: { overlay: 'noise', bodyFilter: null },
    animation: {
      pulseSpeed: '0s',
      transitionSpeed: '0s',
      injectedKeyframes: `
        @keyframes ironpulse { 0%,100% { border-color: #3a1515; } 50% { border-color: #5a2020; } }
      `
    },
    sigil: { style: 'geometric' },
    mutations: {
      tabLabels: { quests:'LABOR', tree:'SCHEMA', transmit:'PETITION' },
      tabOrder: ['quests','tree','transmit'],
      hideAnchors: false,
      hideTiers: true,
      hideDailyXp: false,
      hideDomainNames: false,
      headerGlitch: false
    }
  }
];
// ── THEME TEMPLATE ──────────────────────────────────────────────────
// Copy this object into THEME_BANK to create a new theme.
// All fields required. Add matching [data-theme="your_id"] CSS rules
// and @keyframes if your animation.injectedKeyframes references them.
//
// {
//   id: 'your_id',           // lowercase, underscores OK, used in data-theme attr
//   name: 'DISPLAY NAME',    // shown nowhere yet, but identifies the theme
//   description: 'One-line vibe description',
//   palette: {
//     '--bg': '#07070f', '--bg2': '#0d0d1a', '--bg3': '#111128',
//     '--border': '#1e1e3a', '--accent': '#5b6fff', '--accent2': '#9b5de5',
//     '--gold': '#c9a84c', '--teal': '#2dd4bf', '--red': '#e05555',
//     '--green': '#4ade80', '--text': '#d8d8f0', '--text2': '#7878aa', '--text3': '#4444aa'
//   },
//   font: { family: "'Courier New', monospace", titleTransform: 'uppercase', letterSpacing: '4px' },
//   container: { borderStyle: 'solid', borderWidth: '1px', borderRadius: '4px' },
//   background: { overlay: 'none', bodyFilter: 'none' },  // overlay: 'scanlines'|'noise'|'breathing'|'vhs'|'none'
//   animation: { pulseSpeed: '2s', transitionSpeed: '0.3s', injectedKeyframes: '' },
//   sigil: { style: 'geometric' },  // 'geometric'|'alchemical'|'circuit' (or future: organic, runic, genomic)
//   mutations: {
//     tabLabels: null,        // or { quests:'LABEL', tree:'LABEL', transmit:'LABEL' }
//     tabOrder: null,         // or ['quests','tree','transmit'] — DOM reorder
//     hideAnchors: false,     // hide domain anchor text
//     hideTiers: false,       // hide tier badges
//     hideDailyXp: false,     // hide daily XP tally
//     hideDomainNames: false, // hide domain names (sigils only)
//     headerGlitch: false     // glitch animation on header text
//   }
// }

// Avalanche mix (mix32): consecutive daily seeds differ by ~1, which made
// `seed % 6` walk a predictable cycle. Mixing diffuses that 1-bit delta across
// all bits, so the theme is unguessable day-to-day but still stable within a day
// (same date → same seed → same theme; survives reloads).
function mix32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

function applyDailyTheme() {
  const seed = getDailySeed();
  const theme = THEME_BANK[mix32(seed) % THEME_BANK.length];
  const root = document.documentElement;

  // Apply palette mood (preserve PALETTE_MOODS rotation within theme)
  const mood = PALETTE_MOODS[seed % PALETTE_MOODS.length];
  root.style.setProperty('--accent', mood.accent);
  root.style.setProperty('--accent2', mood.accent2);
  root.style.setProperty('--glow-accent', `0 0 30px ${mood.glow}`);

  // Apply theme palette (overrides mood for themes with explicit accent)
  Object.entries(theme.palette).forEach(([prop, val]) => {
    root.style.setProperty(prop, val);
  });

  // Typography
  root.style.setProperty('--font-family', theme.font.family);
  root.style.setProperty('--title-transform', theme.font.titleTransform);
  root.style.setProperty('--letter-spacing', theme.font.letterSpacing);

  // Container
  root.style.setProperty('--border-style', theme.container.borderStyle);
  root.style.setProperty('--border-width', theme.container.borderWidth);
  root.style.setProperty('--border-radius', theme.container.borderRadius);

  // Store for other functions
  window._currentTheme = theme;

  // Global PAPER (light mode) suppresses the daily mood theme's DARK shell:
  // no [data-theme] component hardcodes, no dark body filter/overlay. The day's
  // accent + typography still apply; surfaces come from the paper palette
  // (system.html body[data-appearance="paper"]). Night = the full mood theme.
  if (document.body.dataset.appearance === 'paper') {
    delete document.body.dataset.theme;
    document.body.style.filter = '';
    const overlay = document.getElementById('theme-overlay');
    if (overlay) overlay.remove();
  } else {
    document.body.dataset.theme = theme.id;   // activate [data-theme] CSS
    applyThemeBackground(theme);
    applyThemeAnimations(theme);
    applyThemeMutations(theme);
  }
  applyWatermarkSigil(seed);

  return mood;
}

function applyThemeBackground(theme) {
  // Remove existing overlay
  const existing = document.getElementById('theme-overlay');
  if (existing) existing.remove();

  if (theme.background.overlay) {
    const overlay = document.createElement('div');
    overlay.id = 'theme-overlay';
    const base = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';

    if (theme.background.overlay === 'scanlines') {
      overlay.style.cssText = base + `
        background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.03) 2px, rgba(0,255,65,0.03) 4px);
      `;
    } else if (theme.background.overlay === 'noise') {
      overlay.style.cssText = base + `
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
        background-repeat: repeat; background-size: 256px 256px;
      `;
    } else if (theme.background.overlay === 'breathing') {
      overlay.style.cssText = base + `
        background: radial-gradient(ellipse at 50% 50%, rgba(45,212,191,0.06) 0%, transparent 70%);
        animation: breathe 6s ease-in-out infinite;
      `;
    } else if (theme.background.overlay === 'vhs') {
      overlay.style.cssText = base + `
        background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,110,199,0.015) 3px, rgba(255,110,199,0.015) 4px),
          repeating-linear-gradient(90deg, transparent, transparent 100px, rgba(0,255,255,0.01) 100px, rgba(0,255,255,0.01) 101px);
        animation: staticnoise 3s ease-in-out infinite;
      `;
    }

    document.body.appendChild(overlay);
  }

  if (theme.background.bodyFilter) {
    document.body.style.filter = theme.background.bodyFilter;
  } else {
    document.body.style.filter = '';
  }
}

function applyThemeAnimations(theme) {
  // Remove existing injected styles
  const existing = document.getElementById('theme-keyframes');
  if (existing) existing.remove();

  if (theme.animation.injectedKeyframes) {
    const style = document.createElement('style');
    style.id = 'theme-keyframes';
    style.textContent = theme.animation.injectedKeyframes;
    document.head.appendChild(style);
  }
}

function applyThemeMutations(theme) {
  const m = theme.mutations;

  const defaultKeys = ['quests','tree','transmit'];
  const defaultLabels = ['Quests','Tree','Signal'];
  const tabsContainer = document.querySelector('.tabs');
  const tabs = Array.from(tabsContainer.querySelectorAll('.tab'));

  // Tab reordering — rearrange DOM nodes to match tabOrder
  if (m.tabOrder) {
    const tabsByKey = {};
    defaultKeys.forEach((key, i) => { tabsByKey[key] = tabs[i]; });
    m.tabOrder.forEach(key => {
      if (tabsByKey[key]) tabsContainer.appendChild(tabsByKey[key]);
    });
  } else {
    // Restore default order
    defaultKeys.forEach((_, i) => { tabsContainer.appendChild(tabs[i]); });
  }

  // Tab relabeling (after reorder so labels match keys, not positions)
  const allTabs = tabsContainer.querySelectorAll('.tab');
  if (m.tabLabels) {
    // Map onclick to key
    allTabs.forEach(tab => {
      const onclick = tab.getAttribute('onclick') || '';
      const match = onclick.match(/switchTab\('(\w+)'\)/);
      if (match) {
        const key = match[1];
        const defaultIdx = defaultKeys.indexOf(key);
        tab.textContent = m.tabLabels[key] || defaultLabels[defaultIdx] || tab.textContent;
      }
    });
  } else {
    allTabs.forEach(tab => {
      const onclick = tab.getAttribute('onclick') || '';
      const match = onclick.match(/switchTab\('(\w+)'\)/);
      if (match) {
        const idx = defaultKeys.indexOf(match[1]);
        if (idx >= 0) tab.textContent = defaultLabels[idx];
      }
    });
  }

  // Hide domain anchors
  document.body.classList.toggle('hide-anchors', !!m.hideAnchors);

  // Hide tier labels
  document.body.classList.toggle('hide-tiers', !!m.hideTiers);

  // Hide daily XP tally
  document.body.classList.toggle('hide-daily-xp', !!m.hideDailyXp);

  // Hide domain names (sigils only)
  document.body.classList.toggle('hide-domain-names', !!m.hideDomainNames);

  // Header glitch
  const header = document.querySelector('.system-title');
  if (header) {
    header.classList.toggle('glitch-text', !!m.headerGlitch);
  }
}

function applyWatermarkSigil(seed) {
  const existing = document.getElementById('watermark-sigil');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'watermark-sigil';
  wrapper.innerHTML = SigilEngine.watermark(seed);
  document.body.appendChild(wrapper);
}

// Legacy alias


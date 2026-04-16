// ── SIGIL ENGINE ─────────────────────────────────────────────────────
// ── SIGIL MANIFEST — user art priority over procedural ─────────────
// Stores loaded user SVGs keyed by domain: { hod: ['<svg>...'], geburah: ['<svg>...', '<svg>...'] }
const _sigilManifest = {};

async function loadSigilManifest() {
  const domains = ['hod','geburah','malkuth','yesod','chesed','binah','netzach','pillar','chokmah'];
  const basePath = 'sigils/';

  for (const domain of domains) {
    // Try primary: {domain}.svg
    try {
      const resp = await fetch(basePath + domain + '.svg');
      if (resp.ok) {
        const svg = await resp.text();
        if (svg.trim().startsWith('<svg') || svg.trim().startsWith('<?xml')) {
          if (!_sigilManifest[domain]) _sigilManifest[domain] = [];
          _sigilManifest[domain].push(svg);
        }
      }
    } catch(e) { /* not found, skip */ }

    // Try variants: {domain}-2.svg through {domain}-9.svg
    for (let v = 2; v <= 9; v++) {
      try {
        const resp = await fetch(basePath + domain + '-' + v + '.svg');
        if (resp.ok) {
          const svg = await resp.text();
          if (svg.trim().startsWith('<svg') || svg.trim().startsWith('<?xml')) {
            if (!_sigilManifest[domain]) _sigilManifest[domain] = [];
            _sigilManifest[domain].push(svg);
          }
        } else { break; } // stop checking higher numbers if one is missing
      } catch(e) { break; }
    }
  }

  const loaded = Object.keys(_sigilManifest).length;
  if (loaded > 0) console.log(`[CSS] Sigil manifest: ${loaded} domain(s) with user art`);
}

const SigilEngine = {
  // Seeded PRNG (mulberry32)
  _rng(seed) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  // Generate a sigil SVG string for a domain (user art takes priority)
  generate(domainKey, seed, style) {
    const userArt = _sigilManifest[domainKey];
    if (userArt && userArt.length > 0) {
      // Pick variant deterministically by seed
      return userArt[seed % userArt.length];
    }
    const gen = this.generators[style] || this.generators.geometric;
    return gen.call(this, domainKey, seed);
  },

  // Get domain color from CSS custom property or data
  _domainColor(domainKey) {
    return getComputedStyle(document.documentElement).getPropertyValue('--' + domainKey).trim() || '#5b6fff';
  },

  generators: {
    // ── GEOMETRIC — sacred geometry, clean lines, circles + polygons
    geometric(domainKey, seed) {
      const rng = this._rng(seed);
      const color = this._domainColor(domainKey);
      const size = 32;
      const cx = size / 2, cy = size / 2;
      let paths = '';

      // Outer circle
      const outerR = 12 + rng() * 2;
      paths += `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.6"/>`;

      // Inner polygon (3-8 sides)
      const sides = 3 + Math.floor(rng() * 6);
      const innerR = 6 + rng() * 4;
      const rotation = rng() * Math.PI * 2;
      let polyPoints = '';
      for (let i = 0; i < sides; i++) {
        const angle = rotation + (i / sides) * Math.PI * 2;
        const px = cx + Math.cos(angle) * innerR;
        const py = cy + Math.sin(angle) * innerR;
        polyPoints += `${px},${py} `;
      }
      paths += `<polygon points="${polyPoints.trim()}" fill="none" stroke="${color}" stroke-width="0.7" opacity="0.5"/>`;

      // Center dot
      paths += `<circle cx="${cx}" cy="${cy}" r="${1 + rng() * 1.5}" fill="${color}" opacity="0.7"/>`;

      // Radiating lines (2-4)
      const numLines = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < numLines; i++) {
        const angle = rng() * Math.PI * 2;
        const r1 = innerR * 0.3;
        const r2 = outerR * 0.95;
        paths += `<line x1="${cx + Math.cos(angle) * r1}" y1="${cy + Math.sin(angle) * r1}"
                        x2="${cx + Math.cos(angle) * r2}" y2="${cy + Math.sin(angle) * r2}"
                        stroke="${color}" stroke-width="0.4" opacity="0.35"/>`;
      }

      // Small accent circles at polygon vertices (50% chance)
      if (rng() > 0.5) {
        for (let i = 0; i < sides; i++) {
          const angle = rotation + (i / sides) * Math.PI * 2;
          const px = cx + Math.cos(angle) * innerR;
          const py = cy + Math.sin(angle) * innerR;
          paths += `<circle cx="${px}" cy="${py}" r="1" fill="${color}" opacity="0.4"/>`;
        }
      }

      return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
    },

    // ── ALCHEMICAL — planetary symbols, triangles, crescents, crosses
    alchemical(domainKey, seed) {
      const rng = this._rng(seed);
      const color = this._domainColor(domainKey);
      const size = 32;
      const cx = size / 2, cy = size / 2;
      let paths = '';

      // Pick a base element shape
      const element = Math.floor(rng() * 5);

      if (element === 0) {
        // Fire triangle (upward)
        paths += `<polygon points="${cx},${cy - 11} ${cx - 9},${cy + 7} ${cx + 9},${cy + 7}" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.6"/>`;
        paths += `<line x1="${cx - 6}" y1="${cy + 1}" x2="${cx + 6}" y2="${cy + 1}" stroke="${color}" stroke-width="0.5" opacity="0.4"/>`;
      } else if (element === 1) {
        // Water triangle (downward)
        paths += `<polygon points="${cx},${cy + 11} ${cx - 9},${cy - 7} ${cx + 9},${cy - 7}" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.6"/>`;
        paths += `<line x1="${cx - 6}" y1="${cy - 1}" x2="${cx + 6}" y2="${cy - 1}" stroke="${color}" stroke-width="0.5" opacity="0.4"/>`;
      } else if (element === 2) {
        // Sun — circle with rays
        paths += `<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.6"/>`;
        paths += `<circle cx="${cx}" cy="${cy}" r="2" fill="${color}" opacity="0.5"/>`;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          paths += `<line x1="${cx + Math.cos(a) * 7}" y1="${cy + Math.sin(a) * 7}"
                          x2="${cx + Math.cos(a) * 11}" y2="${cy + Math.sin(a) * 11}"
                          stroke="${color}" stroke-width="0.5" opacity="0.4"/>`;
        }
      } else if (element === 3) {
        // Moon — crescent
        paths += `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${color}" stroke-width="0.7" opacity="0.5"/>`;
        paths += `<circle cx="${cx + 4}" cy="${cy}" r="7" fill="var(--bg)" stroke="none"/>`;
        // Cross below
        paths += `<line x1="${cx}" y1="${cy + 10}" x2="${cx}" y2="${cy + 14}" stroke="${color}" stroke-width="0.6" opacity="0.4"/>`;
        paths += `<line x1="${cx - 2}" y1="${cy + 12}" x2="${cx + 2}" y2="${cy + 12}" stroke="${color}" stroke-width="0.6" opacity="0.4"/>`;
      } else {
        // Mercury — circle + cross + horns
        paths += `<circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="${color}" stroke-width="0.7" opacity="0.6"/>`;
        paths += `<line x1="${cx}" y1="${cy + 5}" x2="${cx}" y2="${cy + 12}" stroke="${color}" stroke-width="0.6" opacity="0.5"/>`;
        paths += `<line x1="${cx - 3}" y1="${cy + 9}" x2="${cx + 3}" y2="${cy + 9}" stroke="${color}" stroke-width="0.6" opacity="0.5"/>`;
        // Horns on top
        paths += `<path d="M${cx - 4},${cy - 4} Q${cx - 6},${cy - 10} ${cx},${cy - 8} Q${cx + 6},${cy - 10} ${cx + 4},${cy - 4}" fill="none" stroke="${color}" stroke-width="0.6" opacity="0.5"/>`;
      }

      // Outer containment circle (60% chance)
      if (rng() > 0.4) {
        paths += `<circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="${color}" stroke-width="0.4" opacity="0.25" stroke-dasharray="2,2"/>`;
      }

      return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
    },

    // ── CIRCUIT — traces, nodes, right angles (for Surveillance State)
    circuit(domainKey, seed) {
      const rng = this._rng(seed);
      const color = this._domainColor(domainKey);
      const size = 32;
      let paths = '';

      // Grid nodes
      const nodes = [];
      const nodeCount = 4 + Math.floor(rng() * 4);
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x: 4 + Math.floor(rng() * 6) * 4,
          y: 4 + Math.floor(rng() * 6) * 4
        });
      }

      // Traces between nodes (right-angle paths)
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i], b = nodes[i + 1];
        // L-shaped path
        if (rng() > 0.5) {
          paths += `<polyline points="${a.x},${a.y} ${b.x},${a.y} ${b.x},${b.y}" fill="none" stroke="${color}" stroke-width="0.7" opacity="0.5"/>`;
        } else {
          paths += `<polyline points="${a.x},${a.y} ${a.x},${b.y} ${b.x},${b.y}" fill="none" stroke="${color}" stroke-width="0.7" opacity="0.5"/>`;
        }
      }

      // Node dots
      nodes.forEach(n => {
        paths += `<rect x="${n.x - 1.5}" y="${n.y - 1.5}" width="3" height="3" fill="${color}" opacity="0.6"/>`;
      });

      // Central chip
      const cx = 16, cy = 16;
      paths += `<rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.7"/>`;
      paths += `<rect x="${cx - 2}" y="${cy - 2}" width="4" height="4" fill="${color}" opacity="0.3"/>`;

      return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
    }
  },

  // Generate a large background watermark sigil
  watermark(seed) {
    const rng = this._rng(seed);
    const size = 300;
    const cx = size / 2, cy = size / 2;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5b6fff';
    let paths = '';

    // Large outer circle
    paths += `<circle cx="${cx}" cy="${cy}" r="140" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.04"/>`;

    // Nested inner circles
    for (let i = 1; i <= 3; i++) {
      const r = 40 + i * 30;
      paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="0.3" opacity="0.03"/>`;
    }

    // Large polygon
    const sides = 6 + Math.floor(rng() * 4);
    const polyR = 100 + rng() * 20;
    const rotation = rng() * Math.PI * 2;
    let polyPoints = '';
    for (let i = 0; i < sides; i++) {
      const angle = rotation + (i / sides) * Math.PI * 2;
      polyPoints += `${cx + Math.cos(angle) * polyR},${cy + Math.sin(angle) * polyR} `;
    }
    paths += `<polygon points="${polyPoints.trim()}" fill="none" stroke="${color}" stroke-width="0.4" opacity="0.03"/>`;

    // Cross lines through center
    paths += `<line x1="${cx}" y1="${cy - 140}" x2="${cx}" y2="${cy + 140}" stroke="${color}" stroke-width="0.3" opacity="0.025"/>`;
    paths += `<line x1="${cx - 140}" y1="${cy}" x2="${cx + 140}" y2="${cy}" stroke="${color}" stroke-width="0.3" opacity="0.025"/>`;

    return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80vmin;height:80vmin;pointer-events:none;z-index:0;opacity:1">${paths}</svg>`;
  }
};


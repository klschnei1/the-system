// ── INTELLECT DOMAIN (Hod) ────────────────────────────────────────────
// The PhD-tracking domain. UNLIKE the other domains, Intellect is NOT logged
// in-app — it is a READ-ONLY MIRROR of the LOCKED project (Karl's dissertation
// operating system). A deterministic parser there (intellect_pull.py) reads
// LOCKED's TASKS.md / LOCK.md / SCHEDULE.md / LAB_NOTEBOOK.md and emits
// intellect.json, which ships with the app. This widget fetches + renders it.
// Zero manual logging: the lab work tracks itself.
//
// Built-but-sealed: registered in DOMAIN_WIDGETS (so the gate reads "locked",
// not "unbuilt") but hod stays out of data.unlockedDomains until earned.

(function() {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Strip the markdown bold/inline-code noise the parser carries through from
  // LOCKED prose, so statuses read cleanly in the widget.
  function plain(s) {
    return String(s || '').replace(/\*\*/g, '').replace(/`/g, '').trim();
  }

  function label(text) {
    return `<div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase;margin-bottom:6px">${text}</div>`;
  }

  function bar(done, total, color) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return `<div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:4px">
      <div style="height:100%;width:${pct}%;background:${color}"></div></div>`;
  }

  function renderIntellectHTML(d, color) {
    const sections = [];

    // ── deadline ───────────────────────────────────────────────────────
    const dl = d.deadline || {};
    if (dl.daysRemaining != null) {
      const days = dl.daysRemaining;
      const urgent = days <= 30;
      sections.push(`
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:34px;font-weight:bold;color:${urgent ? '#e05555' : color};line-height:1">${days}</div>
          <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase;margin-top:2px">days · ${esc(dl.label || 'deadline')}</div>
          ${dl.date ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${esc(dl.date)}${d.defenseTarget ? ' · defense ' + esc(d.defenseTarget) : ''}</div>` : ''}
        </div>`);
    }

    // ── this week (deliverable + focus progress) ───────────────────────
    const wk = d.week;
    if (wk) {
      let html = label(`This week${wk.label ? ' · ' + esc(plain(wk.label)) : ''}`);
      if (wk.deliverable) {
        const dvr = plain(wk.deliverable);
        html += `<div style="font-size:11px;color:var(--text);line-height:1.4;margin-bottom:6px">${esc(dvr.length > 160 ? dvr.slice(0, 158) + '…' : dvr)}</div>`;
      }
      if (wk.focusTotal > 0) {
        html += `<div style="font-size:10px;color:var(--text3);display:flex;justify-content:space-between">
          <span>focus tasks</span><span>${wk.focusDone}/${wk.focusTotal}</span></div>${bar(wk.focusDone, wk.focusTotal, color)}`;
      }
      sections.push(`<div style="margin-bottom:14px">${html}</div>`);
    }

    // ── projects ───────────────────────────────────────────────────────
    if (d.projects && d.projects.length) {
      const rows = d.projects.map(p => `
        <div style="padding:5px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:11px;font-weight:bold;color:var(--text)">${esc(plain(p.name))}</div>
          <div style="font-size:10px;color:var(--text3);line-height:1.3">${esc(plain(p.short || ''))}</div>
        </div>`).join('');
      sections.push(`<div style="margin-bottom:14px">${label('Projects')}${rows}</div>`);
    }

    // ── lab activity ───────────────────────────────────────────────────
    const lab = d.lab;
    if (lab && lab.recentEntries && lab.recentEntries.length) {
      const since = lab.daysSinceLastEntry;
      const sinceTxt = since == null ? '' : since === 0 ? ' · today' : ` · ${since}d ago`;
      const rows = lab.recentEntries.map(e => {
        const ctx = (e.contexts && e.contexts.length) ? plain(e.contexts[0]) : '';
        return `<div style="font-size:10px;color:var(--text3);padding:3px 0;display:flex;gap:8px">
          <span style="color:var(--text2);white-space:nowrap">${esc(e.date)}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ctx)}</span></div>`;
      }).join('');
      sections.push(`<div style="margin-bottom:${(d.week && d.week.blockers && d.week.blockers.length) ? '14px' : '0'}">${label('Lab bench' + sinceTxt)}${rows}</div>`);
    }

    // ── blockers ───────────────────────────────────────────────────────
    const blockers = (d.week && d.week.blockers) || [];
    if (blockers.length) {
      const rows = blockers.map(b => `<div style="font-size:10px;color:#e05555;padding:2px 0;line-height:1.3">⚠ ${esc(plain(b))}</div>`).join('');
      sections.push(`<div>${label('Blockers')}${rows}</div>`);
    }

    const stamp = d.generatedAt ? `<div style="font-size:8px;color:var(--text3);text-align:right;margin-top:12px;letter-spacing:1px">synced ${esc(String(d.generatedAt).slice(0, 16).replace('T', ' '))} · from LOCKED</div>` : '';

    return `<div class="domain-widget" style="border-color:${color}">${sections.join('')}${stamp}</div>`;
  }
  window.renderIntellectHTML = renderIntellectHTML;   // exposed for offline tests

  // Fetch the LOCKED feed and render. Network-first with cache-bust so the
  // dissertation state is always current (the file is small text).
  window.renderIntellectWidget = function(el, dk, domain) {
    const color = (domain && domain.color) || '#d85a30';
    el.innerHTML = `<div class="domain-widget" style="border-color:${color}">
      <div style="font-size:11px;color:var(--text3);padding:6px 0">Pulling dissertation feed…</div></div>`;
    fetch('intellect.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
      .then(d => {
        el.innerHTML = renderIntellectHTML(d, color);
        // Collect panel (defined in system.html — it owns DataStore + XP writes):
        // banks XP minted from real LOCKED work. Sits above the read-only mirror.
        if (window.buildIntellectCollect) {
          const panel = window.buildIntellectCollect(d.ledger || [], color);
          if (panel) el.insertBefore(panel, el.firstChild);
        }
      })
      .catch(err => {
        el.innerHTML = `<div class="domain-widget" style="border-color:${color}">
          <div style="font-size:11px;color:var(--text3);line-height:1.4;padding:6px 0">
            Intellect feed unavailable (${esc(err)}).<br>It is generated from the LOCKED project by
            <code>intellect_pull.py</code> and shipped with the app.</div></div>`;
      });
  };
})();

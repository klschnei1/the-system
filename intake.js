// ── INTAKE DOMAIN (Malkuth) ──────────────────────────────────────────
// What enters the body: fluid (oz), food (calories + protein).
// Quests: m1 (hydration accumulator — total oz), g2 (nutrition accumulator).
// Widget: single row oz · kcal · g protein + merged chronological entry log.

(function() {
  'use strict';

  // Render the Intake domain widget.
  // Called from system.html's DOMAIN_WIDGETS.malkuth.
  // Depends on globals: todayLog (from system.html inline script).
  window.renderIntakeWidget = function(el, dk, domain) {
    const waterLog = todayLog['m1'];
    const nutritionLog = todayLog['g2'];

    const waterTotals = waterLog?.totals || { oz: 0 };
    const nutritionTotals = nutritionLog?.totals || { calories: 0, protein: 0 };

    const waterEntries = (waterLog?.entries || []).map(e => ({ ...e, kind: 'fluid' }));
    const foodEntries = (nutritionLog?.entries || []).map(e => ({ ...e, kind: 'food' }));
    const allEntries = [...waterEntries, ...foodEntries].sort((a, b) =>
      new Date(a.time) - new Date(b.time)
    );

    el.innerHTML = `
      <div class="domain-widget" style="border-color:${domain.color}">
        <!-- oz · kcal · protein -->
        <div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:${allEntries.length > 0 ? '12px' : '0'}">
          <div>
            <div style="font-size:28px;font-weight:bold;color:var(--text)">${waterTotals.oz || 0}</div>
            <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">oz</div>
          </div>
          <div style="width:1px;background:var(--border)"></div>
          <div>
            <div style="font-size:28px;font-weight:bold;color:var(--text)">${nutritionTotals.calories || 0}</div>
            <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">kcal</div>
          </div>
          <div style="width:1px;background:var(--border)"></div>
          <div>
            <div style="font-size:28px;font-weight:bold;color:var(--text)">${nutritionTotals.protein || 0}</div>
            <div style="font-size:9px;letter-spacing:2px;color:var(--text2);text-transform:uppercase">g protein</div>
          </div>
        </div>
        <!-- Merged entry log -->
        ${allEntries.length > 0 ? `
          <div style="border-top:1px solid var(--border);padding-top:8px">
            ${allEntries.map(e => {
              const time = new Date(e.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
              if (e.kind === 'fluid') {
                const parts = [];
                if (e.water) parts.push(`${e.water}oz water`);
                if (e.other) parts.push(`${e.other}oz other`);
                return `
                  <div style="font-size:10px;color:var(--text3);padding:3px 0;display:flex;justify-content:space-between">
                    <span>${time}${e.note ? ' — ' + e.note : ''}</span>
                    <span style="color:var(--text2)">${parts.join(' · ')}</span>
                  </div>`;
              } else {
                return `
                  <div style="font-size:10px;color:var(--text3);padding:3px 0;display:flex;justify-content:space-between">
                    <span>${time}${e.note ? ' — ' + e.note : ''}</span>
                    <span style="color:var(--text2)">${e.calories || 0} kcal · ${e.protein || 0}g</span>
                  </div>`;
              }
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  };
})();

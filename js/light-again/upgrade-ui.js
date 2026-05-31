/* ==========================================================================
   Light Again — Upgrade Draft UI (DOM overlay)
   Shows 2 upgrade choices; player clicks one to apply.
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var M  = LA.sceneMethods;

  /* ---- Inject keyframes (once) ---- */
  function ensureStyles() {
    if (document.getElementById('_la-up-styles')) return;
    var st = document.createElement('style');
    st.id = '_la-up-styles';
    st.textContent = [
      '@keyframes la-up-fade{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes la-up-glow{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 24px 6px var(--la-accent-glow)}}',
      '@keyframes la-up-shine{0%{background-position:200% 0}100%{background-position:-200% 0}}',
      // Shared upgrade-icon placeholder, draft size (see LA.ICON_PLACEHOLDER_SVG).
      '.la-up-ph{width:40px;height:40px}',
    ].join('');
    document.head.appendChild(st);
  }

  /* ================================================================
     BUILD & SHOW OVERLAY
     ================================================================ */
  // Per-level chrome. Lv2 keeps its semantic gold; Lv1 follows the theme accent;
  // Lv3 (capstone) gets a distinct bright violet so maxed picks read as special.
  function levelStyle(level) {
    if (level >= 3) return {
      border: 'rgba(180,120,255,0.6)', borderHi: 'rgba(180,120,255,0.95)',
      glow: 'rgba(180,120,255,0.18)', fill: 'rgba(180,120,255,0.06)',
      fillBadge: 'rgba(180,120,255,0.16)', fillBadgeBorder: 'rgba(180,120,255,0.34)',
      color: '#b478ff', label: 'Niv. 3',
    };
    if (level === 2) return {
      border: 'rgba(255,200,50,0.55)', borderHi: 'rgba(255,200,50,0.85)',
      glow: 'rgba(255,200,50,0.12)', fill: 'rgba(255,200,50,0.05)',
      fillBadge: 'rgba(255,200,50,0.15)', fillBadgeBorder: 'rgba(255,200,50,0.3)',
      color: '#ffc832', label: 'Niv. 2',
    };
    return {
      border: 'var(--la-accent-line)', borderHi: 'var(--la-accent)',
      glow: 'var(--la-accent-glow)', fill: 'var(--la-accent-faint)',
      fillBadge: 'var(--la-accent-fill)', fillBadgeBorder: 'var(--la-accent-soft)',
      color: 'var(--la-accent)', label: 'Niv. 1',
    };
  }

  M._showUpgradeDraftUI = function (choices) {
    if (document.getElementById('_la-upgrade-overlay')) return;
    ensureStyles();

    var canvas    = this.game.canvas;
    var container = canvas.parentElement;
    var sceneRef  = this;
    var t         = LA.laGoT;

    // --- Overlay wrapper (covers canvas) ---
    var overlay = document.createElement('div');
    overlay.id = '_la-upgrade-overlay';
    overlay.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:55',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:var(--la-win-scrim)', 'font-family:monospace',
      'pointer-events:auto',
    ].join(';');

    // --- Panel ---
    var panel = document.createElement('div');
    panel.style.cssText = [
      'text-align:center', 'padding:1.2rem 1.6rem 1rem',
      'border:1px solid var(--la-accent-soft)', 'border-radius:14px',
      'background:var(--la-win-bg-strong)', 'max-width:520px', 'width:94%',
      '-webkit-backdrop-filter:blur(7px)', 'backdrop-filter:blur(7px)',
      'color:#e0e0ff',
      'animation:la-up-fade 0.35s cubic-bezier(0.22,1,0.36,1) both,la-up-glow 2.6s ease infinite',
    ].join(';');

    // Title
    var title = document.createElement('div');
    title.style.cssText = 'font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:#7799bb;margin-bottom:.9rem';
    title.textContent = t('laUpTitle');
    panel.appendChild(title);

    // Picks-remaining indicator (boss reward = several sequential picks)
    var picksLeft = sceneRef._draftPicksRemaining || 1;
    if (picksLeft > 1) {
      var picksLine = document.createElement('div');
      picksLine.style.cssText = 'font-size:.62rem;color:var(--la-accent);margin-top:-.5rem;margin-bottom:.7rem;letter-spacing:.08em;font-weight:700';
      picksLine.textContent = picksLeft + ' ' + t('laUpPicksLeft');
      panel.appendChild(picksLine);
    }

    // Cards container
    var cardsRow = document.createElement('div');
    cardsRow.style.cssText = 'display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap';

    for (var i = 0; i < choices.length; i++) {
      (function (choice, idx) {
        var isCurse = !!choice.curse;
        var st, name, descTxt, badgeTxt, icon, nameCol, descCol, cardBg;
        if (isCurse) {
          var cdef = LA.CURSES[choice.id];
          st = {
            border: 'rgba(200,20,60,0.6)', borderHi: 'rgba(230,40,90,0.95)',
            glow: 'rgba(200,20,60,0.28)', fill: 'rgba(200,20,60,0.07)',
            fillBadge: 'rgba(200,20,60,0.18)', fillBadgeBorder: 'rgba(200,20,60,0.45)',
            color: '#ff436b', label: t('laUpCurseBadge'),
          };
          name     = t(cdef.i18nName);
          descTxt  = t(cdef.i18nDesc);
          badgeTxt = st.label;
          icon     = '⚠';            // ⚠
          nameCol  = '#ff5c7c';
          descCol  = '#e0a6b4';
          cardBg   = 'rgba(26,6,10,0.95)';
        } else {
          var def = LA.UPGRADES[choice.id];
          st = levelStyle(choice.level);
          name     = t(def.i18nName);
          descTxt  = t(choice.level >= 3 ? def.i18nDesc3 : (choice.level === 2 ? def.i18nDesc2 : def.i18nDesc1));
          badgeTxt = st.label;
          icon     = '?';
          nameCol  = '#ffffff';
          descCol  = '#99aabb';
          cardBg   = 'rgba(8,10,28,0.92)';
        }

        var card = document.createElement('button');
        card.className = '_la-up-card';
        card.style.cssText = [
          'flex:1 1 180px', 'max-width:220px', 'min-width:150px',
          'padding:.8rem .7rem .6rem',
          'border:1.5px solid ' + st.border,
          'border-radius:10px',
          'background:' + cardBg,
          'color:#e0e0ff', 'cursor:pointer',
          'font-family:monospace', 'text-align:center',
          'transition:transform .15s,box-shadow .2s,border-color .2s',
          'outline:none',
          'animation:la-up-fade 0.4s cubic-bezier(0.22,1,0.36,1) both',
          'animation-delay:' + (idx * 0.08) + 's',
        ].join(';');

        card.addEventListener('mouseenter', function () {
          card.style.transform = 'translateY(-4px) scale(1.03)';
          card.style.boxShadow = '0 0 20px 4px ' + st.glow;
          card.style.borderColor = st.borderHi;
        });
        card.addEventListener('mouseleave', function () {
          card.style.transform = '';
          card.style.boxShadow = '';
          card.style.borderColor = st.border;
        });

        // Image placeholder
        var imgWrap = document.createElement('div');
        imgWrap.style.cssText = [
          'width:64px', 'height:64px', 'margin:0 auto .5rem',
          'border:1.5px solid ' + st.border, 'border-radius:8px',
          'background:' + st.fill,
          'display:flex', 'align-items:center', 'justify-content:center',
          'font-size:1.6rem', 'color:' + st.color,
        ].join(';');
        // Upgrades show the shared placeholder (real art TBD); curses keep their
        // semantic ⚠ glyph. data-upgrade-img is the hook for the future real icon.
        if (isCurse) imgWrap.textContent = icon;
        else         imgWrap.innerHTML   = LA.iconPlaceholderSvg('la-up-ph');
        imgWrap.setAttribute('data-upgrade-img', (isCurse ? 'curse-' : '') + choice.id + (isCurse ? '' : '-' + choice.level));
        card.appendChild(imgWrap);

        // Name
        var nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size:.72rem;font-weight:700;color:' + nameCol + ';margin-bottom:.2rem';
        nameEl.textContent = name;
        card.appendChild(nameEl);

        // Badge (level or "Malédiction")
        var badge = document.createElement('span');
        badge.style.cssText = [
          'display:inline-block',
          'font-size:.5rem', 'letter-spacing:.08em', 'text-transform:uppercase',
          'padding:.1rem .4rem', 'border-radius:4px', 'margin-bottom:.35rem',
          'background:' + st.fillBadge,
          'color:' + st.color,
          'border:1px solid ' + st.fillBadgeBorder,
        ].join(';');
        badge.textContent = badgeTxt;
        card.appendChild(badge);

        // Description
        var desc = document.createElement('div');
        desc.style.cssText = 'font-size:.56rem;color:' + descCol + ';line-height:1.4;margin-top:.25rem';
        desc.textContent = descTxt;
        card.appendChild(desc);

        // Click → apply (curse or upgrade), then advance to the next pick (or close)
        card.addEventListener('click', function () {
          if (isCurse) sceneRef._applyCurse(choice.id);
          else         sceneRef._applyUpgrade(choice);
          sceneRef._advanceDraftPick();
        });

        cardsRow.appendChild(card);
      })(choices[i], i);
    }

    panel.appendChild(cardsRow);

    // --- Footer: Reroll + Skip ---
    var footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:.7rem;justify-content:center;align-items:stretch;margin-top:1rem';

    var rerolls = sceneRef._rerollsAvailable || 0;
    var rerollBtn = document.createElement('button');
    rerollBtn.className = '_la-up-foot';
    var rrEnabled = rerolls > 0;
    rerollBtn.style.cssText = [
      'flex:0 0 auto', 'padding:.45rem .9rem',
      'border:1px solid ' + (rrEnabled ? 'var(--la-accent-soft)' : 'rgba(120,130,150,0.25)'),
      'border-radius:8px',
      'background:' + (rrEnabled ? 'var(--la-accent-fill)' : 'rgba(40,44,60,0.5)'),
      'color:' + (rrEnabled ? 'var(--la-accent)' : '#5a6678'),
      'font-family:monospace', 'font-size:.6rem', 'font-weight:700',
      'letter-spacing:.06em', 'text-transform:uppercase',
      'cursor:' + (rrEnabled ? 'pointer' : 'not-allowed'),
      'transition:transform .12s,box-shadow .2s,border-color .2s', 'outline:none',
    ].join(';');
    rerollBtn.textContent = '↻ ' + t('laUpReroll') + ' (' + rerolls + ')';
    if (rrEnabled) {
      rerollBtn.addEventListener('mouseenter', function () {
        rerollBtn.style.transform = 'translateY(-2px)';
        rerollBtn.style.boxShadow = '0 0 14px 2px var(--la-accent-glow)';
        rerollBtn.style.borderColor = 'var(--la-accent)';
      });
      rerollBtn.addEventListener('mouseleave', function () {
        rerollBtn.style.transform = '';
        rerollBtn.style.boxShadow = '';
        rerollBtn.style.borderColor = 'var(--la-accent-soft)';
      });
      rerollBtn.addEventListener('click', function () {
        var fresh = sceneRef._rerollDraft();
        if (!fresh || !fresh.length) return;
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        sceneRef._showUpgradeDraftUI(fresh);
      });
    } else {
      rerollBtn.disabled = true;
    }
    footer.appendChild(rerollBtn);

    // Skip → always a heal (refills a shield slot if below max)
    var skipBtn = document.createElement('button');
    skipBtn.className = '_la-up-foot';
    skipBtn.style.cssText = [
      'flex:0 0 auto', 'padding:.45rem .9rem',
      'border:1px solid rgba(120,200,255,0.3)', 'border-radius:8px',
      'background:rgba(0,200,255,0.08)', 'color:#7fd8ff',
      'font-family:monospace', 'font-size:.6rem', 'font-weight:700',
      'letter-spacing:.06em', 'text-transform:uppercase', 'cursor:pointer',
      'transition:transform .12s,box-shadow .2s,border-color .2s', 'outline:none',
      'display:flex', 'flex-direction:column', 'align-items:center', 'gap:1px',
    ].join(';');
    var skipMain = document.createElement('span');
    skipMain.textContent = '↓ ' + t('laUpSkip');
    skipBtn.appendChild(skipMain);
    // Only advertise the heal when it can actually happen (below max shields).
    // Recomputed every pick, so the label adapts live across the boss's 3 picks.
    if (sceneRef.playerShields < sceneRef.MAX_SHIELDS) {
      var skipHint = document.createElement('span');
      skipHint.style.cssText = 'font-size:.46rem;font-weight:400;text-transform:none;letter-spacing:0;color:#5fbfe8';
      skipHint.textContent = t('laUpSkipHint');
      skipBtn.appendChild(skipHint);
    }
    skipBtn.addEventListener('mouseenter', function () {
      skipBtn.style.transform = 'translateY(-2px)';
      skipBtn.style.boxShadow = '0 0 14px 2px rgba(0,200,255,0.25)';
      skipBtn.style.borderColor = 'rgba(120,200,255,0.7)';
    });
    skipBtn.addEventListener('mouseleave', function () {
      skipBtn.style.transform = '';
      skipBtn.style.boxShadow = '';
      skipBtn.style.borderColor = 'rgba(120,200,255,0.3)';
    });
    skipBtn.addEventListener('click', function () {
      sceneRef._skipDraft();
    });
    footer.appendChild(skipBtn);

    panel.appendChild(footer);
    overlay.appendChild(panel);
    container.appendChild(overlay);

    // Prevent game inputs while overlay is up
    overlay.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Focus first card for keyboard accessibility
    var firstCard = overlay.querySelector('._la-up-card');
    if (firstCard) setTimeout(function () { firstCard.focus(); }, 80);
  };

  /* ================================================================
     SECRET UPGRADE UI — golden single-card for "The World"
     ================================================================ */
  M._showSecretUpgradeDraftUI = function () {
    if (document.getElementById('_la-upgrade-overlay')) return;
    ensureStyles();

    var canvas    = this.game.canvas;
    var container = canvas.parentElement;
    var sceneRef  = this;
    var t         = LA.laGoT;
    var def       = LA.SECRET_UPGRADE;

    var overlay = document.createElement('div');
    overlay.id = '_la-upgrade-overlay';
    overlay.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:55',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(2,2,10,0.72)', 'font-family:monospace',
      'pointer-events:auto',
    ].join(';');

    var panel = document.createElement('div');
    panel.style.cssText = [
      'text-align:center', 'padding:1.5rem 2rem 1.2rem',
      'border:2px solid rgba(255,200,50,0.6)', 'border-radius:16px',
      'background:linear-gradient(135deg, rgba(20,15,5,0.92) 0%, rgba(40,30,8,0.92) 100%)',
      'max-width:380px', 'width:90%',
      'color:#ffe8a0',
      'animation:la-up-fade 0.5s cubic-bezier(0.22,1,0.36,1) both,la-up-glow 2s ease infinite',
      'box-shadow:0 0 40px 8px rgba(255,200,50,0.15), inset 0 0 30px rgba(255,200,50,0.05)',
    ].join(';');
    // ^ outer panel stays gold

    // Title
    var title = document.createElement('div');
    title.style.cssText = 'font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:#ffc832;margin-bottom:.6rem';
    title.textContent = '— SECRET UPGRADE —';
    panel.appendChild(title);

    // Card
    var card = document.createElement('button');
    card.className = '_la-up-card';
    card.style.cssText = [
      'width:100%', 'padding:1rem .8rem .8rem',
      'border:2px solid rgba(180,0,0,0.6)',
      'border-radius:12px',
      'background:rgba(18,4,4,0.95)',
      'color:#ffcccc', 'cursor:pointer',
      'font-family:monospace', 'text-align:center',
      'transition:transform .15s,box-shadow .2s,border-color .2s',
      'outline:none',
      'animation:la-up-fade 0.5s cubic-bezier(0.22,1,0.36,1) both',
      'animation-delay:0.12s',
    ].join(';');

    card.addEventListener('mouseenter', function () {
      card.style.transform = 'translateY(-4px) scale(1.04)';
      card.style.boxShadow = '0 0 28px 6px rgba(180,0,0,0.35)';
      card.style.borderColor = 'rgba(220,20,20,0.95)';
    });
    card.addEventListener('mouseleave', function () {
      card.style.transform = '';
      card.style.boxShadow = '';
      card.style.borderColor = 'rgba(180,0,0,0.6)';
    });

    // Icon
    var imgWrap = document.createElement('div');
    imgWrap.style.cssText = [
      'width:72px', 'height:72px', 'margin:0 auto .6rem',
      'border:2px solid rgba(180,0,0,0.5)', 'border-radius:10px',
      'background:rgba(180,0,0,0.08)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:2rem', 'color:#ff4444',
    ].join(';');
    imgWrap.textContent = '⏱';
    card.appendChild(imgWrap);

    // Name
    var name = document.createElement('div');
    name.style.cssText = 'font-size:.85rem;font-weight:700;color:#ff4444;margin-bottom:.3rem;letter-spacing:.08em';
    name.textContent = t(def.i18nName);
    card.appendChild(name);

    // Badge
    var badge = document.createElement('span');
    badge.style.cssText = [
      'display:inline-block',
      'font-size:.48rem', 'letter-spacing:.1em', 'text-transform:uppercase',
      'padding:.12rem .5rem', 'border-radius:4px', 'margin-bottom:.4rem',
      'background:rgba(180,0,0,0.18)',
      'color:#ff4444',
      'border:1px solid rgba(180,0,0,0.45)',
    ].join(';');
    badge.textContent = 'SECRET';
    card.appendChild(badge);

    // Description
    var desc = document.createElement('div');
    desc.style.cssText = 'font-size:.58rem;color:#ddaaaa;line-height:1.5;margin-top:.3rem';
    desc.textContent = t(def.i18nDesc1);
    card.appendChild(desc);

    // Click → apply
    card.addEventListener('click', function () {
      sceneRef._twUnlocked = true;
      sceneRef._twCooldown = 0;
      sceneRef._closeDraft();
    });

    panel.appendChild(card);
    overlay.appendChild(panel);
    container.appendChild(overlay);

    overlay.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    setTimeout(function () { card.focus(); }, 80);
  };

})();

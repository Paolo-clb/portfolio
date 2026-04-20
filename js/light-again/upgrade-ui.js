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
      '@keyframes la-up-glow{0%,100%{box-shadow:0 0 0 0 rgba(0,255,255,0.15)}50%{box-shadow:0 0 24px 6px rgba(0,255,255,0.10)}}',
      '@keyframes la-up-shine{0%{background-position:200% 0}100%{background-position:-200% 0}}',
    ].join('');
    document.head.appendChild(st);
  }

  /* ================================================================
     BUILD & SHOW OVERLAY
     ================================================================ */
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
      'background:rgba(2,2,10,0.60)', 'font-family:monospace',
      'pointer-events:auto',
    ].join(';');

    // --- Panel ---
    var panel = document.createElement('div');
    panel.style.cssText = [
      'text-align:center', 'padding:1.2rem 1.6rem 1rem',
      'border:1px solid rgba(0,255,255,0.25)', 'border-radius:14px',
      'background:rgba(4,5,18,0.82)', 'max-width:520px', 'width:94%',
      'color:#e0e0ff',
      'animation:la-up-fade 0.35s cubic-bezier(0.22,1,0.36,1) both,la-up-glow 2.6s ease infinite',
    ].join(';');

    // Title
    var title = document.createElement('div');
    title.style.cssText = 'font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:#7799bb;margin-bottom:.9rem';
    title.textContent = t('laUpTitle');
    panel.appendChild(title);

    // Cards container
    var cardsRow = document.createElement('div');
    cardsRow.style.cssText = 'display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap';

    for (var i = 0; i < choices.length; i++) {
      (function (choice) {
        var def = LA.UPGRADES[choice.id];
        var isLv2 = choice.level === 2;
        var borderColor = isLv2 ? 'rgba(255,200,50,0.55)' : 'rgba(0,255,255,0.45)';
        var glowColor   = isLv2 ? 'rgba(255,200,50,0.12)' : 'rgba(0,255,255,0.10)';
        var lvlLabel    = isLv2 ? 'Niv. 2' : 'Niv. 1';
        var lvlColor    = isLv2 ? '#ffc832' : '#00ffff';

        var card = document.createElement('button');
        card.className = '_la-up-card';
        card.style.cssText = [
          'flex:1 1 180px', 'max-width:220px', 'min-width:150px',
          'padding:.8rem .7rem .6rem',
          'border:1.5px solid ' + borderColor,
          'border-radius:10px',
          'background:rgba(8,10,28,0.92)',
          'color:#e0e0ff', 'cursor:pointer',
          'font-family:monospace', 'text-align:center',
          'transition:transform .15s,box-shadow .2s,border-color .2s',
          'outline:none',
          'animation:la-up-fade 0.4s cubic-bezier(0.22,1,0.36,1) both',
          'animation-delay:' + (i * 0.08) + 's',
        ].join(';');

        // Hover effects
        card.addEventListener('mouseenter', function () {
          card.style.transform = 'translateY(-4px) scale(1.03)';
          card.style.boxShadow = '0 0 20px 4px ' + glowColor;
          card.style.borderColor = isLv2 ? 'rgba(255,200,50,0.85)' : 'rgba(0,255,255,0.8)';
        });
        card.addEventListener('mouseleave', function () {
          card.style.transform = '';
          card.style.boxShadow = '';
          card.style.borderColor = borderColor;
        });

        // Image placeholder
        var imgWrap = document.createElement('div');
        imgWrap.style.cssText = [
          'width:64px', 'height:64px', 'margin:0 auto .5rem',
          'border:1.5px solid ' + borderColor, 'border-radius:8px',
          'background:rgba(0,255,255,0.04)',
          'display:flex', 'align-items:center', 'justify-content:center',
          'font-size:1.6rem', 'color:' + lvlColor,
        ].join(';');
        imgWrap.textContent = '?';
        imgWrap.setAttribute('data-upgrade-img', choice.id + '-' + choice.level);
        card.appendChild(imgWrap);

        // Name
        var name = document.createElement('div');
        name.style.cssText = 'font-size:.72rem;font-weight:700;color:#ffffff;margin-bottom:.2rem';
        name.textContent = t(def.i18nName);
        card.appendChild(name);

        // Level badge
        var badge = document.createElement('span');
        badge.style.cssText = [
          'display:inline-block',
          'font-size:.5rem', 'letter-spacing:.08em', 'text-transform:uppercase',
          'padding:.1rem .4rem', 'border-radius:4px', 'margin-bottom:.35rem',
          'background:' + (isLv2 ? 'rgba(255,200,50,0.15)' : 'rgba(0,255,255,0.12)'),
          'color:' + lvlColor,
          'border:1px solid ' + (isLv2 ? 'rgba(255,200,50,0.3)' : 'rgba(0,255,255,0.25)'),
        ].join(';');
        badge.textContent = lvlLabel;
        card.appendChild(badge);

        // Description
        var desc = document.createElement('div');
        desc.style.cssText = 'font-size:.56rem;color:#99aabb;line-height:1.4;margin-top:.25rem';
        var descKey = isLv2 ? def.i18nDesc2 : def.i18nDesc1;
        desc.textContent = t(descKey);
        card.appendChild(desc);

        // Click → apply upgrade
        card.addEventListener('click', function () {
          sceneRef._applyUpgrade(choice);
          sceneRef._closeDraft();
        });

        cardsRow.appendChild(card);
      })(choices[i]);
    }

    panel.appendChild(cardsRow);
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

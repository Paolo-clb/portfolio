/* ==========================================================================
   Light Again — Game Shell (IIFE)
   Injects hero button (after typing game unlock), fullscreen canvas modal,
   and performance kill switch. No gameplay — infrastructure only.
   ========================================================================== */
(function () {
  'use strict';

  var btnEl        = null;  // Hero "Play Light Again" button
  var overlayEl    = null;  // Active modal overlay (null when closed)
  var trapCleanup  = null;  // Focus-trap cleanup function
  var savedState   = null;  // Snapshot saved by killPerformance()
  var activeGame   = null;  // Running game instance (createLightGame)
  var helpPopupEl  = null;  // Help popup (null when hidden)
  var userPaused   = false; // Pause manuel (ne pas resume à la fermeture de l'aide)

  /* ---- i18n helper ---- */
  function t(key) {
    return (typeof window.__siteT === 'function' ? window.__siteT(key) : null) || key;
  }

  /* ---- Cookie reader (mirrors typing-game.js getCookie) ---- */
  function getCookie(name) {
    var m = document.cookie.match('(?:^|;)\\s*' + name + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* ================================================================
     HERO BUTTON
     ================================================================ */

  function injectButton() {
    if (btnEl) return; // Already injected (guard for duplicate events)

    // Typing game is static-only on touch smartphones — no button there
    if (window.matchMedia('(max-width: 600px) and (pointer: coarse)').matches) return;

    btnEl = document.createElement('button');
    btnEl.className = 'light-again-btn';
    btnEl.setAttribute('aria-label', t('lightAgainPlay'));
    btnEl.innerHTML =
      '<div class="light-again-btn__panel" aria-hidden="true">' +
        '<div class="light-again-btn__img-wrap"></div>' +
        '<div class="light-again-btn__details">' +
          '<strong class="light-again-btn__game-name">Light Again</strong>' +
          '<span class="light-again-btn__tagline">' + t('lightAgainTagline') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="light-again-btn__tab" aria-hidden="true">' +
        '<svg class="light-again-btn__icon" viewBox="0 0 24 24"' +
            ' xmlns="http://www.w3.org/2000/svg">' +
          '<polygon points="5 3 19 12 5 21 5 3"/>' +
        '</svg>' +
        '<span class="light-again-btn__tab-text">Light Again</span>' +
      '</div>';

    btnEl.addEventListener('click', openLightAgain);

    // Fixed positioned — append directly to body
    document.body.appendChild(btnEl);
  }

  function updateBtnText() {
    if (!btnEl) return;
    btnEl.setAttribute('aria-label', t('lightAgainPlay'));
    var tagline = btnEl.querySelector('.light-again-btn__tagline');
    if (tagline) tagline.textContent = t('lightAgainTagline');
  }

  function pauseIconSvg() {
    return '<svg class="light-again-pause-btn__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>';
  }

  function playIconSvg() {
    return '<svg class="light-again-pause-btn__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="9 6 9 18 18 12 9 6"/></svg>';
  }

  function updatePauseBtnUi(btn) {
    if (!btn) return;
    btn.innerHTML = userPaused ? playIconSvg() : pauseIconSvg();
    btn.setAttribute('aria-label', userPaused ? t('lightAgainResume') : t('lightAgainPause'));
    btn.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
  }

  function toggleGamePause() {
    if (!activeGame || helpPopupEl) return;
    if (isLightAgainGameOverOpen()) return;
    if (document.getElementById('_la-upgrade-overlay')) return;
    // Block pause during upgrade slow-mo transition
    if (activeGame && activeGame.scene && activeGame.scene.scenes) {
      var sc = activeGame.scene.scenes[0];
      if (sc && sc._upSlowMoPhase) return;
    }
    if (document.getElementById('_la-loading') || document.getElementById('_la-restart-loading')) return;
    userPaused = !userPaused;
    if (userPaused) {
      if (typeof activeGame.pause === 'function') activeGame.pause();
    } else {
      if (typeof activeGame.resume === 'function') activeGame.resume();
    }
    var pb = overlayEl && overlayEl.querySelector('.light-again-pause-btn');
    updatePauseBtnUi(pb);
  }

  /* ================================================================
     KILL SWITCH — disable site systems, save state for restore
     ================================================================ */

  function killPerformance() {
    var rawSpeed = parseFloat(localStorage.getItem('portfolio_anim_speed'));
    var animSpeed = isNaN(rawSpeed) ? 1 : rawSpeed;

    savedState = {
      rainWasEnabled:  typeof window.__rainIsEnabled        === 'function' && window.__rainIsEnabled(),
      musicWasPlaying: typeof window.__musicPlayerIsPlaying === 'function' && window.__musicPlayerIsPlaying(),
      animSpeed: animSpeed
    };

    // 1. Visualizer — freeze in place then hide (no more rAF draws)
    if (typeof window.__setVisualizerFrozen  === 'function') window.__setVisualizerFrozen(true);
    if (typeof window.__setVisualizerEnabled === 'function') window.__setVisualizerEnabled(false);

    // 2. Rain — graceful drain (existing drops finish falling, then canvas hides)
    if (typeof window.__rainSetEnabled === 'function') window.__rainSetEnabled(false);

    // 3. Hover particles — freeze all velocities & spawn rates
    if (typeof window.__setParticlesSpeed === 'function') window.__setParticlesSpeed(0);

    // 4. Music player — freeze UI state then stop audio decoding
    if (typeof window.__musicPlayerSetFrozen === 'function') window.__musicPlayerSetFrozen(true);
    if (window.__musicPlayerAudio) window.__musicPlayerAudio.pause();

    // 5. Background videos — stop frame decoding
    var darkVid   = document.getElementById('bg-video-dark');
    var natureVid = document.getElementById('bg-video-nature');
    if (darkVid)   darkVid.pause();
    if (natureVid) natureVid.pause();
  }

  /* ================================================================
     RESTORE — re-enable site systems from saved state
     ================================================================ */

  function restorePerformance() {
    if (!savedState) return;

    var animSpeed = savedState.animSpeed;
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    var isMobile = window.matchMedia('(max-width: 768px)').matches;

    // 1. Background videos (desktop only — mobile uses CSS poster)
    if (!isMobile) {
      var dv = document.getElementById('bg-video-dark');
      var nv = document.getElementById('bg-video-nature');
      if (theme === 'dark'   && dv) { dv.playbackRate = Math.max(0.1, animSpeed); dv.play().catch(function () {}); }
      if (theme === 'nature' && nv) { nv.playbackRate = Math.max(0.1, animSpeed); nv.play().catch(function () {}); }
    }

    // 2. Music — unfreeze and resume if it was playing
    if (typeof window.__musicPlayerSetFrozen === 'function') window.__musicPlayerSetFrozen(false);
    if (savedState.musicWasPlaying && typeof window.__musicPlayerPlay === 'function') {
      window.__musicPlayerPlay();
    }

    // 3. Particles — restore speed
    if (typeof window.__setParticlesSpeed === 'function') window.__setParticlesSpeed(animSpeed);

    // 4. Rain — always restore button visibility, then restart effect if it was active
    if (typeof window.__rainSetEnabled === 'function') {
      window.__rainSetEnabled(true); // un-hides the button (safe even if rain was off)
    }
    if (savedState.rainWasEnabled) {
      // __rainSetEnabled(true) only shows the button; restart rain via toggle click
      var rainBtn = document.querySelector('.rain-toggle');
      if (rainBtn) rainBtn.click();
    }

    // 5. Visualizer — re-enable and unfreeze
    if (typeof window.__setVisualizerEnabled === 'function') window.__setVisualizerEnabled(true);
    if (typeof window.__setVisualizerFrozen  === 'function') window.__setVisualizerFrozen(false);
    if (typeof window.__setVisualizerSpeed   === 'function') window.__setVisualizerSpeed(animSpeed);

    savedState = null;
  }

  /* ================================================================
     HELP POPUP
     ================================================================ */

  function buildHelpRows() {
    var lang   = localStorage.getItem('portfolio_lang') || 'fr';
    var isFr   = lang !== 'en';

    var rows = [
      {
        label:    t('lightAgainHelpMove'),
        color:    '#ffcc00',
        descHtml: isFr
          ? 'WASD &nbsp;&middot;&nbsp; ZQSD &nbsp;&middot;&nbsp; Touches fl\u00e9ch\u00e9es'
          : 'WASD &nbsp;&middot;&nbsp; ZQSD &nbsp;&middot;&nbsp; Arrow keys',
      },
      {
        label:    t('lightAgainHelpDash'),
        color:    '#00ffff',
        descHtml: isFr
          ? 'Right click &nbsp;&middot;&nbsp; Space &nbsp;&middot;&nbsp; Shift &nbsp;&middot;&nbsp; Fl\u00e8ches \u2014 Dash dans la direction du <span style="color:#ffcc00">d\u00e9placement</span>'
          : 'Right click &nbsp;&middot;&nbsp; Space &nbsp;&middot;&nbsp; Shift &nbsp;&middot;&nbsp; Arrow keys \u2014 Dash in your <span style="color:#ffcc00">movement</span> direction',
      },
      {
        label:    t('lightAgainHelpAttack'),
        color:    '#ff1e3c',
        descHtml: isFr
          ? 'Clic gauche \u2014 la fl\u00e8che se met en rotation vers le pointeur de la souris'
          : 'Left click \u2014 the arrow spins rapidly toward your mouse cursor',
      },
      {
        label:    t('lightAgainHelpDashAtk'),
        color:    '#ff14c8',
        descHtml: isFr
          ? 'Clic gauche pendant un <span class="la-help-dash">dash</span> \u2014 <span style="color:#ff1e3c">attaque torpille</span> boost\u00e9e\u00a0: plus rapide, zone plus large'
          : 'Left click during a <span class="la-help-dash">dash</span> \u2014 boosted <span style="color:#ff1e3c">torpedo attack</span>: faster, wider area',
      },
      {
        label:    t('lightAgainHelpParry'),
        color:    '#6F09C3',
        descHtml: isFr
          ? 'Une <span style="color:#ff14c8">dash-attaque</span> sur un projectile le renvoie \u00e0 l\u2019envoyeur. L\u2019<span style="color:#ff1e3c">attaque torpille</span> ne renvoie pas.'
          : 'A <span style="color:#ff14c8">dash-attack</span> on a projectile sends it back to the shooter. <span style="color:#ff1e3c">Torpedo attack</span> does not reflect.',
      },
      {
        label:    t('lightAgainHelpNuke'),
        color:    '#005a8c',
        descHtml: isFr
          ? 'En <span class="la-help-dash">dash</span>, touche un ennemi pour le <span style="color:#005a8c">marquer</span> \u2014 il clignote avec des \u00e9tincelles \u2014 puis une <span style="color:#ff1e3c">attaque torpille</span> d\u00e9clenche la nuke. La <span style="color:#ff14c8">dash-attaque</span> ne d\u00e9clenche <strong>pas</strong> la nuke.'
          : 'While <span class="la-help-dash">dashing</span>, hit an enemy to <span style="color:#005a8c">mark</span> it \u2014 it blinks with sparks \u2014 then a <span style="color:#ff1e3c">torpedo attack</span> triggers the nuke. <span style="color:#ff14c8">Dash-attack</span> does <strong>not</strong> trigger the nuke.',
      },
    ];

    var dl = document.createElement('dl');
    dl.className = 'light-again-help-popup__list';
    rows.forEach(function (row) {
      var dt = document.createElement('dt');
      dt.className = 'light-again-help-popup__action';
      dt.style.color = row.color;
      dt.textContent = row.label;
      var dd = document.createElement('dd');
      dd.className = 'light-again-help-popup__desc';
      dd.innerHTML = row.descHtml; // safe: developer-written, no user input
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    return dl;
  }

  function showHelpPopup() {
    if (helpPopupEl || !overlayEl) return;
    var modal = overlayEl.querySelector('.light-again-modal');
    // Pause game loop
    if (activeGame && typeof activeGame.pause === 'function') activeGame.pause();

    helpPopupEl = document.createElement('div');
    helpPopupEl.className = 'light-again-help-overlay';

    var popup = document.createElement('div');
    popup.className = 'light-again-help-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', t('lightAgainHelpTitle'));

    var closeBtn = document.createElement('button');
    closeBtn.className = 'modal__close light-again-help-popup__close';
    closeBtn.textContent = '\u00D7';
    closeBtn.setAttribute('aria-label', t('lightAgainHelpResume'));
    closeBtn.addEventListener('click', function () { closeHelpPopup(false); });

    var title = document.createElement('h2');
    title.className = 'light-again-help-popup__title';
    title.textContent = t('lightAgainHelpTitle');

    var list = buildHelpRows();

    popup.appendChild(closeBtn);
    popup.appendChild(title);
    popup.appendChild(list);
    helpPopupEl.appendChild(popup);
    if (modal) modal.appendChild(helpPopupEl);

    // Click on backdrop (outside popup panel) → close help popup
    helpPopupEl.addEventListener('click', function (e) {
      if (e.target === helpPopupEl) closeHelpPopup(false);
    });

    void helpPopupEl.offsetHeight;
    helpPopupEl.classList.add('light-again-help-overlay--visible');
    closeBtn.focus();
  }

  function isLightAgainGameOverOpen() {
    if (!overlayEl) return false;
    var host = overlayEl.querySelector('.light-again-canvas');
    return !!(host && host.dataset && host.dataset.laGameover === '1');
  }

  function closeHelpPopup(skipResume) {
    if (!helpPopupEl) return;
    // Mark tutorial as seen the first time the player closes the help popup
    if (!localStorage.getItem('la_tutorial_seen')) {
      localStorage.setItem('la_tutorial_seen', '1');
    }
    helpPopupEl.classList.remove('light-again-help-overlay--visible');
    var toRemove = helpPopupEl;
    helpPopupEl = null;
    if (skipResume === true) {
      // Immediate removal — game shutting down, transition will never complete
      if (toRemove.parentNode) toRemove.parentNode.removeChild(toRemove);
    } else {
      var onEnd = function () {
        toRemove.removeEventListener('transitionend', onEnd);
        if (toRemove.parentNode) toRemove.parentNode.removeChild(toRemove);
      };
      toRemove.addEventListener('transitionend', onEnd);
      // Resume sauf si pause manuelle ou game-over (scène doit rester figée)
      if (!isLightAgainGameOverOpen() && !userPaused && activeGame && typeof activeGame.resume === 'function') {
        activeGame.resume();
      }
      var hb = overlayEl && overlayEl.querySelector('.light-again-help-btn:not(.light-again-pause-btn)');
      if (hb) hb.focus();
    }
  }

  /* ================================================================
     MODAL — open
     ================================================================ */

  function openLightAgain() {
    if (overlayEl) return; // Guard against double-open

    /* --- Build DOM --- */
    overlayEl = document.createElement('div');
    overlayEl.className = 'light-again-overlay modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'light-again-modal';
    modal.setAttribute('role',       'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', t('lightAgainPlay'));

    // Close button — identical pattern to projects & detail modals
    var closeBtn = document.createElement('button');
    closeBtn.className = 'modal__close';
    closeBtn.textContent = '\u00D7'; // ×
    closeBtn.setAttribute('aria-label', t('closeLbl'));
    closeBtn.addEventListener('click', closeLightAgain);

    // Pause — même style que l'aide, à gauche du ?
    var pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.className = 'light-again-help-btn light-again-pause-btn';
    pauseBtn.setAttribute('aria-pressed', 'false');
    updatePauseBtnUi(pauseBtn);
    pauseBtn.addEventListener('click', toggleGamePause);

    // Help button (?) — left of close, opens game instructions popup
    var helpBtn = document.createElement('button');
    helpBtn.className = 'light-again-help-btn';
    helpBtn.textContent = '?';
    helpBtn.setAttribute('aria-label', t('lightAgainHelp'));
    helpBtn.addEventListener('click', showHelpPopup);

    // Phaser container (Phaser creates its own canvas inside)
    var container = document.createElement('div');
    container.className = 'light-again-canvas'; // reuses existing CSS sizing rules
    container.style.width  = '100%';
    container.style.height = '100%';

    modal.appendChild(pauseBtn);
    modal.appendChild(helpBtn);
    modal.appendChild(closeBtn);
    modal.appendChild(container);
    overlayEl.appendChild(modal);
    document.body.appendChild(overlayEl);
    document.body.style.overflow = 'hidden';

    /* --- Animate in (force reflow first) --- */
    void overlayEl.offsetHeight;
    overlayEl.classList.add('modal-overlay--open');

    // Keep launcher tab visually collapsed — ignore hover/focus while game is open
    if (btnEl) btnEl.classList.add('light-again-btn--modal-open');

    /* --- Focus management --- */
    if (typeof window.__trapFocus === 'function') {
      trapCleanup = window.__trapFocus(overlayEl);
    }
    closeBtn.focus();

    /* --- Keyboard: Escape closes help popup first, then game --- */
    overlayEl._onKeyDown = function (e) {
      if (e.key === 'Escape') {
        if (helpPopupEl) { closeHelpPopup(false); }
        else { closeLightAgain(); }
      }
    };
    document.addEventListener('keydown', overlayEl._onKeyDown);

    /* --- Kill switch --- */
    killPerformance();

    /* --- Start game --- */
    if (typeof window.createLightGame === 'function') {
      activeGame = window.createLightGame(container);
      activeGame.start();
    }

    /* --- First-play tutorial: show help popup once loading is complete --- */
    if (!localStorage.getItem('la_tutorial_seen')) {
      // Wait for the loader overlay to be removed before pausing/showing popup.
      // Calling pause() during Phaser preload freezes asset loading entirely.
      var _tutOverlay = overlayEl;
      var _tutWatcher = new MutationObserver(function () {
        if (!document.getElementById('_la-loading')) {
          _tutWatcher.disconnect();
          // Guard: game modal may have been closed before load finished
          if (overlayEl && overlayEl === _tutOverlay) {
            showHelpPopup(); // showHelpPopup() calls activeGame.pause() internally
          }
        }
      });
      _tutWatcher.observe(document.body, { childList: true, subtree: true });
    }
  }

  /* ================================================================
     MODAL — close
     ================================================================ */

  function closeLightAgain() {
    if (!overlayEl) return;

    if (btnEl) btnEl.classList.remove('light-again-btn--modal-open');

    userPaused = false;

    // Close help popup immediately (whole modal is exiting — no animation needed)
    closeHelpPopup(true);

    // Start CSS fade-out
    overlayEl.classList.remove('modal-overlay--open');

    // Clean up listeners & focus trap
    if (trapCleanup) { trapCleanup(); trapCleanup = null; }
    if (overlayEl._onKeyDown) {
      document.removeEventListener('keydown', overlayEl._onKeyDown);
    }

    // Stop game loop before tearing down DOM
    if (activeGame) { activeGame.stop(); activeGame = null; }

    // Remove from DOM after transition (350ms, matching other modals)
    var toRemove = overlayEl;
    overlayEl = null;
    setTimeout(function () {
      if (toRemove.parentNode) toRemove.parentNode.removeChild(toRemove);
    }, 350);

    // Restore scroll only if no other modal is still open
    var otherOpen = document.querySelector('.modal-overlay--open');
    if (!otherOpen) {
      document.body.style.overflow = '';
    }

    // Restore site systems
    restorePerformance();
  }

  /* ================================================================
     BOOT
     ================================================================ */

  function boot() {
    // Returning visitor: game already activated — inject button immediately.
    // We cannot rely on the 'typinggameready' event here because typing-game.js
    // registers its DOMContentLoaded handler before light-again.js, so the event
    // fires before we even reach this listener registration.
    if (getCookie('typing_game_activated') === '1') {
      injectButton();
    }

    // First-time activation path: intro → game transition fires this event
    document.addEventListener('typinggameready', function () {
      injectButton();
    });

    // Keep button label in sync with site language
    document.addEventListener('sitelangchange', function () {
      updateBtnText();
      if (overlayEl) {
        var hb = overlayEl.querySelector('.light-again-help-btn:not(.light-again-pause-btn)');
        if (hb) hb.setAttribute('aria-label', t('lightAgainHelp'));
        updatePauseBtnUi(overlayEl.querySelector('.light-again-pause-btn'));
      }
      // Close help popup on lang change — will reopen with fresh language
      if (helpPopupEl) closeHelpPopup(true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

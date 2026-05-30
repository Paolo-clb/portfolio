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
  var currentMode  = null;  // 'sandbox' | 'hardcore'
  var menuEl       = null;  // mode-select DOM overlay
  var menuBtnEl    = null;  // sandbox "Menu" header button

  /* ---- i18n helper ---- */
  function t(key) {
    return (typeof window.__siteT === 'function' ? window.__siteT(key) : null) || key;
  }

  /* ---- laGoT proxy (game-over/mode strings) ---- */
  function tG(key) {
    var LA = window.LightAgain;
    if (LA && typeof LA.laGoT === 'function') return LA.laGoT(key);
    return (typeof window.__siteT === 'function' ? window.__siteT(key) : null) || key;
  }

  /* ---- Hardcore unlock helper (now gated solely on tutorial completion) ---- */
  function laIsHardcoreUnlocked() {
    var LA = window.LightAgain;
    return (LA && typeof LA.laIsHardcoreUnlocked === 'function') ? LA.laIsHardcoreUnlocked() : false;
  }

  /* ---- Mode select helpers ---- */
  function updateMenuBtn() {
    if (!menuBtnEl) return;
    // Home button is available whenever a run is active — sandbox, hardcore, and
    // during the tutorial (which runs under sandbox mode).
    var show = (currentMode === 'sandbox' || currentMode === 'hardcore');
    menuBtnEl.style.display = show ? 'flex' : 'none';
    // Toggle the header layout so the other controls reflow around the menu
    // button (× | menu | ? | ⏸) instead of leaving a gap when it's hidden.
    var modal = (menuBtnEl.closest && menuBtnEl.closest('.light-again-modal')) || (overlayEl && overlayEl.querySelector('.light-again-modal'));
    if (modal) modal.classList.toggle('la-has-menu', show);
  }

  function dismissModeMenu() {
    if (!menuEl) return;
    var el = menuEl;
    menuEl = null;
    el.style.transition = 'opacity .22s ease';
    el.style.opacity = '0';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
  }

  function startWithMode(container, mode, fromActiveGame) {
    window.__laGameMode = mode;
    currentMode = mode;
    if (typeof window.__laOnModeChange === 'function') window.__laOnModeChange(mode);

    if (fromActiveGame && activeGame) {
      window.__laRestartPending = true;
      var LA = window.LightAgain;
      if (LA && typeof LA.injectLaRestartLoader === 'function') LA.injectLaRestartLoader(container);
      // Force layout so the loader is committed before the heavy scene restart.
      try { void container.offsetHeight; } catch (e) { /* ignore */ }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (activeGame && typeof activeGame.resume === 'function') activeGame.resume();
          if (activeGame && typeof activeGame.restart === 'function') activeGame.restart();
        });
      });
    } else {
      if (typeof window.createLightGame === 'function') {
        activeGame = window.createLightGame(container);
        activeGame.start();
      }
      // First-ever launch: auto-run the interactive tutorial once the scene
      // warms up (scene.update reads this flag after the loader clears). The
      // player came through the mode menu, so finishing returns there.
      if (!localStorage.getItem('la_tutorial_seen')) {
        window.__laStartTutorialOnReady = true;
        window.__laTutorialFromHome = true;
      }
    }
    clearPauseState(); // entering play → button shows ⏸, never a stale ▶
    updateMenuBtn();
  }

  /* Build the hardcore-unlock progress panel (enemy kill checklist) */
  // Home panel shown until the tutorial is finished: a progress bar + Resume /
  // Restart. Hardcore + the pickaxe skin unlock ONLY by finishing the tutorial.
  function buildTutorialPanel() {
    var fr = (localStorage.getItem('portfolio_lang') || 'fr') !== 'en';
    var LA = window.LightAgain;
    var total = (LA && LA.TUTORIAL_STEP_COUNT) || 10;
    var done = (LA && typeof LA.laGetTutorialProgress === 'function') ? LA.laGetTutorialProgress() : 0;
    done = Math.max(0, Math.min(done, total));
    var started = done > 0;
    var pct = Math.round(done / total * 100);
    var label = started
      ? (fr ? '\u00c9tape ' : 'Step ') + Math.min(done + 1, total) + ' / ' + total
      : (fr ? 'Pas encore commenc\u00e9' : 'Not started yet');
    return '' +
      '<div class="la-ms-tut">' +
        '<div class="la-ms-tut-hint">' + (fr
          ? 'Termine le tutoriel pour d\u00e9bloquer le mode Hardcore'
          : 'Finish the tutorial to unlock Hardcore mode') + '</div>' +
        '<div class="la-ms-bar la-ms-tut-bar"><span class="la-ms-bar-fill" style="width:' + pct + '%;background:#00ffff"></span></div>' +
        '<div class="la-ms-tut-label">' + label + '</div>' +
        '<div class="la-ms-tut-btns">' +
          (started ? '<button type="button" id="_la-tut-resume" class="la-ms-tut-btn la-ms-tut-btn--primary">' + (fr ? 'Reprendre \u25b6' : 'Resume \u25b6') + '</button>' : '') +
          '<button type="button" id="_la-tut-restart" class="la-ms-tut-btn">' + (started ? (fr ? 'Recommencer' : 'Restart') : (fr ? 'Commencer \u25b6' : 'Start \u25b6')) + '</button>' +
        '</div>' +
      '</div>';
  }

  function showModeMenu(container, fromActiveGame) {
    if (menuEl) return;
    var unlocked = laIsHardcoreUnlocked();
    // Pickaxe skin is a reward for unlocking hardcore — force off if still locked.
    window.__laSteveSkin = unlocked && (localStorage.getItem('la_skin_steve') === '1');

    if (!document.getElementById('_la-go-styles')) {
      var st = document.createElement('style');
      st.id = '_la-go-styles';
      st.textContent =
        '@keyframes la-go-fade-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}' +
        '@keyframes la-go-glow{0%,100%{box-shadow:0 0 0 0 rgba(0,255,255,0.2)}50%{box-shadow:0 0 22px 4px rgba(0,255,255,0.12)}}' +
        '@keyframes la-go-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    if (!document.getElementById('_la-ms-styles')) {
      var ms = document.createElement('style');
      ms.id = '_la-ms-styles';
      ms.textContent =
        '#_la-mode-select .la-ms-wrap{text-align:center;width:min(780px,94%);padding:2rem 1.5rem}' +
        '#_la-mode-select .la-ms-title{font-size:1rem;letter-spacing:.32em;color:#3a86b8;text-transform:uppercase;margin-bottom:1.8rem}' +
        '#_la-mode-select .la-ms-return{font-size:.55rem;letter-spacing:.2em;color:#445; text-transform:uppercase;margin-bottom:.5rem}' +
        '#_la-mode-select .la-ms-cards{display:flex;gap:1.2rem;justify-content:center;flex-wrap:wrap}' +
        '#_la-mode-select .la-ms-card{position:relative;flex:1 1 230px;max-width:320px;min-width:200px;padding:1.7rem 1.3rem 1.5rem;border-radius:16px;display:flex;flex-direction:column;align-items:center;gap:.65rem;transition:transform .2s ease,box-shadow .25s ease,border-color .25s ease,background .25s ease}' +
        '#_la-mode-select .la-ms-card--enabled{cursor:pointer}' +
        '#_la-mode-select .la-ms-card--enabled:hover{transform:translateY(-5px)}' +
        '#_la-mode-select .la-ms-card--sandbox{border:1px solid rgba(0,255,255,0.3);background:rgba(0,255,255,0.04)}' +
        '#_la-mode-select .la-ms-card--sandbox:hover{border-color:rgba(0,255,255,0.65);box-shadow:0 0 30px rgba(0,255,255,0.2);background:rgba(0,255,255,0.08)}' +
        '#_la-mode-select .la-ms-card--hardcore{border:1px solid rgba(255,70,20,0.32);background:rgba(255,45,0,0.035)}' +
        '#_la-mode-select .la-ms-card--hardcore.la-ms-card--enabled:hover{border-color:rgba(255,80,30,0.7);box-shadow:0 0 30px rgba(255,60,0,0.22);background:rgba(255,60,0,0.07)}' +
        '#_la-mode-select .la-ms-card--locked{border-style:dashed;cursor:not-allowed}' +
        '#_la-mode-select .la-ms-glyph{font-size:2.6rem;line-height:1}' +
        '#_la-mode-select .la-ms-name{font-size:1.4rem;font-weight:700;letter-spacing:.16em}' +
        '#_la-mode-select .la-ms-desc{font-size:.74rem;line-height:1.65;min-height:2.6em}' +
        '#_la-mode-select .la-ms-cta{margin-top:.4rem;padding:.55rem 1.7rem;border-radius:9px;font-size:.86rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}' +
        '#_la-mode-select .la-ms-bar{height:.5rem;border-radius:99px;background:rgba(255,255,255,0.07);overflow:hidden}' +
        '#_la-mode-select .la-ms-bar-fill{display:block;height:100%;border-radius:99px;transition:width .5s cubic-bezier(0.22,1,0.36,1)}' +
        '#_la-mode-select .la-ms-tut{margin-top:1.6rem;padding:1.2rem 1.3rem;border:1px solid rgba(0,255,255,0.18);border-radius:12px;background:rgba(0,255,255,0.03);text-align:center}' +
        '#_la-mode-select .la-ms-tut-hint{font-size:.68rem;letter-spacing:.04em;color:#6f9bc0;margin-bottom:1rem;line-height:1.55}' +
        '#_la-mode-select .la-ms-tut-bar{max-width:320px;margin:.2rem auto .7rem}' +
        '#_la-mode-select .la-ms-tut-label{font-size:.74rem;font-weight:700;color:#9fd4e8;letter-spacing:.06em;margin-bottom:1rem}' +
        '#_la-mode-select .la-ms-tut-btns{display:flex;gap:.7rem;justify-content:center;flex-wrap:wrap}' +
        '#_la-mode-select .la-ms-tut-btn{cursor:pointer;font-family:monospace;font-weight:700;font-size:.76rem;letter-spacing:.07em;padding:.55rem 1.3rem;border-radius:9px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.18);color:#cfe0ee;transition:transform .15s,background .2s,border-color .2s}' +
        '#_la-mode-select .la-ms-tut-btn:hover{transform:translateY(-2px);background:rgba(0,255,255,0.1);border-color:rgba(0,255,255,0.5)}' +
        '#_la-mode-select .la-ms-tut-btn--primary{background:rgba(0,255,255,0.12);border-color:rgba(0,255,255,0.55);color:#00ffff}' +
        '#_la-mode-select .la-ms-steve{display:inline-flex;align-items:center;gap:.5rem;margin-top:1.5rem;font-size:.74rem;letter-spacing:.05em;color:#8aa3c0;cursor:pointer;user-select:none;transition:color .2s}' +
        '#_la-mode-select .la-ms-steve:hover{color:#cfe6f5}' +
        '#_la-mode-select .la-ms-steve input{width:15px;height:15px;margin:0;accent-color:#5fe0cf;cursor:pointer}' +
        // Active-run highlight: a soft pulsing ring drawn via ::after so it never
        // fights the per-mode coloured hover box-shadow.
        '#_la-mode-select .la-ms-card--active::after{content:"";position:absolute;inset:-1px;border-radius:16px;pointer-events:none;border:1.5px solid rgba(143,233,192,0.45);box-shadow:0 0 22px rgba(143,233,192,0.12) inset;animation:la-ms-active-pulse 2.2s ease-in-out infinite}' +
        '@keyframes la-ms-active-pulse{0%,100%{opacity:.45}50%{opacity:.95}}' +
        // "En cours" badge pinned to the active card corner.
        '#_la-mode-select .la-ms-active-badge{position:absolute;top:.65rem;right:.65rem;z-index:2;display:flex;align-items:center;gap:.32rem;font-size:.52rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase;padding:.22rem .55rem;border-radius:99px;background:rgba(143,233,192,0.1);border:1px solid rgba(143,233,192,0.32);color:#8fe9c0}' +
        '#_la-mode-select .la-ms-active-badge::before{content:"";width:6px;height:6px;border-radius:50%;background:#8fe9c0;box-shadow:0 0 6px #8fe9c0;animation:la-ms-active-pulse 1.4s ease-in-out infinite}' +
        // Footer tip line (menu icon doubles as pause).
        '#_la-mode-select .la-ms-tip{margin-top:1.35rem;font-size:.62rem;letter-spacing:.03em;line-height:1.55;color:#5d7f9c;opacity:.9}' +
        '#_la-mode-select .la-ms-tip b{color:#8fb6d6;font-weight:700}';
      document.head.appendChild(ms);
    }

    menuEl = document.createElement('div');
    menuEl.id = '_la-mode-select';
    menuEl.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:60',
      'display:flex', 'align-items:center', 'justify-content:center',
      // Lighter scrim than before so the running game stays visible behind the menu.
      'background:rgba(4,5,18,0.66)', 'font-family:monospace', 'overflow-y:auto',
      'animation:la-go-fade-in 0.32s cubic-bezier(0.22,1,0.36,1) both',
    ].join(';');

    // Which mode (if any) has a live run behind this menu — drives the card
    // highlight + "En cours" badge so the player sees at a glance where they were.
    var fr = (localStorage.getItem('portfolio_lang') || 'fr') !== 'en';
    var sbActive = fromActiveGame && currentMode === 'sandbox';
    var hcActive = fromActiveGame && currentMode === 'hardcore';
    var activeBadge = '<div class="la-ms-active-badge">' + (fr ? 'En cours' : 'In progress') + '</div>';

    var hcCardCls = 'la-ms-card la-ms-card--hardcore ' + (unlocked ? 'la-ms-card--enabled' : 'la-ms-card--locked') + (hcActive ? ' la-ms-card--active' : '');
    var hcCol = unlocked ? '#ff5530' : '#7a4634';
    var hcCtaStyle = unlocked
      ? 'border:1.5px solid rgba(255,70,20,0.55);background:rgba(255,70,20,0.12);color:#ff5530'
      : 'border:1.5px solid rgba(255,70,20,0.2);background:rgba(255,70,20,0.05);color:#8a5240';

    menuEl.innerHTML =
      '<div class="la-ms-wrap">' +
      (fromActiveGame ? '<div class="la-ms-return">' + tG('laMenuReturnTitle') + '</div>' : '') +
      '<div class="la-ms-title">' + tG('laModeSelectTitle') + '</div>' +
      '<div class="la-ms-cards">' +

      // SANDBOX card
      '<div id="_la-ms-sandbox" class="la-ms-card la-ms-card--sandbox la-ms-card--enabled' + (sbActive ? ' la-ms-card--active' : '') + '" role="button" tabindex="0">' +
        (sbActive ? activeBadge : '') +
        '<div class="la-ms-glyph" style="color:#00ffff">\u221e</div>' +
        '<div class="la-ms-name" style="color:#00ffff">SANDBOX</div>' +
        '<div class="la-ms-desc" style="color:#6f93b8">' + tG('laModeSandboxDesc') + '</div>' +
        '<div class="la-ms-cta" style="border:1.5px solid rgba(0,255,255,0.5);background:rgba(0,255,255,0.1);color:#00ffff">' + ((fromActiveGame && currentMode === 'sandbox') ? tG('laModeResume') : tG('laGoPlay')) + '</div>' +
      '</div>' +

      // HARDCORE card
      '<div id="_la-ms-hardcore" class="' + hcCardCls + '"' + (unlocked ? ' role="button" tabindex="0"' : '') + '>' +
        (hcActive ? activeBadge : '') +
        '<div class="la-ms-glyph" style="color:' + hcCol + '">\u2620</div>' +
        '<div class="la-ms-name" style="color:' + hcCol + '">HARDCORE</div>' +
        '<div class="la-ms-desc" style="color:' + (unlocked ? '#a8744f' : '#6a4233') + '">' + tG('laModeHardcoreDesc') + '</div>' +
        '<div class="la-ms-cta" style="' + hcCtaStyle + '">' + ((fromActiveGame && currentMode === 'hardcore') ? tG('laModeResume') : (unlocked ? tG('laGoPlay') : '\ud83d\udd12 ' + tG('laModeHardcoreLocked'))) + '</div>' +
      '</div>' +

      '</div>' +
      '<div class="la-ms-tip">' + (fr
        ? '💡 L’icône <b>menu</b> (en haut à droite) sert aussi à mettre la partie <b>en pause</b>.'
        : '💡 The <b>menu</b> icon (top right) also <b>pauses</b> the game during a run.') + '</div>' +
      (unlocked ? '' : buildTutorialPanel()) +
      // Cosmetic pickaxe skin — unlocked alongside hardcore mode as a reward
      (unlocked ? '<label class="la-ms-steve"><input type="checkbox" id="_la-ms-steve-cb"><span>I am Steve</span></label>' : '') +
      '</div>';

    container.style.position = 'relative';
    container.appendChild(menuEl);

    var sbBtn = menuEl.querySelector('#_la-ms-sandbox');
    var hcBtn = menuEl.querySelector('#_la-ms-hardcore');
    var steveCb = menuEl.querySelector('#_la-ms-steve-cb');
    if (steveCb) {
      steveCb.checked = !!window.__laSteveSkin;
      steveCb.addEventListener('change', function () {
        window.__laSteveSkin = steveCb.checked;
        try { localStorage.setItem('la_skin_steve', steveCb.checked ? '1' : '0'); } catch (e) { /* ignore */ }
      });
    }

    // Tutorial progress panel: Resume (from the saved step) / Restart (from 0).
    // Both route through startTutorialFlow, which dismisses this menu and launches.
    var tutResumeBtn = menuEl.querySelector('#_la-tut-resume');
    var tutRestartBtn = menuEl.querySelector('#_la-tut-restart');
    if (tutResumeBtn) tutResumeBtn.addEventListener('click', function () {
      var LA = window.LightAgain;
      var step = (LA && typeof LA.laGetTutorialProgress === 'function') ? LA.laGetTutorialProgress() : 0;
      startTutorialFlow(step, true);   // from home → returns to home on skip/finish
    });
    if (tutRestartBtn) tutRestartBtn.addEventListener('click', function () { startTutorialFlow(0, true); });

    // Resume the current (paused) run without restarting it. "Reprendre" always
    // resumes — even if the player had manually paused before opening the menu —
    // and clears the pause state so the button can't stay stuck on ▶.
    function resumeGame() {
      dismissModeMenu();
      clearPauseState();
      if (activeGame && typeof activeGame.resume === 'function') activeGame.resume();
    }
    // Each card "Resumes" the CURRENT run when the menu was opened from that same
    // mode; otherwise it (re)starts that mode. From the launch menu it starts fresh.
    function chooseSandbox() {
      if (fromActiveGame && currentMode === 'sandbox') { resumeGame(); return; }
      dismissModeMenu();
      startWithMode(container, 'sandbox', fromActiveGame);
    }
    function chooseHardcore() {
      if (fromActiveGame && currentMode === 'hardcore') { resumeGame(); return; }
      dismissModeMenu();
      startWithMode(container, 'hardcore', fromActiveGame);
    }

    sbBtn.addEventListener('click', chooseSandbox);
    sbBtn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseSandbox(); } });

    if (unlocked) {
      hcBtn.addEventListener('click', chooseHardcore);
      hcBtn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseHardcore(); } });
    }
    sbBtn.focus();
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

  // Game is (re)entering a running state from the mode menu — drop any pause
  // (manual or menu-induced) and resync the pause button to the "playing" icon,
  // so it never shows ▶ while the player can actually move.
  function clearPauseState() {
    userPaused = false;
    if (overlayEl) updatePauseBtnUi(overlayEl.querySelector('.light-again-pause-btn'));
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
      {
        label:    isFr ? 'Vitesse \u00b7 Bac \u00e0 sable' : 'Speed \u00b7 Sandbox',
        color:    '#39c6ff',
        descHtml: isFr
          ? 'Molette de la souris \u2014 <span style="color:#39c6ff">acc\u00e9l\u00e8re</span> (vers le haut) ou <span style="color:#39c6ff">ralentit</span> (vers le bas) l\u2019apparition des ennemis. La vitesse actuelle s\u2019affiche au-dessus du vaisseau.'
          : 'Mouse wheel \u2014 spawns <span style="color:#39c6ff">speed up</span> (scroll up) or <span style="color:#39c6ff">calm down</span> (scroll down). The current speed shows above your ship.',
      },
      {
        label:    isFr ? 'Vider l\u2019\u00e9cran \u00b7 Bac \u00e0 sable' : 'Clear board \u00b7 Sandbox',
        color:    '#66ddff',
        descHtml: isFr
          ? '<span class="la-help-dash">Suppr</span> ou <span class="la-help-dash">Retour arri\u00e8re</span> \u2014 une onde de choc part du vaisseau et balaie l\u2019\u00e9cran pour d\u00e9truire tous les ennemis (sans points).'
          : '<span class="la-help-dash">Delete</span> or <span class="la-help-dash">Backspace</span> \u2014 a shockwave bursts from your ship and sweeps the screen, destroying every enemy (no points).',
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

  /* ---- Shared term colors (mirror the in-game color code) ----
     dash = cyan · dash-attack = pink · torpedo = red · mark/nuke = blue
     combo/points = yellow · shield = cyan · scout/shooter/bruiser = red/orange/purple */
  var COL_DATK = '#ff14c8', COL_TORP = '#ff1e3c', COL_MARK = '#2a9fd6',
      COL_COMBO = '#ffcc00', COL_SHIELD = '#00ffff',
      COL_SCOUT = '#ff3b56', COL_SHOOTER = '#ffaa22', COL_BRUISER = '#b066ff';
  function hSpan(color, txt) { return '<span style="color:' + color + '">' + txt + '</span>'; }
  function hDash(word) { return '<span class="la-help-dash">' + word + '</span>'; }

  /* ---- Page 2: enemy bestiary ---- */
  function buildHelpEnemiesPage(isFr) {
    var enemies = [
      {
        glyph: '▲', color: COL_SCOUT,
        name:  isFr ? 'Éclaireur' : 'Scout',
        desc:  isFr
          ? 'Fonce droit sur toi. Fragile : <strong>1 PV</strong>, un seul coup l’élimine.'
          : 'Charges straight at you. Fragile: <strong>1 HP</strong>, a single hit destroys it.',
      },
      {
        glyph: '◆', color: COL_SHOOTER,
        name:  isFr ? 'Tireur' : 'Shooter',
        desc:  isFr
          ? 'Garde ses distances et tire des projectiles. Une ' + hSpan(COL_DATK, 'dash-attaque') + ' sur un projectile le ' + hSpan(COL_DATK, 'renvoie') + ' à l’envoyeur — ' + hSpan(COL_COMBO, 'x2 points') + '.'
          : 'Keeps its distance and fires projectiles. A ' + hSpan(COL_DATK, 'dash-attack') + ' on a projectile ' + hSpan(COL_DATK, 'reflects') + ' it back at the sender — ' + hSpan(COL_COMBO, 'x2 points') + '.',
      },
      {
        glyph: '⬢', color: COL_BRUISER,
        name:  isFr ? 'Mastodonte' : 'Bruiser',
        desc:  isFr
          ? 'Lent mais coriace : <strong>2 PV</strong> + un ' + hSpan(COL_SHIELD, 'bouclier') + ' que seule la ' + hSpan(COL_DATK, 'dash-attaque') + ' brise. Il ' + hSpan(COL_SCOUT, 'fait apparaître des ennemis') + ' en continu. Le plus simple : ' + hSpan(COL_MARK, 'marque-le') + ' au ' + hDash('dash') + ' puis ' + hSpan(COL_MARK, 'nuke') + ' — élimination instantanée, bouclier ignoré.'
          : 'Slow but tough: <strong>2 HP</strong> + a ' + hSpan(COL_SHIELD, 'shield') + ' that only the ' + hSpan(COL_DATK, 'dash-attack') + ' can break. It ' + hSpan(COL_SCOUT, 'spawns enemies') + ' non-stop. Easiest way: ' + hSpan(COL_MARK, 'mark it') + ' with a ' + hDash('dash') + ' then ' + hSpan(COL_MARK, 'nuke') + ' — instant kill, shield ignored.',
      },
    ];

    var page = document.createElement('div');
    page.className = 'light-again-help-page';
    var wrap = document.createElement('div');
    wrap.className = 'la-help-enemies';
    enemies.forEach(function (en) {
      var row = document.createElement('div');
      row.className = 'la-help-enemy';
      row.innerHTML =
        '<span class="la-help-enemy__glyph" style="color:' + en.color + '">' + en.glyph + '</span>' +
        '<div class="la-help-enemy__body">' +
          '<div class="la-help-enemy__name" style="color:' + en.color + '">' + en.name + '</div>' +
          '<div class="la-help-enemy__desc">' + en.desc + '</div>' +
        '</div>';
      wrap.appendChild(row);
    });
    page.appendChild(wrap);
    return page;
  }

  /* ---- Page 3: progression (upgrades + shields) ---- */
  function buildHelpProgressPage(isFr) {
    var page = document.createElement('div');
    page.className = 'light-again-help-page';
    page.innerHTML =
      '<div class="la-help-sections">' +
        '<section class="la-help-sec">' +
          '<h3 class="la-help-sec-title">' + (isFr ? 'Améliorations' : 'Upgrades') + '</h3>' +
          (isFr
            ? '<p>Tous les <strong>200 ennemis</strong> éliminés, le temps ' + hSpan(COL_SHIELD, 'ralentit') + ' et tu choisis <strong>1 amélioration sur 2</strong>.</p>' +
              '<p>5 branches, 2 niveaux chacune : ' + hSpan(COL_DATK, 'Dash-Attaque') + ', ' + hSpan(COL_MARK, 'Détonation') + ', ' + hDash('Dash') + ', ' + hSpan(COL_TORP, 'Attaque Torpille') + ' et ' + hSpan(COL_SHIELD, 'Shield') + '.</p>' +
              '<p class="la-help-secret">🕒 Un pouvoir secret se débloque en jouant…</p>'
            : '<p>Every <strong>200 enemies</strong> killed, time ' + hSpan(COL_SHIELD, 'slows down') + ' and you pick <strong>1 of 2 upgrades</strong>.</p>' +
              '<p>5 branches, 2 levels each: ' + hSpan(COL_DATK, 'Dash-Attack') + ', ' + hSpan(COL_MARK, 'Detonation') + ', ' + hDash('Dash') + ', ' + hSpan(COL_TORP, 'Torpedo Attack') + ' and ' + hSpan(COL_SHIELD, 'Shield') + '.</p>' +
              '<p class="la-help-secret">🕒 A secret power unlocks as you play…</p>'
          ) +
        '</section>' +
        '<section class="la-help-sec">' +
          '<h3 class="la-help-sec-title" style="color:' + COL_SHIELD + '">Shields</h3>' +
          (isFr
            ? '<p>Le ' + hSpan(COL_SHIELD, 'shield') + ' absorbe un coup sans te tuer (mais ' + hSpan(COL_COMBO, 'casse ton combo') + ').</p>' +
              '<p>Tu démarres avec 1. Atteins un ' + hSpan(COL_COMBO, 'combo x10') + ' pour en regagner un.</p>' +
              '<p>L’amélioration ' + hSpan(COL_SHIELD, 'Shield') + ' ajoute des emplacements — jusqu’à <strong>3</strong>.</p>'
            : '<p>The ' + hSpan(COL_SHIELD, 'shield') + ' absorbs one hit without killing you (but ' + hSpan(COL_COMBO, 'breaks your combo') + ').</p>' +
              '<p>You start with 1. Reach a ' + hSpan(COL_COMBO, 'combo x10') + ' to earn another.</p>' +
              '<p>The ' + hSpan(COL_SHIELD, 'Shield') + ' upgrade adds slots — up to <strong>3</strong>.</p>'
          ) +
        '</section>' +
      '</div>';
    return page;
  }

  function showHelpPopup() {
    if (helpPopupEl || !overlayEl) return;
    var modal = overlayEl.querySelector('.light-again-modal');
    // Pause game loop
    if (activeGame && typeof activeGame.pause === 'function') activeGame.pause();

    var lang = localStorage.getItem('portfolio_lang') || 'fr';
    var isFr = lang !== 'en';

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

    // ---- Build pages (page 1 reuses the existing controls list) ----
    var ctrlPage = document.createElement('div');
    ctrlPage.className = 'light-again-help-page';
    ctrlPage.appendChild(buildHelpRows());

    var pages = [
      { title: isFr ? 'Contrôles'   : 'Controls',    node: ctrlPage },
      { title: isFr ? 'Les ennemis' : 'Enemies',     node: buildHelpEnemiesPage(isFr) },
      { title: isFr ? 'Progression' : 'Progression', node: buildHelpProgressPage(isFr) },
    ];
    var pagesWrap = document.createElement('div');
    pagesWrap.className = 'light-again-help-pages';
    pages.forEach(function (pg) { pagesWrap.appendChild(pg.node); });

    // ---- Footer navigation (back · dots · next/play) ----
    var nav = document.createElement('div');
    nav.className = 'light-again-help-nav';

    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'light-again-help-nav-btn light-again-help-nav-btn--back';
    backBtn.textContent = isFr ? '‹ Précédent' : '‹ Back';

    var dots = document.createElement('div');
    dots.className = 'light-again-help-dots';
    var dotEls = pages.map(function (pg, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'light-again-help-dot';
      d.setAttribute('aria-label', pg.title);
      d.addEventListener('click', function () { current = i; render(); });
      dots.appendChild(d);
      return d;
    });

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'light-again-help-nav-btn';

    nav.appendChild(backBtn);
    nav.appendChild(dots);
    nav.appendChild(nextBtn);

    var current = 0;
    function render() {
      title.textContent = pages[current].title;
      pages.forEach(function (pg, i) { pg.node.style.display = (i === current) ? '' : 'none'; });
      dotEls.forEach(function (d, i) { d.classList.toggle('light-again-help-dot--active', i === current); });
      backBtn.style.visibility = (current === 0) ? 'hidden' : 'visible';
      var last = (current === pages.length - 1);
      nextBtn.textContent = last ? (isFr ? 'Jouer ▶' : 'Play ▶') : (isFr ? 'Suivant ›' : 'Next ›');
      nextBtn.classList.toggle('light-again-help-nav-btn--play', last);
    }
    function go(delta) {
      var n = current + delta;
      if (n < 0) return;
      if (n >= pages.length) { closeHelpPopup(false); return; }
      current = n;
      render();
    }
    backBtn.addEventListener('click', function () { go(-1); });
    nextBtn.addEventListener('click', function () { go(1); });
    render();

    popup.appendChild(closeBtn);
    popup.appendChild(title);
    popup.appendChild(pagesWrap);
    popup.appendChild(nav);
    helpPopupEl.appendChild(popup);
    if (modal) modal.appendChild(helpPopupEl);

    // Click on backdrop (outside popup panel) closes the help popup
    helpPopupEl.addEventListener('click', function (e) {
      if (e.target === helpPopupEl) closeHelpPopup(false);
    });

    // Keyboard page nav (Escape is handled by the overlay-level listener)
    helpPopupEl._onPageKey = function (e) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    };
    document.addEventListener('keydown', helpPopupEl._onPageKey);

    void helpPopupEl.offsetHeight;
    helpPopupEl.classList.add('light-again-help-overlay--visible');
    nextBtn.focus();
  }

  function isLightAgainGameOverOpen() {
    if (!overlayEl) return false;
    var host = overlayEl.querySelector('.light-again-canvas');
    return !!(host && host.dataset && host.dataset.laGameover === '1');
  }

  function closeHelpPopup(skipResume) {
    if (!helpPopupEl) return;
    // Detach the page-navigation keyboard listener (added in showHelpPopup)
    if (helpPopupEl._onPageKey) {
      document.removeEventListener('keydown', helpPopupEl._onPageKey);
      helpPopupEl._onPageKey = null;
    }
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
      // Resume sauf si pause manuelle, game-over, ou upgrade draft ouvert (scène doit rester figée)
      var upgradeDraftOpen = !!document.getElementById('_la-upgrade-overlay');
      if (!isLightAgainGameOverOpen() && !userPaused && !upgradeDraftOpen && activeGame && typeof activeGame.resume === 'function') {
        activeGame.resume();
      }
      var hb = overlayEl && overlayEl.querySelector('.light-again-help-btn:not(.light-again-pause-btn)');
      if (hb) hb.focus();
    }
  }

  /* ================================================================
     TUTORIAL — launch flow (the ? button + first launch)
     The static help popup (showHelpPopup) survives as a reference,
     reachable from the tutorial overlay's "Voir l'aide" link.
     ================================================================ */

  // step:     0-based step to start at (home "Resume" passes the saved step;
  //           the ? button and "Restart" pass 0 for a full run).
  // fromHome: true when launched from the home menu (skip/finish returns there);
  //           false when launched in-place via the ? button (stays in the run).
  function startTutorialFlow(step, fromHome) {
    var container = overlayEl && overlayEl.querySelector('.light-again-canvas');
    if (!container) return;
    // Can't cleanly reset while an upgrade draft / confirm is mid-flow.
    if (document.getElementById('_la-upgrade-overlay')) return;
    if (document.getElementById('_la-tutorial-confirm')) return;

    step = step || 0;
    window.__laTutorialStartStep = step;     // consumed by the scene / _startTutorial
    window.__laTutorialFromHome  = !!fromHome;
    var sc = window.__laSceneRef;

    // No live game yet (mode menu showing) or a finished run on screen:
    // (re)launch a fresh sandbox session that auto-starts the tutorial.
    if (!activeGame || !sc || isLightAgainGameOverOpen()) {
      if (helpPopupEl) closeHelpPopup(true);
      dismissModeMenu();
      window.__laStartTutorialOnReady = true;
      if (activeGame && sc) startWithMode(container, 'sandbox', true);   // restart current scene
      else                  startWithMode(container, 'sandbox', false);  // boot a fresh game
      return;
    }

    // Live HARDCORE run: warn that starting the tutorial ends it, then relaunch
    // in sandbox (the tutorial always runs under sandbox's forgiving rules).
    if (currentMode === 'hardcore') {
      showTutorialConfirm(container);
      return;
    }

    // Live SANDBOX run: start the tutorial in place.
    if (helpPopupEl) closeHelpPopup(true);
    dismissModeMenu();  // no-op if closed; else the opaque menu (z60) would cover the tutorial (z56)
    clearPauseState();
    if (typeof activeGame.resume === 'function') activeGame.resume();
    sc._startTutorial(step);
  }

  function showTutorialConfirm(container) {
    if (document.getElementById('_la-tutorial-confirm')) return;
    var fr = (localStorage.getItem('portfolio_lang') || 'fr') !== 'en';

    // Freeze the doomed hardcore run behind the dialog.
    if (activeGame && typeof activeGame.pause === 'function') activeGame.pause();

    var ov = document.createElement('div');
    ov.id = '_la-tutorial-confirm';
    ov.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:62',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(4,5,18,0.9)', 'font-family:monospace',
    ].join(';');
    ov.innerHTML =
      '<div style="text-align:center;max-width:min(420px,92%);padding:1.8rem 1.6rem;border-radius:16px;' +
        'background:rgba(8,10,24,0.96);border:1px solid rgba(255,80,30,0.4);box-shadow:0 0 40px rgba(255,60,0,0.12)">' +
        '<div style="font-size:2rem;margin-bottom:.6rem">⚠️</div>' +
        '<div style="font-size:.95rem;font-weight:700;color:#ffb499;margin-bottom:.7rem;letter-spacing:.04em">' +
          (fr ? 'Lancer le tutoriel ?' : 'Start the tutorial?') + '</div>' +
        '<div style="font-size:.78rem;line-height:1.6;color:#c8b0a8;margin-bottom:1.4rem">' +
          (fr ? 'Cela mettra fin à ta partie <b style="color:#ff5530">Hardcore</b> en cours. Le tutoriel se déroule en <b style="color:#00ffff">Sandbox</b>.'
              : 'This will end your current <b style="color:#ff5530">Hardcore</b> run. The tutorial runs in <b style="color:#00ffff">Sandbox</b>.') + '</div>' +
        '<div style="display:flex;gap:.8rem;justify-content:center">' +
          '<button id="_la-tc-cancel" type="button" style="cursor:pointer;font-family:monospace;font-weight:700;font-size:.78rem;padding:.5rem 1.2rem;border-radius:9px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);color:#cfe0ee">' +
            (fr ? 'Annuler' : 'Cancel') + '</button>' +
          '<button id="_la-tc-go" type="button" style="cursor:pointer;font-family:monospace;font-weight:800;font-size:.78rem;letter-spacing:.06em;padding:.5rem 1.3rem;border-radius:9px;background:rgba(0,255,255,0.12);border:1.5px solid rgba(0,255,255,0.55);color:#00ffff">' +
            (fr ? 'Lancer le tuto ▶' : 'Start tutorial ▶') + '</button>' +
        '</div>' +
      '</div>';

    container.style.position = 'relative';
    container.appendChild(ov);

    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }

    ov.querySelector('#_la-tc-cancel').addEventListener('click', function () {
      close();
      clearPauseState();
      if (activeGame && typeof activeGame.resume === 'function') activeGame.resume();
    });
    ov.querySelector('#_la-tc-go').addEventListener('click', function () {
      close();
      window.__laStartTutorialOnReady = true;
      startWithMode(container, 'sandbox', true);  // ends hardcore, restarts as sandbox + tutorial
    });
    var goBtn = ov.querySelector('#_la-tc-go');
    if (goBtn) goBtn.focus();
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

    // Help button (?) — left of close. Launches the interactive tutorial from
    // the start (the static reference popup stays reachable from inside it).
    // fromHome=false: launched mid-run, so finishing/skipping stays in-game.
    var helpBtn = document.createElement('button');
    helpBtn.className = 'light-again-help-btn';
    helpBtn.textContent = '?';
    helpBtn.setAttribute('aria-label', t('lightAgainHelp'));
    helpBtn.addEventListener('click', function () { startTutorialFlow(0, false); });

    // Phaser container (Phaser creates its own canvas inside)
    var container = document.createElement('div');
    container.className = 'light-again-canvas'; // reuses existing CSS sizing rules
    container.style.width  = '100%';
    container.style.height = '100%';

    // Sandbox "Menu" button — visible only in sandbox mode, left-side header
    menuBtnEl = document.createElement('button');
    menuBtnEl.type = 'button';
    menuBtnEl.className = 'light-again-help-btn light-again-menu-btn';
    menuBtnEl.innerHTML =
      '<svg class="light-again-menu-btn__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M12 3 2 12h3v8h5v-6h4v6h5v-8h3L12 3z"/>' +
      '</svg>';
    menuBtnEl.setAttribute('aria-label', t('laMenuBtn') || 'Menu');
    menuBtnEl.setAttribute('title', t('laMenuBtn') || 'Menu');
    menuBtnEl.style.display = 'none';
    menuBtnEl.addEventListener('click', function () {
      if (!activeGame || !container) return;
      if (typeof activeGame.pause === 'function') activeGame.pause();
      showModeMenu(container, true);
    });

    modal.appendChild(menuBtnEl);
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

    /* --- Show mode-select menu (game will be started by menu choice) --- */
    window.__laOnModeChange = function (mode) {
      currentMode = mode;
      window.__laGameMode = mode;
      updateMenuBtn();
    };
    // Tutorial ↔ shell bridge: react to tutorial start/stop (hide the Menu btn),
    // let the tutorial overlay open the static reference popup, and let Skip bounce
    // back to the home/mode-select menu (where the progress bar lives).
    window.__laOnTutorialChange = function () { updateMenuBtn(); };
    window.__laOpenReference = showHelpPopup;
    window.__laShowHome = function () {
      if (!overlayEl) return;
      var c = overlayEl.querySelector('.light-again-canvas');
      if (!c) return;
      if (activeGame && typeof activeGame.pause === 'function') activeGame.pause();
      showModeMenu(c, true);
    };
    showModeMenu(container, false);
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

    // Clear restart flag — prevents stale __laRestartPending=true from making the next
    // open use '_la-restart-loading' while start() creates '_la-loading' (mismatched IDs → infinite loader)
    window.__laRestartPending = false;

    // Clean up mode state
    dismissModeMenu();
    menuBtnEl = null;
    currentMode = null;
    window.__laGameMode = null;
    window.__laOnModeChange = null;

    // Tutorial state is per-session — clear so a reopen starts clean.
    window.__laTutorialActive = false;
    window.__laStartTutorialOnReady = false;
    window.__laTutorialStartStep = 0;
    window.__laTutorialFromHome = false;
    window.__laOnTutorialChange = null;
    window.__laOpenReference = null;
    window.__laShowHome = null;

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
    // Pickaxe skin flag (reward — only honoured once hardcore is unlocked)
    window.__laSteveSkin = laIsHardcoreUnlocked() && (localStorage.getItem('la_skin_steve') === '1');

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

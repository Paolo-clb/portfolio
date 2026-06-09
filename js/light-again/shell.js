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
  var menuResumable = false; // true while the open home menu has a LIVE run to resume

  /* ---- Gamepad menu navigation (see the section near openLightAgain) ---- */
  var padRafId     = null;  // requestAnimationFrame handle for the menu-poll loop
  var homeToggleFn = null;  // set in openLightAgain — Home/Start ⇒ pause/resume toggle
  var padFirst     = true;  // skip the first poll so a button held at open can't fire
  var padNavEl     = null;  // element the gamepad currently has "focused"
  var padNavOv     = null;  // overlay that focus belongs to (re-acquire when it changes)
  var padDir       = 0;     // latched nav direction (-1 up/left · 0 · +1 down/right)
  var padRepeatAt  = 0;     // timestamp the held-direction repeat is allowed to fire
  var padPrev2     = { home: false, start: false, a: false, b: false,
                       up: false, down: false, left: false, right: false };

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

  // The header button doubles as the pause / resume toggle. Icon mirrors the run
  // state: ⏸ (two bars) while playing, ▶ while the home (mode-select) menu is open
  // — because opening the home pauses the run.
  function menuPauseIconSvg() {
    return '<svg class="light-again-menu-btn__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>';
  }
  function menuPlayIconSvg() {
    return '<svg class="light-again-menu-btn__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="9 6 9 18 18 12 9 6"/></svg>';
  }
  function updateMenuBtnIcon() {
    if (!menuBtnEl) return;
    var onHome = !!menuEl;  // home menu open ⇒ the run is paused ⇒ show ▶
    menuBtnEl.innerHTML = onHome ? menuPlayIconSvg() : menuPauseIconSvg();
    var lbl = onHome ? t('lightAgainResume') : t('lightAgainPause');
    menuBtnEl.setAttribute('aria-label', lbl);
    menuBtnEl.setAttribute('title', lbl);
  }

  function updateMenuBtn() {
    if (!menuBtnEl) return;
    // Home button is available whenever a run is active — sandbox, hardcore, and
    // during the tutorial (which runs under sandbox mode). But once the home menu
    // is open with nothing to resume (fresh launch / dead game-over run), the ▶
    // would be a dead no-op — so hide it entirely rather than show an inert button.
    var show = (currentMode === 'sandbox' || currentMode === 'hardcore') &&
               !(menuEl && !menuResumable);
    menuBtnEl.style.display = show ? 'flex' : 'none';
    // Toggle the header layout so the other controls reflow around the menu
    // button (× | menu | ? | ⏸) instead of leaving a gap when it's hidden.
    var modal = (menuBtnEl.closest && menuBtnEl.closest('.light-again-modal')) || (overlayEl && overlayEl.querySelector('.light-again-modal'));
    if (modal) modal.classList.toggle('la-has-menu', show);
    updateMenuBtnIcon();
  }

  // `instant`: skip the fade and rip the menu out this frame. Used when resuming
  // a live run — the game un-pauses immediately, so a lingering fading scrim over
  // it just gets in the way. Other dismissals (starting a new run, leaving) fade.
  function dismissModeMenu(instant) {
    if (!menuEl) return;
    var el = menuEl;
    menuEl = null;
    updateMenuBtn();   // home closing ⇒ re-show the ⏸ toggle (was hidden if non-resumable)
    if (instant) {
      if (el.parentNode) el.parentNode.removeChild(el);
      return;
    }
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
    // Visualizer: switch to the in-game look (artist label hidden, music un-muffled).
    if (window.LAViz) window.LAViz.toGame();
  }

  /* Build the hardcore-unlock progress panel (enemy kill checklist) */
  // Home panel shown until the tutorial is finished: a progress bar + Resume /
  // Restart. Hardcore + the pickaxe skin unlock ONLY by finishing the tutorial.
  function buildTutorialPanel() {
    var fr = (localStorage.getItem('portfolio_lang') || 'fr') !== 'en';
    var LA = window.LightAgain;
    var total = (LA && LA.TUTORIAL_STEP_COUNT) || 11;
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
        '<div class="la-ms-bar la-ms-tut-bar"><span class="la-ms-bar-fill" style="width:' + pct + '%;background:var(--la-accent)"></span></div>' +
        '<div class="la-ms-tut-label">' + label + '</div>' +
        '<div class="la-ms-tut-btns">' +
          (started ? '<button type="button" id="_la-tut-resume" class="la-ms-tut-btn la-ms-tut-btn--primary">' + (fr ? 'Reprendre \u25b6' : 'Resume \u25b6') + '</button>' : '') +
          '<button type="button" id="_la-tut-restart" class="la-ms-tut-btn">' + (started ? (fr ? 'Recommencer' : 'Restart') : (fr ? 'Commencer \u25b6' : 'Start \u25b6')) + '</button>' +
        '</div>' +
      '</div>';
  }

  /* ================================================================
     RUN LOADOUT — upgrades unlocked in the resumable run, shown under
     the active mode card. Reads the LIVE scene (window.__laSceneRef):
     while the menu is up the run is paused, not destroyed, so nothing
     needs persisting. Per-level colours mirror the in-game HUD
     (cyan Lv1 · gold Lv2 · violet Lv3). Hovering a chip reveals all
     three levels — the ones reached are coloured, the rest greyed.
     ================================================================ */
  function laLevelColor(n) {
    return n >= 3 ? '#b478ff' : (n >= 2 ? '#ffc832' : '#00ffff');
  }

  // Semantic glyphs for the NON-upgrade chips only: curse (warning) + The World
  // (clock). Upgrades render the shared placeholder (LA.iconPlaceholderSvg) until
  // real art lands — so there's deliberately no per-branch art here.
  function laUpGlyphInner(id) {
    switch (id) {
      case 'curse':    return '<path d="M12 4l9 15H3z"/><line x1="12" y1="10" x2="12" y2="14.4"/><circle cx="12" cy="16.8" r="0.7"/>';
      case 'theWorld': return '<circle cx="12" cy="12" r="8"/><line x1="12" y1="12" x2="12" y2="7"/><line x1="12" y1="12" x2="15.4" y2="13.5"/>';
      default:         return '<circle cx="12" cy="12" r="7"/>';
    }
  }
  function laSvg(inner) {
    return '<svg class="la-lo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  // One chip icon: upgrades → shared placeholder; curse/The World → semantic glyph.
  function laLoadoutIcon(it) { return window.LightAgain.iconSvg(it.glyphId, 'la-lo-svg'); }

  // Build the loadout section HTML for a live scene + a wire() that hooks up
  // the hover/focus → detail behaviour. Returns null only if there's no scene.
  function buildLoadoutSection(sc) {
    if (!sc) return null;
    var LA = window.LightAgain || {};
    var UP = LA.UPGRADES || {};
    var CU = LA.CURSES || {};
    var lvls = sc._upgradeLevels || {};
    var tcz  = sc._takenCurses || {};
    var order      = ['dashAtk', 'detonation', 'dash', 'baseAtk', 'shield', 'drone', 'core', 'prism'];
    var curseOrder = ['glassHeart', 'dashRage', 'cursedBlast'];

    var items = [];   // { kind, glyphId, color, name, lvl, maxLvl, levels:[{n,txt,on,color}] }
    var i, n;
    for (i = 0; i < order.length; i++) {
      var id = order[i], lvl = lvls[id] || 0;
      if (lvl > 0 && UP[id]) {
        var def = UP[id], max = def.maxLvl || 3, levels = [];
        for (n = 1; n <= max; n++) {
          var dk = n >= 3 ? def.i18nDesc3 : (n === 2 ? def.i18nDesc2 : def.i18nDesc1);
          levels.push({ n: n, txt: t(dk), on: n <= lvl, color: laLevelColor(n) });
        }
        items.push({ kind: 'up', glyphId: id, color: laLevelColor(lvl), name: t(def.i18nName), lvl: lvl, maxLvl: max, levels: levels });
      }
    }
    for (i = 0; i < curseOrder.length; i++) {
      var cid = curseOrder[i];
      if (tcz[cid] && CU[cid]) {
        items.push({ kind: 'curse', glyphId: cid, color: '#d11e74', name: t(CU[cid].i18nName), lvl: 1, maxLvl: 1,
          levels: [{ n: 1, txt: t(CU[cid].i18nDesc), on: true, color: '#d11e74' }] });
      }
    }
    if (sc._twUnlocked && LA.SECRET_UPGRADE) {
      items.push({ kind: 'world', glyphId: 'theWorld', color: '#cc1111', name: t(LA.SECRET_UPGRADE.i18nName), lvl: 1, maxLvl: 1,
        levels: [{ n: 1, txt: t(LA.SECRET_UPGRADE.i18nDesc1), on: true, color: '#cc1111' }] });
    }

    var titleHtml = '<div class="la-lo-title">' + t('laRunLoadoutTitle') + '</div>';

    if (!items.length) {
      return {
        html: '<div class="la-lo" id="_la-run-loadout">' + titleHtml +
                '<div class="la-lo-empty">' + t('laRunLoadoutEmpty') + '</div></div>',
        wire: function () {}
      };
    }

    var chips = '', details = {}, k;
    for (k = 0; k < items.length; k++) {
      var it = items[k];

      var pips = '';
      if (it.maxLvl > 1) {
        for (n = 1; n <= it.maxLvl; n++) {
          pips += '<span class="la-lo-pip"' + (n <= it.lvl ? ' style="background:' + laLevelColor(n) + '"' : '') + '></span>';
        }
        pips = '<span class="la-lo-pips">' + pips + '</span>';
      }
      chips += '<button type="button" class="la-lo-chip" data-lo="' + k + '" ' +
        'style="color:' + it.color + '" aria-label="' + it.name + '">' + laLoadoutIcon(it) + pips + '</button>';

      var rows = '';
      for (n = 0; n < it.levels.length; n++) {
        var lv = it.levels[n];
        var label = it.kind === 'up'
          ? '<b style="color:' + (lv.on ? lv.color : '#5a6678') + '">' + t('laRunLevelShort') + ' ' + lv.n + '</b> — '
          : '';
        rows += '<li class="la-lo-lvl ' + (lv.on ? 'on' : 'off') + '">' +
          '<span class="la-lo-lvl-txt">' + label + lv.txt + '</span></li>';
      }
      details[k] = '<div class="la-lo-d-head" style="color:' + it.color + '">' + it.name +
        (it.kind === 'up' ? ' · ' + t('laRunLevelShort') + ' ' + it.lvl : '') + '</div>' +
        '<ul class="la-lo-levels">' + rows + '</ul>';
    }

    var html = '<div class="la-lo" id="_la-run-loadout">' + titleHtml +
      '<div class="la-lo-chips">' + chips + '</div>' +
      '<div class="la-lo-detail" id="_la-lo-detail">' + details[0] + '</div></div>';

    var wire = function (root) {
      var box = root.querySelector('#_la-run-loadout');
      if (!box) return;
      var detail = box.querySelector('#_la-lo-detail');
      var chipEls = box.querySelectorAll('.la-lo-chip');
      function show(idx) {
        if (details[idx] == null) return;
        detail.innerHTML = details[idx];
        for (var z = 0; z < chipEls.length; z++) chipEls[z].classList.toggle('la-lo-chip--active', z === idx);
      }
      // The mode card is itself clickable (resumes the run) — clicking inside the
      // loadout is for INSPECTING, so swallow those clicks before they bubble up.
      box.addEventListener('click', function (e) { e.stopPropagation(); });
      for (var q = 0; q < chipEls.length; q++) {
        (function (el) {
          var idx = parseInt(el.getAttribute('data-lo'), 10);
          el.addEventListener('mouseenter', function () { show(idx); });
          el.addEventListener('focus', function () { show(idx); });
          // Enter/Space on a chip must not bubble to the card's "resume" handler.
          el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); show(idx); }
          });
        })(chipEls[q]);
      }
      show(0);
    };

    return { html: html, wire: wire };
  }

  function showModeMenu(container, fromActiveGame) {
    if (menuEl) return;
    // A game-over run is DEAD — capture that BEFORE tearing the screen down (the
    // teardown clears the flag), so the menu offers a fresh "Play" instead of a
    // "Resume" that would try to resume a dead scene and crash.
    var wasGameOver = isLightAgainGameOverOpen();
    // Arriving from the game-over screen (Home pressed)? Tear it down first so the
    // mode menu cleanly replaces it instead of overlapping its translucent panel.
    if (typeof window.__laDismissGameOver === 'function') window.__laDismissGameOver();
    var unlocked = laIsHardcoreUnlocked();
    // Pickaxe skin is a reward for unlocking hardcore — force off if still locked.
    window.__laSteveSkin = unlocked && (localStorage.getItem('la_skin_steve') === '1');

    // NB: distinct id from game-over-ui.js's '_la-go-styles'. The two share the
    // la-go-fade-in/glow/spin keyframes, but game-over-ui ALSO defines the
    // beaten-record animations (rec-pop/rec-glow/badge-in). showModeMenu runs
    // first (on every modal open), so injecting under the same id used to preempt
    // game-over's fuller sheet and silently kill the record-celebration anims.
    if (!document.getElementById('_la-ms-go-styles')) {
      var st = document.createElement('style');
      st.id = '_la-ms-go-styles';
      st.textContent =
        '@keyframes la-go-fade-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}' +
        '@keyframes la-go-glow{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 22px 4px var(--la-accent-glow)}}' +
        '@keyframes la-go-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    if (!document.getElementById('_la-ms-styles')) {
      var ms = document.createElement('style');
      ms.id = '_la-ms-styles';
      ms.textContent =
        // margin:auto centers the panel when it fits AND stays scroll-safe when it
        // overflows (auto margins collapse to 0, so the top never gets clipped — the
        // classic flex centering + overflow fix).
        '#_la-mode-select .la-ms-wrap{text-align:center;width:min(780px,94%);padding:2rem 1.5rem;margin:auto}' +
        '#_la-mode-select .la-ms-title{font-size:calc(1rem * var(--la-ui-scale));letter-spacing:.32em;color:var(--la-accent);text-transform:uppercase;margin-bottom:1.8rem}' +
        '#_la-mode-select .la-ms-return{font-size:calc(.55rem * var(--la-ui-scale));letter-spacing:.2em;color:#445; text-transform:uppercase;margin-bottom:.5rem}' +
        '#_la-mode-select .la-ms-cards{display:flex;gap:1.2rem;justify-content:center;flex-wrap:wrap}' +
        '#_la-mode-select .la-ms-card{position:relative;flex:1 1 230px;max-width:320px;min-width:200px;padding:1.7rem 1.3rem 1.5rem;border-radius:16px;display:flex;flex-direction:column;align-items:center;gap:.65rem;transition:transform .2s ease,box-shadow .25s ease,border-color .25s ease,background .25s ease}' +
        '#_la-mode-select .la-ms-card--enabled{cursor:pointer}' +
        '#_la-mode-select .la-ms-card--enabled:hover{transform:translateY(-5px)}' +
        '#_la-mode-select .la-ms-card--sandbox{border:1px solid var(--la-accent-soft);background:var(--la-accent-faint)}' +
        '#_la-mode-select .la-ms-card--sandbox:hover{border-color:var(--la-accent-line);box-shadow:0 0 30px var(--la-accent-glow);background:var(--la-accent-fill)}' +
        '#_la-mode-select .la-ms-card--hardcore{border:1px solid rgba(255,70,20,0.32);background:rgba(255,45,0,0.035)}' +
        '#_la-mode-select .la-ms-card--hardcore.la-ms-card--enabled:hover{border-color:rgba(255,80,30,0.7);box-shadow:0 0 30px rgba(255,60,0,0.22);background:rgba(255,60,0,0.07)}' +
        '#_la-mode-select .la-ms-card--locked{border-style:dashed;cursor:not-allowed}' +
        '#_la-mode-select .la-ms-glyph{font-size:2.6rem;line-height:1;text-shadow:0 0 18px currentColor,0 0 6px currentColor;animation:la-ms-float 3s ease-in-out infinite}' +
        '@keyframes la-ms-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}' +
        '#_la-mode-select .la-ms-name{font-size:calc(1.4rem * var(--la-ui-scale));font-weight:700;letter-spacing:.16em}' +
        '#_la-mode-select .la-ms-desc{font-size:calc(.74rem * var(--la-ui-scale));line-height:1.65;min-height:2.6em}' +
        '#_la-mode-select .la-ms-cta{margin-top:.4rem;padding:.55rem 1.7rem;border-radius:9px;font-size:calc(.86rem * var(--la-ui-scale));font-weight:700;letter-spacing:.12em;text-transform:uppercase}' +
        '#_la-mode-select .la-ms-bar{height:.5rem;border-radius:99px;background:rgba(255,255,255,0.07);overflow:hidden}' +
        '#_la-mode-select .la-ms-bar-fill{display:block;height:100%;border-radius:99px;transition:width .5s cubic-bezier(0.22,1,0.36,1)}' +
        '#_la-mode-select .la-ms-tut{margin-top:1.6rem;padding:1.2rem 1.3rem;border:1px solid var(--la-accent-soft);border-radius:12px;background:var(--la-accent-faint);text-align:center}' +
        '#_la-mode-select .la-ms-tut-hint{font-size:calc(.68rem * var(--la-ui-scale));letter-spacing:.04em;color:#6f9bc0;margin-bottom:1rem;line-height:1.55}' +
        '#_la-mode-select .la-ms-tut-bar{max-width:320px;margin:.2rem auto .7rem}' +
        '#_la-mode-select .la-ms-tut-label{font-size:calc(.74rem * var(--la-ui-scale));font-weight:700;color:#9fd4e8;letter-spacing:.06em;margin-bottom:1rem}' +
        '#_la-mode-select .la-ms-tut-btns{display:flex;gap:.7rem;justify-content:center;flex-wrap:wrap}' +
        '#_la-mode-select .la-ms-tut-btn{cursor:pointer;font-family:monospace;font-weight:700;font-size:calc(.76rem * var(--la-ui-scale));letter-spacing:.07em;padding:.55rem 1.3rem;border-radius:9px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.18);color:#cfe0ee;transition:transform .15s,background .2s,border-color .2s}' +
        '#_la-mode-select .la-ms-tut-btn:hover{transform:translateY(-2px);background:var(--la-accent-fill);border-color:var(--la-accent-line)}' +
        '#_la-mode-select .la-ms-tut-btn--primary{background:var(--la-accent-fill);border-color:var(--la-accent-line);color:var(--la-accent)}' +
        '#_la-mode-select .la-ms-steve{display:inline-flex;align-items:center;gap:.5rem;margin-top:1.5rem;font-size:calc(.74rem * var(--la-ui-scale));letter-spacing:.05em;color:#8aa3c0;cursor:pointer;user-select:none;transition:color .2s}' +
        '#_la-mode-select .la-ms-steve:hover{color:#cfe6f5}' +
        '#_la-mode-select .la-ms-steve input{width:15px;height:15px;margin:0;accent-color:#5fe0cf;cursor:pointer}' +
        // Options row holding the always-on "Gros texte" toggle (+ the unlock-gated
        // "I am Steve" skin when present). The row owns the top margin so the toggles
        // sit flush side by side regardless of how many are shown.
        '#_la-mode-select .la-ms-opts{display:flex;gap:1.6rem;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:1.5rem}' +
        '#_la-mode-select .la-ms-opts .la-ms-steve{margin-top:0}' +
        // Active-run highlight: a soft pulsing ring drawn via ::after so it never
        // fights the per-mode coloured hover box-shadow.
        '#_la-mode-select .la-ms-card--active::after{content:"";position:absolute;inset:-1px;border-radius:16px;pointer-events:none;border:1.5px solid rgba(143,233,192,0.45);box-shadow:0 0 22px rgba(143,233,192,0.12) inset;animation:la-ms-active-pulse 2.2s ease-in-out infinite}' +
        '@keyframes la-ms-active-pulse{0%,100%{opacity:.45}50%{opacity:.95}}' +
        // "En cours" badge pinned to the active card corner.
        '#_la-mode-select .la-ms-active-badge{position:absolute;top:.65rem;right:.65rem;z-index:2;display:flex;align-items:center;gap:.32rem;font-size:calc(.52rem * var(--la-ui-scale));font-weight:700;letter-spacing:.13em;text-transform:uppercase;padding:.22rem .55rem;border-radius:99px;background:rgba(143,233,192,0.1);border:1px solid rgba(143,233,192,0.32);color:#8fe9c0}' +
        '#_la-mode-select .la-ms-active-badge::before{content:"";width:6px;height:6px;border-radius:50%;background:#8fe9c0;box-shadow:0 0 6px #8fe9c0;animation:la-ms-active-pulse 1.4s ease-in-out infinite}' +
        // Footer tip line (menu icon doubles as pause). Lives in normal flow at the
        // bottom of the panel so it scrolls with the content and can never overlap it.
        '#_la-mode-select .la-ms-tip{margin:1.5rem auto 0;max-width:560px;text-align:center;font-size:calc(.62rem * var(--la-ui-scale));letter-spacing:.03em;line-height:1.55;color:#5d7f9c;opacity:.9}' +
        '#_la-mode-select .la-ms-tip b{color:#8fb6d6;font-weight:700}' +
        // Controller-support line: a touch tighter to the pause tip, faintly tinted.
        '#_la-mode-select .la-ms-tip--pad{margin-top:.55rem;color:#6a86b0}' +
        // Run loadout: chips + hover→3-levels detail (lives in the resume section).
        '#_la-mode-select .la-lo{width:100%;margin-top:.3rem;padding-top:.85rem;border-top:1px solid rgba(255,255,255,0.1);text-align:left}' +
        '#_la-mode-select .la-lo-title{font-size:calc(.54rem * var(--la-ui-scale));letter-spacing:.16em;text-transform:uppercase;color:#7799bb;margin-bottom:.55rem;text-align:center}' +
        '#_la-mode-select .la-lo-empty{font-size:calc(.66rem * var(--la-ui-scale));color:#6f8298;text-align:center;line-height:1.5;padding:.1rem .2rem}' +
        '#_la-mode-select .la-lo-chips{display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center;margin-bottom:.55rem}' +
        '#_la-mode-select .la-lo-chip{position:relative;width:42px;height:42px;padding:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:1.5px solid currentColor;border-radius:9px;background:rgba(8,10,28,0.55);color:#00ffff;cursor:pointer;transition:transform .14s,box-shadow .2s,background .2s}' +
        '#_la-mode-select .la-lo-chip:hover,#_la-mode-select .la-lo-chip--active{transform:translateY(-2px);box-shadow:0 0 12px -2px currentColor;background:rgba(8,10,28,0.92)}' +
        '#_la-mode-select .la-lo-chip .la-lo-svg{width:21px;height:21px}' +
        '#_la-mode-select .la-lo-pips{display:flex;gap:2px}' +
        '#_la-mode-select .la-lo-pip{width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,0.16)}' +
        '#_la-mode-select .la-lo-detail{min-height:78px;border-radius:9px;background:rgba(4,6,18,0.5);border:1px solid rgba(255,255,255,0.07);padding:.55rem .7rem}' +
        '#_la-mode-select .la-lo-d-head{font-size:calc(.72rem * var(--la-ui-scale));font-weight:700;letter-spacing:.03em;margin-bottom:.45rem}' +
        '#_la-mode-select .la-lo-levels{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.34rem}' +
        '#_la-mode-select .la-lo-lvl{display:flex;align-items:flex-start;gap:.5rem}' +
        '#_la-mode-select ' +
        '#_la-mode-select ' +
        '#_la-mode-select .la-lo-lvl-txt{font-size:calc(.6rem * var(--la-ui-scale));line-height:1.4;color:#aebccd}' +
        '#_la-mode-select .la-lo-lvl.off{opacity:.85}' +
        '#_la-mode-select .la-lo-lvl.off .la-lo-lvl-txt{color:#5a6678}' +
        // "Mode actif en grand": resume section on top + "Nouvelle partie" cards below.
        '#_la-mode-select .la-ms-newgame{font-size:calc(.6rem * var(--la-ui-scale));letter-spacing:.2em;text-transform:uppercase;color:#5d7f9c;margin:.2rem 0 .7rem}' +
        '#_la-mode-select .la-ms-resume{width:min(640px,100%);margin:0 auto 1.7rem;padding:1.3rem 1.4rem 1.2rem;border-radius:16px;border:1px solid var(--la-accent-soft);background:var(--la-accent-faint);text-align:center}' +
        '#_la-mode-select .la-ms-resume--hardcore{border-color:rgba(255,70,20,0.32);background:rgba(255,60,0,0.05)}' +
        '#_la-mode-select .la-ms-resume-top{display:flex;align-items:center;justify-content:center;gap:.7rem;margin-bottom:1rem;flex-wrap:wrap}' +
        '#_la-mode-select .la-ms-resume-label{font-size:calc(.82rem * var(--la-ui-scale));font-weight:700;letter-spacing:.18em;text-transform:uppercase}' +
        '#_la-mode-select .la-ms-resume .la-ms-active-badge{position:static}' +
        '#_la-mode-select .la-ms-resume-btn{margin-top:1rem;width:100%;cursor:pointer;font-family:monospace;font-weight:800;font-size:calc(.9rem * var(--la-ui-scale));letter-spacing:.1em;text-transform:uppercase;padding:.7rem 1rem;border-radius:10px;border:1.5px solid currentColor;background:rgba(255,255,255,0.04);transition:transform .15s,box-shadow .2s,background .2s}' +
        '#_la-mode-select .la-ms-resume-btn:hover{transform:translateY(-2px);box-shadow:0 0 22px -4px currentColor;background:rgba(255,255,255,0.08)}' +
        // Bigger placeholder icons inside the resume section (the freed-up space).
        '#_la-mode-select .la-ms-resume .la-lo{margin-top:0;padding-top:0;border-top:none;text-align:center}' +
        '#_la-mode-select .la-ms-resume .la-lo-title{display:none}' +
        '#_la-mode-select .la-ms-resume .la-lo-chips{gap:.6rem;margin-bottom:.85rem}' +
        '#_la-mode-select .la-ms-resume .la-lo-chip{width:60px;height:60px;border-radius:12px}' +
        '#_la-mode-select .la-ms-resume .la-lo-chip .la-lo-svg{width:30px;height:30px}' +
        '#_la-mode-select .la-ms-resume .la-lo-pip{width:5px;height:5px}' +
        '#_la-mode-select .la-ms-resume .la-lo-detail{min-height:84px;text-align:left}' +
        // Compact layout — applied only when a "resume" section is present (the crowded
        // case: resume + the two cards + the tutorial banner all stacked). Tightens the
        // big vertical gaps so everything fits without scrolling, keeping the spacious
        // look intact for the simpler menus.
        '#_la-mode-select.la-ms--stacked .la-ms-wrap{padding-top:1.2rem;padding-bottom:1.2rem}' +
        '#_la-mode-select.la-ms--stacked .la-ms-title{margin-bottom:.9rem}' +
        '#_la-mode-select.la-ms--stacked .la-ms-resume{margin-bottom:1rem;padding:1rem 1.3rem .95rem}' +
        '#_la-mode-select.la-ms--stacked .la-ms-resume-top{margin-bottom:.7rem}' +
        '#_la-mode-select.la-ms--stacked .la-ms-resume-btn{margin-top:.7rem;padding:.6rem 1rem}' +
        '#_la-mode-select.la-ms--stacked .la-ms-resume .la-lo-chips{margin-bottom:.6rem}' +
        '#_la-mode-select.la-ms--stacked .la-ms-resume .la-lo-detail{min-height:72px}' +
        '#_la-mode-select.la-ms--stacked .la-ms-card{padding:1.2rem 1.2rem 1.05rem}' +
        '#_la-mode-select.la-ms--stacked .la-ms-tut{margin-top:.95rem;padding:.95rem 1.2rem}' +
        '#_la-mode-select.la-ms--stacked .la-ms-tut-hint{margin-bottom:.65rem}' +
        '#_la-mode-select.la-ms--stacked .la-ms-tut-label{margin-bottom:.65rem}' +
        '#_la-mode-select.la-ms--stacked .la-ms-tip{margin-top:1rem}';
      document.head.appendChild(ms);
    }

    menuEl = document.createElement('div');
    menuEl.id = '_la-mode-select';
    menuEl.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:60',
      'display:flex', 'align-items:center', 'justify-content:center',
      // Lighter scrim than before so the running game stays visible behind the menu.
      // Shared token so the game-over panel matches this exactly + adapts to theme.
      'background:var(--la-win-bg)', 'font-family:monospace', 'overflow-y:auto',
      'animation:la-go-fade-in 0.32s cubic-bezier(0.22,1,0.36,1) both',
    ].join(';');

    // Which mode (if any) has a live run behind this menu.
    var fr = (localStorage.getItem('portfolio_lang') || 'fr') !== 'en';
    // Resumable only if we came from a LIVE run — a dead game-over run restarts fresh.
    var resumable = fromActiveGame && !wasGameOver;
    menuResumable = resumable;   // the ▶ toggle resumes only when this is true

    // Visualizer: a live paused run behind the menu ⇒ same track keeps playing
    // but low-passed (muffled). Otherwise it's a fresh menu / game-over track at
    // full brightness. The artist label shows in both cases (a menu is up).
    if (window.LAViz) window.LAViz.toMenu({ muffled: resumable });
    var sbActive = resumable && currentMode === 'sandbox';
    var hcActive = resumable && currentMode === 'hardcore';
    var activeBadge = '<div class="la-ms-active-badge">' + (fr ? 'En cours' : 'In progress') + '</div>';

    // Live-run loadout. The scene is paused (not destroyed) while this menu is up,
    // so we read its upgrade state directly. Skipped during the tutorial (no upgrades).
    var loadoutSc = window.__laSceneRef;
    var tutorialRunning = resumable && loadoutSc && !!loadoutSc._tutorialActive;
    var loadout   = (resumable && loadoutSc && !tutorialRunning) ? buildLoadoutSection(loadoutSc) : null;

    // Layout "mode actif en grand": when there's something to resume — a real run
    // with upgrades (canResume) OR a tutorial in progress (tutorialRunning) — it gets
    // a big RESUME section up top, and the two mode cards drop below under "Nouvelle
    // partie" as fresh-start launchers (no resume, no active highlight: that all
    // lives in the top section now).
    var canResume    = !!loadout;
    var hasTopResume = canResume || tutorialRunning;
    // Crowded layout (resume section stacked above the cards/tutorial) → compact CSS.
    if (hasTopResume) menuEl.className = 'la-ms--stacked';
    var resumeMode   = canResume ? currentMode : null;
    var sbCardActive = sbActive && !hasTopResume;
    var hcCardActive = hcActive && !hasTopResume;
    var resumeName   = resumeMode === 'hardcore' ? 'HARDCORE' : 'SANDBOX';
    var resumeCol    = resumeMode === 'hardcore' ? '#ff5530' : 'var(--la-accent)';

    var resumeSection = '';
    if (canResume) {
      resumeSection = '<div class="la-ms-resume la-ms-resume--' + resumeMode + '">' +
        '<div class="la-ms-resume-top">' +
          '<span class="la-ms-resume-label" style="color:' + resumeCol + '">' + tG('laModeResume') + ' · ' + resumeName + '</span>' +
          activeBadge +
        '</div>' +
        loadout.html +
        '<button type="button" id="_la-ms-resume-btn" class="la-ms-resume-btn" style="border-color:' + resumeCol + ';color:' + resumeCol + '">' + tG('laModeResume') + ' ▶</button>' +
      '</div>';
    } else if (tutorialRunning) {
      // Mid-tutorial: the top section RESUMES it and shows the tutorial progress bar
      // (no upgrades yet). The bottom tutorial banner is suppressed so progress lives
      // in one place — up here, standing in for the loadout.
      var LAtut  = window.LightAgain || {};
      var tTotal = LAtut.TUTORIAL_STEP_COUNT || 11;
      var tDone  = (typeof LAtut.laGetTutorialProgress === 'function') ? LAtut.laGetTutorialProgress() : 0;
      tDone = Math.max(0, Math.min(tDone, tTotal));
      var tPct = Math.round(tDone / tTotal * 100);
      resumeSection = '<div class="la-ms-resume la-ms-resume--tutorial">' +
        '<div class="la-ms-resume-top">' +
          '<span class="la-ms-resume-label" style="color:var(--la-accent)">' + tG('laModeResume') + ' · ' + (fr ? 'Tutoriel' : 'Tutorial') + '</span>' +
          activeBadge +
        '</div>' +
        '<div class="la-ms-tut-hint">' + (fr ? 'Tutoriel en cours — reprends là où tu en étais.' : 'Tutorial in progress — pick up where you left off.') + '</div>' +
        '<div class="la-ms-bar la-ms-tut-bar"><span class="la-ms-bar-fill" style="width:' + tPct + '%;background:var(--la-accent)"></span></div>' +
        '<div class="la-ms-tut-label">' + (fr ? 'Étape ' : 'Step ') + Math.min(tDone + 1, tTotal) + ' / ' + tTotal + '</div>' +
        '<button type="button" id="_la-ms-resume-btn" class="la-ms-resume-btn" style="border-color:var(--la-accent);color:var(--la-accent)">' + tG('laModeResume') + ' ▶</button>' +
      '</div>';
    }
    var newGameLabel = hasTopResume ? '<div class="la-ms-newgame">' + (fr ? 'Nouvelle partie' : 'New game') + '</div>' : '';

    var hcCardCls = 'la-ms-card la-ms-card--hardcore ' + (unlocked ? 'la-ms-card--enabled' : 'la-ms-card--locked') + (hcCardActive ? ' la-ms-card--active' : '');
    var hcCol = unlocked ? '#ff5530' : '#7a4634';
    var hcCtaStyle = unlocked
      ? 'border:1.5px solid rgba(255,70,20,0.55);background:rgba(255,70,20,0.12);color:#ff5530'
      : 'border:1.5px solid rgba(255,70,20,0.2);background:rgba(255,70,20,0.05);color:#8a5240';

    menuEl.innerHTML =
      '<div class="la-ms-wrap">' +
      (fromActiveGame ? '<div class="la-ms-return">' + tG('laMenuReturnTitle') + '</div>' : '') +
      '<div class="la-ms-title">' + tG('laModeSelectTitle') + '</div>' +
      resumeSection +
      newGameLabel +
      '<div class="la-ms-cards">' +

      // SANDBOX card
      '<div id="_la-ms-sandbox" class="la-ms-card la-ms-card--sandbox la-ms-card--enabled' + (sbCardActive ? ' la-ms-card--active' : '') + '" role="button" tabindex="0">' +
        (sbCardActive ? activeBadge : '') +
        '<div class="la-ms-glyph" style="color:var(--la-accent)">\u221e</div>' +
        '<div class="la-ms-name" style="color:var(--la-accent)">SANDBOX</div>' +
        '<div class="la-ms-desc" style="color:#6f93b8">' + tG('laModeSandboxDesc') + '</div>' +
        '<div class="la-ms-cta" style="border:1.5px solid var(--la-accent-line);background:var(--la-accent-fill);color:var(--la-accent)">' + ((!hasTopResume && resumable && currentMode === 'sandbox') ? tG('laModeResume') : tG('laGoPlay')) + '</div>' +
      '</div>' +

      // HARDCORE card
      '<div id="_la-ms-hardcore" class="' + hcCardCls + '"' + (unlocked ? ' role="button" tabindex="0"' : '') + '>' +
        (hcCardActive ? activeBadge : '') +
        '<div class="la-ms-glyph" style="color:' + hcCol + '">\u2620</div>' +
        '<div class="la-ms-name" style="color:' + hcCol + '">HARDCORE</div>' +
        '<div class="la-ms-desc" style="color:' + (unlocked ? '#a8744f' : '#6a4233') + '">' + tG('laModeHardcoreDesc') + '</div>' +
        '<div class="la-ms-cta" style="' + hcCtaStyle + '">' + ((!hasTopResume && resumable && currentMode === 'hardcore') ? tG('laModeResume') : (unlocked ? tG('laGoPlay') : '\ud83d\udd12 ' + tG('laModeHardcoreLocked'))) + '</div>' +
      '</div>' +

      '</div>' +
      // Tutorial banner stays at the BOTTOM as before — but NOT while a tutorial is
      // actually running (then its progress lives in the top resume section instead).
      ((!unlocked && !tutorialRunning) ? buildTutorialPanel() : '') +
      // Options row: "Gros texte" (accessibility — always available) plus the
      // cosmetic pickaxe skin (unlocked alongside hardcore mode as a reward).
      '<div class="la-ms-opts">' +
        '<label class="la-ms-steve"><input type="checkbox" id="_la-ms-bigtext-cb"><span>' + (fr ? 'Gros texte' : 'Large text') + '</span></label>' +
        (unlocked ? '<label class="la-ms-steve"><input type="checkbox" id="_la-ms-steve-cb"><span>I am Steve</span></label>' : '') +
      '</div>' +
      // Tip in normal flow at the bottom of the panel (mentions seeing upgrades). Kept
      // inside .la-ms-wrap so it never overlaps the content when everything is stacked.
      '<div class="la-ms-tip">' + (fr
        ? '💡 Le bouton <b>⏸ pause</b> (en haut à droite) met la partie en pause, ouvre ce menu et vos <b>améliorations</b> ; l’icône <b>▶</b> reprend la partie en cours.'
        : '💡 The <b>⏸ pause</b> button (top right) pauses the game, opens this menu and your <b>upgrades</b>; the <b>▶</b> icon resumes the current run.') + '</div>' +
      // Controller support note — the game is fully playable with a gamepad
      // (twin-stick). Branch a controller in and the sticks/triggers take over.
      '<div class="la-ms-tip la-ms-tip--pad">' + (fr
        ? '🎮 <b>Manette</b> compatible : <b>croix dir. / stick</b> = naviguer · <b>A</b> = valider · <b>B</b> = retour · <b>Home</b> ou <b>Start</b> = pause / reprendre (comme l’icône ⏸/▶).'
        : '🎮 <b>Controller</b> supported: <b>D-pad / stick</b> = navigate · <b>A</b> = select · <b>B</b> = back · <b>Home</b> or <b>Start</b> = pause / resume (like the ⏸/▶ icon).') + '</div>' +
      '</div>';

    container.style.position = 'relative';
    container.appendChild(menuEl);
    updateMenuBtn();   // home now open ⇒ show ▶, or hide it if there's nothing to resume

    // Hook up the loadout's hover/focus → 3-levels detail (no-op if absent).
    if (loadout) loadout.wire(menuEl);

    // Big "Reprendre" button in the resume section (Option-C layout).
    var resumeBtn = menuEl.querySelector('#_la-ms-resume-btn');
    if (resumeBtn) resumeBtn.addEventListener('click', function () { resumeGame(); });

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

    // "Gros texte": toggles the .la-big-text class on the modal, which bumps
    // --la-ui-scale so every pop-up's calc()-based text grows at once (the menu,
    // tutorial, draft, help reference and game-over all live inside the modal).
    // The class is read straight off the modal so the box reflects the live
    // state, and the change is mirrored to localStorage for the next session.
    var laModal = container.closest('.light-again-modal') || container;
    var bigTextCb = menuEl.querySelector('#_la-ms-bigtext-cb');
    if (bigTextCb) {
      bigTextCb.checked = laModal.classList.contains('la-big-text');
      bigTextCb.addEventListener('change', function () {
        laModal.classList.toggle('la-big-text', bigTextCb.checked);
        try { localStorage.setItem('la_big_text', bigTextCb.checked ? '1' : '0'); } catch (e) { /* ignore */ }
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
      dismissModeMenu(true);   // instant — no fading scrim over the resumed run
      clearPauseState();
      if (activeGame && typeof activeGame.resume === 'function') activeGame.resume();
      if (window.LAViz) window.LAViz.toGame();   // un-muffle, back to the in-game look
    }
    // Each card "Resumes" the CURRENT run when the menu was opened from that same
    // mode; otherwise it (re)starts that mode. From the launch menu it starts fresh.
    // With the resume section present (canResume), the cards are pure "Nouvelle
    // partie" launchers — the big Reprendre button owns resuming. Without it
    // (e.g. a tutorial run), the matching card still resumes as before.
    function chooseSandbox() {
      if (!hasTopResume && resumable && currentMode === 'sandbox') { resumeGame(); return; }
      dismissModeMenu();
      startWithMode(container, 'sandbox', fromActiveGame);
    }
    function chooseHardcore() {
      if (!hasTopResume && resumable && currentMode === 'hardcore') { resumeGame(); return; }
      dismissModeMenu();
      startWithMode(container, 'hardcore', fromActiveGame);
    }

    sbBtn.addEventListener('click', chooseSandbox);
    sbBtn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseSandbox(); } });

    if (unlocked) {
      hcBtn.addEventListener('click', chooseHardcore);
      hcBtn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseHardcore(); } });
    }
    if (resumeBtn) resumeBtn.focus();
    else sbBtn.focus();
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
        // Preview video — same gameplay clip as the home carousel slide. The
        // themed gradient under it shows through until the clip is playing.
        // preload="none" so the file only downloads on first hover, never on load.
        '<div class="light-again-btn__img-wrap">' +
          '<video class="light-again-btn__video" muted loop playsinline preload="none" aria-hidden="true">' +
            '<source src="assets/light-again/gameplay-preview.mp4" type="video/mp4">' +
          '</video>' +
        '</div>' +
        '<div class="light-again-btn__details">' +
          '<strong class="light-again-btn__game-name">Light Again</strong>' +
          '<span class="light-again-btn__tagline">' + t('lightAgainBtnDesc') + '</span>' +
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

    // ---- Preview video — plays only while the panel is unfolded ----
    // Mirrors the home carousel: muted loop that fades in once it actually plays
    // (the gradient placeholder shows whenever it's paused). It runs only on
    // hover/focus, respecting the site "animations off" pref, and never while the
    // game modal is open (the panel is collapsed + non-interactive then).
    var laVideo  = btnEl.querySelector('.light-again-btn__video');
    var laImgWrap = btnEl.querySelector('.light-again-btn__img-wrap');
    if (laVideo) {
      laVideo.muted = true; // required for programmatic autoplay
      laVideo.addEventListener('playing', function () {
        if (laImgWrap) laImgWrap.classList.add('light-again-btn__img-wrap--playing');
      });
      laVideo.addEventListener('pause', function () {
        if (laImgWrap) laImgWrap.classList.remove('light-again-btn__img-wrap--playing');
      });
      var animsOff = function () { return document.documentElement.getAttribute('data-animations') === 'off'; };
      var playPreview = function () {
        if (animsOff() || btnEl.classList.contains('light-again-btn--modal-open')) return;
        var p = laVideo.play();
        if (p && p.catch) p.catch(function () { /* autoplay may reject; ignore */ });
      };
      var stopPreview = function () {
        laVideo.pause();
        try { laVideo.currentTime = 0; } catch (e) { /* ignore */ }
      };
      btnEl.addEventListener('mouseenter', playPreview);
      btnEl.addEventListener('focus', playPreview);
      btnEl.addEventListener('mouseleave', stopPreview);
      btnEl.addEventListener('blur', stopPreview);
    }

    // Fixed positioned — append directly to body
    document.body.appendChild(btnEl);
  }

  function updateBtnText() {
    if (!btnEl) return;
    btnEl.setAttribute('aria-label', t('lightAgainPlay'));
    var tagline = btnEl.querySelector('.light-again-btn__tagline');
    if (tagline) tagline.textContent = t('lightAgainBtnDesc');
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
          ? 'Molette de la souris \u2014 <span style="color:#39c6ff">acc\u00e9l\u00e8re</span> (vers le haut) ou <span style="color:#39c6ff">ralentit</span> (vers le bas) l\u2019apparition des ennemis. La vitesse actuelle s\u2019affiche au-dessus du vaisseau. <span style="color:#a78bff">\ud83c\udfae Croix dir. \u2191 / \u2193.</span>'
          : 'Mouse wheel \u2014 spawns <span style="color:#39c6ff">speed up</span> (scroll up) or <span style="color:#39c6ff">calm down</span> (scroll down). The current speed shows above your ship. <span style="color:#a78bff">\ud83c\udfae D-pad \u2191 / \u2193.</span>',
      },
      {
        label:    isFr ? 'Vider l\u2019\u00e9cran \u00b7 Bac \u00e0 sable' : 'Clear board \u00b7 Sandbox',
        color:    '#66ddff',
        descHtml: isFr
          ? '<span class="la-help-dash">Suppr</span> ou <span class="la-help-dash">Retour arri\u00e8re</span> \u2014 une onde de choc part du vaisseau et balaie l\u2019\u00e9cran pour d\u00e9truire tous les ennemis (sans points). <span style="color:#a78bff">\ud83c\udfae N\u2019importe quel bouton de droite (A B X Y).</span>'
          : '<span class="la-help-dash">Delete</span> or <span class="la-help-dash">Backspace</span> \u2014 a shockwave bursts from your ship and sweeps the screen, destroying every enemy (no points). <span style="color:#a78bff">\ud83c\udfae Any right-side button (A B X Y).</span>',
      },
      {
        label:    isFr ? '\ud83c\udfae Manette' : '\ud83c\udfae Controller',
        color:    '#a78bff',
        descHtml: isFr
          ? '<b>Stick gauche</b> = d\u00e9placement \u00b7 <b>stick droit</b> = vis\u00e9e (sinon la fl\u00e8che suit le d\u00e9placement) \u00b7 <span style="color:#ff1e3c">g\u00e2chette droite</span> = <span style="color:#ff1e3c">attaque torpille</span> \u00b7 <span style="color:#00ffff">g\u00e2chette gauche</span> = <span class="la-help-dash">dash</span> \u00b7 <b>une des deux petites g\u00e2chettes hautes</b> = The World.<br><b>Menus</b> : croix dir. / stick = naviguer \u00b7 <b>A</b> = valider \u00b7 <b>B</b> = retour \u00b7 <b>Home</b> ou <b>Start</b> = pause / reprendre.'
          : '<b>Left stick</b> = move \u00b7 <b>right stick</b> = aim (otherwise the arrow follows your movement) \u00b7 <span style="color:#ff1e3c">right trigger</span> = <span style="color:#ff1e3c">torpedo attack</span> \u00b7 <span style="color:#00ffff">left trigger</span> = <span class="la-help-dash">dash</span> \u00b7 <b>either small bumper</b> = The World.<br><b>Menus</b>: D-pad / stick = navigate \u00b7 <b>A</b> = select \u00b7 <b>B</b> = back \u00b7 <b>Home</b> or <b>Start</b> = pause / resume.',
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
      var hb = overlayEl && overlayEl.querySelector('.light-again-help-btn:not(.light-again-pause-btn):not(.light-again-menu-btn)');
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

    // Is the current run actually dead? A hardcore game-over leaves the player in
    // the DEAD state (sandbox respawns, so it never lingers there). The game-over
    // overlay's flag gets cleared the moment the player opens the home menu, so
    // isLightAgainGameOverOpen() alone misses a dismissed-but-dead hardcore run —
    // which is why the "you'll lose your Hardcore run" warning used to fire for a
    // run that was already over. p.state survives that teardown.
    var runDead = !!(sc && sc.p && sc.p.state === 'DEAD');

    // No live game yet (mode menu showing), a finished run still on screen, or a
    // dead run behind a dismissed game-over: (re)launch a fresh sandbox session
    // that auto-starts the tutorial.
    if (!activeGame || !sc || isLightAgainGameOverOpen() || runDead) {
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

    // Was this reached from the paused home menu (vs. the in-run ? button)?
    // It decides where Cancel returns to, and the home menu must be closed on
    // launch so it can't linger (still reading "HARDCORE") behind the tutorial.
    var fromHomeMenu = !!menuEl;

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
        '<div style="font-size:calc(.95rem * var(--la-ui-scale));font-weight:700;color:#ffb499;margin-bottom:.7rem;letter-spacing:.04em">' +
          (fr ? 'Lancer le tutoriel ?' : 'Start the tutorial?') + '</div>' +
        '<div style="font-size:calc(.78rem * var(--la-ui-scale));line-height:1.6;color:#c8b0a8;margin-bottom:1.4rem">' +
          (fr ? 'Cela mettra fin à ta partie <b style="color:#ff5530">Hardcore</b> en cours. Le tutoriel se déroule en <b style="color:var(--la-accent)">Sandbox</b>.'
              : 'This will end your current <b style="color:#ff5530">Hardcore</b> run. The tutorial runs in <b style="color:var(--la-accent)">Sandbox</b>.') + '</div>' +
        '<div style="display:flex;gap:.8rem;justify-content:center">' +
          '<button id="_la-tc-cancel" type="button" style="cursor:pointer;font-family:monospace;font-weight:700;font-size:calc(.78rem * var(--la-ui-scale));padding:.5rem 1.2rem;border-radius:9px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);color:#cfe0ee">' +
            (fr ? 'Annuler' : 'Cancel') + '</button>' +
          '<button id="_la-tc-go" type="button" style="cursor:pointer;font-family:monospace;font-weight:800;font-size:calc(.78rem * var(--la-ui-scale));letter-spacing:.06em;padding:.5rem 1.3rem;border-radius:9px;background:var(--la-accent-fill);border:1.5px solid var(--la-accent-line);color:var(--la-accent)">' +
            (fr ? 'Lancer le tuto ▶' : 'Start tutorial ▶') + '</button>' +
        '</div>' +
      '</div>';

    container.style.position = 'relative';
    container.appendChild(ov);

    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }

    ov.querySelector('#_la-tc-cancel').addEventListener('click', function () {
      close();
      // From the paused home menu → return there (stay paused, menu still open).
      // From the in-run ? button → resume the hardcore run we froze.
      if (!fromHomeMenu) {
        clearPauseState();
        if (activeGame && typeof activeGame.resume === 'function') activeGame.resume();
      }
    });
    ov.querySelector('#_la-tc-go').addEventListener('click', function () {
      close();
      // Close the home menu first — otherwise it lingers behind the launching
      // tutorial, still showing "En cours · HARDCORE" while the run restarts as
      // Sandbox (no-op when the confirm came from the in-run ? button).
      dismissModeMenu();
      window.__laStartTutorialOnReady = true;
      startWithMode(container, 'sandbox', true);  // ends hardcore, restarts as sandbox + tutorial
    });
    var goBtn = ov.querySelector('#_la-tc-go');
    if (goBtn) goBtn.focus();
  }

  /* ================================================================
     GAMEPAD — menu navigation + Home/Start pause toggle
     ----------------------------------------------------------------
     A requestAnimationFrame loop runs the whole time the modal is open
     (the in-scene gamepad poll stops the moment the scene is paused, so
     it can't drive the menus). This loop:
       • toggles the home (pause) menu on the Guide/Home (16) OR Start (9)
         button — exactly like clicking the ⏸/▶ header icon;
       • when ANY DOM overlay is up (home menu, upgrade draft, game over,
         help, tutorial confirm/complete) moves focus with the D-pad / left
         stick, activates the focused control with A (0), and goes back with
         B (1).
     gamepad.js suppresses gameplay input while an overlay is open, so the
     scene poll and this navigator never fight over the same buttons.
     ================================================================ */

  // Prefer a W3C "standard"-mapping pad; otherwise the first connected one
  // (mirrors the selection in gamepad.js so both read the same device).
  function padGetActive() {
    var pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    var i, first = null;
    for (i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) {
        if (pads[i].mapping === 'standard') return pads[i];
        if (!first) first = pads[i];
      }
    }
    return first;
  }

  // The overlay the gamepad should navigate right now, topmost first.
  function padNavOverlay() {
    if (!overlayEl) return null;
    return document.getElementById('_la-tutorial-confirm') ||
           (helpPopupEl || null) ||
           document.getElementById('_la-upgrade-overlay') ||
           document.getElementById('_la-go-overlay') ||
           document.getElementById('_la-mode-select') ||
           document.querySelector('.la-tut-complete') ||
           null;
  }

  // Visible, enabled, actionable controls inside an overlay, in DOM order.
  // The loadout chips are inspect-only (they swallow their own clicks), so
  // they're skipped to keep navigation on the meaningful actions.
  function padFocusables(ov) {
    var all = ov.querySelectorAll('button, [role="button"], input:not([type="hidden"]), a[href]');
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.disabled) continue;
      if (el.classList && el.classList.contains('la-lo-chip')) continue;
      if (el.offsetParent === null && el.getClientRects().length === 0) continue;
      var cs = window.getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      out.push(el);
    }
    return out;
  }

  function padSetFocus(el) {
    if (padNavEl && padNavEl !== el) padNavEl.classList.remove('la-gp-focus');
    padNavEl = el || null;
    if (padNavEl) {
      padNavEl.classList.add('la-gp-focus');
      try { padNavEl.focus({ preventScroll: false }); }
      catch (e) { try { padNavEl.focus(); } catch (e2) { /* ignore */ } }
    }
  }

  function padClearFocus() {
    if (padNavEl) padNavEl.classList.remove('la-gp-focus');
    padNavEl = null; padNavOv = null; padDir = 0;
  }

  // B / Circle — the "back / cancel" affordance, where one sensibly exists.
  function padNavBack(ov) {
    if (ov.id === '_la-tutorial-confirm') {
      var c = ov.querySelector('#_la-tc-cancel'); if (c) c.click();
    } else if (helpPopupEl && ov === helpPopupEl) {
      closeHelpPopup(false);
    } else if (ov.id === '_la-mode-select') {
      // Same as the ▶ icon: resume the run behind the home menu, if any.
      if (menuResumable && typeof homeToggleFn === 'function') homeToggleFn();
    }
    // upgrade draft / game over / tutorial-complete: a choice is required, no back.
  }

  function padHandleNav(ov, st) {
    var items = padFocusables(ov);
    if (!items.length) { padNavOv = ov; return; }

    // (Re)acquire focus when the overlay changed or the focused item vanished
    // (e.g. the help popup swapped pages, or a draft reroll rebuilt the cards).
    if (ov !== padNavOv || items.indexOf(padNavEl) < 0) {
      padNavOv = ov;
      var start = -1, ae = document.activeElement;
      if (ae) start = items.indexOf(ae);
      padSetFocus(items[start >= 0 ? start : 0]);
      padDir = 0;
    }

    // Direction from the D-pad OR the left stick, edge-triggered with a
    // hold-to-repeat so a held stick scrolls steadily instead of flying past.
    var dir = 0;
    if (st.down || st.right || st.ly > 0.55 || st.lx > 0.55) dir = 1;
    else if (st.up || st.left || st.ly < -0.55 || st.lx < -0.55) dir = -1;

    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var move = false;
    if (dir !== 0) {
      if (dir !== padDir) { move = true; padRepeatAt = now + 420; }       // first press
      else if (now >= padRepeatAt) { move = true; padRepeatAt = now + 130; } // hold-repeat
    }
    padDir = dir;

    if (move) {
      var idx = items.indexOf(padNavEl);
      if (idx < 0) idx = 0;
      idx = (idx + dir + items.length) % items.length;
      padSetFocus(items[idx]);
    }

    // A / Cross → activate the focused control; B / Circle → back.
    if (st.a && !padPrev2.a) {
      var target = (padNavEl && items.indexOf(padNavEl) >= 0) ? padNavEl : items[0];
      if (target) target.click();
    } else if (st.b && !padPrev2.b) {
      padNavBack(ov);
    }
  }

  function padPoll() {
    padRafId = requestAnimationFrame(padPoll);
    if (!overlayEl) return;

    var gp = padGetActive();
    if (!gp) {
      padPrev2.home = padPrev2.start = padPrev2.a = padPrev2.b = false;
      padPrev2.up = padPrev2.down = padPrev2.left = padPrev2.right = false;
      padDir = 0;
      if (!padNavOverlay()) padClearFocus();
      return;
    }

    var btns = gp.buttons || [], ax = gp.axes || [];
    function pr(i) { var b = btns[i]; return !!b && (b.pressed || b.value > 0.5); }
    var home = pr(16), start = pr(9), a = pr(0), b = pr(1);
    var up = pr(12), down = pr(13), left = pr(14), right = pr(15);
    var lx = ax[0] || 0, ly = ax[1] || 0;

    // Skip the very first poll so a button still held from opening the game
    // (or just plugging in) doesn't count as a fresh press.
    if (padFirst) {
      padFirst = false;
      padPrev2.home = home; padPrev2.start = start; padPrev2.a = a; padPrev2.b = b;
      padPrev2.up = up; padPrev2.down = down; padPrev2.left = left; padPrev2.right = right;
      return;
    }

    var ov = padNavOverlay();

    // Home / Start → toggle the pause (home) menu, exactly like the ⏸/▶ icon.
    // Ignored while a DIFFERENT blocking overlay owns the screen (draft, game
    // over, help, tutorial confirm/complete) — those run their own flow.
    if ((home && !padPrev2.home) || (start && !padPrev2.start)) {
      var blocked = ov && ov.id !== '_la-mode-select';
      if (!blocked && typeof homeToggleFn === 'function') {
        homeToggleFn();
        // State just changed (menu opened or run resumed) — record this frame's
        // buttons and skip navigation so the toggle press isn't double-read.
        padPrev2.home = home; padPrev2.start = start; padPrev2.a = a; padPrev2.b = b;
        padPrev2.up = up; padPrev2.down = down; padPrev2.left = left; padPrev2.right = right;
        padDir = 0;
        return;
      }
    }

    if (ov) padHandleNav(ov, { a: a, b: b, up: up, down: down, left: left, right: right, lx: lx, ly: ly });
    else padClearFocus();

    padPrev2.home = home; padPrev2.start = start; padPrev2.a = a; padPrev2.b = b;
    padPrev2.up = up; padPrev2.down = down; padPrev2.left = left; padPrev2.right = right;
  }

  // Bright, theme-aware focus ring so controller users can see where they are.
  function ensurePadStyles() {
    if (document.getElementById('_la-gp-styles')) return;
    var st = document.createElement('style');
    st.id = '_la-gp-styles';
    st.textContent =
      '.la-gp-focus{outline:3px solid var(--la-accent,#00ffff)!important;outline-offset:3px!important;' +
      'box-shadow:0 0 16px 3px var(--la-accent-glow,rgba(0,255,255,0.5))!important}';
    document.head.appendChild(st);
  }

  function startPadLoop() {
    if (padRafId != null) return;
    ensurePadStyles();
    padFirst = true; padDir = 0; padNavOv = null; padNavEl = null;
    padPrev2.home = padPrev2.start = padPrev2.a = padPrev2.b = false;
    padPrev2.up = padPrev2.down = padPrev2.left = padPrev2.right = false;
    padRafId = requestAnimationFrame(padPoll);
  }

  function stopPadLoop() {
    if (padRafId != null) { cancelAnimationFrame(padRafId); padRafId = null; }
    padClearFocus();
    homeToggleFn = null;
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
    // "Gros texte" accessibility setting: apply it to the modal the moment it
    // opens so every pop-up (menu, tutorial, draft, help, game-over…) is already
    // scaled, even if the player never opens the menu where the toggle lives.
    try {
      if (localStorage.getItem('la_big_text') === '1') modal.classList.add('la-big-text');
    } catch (e) { /* ignore */ }

    // Sandbox "Menu" button — visible only in sandbox mode, left-side header
    menuBtnEl = document.createElement('button');
    menuBtnEl.type = 'button';
    menuBtnEl.className = 'light-again-help-btn light-again-menu-btn';
    menuBtnEl.innerHTML = menuPauseIconSvg();   // starts in the playing state ⇒ ⏸
    menuBtnEl.setAttribute('aria-label', t('lightAgainPause'));
    menuBtnEl.setAttribute('title', t('lightAgainPause'));
    menuBtnEl.style.display = 'none';
    // Pause / resume toggle:
    //  • Playing (⏸) → pause the run and open the home (mode-select) menu.
    //  • On the home menu (▶, run paused) → resume the current run if there is a
    //    live one; if there isn't (fresh launch / dead game-over run), do nothing.
    // Factored into homeToggleFn so the gamepad Home/Start button can fire the
    // exact same behaviour (see padPoll).
    homeToggleFn = function () {
      if (menuEl) {
        if (menuResumable && activeGame && typeof activeGame.resume === 'function') {
          dismissModeMenu(true);   // instant — no fading scrim over the resumed run
          clearPauseState();
          activeGame.resume();
          if (window.LAViz) window.LAViz.toGame();   // un-muffle, back to the in-game look
        }
        return;
      }
      if (!activeGame || !container) return;
      if (typeof activeGame.pause === 'function') activeGame.pause();
      showModeMenu(container, true);
    };
    menuBtnEl.addEventListener('click', function () { homeToggleFn(); });

    modal.appendChild(menuBtnEl);
    modal.appendChild(helpBtn);
    modal.appendChild(closeBtn);
    modal.appendChild(container);
    overlayEl.appendChild(modal);
    document.body.appendChild(overlayEl);
    document.body.style.overflow = 'hidden';

    // Music visualizer (audio-reactive sphere) — persistent now-playing widget,
    // lives in the modal so it survives every overlay. mount() starts the test
    // track; showModeMenu / startWithMode / game-over drive its state below.
    if (window.LAViz) window.LAViz.mount(modal);

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

    /* --- Keyboard: Escape is context-aware (browser & desktop alike) ---
         • Help popup open       → close just the popup (innermost layer first).
         • Live run playing        → PAUSE into the menu, exactly like clicking
           the in-game ⏸ button. An accidental Esc mid-fight must never kill the
           run (this also avoided the old desktop close→relaunch crash bounce).
         • Menu / pause menu / game-over → leave the game: the browser dismisses
           the modal back to the page, the desktop (.exe) build quits the app
           cleanly via __laQuit. (requestCloseGame picks the right one.) */
    overlayEl._onKeyDown = function (e) {
      if (e.key !== 'Escape') return;
      if (helpPopupEl) { closeHelpPopup(false); return; }
      if (activeGame && !menuEl && !isLightAgainGameOverOpen() &&
          typeof homeToggleFn === 'function') {
        homeToggleFn();   // pause the run + open the (pause) menu
        return;
      }
      requestCloseGame();
    };
    document.addEventListener('keydown', overlayEl._onKeyDown);

    /* --- Suppress the browser context menu while the game is open --- */
    // Right-click is the dash input; spamming it (especially clicking just
    // outside the canvas) would otherwise pop the native right-click menu.
    // Block it page-wide for as long as Light Again is on screen.
    overlayEl._onContextMenu = function (e) { e.preventDefault(); };
    document.addEventListener('contextmenu', overlayEl._onContextMenu);

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

    /* --- Gamepad: drive the menus + Home/Start pause toggle while open --- */
    startPadLoop();
  }

  /* ================================================================
     MODAL — close
     ================================================================ */

  // Close the game "for real". The desktop (.exe) build registers a quit hook
  // (window.__laQuit) that closes the OS window; the browser portfolio has no
  // hook, so we just dismiss the modal back to the page. Escape funnels through
  // here once it has decided the game should actually close (vs. pause).
  function requestCloseGame() {
    if (typeof window.__laQuit === 'function') { window.__laQuit(); return; }
    closeLightAgain();
  }

  function closeLightAgain() {
    if (!overlayEl) return;

    if (btnEl) btnEl.classList.remove('light-again-btn--modal-open');

    userPaused = false;

    // Stop the gamepad menu loop + drop any lingering focus ring.
    stopPadLoop();

    // Tear down the music visualizer (stops the audio + rAF, drops the DOM).
    if (window.LAViz) window.LAViz.unmount();

    // Close help popup immediately (whole modal is exiting — no animation needed)
    closeHelpPopup(true);

    // Start CSS fade-out
    overlayEl.classList.remove('modal-overlay--open');

    // Clean up listeners & focus trap
    if (trapCleanup) { trapCleanup(); trapCleanup = null; }
    if (overlayEl._onKeyDown) {
      document.removeEventListener('keydown', overlayEl._onKeyDown);
    }
    if (overlayEl._onContextMenu) {
      document.removeEventListener('contextmenu', overlayEl._onContextMenu);
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
    // Public launcher — lets the home "personal projects" carousel (perso-projects.js)
    // open the game from the Light Again preview slide, same as the sticky tab.
    window.__openLightAgain = openLightAgain;

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
        var hb = overlayEl.querySelector('.light-again-help-btn:not(.light-again-pause-btn):not(.light-again-menu-btn)');
        if (hb) hb.setAttribute('aria-label', t('lightAgainHelp'));
        updateMenuBtnIcon();   // re-localise the pause/resume toggle's label
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

/* ==========================================================================
   Typing Game — Intro Typewriter Module
   Factory function: receives a deps object from the main IIFE.
   Loaded before typing-game.js. Exposed as window.createTypingGameIntro.
   ========================================================================== */

window.createTypingGameIntro = function (deps) {
  'use strict';

  /* deps interface:
     t(key)             — translation function
     getContainer()     — returns container DOM element
     getHeroTitle()     — returns heroTitleEl
     setHeroTitle(el)   — sets heroTitleEl in main IIFE
     setIntroActive(v)  — sets introActive flag in main IIFE
     setIntroSeen(v)    — marks typewriter as finished this session
     showInfoPopup(title, text, shortcut, onClose) — generic popup builder
     unlockGame()       — marks game as unlocked (cookie: typewriter completed)
     activateGame()     — marks game as fully activated (cookie: user played)
     buildGameDOM()     — builds the full game DOM
     startGame(force)   — starts a new game round
  */

  var t = deps.t;

  // Module-internal state
  var introTextEl = null;
  var introButtonEl = null;
  var introGen = 0; // generation counter — incremented on each showIntro call to cancel stale callbacks

  /* ---- Show intro (entry point) ---- */

  function showIntro(isSmartphone) {
    var gen = ++introGen; // capture current generation
    deps.setIntroActive(true);
    var heroTitleEl = document.querySelector('#hero .section__title');
    deps.setHeroTitle(heroTitleEl);
    if (heroTitleEl) heroTitleEl.textContent = t('heroIntro');

    var container = deps.getContainer();

    // --- Loading screen (shown until fonts are ready / the cap below) ---
    var loadingEl = document.createElement('div');
    loadingEl.className = 'typing-game__loading';
    loadingEl.innerHTML = '<div class="typing-game__loading-spinner"></div>' +
      '<div class="typing-game__loading-text">' + t('loadingText') + '</div>';
    container.appendChild(loadingEl);

    function startTypewriter() {
      if (gen !== introGen) return; // stale — a newer showIntro was called
      loadingEl.classList.add('typing-game__loading--hidden');
      setTimeout(function () {
        if (loadingEl.parentNode) loadingEl.remove();
      }, 400);
      buildIntroDOM(isSmartphone, gen);
    }

    // Start as soon as the page is actually usable rather than waiting for
    // window 'load' (every image + script to finish). On slower machines that
    // full-load wait kept the loader on screen for several seconds. We trigger
    // on document.fonts.ready — so the typed text renders in the right font
    // without reflowing — and cap the wait so a slow resource can never keep
    // the loader up.
    var started = false;
    function startOnce() {
      if (started || gen !== introGen) return;
      started = true;
      startTypewriter();
    }

    var MAX_LOADER_MS = 1200; // hard ceiling, whatever is still loading
    var capTimer = setTimeout(startOnce, MAX_LOADER_MS);
    function ready() {
      clearTimeout(capTimer);
      setTimeout(startOnce, 200); // brief settle so the spinner isn't a flash
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(ready);
    } else if (document.readyState === 'complete' || document.readyState === 'interactive') {
      ready();
    } else {
      document.addEventListener('DOMContentLoaded', ready, { once: true });
    }
  }

  /* ---- Build intro DOM + typewriter animation ---- */

  function buildIntroDOM(isSmartphone, gen) {
    var container = deps.getContainer();

    introTextEl = document.createElement('div');
    introTextEl.className = 'typing-game__text typing-game__text--intro';

    var introInner = document.createElement('div');
    introInner.className = 'typing-game__text-inner typing-game__intro-inner';
    introTextEl.appendChild(introInner);

    if (!isSmartphone) {
      introButtonEl = document.createElement('button');
      introButtonEl.className = 'btn btn--outline typing-game__intro-btn';
      introButtonEl.textContent = t('introBtn');
    }

    var chars = t('introText').split('');
    var idx = 0;
    var speed = 16;
    var introCombo = 0;
    var introTrailTimestamps = [];
    var introTrailSpeed = 0;
    var introFinished = false;

    function getIntroTrailColor() {
      var dk = document.documentElement.dataset.theme === 'dark';
      var nt = document.documentElement.dataset.theme === 'nature';
      return { r: nt ? 94 : dk ? 156 : 242, g: nt ? 184 : dk ? 39 : 162, b: nt ? 58 : dk ? 176 : 133 };
    }

    function calcIntroTrailSpeed() {
      if (introTrailTimestamps.length < 2) { introTrailSpeed = 0; return; }
      var recent = introTrailTimestamps.slice(-8);
      var totalInterval = recent[recent.length - 1] - recent[0];
      var avgInterval = totalInterval / (recent.length - 1);
      introTrailSpeed = Math.max(0, Math.min(1, 1 - (avgInterval - 30) / 450));
    }

    function renderIntro() {
      var html = '';
      var tc = getIntroTrailColor();

      var trailLen = 0;
      if (introCombo >= 10 && introTrailSpeed > 0.05) {
        var comboFactor = Math.min(introCombo / 150, 1);
        trailLen = Math.round(2 + comboFactor * 28);
        trailLen = Math.round(trailLen * (0.15 + introTrailSpeed * 0.85));
      }

      function cursorSpan() {
        var cursorCls = 'typing-game__char typing-game__char--cursor';
        if (introCombo >= 60) cursorCls += ' typing-game__char--combo-3';
        else if (introCombo >= 30) cursorCls += ' typing-game__char--combo-2';
        else if (introCombo >= 10) cursorCls += ' typing-game__char--combo-1';
        return '<span class="' + cursorCls + '">\u200B</span>';
      }

      // Render every char (typed + not-yet-typed) so the box keeps its final
      // size from the start; untyped chars are hidden via --pending.
      for (var i = 0; i < chars.length; i++) {
        if (!introFinished && i === idx) html += cursorSpan();

        var typed = i < idx;
        var cls = 'typing-game__char';
        var trailAttr = '';

        if (typed) {
          cls += ' typing-game__char--correct';
          if (!introFinished && trailLen > 0) {
            var distFromCursor = idx - i;
            if (distFromCursor <= trailLen && distFromCursor >= 1) {
              cls += ' typing-game__char--trail';
              var trailOpacity = (1 - (distFromCursor - 1) / trailLen) * introTrailSpeed;
              trailOpacity = Math.max(0.05, Math.min(1, trailOpacity));
              trailAttr = ' style="--trail-opacity:' + trailOpacity.toFixed(3)
                + ';--trail-r:' + tc.r
                + ';--trail-g:' + tc.g
                + ';--trail-b:' + tc.b + '"';
            }
          }
        } else {
          cls += ' typing-game__char--pending';
        }

        var ch = chars[i] === ' ' ? ' ' : chars[i];
        html += '<span class="' + cls + '"' + trailAttr + '>' + ch + '</span>';
      }

      // Cursor at the very end (all chars typed but not yet finished)
      if (!introFinished && idx >= chars.length) html += cursorSpan();

      introInner.innerHTML = html;
    }

    function typeNext() {
      if (gen !== introGen) return; // stale generation
      if (idx >= chars.length) {
        introFinished = true;
        renderIntro();
        deps.unlockGame();
        deps.setIntroSeen(true);
        if (isSmartphone) {
          deps.setIntroActive(false);
          return;
        }
        requestAnimationFrame(function () {
          if (gen !== introGen) return;
          introButtonEl.classList.add('typing-game__intro-btn--visible');
        });
        return;
      }
      introCombo++;
      introTrailTimestamps.push(Date.now());
      if (introTrailTimestamps.length > 20) introTrailTimestamps.shift();
      calcIntroTrailSpeed();
      idx++;
      renderIntro();
      setTimeout(typeNext, speed);
    }

    setTimeout(function () {
      if (gen !== introGen) return; // stale generation
      container.appendChild(introTextEl);
      if (introButtonEl) container.appendChild(introButtonEl);
      typeNext();
    }, 400);

    if (introButtonEl) {
      introButtonEl.addEventListener('click', function () {
        showIntroPopup();
      });
    }
  }

  /* ---- Intro popup ---- */

  function showIntroPopup() {
    deps.showInfoPopup(
      'Typing Game',
      t('introPopupText'),
      t('introPopupHint'),
      function () {
        deps.activateGame();
        transitionToGame();
      }
    );
  }

  /* ---- Transition from intro to game ---- */

  function transitionToGame() {
    deps.setIntroActive(false);
    var container = deps.getContainer();
    var heroTitleEl = deps.getHeroTitle();

    if (heroTitleEl) heroTitleEl.innerHTML = t('heroTitleHTML');

    introTextEl.classList.add('typing-game__text--intro-out');
    introButtonEl.classList.add('typing-game__intro-btn--out');

    setTimeout(function () {
      if (introTextEl && introTextEl.parentNode) introTextEl.remove();
      if (introButtonEl && introButtonEl.parentNode) introButtonEl.remove();

      deps.buildGameDOM();
      container.classList.add('typing-game--reveal');
      void container.offsetHeight;
      container.classList.add('typing-game--reveal-active');

      deps.startGame(true);

      setTimeout(function () {
        container.classList.remove('typing-game--reveal', 'typing-game--reveal-active');
        document.dispatchEvent(new CustomEvent('typinggameready'));
      }, 700);
    }, 400);
  }

  /* ---- Smartphone static display ---- */

  function buildSmartphoneStaticDOM() {
    var container = deps.getContainer();
    var staticText = document.createElement('div');
    staticText.className = 'typing-game__text typing-game__text--intro';
    staticText.textContent = t('introText');
    container.appendChild(staticText);
  }

  /* ---- Desktop static display (already unlocked, not yet activated) ---- */

  function buildDesktopStaticDOM() {
    var container = deps.getContainer();

    introTextEl = document.createElement('div');
    introTextEl.className = 'typing-game__text typing-game__text--intro';
    introTextEl.textContent = t('introText');
    container.appendChild(introTextEl);

    introButtonEl = document.createElement('button');
    introButtonEl.className = 'btn btn--outline typing-game__intro-btn typing-game__intro-btn--visible';
    introButtonEl.textContent = t('introBtn');
    container.appendChild(introButtonEl);

    introButtonEl.addEventListener('click', function () {
      showIntroPopup();
    });
  }

  /* ---- Public API ---- */

  return {
    showIntro: showIntro,
    buildSmartphoneStaticDOM: buildSmartphoneStaticDOM,
    buildDesktopStaticDOM: buildDesktopStaticDOM
  };
};

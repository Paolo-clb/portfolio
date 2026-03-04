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
     showInfoPopup(title, text, shortcut, onClose) — generic popup builder
     unlockGame()       — marks game as unlocked (cookie)
     buildGameDOM()     — builds the full game DOM
     startGame(force)   — starts a new game round
  */

  var t = deps.t;

  // Module-internal state
  var introTextEl = null;
  var introButtonEl = null;

  /* ---- Show intro (entry point) ---- */

  function showIntro(isSmartphone) {
    deps.setIntroActive(true);
    var heroTitleEl = document.querySelector('#hero .section__title');
    deps.setHeroTitle(heroTitleEl);
    if (heroTitleEl) heroTitleEl.textContent = t('heroIntro');

    var container = deps.getContainer();

    // --- Loading screen (shown until page fully loads) ---
    var loadingEl = document.createElement('div');
    loadingEl.className = 'typing-game__loading';
    loadingEl.innerHTML = '<div class="typing-game__loading-spinner"></div>' +
      '<div class="typing-game__loading-text">' + t('loadingText') + '</div>';
    container.appendChild(loadingEl);

    function startTypewriter() {
      loadingEl.classList.add('typing-game__loading--hidden');
      setTimeout(function () {
        if (loadingEl.parentNode) loadingEl.remove();
      }, 400);
      buildIntroDOM(isSmartphone);
    }

    if (document.readyState === 'complete') {
      setTimeout(startTypewriter, 300);
    } else {
      window.addEventListener('load', function () {
        setTimeout(startTypewriter, 200);
      });
    }
  }

  /* ---- Build intro DOM + typewriter animation ---- */

  function buildIntroDOM(isSmartphone) {
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
    var speed = 38;
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

      for (var i = 0; i < idx; i++) {
        var cls = 'typing-game__char typing-game__char--correct';
        var trailAttr = '';

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

        var ch = chars[i] === ' ' ? ' ' : chars[i];
        html += '<span class="' + cls + '"' + trailAttr + '>' + ch + '</span>';
      }

      if (!introFinished) {
        var cursorCls = 'typing-game__char typing-game__char--cursor';
        if (introCombo >= 60) cursorCls += ' typing-game__char--combo-3';
        else if (introCombo >= 30) cursorCls += ' typing-game__char--combo-2';
        else if (introCombo >= 10) cursorCls += ' typing-game__char--combo-1';
        html += '<span class="' + cursorCls + '">\u200B</span>';
      }

      introInner.innerHTML = html;
    }

    function typeNext() {
      if (idx >= chars.length) {
        introFinished = true;
        renderIntro();
        if (isSmartphone) {
          deps.unlockGame();
          deps.setIntroActive(false);
          return;
        }
        requestAnimationFrame(function () {
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
        deps.unlockGame();
        transitionToGame();
      }
    );
  }

  /* ---- Transition from intro to game ---- */

  function transitionToGame() {
    deps.setIntroActive(false);
    var container = deps.getContainer();
    var heroTitleEl = deps.getHeroTitle();

    if (heroTitleEl) heroTitleEl.textContent = t('heroTitle');

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

  /* ---- Public API ---- */

  return {
    showIntro: showIntro,
    buildSmartphoneStaticDOM: buildSmartphoneStaticDOM
  };
};

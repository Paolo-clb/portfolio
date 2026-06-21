/* ==========================================================================
   Hero — Intro / Presentation slide (typewriter)
   Factory function: receives a deps object from the main IIFE.
   Loaded before typing-game.js. Exposed as window.createTypingGameIntro.

   This is now a PURELY PRESENTATIONAL slide of the home carousel (the middle
   "Présentation" slide, between the Typing Game and Light Again slides). It no
   longer gates or launches anything — the two old intro buttons are gone. The
   typewriter plays once on first visit, then stays static; the carousel arrows
   (js/perso-projects.js) move between the three slides.
   ========================================================================== */

window.createTypingGameIntro = function (deps) {
  'use strict';

  /* deps interface:
     t(key)             — translation function
     getContainer()     — returns the intro slide container (#hero-intro)
     markSeen()         — persists "typewriter already played" (cookie)
  */

  var t = deps.t;

  // Module-internal state
  var introTextEl = null;
  var introGen = 0;        // generation counter — cancels stale callbacks
  var introSeen = false;   // typewriter finished at least once this session

  /* ---- Show intro (entry point — plays the typewriter) ---- */

  function showIntro() {
    var gen = ++introGen; // capture current generation
    var container = deps.getContainer();
    if (!container) return;
    container.innerHTML = '';

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
      buildIntroDOM(gen);
    }

    // Start as soon as the page is usable (fonts ready) rather than waiting for
    // the full window 'load'; cap the wait so a slow resource can't stall it.
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

  function buildIntroDOM(gen) {
    var container = deps.getContainer();
    if (!container) return;

    introTextEl = document.createElement('div');
    introTextEl.className = 'typing-game__text typing-game__text--intro';

    var introInner = document.createElement('div');
    introInner.className = 'typing-game__text-inner typing-game__intro-inner';
    introTextEl.appendChild(introInner);

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
        return '<span class="' + cursorCls + '">​</span>';
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
        introSeen = true;
        if (typeof deps.markSeen === 'function') deps.markSeen();
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
      typeNext();
    }, 400);
  }

  /* ---- Static display (already seen — no typewriter replay) ---- */

  function buildStaticDOM() {
    var container = deps.getContainer();
    if (!container) return;
    introGen++; // cancel any in-flight typewriter
    container.innerHTML = '';
    introTextEl = document.createElement('div');
    introTextEl.className = 'typing-game__text typing-game__text--intro';
    introTextEl.textContent = t('introText');
    container.appendChild(introTextEl);
    introSeen = true;
  }

  /* ---- Language change — re-render in the new language ---- */

  function refreshLang() {
    if (introSeen) buildStaticDOM();
    else showIntro();
  }

  /* ---- Public API ---- */

  return {
    showIntro: showIntro,
    buildStaticDOM: buildStaticDOM,
    refreshLang: refreshLang
  };
};

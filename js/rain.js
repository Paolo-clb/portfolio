/* ==========================================================================
   Rain Effect — OffscreenCanvas + Web Worker architecture v2
   
   Main thread (this file): creates canvas, button, toggle.
   Sends scroll / resize / surface / theme / cursor / click data to Worker.
   ALL physics + rendering run in a SEPARATE thread → zero main-thread cost.
   
   Features:
   • Cursor halo bounce — mouse position forwarded to Worker
   • Drain mode — disabling lets existing drops finish falling
   • Falls back to main-thread rendering if OffscreenCanvas unsupported
   • Fallback uses the same full-quality RainEngine (rain-engine.js)
   ========================================================================== */
(function () {
  'use strict';

  /* ── Config ────────────────────────────────────────────── */
  var MAX_DROPS        = 160;
  var MAX_DROPS_MOBILE = 60;
  var STORAGE_KEY      = 'portfolio_rain';
  var SURFACE_RECALC_MS = 3000;
  var SURFACE_SELECTORS =
    '.project-card,.skills-group:not(.skills-group--hidden),.contact__form,.cv-section__card,.footer,.typing-game__text';

  /* ── State ─────────────────────────────────────────────── */
  var canvas, worker;
  var enabled   = false;
  var W = 0, H = 0;
  var dropCount;
  var btnEl;
  var surfRecalcTimer = null;
  var useWorker = false;

  /* ── Fallback state (main-thread, only used if no OffscreenCanvas) ── */
  var fbEngine = null;
  var fbRafId  = null;

  /* ── Surface queries (main thread only — DOM access) ──── */
  function querySurfaces() {
    var els = document.querySelectorAll(SURFACE_SELECTORS);
    var sy  = window.pageYOffset || 0;
    var arr = [];
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      arr.push({
        absTop:    r.top + sy,
        absBottom: r.bottom + sy,
        left:      r.left,
        right:     r.right
      });
    }
    // Add umbrella button as bounce surface when rain is active (open dome)
    if (enabled && btnEl) {
      var br = btnEl.getBoundingClientRect();
      arr.push({
        absTop:    br.top + sy,
        absBottom: br.bottom + sy,
        left:      br.left,
        right:     br.right
      });
    }
    return arr;
  }

  function sendSurfaces() {
    var s = querySurfaces();
    var sy = window.pageYOffset || 0;
    if (useWorker && worker) {
      worker.postMessage({ type: 'surfaces', surfaces: s, scrollY: sy });
    } else if (fbEngine) {
      fbEngine.setSurfaces(s);
      fbEngine.setScroll(sy);
    }
  }

  /* ── Theme helper ──────────────────────────────────────── */
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function sendTheme() {
    var t = currentTheme();
    if (useWorker && worker) {
      worker.postMessage({ type: 'theme', theme: t });
    } else if (fbEngine) {
      fbEngine.setTheme(t);
    }
  }

  /* ── Start / Stop ──────────────────────────────────────── */
  function start() {
    enabled = true;
    canvas.style.display = '';
    sendTheme();
    sendSurfaces();

    if (useWorker) {
      worker.postMessage({
        type: 'start',
        scrollY: window.pageYOffset || 0
      });
    } else {
      fbEngine.start(window.pageYOffset || 0);
      if (!fbRafId) fbRafId = requestAnimationFrame(fbDraw);
    }

    // Periodically refresh surface positions (layout may shift)
    surfRecalcTimer = setInterval(sendSurfaces, SURFACE_RECALC_MS);
  }

  function stop() {
    enabled = false;
    if (surfRecalcTimer) { clearInterval(surfRecalcTimer); surfRecalcTimer = null; }

    if (useWorker) {
      // Drain: stop spawning, let existing drops finish falling
      worker.postMessage({ type: 'drain' });
      // Worker will postMessage 'drained' when done → hide canvas
    } else {
      fbEngine.drain();
      // fbDraw loop will detect 'drained' and hide canvas
    }
  }

  /* ── Toggle ────────────────────────────────────────────── */
  function toggle() {
    if (enabled) {
      stop();
      btnEl.classList.remove('rain-toggle--active');
      localStorage.setItem(STORAGE_KEY, 'off');
    } else {
      start();
      btnEl.classList.add('rain-toggle--active');
      localStorage.setItem(STORAGE_KEY, 'on');
    }
  }

  /* ── Resize ────────────────────────────────────────────── */
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    dropCount = W < 600 ? MAX_DROPS_MOBILE : MAX_DROPS;

    if (useWorker) {
      worker.postMessage({
        type: 'resize',
        width: W,
        height: H,
        dropCount: dropCount,
        scrollY: window.pageYOffset || 0
      });
    } else if (fbEngine) {
      fbEngine.resize(W, H, dropCount);
      fbEngine.setScroll(window.pageYOffset || 0);
    }

    if (enabled) sendSurfaces();
  }

  /* =======================================================================
     Umbrella SVG Button — reworked for better inactive visibility
     ======================================================================= */
  function createUmbrellaButton() {
    var btn = document.createElement('button');
    btn.className = 'rain-toggle';
    btn.setAttribute('aria-label', 'Toggle rain effect');
    // SVG umbrella: dome path morphs between closed (furled) and open via CSS d property
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
        '<path class="umbrella-dome" d="M12 2 C6.5 2 2 6.5 3 12 H21 C22 6.5 17.5 2 12 2 Z" fill="currentColor" fill-opacity="0.15" stroke-width="2"/>' +
        '<g class="umbrella-handle" stroke-width="2">' +
          '<line x1="12" y1="12" x2="12" y2="21"/>' +
          '<path d="M12 21c0 0-2 0-2-1.5S12 18 12 18" fill="none"/>' +
        '</g>' +
      '</svg>' +
      '<span class="rain-ambient" aria-hidden="true">' +
        '<i></i><i></i><i></i><i></i><i></i><i></i>' +
      '</span>';

    // Custom tooltip (same style as typing-game tooltips)
    var tipEl = document.createElement('div');
    tipEl.className = 'rain-toggle__tooltip';
    tipEl.textContent = 'Pluie';
    btn.appendChild(tipEl);
    var tipTimer = null;
    btn.addEventListener('mouseenter', function () {
      clearTimeout(tipTimer);
      tipEl.textContent = enabled ? 'D\u00e9sactiver la pluie' : 'Activer la pluie';
      void tipEl.offsetWidth;
      tipEl.classList.add('rain-toggle__tooltip--visible');
    });
    btn.addEventListener('mouseleave', function () {
      tipEl.classList.remove('rain-toggle__tooltip--visible');
      tipTimer = setTimeout(function () {
        // keep element in DOM, just hidden
      }, 200);
    });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      tipEl.classList.remove('rain-toggle__tooltip--visible');
      toggle();
    });
    return btn;
  }

  function placeButton(btn) {
    var h2 = document.querySelector('#hero .section__title');
    if (!h2) return;
    // Create inline wrapper so button sits right next to the title text
    var row = document.createElement('div');
    row.className = 'hero__title-row';
    h2.parentNode.insertBefore(row, h2);
    row.appendChild(h2);
    row.appendChild(btn);
  }

  /* =======================================================================
     Fallback — main-thread rendering (only if OffscreenCanvas unavailable)
     Uses the same full-quality RainEngine from rain-engine.js.
     ======================================================================= */
  function fbDraw() {
    var result = fbEngine.draw();
    if (result === 'drained') {
      fbRafId = null;
      canvas.style.display = 'none';
      return;
    }
    if (result === 'stopped') {
      fbRafId = null;
      return;
    }
    fbRafId = requestAnimationFrame(fbDraw);
  }

  /* =======================================================================
     Init
     ======================================================================= */
  function init() {
    W = window.innerWidth;
    H = window.innerHeight;
    dropCount = W < 600 ? MAX_DROPS_MOBILE : MAX_DROPS;

    // ── Create canvas ──
    canvas = document.createElement('canvas');
    canvas.className = 'rain-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.display = 'none';

    var tint = document.querySelector('.bg-tint-overlay');
    if (tint) tint.after(canvas);
    else document.body.insertBefore(canvas, document.body.firstChild);

    // ── Try OffscreenCanvas + Worker ──
    var canUseWorker = typeof canvas.transferControlToOffscreen === 'function';

    if (canUseWorker) {
      try {
        var offscreen = canvas.transferControlToOffscreen();
        worker = new Worker('js/rain-worker.js');
        worker.postMessage({
          type: 'init',
          canvas: offscreen,
          width: W,
          height: H,
          dropCount: dropCount
        }, [offscreen]);
        useWorker = true;

        // Listen for drain completion
        worker.onmessage = function (e) {
          if (e.data.type === 'drained') {
            canvas.style.display = 'none';
          }
        };
      } catch (err) {
        useWorker = false;
      }
    }

    // Fallback: main-thread engine (same full-quality rendering)
    if (!useWorker) {
      fbEngine = createRainEngine();
      fbEngine.init(canvas, W, H, dropCount);
    }

    // ── Button ──
    btnEl = createUmbrellaButton();
    placeButton(btnEl);

    // ── Scroll → forward to worker (or engine for fallback) ──
    window.addEventListener('scroll', function () {
      var sy = window.pageYOffset || 0;
      if (useWorker && worker) {
        worker.postMessage({ type: 'scroll', scrollY: sy });
      } else if (fbEngine) {
        fbEngine.setScroll(sy);
      }
    }, { passive: true });

    // ── Mouse → forward cursor position for halo bounce ──
    // Throttle: send at most every 16ms (~60fps) to avoid flooding
    var lastCursorSend = 0;
    document.addEventListener('mousemove', function (e) {
      var now = performance.now();
      if (now - lastCursorSend < 16) return;
      lastCursorSend = now;
      if (useWorker && worker) {
        worker.postMessage({ type: 'cursor', x: e.clientX, y: e.clientY });
      } else if (fbEngine) {
        fbEngine.setCursor(e.clientX, e.clientY);
      }
    }, { passive: true });

    // ── Resize ──
    window.addEventListener('resize', resize);

    // ── Theme change → forward to worker ──
    new MutationObserver(function () {
      sendTheme();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // ── DOM layout changes → refresh surfaces immediately ──
    // Catches: popup open/close, skill expand/collapse, modal overlays, etc.
    var surfDebounce = null;
    new MutationObserver(function () {
      if (!enabled) return;
      if (surfDebounce) clearTimeout(surfDebounce);
      surfDebounce = setTimeout(sendSurfaces, 80);
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });

    // ── Restore saved state ──
    if (localStorage.getItem(STORAGE_KEY) === 'on') {
      start();
      btnEl.classList.add('rain-toggle--active');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

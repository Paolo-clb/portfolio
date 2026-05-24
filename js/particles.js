// ==========================================================================
//  Hover Particles — snowflake aura on typing-game__text
//   • "aura" — snowflakes on typing-game__text:
//              hover only when UNfocused | WPM>60 auto (no hover needed)
//  Speed scales with the global animation speed slider.
//  Theme-aware colors. Respects data-animations="off".
// ==========================================================================
(function () {
  'use strict';

  // ── Speed factor (set by animation controls in main.js) ──
  var speedFactor = 1;
  window.__setParticlesSpeed = function (f) { speedFactor = f; };

  // ── Theme palette ──
  function getColors() {
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    if (theme === 'dark') return { core: [200, 140, 255], accent: [255, 78, 203], glow: [156, 39, 176] };
    if (theme === 'nature') return { core: [94, 184, 58], accent: [74, 181, 214], glow: [123, 218, 78] };
    return { core: [242, 162, 133], accent: [191, 153, 160], glow: [242, 128, 128] };
  }

  // ── Canvas ──
  var canvas, ctx;
  var W = 0, H = 0, dpr = 1;
  var raf = null, running = false;
  var pageHidden = false;

  function boot() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'hover-particles-canvas';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize, { passive: true });
  }

  var _lastW = 0, _lastH = 0;
  // Coarse pointer = phone/tablet (address bar toggles change viewport height);
  // ignore height-only changes there, honor real vertical resizes on desktop.
  var _coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  function resize() {
    var w = window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    if (_lastW && w === _lastW && (_coarsePointer || h === _lastH)) return;
    _lastW = w;
    _lastH = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w; H = h;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = '';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ══════════════════════════════════════════════════════
  //  SNOWFLAKE AURA — typing game text
  // ══════════════════════════════════════════════════════

  var auraHoveredEl = null;
  var auraAutoEl = null;
  var auraFlakes = [];
  var FLAKE_MAX = 500;
  var auraTicker = null;

  function getAuraAutoEl() {
    if (!auraAutoEl) auraAutoEl = document.querySelector('.typing-game__text');
    return auraAutoEl;
  }

  // Periodic kick so auto-aura (WPM > 60 while focused) can start the loop
  // even when nothing else is animating.
  function startAuraTicker() {
    if (auraTicker) return;
    auraTicker = setInterval(function () {
      if (speedFactor <= 0) return;
      if (document.documentElement.getAttribute('data-animations') === 'off') return;
      var autoEl = getAuraAutoEl();
      if (autoEl && window.__typingGameFocused && window.__typingGameFocused()) {
        var wpm = window.__typingGameWPM ? window.__typingGameWPM() : 0;
        if (wpm > 60) { boot(); ensureRunning(); }
      }
    }, 500);
  }

  function drawSnowflake(r) {
    ctx.beginPath();
    for (var b = 0; b < 6; b++) {
      var angle = (b / 6) * Math.PI * 2 - Math.PI / 2;
      var ex = Math.cos(angle) * r, ey = Math.sin(angle) * r;
      ctx.moveTo(0, 0);
      ctx.lineTo(ex, ey);
      var mx = Math.cos(angle) * r * 0.6, my = Math.sin(angle) * r * 0.6;
      var barbLen = r * 0.35;
      var a1 = angle + 0.55, a2 = angle - 0.55;
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a1) * barbLen, my + Math.sin(a1) * barbLen);
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a2) * barbLen, my + Math.sin(a2) * barbLen);
    }
    ctx.stroke();
  }

  function renderFlake(x, y, r, col, alpha, spin) {
    var rgba = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',';
    ctx.save();
    ctx.globalAlpha = alpha * 0.3;
    ctx.shadowColor = rgba + '0.7)';
    ctx.shadowBlur = r * 3;
    ctx.fillStyle = rgba + '1)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = rgba + '1)';
    ctx.lineWidth = Math.max(0.5, r * 0.18);
    ctx.lineCap = 'round';
    ctx.translate(x, y);
    ctx.rotate(spin);
    drawSnowflake(r);
    ctx.restore();
  }

  function spawnAuraFlake(rect) {
    if (auraFlakes.length >= FLAKE_MAX) return;
    var c = getColors();
    var pal = [c.core, c.accent, c.glow];
    var col = pal[Math.random() * 3 | 0];
    var side = Math.random() * 4 | 0;
    var x, y, pad = 5;
    if (side === 0)      { x = rect.left + Math.random() * rect.width; y = rect.top - pad; }
    else if (side === 1) { x = rect.left + Math.random() * rect.width; y = rect.bottom + pad; }
    else if (side === 2) { x = rect.left - pad; y = rect.top + Math.random() * rect.height; }
    else                 { x = rect.right + pad; y = rect.top + Math.random() * rect.height; }
    var angle = Math.random() * Math.PI * 2;
    var speed = 0.15 + Math.random() * 0.45;
    auraFlakes.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.25,
      r: 1 + Math.random() * 1.5,
      life: 1,
      decay: 0.007 + Math.random() * 0.005,
      col: col,
      spin: Math.random() * Math.PI * 2,
      spinV: (Math.random() - 0.5) * 0.04,
      twinkle: Math.random() * Math.PI * 2,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: 0.2 + Math.random() * 0.5,
      wobbleFreq: 0.02 + Math.random() * 0.03
    });
  }

  // ══════════════════════════════════════════════════════
  //  FRAME LOOP
  // ══════════════════════════════════════════════════════

  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    var animsOff = document.documentElement.getAttribute('data-animations') === 'off';
    var sf = speedFactor;

    // ── Aura snowflake logic ──
    var autoEl = getAuraAutoEl();
    var gameFocused = window.__typingGameFocused ? window.__typingGameFocused() : false;
    var wpm = window.__typingGameWPM ? window.__typingGameWPM() : 0;
    var isAutoAura = !animsOff && gameFocused && wpm > 60 && autoEl && sf > 0;

    if (isAutoAura) {
      // Focus + WPM > 60 → auto-aura, no hover needed
      var autoRect = autoEl.getBoundingClientRect();
      var t = Math.min((wpm - 60) / 90, 1);
      var rate = (0.5 + t * 2.0) * sf;
      var whole = Math.floor(rate);
      var frac = rate - whole;
      var cnt = whole + (Math.random() < frac ? 1 : 0);
      for (var k = 0; k < cnt; k++) spawnAuraFlake(autoRect);
    } else if (auraHoveredEl && !gameFocused && !animsOff && sf > 0) {
      // Hover aura — strictly unfocused only
      var hRect = auraHoveredEl.getBoundingClientRect();
      var hRate = (1 + Math.random()) * sf;
      var hWhole = Math.floor(hRate);
      var hFrac = hRate - hWhole;
      var hCnt = hWhole + (Math.random() < hFrac ? 1 : 0);
      for (var k2 = 0; k2 < hCnt; k2++) spawnAuraFlake(hRect);
    }

    // Update & draw aura flakes
    for (var j = auraFlakes.length - 1; j >= 0; j--) {
      var p = auraFlakes[j];
      p.life -= p.decay * sf;
      if (p.life <= 0) { auraFlakes.splice(j, 1); continue; }

      p.wobblePhase += p.wobbleFreq * sf;
      p.x += p.vx * sf + Math.sin(p.wobblePhase) * p.wobbleAmp * sf;
      p.y += p.vy * sf;
      p.spin += p.spinV * sf;
      p.vy -= 0.008 * sf;
      p.vx *= 1 - 0.003 * sf;

      p.twinkle += 0.08 * sf;
      var fAlpha = p.life * (0.55 + 0.45 * Math.sin(p.twinkle));
      if (p.life > 0.8) fAlpha *= (1 - p.life) / 0.2;

      renderFlake(p.x, p.y, p.r * (0.6 + 0.4 * p.life), p.col, fAlpha, p.spin);
    }

    // ── Continue condition ──
    if (auraFlakes.length > 0 || auraHoveredEl || isAutoAura) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function ensureRunning() {
    if (running || pageHidden) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  // Pause the animation loop while the tab is hidden, resume on return.
  document.addEventListener('visibilitychange', function () {
    pageHidden = document.hidden;
    if (pageHidden) {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      running = false;
    } else {
      ensureRunning(); // frame() self-terminates if there's nothing to animate
    }
  });

  // ══════════════════════════════════════════════════════
  //  INIT & DELEGATION
  // ══════════════════════════════════════════════════════

  function attachAura(selector) {
    document.addEventListener('pointerenter', function (e) {
      if (!e.target || typeof e.target.closest !== 'function') return;
      var target = e.target.closest(selector);
      if (!target) return;
      if (document.documentElement.getAttribute('data-animations') === 'off') return;
      boot();
      auraHoveredEl = target;
      ensureRunning();
    }, true);
    document.addEventListener('pointerleave', function (e) {
      if (!e.target || typeof e.target.closest !== 'function') return;
      var target = e.target.closest(selector);
      if (!target) return;
      // Only clear if pointer actually left the target element,
      // not just moved between child elements within it
      if (e.relatedTarget && typeof e.relatedTarget.closest === 'function' &&
          e.relatedTarget.closest(selector) === target) return;
      if (auraHoveredEl === target) auraHoveredEl = null;
    }, true);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    attachAura('.typing-game__text');
    startAuraTicker();
  });
})();

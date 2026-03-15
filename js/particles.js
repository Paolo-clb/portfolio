// ==========================================================================
//  Hover Particles — Snowflake micro-particles on interactive elements
//  Self-contained IIFE. Two variants:
//   • "lift"  — snowflakes silently stack on project-cards & skill-items,
//               then burst upward when element lifts on hover
//   • "aura"  — soft edge snowflakes on typing-game__text:
//               unfocused hover | focused WPM>60 scaling
//  Theme-aware colors. Respects data-animations="off".
// ==========================================================================
(function () {
  'use strict';

  // ── Theme palette ──
  function getColors() {
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    if (theme === 'dark') {
      return {
        core:  [200, 140, 255],
        accent:[255, 78, 203],
        glow:  [156, 39, 176]
      };
    }
    if (theme === 'nature') {
      return {
        core:  [94, 184, 58],
        accent:[74, 181, 214],
        glow:  [123, 218, 78]
      };
    }
    return {
      core:  [242, 162, 133],
      accent:[191, 153, 160],
      glow:  [242, 128, 128]
    };
  }

  // ── Canvas setup ──
  var canvas, ctx;
  var W = 0, H = 0;
  var dpr = 1;
  var particles = [];
  var raf = null;
  var running = false;

  // ── Lift accumulation state: Map<element → { count, lastTick }> ──
  var liftAccum = new Map();
  var ACCUM_RATE = 0.7;   // snowflakes stacked per second
  var ACCUM_MAX = 40;     // maximum stockpile
  var accumTicker = null;

  // ── Aura hover state ──
  var auraHoveredEl = null;

  function boot() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'hover-particles-canvas';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize, { passive: true });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Snowflake drawing helper ──
  // Draws a 6-branch crystalline snowflake centered at (0,0)
  function drawSnowflake(r) {
    ctx.beginPath();
    for (var b = 0; b < 6; b++) {
      var angle = (b / 6) * Math.PI * 2 - Math.PI / 2;
      // Main branch
      var ex = Math.cos(angle) * r;
      var ey = Math.sin(angle) * r;
      ctx.moveTo(0, 0);
      ctx.lineTo(ex, ey);
      // Small side barbs at 60% of branch length
      var mx = Math.cos(angle) * r * 0.6;
      var my = Math.sin(angle) * r * 0.6;
      var barbLen = r * 0.35;
      var a1 = angle + 0.55;
      var a2 = angle - 0.55;
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a1) * barbLen, my + Math.sin(a1) * barbLen);
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a2) * barbLen, my + Math.sin(a2) * barbLen);
    }
    ctx.stroke();
  }

  // ── Particle pool ──
  var POOL_MAX = 600;
  var palette; // cached per frame

  function makeFlake(x, y, vx, vy, sizeMin, sizeMax, decayMin, decayMax) {
    if (particles.length >= POOL_MAX) return;
    var col = palette[Math.random() * 3 | 0];
    particles.push({
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      r: sizeMin + Math.random() * (sizeMax - sizeMin),
      life: 1,
      decay: decayMin + Math.random() * (decayMax - decayMin),
      col: col,
      spin: Math.random() * Math.PI * 2,
      spinV: (Math.random() - 0.5) * 0.06,
      twinkle: Math.random() * Math.PI * 2
    });
  }

  // ── Burst: release stacked snowflakes from the top edge of an element ──
  function burstFromTop(el) {
    var info = liftAccum.get(el);
    if (!info || info.count < 1) return;
    var count = Math.round(info.count);
    info.count = 0; // consume the stockpile
    var rect = el.getBoundingClientRect();
    palette = (function () { var c = getColors(); return [c.core, c.accent, c.glow]; })();
    boot();
    for (var i = 0; i < count; i++) {
      var x = rect.left + Math.random() * rect.width;
      var y = rect.top + Math.random() * 6; // near top edge
      makeFlake(
        x, y,
        (Math.random() - 0.5) * 2.0,          // horizontal scatter
        -(1.5 + Math.random() * 3.0),          // upward burst
        1.5, 3.5,                               // size range
        0.010, 0.018                             // decay range  — longer life
      );
    }
    ensureRunning();
  }

  // ── Aura spawn — soft edge snowflakes ──
  function spawnAuraFlakes(rect, count) {
    for (var k = 0; k < count; k++) {
      var side = Math.random() * 4 | 0;
      var x, y, pad = 5;
      if (side === 0) {        // top
        x = rect.left + Math.random() * rect.width;
        y = rect.top - pad;
      } else if (side === 1) { // bottom
        x = rect.left + Math.random() * rect.width;
        y = rect.bottom + pad;
      } else if (side === 2) { // left
        x = rect.left - pad;
        y = rect.top + Math.random() * rect.height;
      } else {                 // right
        x = rect.right + pad;
        y = rect.top + Math.random() * rect.height;
      }
      var angle = Math.random() * Math.PI * 2;
      var speed = 0.15 + Math.random() * 0.45;
      makeFlake(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 0.25,
        1, 2.5,
        0.007, 0.012
      );
    }
  }

  // ── Frame loop ──
  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    palette = (function () { var c = getColors(); return [c.core, c.accent, c.glow]; })();

    // ── Aura spawning logic (typing-game text) ──
    if (auraHoveredEl) {
      var rect = auraHoveredEl.getBoundingClientRect();
      var gameFocused = window.__typingGameFocused ? window.__typingGameFocused() : false;
      var wpm = window.__typingGameWPM ? window.__typingGameWPM() : 0;

      if (!gameFocused) {
        // Unfocused hover → steady aura (1–2 per frame)
        spawnAuraFlakes(rect, 1 + (Math.random() * 2 | 0));
      } else if (wpm > 60) {
        // Focused + WPM > 60 → scale intensity with WPM
        // At 60 WPM: ~0.5/frame (weaker than unfocused hover)
        // At 150+ WPM: ~2.5/frame (slightly more than hover)
        var t = Math.min((wpm - 60) / 90, 1); // 0→1 over 60–150 WPM
        var rate = 0.5 + t * 2.0;
        // Probabilistic spawning for fractional rates
        var whole = Math.floor(rate);
        var frac = rate - whole;
        var count = whole + (Math.random() < frac ? 1 : 0);
        if (count > 0) spawnAuraFlakes(rect, count);
      }
      // else: focused but WPM <= 60 → no particles
    }

    // ── Update & draw particles ──
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.spinV;

      // Gentle upward drift + friction
      p.vy -= 0.012;
      p.vx *= 0.995;

      // Twinkle opacity modulation
      p.twinkle += 0.1;
      var alpha = p.life;
      alpha *= 0.55 + 0.45 * Math.sin(p.twinkle);

      // Fade-in during first 20% of life
      if (p.life > 0.8) {
        alpha *= (1 - p.life) / 0.2;
      }

      var r = p.r * (0.6 + 0.4 * p.life);
      var col = p.col;
      var rgba = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',';

      // Outer glow
      ctx.save();
      ctx.globalAlpha = alpha * 0.25;
      ctx.shadowColor = rgba + '0.7)';
      ctx.shadowBlur = r * 3;
      ctx.fillStyle = rgba + '1)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Snowflake crystal
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = rgba + '1)';
      ctx.lineWidth = Math.max(0.5, r * 0.18);
      ctx.lineCap = 'round';
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      drawSnowflake(r);
      ctx.restore();
    }

    if (particles.length > 0 || auraHoveredEl) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function ensureRunning() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  // ── Accumulation ticker: silently increases count for tracked elements ──
  function startAccumTicker() {
    if (accumTicker) return;
    var lastTime = Date.now();
    accumTicker = setInterval(function () {
      var now = Date.now();
      var dt = (now - lastTime) / 1000;
      lastTime = now;
      liftAccum.forEach(function (info) {
        info.count = Math.min(info.count + ACCUM_RATE * dt, ACCUM_MAX);
      });
    }, 500);
  }

  // ── Register an element for silent accumulation ──
  function trackLift(el) {
    if (liftAccum.has(el)) return;
    liftAccum.set(el, { count: 0 });
    startAccumTicker();
  }

  // ── Attach lift listeners via delegation ──
  function attachLift(selector) {
    // Start observing elements for accumulation once they exist
    function scanAndTrack() {
      document.querySelectorAll(selector).forEach(function (el) {
        trackLift(el);
      });
    }

    // Initial scan + rescan after renders
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scanAndTrack);
    } else {
      scanAndTrack();
    }
    // Re-scan periodically for dynamically created elements (modals)
    var mo = new MutationObserver(function () { scanAndTrack(); });
    mo.observe(document.body, { childList: true, subtree: true });

    // On hover → burst accumulated snowflakes
    document.addEventListener('pointerenter', function (e) {
      var target = e.target.closest(selector);
      if (!target) return;
      if (document.documentElement.getAttribute('data-animations') === 'off') return;
      boot();
      burstFromTop(target);
    }, true);
  }

  // ── Attach aura listeners for typing-game text ──
  function attachAura(selector) {
    document.addEventListener('pointerenter', function (e) {
      var target = e.target.closest(selector);
      if (!target) return;
      if (document.documentElement.getAttribute('data-animations') === 'off') return;
      boot();
      auraHoveredEl = target;
      ensureRunning();
    }, true);

    document.addEventListener('pointerleave', function (e) {
      var target = e.target.closest(selector);
      if (!target) return;
      if (auraHoveredEl === target) auraHoveredEl = null;
    }, true);
  }

  // ── Init on DOMContentLoaded ──
  document.addEventListener('DOMContentLoaded', function () {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    attachLift('.project-card');
    attachLift('.skill-item');
    attachAura('.typing-game__text');
  });
})();

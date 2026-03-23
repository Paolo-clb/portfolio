// ==========================================================================
//  Hover Particles — Two visual systems on interactive elements
//   • "butterfly" — rare butterflies rest on project-cards & skill-items,
//                   flutter away delicately on hover. Skip hidden skills.
//   • "aura"      — snowflakes on typing-game__text:
//                   hover only when UNfocused | WPM>60 auto (no hover needed)
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
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ══════════════════════════════════════════════════════
  //  BUTTERFLY SYSTEM — projects & skills
  // ══════════════════════════════════════════════════════

  var bflyMap = new Map();   // Map<el, { resting: [], fracAccum, type }>
  var BFLY_CFG = {
    project: { rate: 0.12, max: 5, rMin: 8, rRange: 6 },   // bigger & more frequent
    skill:   { rate: 0.04, max: 2, rMin: 4, rRange: 3 }    // smaller & rarer
  };
  var totalResting = 0;
  var bflyTicker = null;

  var flyingBflies = [];
  var BFLY_FLY_MAX = 100;

  // Visibility: handles display:none parents + off-screen + overflow:hidden collapse
  function isElementVisible(el) {
    var rect = el.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > 0 && rect.top < H;
  }

  // ── Draw butterfly shape at (0,0) ──
  function drawButterflyShape(r, flapPhase) {
    var ws = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(flapPhase));
    var wx = ws * r;

    // Body
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.5);
    ctx.lineTo(0, r * 0.5);
    ctx.stroke();

    // Antennae
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.5);
    ctx.quadraticCurveTo(-r * 0.15, -r * 0.9, -r * 0.3, -r * 0.82);
    ctx.moveTo(0, -r * 0.5);
    ctx.quadraticCurveTo(r * 0.15, -r * 0.9, r * 0.3, -r * 0.82);
    ctx.stroke();

    // Upper wings
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.3);
    ctx.bezierCurveTo(-wx * 0.6, -r * 0.9, -wx * 1.05, -r * 0.35, -wx * 0.12, r * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.3);
    ctx.bezierCurveTo(wx * 0.6, -r * 0.9, wx * 1.05, -r * 0.35, wx * 0.12, r * 0.05);
    ctx.closePath();
    ctx.fill();

    // Lower wings
    ctx.beginPath();
    ctx.moveTo(0, r * 0.05);
    ctx.bezierCurveTo(-wx * 0.45, -r * 0.05, -wx * 0.75, r * 0.5, -wx * 0.05, r * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, r * 0.05);
    ctx.bezierCurveTo(wx * 0.45, -r * 0.05, wx * 0.75, r * 0.5, wx * 0.05, r * 0.42);
    ctx.closePath();
    ctx.fill();
  }

  function renderButterfly(x, y, r, col, alpha, bodyAngle, flapPhase) {
    var rgba = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',';
    // Glow
    ctx.save();
    ctx.globalAlpha = alpha * 0.2;
    ctx.shadowColor = rgba + '0.6)';
    ctx.shadowBlur = r * 2;
    ctx.fillStyle = rgba + '1)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Shape
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bodyAngle);
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = rgba + '0.85)';
    ctx.strokeStyle = rgba + '1)';
    ctx.lineWidth = Math.max(0.4, r * 0.1);
    ctx.lineCap = 'round';
    drawButterflyShape(r, flapPhase);
    ctx.restore();
  }

  function launchBfly(x, y, r, colIdx) {
    if (flyingBflies.length >= BFLY_FLY_MAX) return;
    flyingBflies.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(0.2 + Math.random() * 0.4),
      r: r, colIdx: colIdx,
      life: 1,
      decay: 0.002 + Math.random() * 0.003,
      bodyAngle: (Math.random() - 0.5) * 0.4,
      bodyAngleTarget: 0,
      flapPhase: Math.random() * Math.PI * 2,
      flapSpeed: 3 + Math.random() * 2,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleFreq: 0.015 + Math.random() * 0.02,
      wobbleAmp: 0.3 + Math.random() * 0.8
    });
  }

  // Flutter all resting butterflies off an element
  function flutterFrom(el) {
    var info = bflyMap.get(el);
    if (!info || info.resting.length === 0) return;
    var rect = el.getBoundingClientRect();
    for (var i = 0; i < info.resting.length; i++) {
      var b = info.resting[i];
      launchBfly(
        rect.left + b.rx * rect.width,
        rect.top + b.ry * rect.height,
        b.r, b.colIdx
      );
    }
    totalResting -= info.resting.length;
    info.resting = [];
    info.fracAccum = 0;
    ensureRunning();
  }

  function startBflyTicker() {
    if (bflyTicker) return;
    var lastTime = Date.now();
    bflyTicker = setInterval(function () {
      var now = Date.now();
      var dt = (now - lastTime) / 1000;
      lastTime = now;
      if (speedFactor <= 0) return;
      if (document.documentElement.getAttribute('data-animations') === 'off') return;

      var added = false;
      bflyMap.forEach(function (info, el) {
        var cfg = BFLY_CFG[info.type] || BFLY_CFG.skill;
        if (info.resting.length >= cfg.max) return;
        if (!isElementVisible(el)) return;
        info.fracAccum += cfg.rate * dt * speedFactor;
        while (info.fracAccum >= 1 && info.resting.length < cfg.max) {
          info.fracAccum -= 1;
          info.resting.push({
            rx: 0.1 + Math.random() * 0.8,
            ry: 0.15 + Math.random() * 0.7,
            r: cfg.rMin + Math.random() * cfg.rRange,
            colIdx: Math.random() * 3 | 0,
            bodyAngle: (Math.random() - 0.5) * 0.5,
            flapPhase: Math.random() * Math.PI * 2,
            flapSpeed: 1.5 + Math.random() * 1.5,
            fadeIn: 0
          });
          totalResting++;
          added = true;
        }
      });
      if (added || totalResting > 0) { boot(); ensureRunning(); }

      // Kick loop for auto-aura
      var autoEl = getAuraAutoEl();
      if (autoEl && window.__typingGameFocused && window.__typingGameFocused()) {
        var wpm = window.__typingGameWPM ? window.__typingGameWPM() : 0;
        if (wpm > 60) { boot(); ensureRunning(); }
      }
    }, 500);
  }

  function trackBfly(el, type) {
    if (bflyMap.has(el)) return;
    bflyMap.set(el, { resting: [], fracAccum: 0, type: type || 'skill' });
    startBflyTicker();
  }

  // ══════════════════════════════════════════════════════
  //  SNOWFLAKE AURA — typing game text
  // ══════════════════════════════════════════════════════

  var auraHoveredEl = null;
  var auraAutoEl = null;
  var auraFlakes = [];
  var FLAKE_MAX = 500;

  function getAuraAutoEl() {
    if (!auraAutoEl) auraAutoEl = document.querySelector('.typing-game__text');
    return auraAutoEl;
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
    var pal = (function () { var c = getColors(); return [c.core, c.accent, c.glow]; })();

    // ── 1. Render resting butterflies ──
    if (!animsOff) {
      bflyMap.forEach(function (info, el) {
        if (info.resting.length === 0) return;
        if (!isElementVisible(el)) return;
        var rect = el.getBoundingClientRect();
        for (var i = 0; i < info.resting.length; i++) {
          var b = info.resting[i];
          if (b.fadeIn < 1) b.fadeIn = Math.min(1, b.fadeIn + 0.02 * sf);
          b.flapPhase += b.flapSpeed * 0.016 * sf;
          renderButterfly(
            rect.left + b.rx * rect.width,
            rect.top + b.ry * rect.height,
            b.r, pal[b.colIdx], b.fadeIn, b.bodyAngle, b.flapPhase
          );
        }
      });
    }

    // ── 2. Update & draw flying butterflies ──
    for (var i = flyingBflies.length - 1; i >= 0; i--) {
      var fb = flyingBflies[i];
      fb.life -= fb.decay * sf;
      if (fb.life <= 0) { flyingBflies.splice(i, 1); continue; }

      fb.flapPhase += fb.flapSpeed * 0.016 * sf;
      fb.wobblePhase += fb.wobbleFreq * sf;
      fb.x += fb.vx * sf + Math.sin(fb.wobblePhase) * fb.wobbleAmp * sf;
      fb.y += fb.vy * sf;

      // Gentle upward drift + random direction nudge
      fb.vy -= 0.005 * sf;
      fb.vx += (Math.random() - 0.5) * 0.02 * sf;
      fb.vx *= 1 - 0.002 * sf;

      // Body angle leans toward movement direction
      fb.bodyAngleTarget = fb.vx * 0.3;
      fb.bodyAngle += (fb.bodyAngleTarget - fb.bodyAngle) * 0.05 * sf;

      var alpha = fb.life;
      if (fb.life > 0.85) alpha *= (1 - fb.life) / 0.15;

      renderButterfly(fb.x, fb.y, fb.r, pal[fb.colIdx], alpha, fb.bodyAngle, fb.flapPhase);
    }

    // ── 3. Aura snowflake logic ──
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
    if (auraFlakes.length > 0 || flyingBflies.length > 0 ||
        auraHoveredEl || isAutoAura || totalResting > 0) {
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

  // ══════════════════════════════════════════════════════
  //  INIT & DELEGATION
  // ══════════════════════════════════════════════════════

  function attachButterfly(selector, type) {
    function scanAndTrack() {
      document.querySelectorAll(selector).forEach(function (el) { trackBfly(el, type); });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scanAndTrack);
    } else {
      scanAndTrack();
    }
    var mo = new MutationObserver(function () { scanAndTrack(); });
    mo.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('pointerenter', function (e) {
      var target = e.target.closest(selector);
      if (!target) return;
      if (document.documentElement.getAttribute('data-animations') === 'off') return;
      boot();
      flutterFrom(target);
    }, true);
  }

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

  document.addEventListener('DOMContentLoaded', function () {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    attachButterfly('.project-card', 'project');
    attachButterfly('.skill-item', 'skill');
    attachAura('.typing-game__text');
  });
})();

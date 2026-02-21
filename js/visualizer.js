/* ==========================================================================
   Audio Visualizer — Frequency bars rising from the bottom
   Connects to the music player's AudioContext (exposed on window).
   Only works over HTTP (Web Audio API requires CORS for MediaElement).
   ========================================================================== */

(function () {
  'use strict';

  let canvas, ctx;
  let analyser = null;
  let dataArray = null;
  let animId = null;
  let connected = false;

  // Bar appearance
  const BAR_COUNT = 64;
  const BAR_GAP = 2;
  const MIN_BAR_HEIGHT = 2;

  // Theme-aware colors — read current palette each frame
  function getThemeColors() {
    var isDark = document.documentElement.dataset.theme === 'dark';
    return {
      primary: isDark ? '#9c27b0' : '#F2A285',
      accent:  isDark ? '#ff4ecb' : '#BF99A0',
      hover:   isDark ? '#6a0dad' : '#F28080',
      textRgba: isDark ? 'rgba(224, 224, 255, ' : 'rgba(232, 227, 228, '
    };
  }

  /* ---- Particles ---- */

  const PARTICLE_COUNT = 60;
  let particles = [];

  // Impulse state for click/key reactions
  let impulse = 0;          // 0–1, decays over time
  let impulseX = 0;         // click position
  let impulseY = 0;
  let impulseIsClick = false; // true = repel from point, false = random burst

  function createParticle(w, h) {
    var colors = getThemeColors();
    return {
      x: Math.random() * w,
      y: Math.random() * h,                 // full screen
      baseY: 0,
      radius: Math.random() * 3.5 + 2.5,
      baseRadius: 0,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.15,
      alpha: Math.random() * 0.4 + 0.5,
      baseAlpha: 0,
      color: [colors.primary, colors.accent, colors.hover][Math.floor(Math.random() * 3)],
      freqBin: Math.floor(Math.random() * BAR_COUNT), // which frequency bin reacts to
    };
  }

  function initParticles(w, h) {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = createParticle(w, h);
      p.baseY = p.y;
      p.baseRadius = p.radius;
      p.baseAlpha = p.alpha;
      particles.push(p);
    }
  }

  function updateAndDrawParticles(w, h) {
    // Get current theme colors (may change mid-frame on toggle)
    var colors = getThemeColors();
    var colorArr = [colors.primary, colors.accent, colors.hover];

    // Get average energy for reactivity
    let avgEnergy = 0;
    if (dataArray) {
      for (let i = 0; i < dataArray.length; i++) avgEnergy += dataArray[i];
      avgEnergy /= dataArray.length * 255;
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Update color to match current theme
      p.color = colorArr[i % 3];
      // Per-particle frequency reactivity
      let binVal = 0;
      if (dataArray && p.freqBin < dataArray.length) {
        binVal = dataArray[p.freqBin] / 255;
      }

      // Movement
      p.x += p.vx + (binVal * (Math.random() - 0.5) * 4);
      p.y += p.vy + (Math.sin(Date.now() * 0.001 + i) * 0.2) + (binVal * (Math.random() - 0.5) * 3);

      // React to impulse (click or keypress)
      if (impulse > 0.01) {
        if (impulseIsClick) {
          // Repel from click point
          const dx = p.x - impulseX;
          const dy = p.y - impulseY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = impulse * 300 / (dist + 50);
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }
        // Keypress: no movement, only glow (handled below)
      }

      // React to music: size and brightness pulse
      const keyGlow = impulseIsClick ? impulse : impulse * 2.5;
      p.radius = p.baseRadius + binVal * 9 + (impulseIsClick ? impulse * 2 : impulse * 5);
      p.alpha  = p.baseAlpha + binVal * 0.9 + keyGlow * 0.5;

      // Wrap around edges
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      // Dim particle when it sits behind a visualizer bar
      let drawAlpha = Math.min(p.alpha, 1);
      if (connected && dataArray) {
        const usableBins = Math.min(BAR_COUNT, dataArray.length);
        const totalBarW = (w - (usableBins - 1) * BAR_GAP) / usableBins;
        const barW = Math.max(totalBarW, 1);
        const barIdx = Math.floor(p.x / (barW + BAR_GAP));
        if (barIdx >= 0 && barIdx < usableBins) {
          const barH = Math.max((dataArray[barIdx] / 255) * h * 0.7, MIN_BAR_HEIGHT);
          if (p.y >= h - barH) {
            // The deeper inside the bar, the more we dim (0.3 at bar top → 0.15 at bottom)
            const depth = (p.y - (h - barH)) / barH;
            drawAlpha *= 0.30 - depth * 0.15;
          }
        }
      }

      // Draw
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = drawAlpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw connections between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 180 + avgEnergy * 80;

        if (dist < maxDist) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = colors.textRgba + ((1 - dist / maxDist) * 0.35) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---- Gradient for bars ---- */

  function createBarGradient(x, w, h, barH) {
    var colors = getThemeColors();
    const grad = ctx.createLinearGradient(x, h, x, h - barH);
    grad.addColorStop(0, colors.primary);
    grad.addColorStop(0.5, colors.accent);
    grad.addColorStop(1, colors.hover);
    return grad;
  }

  /* ---- Try to connect to the music player's audio graph ---- */

  function tryConnect() {
    if (connected) return true;

    const audioCtx = window.__musicPlayerAudioCtx;
    const source   = window.__musicPlayerSource;
    const gain     = window.__musicPlayerGain;

    if (!audioCtx || !source || !gain) return false;

    try {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = BAR_COUNT * 4;       // gives BAR_COUNT*2 frequency bins
      analyser.smoothingTimeConstant = 0.8;

      // Insert analyser: source → gain → analyser → destination
      // (gain is already connected to destination, we add analyser in parallel)
      gain.connect(analyser);

      dataArray = new Uint8Array(analyser.frequencyBinCount);
      connected = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---- Draw one frame ---- */

  function draw() {
    animId = requestAnimationFrame(draw);

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Decay impulse
    impulse *= 0.92;

    // Particles (always drawn, react to audio when connected)
    updateAndDrawParticles(w, h);

    // Try connecting each frame until successful
    if (tryConnect()) {
      analyser.getByteFrequencyData(dataArray);

      const usableBins = Math.min(BAR_COUNT, dataArray.length);
      const totalBarWidth = (w - (usableBins - 1) * BAR_GAP) / usableBins;
      const barWidth = Math.max(totalBarWidth, 1);

      var isDarkTheme = document.documentElement.dataset.theme === 'dark';
      ctx.globalAlpha = isDarkTheme ? 0.18 : 0.4;
      for (let i = 0; i < usableBins; i++) {
        const value = dataArray[i] / 255;
        const barH = Math.max(value * h * 0.7, MIN_BAR_HEIGHT);
        const x = i * (barWidth + BAR_GAP);
        const y = h - barH;

        ctx.fillStyle = createBarGradient(x, barWidth, h, barH);
        ctx.beginPath();
        // Rounded top corners
        const radius = Math.min(barWidth / 2, 4);
        ctx.moveTo(x, h);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---- Resize handler ---- */

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles(canvas.width, canvas.height);
  }

  /* ---- Init ---- */

  function init() {
    canvas = document.createElement('canvas');
    canvas.className = 'visualizer-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);

    // Tinted glass overlay — sits above canvas, below all content
    var tint = document.createElement('div');
    tint.className = 'bg-tint-overlay';
    tint.setAttribute('aria-hidden', 'true');
    canvas.after(tint);

    ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    // Click: repel particles from cursor
    document.addEventListener('click', function (e) {
      impulse = 1;
      impulseX = e.clientX;
      impulseY = e.clientY;
      impulseIsClick = true;
    });

    // Keypress: random burst
    document.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      impulse = Math.min(impulse + 0.5, 1);
      impulseIsClick = false;
    });

    draw();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

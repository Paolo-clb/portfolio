/* ==========================================================================
   Light Again — Music Visualizer (audio-reactive sphere)
   --------------------------------------------------------------------------
   A glowing sphere of dots that ripples in rhythm with the music, pinned
   top-left of the modal just to the right of the FPS / enemies / time stats.
   Same spot in every screen (in-game HUD, pause menu, game-over). The artist
   name ("meowelle") shows under it ONLY when a menu is up — hidden in play.

   Colour follows the GAME palette via LA.getColors().cyan:
     light/desktop → #00ffff · dark → #00ffff · nature → #50ffc8.
   Bright white rim + cyan dotted wave field, matching the inspiration art.

   Audio: a self-contained Web Audio graph on its own <audio> element (the
   portfolio's player is paused while the game is open, so this never clashes).
     source ▸ lowpass (muffled) ▸ analyser ▸ destination
   The analyser drives the sphere; the lowpass is the "paused over a live run"
   filter. For now it loads a portfolio track to test the visualizer — swap
   TEST_TRACK once meowelle's track is in.

   States (driven by the shell at the transition points):
     menu     full + bright, artist shown          (home / mode-select / game-over)
     game     full + bright, artist hidden          (a run is actively playing)
     muffled  lowpassed + calmer, artist shown      (pause over a LIVE run)
     stopped  music paused, sphere calmed, ▶ shown  (the toggle was pressed)
   `stopped` overlays the other three. The whole widget is the play/pause button.
   ========================================================================== */
(function () {
  'use strict';

  // ---- Track (swap for meowelle's final track later) ----------------------
  // artist is always shown as "meowelle" per the brief.
  var TEST_TRACK = { src: 'assets/music/BloomChill.mp3', artist: 'anonyme' };

  var SIZE = 96;          // widget px (canvas is square; sphere + glow + pulse fit inside)

  // Desktop (Tauri launcher) forces the dark/nature game palette → fixed cyan/mint.
  // The web build has the full portfolio themes, so there the sphere follows the
  // active theme accent (--la-accent). Evaluated lazily (not at load) so the
  // launcher's window.__laQuit desktop flag is reliably set by mount time.
  function isDesktop() {
    return !!(window.__laQuit || window.__TAURI__ || window.__TAURI_INTERNALS__);
  }

  // ---- DOM / state --------------------------------------------------------
  var el = null, canvas = null, ctx = null, dpr = 1;
  var state = 'menu';     // 'menu' | 'game' | 'muffled'
  var stopped = false;
  var rafId = 0;

  // ---- Audio --------------------------------------------------------------
  var audioEl = null, audioCtx = null, srcNode = null, lowpass = null,
      analyser = null, freqData = null, gestureHooked = false;

  // ---- Smoothed analysis (eased so the motion is buttery) ------------------
  var sBass = 0, sMid = 0, sTreble = 0, sLevel = 0;
  var bassPeak = 0, bassFloor = 0;  // AGC envelope (recent bass min/max) for normalization
  var settle = 0;                   // frames to ignore the silence→sound swell after a (re)start
  var sDrive = 0;                   // extra smoothing of `drive` → buttery, non-jittery motion
  var T = 0;              // animation clock (seconds), advanced by real dt
  var col = [0, 255, 255]; // resolved sphere colour [r,g,b], cached by computeColor()

  /* ---------- helpers ---------- */
  function animsOff() {
    return document.documentElement.getAttribute('data-animations') === 'off';
  }
  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function isFr() { return (localStorage.getItem('portfolio_lang') || 'fr') !== 'en'; }
  function label() {
    var fr = isFr();
    return stopped ? (fr ? 'Reprendre la musique' : 'Resume music')
                   : (fr ? 'Couper la musique'   : 'Mute music');
  }
  function hexToRgb(hex) {
    hex = (hex || '').trim().replace(/^#/, '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length < 6) return null;
    var n = parseInt(hex.slice(0, 6), 16);
    if (isNaN(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // Game cyan/mint from the canvas palette (desktop colour + web fallback).
  function gameCyanRGB() {
    var LA = window.LightAgain, hex = 0x00ffff;
    if (LA && typeof LA.getColors === 'function') {
      try { hex = LA.getColors().cyan || hex; } catch (e) { /* ignore */ }
    }
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  }
  // Active portfolio theme accent (web: peach / pink / green).
  function accentRGB() {
    if (!el) return null;
    try { return hexToRgb(getComputedStyle(el).getPropertyValue('--la-accent')); }
    catch (e) { return null; }
  }
  // Resolve the sphere colour for the platform/theme and cache it into `col`.
  // Desktop → fixed game cyan/mint · web → follows the theme accent.
  function computeColor() {
    var rgb = isDesktop() ? gameCyanRGB() : (accentRGB() || gameCyanRGB());
    if (rgb) col = rgb;
  }

  var SVG_PLAY = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="8 5 19 12 8 19"/></svg>';
  var SVG_PAUSE = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>';

  /* ---------- build ---------- */
  function build() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'la-viz la-viz--menu';
    b.setAttribute('aria-label', label());
    b.style.setProperty('--la-viz-size', SIZE + 'px');

    canvas = document.createElement('canvas');
    canvas.className = 'la-viz__canvas';
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width = SIZE + 'px';
    canvas.style.height = SIZE + 'px';
    ctx = canvas.getContext('2d');

    var glyph = document.createElement('span');
    glyph.className = 'la-viz__glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.innerHTML = '<span class="la-viz__glyph-pause">' + SVG_PAUSE + '</span>' +
                      '<span class="la-viz__glyph-play">' + SVG_PLAY + '</span>';

    var artist = document.createElement('span');
    artist.className = 'la-viz__artist';
    artist.textContent = TEST_TRACK.artist;

    b.appendChild(canvas);
    b.appendChild(glyph);
    b.appendChild(artist);
    b.addEventListener('click', onClick);
    return b;
  }

  function onClick(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setStopped(!stopped);
  }

  /* ---------- audio graph ---------- */
  function ensureAudio() {
    if (audioCtx) return;
    try {
      audioEl = new Audio(TEST_TRACK.src);
      audioEl.loop = true;
      audioEl.preload = 'auto';
      // (same-origin track ⇒ no crossOrigin needed; add 'anonymous' + CORS
      //  headers only if you later serve the music from another origin.)
      var AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      srcNode = audioCtx.createMediaElementSource(audioEl);
      lowpass = audioCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 22000;       // fully open by default
      lowpass.Q.value = 0.7;
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;   // responsive raw data; our own envelope smooths the visual
      srcNode.connect(lowpass);
      lowpass.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      audioCtx = null; // visualizer still runs on its idle animation
    }
  }

  function playMusic() {
    if (stopped) return;
    ensureAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (e) {} }
    var p = audioEl && audioEl.play();
    if (p && p.catch) p.catch(function () { hookGesture(); });
  }
  // Autoplay was blocked (no gesture) → start on the next user interaction.
  function hookGesture() {
    if (gestureHooked) return;
    gestureHooked = true;
    var go = function () {
      document.removeEventListener('pointerdown', go, true);
      document.removeEventListener('keydown', go, true);
      gestureHooked = false;
      playMusic();
    };
    document.addEventListener('pointerdown', go, true);
    document.addEventListener('keydown', go, true);
  }
  function pauseMusic() { if (audioEl) { try { audioEl.pause(); } catch (e) {} } }

  // Smoothly ramp the lowpass toward the target for the current state.
  function applyFilter() {
    if (!lowpass || !audioCtx) return;
    var target = (state === 'muffled' && !stopped) ? 420 : 22000;
    try {
      lowpass.frequency.setTargetAtTime(target, audioCtx.currentTime, 0.12);
    } catch (e) { lowpass.frequency.value = target; }
  }

  /* ---------- analysis ---------- */
  function avg(arr, a, b) {
    var s = 0, n = 0;
    for (var i = a; i < b && i < arr.length; i++) { s += arr[i]; n++; }
    return n ? (s / n) / 255 : 0;
  }
  function readAudio() {
    // Synthetic spectrum for headless/preview testing (window.__laVizSynth).
    // Gated off when stopped so the preview mirrors the real silence (analyser → 0).
    if (window.__laVizSynth && !stopped) {
      var t = T;
      // Wide bass swing (near-silence → kick) so the preview mirrors real music dynamics.
      var b = 0.12 + 0.78 * Math.pow(Math.abs(Math.sin(t * 3.1)), 1.5);
      var m = 0.30 + 0.40 * Math.abs(Math.sin(t * 5.7 + 1));
      var tr = 0.22 + 0.32 * Math.abs(Math.sin(t * 9.3 + 2));
      return { bass: b, mid: m, treble: tr };
    }
    if (analyser && freqData) {
      analyser.getByteFrequencyData(freqData);
      var n = freqData.length;           // 256 bins
      return {
        bass:   avg(freqData, 1, Math.floor(n * 0.06)),
        mid:    avg(freqData, Math.floor(n * 0.06), Math.floor(n * 0.30)),
        treble: avg(freqData, Math.floor(n * 0.30), Math.floor(n * 0.75))
      };
    }
    return { bass: 0, mid: 0, treble: 0 };
  }

  /* ---------- render ---------- */
  // Sphere geometry / wave constants (tuned for the inspiration look).
  var GRID_X = 32, GRID_Y = 24;
  var TILT = 0.78;                  // radians (~45°) — terrain angle (fills the disc)
  var PLANE_ROT = 0.32;            // in-plane diagonal rotation for the seam look

  function draw(dt) {
    if (!ctx) return;
    var a = readAudio();
    // --- Bass ENVELOPE: fast attack (snaps onto the beat → in sync) + slow release
    //     (glides back down → fluid). This asymmetry is what makes the ring feel
    //     locked to the music instead of mushy/laggy. ---
    var rb = a.bass;
    if (rb > sBass) sBass += (rb - sBass) * 0.42;   // attack — quick rise on the hit
    else            sBass += (rb - sBass) * 0.07;   // release — smooth fall
    sMid    += (a.mid    - sMid)    * 0.30;
    sTreble += (a.treble - sTreble) * 0.28;
    sLevel  += ((a.bass * 0.6 + a.mid * 0.3 + a.treble * 0.1) - sLevel) * 0.30;

    // --- AGC: normalize the bass envelope to its OWN recent dynamic range so the
    //     ring uses its full swing on any track (a constantly-loud bass track won't
    //     pin it near max), and the between-beats size matches the paused size.
    //     `drive` (0..1) is THE beat-synced value everything reacts to. ---
    // Just (re)started? Peg the envelope to the live level for a few hundred ms so
    // the silence→sound swell isn't mistaken for a giant beat (which would snap the
    // ring to max). It only starts counting once real sound is present.
    if (sBass > 0.04 && settle > 0) {
      settle--;
      bassPeak = bassFloor = sBass;                   // → drive 0 (rest) while settling
    } else {
      // Jump to new extremes instantly, but decay/creep back VERY slowly so peak &
      // floor HOLD the recent dynamic range (fast rates would just glue them to the
      // smoothly-varying bass → zero range → no reaction).
      bassPeak  = Math.max(sBass, bassPeak  - 0.0008);
      bassFloor = Math.min(sBass, bassFloor + 0.0008);
    }
    var drive = Math.min(1, Math.max(0, (sBass - bassFloor) / Math.max(bassPeak - bassFloor, 0.10)));
    sDrive += (drive - sDrive) * 0.2;   // final smoothing pass → fluid size/glow changes (caps per-frame jumps)

    var muf = (state === 'muffled' && !stopped);   // paused over a live run
    var calm = stopped ? 0.12 : 1;            // stopped → nearly frozen + dim
    // Muffled = sluggish, low-passed: slow the clock so the waves crawl.
    T += dt * (0.6 + sLevel * 0.9) * (stopped ? 0.15 : muf ? 0.4 : 1);

    var c = SIZE / 2;
    var R = SIZE * 0.25;                       // small rest radius → room for a big, clear pulse
    var rgb = col;
    var cs = rgb[0] + ',' + rgb[1] + ',' + rgb[2];
    var k = sDrive * calm;                     // smoothed beat drive (muted when stopped) — everything reacts to it
    // The ring grows/shrinks IN SYNC with the bass (fast attack / smooth release),
    // clamped to stay in-canvas.
    var sphereScale = 1 + k * 0.52;
    var Rs = Math.min(R * sphereScale, SIZE * 0.38);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    // ---- outer glow halo (grows + brightens with the beat) ----
    var glowA = (0.16 + k * 0.5) * (0.4 + 0.6 * calm);
    var halo = ctx.createRadialGradient(c, c, Rs * 0.5, c, c, Rs * 1.3);
    halo.addColorStop(0, 'rgba(' + cs + ',' + (glowA * 0.9).toFixed(3) + ')');
    halo.addColorStop(0.6, 'rgba(' + cs + ',' + (glowA * 0.35).toFixed(3) + ')');
    halo.addColorStop(1, 'rgba(' + cs + ',0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // ---- sphere body + dotted wave field (clipped to the disc) ----
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, Rs, 0, Math.PI * 2);
    ctx.clip();

    // depth gradient body
    var body = ctx.createRadialGradient(c, c - Rs * 0.2, Rs * 0.1, c, c, Rs);
    body.addColorStop(0, 'rgba(' + cs + ',0.10)');
    body.addColorStop(0.7, 'rgba(8,12,24,0.55)');
    body.addColorStop(1, 'rgba(2,4,10,0.85)');
    ctx.fillStyle = body;
    ctx.fillRect(c - Rs, c - Rs, Rs * 2, Rs * 2);

    // wave terrain
    var cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    var cosP = Math.cos(PLANE_ROT), sinP = Math.sin(PLANE_ROT);
    var amp = (0.13 + sLevel * 0.30 * calm + k * 0.14) * (muf ? 0.55 : 1);  // pulses with the beat; muffled = shorter
    ctx.globalCompositeOperation = 'lighter';
    for (var j = 0; j <= GRID_Y; j++) {
      var w = -1 + 2 * j / GRID_Y;             // depth coord
      for (var i = 0; i <= GRID_X; i++) {
        var u = -1 + 2 * i / GRID_X;
        // in-plane diagonal rotation
        var ur = u * cosP - w * sinP;
        var wr = u * sinP + w * cosP;
        // height: layered travelling waves + audio displacement
        var aud = (sMid * 0.7 + sTreble * 0.5) * Math.sin((i * 1.3 + j * 0.7) - T * 2.0);
        var h = (
          Math.sin(ur * 3.1 + T * 1.05) * 0.5 +
          Math.sin(wr * 2.6 - T * 0.8) * 0.45 +
          Math.sin((ur + wr) * 2.0 + T * 0.6) * 0.3 +
          aud * 0.9
        ) * amp;
        // pseudo-3D rotate around X
        var projX = ur;
        var projY = wr * cosT - h * sinT;
        var depth = wr * sinT + h * cosT;      // -1 (far) .. 1 (near)
        var px = c + projX * Rs * 0.98;
        var py = c + projY * Rs * 1.0;
        // Skip dots outside the disc (clip still cleans the edge) — saves ~40% of fills.
        var ddx = px - c, ddy = py - c;
        if (ddx * ddx + ddy * ddy > Rs * Rs) continue;
        var dn = (depth + 1) * 0.5;            // 0..1
        var hi = Math.max(0, h / amp);         // crest highlight 0..~1.4
        var bright = Math.min(1, 0.12 + dn * 0.5 + hi * 0.28 + k * 0.18) * (0.35 + 0.65 * calm);
        // crest → white, troughs → cyan
        var mix = Math.min(1, hi * 0.5 + k * 0.35);
        var rr = Math.round(rgb[0] + (255 - rgb[0]) * mix);
        var gg = Math.round(rgb[1] + (255 - rgb[1]) * mix);
        var bb = Math.round(rgb[2] + (255 - rgb[2]) * mix);
        var size = (0.55 + dn * 1.15) * (1 + k * 0.3);
        ctx.fillStyle = 'rgba(' + rr + ',' + gg + ',' + bb + ',' + bright.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // ---- bright rim ring (white core + cyan glow, pulses on the beat) ----
    var rimA = (0.5 + k * 0.7) * (0.45 + 0.55 * calm);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // cyan outer glow stroke
    ctx.lineWidth = 2.2 + k * 2.6;
    ctx.strokeStyle = 'rgba(' + cs + ',' + (rimA * 0.6).toFixed(3) + ')';
    ctx.shadowColor = 'rgba(' + cs + ',0.9)';
    ctx.shadowBlur = 6 + k * 10;   // tamed so the bigger pulse's glow stays in-canvas
    ctx.beginPath();
    ctx.arc(c, c, Rs, 0, Math.PI * 2);
    ctx.stroke();
    // white-hot inner core stroke
    ctx.shadowBlur = 4 + k * 6;
    ctx.lineWidth = 1.1 + k * 1.4;
    ctx.strokeStyle = 'rgba(' + Math.round(180 + 75 * Math.min(1, rimA)) + ',255,255,' + Math.min(1, rimA + 0.25).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(c, c, Rs, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  var lastTs = 0;
  function loop(ts) {
    if (!el) return;
    var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    draw(dt);
    rafId = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (rafId) return;
    if (animsOff() || reducedMotion()) { draw(0.016); return; } // single static frame
    lastTs = 0;
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

  /* ---------- state application ---------- */
  function apply() {
    if (!el) return;
    el.classList.remove('la-viz--menu', 'la-viz--game', 'la-viz--muffled');
    el.classList.add('la-viz--' + state);
    el.classList.toggle('la-viz--stopped', stopped);
    el.setAttribute('aria-label', label());
    // Resolve + cache the sphere colour, and mirror it onto the artist label.
    computeColor();
    el.style.setProperty('--la-viz-color', 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')');
    applyFilter();
  }

  // Wipe the analysis state so playback is judged fresh — used on open and when
  // un-pausing, so the silence before isn't taken into account (no jump to max).
  function resetAGC() { sBass = 0; bassPeak = 0; bassFloor = 0; sDrive = 0; settle = 20; }

  function setStopped(v) {
    var was = stopped;
    stopped = !!v;
    if (stopped) { pauseMusic(); }
    else { if (was) resetAGC(); playMusic(); }   // un-pause → recompute from scratch
    apply();
  }

  /* ---------- public API (kept call-compatible with the shell wiring) ---------- */
  window.LAViz = {
    mount: function (modalEl) {
      if (el || !modalEl) return;
      el = build();
      modalEl.appendChild(el);
      state = 'menu';
      stopped = false;
      resetAGC();   // fresh analysis per open
      apply();
      startLoop();
      playMusic();           // mount runs inside the open-click gesture
    },

    unmount: function () {
      if (!el) return;
      stopLoop();
      pauseMusic();
      try { if (srcNode) srcNode.disconnect(); } catch (e) {}
      try { if (analyser) analyser.disconnect(); } catch (e) {}
      try { if (lowpass) lowpass.disconnect(); } catch (e) {}
      try { if (audioCtx) audioCtx.close(); } catch (e) {}
      audioCtx = srcNode = lowpass = analyser = freqData = audioEl = null;
      if (el.parentNode) el.parentNode.removeChild(el);
      el = canvas = ctx = null;
    },

    // A menu screen. opts.muffled = paused over a live run (lowpass on, calmer).
    toMenu: function (opts) {
      opts = opts || {};
      state = opts.muffled ? 'muffled' : 'menu';
      apply();
    },

    // Active gameplay — artist hidden, full bright, un-muffled.
    toGame: function () {
      state = 'game';
      apply();
    },

    toggle: function () { setStopped(!stopped); },
    setStopped: setStopped,
    isStopped: function () { return stopped; },

    // Smoothed analysis snapshot — handy for tuning / verifying reactivity.
    _debug: function () {
      return { bass: sBass, mid: sMid, treble: sTreble, level: sLevel, drive: sDrive,
               playing: !!(audioEl && !audioEl.paused) };
    }
  };
})();

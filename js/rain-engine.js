/* ==========================================================================
   Rain Engine — Shared physics + rendering for rain effect.
   Used by both the Web Worker (rain-worker.js) and the
   main-thread fallback (rain.js).

   Usage:
     var engine = createRainEngine();
     engine.init(canvas, width, height, dropCount);
     engine.start(scrollY);
     // in a rAF loop:
     var result = engine.draw();  // 'ok' | 'drained' | 'stopped'
   ========================================================================== */
(function (root) {
  'use strict';

  root.createRainEngine = function () {

    /* ── Configuration ──────────────────────────────────── */
    var MAX_SPLASHES = 350;
    var MAX_RIPPLES  = 60;
    var MAX_RUNOFFS  = 80;
    var DROP_MIN_SPD = 7;
    var DROP_MAX_SPD = 14;
    var DROP_W_MIN   = 1.2;
    var DROP_W_MAX   = 2.4;
    var SPLASH_PER   = 5;
    var SPLASH_G     = 0.22;
    var RES          = 0.65;
    var CURSOR_R     = 22;
    var CORNER_R     = 12;

    /* ── State ──────────────────────────────────────────── */
    var canvas   = null;
    var ctx      = null;
    var W = 0, H = 0;
    var scrollY  = 0;
    var running  = false;
    var draining = false;
    var dropCount = 160;

    var drops    = [];
    var splashes = [];
    var splashN  = 0;
    var ripples  = [];
    var rippleN  = 0;
    var runoffs  = [];
    var runoffN  = 0;

    var surfAbs  = [];
    var curX = -999, curY = -999;
    var rainRGB  = '220,220,240';

    /* ── Drop pool ──────────────────────────────────────── */
    function resetDrop(d) {
      if (draining) { d.lif = 0; d._ca = 0; return; }
      d.x   = Math.random() * W;
      d.y   = -(Math.random() * 100 + 10);
      d.vy  = DROP_MIN_SPD + Math.random() * (DROP_MAX_SPD - DROP_MIN_SPD);
      d.vx  = -0.7 + Math.random() * 1.4;
      d.len = d.vy * 1.2 + Math.random() * 5;
      d.w   = DROP_W_MIN + Math.random() * (DROP_W_MAX - DROP_W_MIN);
      d.a   = 0.35 + Math.random() * 0.4;
      d.bou = false;
      d.lif = 1;
      d._ca = 0;
    }

    function _buildDrops(n) {
      drops.length = n;
      for (var i = 0; i < n; i++) {
        var d = drops[i] || {};
        resetDrop(d);
        d.y = -(Math.random() * H + 10);
        drops[i] = d;
      }
    }

    /* ── Splash pool ────────────────────────────────────── */
    function _buildSplashes() {
      splashes.length = MAX_SPLASHES;
      for (var i = 0; i < MAX_SPLASHES; i++)
        splashes[i] = splashes[i] || { x:0, y:0, vx:0, vy:0, lif:0, dec:0, r:0 };
      splashN = 0;
    }

    function spawnSplash(x, y) {
      for (var i = 0; i < SPLASH_PER; i++) {
        if (splashN >= MAX_SPLASHES) return;
        var s = splashes[splashN++];
        s.x = x + (-3 + Math.random() * 6);
        s.y = y;
        s.vx = -2.5 + Math.random() * 5;
        s.vy = -1.5 - Math.random() * 2.8;
        s.lif = 1;
        s.dec = 1 / (14 + Math.random() * 10);
        s.r = 0.8 + Math.random() * 1.4;
      }
    }

    /* ── Ripple ring pool ───────────────────────────────── */
    function _buildRipples() {
      ripples.length = MAX_RIPPLES;
      for (var i = 0; i < MAX_RIPPLES; i++)
        ripples[i] = ripples[i] || { x:0, y:0, r:0, maxR:0, lif:0, dec:0 };
      rippleN = 0;
    }

    function spawnRipple(x, y) {
      if (rippleN >= MAX_RIPPLES) return;
      var rp = ripples[rippleN++];
      rp.x = x; rp.y = y; rp.r = 0;
      rp.maxR = 6 + Math.random() * 10;
      rp.lif = 1;
      rp.dec = 1 / (18 + Math.random() * 12);
    }

    /* ── Runoff stream pool ─────────────────────────────── */
    function _buildRunoffs() {
      runoffs.length = MAX_RUNOFFS;
      for (var i = 0; i < MAX_RUNOFFS; i++)
        runoffs[i] = runoffs[i] || { x:0, y:0, len:0, vy:0, lif:0, dec:0, w:0, edge:0 };
      runoffN = 0;
    }

    function spawnRunoff(hitX, surfTop, surfLeft, surfRight, surfBot) {
      if (runoffN >= MAX_RUNOFFS || draining) return;
      if (Math.random() > 0.55) return;
      var distL = hitX - surfLeft;
      var distR = surfRight - hitX;
      var edge, ex;
      if (distL < distR) { edge = -1; ex = surfLeft - 1; }
      else               { edge =  1; ex = surfRight + 1; }
      var absTop = surfTop + scrollY;
      var absBot = surfBot + scrollY;
      var startAbsY = absTop + CORNER_R + Math.random() * 4;
      if (startAbsY >= absBot) return;
      var ro = runoffs[runoffN++];
      ro.x    = ex;
      ro.absY = startAbsY;
      ro.len  = 0;
      ro.maxL = 25 + Math.random() * 35;
      ro.vy   = 0.8 + Math.random() * 1.0;
      ro.lif  = 1;
      ro.dec  = 1 / (80 + Math.random() * 60);
      ro.w    = 1.0 + Math.random() * 0.8;
      ro.edge = edge;
      ro.absBot = absBot - CORNER_R;
      ro.age  = 0;
    }

    /* ── Cursor hit test ────────────────────────────────── */
    function hitCursor(x, tipY) {
      var dx = x - curX;
      var dy = tipY - curY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CURSOR_R) return dist;
      return -1;
    }

    /* ── Surface hit test (swept — never misses fast drops) */
    function hitSurface(x, tipY, vy) {
      var prevTip = tipY - vy;
      for (var i = 0, n = surfAbs.length; i < n; i++) {
        var s = surfAbs[i];
        var vTop = s.absTop - scrollY;
        var vBot = s.absBottom - scrollY;
        if (vBot < 0 || vTop > H) continue;
        if (x >= s.left && x <= s.right && tipY >= vTop && prevTip < vTop)
          return { vTop: vTop, idx: i };
      }
      return null;
    }

    /* ── Draw (physics + render) ─────────────────────────
       Returns: 'ok' | 'drained' | 'stopped'              */
    function draw() {
      if (!running) return 'stopped';

      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      ctx.clearRect(0, 0, W, H);

      var i, d, a, vTop, count = drops.length;

      /* ── Drain completion check ── */
      if (draining) {
        var alive = 0;
        for (i = 0; i < count; i++) if (drops[i].lif > 0) alive++;
        if (alive === 0 && splashN === 0 && rippleN === 0 && runoffN === 0) {
          running  = false;
          draining = false;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          return 'drained';
        }
      }

      /* ── Physics ── */
      for (i = 0; i < count; i++) {
        d = drops[i];
        if (d.lif <= 0) { d._ca = 0; continue; }

        if (d.bou) {
          d.x += d.vx; d.y += d.vy;
          d.vy += SPLASH_G; d.lif -= 0.06;
          if (d.lif <= 0 || d.y > H + 10) resetDrop(d);
        } else {
          d.x += d.vx; d.y += d.vy;

          // Cursor bounce
          var cDist = hitCursor(d.x, d.y + d.len);
          if (cDist >= 0 && cDist > 1) {
            var cdx = d.x - curX;
            var cdy = (d.y + d.len) - curY;
            var cn  = Math.sqrt(cdx * cdx + cdy * cdy);
            d.vx = (cdx / cn) * 3.5 + (Math.random() - 0.5);
            d.vy = (cdy / cn) * 2.5;
            d.bou = true;
            d.len *= 0.4;
            d.lif = 0.8 + Math.random() * 0.2;
            spawnSplash(d.x, d.y + d.len);
            spawnRipple(d.x, d.y + d.len);
          } else {
            var hit = hitSurface(d.x, d.y + d.len, d.vy);
            if (hit) {
              vTop = hit.vTop;
              d.y = vTop - d.len;
              spawnSplash(d.x, vTop);
              spawnRipple(d.x, vTop);
              var hs = surfAbs[hit.idx];
              spawnRunoff(d.x, vTop, hs.left, hs.right, hs.absBottom - scrollY);
              d.bou = true;
              d.vy = -(Math.abs(d.vy) * (0.15 + Math.random() * 0.15));
              d.vx = -2 + Math.random() * 4;
              d.len *= 0.35; d.lif = 1;
            } else if (d.y > H + 10 || d.x < -10 || d.x > W + 10) {
              resetDrop(d);
            }
          }
        }
        a = d.a * d.lif;
        d._ca = a >= 0.02 ? a : 0;
      }

      /* ── Drop drawing — 2 width groups × 3 alpha buckets ── */
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgb(' + rainRGB + ')';

      var bLo  = [0.02, 0.25, 0.48];
      var bHi  = [0.25, 0.48, 1.01];
      var bAlp = [0.18, 0.38, 0.58];

      var wThresh = (DROP_W_MIN + DROP_W_MAX) * 0.5;
      var wVals   = [DROP_W_MIN + 0.15, DROP_W_MAX - 0.15];

      for (var wg = 0; wg < 2; wg++) {
        ctx.lineWidth = wVals[wg];
        for (var b = 0; b < 3; b++) {
          var lo = bLo[b], hi = bHi[b], has = false;
          ctx.globalAlpha = bAlp[b];
          ctx.beginPath();
          for (i = 0; i < count; i++) {
            d = drops[i]; a = d._ca;
            if (a < lo || a >= hi) continue;
            if (wg === 0 && d.w >= wThresh) continue;
            if (wg === 1 && d.w < wThresh) continue;
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x + d.vx * 0.35, d.y + d.len);
            has = true;
          }
          if (has) ctx.stroke();
        }
      }

      /* ── Ripple rings ── */
      if (rippleN > 0) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgb(' + rainRGB + ')';
        for (var k = rippleN - 1; k >= 0; k--) {
          var rp = ripples[k];
          rp.r += (rp.maxR - rp.r) * 0.12;
          rp.lif -= rp.dec;
          if (rp.lif <= 0) {
            rippleN--;
            if (k < rippleN) { var tmp = ripples[rippleN]; ripples[k] = tmp; ripples[rippleN] = rp; }
            continue;
          }
          ctx.globalAlpha = rp.lif * 0.35;
          ctx.beginPath();
          ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.35, 0, 0, 6.2832);
          ctx.stroke();
        }
      }

      /* ── Splash particles ── */
      if (splashN > 0) {
        // Physics pass
        for (var j = splashN - 1; j >= 0; j--) {
          var sp = splashes[j];
          sp.x += sp.vx; sp.y += sp.vy;
          sp.vy += SPLASH_G; sp.lif -= sp.dec;
          if (sp.lif <= 0) {
            splashN--;
            if (j < splashN) { var t2 = splashes[splashN]; splashes[j] = t2; splashes[splashN] = sp; }
          }
        }

        // Draw splashes — uniform rain color
        ctx.fillStyle = 'rgb(' + rainRGB + ')';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        var hc = false;
        for (j = 0; j < splashN; j++) {
          sp = splashes[j];
          if (sp.lif < 0.4) continue;
          var r = sp.r * sp.lif;
          ctx.moveTo(sp.x + r, sp.y); ctx.arc(sp.x, sp.y, r, 0, 6.2832);
          hc = true;
        }
        if (hc) ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.beginPath(); hc = false;
        for (j = 0; j < splashN; j++) {
          sp = splashes[j];
          if (sp.lif >= 0.4 || sp.lif <= 0) continue;
          var r3 = sp.r * sp.lif;
          ctx.moveTo(sp.x + r3, sp.y); ctx.arc(sp.x, sp.y, r3, 0, 6.2832);
          hc = true;
        }
        if (hc) ctx.fill();
      }

      /* ── Runoff streams ── */
      if (runoffN > 0) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgb(' + rainRGB + ')';
        for (var ri = runoffN - 1; ri >= 0; ri--) {
          var ro = runoffs[ri];
          ro.absY += ro.vy;
          ro.len += ro.vy * 0.6;
          if (ro.len > ro.maxL) ro.len = ro.maxL;
          ro.lif -= ro.dec;
          ro.age++;
          var viewY   = ro.absY - scrollY;
          var viewTop = viewY - ro.len;
          var viewBot = ro.absBot - scrollY;
          if (ro.lif <= 0 || ro.absY > ro.absBot + 5 || viewY < -ro.len || viewTop > H) {
            runoffN--;
            if (ri < runoffN) { var tmp3 = runoffs[runoffN]; runoffs[ri] = tmp3; runoffs[runoffN] = ro; }
            continue;
          }
          var fadeIn = ro.age < 10 ? ro.age / 10 : 1;
          ctx.globalAlpha = ro.lif * 0.55 * fadeIn;
          ctx.lineWidth = ro.w * (0.4 + ro.lif * 0.6);
          ctx.beginPath();
          ctx.moveTo(ro.x, viewTop);
          ctx.lineTo(ro.x, viewY);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      return 'ok';
    }

    /* ── Public API ─────────────────────────────────────── */
    return {
      /** Bind a canvas (regular or OffscreenCanvas) and set dimensions. */
      init: function (c, w, h, dc) {
        canvas    = c;
        ctx       = c.getContext('2d');
        W         = w;
        H         = h;
        dropCount = dc || 160;
        canvas.width  = Math.ceil(W * RES);
        canvas.height = Math.ceil(H * RES);
      },

      /** Reset pools and begin running. */
      start: function (sy) {
        running  = true;
        draining = false;
        scrollY  = sy || 0;
        _buildDrops(dropCount);
        _buildSplashes();
        _buildRipples();
        _buildRunoffs();
      },

      /** Instant stop — clear everything. */
      stop: function () {
        running  = false;
        draining = false;
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        splashN = 0;
        rippleN = 0;
        runoffN = 0;
      },

      /** Graceful stop — no new drops, let existing ones finish. */
      drain: function () {
        draining = true;
      },

      /** Update viewport dimensions; rebuilds drops if running. */
      resize: function (w, h, dc) {
        W = w; H = h;
        dropCount = dc;
        if (canvas) {
          canvas.width  = Math.ceil(W * RES);
          canvas.height = Math.ceil(H * RES);
        }
        if (running && !draining) _buildDrops(dropCount);
      },

      setScroll:   function (sy)   { scrollY = sy; },
      setCursor:   function (x, y) { curX = x; curY = y; },
      setSurfaces: function (s)    { surfAbs = s; },

      setTheme: function (theme) {
        if (theme === 'dark')        rainRGB = '200,140,255';
        else if (theme === 'nature') rainRGB = '120,210,240';
        else                         rainRGB = '220,220,240';
      },

      isRunning: function () { return running; },

      /** Run one frame of physics + rendering.
       *  @returns {'ok'|'drained'|'stopped'} */
      draw: draw
    };
  };

})(typeof self !== 'undefined' ? self : this);

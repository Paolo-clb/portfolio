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
    var MAX_DRIPS    = 150;
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
    var speedFactor = 1;
    var lastDrawTime = 0;
    var prevDt = 0;
    var REF_DT = 1000 / 60; // 16.667ms — reference frame duration (60 FPS)
    var canvas   = null;
    var ctx      = null;
    var W = 0, H = 0;
    var running  = false;
    var draining = false;
    var dropCount = 160;

    var drops    = [];
    var splashes = [];
    var splashN  = 0;
    var ripples  = [];
    var rippleN  = 0;
    var drips    = [];
    var dripN    = 0;

    var surfs    = [];
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

    /* ── Driplet pool — organic water beads on element edges ── */
    function _buildDrips() {
      drips.length = MAX_DRIPS;
      for (var i = 0; i < MAX_DRIPS; i++)
        drips[i] = drips[i] || { x:0, y:0, vy:0, vx:0, r:0, lif:0, dec:0, edge:0,
                                  sidx:0, sL:0, sR:0, sT:0, sB:0, free:false, wobT:0, wobA:0,
                                  tail:0, maxTail:0, ang:0, phase:0 };
      dripN = 0;
    }

    function spawnDrip(hitX, surfIdx) {
      if (dripN >= MAX_DRIPS || draining) return;
      if (Math.random() > 0.55) return;
      var s = surfs[surfIdx];
      if (!s) return;
      var surfH = s.bottom - s.top;
      if (surfH < 20) return;
      var distL = hitX - s.left;
      var distR = s.right - hitX;
      var edge;
      if (distL < distR) { edge = -1; }
      else               { edge =  1; }
      /* Start on top surface, near the corner */
      var dp = drips[dripN++];
      dp.phase = 0; /* 0 = top-corner arc, 1 = straight edge, 2 = bottom-corner arc */
      dp.ang  = -1.5708 + (Math.random() * 0.3); /* start near top of arc (-PI/2) */
      dp.edge = edge;
      dp.sidx = surfIdx;
      dp.sL   = s.left;
      dp.sR   = s.right;
      dp.sT   = s.top;
      dp.sB   = s.bottom;
      /* Position on the arc */
      var cx = edge === -1 ? s.left + CORNER_R : s.right - CORNER_R;
      var cy = s.top + CORNER_R;
      dp.x    = cx + Math.cos(dp.ang) * CORNER_R * (edge === -1 ? -1 : 1);
      dp.y    = cy + Math.sin(dp.ang) * CORNER_R;
      dp.vy   = 0.014 + Math.random() * 0.02; /* angular speed for arc phase */
      dp.vx   = 0;
      dp.r    = 1.2 + Math.random() * 1.5;
      dp.lif  = 1;
      dp.dec  = 1 / (220 + Math.random() * 160);
      dp.free = false;
      dp.wobT = Math.random() * 6.28;
      dp.wobA = 0.15 + Math.random() * 0.25;
      dp.tail = 0;
      dp.maxTail = 18 + Math.random() * 26;
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
      for (var i = 0, n = surfs.length; i < n; i++) {
        var s = surfs[i];
        if (s.bottom < 0 || s.top > H) continue;
        if (x >= s.left && x <= s.right && tipY >= s.top && prevTip < s.top)
          return { vTop: s.top, idx: i };
      }
      return null;
    }

    /* ── Draw (physics + render) ─────────────────────────
       Returns: 'ok' | 'drained' | 'stopped'              */
    function draw() {
      if (!running) return 'stopped';

      /* ── Delta-time normalization (frame-rate independent physics) ── */
      var now = (typeof performance !== 'undefined' && performance.now)
                ? performance.now() : Date.now();
      var rawDt = lastDrawTime ? Math.min(now - lastDrawTime, 50) : REF_DT;
      lastDrawTime = now;
      var dt = prevDt > 0 ? (prevDt + rawDt) * 0.5 : rawDt;
      prevDt = rawDt;
      var sf = speedFactor * (dt / REF_DT);

      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      ctx.clearRect(0, 0, W, H);

      var i, d, a, vTop, count = drops.length;

      /* ── Drain completion check ── */
      if (draining) {
        var alive = 0;
        for (i = 0; i < count; i++) if (drops[i].lif > 0) alive++;
        if (alive === 0 && splashN === 0 && rippleN === 0 && dripN === 0) {
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
          d.x += d.vx * sf; d.y += d.vy * sf;
          d.vy += SPLASH_G * sf; d.lif -= 0.06 * sf;
          if (d.lif <= 0 || d.y > H + 10) resetDrop(d);
        } else {
          d.x += d.vx * sf; d.y += d.vy * sf;

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
            var hit = hitSurface(d.x, d.y + d.len, d.vy * sf);
            if (hit) {
              vTop = hit.vTop;
              d.y = vTop - d.len;
              spawnSplash(d.x, vTop);
              spawnRipple(d.x, vTop);
              spawnDrip(d.x, hit.idx);
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
          rp.r += (rp.maxR - rp.r) * 0.12 * sf;
          rp.lif -= rp.dec * sf;
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
          sp.x += sp.vx * sf; sp.y += sp.vy * sf;
          sp.vy += SPLASH_G * sf; sp.lif -= sp.dec * sf;
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

      /* ── Driplets on element edges ── */
      if (dripN > 0) {
        ctx.fillStyle = 'rgb(' + rainRGB + ')';
        ctx.strokeStyle = 'rgb(' + rainRGB + ')';
        ctx.lineCap = 'round';
        for (var di = dripN - 1; di >= 0; di--) {
          var dp = drips[di];
          dp.lif -= dp.dec * sf;
          dp.wobT += 0.18 * sf;

          var kill = false;
          var rs = (dp.sidx < surfs.length) ? surfs[dp.sidx] : null;
          if (dp.free) {
            /* Detached — falls freely with gravity */
            dp.vy += 0.35 * sf;
            dp.y += dp.vy * sf;
            dp.x += dp.vx * sf;
            dp.r *= Math.pow(0.988, sf);
            dp.tail += dp.vy * 0.5;
            if (dp.tail > dp.maxTail) dp.tail = dp.maxTail;
            if (dp.lif <= 0 || dp.y > H + 10) kill = true;
          } else {
            /* Clinging to surface */
            if (!rs || Math.abs(rs.left - dp.sL) > 60) {
              kill = true;
            } else if (dp.phase === 0) {
              /* Phase 0: sliding along top corner arc */
              dp.ang += dp.vy * sf;
              dp.vy += 0.0015 * sf; /* slight angular acceleration */
              if (dp.vy > 0.065) dp.vy = 0.065;
              var cx0 = dp.edge === -1 ? rs.left + CORNER_R : rs.right - CORNER_R;
              var cy0 = rs.top + CORNER_R;
              var cosA = Math.cos(dp.ang);
              var sinA = Math.sin(dp.ang);
              dp.x = cx0 + cosA * CORNER_R * (dp.edge === -1 ? -1 : 1);
              dp.y = cy0 + sinA * CORNER_R;
              dp.tail = Math.abs(dp.vy) * CORNER_R * 3;
              if (dp.tail > dp.maxTail) dp.tail = dp.maxTail;
              /* Transition to straight edge when arc reaches ~0 (side) */
              if (dp.ang >= 0) {
                dp.phase = 1;
                dp.y = rs.top + CORNER_R;
                dp.x = (dp.edge === -1 ? rs.left : rs.right) + (dp.edge === -1 ? -0.5 : 0.5);
                dp.vy = 0.35 + Math.random() * 0.5;
              }
            } else if (dp.phase === 1) {
              /* Phase 1: straight edge crawl */
              var edgeX = dp.edge === -1 ? rs.left : rs.right;
              dp.x = edgeX + (dp.edge === -1 ? -0.5 : 0.5);
              dp.vy += 0.025 * sf;
              if (dp.vy > 2.8) dp.vy = 2.8;
              if (Math.random() < 1 - Math.pow(0.98, sf)) dp.vy *= 0.2;
              dp.y += dp.vy * sf;
              dp.vx = Math.sin(dp.wobT) * dp.wobA;
              dp.tail = dp.vy * 5;
              if (dp.tail > dp.maxTail) dp.tail = dp.maxTail;
              /* Transition to bottom corner arc */
              if (dp.y >= rs.bottom - CORNER_R) {
                dp.phase = 2;
                dp.ang = 0;
                dp.vy = 0.02 + dp.vy * 0.01;
              }
            } else {
              /* Phase 2: bottom corner arc — curves under the element */
              dp.ang += dp.vy * sf;
              dp.vy += 0.0018 * sf;
              if (dp.vy > 0.08) dp.vy = 0.08;
              var cx2 = dp.edge === -1 ? rs.left + CORNER_R : rs.right - CORNER_R;
              var cy2 = rs.bottom - CORNER_R;
              dp.x = cx2 + Math.cos(dp.ang) * CORNER_R * (dp.edge === -1 ? -1 : 1);
              dp.y = cy2 + Math.sin(dp.ang) * CORNER_R;
              dp.tail = Math.abs(dp.vy) * CORNER_R * 2;
              if (dp.tail > dp.maxTail) dp.tail = dp.maxTail;
              /* Detach at ~PI/2 (bottom) — splash! */
              if (dp.ang >= 1.5708) {
                dp.free = true;
                dp.y = rs.bottom + 1;
                dp.vy = 1.0 + Math.random() * 1.5;
                dp.vx = dp.edge * (0.05 + Math.random() * 0.15);
                /* Splash on detach */
                spawnSplash(dp.x, dp.y);
                spawnRipple(dp.x, dp.y);
              }
            }
            if (dp.lif <= 0) kill = true;
          }

          if (kill || dp.r < 0.3) {
            /* Splash on death too if still visible */
            if (dp.r >= 0.6 && dp.lif > 0.15) {
              spawnSplash(dp.x, dp.y);
            }
            dripN--;
            if (di < dripN) { var tmp3 = drips[dripN]; drips[di] = tmp3; drips[dripN] = dp; }
            continue;
          }

          /* Draw bead + tail streak */
          var da = dp.lif * 0.75;
          var drawX = dp.x + (!dp.free && dp.phase === 1 ? dp.vx : 0);
          /* Tail — thin streak trailing behind the bead */
          if (dp.tail > 1.5) {
            ctx.globalAlpha = da * 0.4;
            ctx.lineWidth = dp.r * 0.6;
            ctx.beginPath();
            ctx.moveTo(drawX, dp.y);
            if (!dp.free && rs && dp.phase === 0) {
              /* Tail follows the top arc */
              var tAng = dp.ang - dp.tail / CORNER_R;
              var tcx = dp.edge === -1 ? rs.left + CORNER_R : rs.right - CORNER_R;
              var tcy = rs.top + CORNER_R;
              var tx = tcx + Math.cos(tAng) * CORNER_R * (dp.edge === -1 ? -1 : 1);
              var ty = tcy + Math.sin(tAng) * CORNER_R;
              ctx.lineTo(tx, ty);
            } else if (!dp.free && rs && dp.phase === 2) {
              /* Tail follows the bottom arc */
              var tAng2 = dp.ang - dp.tail / CORNER_R;
              if (tAng2 < 0) tAng2 = 0;
              var tcx2 = dp.edge === -1 ? rs.left + CORNER_R : rs.right - CORNER_R;
              var tcy2 = rs.bottom - CORNER_R;
              var tx2 = tcx2 + Math.cos(tAng2) * CORNER_R * (dp.edge === -1 ? -1 : 1);
              var ty2 = tcy2 + Math.sin(tAng2) * CORNER_R;
              ctx.lineTo(tx2, ty2);
            } else {
              /* Straight up */
              ctx.lineTo(drawX, dp.y - dp.tail);
            }
            ctx.stroke();
          }
          /* Bead — small filled circle */
          ctx.globalAlpha = da;
          ctx.beginPath();
          ctx.arc(drawX, dp.y, dp.r * (0.6 + dp.lif * 0.4), 0, 6.2832);
          ctx.fill();
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
      start: function () {
        running  = true;
        draining = false;
        lastDrawTime = 0;
        prevDt = 0;
        _buildDrops(dropCount);
        _buildSplashes();
        _buildRipples();
        _buildDrips();
      },

      /** Instant stop — clear everything. */
      stop: function () {
        running  = false;
        draining = false;
        lastDrawTime = 0;
        prevDt = 0;
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        splashN = 0;
        rippleN = 0;
        dripN = 0;
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

      setCursor:   function (x, y) { curX = x; curY = y; },
      setSurfaces: function (s)    { surfs = s; },

      setTheme: function (theme) {
        if (theme === 'dark')        rainRGB = '200,140,255';
        else if (theme === 'nature') rainRGB = '120,210,240';
        else                         rainRGB = '220,220,240';
      },

      isRunning: function () { return running; },

      /** Adjust physics speed (0.25 – 1.0). Does NOT affect cursor bounce. */
      setSpeed: function (f) { speedFactor = f; },

      /** Run one frame of physics + rendering.
       *  @returns {'ok'|'drained'|'stopped'} */
      draw: draw
    };
  };

})(typeof self !== 'undefined' ? self : this);

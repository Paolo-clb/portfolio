/* ==========================================================================
   Light Again — Game Engine
   Factory: window.createLightGame(canvas) → { start, stop }
   ========================================================================== */

(function () {
  'use strict';

  window.createLightGame = function (canvas) {
    if (!canvas) return null;

    var ctx     = canvas.getContext('2d');
    var rafId   = null;
    var running = false;

    /* ================================================================
       PALETTE — theme-aware, simplified
       ================================================================ */

    function getColors() {
      var theme = document.documentElement.getAttribute('data-theme') || 'light';
      if (theme === 'dark') return {
        trailAlpha:  0.16,
        cyan:        [0, 255, 255],
        yellow:      [255, 220, 60],
        ghostCyan:   [0, 255, 255],
        ghostViolet: [160, 0, 255],
        gridV:       'rgba(120,40,200,0.18)',
        gridH:       'rgba(0,180,220,0.12)',
        sunTop:      [200, 0, 255],
        sunBot:      [255, 60, 120],
      };
      if (theme === 'nature') return {
        trailAlpha:  0.15,
        cyan:        [80, 255, 200],
        yellow:      [220, 240, 80],
        ghostCyan:   [80, 255, 200],
        ghostViolet: [60, 120, 200],
        gridV:       'rgba(30,100,60,0.18)',
        gridH:       'rgba(40,180,120,0.12)',
        sunTop:      [60, 200, 120],
        sunBot:      [200, 255, 80],
      };
      return {
        trailAlpha:  0.14,
        cyan:        [0, 255, 255],
        yellow:      [255, 220, 60],
        ghostCyan:   [0, 255, 255],
        ghostViolet: [160, 0, 255],
        gridV:       'rgba(100,40,180,0.18)',
        gridH:       'rgba(0,180,220,0.12)',
        sunTop:      [180, 0, 255],
        sunBot:      [255, 80, 140],
      };
    }

    /* ================================================================
       CONSTANTS
       ================================================================ */

    var ACCEL       = 0.7;
    var FRICTION    = 0.92;
    var SIZE        = 20;       // arrow half-length (tip to center)
    var DASH_IMP    = 16;
    var DASH_DUR    = 200;      // ms
    var DASH_CD     = 1200;     // ms
    var ATK_IMP     = 22;       // torpedo impulse
    var ATK_DUR     = 400;      // ms
    var ATK_CD      = 600;      // ms
    var ATK_SPIN    = 28;       // radians per second (torpedo spin)
    var CAM_SMOOTH  = 0.10;
    var WORLD_HALF  = 4000;
    var SYNTH_VP    = 0.40;     // vanishing point Y ratio

    /* ================================================================
       STATE
       ================================================================ */

    var player = {
      x: 0, y: 0,
      vx: 0, vy: 0,
      angle: 0,               // facing direction (toward mouse)
      spinAngle: 0,           // torpedo spin accumulator
      state: 'MOVING',        // 'MOVING' | 'ATTACKING' | 'DASHING'
      dashAvailable: true,
      dashCooldown:  0,
      dashTimer:     0,
      dashDx: 0, dashDy: 0,
      atkAvailable: true,
      atkCooldown:  0,
      atkTimer:     0,
      atkDx: 0, atkDy: 0,
    };

    var camera  = { x: 0, y: 0 };
    var ghosts  = [];
    var mouseX  = 0, mouseY = 0;  // canvas-relative mouse position

    var gameTime = 0;
    var prevTs   = null;
    var lastW    = 0;
    var lastH    = 0;

    /* ================================================================
       INPUT
       ================================================================ */

    var keys = {};

    function onKeyDown(e) {
      keys[e.code] = true;
      if ((e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
        e.preventDefault();
        tryDash();
      }
    }
    function onKeyUp(e)   { keys[e.code] = false; }

    function onMouseMove(e) {
      var rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    }

    function onMouseDown(e) {
      if (e.button === 0) { e.preventDefault(); tryAttack(); }       // left click = torpedo
      if (e.button === 2) { e.preventDefault(); tryDash(); }         // right click = dash
    }
    function onCtxMenu(e) { e.preventDefault(); }

    function getInputVector() {
      var dx = 0, dy = 0;
      if (keys['ArrowUp']    || keys['KeyW'] || keys['KeyZ']) dy -= 1;
      if (keys['ArrowDown']  || keys['KeyS'])                 dy += 1;
      if (keys['ArrowLeft']  || keys['KeyA'] || keys['KeyQ']) dx -= 1;
      if (keys['ArrowRight'] || keys['KeyD'])                 dx += 1;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) { dx /= len; dy /= len; }
      return { dx: dx, dy: dy };
    }

    /* ── Dash ── */
    function tryDash() {
      if (!player.dashAvailable || player.state === 'DASHING') return;
      var inp = getInputVector();
      var dx = inp.dx, dy = inp.dy;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        // Default: dash toward mouse
        dx = Math.cos(player.angle);
        dy = Math.sin(player.angle);
      }
      player.vx += dx * DASH_IMP;
      player.vy += dy * DASH_IMP;
      player.state         = 'DASHING';
      player.dashAvailable = false;
      player.dashTimer     = DASH_DUR;
      player.dashCooldown  = 0;
      player.dashDx        = dx;
      player.dashDy        = dy;
    }

    /* ── Torpedo attack ── */
    function tryAttack() {
      if (!player.atkAvailable || player.state === 'ATTACKING') return;
      // Direction toward mouse click (world space)
      var cx = canvas.width / 2, cy = canvas.height / 2;
      var worldMx = mouseX - cx + camera.x;
      var worldMy = mouseY - cy + camera.y;
      var adx = worldMx - player.x;
      var ady = worldMy - player.y;
      var alen = Math.sqrt(adx * adx + ady * ady);
      if (alen < 1) { adx = Math.cos(player.angle); ady = Math.sin(player.angle); }
      else { adx /= alen; ady /= alen; }

      player.vx += adx * ATK_IMP;
      player.vy += ady * ATK_IMP;
      player.state        = 'ATTACKING';
      player.atkAvailable = false;
      player.atkTimer     = ATK_DUR;
      player.atkCooldown  = 0;
      player.atkDx        = adx;
      player.atkDy        = ady;
      player.spinAngle    = 0;
    }

    /* ================================================================
       PHYSICS
       ================================================================ */

    function update(dt) {
      var ms = dt * 1000;

      // --- Movement input (only in MOVING state) ---
      if (player.state === 'MOVING') {
        var inp = getInputVector();
        player.vx = (player.vx + inp.dx * ACCEL) * FRICTION;
        player.vy = (player.vy + inp.dy * ACCEL) * FRICTION;
      } else {
        // While attacking or dashing, apply friction but no player input
        player.vx *= FRICTION;
        player.vy *= FRICTION;
      }

      player.x += player.vx;
      player.y += player.vy;

      // World boundaries
      var margin = SIZE * 1.5;
      var wMax   = WORLD_HALF - margin;
      if (player.x < -wMax) { player.x = -wMax; player.vx *= -0.4; }
      if (player.x >  wMax) { player.x =  wMax; player.vx *= -0.4; }
      if (player.y < -wMax) { player.y = -wMax; player.vy *= -0.4; }
      if (player.y >  wMax) { player.y =  wMax; player.vy *= -0.4; }

      // --- Dash state ---
      if (player.state === 'DASHING') {
        player.dashTimer -= ms;
        // Spawn ghosts while dashing
        var sp = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
        if (sp > 2) {
          ghosts.push({ x: player.x, y: player.y, alpha: 0.55, angle: player.angle, size: SIZE });
        }
        if (player.dashTimer <= 0) {
          player.state        = 'MOVING';
          player.dashCooldown = DASH_CD;
        }
      }
      if (player.state !== 'DASHING' && player.dashCooldown > 0) {
        player.dashCooldown = Math.max(0, player.dashCooldown - ms);
        if (player.dashCooldown <= 0) player.dashAvailable = true;
      }

      // --- Attack state ---
      if (player.state === 'ATTACKING') {
        player.atkTimer -= ms;
        player.spinAngle += dt * ATK_SPIN;
        if (player.atkTimer <= 0) {
          player.state       = 'MOVING';
          player.atkCooldown = ATK_CD;
          player.spinAngle   = 0;
        }
      }
      if (player.state !== 'ATTACKING' && player.atkCooldown > 0) {
        player.atkCooldown = Math.max(0, player.atkCooldown - ms);
        if (player.atkCooldown <= 0) player.atkAvailable = true;
      }

      // --- Ghost decay ---
      for (var g = ghosts.length - 1; g >= 0; g--) {
        ghosts[g].alpha -= dt * 3.5;
        if (ghosts[g].alpha <= 0) ghosts.splice(g, 1);
      }

      // --- Arrow facing: toward mouse (screen→world) ---
      if (player.state === 'ATTACKING') {
        // Torpedo: spin continuously
        player.angle = Math.atan2(player.atkDy, player.atkDx) + player.spinAngle;
      } else {
        var halfW = canvas.width / 2, halfH = canvas.height / 2;
        var wmx = mouseX - halfW + camera.x;
        var wmy = mouseY - halfH + camera.y;
        player.angle = Math.atan2(wmy - player.y, wmx - player.x);
      }

      // Camera lerp
      camera.x += (player.x - camera.x) * CAM_SMOOTH;
      camera.y += (player.y - camera.y) * CAM_SMOOTH;

      gameTime += dt;
    }

    /* ================================================================
       RENDERING
       ================================================================ */

    /* ── Synthwave background (screen space) — optimized ── */
    function drawBackground(w, h, colors) {
      var vpX  = w * 0.5;
      var vpY  = h * SYNTH_VP;
      var grdH = h - vpY;

      // Sun — simple gradient semicircle at vanishing point
      var sunR = Math.min(w, h) * 0.12;
      var st = colors.sunTop, sb = colors.sunBot;
      var sunG = ctx.createLinearGradient(vpX, vpY - sunR, vpX, vpY + sunR * 0.3);
      sunG.addColorStop(0, 'rgba(' + st[0] + ',' + st[1] + ',' + st[2] + ',0.5)');
      sunG.addColorStop(1, 'rgba(' + sb[0] + ',' + sb[1] + ',' + sb[2] + ',0.25)');
      ctx.beginPath();
      ctx.arc(vpX, vpY, sunR, Math.PI, 0);
      ctx.fillStyle = sunG;
      ctx.fill();

      // Horizon glow — subtle gradient below sun
      var hgG = ctx.createLinearGradient(vpX, vpY, vpX, vpY + grdH * 0.25);
      hgG.addColorStop(0, 'rgba(' + sb[0] + ',' + sb[1] + ',' + sb[2] + ',0.08)');
      hgG.addColorStop(1, 'rgba(' + sb[0] + ',' + sb[1] + ',' + sb[2] + ',0.0)');
      ctx.fillStyle = hgG;
      ctx.fillRect(0, vpY, w, grdH * 0.25);

      // Perspective grid — vertical fan lines (single batched path)
      var vCount = 14;
      var vStep  = 1.0 / vCount;
      var vOff   = ((camera.x * 0.0005) % vStep + vStep) % vStep;
      ctx.strokeStyle = colors.gridV;
      ctx.lineWidth   = 0.7;
      ctx.beginPath();
      for (var vi = -1; vi <= vCount + 1; vi++) {
        var vt = (vi * vStep + vOff) - 0.5;
        var bx = vpX + vt * w * 1.5;
        ctx.moveTo(vpX, vpY);
        ctx.lineTo(bx, h + 1);
      }
      ctx.stroke();

      // Perspective grid — horizontal lines (quadratic spacing, single path)
      var hCount = 10;
      var hStep  = 1.0 / hCount;
      var hOff   = ((camera.y * 0.004) % hStep + hStep) % hStep;
      ctx.strokeStyle = colors.gridH;
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      for (var hi = 0; hi <= hCount + 2; hi++) {
        var ht = hi * hStep + hOff;
        if (ht < 0.06) continue;
        var hy = vpY + grdH * ht * ht;
        if (hy < vpY || hy > h + 5) continue;
        ctx.moveTo(0, hy);
        ctx.lineTo(w, hy);
      }
      ctx.stroke();
    }

    /* ── Ghost trail (arrow silhouettes, cyan → violet) ── */
    function drawGhosts(colors) {
      var cc = colors.ghostCyan;
      var cv = colors.ghostViolet;
      for (var gi = 0; gi < ghosts.length; gi++) {
        var gh = ghosts[gi];
        var t  = Math.max(0, Math.min(1, 1 - gh.alpha / 0.55));
        var cr = Math.round(cc[0] + (cv[0] - cc[0]) * t);
        var cg = Math.round(cc[1] + (cv[1] - cc[1]) * t);
        var cb = Math.round(cc[2] + (cv[2] - cc[2]) * t);
        ctx.save();
        ctx.globalAlpha = gh.alpha * 0.6;
        ctx.translate(gh.x, gh.y);
        ctx.rotate(gh.angle);
        var s = gh.size;
        ctx.beginPath();
        ctx.moveTo(s, 0);                        // tip
        ctx.lineTo(-s * 0.6, -s * 0.55);         // top wing
        ctx.lineTo(-s * 0.25, 0);                 // notch
        ctx.lineTo(-s * 0.6,  s * 0.55);          // bottom wing
        ctx.closePath();
        ctx.fillStyle = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
        ctx.fill();
        ctx.restore();
      }
    }

    /* ── Arrow (the player) — neon glow via shadowBlur + lighter ── */
    function drawArrow(colors) {
      var avail = player.dashAvailable && player.atkAvailable;
      var clr   = avail ? colors.cyan : colors.yellow;
      var r = clr[0], g = clr[1], b = clr[2];

      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);

      // Arrow shape path (reused for fill and glow)
      var s = SIZE;
      function arrowPath() {
        ctx.beginPath();
        ctx.moveTo(s, 0);                          // tip
        ctx.lineTo(-s * 0.6, -s * 0.55);           // top wing
        ctx.lineTo(-s * 0.25, 0);                   // notch
        ctx.lineTo(-s * 0.6,  s * 0.55);            // bottom wing
        ctx.closePath();
      }

      // Neon glow layer (additive blend + shadowBlur)
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.9)';
      ctx.shadowBlur  = 18;
      arrowPath();
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.35)';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';

      // Solid arrow body
      arrowPath();
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fill();

      // Inner highlight (lighter center line)
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth   = 1.2;
      ctx.beginPath();
      ctx.moveTo(s * 0.7, 0);
      ctx.lineTo(-s * 0.15, 0);
      ctx.stroke();

      ctx.restore();
    }

    /* ================================================================
       MASTER DRAW
       ================================================================ */

    function draw() {
      var w = canvas.width, h = canvas.height;
      var colors = getColors();
      var cx = w / 2, cy = h / 2;

      // Full clear on resize
      if (w !== lastW || h !== lastH) {
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, w, h);
        lastW = w; lastH = h;
      }

      // Trail — semi-transparent fill → natural motion blur
      ctx.fillStyle = 'rgba(5,5,16,' + colors.trailAlpha + ')';
      ctx.fillRect(0, 0, w, h);

      // Background (screen space)
      drawBackground(w, h, colors);

      // Camera transform (world space)
      ctx.save();
      ctx.translate(cx - camera.x, cy - camera.y);

      drawGhosts(colors);
      drawArrow(colors);

      ctx.restore();

      // HUD: dash cooldown bar (screen space, bottom-center)
      if (!player.dashAvailable) {
        var barW = 80, barH = 4;
        var barX = cx - barW / 2, barY = h - 28;
        var frac = player.state === 'DASHING' ? 0 : 1 - player.dashCooldown / DASH_CD;
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(barX, barY, barW, barH);
        var dc = colors.cyan;
        ctx.fillStyle = 'rgba(' + dc[0] + ',' + dc[1] + ',' + dc[2] + ',0.8)';
        ctx.fillRect(barX, barY, barW * frac, barH);
      }

      // HUD: attack cooldown bar (just above dash bar)
      if (!player.atkAvailable) {
        var aBarW = 60, aBarH = 3;
        var aBarX = cx - aBarW / 2, aBarY = h - 38;
        var aFrac = player.state === 'ATTACKING' ? 0 : 1 - player.atkCooldown / ATK_CD;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(aBarX, aBarY, aBarW, aBarH);
        var yc = colors.yellow;
        ctx.fillStyle = 'rgba(' + yc[0] + ',' + yc[1] + ',' + yc[2] + ',0.75)';
        ctx.fillRect(aBarX, aBarY, aBarW * aFrac, aBarH);
      }
    }

    /* ================================================================
       GAME LOOP
       ================================================================ */

    function loop(ts) {
      if (!running) return;
      if (prevTs === null) prevTs = ts;
      var dt = Math.min((ts - prevTs) / 1000, 0.05);
      prevTs = ts;
      update(dt);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    /* ================================================================
       PUBLIC API
       ================================================================ */

    function start() {
      running  = true;
      gameTime = 0;
      prevTs   = null;
      lastW    = 0;
      lastH    = 0;
      ghosts   = [];
      keys     = {};

      player.x             = 0;
      player.y             = 0;
      player.vx            = 0;
      player.vy            = 0;
      player.angle         = 0;
      player.spinAngle     = 0;
      player.state         = 'MOVING';
      player.dashAvailable = true;
      player.dashCooldown  = 0;
      player.dashTimer     = 0;
      player.dashDx        = 0;
      player.dashDy        = 0;
      player.atkAvailable  = true;
      player.atkCooldown   = 0;
      player.atkTimer      = 0;
      player.atkDx         = 0;
      player.atkDy         = 0;

      camera.x = 0;
      camera.y = 0;
      mouseX = canvas.width / 2;
      mouseY = canvas.height / 2;

      canvas.addEventListener('contextmenu', onCtxMenu);
      canvas.addEventListener('mousedown',   onMouseDown);
      canvas.addEventListener('mousemove',   onMouseMove);
      document.addEventListener('keydown',   onKeyDown);
      document.addEventListener('keyup',     onKeyUp);

      rafId = requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      canvas.removeEventListener('contextmenu', onCtxMenu);
      canvas.removeEventListener('mousedown',   onMouseDown);
      canvas.removeEventListener('mousemove',   onMouseMove);
      document.removeEventListener('keydown',   onKeyDown);
      document.removeEventListener('keyup',     onKeyUp);
      keys = {};
    }

    return { start: start, stop: stop };
  };

})();

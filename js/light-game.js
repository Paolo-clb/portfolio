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

    var _colorCache = null;
    var _colorTheme = '';

    function getColors() {
      var theme = document.documentElement.getAttribute('data-theme') || 'light';
      if (theme === _colorTheme) return _colorCache;
      _colorTheme = theme;
      if (theme === 'dark') _colorCache = {
        trailAlpha:  0.16,
        cyan:        [0, 255, 255],
        yellow:      [255, 220, 60],
        ghostCyan:   [0, 255, 255],
        ghostViolet: [160, 0, 255],
        pcbTrace:    'rgba(100,60,220,0.22)',
        pcbVia:      'rgba(140,80,255,0.30)',
        pcbGlow:     'rgba(160,0,255,0.025)',
      };
      else if (theme === 'nature') _colorCache = {
        trailAlpha:  0.15,
        cyan:        [80, 255, 200],
        yellow:      [220, 240, 80],
        ghostCyan:   [80, 255, 200],
        ghostViolet: [60, 120, 200],
        pcbTrace:    'rgba(30,120,80,0.22)',
        pcbVia:      'rgba(50,180,100,0.30)',
        pcbGlow:     'rgba(60,200,120,0.025)',
      };
      else _colorCache = {
        trailAlpha:  0.14,
        cyan:        [0, 255, 255],
        yellow:      [255, 220, 60],
        ghostCyan:   [0, 255, 255],
        ghostViolet: [160, 0, 255],
        pcbTrace:    'rgba(0,80,140,0.22)',
        pcbVia:      'rgba(0,180,220,0.30)',
        pcbGlow:     'rgba(0,200,255,0.025)',
      };
      return _colorCache;
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
    var ATK_SPIN      = 28;       // radians per second (torpedo spin)
    var DASH_ATK_IMP  = 30;       // dash attack: snapped full velocity
    var DASH_ATK_DUR  = 300;      // ms — slightly shorter than ATK_DUR
    var DASH_ATK_SPIN = 50;       // rad/s — much faster spin during dash attack
    var RECOVERY_DUR  = 180;      // ms — recovery stun after normal attack ends
    var RECOVERY_FRIC = 0.80;     // heavy friction during recovery
    var DASHATK_WHIFF_DUR = 380;  // ms — punitive recovery after missed dash-attack
    var DASHATK_WHIFF_FRIC = 0.70; // harsher friction than normal recovery
    var DASHATK_CHAIN_EXT  = 40;  // ms — bonus time per cleave kill
    var DASHATK_MAX_EXT    = 180; // ms — max total extension to prevent infinite dash
    var HITSTOP_DUR   = 0.040;    // seconds — freeze on enemy kill
    var IFRAMES_DUR   = 800;      // ms — invincibility after taking damage
    var SPAWN_INTERVAL = 2000;    // ms — auto-spawn every 2s
    var SPAWN_DIST     = 600;     // px from player
    var SEPARATION_RADIUS = 30;   // px — soft collision radius between enemies
    var SEPARATION_FORCE  = 4.0;  // repulsion strength
    var REBOUND_IMP       = 14;   // attack rebound impulse (backward)
    var SHOCKWAVE_RADIUS  = 90;   // px — AoE knockback radius on kill
    var SHOCKWAVE_FORCE   = 10;   // knockback impulse on nearby enemies
    var SHOCKWAVE_STUN    = 300;  // ms — stun duration on shocked enemies
    var CAM_SMOOTH  = 0.10;
    var WORLD_HALF  = 4000;
    var PCB_TILE    = 256;      // offscreen tile size (px) — larger = more varied repeat

    /* ================================================================
       STATE
       ================================================================ */

    var player = {
      x: 0, y: 0,
      vx: 0, vy: 0,
      angle: 0,               // facing direction (toward mouse)
      spinAngle: 0,           // torpedo spin accumulator
      state: 'MOVING',        // 'MOVING' | 'ATTACKING' | 'DASHING' | 'DASH_ATTACKING' | 'RECOVERY'
      dashAvailable: true,
      dashCooldown:  0,
      dashTimer:     0,
      dashDx: 0, dashDy: 0,
      atkAvailable: true,
      atkCooldown:  0,
      atkTimer:     0,
      atkDx: 0, atkDy: 0,
      recoveryTimer: 0,       // RECOVERY state countdown
      recoveryWhiff: false,    // true = whiff recovery (harsher + desaturated)
      hasHitDuringDashAttack: false,  // chain/cleave tracking
      dashAtkExtended: 0,     // ms of bonus time already granted
      hp: 5,
      invincible: false,
      invincTimer: 0,          // iframes countdown
    };

    var camera  = { x: 0, y: 0 };
    var ghosts  = [];
    var mouseX  = 0, mouseY = 0;  // canvas-relative mouse position

    var pcbPattern   = null;      // CanvasPattern from offscreen tile
    var pcbThemeUsed = '';        // cache key to regenerate on theme change
    var _bgMat       = new DOMMatrix();  // reused for pattern transform

    var gameTime = 0;
    var prevTs   = null;
    var lastW    = 0;
    var lastH    = 0;

    /* ================================================================
       TIME MANAGEMENT — global time scale for hitstop
       ================================================================ */

    var globalTimeScale = 1.0;   // 1 = normal, 0 = fully frozen
    var hitstopTimer    = 0;     // seconds remaining

    function triggerHitstop(duration) {
      hitstopTimer    = duration;
      globalTimeScale = 0;
    }

    /* ================================================================
       PARTICLE MANAGER (additive glow explosions)
       ================================================================ */

    var particles = [];
    var MAX_PARTICLES = 200;

    function spawnExplosion(x, y, color, count) {
      var n = count || 25;
      for (var i = 0; i < n; i++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = 120 + Math.random() * 280;
        var sz    = 1.5 + Math.random() * 3;
        particles.push({
          x: x, y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: 1.8 + Math.random() * 1.2,
          size: sz,
          r: color[0], g: color[1], b: color[2],
          friction: 0.94,
        });
      }
      // Hard cap — trim oldest when over budget
      if (particles.length > MAX_PARTICLES) {
        particles.splice(0, particles.length - MAX_PARTICLES);
      }
    }

    function updateParticles(dt) {
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x  += p.vx * dt;
        p.y  += p.vy * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0) {
          // Swap-and-pop: O(1) removal instead of O(n) splice
          particles[i] = particles[particles.length - 1];
          particles.pop();
        }
      }
    }

    function drawParticles() {
      if (particles.length === 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var a = p.life * 0.9;
        ctx.fillStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + a.toFixed(3) + ')';
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }

    /* ================================================================
       ENEMIES
       ================================================================ */

    var enemies = [];
    var spawnTimer = 0;

    var RUSHER_SPEED = 3.0;
    var RUSHER_SIZE  = 14;       // half-length of the thin triangle

    function spawnRusher() {
      var angle = Math.random() * Math.PI * 2;
      var ex = player.x + Math.cos(angle) * SPAWN_DIST;
      var ey = player.y + Math.sin(angle) * SPAWN_DIST;
      enemies.push({
        type: 'rusher',
        x: ex, y: ey,
        vx: 0, vy: 0,
        angle: 0,
        hp: 1,
        size: RUSHER_SIZE,
        speed: RUSHER_SPEED + Math.random() * 0.8,
        stunTimer: 0,          // ms remaining of stun (shockwave)
        // Glitch trail
        trail: [],
      });
    }

    function updateEnemies(dt) {
      var ms = dt * 1000;

      // --- Soft separation (O(n²) — fine for <100 enemies) ---
      for (var i = 0; i < enemies.length; i++) {
        var a = enemies[i];
        for (var j = i + 1; j < enemies.length; j++) {
          var b = enemies[j];
          var sdx = a.x - b.x;
          var sdy = a.y - b.y;
          var sd  = Math.sqrt(sdx * sdx + sdy * sdy);
          if (sd < SEPARATION_RADIUS && sd > 0.01) {
            var overlap = (SEPARATION_RADIUS - sd) / SEPARATION_RADIUS;
            var fx = (sdx / sd) * SEPARATION_FORCE * overlap;
            var fy = (sdy / sd) * SEPARATION_FORCE * overlap;
            a.vx += fx;  a.vy += fy;
            b.vx -= fx;  b.vy -= fy;
          }
        }
      }

      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];

        // Stun countdown — stunned enemies drift but don't steer
        if (e.stunTimer > 0) {
          e.stunTimer -= ms;
          e.vx *= 0.92;  // drag while stunned
          e.vy *= 0.92;
          e.x += e.vx;
          e.y += e.vy;
        } else {
          // Always face player
          var dx = player.x - e.x;
          var dy = player.y - e.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.1) {
            e.angle = Math.atan2(dy, dx);
            var ax = (dx / dist) * e.speed;
            var ay = (dy / dist) * e.speed;
            e.vx += (ax - e.vx) * 0.08;  // smooth steering
            e.vy += (ay - e.vy) * 0.08;
          }
          e.x += e.vx;
          e.y += e.vy;
        }

        // Glitch trail (small, sparse)
        if (Math.random() < 0.2) {
          e.trail.push({ x: e.x, y: e.y, a: 0.5, angle: e.angle });
          if (e.trail.length > 4) e.trail.shift();
        }
        for (var ti = e.trail.length - 1; ti >= 0; ti--) {
          e.trail[ti].a -= dt * 3;
          if (e.trail[ti].a <= 0) e.trail.splice(ti, 1);
        }
      }
    }

    function drawEnemies() {
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];

        // Glitch trail
        for (var ti = 0; ti < e.trail.length; ti++) {
          var tr = e.trail[ti];
          ctx.save();
          ctx.globalAlpha = tr.a * 0.4;
          ctx.translate(tr.x, tr.y);
          ctx.rotate(tr.angle);
          ctx.beginPath();
          ctx.moveTo(e.size, 0);
          ctx.lineTo(-e.size * 0.5, -e.size * 0.18);
          ctx.lineTo(-e.size * 0.5,  e.size * 0.18);
          ctx.closePath();
          ctx.fillStyle = '#FF0044';
          ctx.fill();
          ctx.restore();
        }

        // Main body
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);

        // Cheap glow (oversized triangle, additive, NO shadowBlur)
        ctx.globalCompositeOperation = 'lighter';
        var gs = e.size * 1.6;
        ctx.beginPath();
        ctx.moveTo(gs, 0);
        ctx.lineTo(-gs * 0.5, -gs * 0.22);
        ctx.lineTo(-gs * 0.5,  gs * 0.22);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,0,68,0.18)';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // Solid body
        ctx.beginPath();
        ctx.moveTo(e.size, 0);
        ctx.lineTo(-e.size * 0.5, -e.size * 0.18);
        ctx.lineTo(-e.size * 0.5,  e.size * 0.18);
        ctx.closePath();
        ctx.fillStyle = '#FF0044';
        ctx.fill();

        ctx.restore();
      }
    }

    /* ================================================================
       PCB TILE — pre-rendered offscreen, used as ctx.createPattern
       Dense circuit-board look: 90° / 45° traces, via pads, IC pads
       ================================================================ */

    function generatePCB(colors) {
      var S = PCB_TILE;
      var oc = document.createElement('canvas');
      oc.width = S; oc.height = S;
      var g = oc.getContext('2d');

      // ── Layer 1: main orthogonal bus (heavy traces) ──
      g.strokeStyle = colors.pcbTrace;
      g.lineWidth   = 1.0;
      g.lineCap     = 'square';
      g.beginPath();
      // Horizontal main buses
      g.moveTo(0,       S * 0.22); g.lineTo(S * 0.61, S * 0.22);
      g.moveTo(S * 0.68, S * 0.22); g.lineTo(S,      S * 0.22);  // gap
      g.moveTo(0,       S * 0.71); g.lineTo(S * 0.38, S * 0.71);
      g.moveTo(S * 0.45, S * 0.71); g.lineTo(S,      S * 0.71);  // gap
      // Vertical main buses
      g.moveTo(S * 0.18, 0);      g.lineTo(S * 0.18, S * 0.55);
      g.moveTo(S * 0.18, S*0.62); g.lineTo(S * 0.18, S);         // gap
      g.moveTo(S * 0.77, 0);      g.lineTo(S * 0.77, S * 0.34);
      g.moveTo(S * 0.77, S*0.41); g.lineTo(S * 0.77, S);         // gap
      g.stroke();

      // ── Layer 2: thin secondary traces ──
      g.lineWidth = 0.55;
      g.beginPath();
      // Thin horizontal secondaries
      g.moveTo(S * 0.18, S * 0.44); g.lineTo(S * 0.52, S * 0.44);
      g.moveTo(S * 0.52, S * 0.55); g.lineTo(S * 0.77, S * 0.55);
      g.moveTo(0,        S * 0.88); g.lineTo(S * 0.40, S * 0.88);
      g.moveTo(S * 0.60, S * 0.10); g.lineTo(S,        S * 0.10);
      // Thin vertical secondaries
      g.moveTo(S * 0.38, S * 0.22); g.lineTo(S * 0.38, S * 0.71);
      g.moveTo(S * 0.61, 0);        g.lineTo(S * 0.61, S * 0.22);
      g.moveTo(S * 0.52, S * 0.44); g.lineTo(S * 0.52, S * 0.55);
      g.moveTo(S * 0.88, S * 0.71); g.lineTo(S * 0.88, S);
      // Short stubs
      g.moveTo(S * 0.18, S * 0.55); g.lineTo(S * 0.18, S * 0.62);
      g.moveTo(S * 0.77, S * 0.34); g.lineTo(S * 0.61, S * 0.34);
      g.moveTo(S * 0.61, S * 0.22); g.lineTo(S * 0.61, S * 0.34);
      g.moveTo(S * 0.38, S * 0.71); g.lineTo(S * 0.38, S * 0.88);
      g.stroke();

      // ── Layer 3: diagonal routing (45°) ──
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(S * 0.18, S * 0.44); g.lineTo(S * 0.08, S * 0.34);
      g.moveTo(S * 0.08, S * 0.34); g.lineTo(S * 0.08, S * 0.22);
      g.moveTo(S * 0.38, S * 0.44); g.lineTo(S * 0.52, S * 0.44);
      g.moveTo(S * 0.77, S * 0.55); g.lineTo(S * 0.88, S * 0.44);
      g.moveTo(S * 0.88, S * 0.44); g.lineTo(S * 0.88, S * 0.22);
      g.moveTo(S * 0.40, S * 0.88); g.lineTo(S * 0.52, S * 0.76);
      g.moveTo(S * 0.52, S * 0.76); g.lineTo(S * 0.60, S * 0.76);
      g.moveTo(S * 0.61, S * 0.34); g.lineTo(S * 0.68, S * 0.27);
      g.moveTo(S * 0.68, S * 0.27); g.lineTo(S * 0.77, S * 0.27);
      g.stroke();

      // ── Via pads — varying sizes at key intersections ──
      var vias = [
        [0.18, 0.22, 2.2], [0.38, 0.22, 1.6], [0.61, 0.22, 2.0], [0.77, 0.22, 1.4],
        [0.88, 0.22, 1.6], [0.08, 0.22, 1.4], [0.18, 0.44, 1.8], [0.38, 0.44, 1.4],
        [0.52, 0.44, 1.8], [0.18, 0.71, 2.0], [0.38, 0.71, 1.6], [0.77, 0.55, 1.4],
        [0.88, 0.71, 1.6], [0.38, 0.88, 1.8], [0.52, 0.76, 1.4], [0.61, 0.34, 1.8],
        [0.77, 0.27, 1.4], [0.88, 0.44, 1.6], [0.08, 0.34, 1.2],
      ];
      g.fillStyle = colors.pcbVia;
      for (var vi = 0; vi < vias.length; vi++) {
        g.beginPath();
        g.arc(S * vias[vi][0], S * vias[vi][1], vias[vi][2], 0, Math.PI * 2);
        g.fill();
      }

      // Drill holes (dark core — only on bigger vias)
      g.fillStyle = 'rgba(5,5,16,0.85)';
      var drills = [[0.18, 0.22, 1.0], [0.61, 0.22, 0.9], [0.18, 0.71, 0.9], [0.52, 0.44, 0.8], [0.38, 0.88, 0.8]];
      for (var di = 0; di < drills.length; di++) {
        g.beginPath();
        g.arc(S * drills[di][0], S * drills[di][1], drills[di][2], 0, Math.PI * 2);
        g.fill();
      }

      // ── IC component body (DIP outline) ──
      g.strokeStyle = colors.pcbTrace;
      g.lineWidth   = 0.7;
      g.strokeRect(S * 0.42, S * 0.57, S * 0.20, S * 0.10);
      // Pin marks on IC
      var pins = [0.44, 0.47, 0.50, 0.53, 0.56];
      g.lineWidth = 0.5;
      for (var pi = 0; pi < pins.length; pi++) {
        g.beginPath();
        g.moveTo(S * pins[pi], S * 0.57);
        g.lineTo(S * pins[pi], S * 0.55);
        g.moveTo(S * pins[pi], S * 0.67);
        g.lineTo(S * pins[pi], S * 0.69);
        g.stroke();
      }

      // ── Mini resistor/cap outlines ──
      g.lineWidth = 0.6;
      g.strokeStyle = colors.pcbVia;
      g.strokeRect(S * 0.06, S * 0.42, S * 0.06, S * 0.04); // R1
      g.strokeRect(S * 0.70, S * 0.58, S * 0.04, S * 0.06); // C1

      pcbPattern = ctx.createPattern(oc, 'repeat');
    }

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
      if (e.code === 'KeyP' && !e.repeat) spawnRusher();
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
      if (!player.dashAvailable || player.state === 'DASHING' || player.state === 'ATTACKING' || player.state === 'DASH_ATTACKING' || player.state === 'RECOVERY') return;
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
      if (player.state === 'ATTACKING' || player.state === 'DASH_ATTACKING' || player.state === 'RECOVERY') return;
      if (player.state === 'DASHING') { triggerDashAttack(); return; } // dash attack!
      if (!player.atkAvailable) return;
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

    /* ── Dash Attack (triggered during DASHING + left click) ── */
    function triggerDashAttack() {
      var cx = canvas.width / 2, cy = canvas.height / 2;
      var worldMx = mouseX - cx + camera.x;
      var worldMy = mouseY - cy + camera.y;
      var adx = worldMx - player.x;
      var ady = worldMy - player.y;
      var alen = Math.sqrt(adx * adx + ady * ady);
      if (alen < 1) { adx = Math.cos(player.angle); ady = Math.sin(player.angle); }
      else { adx /= alen; ady /= alen; }

      // Snap velocity fully to attack direction and boost
      player.vx = adx * DASH_ATK_IMP;
      player.vy = ady * DASH_ATK_IMP;
      player.state        = 'DASH_ATTACKING';
      player.atkAvailable = false;
      player.atkTimer     = DASH_ATK_DUR;
      player.atkCooldown  = 0;
      player.atkDx        = adx;
      player.atkDy        = ady;
      player.spinAngle    = 0;
      player.hasHitDuringDashAttack = false;  // reset chain flag
      player.dashAtkExtended = 0;
      // Consume the dash immediately
      player.dashTimer    = 0;
      player.dashCooldown = DASH_CD;
    }

    /* ================================================================
       COLLISION — circle vs circle
       ================================================================ */

    function checkCollisions() {
      var pRadius = SIZE * 0.6;
      var isAtk     = player.state === 'ATTACKING';
      var isDashAtk = player.state === 'DASH_ATTACKING';
      var vulnerable = !isAtk && !isDashAtk && player.state !== 'DASHING';

      for (var i = enemies.length - 1; i >= 0; i--) {
        var e = enemies[i];
        var dx = player.x - e.x;
        var dy = player.y - e.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var hitDist = pRadius + e.size * 0.5;

        if (dist < hitDist) {
          if (isAtk) {
            // Normal attack: kill 1, rebound backward, enter recovery
            killEnemy(i);
            player.state         = 'RECOVERY';
            player.recoveryTimer = RECOVERY_DUR;
            // Strong rebound: launch player opposite to attack direction
            player.vx = -player.atkDx * REBOUND_IMP;
            player.vy = -player.atkDy * REBOUND_IMP;
            player.spinAngle   = 0;
            player.atkTimer    = 0;
            player.atkCooldown = ATK_CD;
            return; // only 1 kill per frame
          } else if (isDashAtk) {
            // Dash-attack: kill, keep going (cleave)
            killEnemy(i);
            player.hasHitDuringDashAttack = true;
            // Chain extension: extend dash duration (capped)
            if (player.dashAtkExtended < DASHATK_MAX_EXT) {
              var ext = Math.min(DASHATK_CHAIN_EXT, DASHATK_MAX_EXT - player.dashAtkExtended);
              player.atkTimer += ext;
              player.dashAtkExtended += ext;
            }
            // don't break — can hit more this frame
          } else if (vulnerable && !player.invincible) {
            // Player takes damage
            player.hp -= 1;
            player.invincible  = true;
            player.invincTimer = IFRAMES_DUR;
            // Knock player away from enemy
            if (dist > 0.1) {
              player.vx += (dx / dist) * 8;
              player.vy += (dy / dist) * 8;
            }
          }
        }
      }
    }

    function killEnemy(index) {
      var e = enemies[index];
      var ex = e.x, ey = e.y;

      // Explosion proportional to enemy size
      var count = Math.round(20 + (e.size / RUSHER_SIZE) * 10);
      spawnExplosion(ex, ey, [255, 40, 80], count);
      // Pink/white secondary burst for extra juice
      spawnExplosion(ex, ey, [255, 180, 200], Math.round(count * 0.4));

      enemies.splice(index, 1);
      triggerHitstop(HITSTOP_DUR);

      // --- Shockwave: knockback + stun nearby enemies ---
      for (var k = 0; k < enemies.length; k++) {
        var o  = enemies[k];
        var sdx = o.x - ex;
        var sdy = o.y - ey;
        var sd  = Math.sqrt(sdx * sdx + sdy * sdy);
        if (sd < SHOCKWAVE_RADIUS) {
          var falloff = 1.0 - (sd / SHOCKWAVE_RADIUS);  // stronger at center
          var nx = sd > 0.1 ? sdx / sd : (Math.random() - 0.5);
          var ny = sd > 0.1 ? sdy / sd : (Math.random() - 0.5);
          o.vx += nx * SHOCKWAVE_FORCE * falloff;
          o.vy += ny * SHOCKWAVE_FORCE * falloff;
          o.stunTimer = SHOCKWAVE_STUN * falloff;
        }
      }
    }

    /* ================================================================
       PHYSICS
       ================================================================ */

    function update(dt) {
      // --- Hitstop management (runs outside time scale) ---
      if (hitstopTimer > 0) {
        hitstopTimer -= dt;
        if (hitstopTimer <= 0) {
          hitstopTimer    = 0;
          globalTimeScale = 1.0;
        } else {
          globalTimeScale = 0;
        }
      }

      var scaledDt = dt * globalTimeScale;
      var ms = scaledDt * 1000;
      if (ms < 0.001) {
        // Still frozen — only advance particles for lingering glow
        updateParticles(dt);
        return;
      }

      // --- Invincibility timer ---
      if (player.invincible) {
        player.invincTimer -= ms;
        if (player.invincTimer <= 0) {
          player.invincible  = false;
          player.invincTimer = 0;
        }
      }

      // --- Movement input (only in MOVING state) ---
      if (player.state === 'MOVING') {
        var inp = getInputVector();
        player.vx = (player.vx + inp.dx * ACCEL) * FRICTION;
        player.vy = (player.vy + inp.dy * ACCEL) * FRICTION;
      } else if (player.state === 'RECOVERY') {
        // Heavy friction, no input — whiff is harsher
        var rf = player.recoveryWhiff ? DASHATK_WHIFF_FRIC : RECOVERY_FRIC;
        player.vx *= rf;
        player.vy *= rf;
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
        player.spinAngle += scaledDt * ATK_SPIN;
        if (player.atkTimer <= 0) {
          // Attack expired without hitting → enter recovery (punishing whiff)
          player.state         = 'RECOVERY';
          player.recoveryTimer = RECOVERY_DUR;
          player.recoveryWhiff = false;  // normal attack whiff = standard recovery
          player.atkCooldown   = ATK_CD;
          player.spinAngle     = 0;
        }
      }
      // --- Dash Attack state ---
      if (player.state === 'DASH_ATTACKING') {
        player.atkTimer -= ms;
        player.spinAngle += scaledDt * DASH_ATK_SPIN;
        // Dense phantom trail every frame: bigger, magenta→orange
        ghosts.push({
          x: player.x, y: player.y,
          alpha: 0.70, angle: player.angle,
          size: SIZE * 1.32,
          c0: [255, 20, 200], c1: [255, 100, 0],
        });
        if (player.atkTimer <= 0) {
          if (player.hasHitDuringDashAttack) {
            // Success: hit at least one enemy → instant control
            player.state       = 'MOVING';
          } else {
            // Whiff: missed everything → punitive recovery
            player.state         = 'RECOVERY';
            player.recoveryTimer = DASHATK_WHIFF_DUR;
            player.recoveryWhiff = true;
            player.vx *= 0.05;  // near-instant stop
            player.vy *= 0.05;
          }
          player.atkCooldown = ATK_CD;
          player.spinAngle   = 0;
        }
      }
      // --- Recovery state ---
      if (player.state === 'RECOVERY') {
        player.recoveryTimer -= ms;
        if (player.recoveryTimer <= 0) {
          player.state = 'MOVING';
          player.recoveryTimer = 0;
        }
      }
      if (player.state !== 'ATTACKING' && player.state !== 'DASH_ATTACKING' && player.atkCooldown > 0) {
        player.atkCooldown = Math.max(0, player.atkCooldown - ms);
        if (player.atkCooldown <= 0) player.atkAvailable = true;
      }

      // --- Ghost decay ---
      for (var g = ghosts.length - 1; g >= 0; g--) {
        ghosts[g].alpha -= dt * 3.5;
        if (ghosts[g].alpha <= 0) {
          ghosts[g] = ghosts[ghosts.length - 1];
          ghosts.pop();
        }
      }

      // --- Arrow facing: toward mouse (screen→world) ---
      if (player.state === 'ATTACKING' || player.state === 'DASH_ATTACKING') {
        // Torpedo / dash-attack: spin continuously
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

      // --- Enemies ---
      updateEnemies(scaledDt);

      // --- Collisions ---
      checkCollisions();

      // --- Particles ---
      updateParticles(scaledDt);

      // --- Auto-spawner ---
      spawnTimer += ms;
      if (spawnTimer >= SPAWN_INTERVAL) {
        spawnTimer -= SPAWN_INTERVAL;
        spawnRusher();
      }

      gameTime += dt;
    }

    /* ================================================================
       RENDERING
       ================================================================ */

    /* ── PCB background (screen space) — single pattern fill ── */
    function drawBackground(w, h, colors) {
      // Regenerate tile on theme change
      var curTheme = document.documentElement.getAttribute('data-theme') || 'light';
      if (curTheme !== pcbThemeUsed) {
        generatePCB(colors);
        pcbThemeUsed = curTheme;
      }
      if (!pcbPattern) return;

      // Translate pattern so it scrolls with the camera (world-space tiling)
      _bgMat.e = -camera.x;
      _bgMat.f = -camera.y;
      pcbPattern.setTransform(_bgMat);
      ctx.fillStyle = pcbPattern;
      ctx.fillRect(0, 0, w, h);
    }

    /* ── Ghost trail — cyan→violet for dash, magenta→orange for dash-attack ── */
    function drawGhosts(colors) {
      for (var gi = 0; gi < ghosts.length; gi++) {
        var gh = ghosts[gi];
        var cc = gh.c0 || colors.ghostCyan;
        var cv = gh.c1 || colors.ghostViolet;
        var baseAlpha = gh.c0 ? 0.70 : 0.55;
        var t  = Math.max(0, Math.min(1, 1 - gh.alpha / baseAlpha));
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
      // Invincibility blink: skip drawing every other ~80ms
      if (player.invincible && Math.floor(gameTime * 12.5) % 2 === 0) return;

      var clr;
      if (player.state === 'DASH_ATTACKING') {
        clr = [255, 20, 200];                 // hot magenta (dash+attack fused)
      } else if (player.state === 'ATTACKING') {
        clr = [255, 30, 60];                  // neon red during torpedo
      } else if (player.state === 'DASHING') {
        clr = colors.ghostViolet;             // violet (same as ghost echoes)
      } else if (player.state === 'RECOVERY' && player.recoveryWhiff) {
        clr = [80, 80, 90];                   // desaturated grey — exhausted whiff
      } else {
        // MOVING + normal RECOVERY: cyan if dash ready, yellow if not
        clr = player.dashAvailable ? colors.cyan : colors.yellow;
      }
      var r = clr[0], g = clr[1], b = clr[2];
      var isDashAtk = player.state === 'DASH_ATTACKING';
      var isWhiffRecovery = player.state === 'RECOVERY' && player.recoveryWhiff;

      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);

      // Arrow size: enlarged during dash attack for wider area feel
      var s = isDashAtk ? SIZE * 1.35 : SIZE;
      function arrowPath() {
        ctx.beginPath();
        ctx.moveTo(s, 0);                          // tip
        ctx.lineTo(-s * 0.6, -s * 0.55);           // top wing
        ctx.lineTo(-s * 0.25, 0);                   // notch
        ctx.lineTo(-s * 0.6,  s * 0.55);            // bottom wing
        ctx.closePath();
      }

      // Dash attack: wide outer corona before the normal glow
      if (isDashAtk) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.7)';
        ctx.shadowBlur  = 52;
        arrowPath();
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.05)';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
      }

      // Neon glow layer (additive blend + shadowBlur) — suppressed during whiff
      if (!isWhiffRecovery) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.9)';
        ctx.shadowBlur  = isDashAtk ? 28 : 18;
        arrowPath();
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.35)';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
      }

      // Solid arrow body
      arrowPath();
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fill();

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
      drawEnemies();
      drawArrow(colors);
      drawParticles();

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
      particles = [];
      enemies   = [];
      spawnTimer = 0;
      globalTimeScale = 1.0;
      hitstopTimer    = 0;

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
      player.recoveryTimer = 0;
      player.recoveryWhiff = false;
      player.hasHitDuringDashAttack = false;
      player.dashAtkExtended = 0;
      player.hp            = 5;
      player.invincible    = false;
      player.invincTimer   = 0;

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
      keys       = {};
      enemies    = [];
      particles  = [];
    }

    function pause() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    function resume() {
      if (!rafId) {
        running = true;
        prevTs  = null;  // prevents large dt spike after pause
        rafId   = requestAnimationFrame(loop);
      }
    }

    window.__lightGameAtkReady = function () { return player.atkAvailable; };
    return { start: start, stop: stop, pause: pause, resume: resume };
  };

})();

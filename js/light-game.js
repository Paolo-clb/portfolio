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
    var MAX_ENEMIES    = 40;      // hard cap — keeps O(n²) separation safe
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
      history: [],             // positional trail: [{x,y,angle}, ...] last 6 frames
    };

    var camera  = { x: 0, y: 0 };
    var ghosts  = [];
    var mouseX  = 0, mouseY = 0;  // canvas-relative mouse position

    var pcbPattern   = null;      // CanvasPattern from offscreen tile
    var pcbThemeUsed = '';        // cache key to regenerate on theme change
    var _bgMat       = new DOMMatrix();  // reused for pattern transform

    /* ================================================================
       FPS COUNTER
       ================================================================ */

    var _fpsFrames  = 0;
    var _fpsTimer   = 0;    // accumulated seconds
    var _fpsDisplay = 0;    // last computed FPS (updated ~every 0.5s)

    function updateFPS(dt) {
      _fpsFrames++;
      _fpsTimer += dt;
      if (_fpsTimer >= 0.5) {
        _fpsDisplay = Math.round(_fpsFrames / _fpsTimer);
        _fpsFrames  = 0;
        _fpsTimer   = 0;
      }
    }

    function drawFPS() {
      var colors = getColors();
      var fps    = _fpsDisplay;
      var c; // rgb array
      if (fps >= 55)      c = colors.cyan;
      else if (fps >= 30) c = colors.yellow;
      else                c = [255, 60, 60];
      ctx.save();
      ctx.font         = 'bold 13px monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      ctx.fillText(fps + ' FPS', 10, 10);
      ctx.restore();
    }

    /* ================================================================
       SPRITE CACHE — pre-rendered offscreen canvases (shadowBlur once)
       Key format: 'r,g,b' for arrows; 'enemy' for the shared rusher sprite
       Invalidated on theme change via _spriteTheme
       ================================================================ */

    var _spriteCache = {};
    var _spriteTheme = '';
    var _enemySprite = null;        // shared sprite for all rushers
    var _enemySpriteSize = -1;     // track RUSHER_SIZE to detect changes

    // Build one arrow sprite: full glow (shadowBlur) + additive layer + solid body,
    // pre-rotated to angle=0 (tip pointing right). drawImage + rotate at runtime.
    function _buildArrowSprite(r, g, b, s, blur, isDashAtk) {
      var pad = blur + 4;
      var W   = Math.ceil(s * 2.2 + pad * 2);
      var H   = Math.ceil(s * 1.2 + pad * 2);
      var oc  = document.createElement('canvas');
      oc.width  = W;
      oc.height = H;
      var g2    = oc.getContext('2d');
      var ox    = W / 2, oy = H / 2;  // origin within sprite

      function path(g2, scale) {
        g2.beginPath();
        g2.moveTo(ox + s * scale,       oy);
        g2.lineTo(ox - s * 0.6 * scale, oy - s * 0.55 * scale);
        g2.lineTo(ox - s * 0.25 * scale, oy);
        g2.lineTo(ox - s * 0.6 * scale, oy + s * 0.55 * scale);
        g2.closePath();
      }

      // Outer corona for dash-attack
      if (isDashAtk) {
        g2.save();
        g2.globalCompositeOperation = 'lighter';
        g2.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.7)';
        g2.shadowBlur  = 52;
        path(g2, 1);
        g2.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.04)';
        g2.fill();
        g2.shadowBlur = 0;
        g2.restore();
      }

      // Neon glow (additive + shadowBlur — expensive, done only once)
      g2.save();
      g2.globalCompositeOperation = 'lighter';
      g2.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.9)';
      g2.shadowBlur  = blur;
      path(g2, 1);
      g2.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.35)';
      g2.fill();
      g2.shadowBlur = 0;
      g2.restore();

      // Solid body
      path(g2, 1);
      g2.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      g2.fill();

      return { canvas: oc, ox: ox, oy: oy };
    }

    // Build the shared enemy sprite (glow triangle + solid triangle, facing right)
    function _buildEnemySprite(size) {
      var gs  = size * 1.6;
      var pad = 4;
      var W   = Math.ceil(gs * 2 + pad * 2);
      var H   = Math.ceil(gs * 0.5 + pad * 2);
      var oc  = document.createElement('canvas');
      oc.width  = W;
      oc.height = H;
      var g2    = oc.getContext('2d');
      var ox    = W / 2, oy = H / 2;

      // Additive glow triangle (oversized)
      g2.save();
      g2.globalCompositeOperation = 'lighter';
      g2.beginPath();
      g2.moveTo(ox + gs,          oy);
      g2.lineTo(ox - gs * 0.5,   oy - gs * 0.22);
      g2.lineTo(ox - gs * 0.5,   oy + gs * 0.22);
      g2.closePath();
      g2.fillStyle = 'rgba(255,0,68,0.18)';
      g2.fill();
      g2.restore();

      // Solid body
      g2.beginPath();
      g2.moveTo(ox + size,          oy);
      g2.lineTo(ox - size * 0.5,   oy - size * 0.18);
      g2.lineTo(ox - size * 0.5,   oy + size * 0.18);
      g2.closePath();
      g2.fillStyle = '#FF0044';
      g2.fill();

      return { canvas: oc, ox: ox, oy: oy };
    }

    function _getSpriteKey(r, g, b, isDashAtk) {
      return r + ',' + g + ',' + b + (isDashAtk ? ',da' : '');
    }

    function getArrowSprite(r, g, b, isDashAtk) {
      var curTheme = document.documentElement.getAttribute('data-theme') || 'light';
      if (curTheme !== _spriteTheme) {
        _spriteCache = {};
        _enemySprite = null;
        _spriteTheme = curTheme;
      }
      var key = _getSpriteKey(r, g, b, isDashAtk);
      if (!_spriteCache[key]) {
        var s    = isDashAtk ? SIZE * 1.35 : SIZE;
        var blur = isDashAtk ? 28 : 18;
        _spriteCache[key] = _buildArrowSprite(r, g, b, s, blur, isDashAtk);
      }
      return _spriteCache[key];
    }

    function getEnemySprite() {
      var curTheme = document.documentElement.getAttribute('data-theme') || 'light';
      if (!_enemySprite || _enemySpriteSize !== RUSHER_SIZE || curTheme !== _spriteTheme) {
        _enemySprite = _buildEnemySprite(RUSHER_SIZE);
        _enemySpriteSize = RUSHER_SIZE;
        // _spriteTheme updated in getArrowSprite or here:
        if (curTheme !== _spriteTheme) { _spriteCache = {}; _spriteTheme = curTheme; }
      }
      return _enemySprite;
    }

    // Pre-warm all arrow sprite variants so first frames don't stutter
    function prewarmSprites() {
      var colors = getColors();
      var variants = [
        colors.cyan,        // MOVING, dash ready
        colors.yellow,      // MOVING, dash on cooldown
        [255, 30,  60],     // ATTACKING
        [255, 20, 200],     // DASH_ATTACKING (normal)
        colors.ghostViolet, // DASHING
        [80,  80,  90],     // RECOVERY whiff
      ];
      for (var vi = 0; vi < variants.length; vi++) {
        var c = variants[vi];
        getArrowSprite(c[0], c[1], c[2], false);
      }
      // Dash-attack magenta corona variant
      getArrowSprite(255, 20, 200, true);
      getEnemySprite();
    }

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
       PARTICLE MANAGER — object pool (no GC allocations per explosion)
       ================================================================ */

    var MAX_PARTICLES = 200;

    // Pre-allocate fixed pool — no allocations at runtime
    var _particlePool = (function () {
      var pool = [];
      for (var i = 0; i < MAX_PARTICLES; i++) {
        pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0,
                    decay: 0, size: 0, r: 0, g: 0, b: 0, friction: 0 });
      }
      return pool;
    }());

    function spawnExplosion(x, y, color, count) {
      var n = count || 25;
      var spawned = 0;
      // First pass: fill inactive slots
      for (var i = 0; i < MAX_PARTICLES && spawned < n; i++) {
        var p = _particlePool[i];
        if (!p.active) {
          var angle = Math.random() * Math.PI * 2;
          var speed = 120 + Math.random() * 280;
          p.active   = true;
          p.x        = x;
          p.y        = y;
          p.vx       = Math.cos(angle) * speed;
          p.vy       = Math.sin(angle) * speed;
          p.life     = 1.0;
          p.decay    = 1.8 + Math.random() * 1.2;
          p.size     = 1.5 + Math.random() * 3;
          p.r        = color[0];
          p.g        = color[1];
          p.b        = color[2];
          p.friction = 0.94;
          spawned++;
        }
      }
      // Second pass: reuse oldest active slots if pool was full
      if (spawned < n) {
        for (var i = 0; i < MAX_PARTICLES && spawned < n; i++) {
          var p = _particlePool[i];
          var angle = Math.random() * Math.PI * 2;
          var speed = 120 + Math.random() * 280;
          p.active   = true;
          p.x        = x;
          p.y        = y;
          p.vx       = Math.cos(angle) * speed;
          p.vy       = Math.sin(angle) * speed;
          p.life     = 1.0;
          p.decay    = 1.8 + Math.random() * 1.2;
          p.size     = 1.5 + Math.random() * 3;
          p.r        = color[0];
          p.g        = color[1];
          p.b        = color[2];
          p.friction = 0.94;
          spawned++;
        }
      }
    }

    function updateParticles(dt) {
      for (var i = 0; i < MAX_PARTICLES; i++) {
        var p = _particlePool[i];
        if (!p.active) continue;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x  += p.vx * dt;
        p.y  += p.vy * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0) p.active = false;
      }
    }

    function drawParticles() {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < MAX_PARTICLES; i++) {
        var p = _particlePool[i];
        if (!p.active) continue;
        ctx.globalAlpha = p.life * 0.9;
        ctx.fillStyle   = 'rgb(' + p.r + ',' + p.g + ',' + p.b + ')';
        var px = p.x + _drawOffX, py = p.y + _drawOffY;
        ctx.fillRect(px - p.size / 2, py - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
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
      if (enemies.length >= MAX_ENEMIES) return;  // hard cap
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
      var ms      = dt * 1000;
      var sc60    = dt * 60;                         // fps normaliser
      var stunDrg = Math.pow(0.92, sc60);            // stun drag (frame-rate independent)
      var steerK  = 1 - Math.pow(1 - 0.08, sc60);   // steering lerp rate (frame-rate independent)

      // --- Soft separation (O(n²) — fine for <MAX_ENEMIES enemies) ---
      for (var i = 0; i < enemies.length; i++) {
        var a = enemies[i];
        for (var j = i + 1; j < enemies.length; j++) {
          var b = enemies[j];
          var sdx = a.x - b.x;
          var sdy = a.y - b.y;
          var sd  = Math.sqrt(sdx * sdx + sdy * sdy);
          if (sd < SEPARATION_RADIUS && sd > 0.01) {
            var overlap = (SEPARATION_RADIUS - sd) / SEPARATION_RADIUS;
            var fx = (sdx / sd) * SEPARATION_FORCE * overlap * sc60;
            var fy = (sdy / sd) * SEPARATION_FORCE * overlap * sc60;
            a.vx += fx;  a.vy += fy;
            b.vx -= fx;  b.vy -= fy;
          }
        }
      }

      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];

        // Record position history for trail (always, every frame)
        e.trail.push({ x: e.x, y: e.y, angle: e.angle });
        if (e.trail.length > 5) e.trail.shift();

        // Stun countdown — stunned enemies drift but don't steer
        if (e.stunTimer > 0) {
          e.stunTimer -= ms;
          e.vx *= stunDrg;
          e.vy *= stunDrg;
          e.x += e.vx * sc60;
          e.y += e.vy * sc60;
        } else {
          // Always face player
          var dx = player.x - e.x;
          var dy = player.y - e.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.1) {
            e.angle = Math.atan2(dy, dx);
            var ax = (dx / dist) * e.speed;
            var ay = (dy / dist) * e.speed;
            e.vx += (ax - e.vx) * steerK;
            e.vy += (ay - e.vy) * steerK;
          }
          e.x += e.vx * sc60;
          e.y += e.vy * sc60;
        }
      }
    }

    // _drawOffX/_drawOffY: camera offset for setTransform batching, set in draw()
    var _drawOffX = 0, _drawOffY = 0;

    function drawEnemies() {
      if (enemies.length === 0) return;
      var esp = getEnemySprite();
      var eSpr = esp.canvas;
      var eOx  = esp.ox, eOy = esp.oy;

      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        var tLen = e.trail.length;

        // Positional wake trail — sprite at past positions, fading out
        for (var ti = 0; ti < tLen - 1; ti++) {
          var tr = e.trail[ti];
          ctx.globalAlpha = (ti + 1) / tLen * 0.38;
          var tc = Math.cos(tr.angle), ts2 = Math.sin(tr.angle);
          ctx.setTransform(tc, ts2, -ts2, tc, tr.x + _drawOffX, tr.y + _drawOffY);
          ctx.drawImage(eSpr, -eOx, -eOy);
        }

        // Main body
        var c = Math.cos(e.angle), s = Math.sin(e.angle);
        ctx.globalAlpha = 1;
        ctx.setTransform(c, s, -s, c, e.x + _drawOffX, e.y + _drawOffY);
        ctx.drawImage(eSpr, -eOx, -eOy);
      }

      // Reset
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
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
      var scale60   = scaledDt * 60;    // normaliser: 1.0 at 60fps, 0.5 at 120fps, etc.
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
      // Friction is frame-rate independent: Math.pow(f, scale60) decays the same
      // per-second regardless of fps. Position scaled by scale60 for the same reason.
      var frDt = Math.pow(FRICTION, scale60);
      if (player.state === 'MOVING') {
        var inp = getInputVector();
        player.vx = (player.vx + inp.dx * ACCEL * scale60) * frDt;
        player.vy = (player.vy + inp.dy * ACCEL * scale60) * frDt;
      } else if (player.state === 'RECOVERY') {
        // Heavy friction, no input — whiff is harsher
        var rf   = player.recoveryWhiff ? DASHATK_WHIFF_FRIC : RECOVERY_FRIC;
        var rfDt = Math.pow(rf, scale60);
        player.vx *= rfDt;
        player.vy *= rfDt;
      } else {
        // While attacking or dashing, apply friction but no player input
        player.vx *= frDt;
        player.vy *= frDt;
      }

      player.x += player.vx * scale60;
      player.y += player.vy * scale60;

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
        player.angle = Math.atan2(player.atkDy, player.atkDx) + player.spinAngle;
      } else {
        var halfW = canvas.width / 2, halfH = canvas.height / 2;
        var wmx = mouseX - halfW + camera.x;
        var wmy = mouseY - halfH + camera.y;
        player.angle = Math.atan2(wmy - player.y, wmx - player.x);
      }

      // --- Positional trail history (after angle update so we store correct facing) ---
      player.history.push({ x: player.x, y: player.y, angle: player.angle });
      if (player.history.length > 6) player.history.shift();

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

      // --- Camera lerp (LAST — after all position updates) ---
      // Frame-rate independent lerp: same visual smoothing at any fps
      var camAlpha = 1 - Math.pow(1 - CAM_SMOOTH, scale60);
      camera.x += (player.x - camera.x) * camAlpha;
      camera.y += (player.y - camera.y) * camAlpha;

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

    /* ── Ghost trail — setTransform, no save/restore ── */
    function drawGhosts(colors) {
      if (ghosts.length === 0) return;
      for (var gi = 0; gi < ghosts.length; gi++) {
        var gh = ghosts[gi];
        var cc = gh.c0 || colors.ghostCyan;
        var cv = gh.c1 || colors.ghostViolet;
        var baseAlpha = gh.c0 ? 0.70 : 0.55;
        var t  = Math.max(0, Math.min(1, 1 - gh.alpha / baseAlpha));
        var cr = Math.round(cc[0] + (cv[0] - cc[0]) * t);
        var cg = Math.round(cc[1] + (cv[1] - cc[1]) * t);
        var cb = Math.round(cc[2] + (cv[2] - cc[2]) * t);

        ctx.globalAlpha = gh.alpha * 0.6;
        var gc = Math.cos(gh.angle), gs2 = Math.sin(gh.angle);
        ctx.setTransform(gc, gs2, -gs2, gc, gh.x + _drawOffX, gh.y + _drawOffY);

        var s = gh.size;
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(-s * 0.6, -s * 0.55);
        ctx.lineTo(-s * 0.25, 0);
        ctx.lineTo(-s * 0.6,  s * 0.55);
        ctx.closePath();
        ctx.fillStyle = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
        ctx.fill();
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    }

    /* ── Arrow (the player) — drawImage from sprite cache ── */
    function drawArrow(colors) {
      // Invincibility blink: skip drawing every other ~80ms
      if (player.invincible && Math.floor(gameTime * 12.5) % 2 === 0) return;

      var clr;
      var isDashAtk = player.state === 'DASH_ATTACKING';
      if (isDashAtk) {
        clr = [255, 20, 200];
      } else if (player.state === 'ATTACKING') {
        clr = [255, 30, 60];
      } else if (player.state === 'DASHING') {
        clr = colors.ghostViolet;
      } else if (player.state === 'RECOVERY' && player.recoveryWhiff) {
        clr = [80, 80, 90];
      } else {
        clr = player.dashAvailable ? colors.cyan : colors.yellow;
      }

      var r = clr[0], g = clr[1], b = clr[2];
      var isWhiffRecovery = player.state === 'RECOVERY' && player.recoveryWhiff;
      var ac = Math.cos(player.angle), as2 = Math.sin(player.angle);

      if (isWhiffRecovery) {
        // No glow — draw solid grey shape only via setTransform
        ctx.setTransform(ac, as2, -as2, ac, player.x + _drawOffX, player.y + _drawOffY);
        var s = SIZE;
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(-s * 0.6, -s * 0.55);
        ctx.lineTo(-s * 0.25, 0);
        ctx.lineTo(-s * 0.6,  s * 0.55);
        ctx.closePath();
        ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        ctx.fill();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        return;
      }

      // Normal/dash-atk: cached sprite with shadowBlur pre-baked
      var spr = getArrowSprite(r, g, b, isDashAtk);
      var histLen = player.history.length;

      // Positional wake trail — draw past frames using current sprite, fading out
      ctx.globalCompositeOperation = 'lighter';
      for (var hi = 0; hi < histLen - 1; hi++) {
        var hh = player.history[hi];
        ctx.globalAlpha = (hi + 1) / histLen * 0.40;
        var hc = Math.cos(hh.angle), hs = Math.sin(hh.angle);
        ctx.setTransform(hc, hs, -hs, hc, hh.x + _drawOffX, hh.y + _drawOffY);
        ctx.drawImage(spr.canvas, -spr.ox, -spr.oy);
      }

      // Main sprite — additive blend for neon glow
      ctx.globalAlpha = 1;
      ctx.setTransform(ac, as2, -as2, ac, player.x + _drawOffX, player.y + _drawOffY);
      ctx.drawImage(spr.canvas, -spr.ox, -spr.oy);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ================================================================
       MASTER DRAW
       ================================================================ */

    function draw() {
      var w = canvas.width, h = canvas.height;
      var colors = getColors();
      var cx = w / 2, cy = h / 2;

      // Resize tracking
      if (w !== lastW || h !== lastH) {
        lastW = w; lastH = h;
      }

      // Opaque clear — avoid per-pixel read+blend of rgba fillRect
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, w, h);

      // Background (screen space — pre-rendered PCB pattern, single fillRect)
      drawBackground(w, h, colors);

      // Set camera offset — round to integer pixel to eliminate sub-pixel jitter
      _drawOffX = cx - Math.round(camera.x);
      _drawOffY = cy - Math.round(camera.y);

      drawGhosts(colors);
      drawEnemies();
      drawArrow(colors);
      drawParticles();

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

      // FPS counter (drawn last, always on top)
      drawFPS();
    }

    /* ================================================================
       GAME LOOP
       ================================================================ */

    function loop(ts) {
      if (!running) return;
      if (prevTs === null) prevTs = ts;
      var dt = Math.min((ts - prevTs) / 1000, 0.05);
      prevTs = ts;
      updateFPS(dt);
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
      ghosts         = [];
      player.history = [];
      keys           = {};
      // Reset particle pool (mark all inactive)
      for (var pi = 0; pi < MAX_PARTICLES; pi++) _particlePool[pi].active = false;
      enemies   = [];
      spawnTimer = 0;
      globalTimeScale = 1.0;
      hitstopTimer    = 0;
      _fpsFrames = 0; _fpsTimer = 0; _fpsDisplay = 0;

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

      // Pre-render all arrow and enemy sprites so first frames don't stutter
      prewarmSprites();

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
      for (var pi = 0; pi < MAX_PARTICLES; pi++) _particlePool[pi].active = false;
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

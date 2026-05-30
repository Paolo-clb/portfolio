/* ==========================================================================
   Light Again — The Mirror (3rd mini-boss) — a rival duelist

   An independent magenta rival shaped like the player's arrow ("flèche sombre").
   It does NOT echo your inputs; it fights its own duel built on two threats:

     • ROAM      — orbits you at a preferred distance, weaving. On a random
                   cadence it fires a NOVA: a radial volley of spinning shards
                   that slow, then DETONATE in small blasts. DASH-PARRY a shard
                   in flight → it rockets along your dash heading and explodes on
                   contact for PARADE score (never homes back). Never while vuln.
     • TELEGRAPH — locks a lunge direction at you, charging (aim beam).
     • DASH      — a FAST dash-attack along the locked line. The body SPINS on
                   itself with a cycling colour gradient + afterimage streak,
                   exactly like the player's dash-attack. Contact = 1 dmg.
     • RECOVER   — if the lunge HIT → short recovery. If it WHIFFED → a long
                   recovery (≈3× the player's whiff) where it is wide open.
     • DODGE     — a real, animated evade-dash (i-frames). It sidesteps your
                   attacks intelligently (perpendicular, away from walls).

   ALWAYS ATTACKABLE: there is no invulnerable phase. Your melee lands whenever
   its dodge is on cooldown (or it is recovering). Bait the dodge, then punish
   during MIR_DODGE_CD — every successful hit breaks one of its 3 shield orbs.

   The World: it freezes when your activation shockwave reaches it, fires its
   OWN time-stop burst (shoving you back), then resumes. Driven by PLAYER-time
   so it keeps dueling during your World. Death drops a free upgrade.

   Self-contained on `this._mirror` — never enters `this.enemies`.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  var BODY_COL  = 0xff3aa0;   // hot-magenta rival (distinct from the cyan player)
  var ORB_COL   = 0xb060ff;   // violet shield orbs
  var VULN_COL  = 0xffe040;   // amber while recovering / open

  // Colour gradient used by the dash-attack body/trail and the nova shards.
  var GRAD = [0xff3aa0, 0xc24bff, 0x7a6bff, 0x46b6ff, 0x66ffe0];

  // The arrow texture is authored at C.SIZE; render the (bigger) mirror at this
  // factor so the sprite visually matches its larger hit/shield footprint.
  var BASE_SCL = C.MIR_SIZE / C.SIZE;

  /* ---- gradient helpers ---- */
  function lerpCol(a, b, t) {
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return ((Math.round(ar + (br - ar) * t) << 16)
          | (Math.round(ag + (bg - ag) * t) << 8)
          |  Math.round(ab + (bb - ab) * t));
  }
  function gradAt(u) {
    var n = GRAD.length;
    u = u - Math.floor(u);            // wrap to [0,1)
    var f = u * n, i = Math.floor(f), t = f - i;
    return lerpCol(GRAD[i % n], GRAD[(i + 1) % n], t);
  }
  /* Filled 4-point star (shard) for the nova projectiles. */
  function drawStar4(g, cx, cy, outer, inner, rot) {
    g.beginPath();
    for (var k = 0; k < 8; k++) {
      var rr = (k % 2 === 0) ? outer : inner;
      var a  = rot + k * (Math.PI / 4);
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillPath();
  }

  /* ================================================================ */
  M._initMirror = function () { this._mirror = null; };

  M._clearMirror = function (_silent) {
    var mir = this._mirror;
    this._mirror = null;
    if (!mir) return;
    if (mir.spr)       mir.spr.destroy();
    if (mir.glowSpr)   mir.glowSpr.destroy();
    if (mir.gfx)       mir.gfx.destroy();
    if (mir.shieldGfx) mir.shieldGfx.destroy();
    if (mir.shotGfx)   mir.shotGfx.destroy();
    if (mir.ghosts) {
      for (var i = 0; i < mir.ghosts.length; i++) {
        if (mir.ghosts[i].spr) mir.ghosts[i].spr.destroy();
      }
    }
    // Settle any in-flight parried shards' PARADE buckets so the pending count
    // (bumped at parry time) can't leak when the boss is cleared mid-deflect.
    if (mir.shots) {
      for (var si = 0; si < mir.shots.length; si++) {
        var sh = mir.shots[si];
        if (sh.reflected && sh._dashAtkId && this._paradeFlushIfDone) this._paradeFlushIfDone(sh._dashAtkId);
      }
    }
  };

  /* ================================================================
     SPAWN — emerges out of the player, then peels off into ROAM.
     ================================================================ */
  M._spawnMirror = function () {
    if (this._mirror || this._anomaly || this._gigaBruiser || this._snake) return;
    if (!this.p || this.p.state === 'DEAD') return;
    var p = this.p;

    var glowSpr = this.add.image(p.x, p.y, '_ar_cyan');
    glowSpr.setBlendMode(Phaser.BlendModes.ADD); glowSpr.setDepth(30);
    glowSpr.setTint(BODY_COL); glowSpr.setScale(BASE_SCL * 1.5); glowSpr.setAlpha(0.22);

    var spr = this.add.image(p.x, p.y, '_ar_cyan');
    spr.setBlendMode(Phaser.BlendModes.ADD); spr.setDepth(31);
    spr.setTint(BODY_COL); spr.setScale(BASE_SCL);

    // Afterimage pool for the dash / dodge streaks (tinted per use).
    var ghosts = [];
    for (var gi = 0; gi < 14; gi++) {
      var gs = this.add.image(p.x, p.y, '_ar_cyan');
      gs.setBlendMode(Phaser.BlendModes.ADD); gs.setDepth(29);
      gs.setTint(BODY_COL); gs.setVisible(false);
      ghosts.push({ spr: gs, alpha: 0, active: false });
    }

    var gfx = this.add.graphics(); gfx.setDepth(33); gfx.setBlendMode(Phaser.BlendModes.ADD);
    var shotGfx = this.add.graphics(); shotGfx.setDepth(23); shotGfx.setBlendMode(Phaser.BlendModes.ADD);
    var shieldGfx = this.add.graphics(); shieldGfx.setDepth(34); shieldGfx.setBlendMode(Phaser.BlendModes.ADD);

    // Spawn drifting away from the player so it visibly "peels off".
    var outAng = Math.random() * TAU;

    this._mirror = {
      x: p.x, y: p.y, vx: 0, vy: 0,
      angle: outAng,
      orbs: C.MIR_SHIELD_ORBS, orbsMax: C.MIR_SHIELD_ORBS,
      // Cinematic entrance — peels out of the player before the duel begins.
      spawnPhase: 'EMERGE', spawnT: 0, spawnT01: 0,
      spawnAng: outAng, spawnOX: p.x, spawnOY: p.y, _peelBurst: false,
      state: 'ROAM', stateT: 0,
      attackCD: C.MIR_ATTACK_CD * 0.8,
      novaCD: C.MIR_NOVA_CD * 0.7,
      dodgeCD: 0,
      lockX: 0, lockY: 0, lockAng: 0,
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      vulnerable: false, didHit: false,
      hitIframe: 0,
      hitT: 0, dodgeFlashT: 0, spin: 0, dashSpin: 0,
      // radial-nova projectiles + afterimages
      shots: [],
      ghosts: ghosts, ghostW: 0,
      // cached render transform (read when seeding ghosts)
      _rotA: outAng, _sclX: BASE_SCL, _sclY: BASE_SCL,
      // The World handling
      twPhase: null, twTimer: 0, twWas: false,
      dead: false,
      spr: spr, glowSpr: glowSpr, gfx: gfx, shotGfx: shotGfx, shieldGfx: shieldGfx,
    };

    // "Split" flash on the player — the rival is torn out of them. The full
    // flourish burst fires at the end of the peel (_mirrorFinishSpawn).
    this._spawnWaveRing(p.x, p.y, { maxRadius: 90, color: 0xffffff, expandTime: 0.22 });
    this._explode(p.x, p.y, [255, 255, 255], 18);
    this._explode(p.x, p.y, [255, 70, 180], 12);
    this.cameras.main.flash(120, 255, 150, 220);
  };

  /* ================================================================
     UPDATE — PLAYER-time driven; not frozen by The World.
     ================================================================ */
  M._updateMirror = function (sMs, pMs, dt) {
    if (!this._mirror) return;
    var mir = this._mirror, p = this.p;
    if (p.state === 'DEAD') { this._renderMirror(dt); return; }

    // Cinematic spawn — peels out of the player on REAL dt (constant cinematic
    // pace, unaffected by hitstop / slow-mo). No combat until it has locked in.
    if (mir.spawnPhase === 'EMERGE') {
      this._mirrorTickSpawn(mir, p, dt);
      this._renderMirror(dt);
      return;
    }

    if (pMs < 0.0001) { this._renderMirror(dt); return; }

    var sc60 = pMs / 16.7;
    mir.spin       += sc60 * 0.05;
    mir.hitT        = Math.max(0, mir.hitT - dt * 3.5);
    mir.dodgeFlashT = Math.max(0, mir.dodgeFlashT - dt * 4);
    mir.hitIframe   = Math.max(0, mir.hitIframe - pMs);
    if (mir.dodgeCD > 0) mir.dodgeCD -= pMs;

    // Nova shards fly + hit on player-time regardless of the boss's own freeze
    // (you can still dodge them while The World is active).
    this._updateMirrorShots(mir, p, pMs);

    /* ---- The World handling (rising/falling edge) ---- */
    var tw = !!this._twActive;
    if (tw && !mir.twWas) {
      // Our activation shockwave reaches it after a short, distance-based delay.
      var ddx0 = mir.x - p.x, ddy0 = mir.y - p.y;
      var dd0  = Math.sqrt(ddx0 * ddx0 + ddy0 * ddy0);
      mir.twPhase = 'FREEZE';
      mir.twTimer = (dd0 / C.MIR_TW_WAVE_SPEED) * 1000 + 80;
    }
    if (!tw && mir.twWas) { mir.twPhase = null; }  // World ended → back to normal
    mir.twWas = tw;

    if (mir.twPhase === 'FREEZE') {
      mir.twTimer -= pMs;
      if (mir.twTimer <= 0) this._mirrorTwBurst(mir, p);  // → its own time-stop blast
      this._renderMirror(dt);
      return;  // frozen at our wave's contact
    }

    /* ---- State machine ---- */
    if (mir.state === 'ROAM')           this._mirrorRoam(mir, p, sc60, pMs);
    else if (mir.state === 'TELEGRAPH') this._mirrorTelegraph(mir, p, pMs);
    else if (mir.state === 'DASH')      this._mirrorDash(mir, p, sc60, pMs);
    else if (mir.state === 'RECOVER')   this._mirrorRecover(mir, sc60, pMs);
    else if (mir.state === 'DODGE')     this._mirrorDodge(mir, sc60, pMs);

    // Integrate + world clamp
    mir.x += mir.vx * sc60;
    mir.y += mir.vy * sc60;
    var m = C.WORLD_HALF - C.MIR_SIZE * 1.5;
    if (mir.x < -m) mir.x = -m; else if (mir.x > m) mir.x = m;
    if (mir.y < -m) mir.y = -m; else if (mir.y > m) mir.y = m;

    this._renderMirror(dt);
  };

  /* ================================================================
     CINEMATIC SPAWN — the rival tears out of the player and peels off.
     Eased slide outward (motion-stretch + dense afterimage streak), then it
     brakes, snaps to face the player and the shield orbs assemble.
     ================================================================ */
  M._mirrorTickSpawn = function (mir, p, dt) {
    var DUR = C.MIR_SPAWN_DUR;
    mir.spawnT += dt * 1000;
    var t = mir.spawnT / DUR; if (t > 1) t = 1;
    mir.spawnT01 = t;
    mir.spin += dt * 60 * 0.10;

    // Eased slide out to a natural roam distance, with a small overshoot. The
    // origin tracks the (still-moving) player so it truly peels off them.
    var dist = C.MIR_KEEP_DIST * 0.85;
    var ease;
    if (t < 0.72) { var u = t / 0.72;          ease = (u * u * (3 - 2 * u)) * 1.1; }
    else          { var v = (t - 0.72) / 0.28; ease = 1.1 - 0.1 * (v * v * (3 - 2 * v)); }
    mir.spawnOX = p.x; mir.spawnOY = p.y;
    mir.x = p.x + Math.cos(mir.spawnAng) * dist * ease;
    mir.y = p.y + Math.sin(mir.spawnAng) * dist * ease;
    var m = C.WORLD_HALF - C.MIR_SIZE * 1.5;
    if (mir.x < -m) mir.x = -m; else if (mir.x > m) mir.x = m;
    if (mir.y < -m) mir.y = -m; else if (mir.y > m) mir.y = m;

    // Face along the peel while launching, then snap to face the player.
    if (t < 0.62) {
      mir.angle = mir.spawnAng;
    } else {
      var aim  = Math.atan2(p.y - mir.y, p.x - mir.x);
      var diff = Phaser.Math.Angle.Wrap(aim - mir.angle);
      mir.angle += diff * Math.min(1, 10 * dt);
    }

    // Dense afterimage streak during the peel (white-hot → gradient).
    if (t > 0.12 && t < 0.78) {
      this._mirrorAddGhost(mir, 0.55, (t < 0.42) ? 0xffffff : gradAt(mir.ghostW * 0.13));
    }

    // Mid-peel "snap out" punch.
    if (!mir._peelBurst && t >= 0.32) {
      mir._peelBurst = true;
      this._explode(mir.x, mir.y, [255, 255, 255], 12);
      this.cameras.main.shake(120, 0.005);
    }

    if (t >= 1) this._mirrorFinishSpawn(mir, p);
  };

  M._mirrorFinishSpawn = function (mir, p) {
    mir.spawnPhase = null;
    mir.state = 'ROAM'; mir.stateT = 0;
    mir.vx = 0; mir.vy = 0;
    mir.angle = Math.atan2(p.y - mir.y, p.x - mir.x);

    // Flourish burst as the rival locks into the duel.
    this._spawnWaveRing(mir.x, mir.y, { maxRadius: C.MIR_SIZE * 5, color: BODY_COL, expandTime: 0.30 });
    this._spawnWaveRing(mir.x, mir.y, { maxRadius: C.MIR_SIZE * 3, color: 0xffffff, expandTime: 0.20 });
    this._explode(mir.x, mir.y, [255, 70, 180], 26);
    this._explode(mir.x, mir.y, [180, 96, 255], 16);
    this._explode(mir.x, mir.y, [255, 255, 255], 12);
    this.cameras.main.flash(150, 255, 120, 200);
    this.cameras.main.shake(160, 0.010);
    this._triggerHitstop(C.HITSTOP_DUR);
  };

  /* ---- ROAM: orbit the player, fire random novas, then commit to a lunge ---- */
  M._mirrorRoam = function (mir, p, sc60, pMs) {
    var dx = p.x - mir.x, dy = p.y - mir.y;
    var d  = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = dx / d, ny = dy / d;
    // Radial term: close to / open from the keep-distance. Tangential: strafe.
    var radial = (d - C.MIR_KEEP_DIST) / C.MIR_KEEP_DIST;   // <0 too close, >0 too far
    var tx = -ny * mir.strafeDir, ty = nx * mir.strafeDir;
    var desVx = (nx * radial * 2.4 + tx) * C.MIR_ROAM_SPEED;
    var desVy = (ny * radial * 2.4 + ty) * C.MIR_ROAM_SPEED;
    var k = 1 - Math.pow(1 - 0.10, sc60);
    mir.vx += (desVx - mir.vx) * k;
    mir.vy += (desVy - mir.vy) * k;
    mir.angle = Math.atan2(dy, dx);
    if (Math.random() < 0.004) mir.strafeDir = -mir.strafeDir;  // occasional weave flip

    // Ranged pressure: random radial nova (ROAM is never the vulnerable state).
    mir.novaCD -= pMs;
    if (mir.novaCD <= 0 && mir.shots.length < C.MIR_NOVA_MAX) {
      this._mirrorFireNova(mir, p);
      mir.novaCD = C.MIR_NOVA_CD * (0.6 + Math.random() * 1.0);
    }

    // Close the gap → commit to the dash-attack.
    mir.attackCD -= pMs;
    if (mir.attackCD <= 0 && d < C.MIR_KEEP_DIST * 1.8) {
      mir.state = 'TELEGRAPH'; mir.stateT = 0;
      mir.lockAng = Math.atan2(dy, dx);   // lock the lunge line NOW (dodgeable)
    }
  };

  /* ---- TELEGRAPH: brake, aim, then lunge ---- */
  M._mirrorTelegraph = function (mir, p, pMs) {
    mir.stateT += pMs;
    var fr = Math.pow(0.82, pMs / 16.7);
    mir.vx *= fr; mir.vy *= fr;
    // Keep tracking slightly so a slow player can't trivially walk out of the line.
    var aim = Math.atan2(p.y - mir.y, p.x - mir.x);
    var diff = Phaser.Math.Angle.Wrap(aim - mir.lockAng);
    mir.lockAng += diff * Math.min(1, 3 * pMs / 1000);
    mir.angle = mir.lockAng;
    if (mir.stateT >= C.MIR_TELEGRAPH) {
      mir.state = 'DASH'; mir.stateT = 0; mir.didHit = false;
      mir.vx = Math.cos(mir.lockAng) * C.MIR_DASH_SPEED;
      mir.vy = Math.sin(mir.lockAng) * C.MIR_DASH_SPEED;
      this._explode(mir.x, mir.y, [255, 255, 255], 10);  // launch puff
    }
  };

  /* ---- DASH: fast lunge; spins on itself with a colour gradient (like the
         player's dash-attack). Hits the player if they aren't safe. ---- */
  M._mirrorDash = function (mir, p, sc60, pMs) {
    mir.stateT += pMs;
    mir.dashSpin += sc60 * 0.7;     // tournoie sur lui-même

    // Gradient afterimage streak.
    this._mirrorAddGhost(mir, 0.6, gradAt(mir.ghostW * 0.13));

    // Contact check — player damageable = not invincible/dashing/attacking/in TW.
    if (!mir.didHit) {
      var dx = p.x - mir.x, dy = p.y - mir.y;
      var thr = C.MIR_HIT_RADIUS + C.SIZE * 0.6;
      if (dx * dx + dy * dy < thr * thr) {
        var safe = p.invincible || p.state === 'DASHING' || p.state === 'DASH_ATTACKING'
                || this._twActive || p.state === 'DEAD';
        if (!safe) {
          var dd = Math.sqrt(dx * dx + dy * dy) || 1;
          this._damagePlayer(dx / dd, dy / dd);  // push the player away from the mirror
          mir.didHit = true;
          this._endMirrorDash(mir);    // connected → short recovery
          return;
        }
      }
    }
    if (mir.stateT >= C.MIR_DASH_DUR) this._endMirrorDash(mir);
  };

  M._endMirrorDash = function (mir) {
    mir.state = 'RECOVER'; mir.stateT = 0;
    if (mir.didHit) {
      mir.recoverDur = C.MIR_RECOVER_HIT;
      mir.vulnerable = false;
    } else {
      // Whiff → long recovery, wide open. ≈ 3× the player's dash-attack whiff.
      mir.recoverDur = C.DASHATK_WHIFF_DUR * C.MIR_RECOVER_MULT;
      mir.vulnerable = true;
      this._explode(mir.x, mir.y, [255, 224, 64], 10);  // "off-balance" puff
    }
  };

  /* ---- RECOVER: decelerate; extra-open if it whiffed ---- */
  M._mirrorRecover = function (mir, sc60, pMs) {
    mir.stateT += pMs;
    var fr = Math.pow(0.86, sc60);
    mir.vx *= fr; mir.vy *= fr;
    if (mir.stateT >= mir.recoverDur) {
      mir.state = 'ROAM'; mir.stateT = 0;
      mir.vulnerable = false;
      mir.attackCD = C.MIR_ATTACK_CD * (0.85 + Math.random() * 0.4);
    }
  };

  /* ---- DODGE: quick animated evade dash (i-frames) ---- */
  M._mirrorDodge = function (mir, sc60, pMs) {
    mir.stateT += pMs;
    var fr = Math.pow(0.88, sc60);
    mir.vx *= fr; mir.vy *= fr;
    // Streak afterimage in violet so the evade reads as a real, deliberate dash.
    this._mirrorAddGhost(mir, 0.5, ORB_COL);
    if (mir.stateT >= C.MIR_DODGE_DUR) {
      mir.state = 'ROAM'; mir.stateT = 0;
    }
  };

  /* ---- Smart dodge: sidestep perpendicular to your attack, toward open space,
         with a little backward component. Full i-frames during the evade. ---- */
  M._mirrorStartDodge = function (mir, p) {
    var dx = mir.x - p.x, dy = mir.y - p.y;
    var d  = Math.sqrt(dx * dx + dy * dy) || 1;
    var awx = dx / d, awy = dy / d;              // away from the player
    // Two perpendicular options; pick the side that heads toward the arena centre
    // (away from the nearest wall) so it never juke itself into a corner.
    var perpx = -awy, perpy = awx;
    var toCx = -mir.x, toCy = -mir.y;
    var cl = Math.sqrt(toCx * toCx + toCy * toCy) || 1;
    var side = (perpx * (toCx / cl) + perpy * (toCy / cl)) >= 0 ? 1 : -1;
    var dgx = awx * 0.45 + perpx * side;
    var dgy = awy * 0.45 + perpy * side;
    var dl = Math.sqrt(dgx * dgx + dgy * dgy) || 1;
    mir.vx = (dgx / dl) * C.MIR_DODGE_SPEED;
    mir.vy = (dgy / dl) * C.MIR_DODGE_SPEED;
    mir.state = 'DODGE'; mir.stateT = 0;
    mir.dodgeCD = C.MIR_DODGE_CD;
    mir.dodgeFlashT = 1.0;
    mir.hitIframe = C.MIR_DODGE_DUR + 40;        // invulnerable through the evade
    // Smart counter: after slipping a hit, sometimes wind up an immediate lunge.
    if (Math.random() < 0.5) mir.attackCD = Math.min(mir.attackCD, 220);
    this._explode(mir.x, mir.y, [180, 96, 255], 8);
  };

  /* ---- Afterimage helper (reads the last cached render transform) ---- */
  M._mirrorAddGhost = function (mir, alpha, tint) {
    if (!mir.ghosts || !mir.ghosts.length) return;
    var g = mir.ghosts[mir.ghostW % mir.ghosts.length];
    mir.ghostW++;
    g.active = true; g.alpha = alpha;
    g.spr.setPosition(mir.x, mir.y);
    g.spr.setRotation(mir._rotA != null ? mir._rotA : mir.angle);
    g.spr.setScale(mir._sclX || BASE_SCL, mir._sclY || BASE_SCL);
    g.spr.setTint(tint || BODY_COL);
    g.spr.setAlpha(alpha);
    g.spr.setVisible(true);
  };

  /* ================================================================
     NOVA — radial volley of spinning gradient shards around the boss
     ================================================================ */
  M._mirrorFireNova = function (mir, p) {
    var n = C.MIR_NOVA_COUNT;
    var base = Math.random() * TAU;
    var ringR = C.MIR_SIZE * 1.1;
    var layers = Math.random() < 0.35 ? 2 : 1;   // sometimes a denser double ring
    for (var L = 0; L < layers; L++) {
      var off = L * (Math.PI / n);               // interleave the 2nd ring
      var spd = C.MIR_NOVA_SPEED * (L === 0 ? 1 : 0.78);
      for (var i = 0; i < n; i++) {
        var a = base + off + (i / n) * TAU;
        mir.shots.push({
          x: mir.x + Math.cos(a) * ringR,
          y: mir.y + Math.sin(a) * ringR,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          life: C.MIR_NOVA_LIFE, spin: Math.random() * TAU,
          hue: i / n + L * 0.5, reflected: false,
        });
      }
    }
    this._explode(mir.x, mir.y, [255, 70, 180], 16);
    this._spawnWaveRing(mir.x, mir.y, { maxRadius: C.MIR_SIZE * 2.2, color: BODY_COL, expandTime: 0.18 });
  };

  M._updateMirrorShots = function (mir, p, pMs) {
    if (!mir.shots.length) return;
    var sc60 = pMs / 16.7;
    var pR = C.SIZE * 0.6;
    var hitThr = C.MIR_NOVA_RADIUS + pR;          // direct clip vs the player
    var wm = C.WORLD_HALF;
    var twActive = this._twActive;
    var drag = Math.pow(C.MIR_NOVA_DRAG, sc60);

    // Dash-attack parry geometry — mirrors the normal projectile parry box so
    // deflecting a shard feels identical to deflecting any projectile.
    var isDAtk = p.state === 'DASH_ATTACKING';
    var parryThrSq = 0;
    if (isDAtk) {
      var dashLvl = (this._upgradeLevels && this._upgradeLevels.dashAtk) || 0;
      var cm = this.comboMultiplier, aScale;
      if      (cm >= 50) aScale = 1.34;
      else if (cm >= 25) aScale = 1.17;
      else if (cm >= 10) aScale = 1.08;
      else if (cm >= 5)  aScale = 1.035;
      else               aScale = 1.0;
      aScale *= 1.08;
      if (this.isStarPowered) aScale *= 1.25;
      var parryBonus = (pR * 1.5) / aScale;
      if (dashLvl >= 2) parryBonus += 55;          // Lv2 magnetic vacuum catch zone
      var parryThr = pR + C.MIR_NOVA_RADIUS + parryBonus;
      parryThrSq = parryThr * parryThr;
    }

    for (var i = mir.shots.length - 1; i >= 0; i--) {
      var s = mir.shots[i];
      s.life -= pMs;
      s.spin += sc60 * (s.reflected ? 0.5 : 0.25);
      if (!s.reflected) { s.vx *= drag; s.vy *= drag; }   // boss shards slow + "hang"
      s.x += s.vx * sc60;
      s.y += s.vy * sc60;

      // Off-world → gone (off-screen, no blast). Settle its PARADE bucket if parried.
      if (s.x < -wm || s.x > wm || s.y < -wm || s.y > wm) {
        mir.shots.splice(i, 1);
        if (s.reflected && s._dashAtkId && this._paradeFlushIfDone) this._paradeFlushIfDone(s._dashAtkId);
        continue;
      }

      // Fuse spent → DETONATE where it sits.
      if (s.life <= 0) {
        this._mirrorDetonateShard(mir, s);
        mir.shots.splice(i, 1);
        if (s.reflected && s._dashAtkId && this._paradeFlushIfDone) this._paradeFlushIfDone(s._dashAtkId);
        continue;
      }

      if (s.reflected) {
        // Parried shard → explode on the first enemy it touches.
        var er = C.MIR_NOVA_RADIUS + 3;
        var hit = false;
        for (var ei = 0; ei < this.enemies.length; ei++) {
          var e = this.enemies[ei];
          var ex = s.x - e.x, ey = s.y - e.y;
          var et = er + e.size * 0.5;
          if (ex * ex + ey * ey < et * et) { hit = true; break; }
        }
        if (hit) {
          this._mirrorDetonateShard(mir, s);
          mir.shots.splice(i, 1);
          if (s._dashAtkId && this._paradeFlushIfDone) this._paradeFlushIfDone(s._dashAtkId);
          continue;
        }
      } else {
        // Live boss shard. DASH-PARRY takes priority — the player is "safe" while
        // dash-attacking, so it can't be clipped at the same instant.
        if (isDAtk) {
          var rdx = p.x - s.x, rdy = p.y - s.y;
          if (rdx * rdx + rdy * rdy < parryThrSq) {
            this._mirrorReflectShard(mir, s, p);
            continue;
          }
        }
        // Direct clip → detonate on the player (the blast carries the damage).
        if (!p.invincible && !twActive &&
            p.state !== 'DASHING' && p.state !== 'DASH_ATTACKING' && p.state !== 'DEAD') {
          var pdx = p.x - s.x, pdy = p.y - s.y;
          if (pdx * pdx + pdy * pdy < hitThr * hitThr) {
            this._mirrorDetonateShard(mir, s);
            mir.shots.splice(i, 1);
            continue;
          }
        }
      }
    }
  };

  /* ---- PARRY: a dash-attack catches a live shard. It rockets off along the
         player's DASH heading (never homes back to the boss) with a short fuse,
         then detonates on contact for PARADE score. ---- */
  M._mirrorReflectShard = function (mir, s, p) {
    var ax = p.atkDx, ay = p.atkDy;
    var al = Math.sqrt(ax * ax + ay * ay);
    if (al < 0.01) { ax = Math.cos(p.angle); ay = Math.sin(p.angle); al = 1; }
    ax /= al; ay /= al;
    var spd = C.MIR_NOVA_REFLECT_SPEED;
    s.vx = ax * spd; s.vy = ay * spd;
    s.reflected = true;
    s.life = C.MIR_NOVA_REFLECT_LIFE;

    // Group every shard parried during this dash-attack into one "PARADE ×N"
    // popup (shared with reflected projectiles tagged with the same id).
    s._dashAtkId = this._currentDashAtkId || 0;
    if (s._dashAtkId) {
      this._paradePending = this._paradePending || {};
      this._paradePending[s._dashAtkId] = (this._paradePending[s._dashAtkId] || 0) + 1;
    }

    p.hasHitDuringDashAttack = true;
    if (this._tutEvent) this._tutEvent('parade');
    this._triggerHitstop(C.DEFLECT_HEAVY_HS);
    this.cameras.main.shake(70, 0.006);
    this._explode(s.x, s.y, [170, 68, 255], 10);
    this._explode(s.x, s.y, [255, 255, 255], 6);
  };

  /* ---- DETONATE: a small, stylish blast. A parried shard chews enemies in its
         radius (PARADE score); a live boss shard just clips the player if they
         are standing inside the (telegraphed) blast. ---- */
  M._mirrorDetonateShard = function (mir, s) {
    var x = s.x, y = s.y;
    var R = C.MIR_SHARD_EXP_RADIUS;

    if (s.reflected) {
      var hitAny = false;
      var pOwnBatch = !this._twBatchWindow;
      if (pOwnBatch) this._beginBatch('PARADE', { dashAtkId: s._dashAtkId });
      var R2 = R * R;
      for (var ei = this.enemies.length - 1; ei >= 0; ei--) {
        var e = this.enemies[ei];
        var dx = e.x - x, dy = e.y - y;
        var d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        if (e.tier === 3 && e.hasShield) { this._breakShield(e); hitAny = true; continue; }
        e.hp -= C.MIR_SHARD_EXP_DMG;
        if (e.hp <= 0) {
          this._killEnemy(ei, { batch: true, reflected: true });
        } else {
          e.stunTimer = Math.max(e.stunTimer || 0, 250);
          var d = Math.sqrt(d2) || 1;
          e.vx += (dx / d) * C.SHOCKWAVE_FORCE * 0.8;
          e.vy += (dy / d) * C.SHOCKWAVE_FORCE * 0.8;
        }
        hitAny = true;
      }
      if (pOwnBatch) this._endBatch();

      // Stylish violet blast (reads as "yours", like a reflected projectile smash).
      this._spawnWaveRing(x, y, { maxRadius: R * 1.15, color: 0xaa44ff, expandTime: 0.18 });
      this._spawnWaveRing(x, y, { maxRadius: R * 0.55, color: 0xffffff, expandTime: 0.12 });
      this._explode(x, y, [170, 68, 255], 16);
      this._explode(x, y, [220, 150, 255], 10);
      this._explode(x, y, [255, 255, 255], 8);
      if (hitAny) {
        this._triggerHitstop(C.DEFLECT_HEAVY_HS);
        this.cameras.main.shake(70, 0.006);
      }
    } else {
      // Boss blast: small magenta-gradient pop; clips the player if inside it.
      var col = gradAt(s.hue || 0);
      var cr = (col >> 16) & 255, cg = (col >> 8) & 255, cb = col & 255;
      this._spawnWaveRing(x, y, { maxRadius: R,        color: col,      expandTime: 0.16 });
      this._spawnWaveRing(x, y, { maxRadius: R * 0.5,  color: 0xffffff, expandTime: 0.10 });
      this._explode(x, y, [cr, cg, cb], 12);
      this._explode(x, y, [255, 255, 255], 6);
      var p = this.p;
      if (!p.invincible && !this._twActive &&
          p.state !== 'DASHING' && p.state !== 'DASH_ATTACKING' && p.state !== 'DEAD') {
        var ddx = p.x - x, ddy = p.y - y;
        var dmgR = R * 0.85;                  // a touch forgiving vs the visual blast
        if (ddx * ddx + ddy * ddy < dmgR * dmgR) {
          var dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          this._damagePlayer(ddx / dd, ddy / dd);
        }
      }
    }
  };

  /* ================================================================
     ITS OWN TIME-STOP — fires once our shockwave reaches it.
     ================================================================ */
  M._mirrorTwBurst = function (mir, p) {
    mir.twPhase = 'ACTIVE';
    mir.state = 'ROAM'; mir.stateT = 0; mir.vulnerable = false;
    mir.attackCD = C.MIR_ATTACK_CD * 0.5;   // gets aggressive right after

    // Shove the player back (its counter to your World).
    var dx = p.x - mir.x, dy = p.y - mir.y;
    var d  = Math.sqrt(dx * dx + dy * dy) || 1;
    p.vx += (dx / d) * C.MIR_TW_PUSH;
    p.vy += (dy / d) * C.MIR_TW_PUSH;

    // Its own time-stop blast — magenta rings, no damage (just the shove).
    this._spawnWaveRing(mir.x, mir.y, { maxRadius: 900, color: BODY_COL, expandTime: 0.45 });
    this._spawnWaveRing(mir.x, mir.y, { maxRadius: 560, color: 0xffffff, expandTime: 0.34 });
    this._spawnWaveRing(mir.x, mir.y, { maxRadius: 300, color: ORB_COL,  expandTime: 0.24 });
    this._explode(mir.x, mir.y, [255, 70, 180], 34);
    this._explode(mir.x, mir.y, [180, 96, 255], 22);
    this.cameras.main.flash(220, 255, 90, 200);
    this.cameras.main.shake(180, 0.012);
  };

  /* ================================================================
     PLAYER MELEE vs MIRROR — ALWAYS ATTACKABLE.
     It dodges if it can; otherwise the hit lands and breaks an orb. Both base
     attack AND dash-attack connect. There is no invulnerable phase.
     ================================================================ */
  M._checkMirrorCollision = function () {
    var mir = this._mirror;
    if (!mir || mir.dead) return;
    if (mir.spawnPhase === 'EMERGE') return;   // intangible while it peels out
    var p = this.p;
    var isAtk = p.state === 'ATTACKING', isDAtk = p.state === 'DASH_ATTACKING';
    if (!isAtk && !isDAtk) return;

    var pR = C.SIZE * 0.6;
    var dx = p.x - mir.x, dy = p.y - mir.y;
    var d2 = dx * dx + dy * dy;
    var thr = pR + C.MIR_SIZE + (isDAtk ? 12 : 0);
    if (d2 > thr * thr) return;
    var dist = Math.sqrt(d2) || 0.001;

    // Mid-evade or just-hit → it's intangible this instant; the swing whiffs.
    if (mir.state === 'DODGE' || mir.hitIframe > 0) return;

    // Can it slip away? It dodges from ROAM / TELEGRAPH / its own DASH (juking
    // out of a committed lunge) whenever the dodge is off cooldown. It CANNOT
    // dodge while recovering → that's the guaranteed window.
    var canDodge = mir.dodgeCD <= 0 &&
                   (mir.state === 'ROAM' || mir.state === 'TELEGRAPH' || mir.state === 'DASH');
    if (canDodge) {
      this._mirrorStartDodge(mir, p);
      return;                              // evaded → your hit whiffs
    }

    // No dodge available → the hit LANDS, breaking a shield orb. Interrupt a
    // committed lunge so it can't trade hits.
    if (mir.state === 'DASH') { mir.state = 'RECOVER'; mir.stateT = 0; mir.recoverDur = C.MIR_RECOVER_HIT; mir.vulnerable = false; }
    mir.vx += (-dx / dist) * 8; mir.vy += (-dy / dist) * 8;
    this._damageMirror(1);
    if (isAtk) {
      // base attack ends + slight rebound (same feel as hitting any body)
      p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
      p.atkAvailable = true; p.atkCooldown = 0;
      p.vx *= 0.3; p.vy *= 0.3;
      if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
    } else {
      p.hasHitDuringDashAttack = true;
    }
  };

  /* ================================================================
     DAMAGE — break a shield orb; at zero, die. Immune to AoE/projectiles.
     ================================================================ */
  M._damageMirror = function (amount) {
    var mir = this._mirror;
    if (!mir || mir.dead) return;
    mir.orbs -= (amount || 1);
    mir.hitT = 1.0;
    mir.hitIframe = C.MIR_HIT_IFRAME;
    this._explode(mir.x, mir.y, [180, 96, 255], 16);
    this._explode(mir.x, mir.y, [255, 255, 255], 8);
    this._spawnWaveRing(mir.x, mir.y, { maxRadius: C.MIR_SIZE * 2.4, color: ORB_COL, expandTime: 0.18 });
    this._triggerHitstop(C.HITSTOP_DUR);
    this.cameras.main.shake(80, 0.008);
    if (mir.orbs <= 0) this._killMirror();
  };

  /* ================================================================
     DEATH — free upgrade (like the other bosses).
     ================================================================ */
  M._killMirror = function () {
    var mir = this._mirror;
    if (!mir || mir.dead) return;
    mir.dead = true;
    var ex = mir.x, ey = mir.y;

    this._bossKillBanner(ex, ey - C.MIR_SIZE - 14, 'RIVAL DOWN', '#ff8ad0');

    this._explode(ex, ey, [255, 70, 180], 54);
    this._explode(ex, ey, [180, 96, 255], 36);
    this._explode(ex, ey, [255, 255, 255], 28);
    this._spawnWaveRing(ex, ey, { maxRadius: 260, color: BODY_COL, expandTime: 0.30 });
    this._spawnWaveRing(ex, ey, { maxRadius: 150, color: 0xffffff, expandTime: 0.22 });
    this.cameras.main.flash(240, 255, 90, 200);
    this.cameras.main.shake(240, 0.016);
    this._triggerHitstop(C.DETONATION_HITSTOP);

    this._clearMirror(true);
    this._anomalyCooldownT = C.ANO_COOLDOWN;

    var self = this;
    this.time.delayedCall(420, function () {
      if (!self._upgradeLevels) return;
      if (self._upgradeDraftOpen || self._upSlowMoPhase) return;
      if (self._upgradePool && self._upgradePool.length > 0) self._beginUpgradeSlowMo();
    });
  };

  /* ================================================================
     RENDER
     ================================================================ */
  M._renderMirror = function (dt) {
    var mir = this._mirror;
    if (!mir) return;
    var gt = this.gameTime;

    // Cinematic entrance has its own dedicated look.
    if (mir.spawnPhase === 'EMERGE') { this._renderMirrorSpawn(mir, dt); return; }

    // Nova shards first (they live underneath the boss UI).
    this._renderMirrorShots(mir);

    // Decay afterimages (real dt so it's frame-rate independent).
    for (var gi = 0; gi < mir.ghosts.length; gi++) {
      var gh = mir.ghosts[gi];
      if (!gh.active) continue;
      gh.alpha -= dt * 3.2;
      if (gh.alpha <= 0) { gh.active = false; gh.spr.setVisible(false); }
      else gh.spr.setAlpha(gh.alpha * 0.6);
    }

    var vuln     = mir.vulnerable && mir.state === 'RECOVER';
    var dashing  = mir.state === 'DASH';
    var dodging  = mir.state === 'DODGE' || mir.dodgeFlashT > 0;
    var charging = mir.state === 'TELEGRAPH';

    // ---- Body sprite ----
    var bodyCol = BODY_COL;
    var alpha = 0.95, scl = BASE_SCL, sclX = BASE_SCL, sclY = BASE_SCL;
    if (vuln) {
      // Off-balance: amber, dizzy spin + shrink-pulse, clearly hittable
      bodyCol = (Math.sin(gt * Math.PI * 12) > 0) ? VULN_COL : 0xff8a3a;
      alpha = 0.9; scl = BASE_SCL * (0.92 + 0.06 * Math.sin(gt * 22));
      sclX = scl; sclY = scl;
    } else if (dashing) {
      // Spins on itself with a cycling colour gradient (like the player's dash-attack).
      bodyCol = gradAt(gt * 1.6);
      alpha = 1.0; scl = BASE_SCL * 1.18; sclX = scl; sclY = scl;
    } else if (charging) {
      // pulse brighter as the lunge nears
      var cp = Math.min(1, mir.stateT / C.MIR_TELEGRAPH);
      bodyCol = (Math.sin(gt * Math.PI * (6 + cp * 16)) > 0) ? 0xffffff : BODY_COL;
      scl = BASE_SCL * (1.0 + cp * 0.12); sclX = scl; sclY = scl;
    }
    if (mir.hitT > 0 && !dashing) { bodyCol = 0xffffff; alpha = 1.0; }
    if (dodging) alpha = 0.45;   // blur-out while evading

    var rotA;
    if (dashing)       rotA = mir.dashSpin;     // tournoie sur lui-même
    else if (charging) rotA = mir.lockAng;
    else               rotA = mir.angle;
    // Cache transform so seeded afterimages match the body exactly.
    mir._rotA = rotA; mir._sclX = sclX; mir._sclY = sclY;

    mir.spr.setPosition(mir.x, mir.y);
    mir.spr.setRotation(rotA);
    mir.spr.setScale(sclX, sclY);
    mir.spr.setAlpha(alpha);
    mir.spr.setTint(bodyCol);

    mir.glowSpr.setPosition(mir.x, mir.y);
    mir.glowSpr.setRotation(rotA);
    mir.glowSpr.setScale(Math.max(sclX, sclY) * 1.5 + (dashing ? 0.5 : 0));
    mir.glowSpr.setAlpha(0.18 + mir.hitT * 0.3 + (vuln ? 0.12 : 0) + (dashing ? 0.18 : 0));
    mir.glowSpr.setTint(bodyCol);

    // ---- gfx: telegraph beam + dizzy stars ----
    var g = mir.gfx;
    g.clear();
    if (charging) {
      var cp2 = Math.min(1, mir.stateT / C.MIR_TELEGRAPH);
      var len = 480;
      var ebx = mir.x + Math.cos(mir.lockAng) * len;
      var eby = mir.y + Math.sin(mir.lockAng) * len;
      var a1 = 0.25 + 0.5 * cp2;
      g.lineStyle(2 + cp2 * 3, BODY_COL, a1);
      g.beginPath(); g.moveTo(mir.x, mir.y); g.lineTo(ebx, eby); g.strokePath();
      g.lineStyle(1, 0xffffff, a1 * 0.7);
      g.beginPath(); g.moveTo(mir.x, mir.y); g.lineTo(ebx, eby); g.strokePath();
    }
    if (vuln) {
      // dizzy ring of orbiting stars to telegraph the punish window
      var dn = 3;
      for (var s = 0; s < dn; s++) {
        var sang = gt * 6 + (TAU / dn) * s;
        var sx = mir.x + Math.cos(sang) * (C.MIR_SIZE + 8);
        var sy = mir.y - C.MIR_SIZE - 6 + Math.sin(sang) * 4;
        g.fillStyle(VULN_COL, 0.85);
        g.fillCircle(sx, sy, 2.8);
      }
    }

    // ---- Shield orbs (violet) with a rotating triangular ward (enlarged) ----
    var sg = mir.shieldGfx;
    sg.clear();
    if (mir.orbs > 0) {
      var R = C.MIR_SIZE * 1.9;
      var wardRot = mir.spin * 1.6;
      var pts = [];
      for (var i2 = 0; i2 < mir.orbsMax; i2++) {
        var ang = wardRot + (TAU / mir.orbsMax) * i2;
        pts.push({ x: mir.x + Math.cos(ang) * R, y: mir.y + Math.sin(ang) * R, on: i2 < mir.orbs });
      }
      // Ward outline connecting active orbs (triangle), pulsing
      var wa = 0.35 + 0.2 * Math.sin(gt * Math.PI * 3) + mir.hitT * 0.4;
      sg.lineStyle(2.5, ORB_COL, wa);
      sg.beginPath();
      var started = false;
      for (var j = 0; j < pts.length; j++) {
        if (!pts[j].on) continue;
        if (!started) { sg.moveTo(pts[j].x, pts[j].y); started = true; }
        else sg.lineTo(pts[j].x, pts[j].y);
      }
      if (started) { sg.closePath(); sg.strokePath(); }
      // Orbs (bigger)
      for (var kk = 0; kk < pts.length; kk++) {
        if (!pts[kk].on) continue;
        sg.fillStyle(ORB_COL, 0.30);
        sg.fillCircle(pts[kk].x, pts[kk].y, 11);
        sg.fillStyle(0xffffff, 0.95);
        sg.fillCircle(pts[kk].x, pts[kk].y, 3.4);
        sg.lineStyle(3.5, ORB_COL, 0.9);
        sg.strokeCircle(pts[kk].x, pts[kk].y, 7.5 + 1.0 * Math.sin(gt * 6 + kk));
      }
    }
  };

  /* ---- Cinematic spawn look: born white-hot from the player, peeling off
         with a motion-stretch, a fading split-plane + tether, gathering
         shards, and the shield orbs assembling over the final third. ---- */
  M._renderMirrorSpawn = function (mir, dt) {
    var gt = this.gameTime;
    var t  = mir.spawnT01 || 0;

    // Decay afterimages (same as the main render).
    for (var gi = 0; gi < mir.ghosts.length; gi++) {
      var gh = mir.ghosts[gi];
      if (!gh.active) continue;
      gh.alpha -= dt * 3.2;
      if (gh.alpha <= 0) { gh.active = false; gh.spr.setVisible(false); }
      else gh.spr.setAlpha(gh.alpha * 0.6);
    }

    // Body: scale eases up (small overshoot), alpha fades in, motion-stretch
    // during the peel, colour resolves white → magenta.
    var grow;
    if (t < 0.72) { var u = t / 0.72;          grow = (u * u * (3 - 2 * u)) * 1.12; }
    else          { var v = (t - 0.72) / 0.28; grow = 1.12 - 0.12 * (v * v * (3 - 2 * v)); }
    var stretch = (t > 0.12 && t < 0.66) ? (1 - t) : 0;   // strongest early in the peel
    var sclX = BASE_SCL * grow * (1 + stretch * 0.9);
    var sclY = BASE_SCL * grow * (1 - stretch * 0.45);
    var alpha = Math.min(1, t / 0.22);
    var bodyCol = (t < 0.42) ? 0xffffff
                : ((Math.sin(gt * Math.PI * 10) > -0.3) ? BODY_COL : 0xffffff);
    var rotA = mir.angle;
    mir._rotA = rotA; mir._sclX = sclX; mir._sclY = sclY;

    mir.spr.setPosition(mir.x, mir.y);
    mir.spr.setRotation(rotA);
    mir.spr.setScale(sclX, sclY);
    mir.spr.setAlpha(alpha);
    mir.spr.setTint(bodyCol);

    mir.glowSpr.setPosition(mir.x, mir.y);
    mir.glowSpr.setRotation(rotA);
    mir.glowSpr.setScale(Math.max(sclX, sclY) * 1.6);
    mir.glowSpr.setAlpha(0.3 * alpha + 0.2 * (1 - t));
    mir.glowSpr.setTint(bodyCol);

    // gfx: tether back to the player + an expanding "mirror plane" + shards.
    var g = mir.gfx;
    g.clear();
    var px = mir.spawnOX, py = mir.spawnOY;

    var tethA = Math.max(0, 0.8 - t);
    if (tethA > 0.02) {
      g.lineStyle(3, BODY_COL, tethA);
      g.lineBetween(px, py, mir.x, mir.y);
      g.lineStyle(1.2, 0xffffff, tethA * 0.7);
      g.lineBetween(px, py, mir.x, mir.y);
    }

    var planeA = Math.max(0, 0.7 - t * 1.1);
    if (planeA > 0.02) {
      var perp = mir.spawnAng + Math.PI / 2;
      var pl   = C.MIR_SIZE * (3 + t * 9);
      g.lineStyle(2.5, 0xffaaff, planeA);
      g.lineBetween(
        px + Math.cos(perp) * pl, py + Math.sin(perp) * pl,
        px - Math.cos(perp) * pl, py - Math.sin(perp) * pl
      );
    }

    // Gathering shards resolving onto the forming rival.
    var shardN = 6;
    for (var s = 0; s < shardN; s++) {
      var ph = ((t * 1.6 + s / shardN) % 1);
      var sr = C.MIR_SIZE * (3.0 * (1 - ph) + 0.5);
      var sa = (TAU / shardN) * s + gt * 2.0;
      var aa = ph * 0.7 * Math.min(1, t * 2);
      g.fillStyle(0xffccf2, aa);
      g.fillCircle(mir.x + Math.cos(sa) * sr, mir.y + Math.sin(sa) * sr, 2.4);
    }

    // Shield orbs assemble over the last third (slide out from the centre).
    var sg = mir.shieldGfx;
    sg.clear();
    var orbT = Math.max(0, (t - 0.6) / 0.4);
    if (orbT > 0) {
      var R = C.MIR_SIZE * 1.9;
      var wardRot = mir.spin * 1.6;
      for (var i2 = 0; i2 < mir.orbsMax; i2++) {
        var ang = wardRot + (TAU / mir.orbsMax) * i2;
        var ox = mir.x + Math.cos(ang) * R * orbT;
        var oy = mir.y + Math.sin(ang) * R * orbT;
        sg.fillStyle(ORB_COL, 0.30 * orbT);
        sg.fillCircle(ox, oy, 11 * orbT);
        sg.fillStyle(0xffffff, 0.95 * orbT);
        sg.fillCircle(ox, oy, 3.4 * orbT);
      }
    }

    // Keep the shard layer clean during the entrance.
    if (mir.shotGfx) mir.shotGfx.clear();
  };

  /* ---- Nova shards: spinning 4-point gradient stars. Live boss shards flash a
         growing white "fuse" ring over the last fifth of their life so the
         imminent blast is readable (parry it or step out). Parried shards switch
         to a brighter violet/white look that pulses as their own fuse runs down. ---- */
  M._renderMirrorShots = function (mir) {
    var g = mir.shotGfx;
    g.clear();
    if (!mir.shots.length) return;
    var gt = this.gameTime;
    var R = C.MIR_SHARD_EXP_RADIUS;
    for (var i = 0; i < mir.shots.length; i++) {
      var s = mir.shots[i];
      var r = 6;

      if (s.reflected) {
        // Player-owned: violet/white, brighter, pulses harder as it nears the pop.
        var rf = 1 - Math.max(0, s.life) / C.MIR_NOVA_REFLECT_LIFE;   // 0→1 over life
        var pr = 1 + 0.35 * Math.max(0, Math.sin(gt * 40)) * rf;
        g.fillStyle(0xaa44ff, 0.32);
        g.fillCircle(s.x, s.y, r * 2.4 * pr);
        g.fillStyle(0xcc88ff, 0.95);
        drawStar4(g, s.x, s.y, r * 1.9 * pr, r * 0.6, s.spin);
        g.fillStyle(0xffffff, 0.95);
        g.fillCircle(s.x, s.y, r * 0.62);
        if (rf > 0.6) {                          // imminent-detonation ring
          g.lineStyle(1.5, 0xffffff, (rf - 0.6) / 0.4 * 0.8);
          g.strokeCircle(s.x, s.y, R * (0.5 + 0.5 * rf));
        }
        continue;
      }

      // Boss shard: spinning gradient star + a fuse warning over the last ~22%.
      var col = gradAt(s.hue + gt * 0.5);
      var fz  = 1 - Math.max(0, s.life) / C.MIR_NOVA_LIFE;            // 0→1 over fuse
      var warn = fz > 0.78 ? (fz - 0.78) / 0.22 : 0;
      var ps = 1 + warn * 0.5 * (0.5 + 0.5 * Math.sin(gt * 36));
      // glow
      g.fillStyle(col, 0.28 + warn * 0.3);
      g.fillCircle(s.x, s.y, r * 2.1 * ps);
      // 4-point shard
      g.fillStyle(col, 0.9);
      drawStar4(g, s.x, s.y, r * 1.7 * ps, r * 0.55, s.spin);
      // white-hot core
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(s.x, s.y, r * 0.5 * ps);
      // fuse warning ring — grows toward the real blast radius as it's about to pop
      if (warn > 0) {
        g.lineStyle(1.2, 0xffffff, warn * 0.7);
        g.strokeCircle(s.x, s.y, R * (0.45 + 0.55 * warn));
      }
    }
  };

})();

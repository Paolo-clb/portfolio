/* ==========================================================================
   Light Again — The Prism of Refraction (Prisme de Réfraction)

   A floating crystalline prism sitting NEUTRAL in the arena. It is TERRAIN / a
   weapon, not an enemy, and it works very differently from the Unstable Core:
   here the PLAYER becomes the projectile.

     1. SPAWN   — once unlocked the map keeps PRISM_MAX (3) of them present, each
                  placed FULLY at random (NO guidance arrow). Using one frees its slot,
                  which returns a fresh prism elsewhere on its OWN 15 s chrono
                  (PRISM_RESPAWN_MS). Two can share the view but never spawn glued.
   • CHAIN    — if the giga-dash hitbox sweeps a still-dormant prism, the ship chains
                  straight INTO it at the merge (any level). The whole chained run banks
                  as one "PRISME ×N" big-score popup. At Lv3 you're additionally owed
                  ONE landing-point follow-up strike; getting intercepted by another
                  prism does NOT spend it — it fires from a later merge (becoming the
                  3rd strike), since the prism couldn't respawn at your landing point.
     2. DORMANT — the crystal turns slowly, refracting a rainbow dispersion fan;
                  a spectral hazard ring marks its trigger zone. Enemies ignore it.
     3. CAPTURE — TOUCH it (any direct contact, no dash-attack required) and the ship
                  is CAUGHT inside: it freezes at the crystal's heart, invulnerable.
     4. CHARGING— a magic cannon winds up: the crystal blazes, a long spectral
                  AIMING LINE tracks the mouse and a 3-way fan is previewed. You are
                  the loaded super-bullet. (Safety auto-fire after PRISM_CHARGE_MAXHOLD.)
     5. STRIKE  — LEFT-CLICK and the ship is hurled out as THREE chromatic ghost
                  arrows in a fan (real ship = centre, red-shifted + blue-shifted
                  phantoms = the flanks). A super dash-attack: faster + farther,
                  ONE-SHOTS every enemy the trio sweeps, and deals a boss 3 dash-
                  attacks. The fan opens then converges...
     6. MERGE   — ...the clones fuse back into the ship at the endpoint, the whole
                  rampage lands as ONE "PRISME" big-score popup, and play resumes.

   Self-contained on this._prism (plain data) + one shared persistent ADD graphics
   layer (created in scene.create, cleared per-frame), mirroring unstable-core.js.
   While the ship is captured (CHARGING) or in flight (STRIKE), scene.update hands
   the ship over to us (the `prismCtl` guard skips the normal accel/integration/wall
   clamp): _tickPrismCharging / _tickPrismStrike own p.x/p.y/p.angle outright. The
   ship is kept p.invincible + p.dashInvinc so it reads as the glowing cyan/gold
   phantom (no i-frame blink) instead of taking damage. The strike rides world time
   (sDt) normally but DEFIES The World at PRISM_TW_SCALE × speed — its kills are
   exempted from the Time-Stop deferral (combat.js `ctx.prism`, like `ctx.core`) so
   every swept enemy dies at once and banks into this._prismScoreAccum.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  /* Spectral palette — a refraction prism splits white light into the rainbow.
     Deliberately multi-hued so the prism never reads as any single-colour system
     (orange core, magenta dash-atk, cyan player, gold The World, green tree…). */
  var SPECTRUM = [0xff2e4d, 0xff7a1e, 0xffe23a, 0x37e05a, 0x2fd9ff, 0x3a6bff, 0xb152ff];
  var SPECTRUM_RGB = [];
  for (var _si = 0; _si < SPECTRUM.length; _si++) {
    var _c = SPECTRUM[_si];
    SPECTRUM_RGB.push([(_c >> 16) & 255, (_c >> 8) & 255, _c & 255]);
  }
  var WHITE    = 0xffffff;
  var ICE      = 0xcde9ff;   // cool white-blue (charged light)
  var TW_GOLD  = 0xffc832;   // The World theme gold
  var TW_GOLD2 = 0xffe06e;
  var CHROMA_C = 0x9ffcff;   // centre arrow aura (the real ship)
  var CHROMA_R = 0xff3a5a;   // red-shifted phantom (chromatic aberration)
  var CHROMA_B = 0x3a86ff;   // blue-shifted phantom

  /* Trace a rotated ship-arrow path (same proportions as the player texture:
     tip +s, wings ±0.55s at -0.6s, inner notch -0.25s). Caller fills/strokes. */
  function arrowPath(g, x, y, s, ang) {
    var ca = Math.cos(ang), sa = Math.sin(ang);
    function px(lx, ly) { return x + lx * ca - ly * sa; }
    function py(lx, ly) { return y + lx * sa + ly * ca; }
    g.beginPath();
    g.moveTo(px(s, 0),            py(s, 0));
    g.lineTo(px(-0.6 * s, -0.55 * s), py(-0.6 * s, -0.55 * s));
    g.lineTo(px(-0.25 * s, 0),    py(-0.25 * s, 0));
    g.lineTo(px(-0.6 * s, 0.55 * s),  py(-0.6 * s, 0.55 * s));
    g.closePath();
  }

  /* Trace a regular n-gon path (caller strokes/fills). */
  function polyPath(g, x, y, r, n, rot) {
    g.beginPath();
    for (var i = 0; i < n; i++) {
      var a = rot + (i / n) * TAU;
      var qx = x + Math.cos(a) * r, qy = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(qx, qy); else g.lineTo(qx, qy);
    }
    g.closePath();
  }

  /* Trace an oriented diamond/shard (long axis rl, short axis rw, rotated ang). */
  function diamondPath(g, cx, cy, rl, rw, ang) {
    var ca = Math.cos(ang), sa = Math.sin(ang);
    function px(lx, ly) { return cx + lx * ca - ly * sa; }
    function py(lx, ly) { return cy + lx * sa + ly * ca; }
    g.beginPath();
    g.moveTo(px(rl, 0),  py(rl, 0));
    g.lineTo(px(0,  rw), py(0,  rw));
    g.lineTo(px(-rl, 0), py(-rl, 0));
    g.lineTo(px(0, -rw), py(0, -rw));
    g.closePath();
  }

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initPrism = function () {
    this._prisms          = [];   // up to PRISM_MAX live prisms (dormant, or the ONE charging/striking)
    this._prismRespawnT   = [];   // one pending-respawn chrono (ms remaining) per freed slot
    this._prismScoreAccum = 0;    // running tally for the ONE active strike (only one can hold the ship)
    this._prismChainScore = 0;    // combined tally across a chained run (one popup at the end)
    this._prismChainCount = 0;    // ...and how many strikes scored, for the "PRISME ×N" read
    this._prismChainActive = false;  // true between strikes of an ongoing chain (so a re-capture doesn't reset the tally)
    this._prismFollowupOwed = false; // Lv3: a landing-point follow-up strike is still owed in this chain

    // One shared persistent ADD layer at depth 27 (above the core/enemies, below
    // the ship at 30 so the real centre arrow always sits on top of its phantoms).
    this._prismGfx = this.add.graphics();
    this._prismGfx.setDepth(27);
    this._prismGfx.setBlendMode(Phaser.BlendModes.ADD);
  };

  /* Drop every live prism + pending slot (graphics persist — just cleared). Also
     un-captures the ship if it was mid-charge/strike when this fires (e.g. a scene
     shutdown). */
  M._clearPrism = function (silent) {
    var p = this.p;
    if (p && p.state === 'PRISM') {
      p.state = 'MOVING';
      p.invincible = false; p.invincTimer = 0; p.dashInvinc = false;
      p.atkAvailable = true; p.dashAvailable = true;
    }
    this._prisms        = [];
    this._prismRespawnT = [];
    if (this._prismGfx) this._prismGfx.clear();
    // Drop any deferred chain tally (its points are already in this.score; only the
    // combined popup is abandoned when the prism is torn down mid-chain).
    this._prismScoreAccum = 0;
    this._prismChainScore = 0; this._prismChainCount = 0;
    this._prismChainActive = false; this._prismFollowupOwed = false;
  };

  /* Pull a spent prism out of the live list. `respawn` queues its slot's individual
     15 s chrono; a BONUS Lv3 landing-point prism occupies no slot, so it never does. */
  M._removePrism = function (pr, respawn) {
    var idx = this._prisms.indexOf(pr);
    if (idx >= 0) this._prisms.splice(idx, 1);
    if (respawn) this._prismRespawnT.push(C.PRISM_RESPAWN_MS);
  };

  /* The single prism currently holding the ship (CHARGING or STRIKE), or null. Only
     one can ever own the ship at a time, so the strike scoring stays a scene global. */
  M._activePrism = function () {
    if (!this._prisms) return null;
    for (var i = 0; i < this._prisms.length; i++) {
      var ph = this._prisms[i].phase;
      if (ph === 'CHARGING' || ph === 'STRIKE') return this._prisms[i];
    }
    return null;
  };

  /* True while a prism owns the ship — scene.update hands p.x/p.y to prism.js then. */
  M._prismControllingShip = function () { return !!this._activePrism(); };

  /* The prism currently CHARGING (winding up), or null — the launch target. */
  M._chargingPrism = function () {
    if (!this._prisms) return null;
    for (var i = 0; i < this._prisms.length; i++) {
      if (this._prisms[i].phase === 'CHARGING') return this._prisms[i];
    }
    return null;
  };

  /* ================================================================
     SPAWN GATE — never pop in during curated / confined states. NOT blocked by
     The World (an existing prism stays usable). The anomaly confines the player,
     so capture is blocked while it's around (mirrors the core's suspension).
     ================================================================ */
  M._prismSpawnSuspended = function () {
    return !!(this._tutorialActive || this._upSlowMoPhase || this._bossDraftPending ||
              this._upgradeDraftOpen || this._anomaly || this._anomalyBarrierActive ||
              this._anomalyIntroActive || !this.p || this.p.state === 'DEAD');
  };

  // The Prism is now an UPGRADE: it only exists on the map once its branch has been
  // drafted (Lv1+). Mode-independent — purely the upgrade level.
  M._prismUnlocked = function () {
    return !!(this._upgradeLevels && this._upgradeLevels.prism > 0);
  };

  /* Keep the map populated with PRISM_MAX prisms. Each freed slot runs its OWN 15 s
     chrono; a Lv3 landing-point BONUS prism is extra (pr.bonus) and never counts
     toward the slot cap. Chronos keep counting even while spawns are SUSPENDED. */
  M._tickPrismPopulation = function (dt, suspended) {
    if (!this._prismUnlocked()) {                 // locked → no prisms, no pending slots
      if (this._prismRespawnT.length) this._prismRespawnT.length = 0;
      return;
    }
    var liveSlots = 0;
    for (var s = 0; s < this._prisms.length; s++) if (!this._prisms[s].bonus) liveSlots++;
    var deficit = C.PRISM_MAX - liveSlots - this._prismRespawnT.length;
    for (var d = 0; d < deficit; d++) this._prismRespawnT.push(0);   // due immediately on first unlock

    var ms = dt * 1000;
    for (var i = this._prismRespawnT.length - 1; i >= 0; i--) {
      this._prismRespawnT[i] -= ms;
      if (this._prismRespawnT[i] > 0) continue;
      if (suspended) { this._prismRespawnT[i] = 0; continue; }
      if (this._spawnPrism({})) this._prismRespawnT.splice(i, 1);   // placed → consume the slot
      else this._prismRespawnT[i] = 0;                              // no clear spot this frame → retry next
    }
  };

  /* Place a dormant prism UNIFORMLY at random across the whole disc (not anchored
     to the player — "vraiment aléatoirement dans toute la map"), only re-rolling to
     keep it off the player and clear of the other live map features. */
  M._spawnPrism = function (opts) {
    opts = opts || {};
    if (!opts.at && this._prisms.length >= C.PRISM_MAX) return false;   // bonus (at) is allowed past the cap
    if (!this.p || this.p.state === 'DEAD') return false;

    var lvl   = (this._upgradeLevels && this._upgradeLevels.prism) || 1;
    var inset = C.PRISM_RADIUS + C.PRISM_SPAWN_MARGIN;
    var sep2  = C.MAP_FEATURE_MIN_SEP * C.MAP_FEATURE_MIN_SEP;
    var minP2 = C.PRISM_MIN_PLAYER_DIST * C.PRISM_MIN_PLAYER_DIST;
    var avoid = [this._fount, this._tree, this._cache, this._greed];   // optional refs (may be null)
    for (var ci = 0; this._cores && ci < this._cores.length; ci++) avoid.push(this._cores[ci]);   // generic gap vs cores
    var x, y, tries = 0, ok;

    if (opts.at) {
      // Lv3 CHAIN: rematerialise EXACTLY at the giga-dash landing point (clamped
      // in-bounds), so you arrive on it and can immediately fire again.
      var atc = LA.clampDisc(opts.at.x, opts.at.y, inset);
      x = atc.x; y = atc.y;
    } else if (opts.near) {
      // Debug spawn: drop it a short hop from the player so it's instantly testable.
      var na = Math.random() * TAU, nd = 320 + Math.random() * 260;
      var nc = LA.clampDisc(this.p.x + Math.cos(na) * nd, this.p.y + Math.sin(na) * nd, inset);
      x = nc.x; y = nc.y;
    } else {
      do {
        var pt = LA.randInDisc(inset);
        x = pt.x; y = pt.y;
        ok = true;
        var pdx = x - this.p.x, pdy = y - this.p.y;
        if (pdx * pdx + pdy * pdy < minP2) { ok = false; }
        if (ok) {
          for (var ai = 0; ai < avoid.length; ai++) {
            var av = avoid[ai];
            if (av && (x - av.x) * (x - av.x) + (y - av.y) * (y - av.y) < sep2) { ok = false; break; }
          }
        }
        // Never let two prisms spawn glued: keep their trigger zones apart by
        // PRISM_SELF_GAP (small enough that two can still share the player's view).
        if (ok) {
          var selfSep = C.PRISM_TRIGGER_R * 2 + C.PRISM_SELF_GAP;
          for (var qi = 0; qi < this._prisms.length; qi++) {
            var op = this._prisms[qi];
            if ((x - op.x) * (x - op.x) + (y - op.y) * (y - op.y) < selfSep * selfSep) { ok = false; break; }
          }
        }
        // Never surface the prism on a live Data Highway band (reciprocal of the
        // highway's own avoidance — the two must never overlap).
        if (ok && !this._pointClearsHighways(x, y, C.PRISM_TRIGGER_R)) ok = false;
        tries++;
      } while (!ok && tries < 40);
      if (!ok) return false;   // no clear spot this frame → the slot retries next tick
    }

    var pr = {
      x: x, y: y,
      phase: 'DORMANT',
      age: 0,
      spin: Math.random() * TAU,
      pulse: Math.random() * TAU,
      seed: Math.random() * 1000,
      dispAng: Math.random() * TAU,        // dispersion-fan base heading
      // per-level strike tuning (locked in at spawn; the dormant/charging preview reflects it too)
      strikeDist: C.PRISM_DIST_BY_LVL[lvl],
      fanLateral: C.PRISM_FAN_BY_LVL[lvl],
      killR:      C.PRISM_KILL_BY_LVL[lvl],
      lvl:        lvl,                     // upgrade level — drives the empowered L2+ look/FX
      chained:    !!opts.at,               // a landing-point prism is itself the Lv3 follow-up → it owes none of its own
      bonus:      !!opts.at,               // ...and it's a BONUS prism: occupies no slot, no respawn chrono when spent
      interceptPrism: null,                // a dormant prism this strike's hitbox swept (→ chain into it at merge)
      // charging
      chargeT: 0, hold: 0, aimAng: 0,
      // strike
      origX: 0, origY: 0, dist: 0, travelled: 0, t: 0, perpX: 0, perpY: 0,
      arrows: [], bossHit: [],
    };
    this._prisms.push(pr);
    this._prismScoreAccum = 0;

    // Arrival flourish — a clean white flash splitting into a spectral ring.
    this._spawnWaveRing(x, y, { maxRadius: 150, color: SPECTRUM[4], expandTime: 0.42 });
    this._spawnWaveRing(x, y, { maxRadius: 88,  color: WHITE,       expandTime: 0.30 });
    this._explode(x, y, [225, 240, 255], 18);
    for (var k = 0; k < SPECTRUM_RGB.length; k++) this._explode(x, y, SPECTRUM_RGB[k], 5);
    return pr;
  };

  /* ================================================================
     UPDATE — spawn gate, tick the live prism, render. Called from update() with
     dt = real seconds, sDt = WORLD seconds (frozen during The World / hitstop).
     ================================================================ */
  M._updatePrism = function (dt, sDt) {
    this._tickPrismPopulation(dt, this._prismSpawnSuspended());

    // Tick every live prism. Only one can ever be CHARGING/STRIKE (it owns the ship);
    // the rest breathe as DORMANT and stay eligible for a strike's interception chain.
    // Snapshot via index — a merge may splice the active prism out mid-loop, so guard.
    for (var i = this._prisms.length - 1; i >= 0; i--) {
      var pr = this._prisms[i];
      if (!pr) continue;
      if      (pr.phase === 'DORMANT')  this._tickPrismDormant(pr, dt);
      else if (pr.phase === 'CHARGING') this._tickPrismCharging(pr, dt);
      else if (pr.phase === 'STRIKE')   this._tickPrismStrike(pr, dt, sDt);
    }
    this._renderPrism(dt);
  };

  /* DORMANT: breathe, refract, and watch for the ship touching the field. */
  M._tickPrismDormant = function (pr, dt) {
    var p = this.p;
    pr.spin    += dt * 0.6;
    pr.pulse   += dt;
    pr.dispAng += dt * 0.28;
    pr.age     += dt * 1000;

    // CAPTURE: ANY direct contact catches the ship now (no dash-attack required) —
    // just touch the crystal. Only skip when already caught or dead.
    if (p && p.state !== 'PRISM' && p.state !== 'DEAD') {
      var dx = pr.x - p.x, dy = pr.y - p.y;
      var reach = C.PRISM_TRIGGER_R + C.SIZE * 0.6 + C.PRISM_TRIGGER_PAD;
      if (dx * dx + dy * dy < reach * reach) { this._prismCapture(pr); }
    }
    // No wither: the prism is a persistent fixture — it only leaves when USED.
  };

  /* ================================================================
     CAPTURE → CHARGING — the ship is caught inside; the cannon winds up.
     ================================================================ */
  M._prismCapture = function (pr) {
    var p   = this.p;
    var cam = this.cameras.main;

    // Chain bookkeeping. A capture that BEGINS a fresh run (no chain in flight) resets
    // the combined tally and arms the Lv3 owed follow-up. A capture that CONTINUES a
    // chain (the landing-point bonus prism, or an interception re-capture, both of
    // which pre-set _prismChainActive) keeps the running tally + the owed follow-up.
    if (!this._prismChainActive) {
      this._prismChainScore = 0; this._prismChainCount = 0;
      this._prismFollowupOwed = !!(this._upgradeLevels && this._upgradeLevels.prism >= 3);
    }

    var aim = Math.atan2((this._mouseY + cam.scrollY) - pr.y, (this._mouseX + cam.scrollX) - pr.x);

    pr.phase   = 'CHARGING';
    pr.interceptPrism = null;
    pr.chargeT = 0;
    pr.hold    = 0;
    pr.aimAng  = aim;

    // Snap the ship to the crystal's heart and freeze it there, invulnerable. The
    // dashInvinc flag makes _renderPlayer draw the glowing cyan phantom (no i-frame
    // blink) — exactly the "you are the loaded super-bullet" read.
    p.x = pr.x; p.y = pr.y; p.vx = 0; p.vy = 0;
    p.state = 'PRISM';
    p.hasHitDuringDashAttack = true;          // if caught mid-dash-attack → no whiff punish
    p.invincible = true; p.invincTimer = 999999; p.dashInvinc = true;
    p.spinAngle = 0; p.angle = aim;

    // Capture juice — a hard white implosion fracturing into the spectrum.
    this._explode(pr.x, pr.y, [225, 245, 255], 30);
    for (var k = 0; k < SPECTRUM_RGB.length; k++) this._explode(pr.x, pr.y, SPECTRUM_RGB[k], 8);
    this._spawnWaveRing(pr.x, pr.y, { maxRadius: 175, color: WHITE,       expandTime: 0.32 });
    this._spawnWaveRing(pr.x, pr.y, { maxRadius: 110, color: SPECTRUM[5], expandTime: 0.26 });
    this.cameras.main.flash(150, 215, 238, 255);
    this.cameras.main.shake(150, 0.012);
    this._triggerHitstop(80);
    this._floatLabel(pr.x, pr.y - C.PRISM_TRIGGER_R - 10, 'PRISME CHARGÉ', '#bfe9ff');
  };

  /* CHARGING: hold the ship, blaze the crystal, track the mouse. Real dt (the
     charge animation must keep flowing even while the world ticks around it). */
  M._tickPrismCharging = function (pr, dt) {
    var p   = this.p;
    var cam = this.cameras.main;

    // Pin the ship at the crystal heart, keep it invulnerable + glowing.
    p.x = pr.x; p.y = pr.y; p.vx = 0; p.vy = 0;
    p.invincible = true; p.invincTimer = 999999; p.dashInvinc = true;

    pr.spin    += dt * 2.6;     // spins UP while charging
    pr.pulse   += dt;
    pr.dispAng += dt * 0.6;
    pr.chargeT += dt * 1000;
    pr.hold    += dt * 1000;

    // Live aim toward the mouse (the big aiming line tracks the cursor).
    var aim = Math.atan2((this._mouseY + cam.scrollY) - pr.y, (this._mouseX + cam.scrollX) - pr.x);
    pr.aimAng = aim;
    p.angle   = aim;

    // Safety: never an indefinite invulnerable hold inside the prism.
    if (pr.hold >= C.PRISM_CHARGE_MAXHOLD) this._prismLaunch();
  };

  /* ================================================================
     LAUNCH — fired by a left-click (player.js intercept) or the safety auto-fire.
     ================================================================ */
  M._prismLaunch = function () {
    var pr = this._chargingPrism();
    if (!pr) return;
    var p   = this.p;
    var cam = this.cameras.main;
    var aim = Math.atan2((this._mouseY + cam.scrollY) - pr.y, (this._mouseX + cam.scrollX) - pr.x);
    var ax  = Math.cos(aim), ay = Math.sin(aim);

    // Travel the FULL budget ("plus loin"); it stays in-bounds by BOUNCING off the
    // map disc + the Anomaly firewall (like a dash-attack / torpedo), not by capping.
    pr.phase     = 'STRIKE';
    pr.origX     = pr.x; pr.origY = pr.y;
    pr.cx        = pr.x; pr.cy   = pr.y;     // live centre of the fan (bounces)
    pr.dirX      = ax;   pr.dirY = ay;       // live heading (reflects at boundaries)
    pr.aimAng    = aim;  pr.dist = pr.strikeDist;
    pr.travelled = 0;    pr.t    = 0;
    pr.bossHit   = [];   pr.snakeHit = [];
    // Three arrows, coincident at the origin: centre (real ship) + two chromatic
    // phantoms that bloom out to ±FAN_LATERAL and converge again at the endpoint.
    pr.arrows = [
      { side:  0, x: pr.x, y: pr.y, px: pr.x, py: pr.y, ang: aim, col: CHROMA_C, trail: [] },
      { side:  1, x: pr.x, y: pr.y, px: pr.x, py: pr.y, ang: aim, col: CHROMA_R, trail: [] },
      { side: -1, x: pr.x, y: pr.y, px: pr.x, py: pr.y, ang: aim, col: CHROMA_B, trail: [] },
    ];
    this._prismScoreAccum = 0;

    // The crystal bursts and the ship becomes the bolt — big launch juice.
    // L2+ erupts harder: more shards, a wider spectral burst + an extra ring.
    var hi = pr.lvl >= 2;
    this._explode(pr.x, pr.y, [255, 255, 255], hi ? 66 : 46);
    for (var k = 0; k < SPECTRUM_RGB.length; k++) this._explode(pr.x, pr.y, SPECTRUM_RGB[k], hi ? 22 : 14);
    this._spawnWaveRing(pr.x, pr.y, { maxRadius: hi ? 300 : 240, color: WHITE,       expandTime: hi ? 0.40 : 0.36 });
    this._spawnWaveRing(pr.x, pr.y, { maxRadius: hi ? 190 : 150, color: SPECTRUM[4], expandTime: 0.30 });
    if (hi) this._spawnWaveRing(pr.x, pr.y, { maxRadius: 240, color: SPECTRUM[5], expandTime: 0.34 });
    this.cameras.main.flash(hi ? 210 : 180, 238, 248, 255);
    this.cameras.main.shake(hi ? 260 : 220, hi ? 0.022 : 0.018);
    this._triggerHitstop(hi ? 110 : 90);

    // The ship rides the centre arrow — stays PRISM (prismCtl) + invulnerable glow.
    p.state = 'PRISM';
    p.invincible = true; p.invincTimer = 999999; p.dashInvinc = true;
    p.angle = aim;
  };

  /* Greatest distance from (x,y) heading (ax,ay) that stays within the disc (minus
     the ship's wall margin). Solves |(x,y) + t(ax,ay)| = lim for the positive root. */
  M._prismMaxDist = function (x, y, ax, ay) {
    var lim = C.WORLD_HALF - C.SIZE * 1.5;
    var b   = x * ax + y * ay;
    var cc  = x * x + y * y - lim * lim;
    var disc = b * b - cc;
    if (disc <= 0) return 0;
    return Math.max(0, -b + Math.sqrt(disc));
  };

  /* ================================================================
     STRIKE — drive the 3-arrow fan, one-shot everything it sweeps, hit bosses.
     Spin/trail on real dt; the advance rides world time (sDt) but DEFIES The World
     at PRISM_TW_SCALE × speed (its kills resolve at once — combat.js ctx.prism).
     ================================================================ */
  M._tickPrismStrike = function (pr, dt, sDt) {
    var p = this.p;
    // Keep the ship glowing + invulnerable as it flies.
    p.invincible = true; p.invincTimer = 999999; p.dashInvinc = true;
    pr.pulse += dt;

    var stepDt = this._twActive ? (dt * C.PRISM_TW_SCALE) : sDt;
    var step60 = stepDt * 60;
    var moving = step60 > 0.0001;                 // genuinely paused (hitstop/draft)?
    if (moving) {
      this._prismAdvance(pr, C.PRISM_STRIKE_SPEED * step60);   // move the centre, bouncing off boundaries
      pr.travelled += C.PRISM_STRIKE_SPEED * step60;
    }

    var t = pr.dist > 0 ? Math.min(1, pr.travelled / pr.dist) : 1;
    pr.t = t;

    var lateral = Math.sin(t * Math.PI) * pr.fanLateral;   // 0 → peak → 0 (open then merge)
    var perpX = -pr.dirY, perpY = pr.dirX;                       // perpendicular to the LIVE heading

    for (var i = 0; i < pr.arrows.length; i++) {
      var a = pr.arrows[i];
      a.px = a.x; a.py = a.y;
      var off = a.side * lateral;
      a.x = pr.cx + perpX * off;
      a.y = pr.cy + perpY * off;
      var mvx = a.x - a.px, mvy = a.y - a.py;
      a.ang = (mvx * mvx + mvy * mvy > 1) ? Math.atan2(mvy, mvx) : Math.atan2(pr.dirY, pr.dirX);
      // Blazing chromatic streak (fades on real dt so it stays smooth through slow-mo).
      a.trail.push({ x: a.x, y: a.y, a: 1 });
      if (a.trail.length > 16) a.trail.shift();
      for (var k = 0; k < a.trail.length; k++) a.trail[k].a -= dt * 3.0;
    }

    // The real ship is the centre arrow.
    var c0 = pr.arrows[0];
    p.x = c0.x; p.y = c0.y; p.angle = c0.ang;
    p.vx = pr.dirX * C.PRISM_STRIKE_SPEED; p.vy = pr.dirY * C.PRISM_STRIKE_SPEED;   // cosmetic (movement is positional)

    // One-shot sweep + boss hits (only when actually advancing).
    if (moving) this._prismStrikeContact(pr);

    // Spectral embers off the centre.
    if (Math.random() < 0.7) {
      this._explode(pr.cx - pr.dirX * 6, pr.cy - pr.dirY * 6, SPECTRUM_RGB[(Math.floor(pr.pulse * 22)) % SPECTRUM_RGB.length], 3);
    }

    if (t >= 1) this._prismMerge(pr);
  };

  /* Advance the fan centre by `step` along the live heading, REFLECTING off the map
     disc and (when up) the Anomaly firewall — same boundaries the dash-attack /
     torpedo bounce off. Per-frame clamp-and-reflect (the step is small vs. the
     radii, so the snap is invisible), mirroring the player wall-bounce model. */
  M._prismAdvance = function (pr, step) {
    pr.cx += pr.dirX * step;
    pr.cy += pr.dirY * step;
    this._prismClampReflect(pr, 0, 0, C.WORLD_HALF - C.SIZE * 1.5);        // map disc
    var a = this._anomaly;
    if (a && this._anomalyBarrierActive && a.phase === 'BARRIER' && !a.dead) {
      this._prismClampReflect(pr, a.bx, a.by, a.R - C.SIZE * 1.4);          // Anomaly firewall
    }
  };

  /* Keep the centre inside the circle (cx,cy,lim); on contact, snap to the rim and
     mirror the heading about the boundary normal (with a little ricochet spark). */
  M._prismClampReflect = function (pr, cx, cy, lim) {
    var dx = pr.cx - cx, dy = pr.cy - cy;
    var d2 = dx * dx + dy * dy;
    if (d2 <= lim * lim) return;
    var d = Math.sqrt(d2) || 1;
    var nx = dx / d, ny = dy / d;                 // outward normal
    pr.cx = cx + nx * lim; pr.cy = cy + ny * lim;
    var dot = pr.dirX * nx + pr.dirY * ny;
    if (dot > 0) {
      pr.dirX -= 2 * dot * nx; pr.dirY -= 2 * dot * ny;   // reflect heading
      this._prismBounceFx(pr.cx, pr.cy);
    }
  };

  M._prismBounceFx = function (x, y) {
    this._spawnWaveRing(x, y, { maxRadius: 90, color: WHITE, expandTime: 0.22 });
    for (var k = 0; k < SPECTRUM_RGB.length; k++) this._explode(x, y, SPECTRUM_RGB[k], 3);
    this.cameras.main.shake(80, 0.008);
  };

  /* Kill every enemy within PRISM_KILL_R of ANY of the 3 arrows (step < radius, so
     no tunnelling), then deal bosses their 3-dash-attack hit. */
  M._prismStrikeContact = function (pr) {
    var enemies = this.enemies, kr = pr.killR * (this._blastMult || 1);   // cursedBlast curse
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (e._spawnAnimT != null && e._spawnAnimT < 1) continue;   // still materialising → leave it
      if (e._snIntangible) continue;   // cloaked sniper — the strike passes through it
      var hit = false;
      for (var j = 0; j < pr.arrows.length; j++) {
        var a = pr.arrows[j];
        var rr = kr + e.size * 0.5;
        var dx = e.x - a.x, dy = e.y - a.y;
        if (dx * dx + dy * dy < rr * rr) { hit = true; break; }
      }
      if (hit) this._killEnemy(i, { prism: true });   // one-shots ALL tiers (ignores shields)
    }
    this._prismHitBosses(pr);
    this._prismDetectIntercept(pr);
  };

  /* While the giga-dash sweeps, watch for the FIRST still-dormant prism any arrow
     passes through. We don't capture mid-flight (that would cut the strike short) —
     we just remember it (pr.interceptPrism), then chain INTO it at the merge. One
     interception per strike; further prisms the strike grazes stay on the map. */
  M._prismDetectIntercept = function (pr) {
    if (pr.interceptPrism) return;                 // already locked one this strike
    var reach = C.PRISM_TRIGGER_R, r2 = reach * reach;
    for (var i = 0; i < this._prisms.length; i++) {
      var o = this._prisms[i];
      if (o === pr || o.phase !== 'DORMANT') continue;
      for (var j = 0; j < pr.arrows.length; j++) {
        var a = pr.arrows[j];
        var dx = o.x - a.x, dy = o.y - a.y;
        if (dx * dx + dy * dy < r2) {
          pr.interceptPrism = o;
          // A bright spectral ping on the prism we'll chain into.
          this._spawnWaveRing(o.x, o.y, { maxRadius: C.PRISM_TRIGGER_R * 1.7, color: WHITE,       expandTime: 0.30 });
          this._spawnWaveRing(o.x, o.y, { maxRadius: C.PRISM_TRIGGER_R * 1.1, color: SPECTRUM[4], expandTime: 0.24 });
          return;
        }
      }
    }
  };

  /* Bosses live OUTSIDE this.enemies — damage them through their own entry points. */
  M._prismHitBosses = function (pr) {
    this._prismCarveSnake(pr);   // serpent(s): carve like a single dash-attack (no one-shot)
    // Single-body bosses (a team can field several giga / mirror): a one-time hit
    // per INSTANCE as an arrow passes through it. Point the cursor at each so its
    // native damage handler (_breakGigaShield / _damageMirror) acts on the right one.
    var GL = this._gigaList;
    if (GL) for (var gi = 0; gi < GL.length; gi++) { this._gigaBruiser = GL[gi]; this._prismMaybeHitBody('giga', GL[gi], C.GBR_SIZE, pr); }
    var ML = this._mirrorList;
    if (ML) for (var mi = 0; mi < ML.length; mi++) { this._mirror = ML[mi]; this._prismMaybeHitBody('mirror', ML[mi], C.MIR_SIZE, pr); }
    this._prismMaybeHitBody('anomaly', this._anomaly, C.ANO_SIZE, pr);
  };

  /* Serpent(s): carve every body segment the trio physically sweeps, but ONCE per
     strike (pr.snakeHit) and only by SNAKE_DASH_DMG each — exactly one dash-attack's
     worth, so a long strike chips the snake instead of one-shotting it. */
  M._prismCarveSnake = function (pr) {
    var SL = this._snakeList;
    if (!SL || !SL.length || !this._damageSnakeSegment) return;
    var reach = pr.killR * (this._blastMult || 1) + 20, r2 = reach * reach;   // cursedBlast curse
    for (var sIdx = 0; sIdx < SL.length; sIdx++) {
      var s = SL[sIdx];
      if (!s || s.dead || s.spawnPhase === 'EMERGE') continue;
      this._snake = s;
      var hits = [];
      for (var i = 0; i < s.worms.length; i++) {
        var segs = s.worms[i].segs;
        for (var j = 0; j < segs.length; j++) {
          var sg = segs[j];
          if (sg._dead || pr.snakeHit.indexOf(sg) >= 0) continue;   // segs are unique objects across worms/snakes
          for (var k = 0; k < pr.arrows.length; k++) {
            var a = pr.arrows[k];
            var dx = sg.x - a.x, dy = sg.y - a.y;
            if (dx * dx + dy * dy < r2) { hits.push(sg); break; }
          }
        }
      }
      // Apply after collecting (damage can split/mutate the worm arrays).
      for (var h = 0; h < hits.length; h++) {
        if (!this._snake || this._snake.dead) break;
        pr.snakeHit.push(hits[h]);
        this._damageSnakeSegment(hits[h], C.SNAKE_DASH_DMG, { explosion: true });
      }
    }
  };

  M._prismMaybeHitBody = function (key, b, size, pr) {
    if (!b || b.dead) return;
    if (pr.bossHit.indexOf(b) >= 0) return;   // dedup per INSTANCE (duplicates share a key)
    var reach = (size || 60) + C.PRISM_BOSS_REACH;
    var near = false;
    for (var j = 0; j < pr.arrows.length; j++) {
      var a = pr.arrows[j];
      var dx = b.x - a.x, dy = b.y - a.y;
      if (dx * dx + dy * dy < reach * reach) { near = true; break; }
    }
    if (!near) return;
    pr.bossHit.push(b);
    this._prismDealTriple(key, b);
  };

  /* Apply each boss's per-hit damage through its native damage model. */
  M._prismDealTriple = function (key, b) {
    if (key === 'giga') {
      // 1 dash would break the shield; the other 2 chip the body. Unshielded → full 3×.
      if (b.shielded) {
        this._breakGigaShield();
        if (this._gigaBruiser && !this._gigaBruiser.shielded) this._damageGigaBruiser(C.GBR_DASH_DMG * 2);
      } else {
        this._damageGigaBruiser(C.GBR_DASH_DMG * 3);
      }
    } else if (key === 'mirror') {
      // Exactly ONE strike — like a torpedo / dash-attack: removes a single shield
      // orb (or lands the finishing blow if it had none). No instakill-from-full.
      this._damageMirror(1);
    } else if (key === 'anomaly') {
      // Only vulnerable while its barrier is down (BARRIER phase). 3 dash = 6 HP.
      var a = this._anomaly;
      if (a && !a.dead && a.phase === 'BARRIER' && !a.shielded) {
        a.hp -= 6;
        a._hitFlash = 1.0;
        this._explode(a.x, a.y, [255, 60, 60], 18);
        this._explode(a.x, a.y, [255, 255, 255], 8);
        this.cameras.main.shake(70, 0.008);
        if (a.hp <= 0) this._killAnomaly();
      }
    }
  };

  /* ================================================================
     MERGE — the clones fuse back into the ship; the rampage banks as one popup.
     ================================================================ */
  M._prismMerge = function (pr) {
    var p  = this.p;
    var ex = p.x, ey = p.y;
    var lvl = (this._upgradeLevels && this._upgradeLevels.prism) || 1;

    // Bank THIS strike's tally into the running chain total + count. The combined
    // "PRISME ×N" popup only floats once — when the chain finally ends — so an early
    // strike's points aren't buried under the next strike's spectacle.
    if (this._prismScoreAccum > 0) {
      this._prismChainScore = (this._prismChainScore || 0) + this._prismScoreAccum;
      this._prismChainCount = (this._prismChainCount || 0) + 1;
    }
    this._prismScoreAccum = 0;

    // Merge spectacle — a white re-fusion bursting back into the spectrum.
    this._spawnWaveRing(ex, ey, { maxRadius: 260, color: WHITE,       expandTime: 0.50 });
    this._spawnWaveRing(ex, ey, { maxRadius: 168, color: SPECTRUM[4], expandTime: 0.42 });
    for (var k = 0; k < SPECTRUM_RGB.length; k++) this._explode(ex, ey, SPECTRUM_RGB[k], 14);
    this._explode(ex, ey, [255, 255, 255], 40);
    this.cameras.main.flash(220, 238, 248, 255);
    this.cameras.main.shake(300, 0.02);
    this._triggerHitstop(C.DETONATION_HITSTOP);

    // Hand the ship back, gliding along its FINAL heading (post-bounces), with a
    // brief landing grace. (A continuation below immediately re-captures it.)
    p.state = 'MOVING';
    p.vx = (pr.dirX || Math.cos(pr.aimAng)) * 6; p.vy = (pr.dirY || Math.sin(pr.aimAng)) * 6;
    p.invincible = true; p.invincTimer = 420; p.dashInvinc = true; p.dashCoyote = false;
    p.atkAvailable = true; p.atkCooldown = 0;
    p.dashAvailable = true; p.dashCooldown = 0;
    p.hasHitDuringDashAttack = false; p.spinAngle = 0;

    // Clear any straggler that wandered onto the landing spot after the sweep.
    if (this._safeBubblePush) this._safeBubblePush(p, 280);

    // The fired prism leaves. A BONUS landing-point prism occupied no slot → no
    // respawn chrono; a real slot prism frees its slot for the 15 s chrono.
    this._removePrism(pr, !pr.bonus);

    // ---- Continuation, in priority order ----
    // 1) INTERCEPTION: the giga-dash swept a still-dormant prism → chain straight into
    //    it (capture the ship there). This does NOT consume the Lv3 owed follow-up:
    //    you were "intercepted", so your guaranteed landing follow-up is preserved and
    //    will fire from a LATER merge (becoming the third strike).
    var intercept = pr.interceptPrism;
    if (intercept && intercept.phase === 'DORMANT' && this._prisms.indexOf(intercept) >= 0) {
      this._prismChainActive = true;
      this._prismCapture(intercept);   // snaps the ship onto it + winds the cannon back up
      return;
    }

    // 2) Lv3 LANDING FOLLOW-UP still owed: drop a BONUS prism RIGHT at the landing
    //    point — you arrive on it and chain into one more giga-dash. Consume the owed
    //    follow-up (cap = exactly one landing follow-up per chain).
    if (lvl >= 3 && this._prismFollowupOwed) {
      this._prismFollowupOwed = false;
      this._prismChainActive = true;
      this._spawnPrism({ at: { x: ex, y: ey } });   // bonus + chained; player captures it next frames
      return;
    }

    // 3) CHAIN ENDS → flush the combined popup and reset the chain state.
    if (this._prismChainScore > 0) {
      this._floatScoreBig('PRISME', this._prismChainScore,
        this._prismChainCount > 1 ? { count: this._prismChainCount } : null);
    }
    this._prismChainScore = 0; this._prismChainCount = 0;
    this._prismChainActive = false; this._prismFollowupOwed = false;
  };

  /* ================================================================
     RENDER — one shared ADD layer; view-culled for the dormant/charging looks
     (the strike spans the map, so it always draws).
     ================================================================ */
  M._renderPrism = function (dt) {
    var g = this._prismGfx;
    if (!g) return;
    g.clear();
    if (!this._prisms || !this._prisms.length) return;

    var view = this.cameras.main.worldView;
    var pad  = C.PRISM_TRIGGER_R + 140;
    for (var i = 0; i < this._prisms.length; i++) {
      var pr = this._prisms[i];
      // The strike spans the map, so it always draws; dormant/charging are view-culled.
      if (pr.phase === 'STRIKE') { this._renderPrismStrike(g, pr); continue; }
      if (pr.x < view.x - pad || pr.x > view.right + pad ||
          pr.y < view.y - pad || pr.y > view.bottom + pad) continue;
      if (pr.phase === 'CHARGING') this._renderPrismCharging(g, pr);
      else                         this._renderPrismDormant(g, pr);
    }
  };

  /* The dispersion fan: a single white ray entering the crystal and a rainbow
     splaying out the far side — the prism's signature "refraction". */
  M._drawPrismDispersion = function (g, x, y, r, baseAng, A) {
    // Incoming white beam (from behind the output side).
    var iax = Math.cos(baseAng + Math.PI), iay = Math.sin(baseAng + Math.PI);
    g.lineStyle(2.4, WHITE, 0.18 * A);
    g.beginPath();
    g.moveTo(x + iax * r * 2.6, y + iay * r * 2.6);
    g.lineTo(x + iax * r * 0.7, y + iay * r * 0.7);
    g.strokePath();
    // Outgoing rainbow, fanned ±26° across the spectrum.
    var spread = 0.92;     // total fan width (rad)
    var n = SPECTRUM.length;
    for (var i = 0; i < n; i++) {
      var fa  = baseAng - spread * 0.5 + (i / (n - 1)) * spread;
      var len = r * (2.0 + 0.5 * Math.sin(this.gameTime * 1.4 + i));
      g.lineStyle(2.2, SPECTRUM[i], 0.16 * A);
      g.beginPath();
      g.moveTo(x + Math.cos(baseAng) * r * 0.5, y + Math.sin(baseAng) * r * 0.5);
      g.lineTo(x + Math.cos(fa) * len, y + Math.sin(fa) * len);
      g.strokePath();
    }
  };

  /* The crystal: an upright hexagonal bipyramid (a faceted gem) whose girdle ring
     turns to read as a slow 3-D spin, facets washed in cycling spectral light.
     energy 0 (dormant) → 1 (fully charged) brightens + super-charges it. */
  M._drawPrismCrystal = function (g, x, y, r, spin, pulse, A, energy) {
    var glow = 0.6 + 0.4 * Math.sin(pulse * 3);
    // Halo.
    g.fillStyle(WHITE, (0.06 + 0.10 * energy) * A * glow); g.fillCircle(x, y, r * (1.7 + 0.5 * energy));
    g.fillStyle(SPECTRUM[4], 0.06 * A);                    g.fillCircle(x, y, r * 1.35);

    var topY = y - r * 1.3, botY = y + r * 1.3;
    // Girdle ring (squashed ellipse → fake perspective).
    var gp = [];
    for (var k = 0; k < 6; k++) {
      var a = spin + (k / 6) * TAU;
      gp.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.34, d: Math.sin(a) });
    }
    // Facets: upper apex → girdle edge, lower apex → girdle edge. Front (d>0) brighter.
    for (var i = 0; i < 6; i++) {
      var g0 = gp[i], g1 = gp[(i + 1) % 6];
      var depth = (g0.d + g1.d) * 0.5;                  // -1 back … +1 front
      var face  = 0.18 + 0.32 * (depth * 0.5 + 0.5);    // back dim, front bright
      var col   = SPECTRUM[(i + Math.floor(pulse * 1.5)) % SPECTRUM.length];
      // upper facet
      g.fillStyle(col, face * (0.5 + 0.5 * energy) * A);
      g.beginPath(); g.moveTo(x, topY); g.lineTo(g0.x, g0.y); g.lineTo(g1.x, g1.y); g.closePath(); g.fillPath();
      // lower facet
      g.fillStyle(col, face * 0.8 * (0.5 + 0.5 * energy) * A);
      g.beginPath(); g.moveTo(x, botY); g.lineTo(g0.x, g0.y); g.lineTo(g1.x, g1.y); g.closePath(); g.fillPath();
    }
    // Bright wireframe edges (apex spokes + girdle), front edges hotter.
    for (var e = 0; e < 6; e++) {
      var p0 = gp[e];
      var hot = 0.4 + 0.5 * (p0.d * 0.5 + 0.5);
      g.lineStyle(1.4, ICE, hot * A);
      g.beginPath(); g.moveTo(x, topY); g.lineTo(p0.x, p0.y); g.lineTo(x, botY); g.strokePath();
      var p1 = gp[(e + 1) % 6];
      g.lineStyle(1.2, WHITE, hot * 0.7 * A);
      g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.strokePath();
    }
    // Apex points + a hot white heart.
    g.fillStyle(WHITE, 0.85 * A); g.fillCircle(x, topY, 2.2 + energy); g.fillCircle(x, botY, 2.2 + energy);
    var hr = r * 0.18 * (0.7 + 0.5 * glow) * (1 + energy);
    g.fillStyle(SPECTRUM[5], 0.5 * A); g.fillCircle(x, y, hr * 2.0);
    g.fillStyle(WHITE, (0.7 + 0.3 * energy) * A); g.fillCircle(x, y, hr);
  };

  /* Ground hazard decal — a faint pulse + rotating dashed spectral ring marking the
     contact trigger zone (mirrors the core's hazard pad, in the spectrum). */
  M._drawPrismDecal = function (g, x, y, R, spin, pulse, A) {
    g.fillStyle(SPECTRUM[4], 0.04 * A * (0.6 + 0.4 * Math.sin(pulse * 2.5)));
    g.fillCircle(x, y, R * 0.95);
    var dashN = 30;
    for (var d = 0; d < dashN; d++) {
      var a0 = spin + (d / dashN) * TAU;
      var a1 = a0 + (0.55 / dashN) * TAU;
      g.lineStyle(2, SPECTRUM[d % SPECTRUM.length], 0.22 * A);
      g.beginPath();
      g.moveTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R);
      g.lineTo(x + Math.cos(a1) * R, y + Math.sin(a1) * R);
      g.strokePath();
    }
  };

  /* L2+ EMPOWERED dormant look — a COMPOUND gem that refracts in every direction:
     a turning radial rainbow crown, a wider spectral halo, the main crystal, then a
     brighter counter-rotating crystal nested INSIDE it (the "gem within the gem"),
     ringed by a few orbiting spectral shards. `energy` (0 dormant → 1 charged) lets
     the charging preview reuse this and super-charge it. */
  M._drawPrismCompound = function (g, pr, A, energy) {
    var x = pr.x, y = pr.y, r = C.PRISM_RADIUS, gt = this.gameTime;
    var glow = 0.6 + 0.4 * Math.sin(pr.pulse * 3);
    var e2   = 0.5 + 0.5 * energy;                    // 0.5 dormant … 1 charged

    // 1) Radial refraction crown — short rainbow rays fanning out all around, slowly
    //    turning, breathing on game time. Reads as "this gem splits light everywhere".
    var rays = 12;
    for (var i = 0; i < rays; i++) {
      var ra  = pr.dispAng * 0.8 + (i / rays) * TAU;
      var col = SPECTRUM[i % SPECTRUM.length];
      var len = r * (1.7 + 0.55 * Math.sin(gt * 1.6 + i * 0.7)) * (1 + 0.35 * energy);
      g.lineStyle(2, col, (0.12 + 0.10 * energy) * A * glow);
      g.beginPath();
      g.moveTo(x + Math.cos(ra) * r * 0.85, y + Math.sin(ra) * r * 0.85);
      g.lineTo(x + Math.cos(ra) * len,      y + Math.sin(ra) * len);
      g.strokePath();
    }

    // 2) Wider layered spectral halo.
    g.fillStyle(SPECTRUM[5], (0.05 + 0.05 * energy) * A * glow); g.fillCircle(x, y, r * (2.0 + 0.4 * energy));
    g.fillStyle(SPECTRUM[4], 0.05 * A);                          g.fillCircle(x, y, r * 1.5);

    // 3) Main crystal.
    this._drawPrismCrystal(g, x, y, r, pr.spin, pr.pulse, A, energy);

    // 4) Inner counter-rotating crystal — the gem WITHIN the gem, smaller + brighter
    //    (slight built-in energy so its facets shine through the outer body).
    this._drawPrismCrystal(g, x, y, r * 0.5, -pr.spin * 1.5 + Math.PI / 6, pr.pulse + 1.0, A * 0.9, Math.min(1, 0.4 + energy));

    // 5) Orbiting spectral shards (oriented diamonds with a white spark core).
    var shards = 3;
    for (var s = 0; s < shards; s++) {
      var sa = pr.spin * 1.25 + (s / shards) * TAU;
      var sr = r * (1.9 + 0.25 * Math.sin(gt * 2 + s));
      var sx = x + Math.cos(sa) * sr, sy = y + Math.sin(sa) * sr;
      var sc = SPECTRUM[(s * 2 + Math.floor(gt)) % SPECTRUM.length];
      g.fillStyle(sc, (0.45 + 0.25 * energy) * A * glow);
      diamondPath(g, sx, sy, 7 * e2 + 2, 3 * e2 + 1, sa + Math.PI / 2); g.fillPath();
      g.fillStyle(WHITE, 0.75 * A); g.fillCircle(sx, sy, 1.6);
    }
  };

  M._renderPrismDormant = function (g, pr) {
    var A = 1;
    this._drawPrismDecal(g, pr.x, pr.y, C.PRISM_TRIGGER_R * 1.05, -pr.spin * 0.7, pr.pulse, A);
    this._drawPrismDispersion(g, pr.x, pr.y, C.PRISM_RADIUS, pr.dispAng, A);
    if (pr.lvl >= 2) this._drawPrismCompound(g, pr, A, 0);
    else             this._drawPrismCrystal(g, pr.x, pr.y, C.PRISM_RADIUS, pr.spin, pr.pulse, A, 0);
  };

  M._renderPrismCharging = function (g, pr) {
    var x = pr.x, y = pr.y, gt = this.gameTime;
    var energy = Math.min(1, pr.chargeT / C.PRISM_CHARGE_RAMP);
    var ax = Math.cos(pr.aimAng), ay = Math.sin(pr.aimAng);
    var px = -ay, py = ax;                          // aim perpendicular

    // Decal + super-charged crystal.
    this._drawPrismDecal(g, x, y, C.PRISM_TRIGGER_R * 1.05, -pr.spin * 0.7, pr.pulse, 1);

    // ---- The big spectral AIMING LINE (the "loaded cannon") ----
    var beamLen = Math.min(this._prismMaxDist(x, y, ax, ay), pr.strikeDist);
    var ex = x + ax * beamLen, ey = y + ay * beamLen;
    // Layered glow → core.
    g.lineStyle(26, SPECTRUM[5], 0.05 * energy); g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.strokePath();
    g.lineStyle(14, SPECTRUM[4], 0.10 * energy); g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.strokePath();
    g.lineStyle(5,  ICE,        0.30 * energy); g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.strokePath();
    g.lineStyle(2,  WHITE,      0.65 * energy); g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.strokePath();
    // Scrolling spectral pips racing down the beam (telegraphs the launch direction).
    var pipN = Math.floor(beamLen / 60);
    for (var i = 0; i < pipN; i++) {
      var f = ((i / pipN) + (gt * 0.9 % 1)) % 1;
      var pxp = x + ax * beamLen * f, pyp = y + ay * beamLen * f;
      g.fillStyle(SPECTRUM[i % SPECTRUM.length], 0.5 * energy);
      g.fillCircle(pxp, pyp, 2.6 + 2.0 * (1 - f));
    }
    // Chevron arrowhead at the muzzle.
    var hd = 26 + 8 * Math.sin(gt * 10);
    g.lineStyle(3, WHITE, 0.8 * energy);
    g.beginPath();
    g.moveTo(ex - ax * hd + px * hd, ey - ay * hd + py * hd);
    g.lineTo(ex, ey);
    g.lineTo(ex - ax * hd - px * hd, ey - ay * hd - py * hd);
    g.strokePath();

    // ---- Fan preview: the two flanking guide lines the phantoms will take ----
    var previewLen = Math.min(beamLen, 360);
    for (var s = -1; s <= 1; s += 2) {
      g.lineStyle(1.5, s < 0 ? CHROMA_B : CHROMA_R, 0.30 * energy);
      g.beginPath();
      g.moveTo(x, y);
      // matches the strike's mid-fan offset for an honest preview
      g.lineTo(x + ax * previewLen + px * s * pr.fanLateral,
               y + ay * previewLen + py * s * pr.fanLateral);
      g.strokePath();
    }

    // ---- Energy gathering: spectral motes spiralling into the crystal ----
    for (var m = 0; m < 7; m++) {
      var ma = gt * 3 + m * (TAU / 7);
      var mr = C.PRISM_RADIUS * (2.6 - 2.0 * ((gt * 1.3 + m / 7) % 1));
      g.fillStyle(SPECTRUM[m % SPECTRUM.length], 0.6 * energy);
      g.fillCircle(x + Math.cos(ma) * mr, y + Math.sin(ma) * mr, 2.4);
    }

    if (pr.lvl >= 2) this._drawPrismCompound(g, pr, 1, energy);
    else             this._drawPrismCrystal(g, x, y, C.PRISM_RADIUS * (1 + 0.12 * energy), pr.spin, pr.pulse, 1, energy);

    // A ring snapping to full as the cannon finishes charging.
    g.lineStyle(2.5, WHITE, 0.7 * energy);
    g.beginPath();
    g.arc(x, y, C.PRISM_RADIUS * 1.5, -Math.PI / 2, -Math.PI / 2 + energy * TAU, false);
    g.strokePath();
  };

  M._renderPrismStrike = function (g, pr) {
    var gt = this.gameTime;
    var tw = this._twActive;
    var hi = pr.lvl >= 2;             // L2+ : a bigger, hotter, prismatic bolt
    var as = C.SIZE * (hi ? 1.78 : 1.5);     // phantom arrow size

    // (No straight origin→arrow wake: the strike can BOUNCE, so a straight ray would
    // cut across the map. The per-arrow chromatic trails trace the real path.)
    for (var i = 0; i < pr.arrows.length; i++) {
      var a = pr.arrows[i];

      // Blazing chromatic streak (L2+ : thicker, brighter).
      for (var t = 0; t < a.trail.length; t++) {
        var tr = a.trail[t];
        if (tr.a <= 0) continue;
        var rr = (t / a.trail.length) * as * 0.9;
        g.fillStyle(a.col, tr.a * (hi ? 0.30 : 0.22)); g.fillCircle(tr.x, tr.y, rr);
        g.fillStyle(WHITE, tr.a * (hi ? 0.15 : 0.10)); g.fillCircle(tr.x, tr.y, rr * 0.5);
      }

      // L2+ : an outer spectral aura wrapping the arrow → reads as "supercharged".
      if (hi) {
        var au = 0.6 + 0.4 * Math.sin(gt * 16 + i);
        g.fillStyle(a.col, 0.16 * au); arrowPath(g, a.x, a.y, as * 1.7, a.ang); g.fillPath();
      }

      // The arrow itself — a glowing chromatic ship-glyph. The centre one sits
      // under the REAL ship sprite (depth 30) for a clean white-cyan core.
      g.fillStyle(a.col, 0.30); arrowPath(g, a.x, a.y, as * 1.25, a.ang); g.fillPath();
      g.fillStyle(a.col, 0.85); arrowPath(g, a.x, a.y, as, a.ang); g.fillPath();
      g.lineStyle(hi ? 2.2 : 1.6, WHITE, 0.9); arrowPath(g, a.x, a.y, as, a.ang); g.strokePath();
    }

    // Hot white head flare on the centre arrow.
    var c0 = pr.arrows[0];
    var flare = 0.6 + 0.4 * Math.sin(gt * 30);
    g.fillStyle(WHITE, 0.4 * flare); g.fillCircle(c0.x, c0.y, as * 1.3);

    // The World: golden time-dilation ripples around the bolt (slow-mo dressing).
    if (tw) {
      for (var w = 0; w < 3; w++) {
        var wp = ((gt * 0.5) + w / 3) % 1;
        var wr = as * 1.2 + wp * as * 3.0;
        var wa = (1 - wp) * 0.4;
        g.lineStyle(2, TW_GOLD,  wa);       g.strokeCircle(c0.x, c0.y, wr);
        g.lineStyle(1, TW_GOLD2, wa * 0.7); g.strokeCircle(c0.x, c0.y, wr * 0.97);
      }
    }
  };

})();

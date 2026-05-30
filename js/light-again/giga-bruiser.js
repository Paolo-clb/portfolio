/* ==========================================================================
   Light Again — The Giga Bruiser (alternative mini-boss)

   A massive purple hexagon with a regenerating energy shield. Spawns swarms
   of 4 bruisers at the regular bruiser cadence. The 50/50 alternative to The
   Anomaly: same natural-spawn roll, same free-upgrade reward, but a very
   different combat puzzle.

     • SHIELDED — base attack rebounds (small iframes), dash-attack BREAKS
       the shield with a satisfying flash and a strong player knockback. The
       shield then animates back in over GBR_SHIELD_RESPAWN ms.
     • EXPOSED  — base attack lands (1 dmg), can be spammed freely.
                  Dash-attack lands (3 dmg) but BOUNCES the player off, so the
                  bigger hit costs spacing — you can spam, but not too fast.
     • Detonation marks do NOT apply (the boss is not in `this.enemies`).
     • Body tints purple → red and accumulates jagged white fracture lines as
       HP drains. Death drops a free upgrade just like the Anomaly.

   Self-contained on `this._gigaBruiser` — never enters `this.enemies`, so all
   the regular AI / separation / detonation passes ignore it cleanly. Sharing
   `_anomalyCooldownT` with the Anomaly keeps boss frequency consistent.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initGigaBruiser = function () {
    this._gigaBruiser = null;
  };

  M._clearGigaBruiser = function (_silent) {
    var g = this._gigaBruiser;
    this._gigaBruiser = null;
    if (!g) return;
    if (g.gfx)         g.gfx.destroy();
    if (g.shieldGfx)   g.shieldGfx.destroy();
    if (g.fractureGfx) g.fractureGfx.destroy();
    if (g.spawnFxGfx)  g.spawnFxGfx.destroy();
  };

  /* ================================================================
     SPAWN — coalesce slowly, IN the player's field of view, then go active.
     Instead of the anomaly's far-off arrival, the Giga Bruiser materialises
     right where the player is looking via a slow cinematic (_gigaBruiser
     TickArrival) — intangible until it has fully formed.
     ================================================================ */
  M._spawnGigaBruiser = function () {
    if (this._gigaBruiser || this._anomaly || this._mirror) return;
    if (!this.p || this.p.state === 'DEAD') return;

    var p   = this.p;
    var cam = this.cameras.main;
    // Appear directly in the player's field of view: out in front of where the
    // ship is facing, far enough not to overlap but comfortably on-screen.
    var view    = cam.worldView;
    var viewMin = Math.min(view.width, view.height);
    var dist    = Math.max(C.GBR_SIZE * 4, viewMin * 0.36);
    var ang     = p.angle;
    var x = p.x + Math.cos(ang) * dist;
    var y = p.y + Math.sin(ang) * dist;
    // Clamp to the intersection of (visible rect − margin) and (world bounds),
    // so the arrival is always both in-frame AND reachable inside the arena.
    var m      = C.WORLD_HALF - C.GBR_SIZE * 1.5;
    var margin = C.GBR_SIZE * 1.7;
    var loX = Math.max(view.x + margin, -m), hiX = Math.min(view.right  - margin, m);
    var loY = Math.max(view.y + margin, -m), hiY = Math.min(view.bottom - margin, m);
    if (loX > hiX) loX = hiX = (view.x + view.right)  / 2;
    if (loY > hiY) loY = hiY = (view.y + view.bottom) / 2;
    x = Math.min(hiX, Math.max(loX, x));
    y = Math.min(hiY, Math.max(loY, y));

    var gfx         = this.add.graphics(); gfx.setDepth(25);
    var fractureGfx = this.add.graphics(); fractureGfx.setDepth(26);
    var shieldGfx   = this.add.graphics(); shieldGfx.setDepth(27);
    shieldGfx.setBlendMode(Phaser.BlendModes.ADD);
    // Full-alpha cinematic layer (drawn behind the forming body) for the
    // converging-energy entrance — never faded by the materialisation alpha.
    var spawnFxGfx  = this.add.graphics(); spawnFxGfx.setDepth(24);
    spawnFxGfx.setBlendMode(Phaser.BlendModes.ADD);

    this._gigaBruiser = {
      x: x, y: y, vx: 0, vy: 0,
      hp: C.GBR_HP, hpMax: C.GBR_HP,
      angle: 0,
      shielded: true,
      shieldRespawnT: 0,     // ms of respawn animation remaining (0 = shield is up)
      shieldHitT: 0,         // 0..1 white-flash on shield-hit (decays)
      bodyHitT: 0,           // 0..1 white-flash on body-hit (decays)
      shieldRot: 0,
      spawnCD: C.GBR_SPAWN_CD * 1.4,  // first swarm delayed a hair
      // Telegraph state — when spawnCD drops below GBR_SPAWN_TELEGRAPH_DUR we
      // lock the slot positions in world-space and show targeting markers
      // there until spawnCD hits 0 and the swarm actually pops out.
      spawnPending:     false,
      spawnTelegraphT:  0,
      spawnSlots:       null,
      fractures: [],         // accumulated jagged crack lines
      // Shockwave attack state — see _beginGigaShockwave / _fireGigaShockwave
      shockwavePhase: null,  // null | 'CHARGING' | 'BLAST'
      shockwaveT:     0,     // ms elapsed in the current phase
      shockwaveCD:    0,     // ms until another shockwave is allowed
      dmgAccum:       0,     // HP lost since last shockwave (or since spawn)
      gfx: gfx, shieldGfx: shieldGfx, fractureGfx: fractureGfx,
      spawnFxGfx: spawnFxGfx,
      // Cinematic arrival state — materialises in view before it becomes active.
      spawnPhase: 'ARRIVING', spawnT: 0, introT01: 0,
      introScale: 0.0, introAlpha: 0.0, _gatherBurst: false,
      dead: false,
    };

    // Gather telegraph — a soft pulse marking where it will coalesce. The big
    // "fully formed" burst fires later, at the end of the arrival cinematic.
    this._spawnWaveRing(x, y, { maxRadius: C.GBR_SIZE * 2.2, color: 0x9933ff, expandTime: 0.50 });
    this._explode(x, y, [187, 0, 255], 12);
    this._explode(x, y, [255, 180, 255], 8);
    this.cameras.main.shake(120, 0.005);
  };

  /* ================================================================
     UPDATE — per-frame logic (scaled world-time sMs)
     ================================================================ */
  M._updateGigaBruiser = function (sMs, pMs, dt) {
    if (!this._gigaBruiser) return;
    var g = this._gigaBruiser, p = this.p;
    if (p.state === 'DEAD') { this._renderGigaBruiser(dt); return; }

    // ── CINEMATIC ENTRANCE ───────────────────────────────────────────────
    // Materialise in view on REAL dt (smooth, constant pace, unaffected by
    // hitstop / slow-mo / The World). The boss is intangible while forming.
    if (g.spawnPhase === 'ARRIVING') {
      this._gigaBruiserTickArrival(g, p, dt);
      this._renderGigaBruiser(dt);
      return;
    }

    // ── THE WORLD ────────────────────────────────────────────────────────
    // While time is stopped the boss is frozen like everything else — EXCEPT
    // its defensive shockwave. If the player chips off enough HP during the
    // freeze, the boss can still wind up the shockwave and SNAP ITS SHIELD
    // BACK ON, so The World can't be used to burn it down while skipping the
    // shield puzzle. The state machine ticks on player-time (pMs) so the
    // windup/blast read at a normal pace; the knockback is suppressed inside
    // _fireGigaShockwave (it must not fling the time-stopped player/crowd).
    if (this._twActive) {
      g.bodyHitT   = Math.max(0, g.bodyHitT   - dt * 4);
      g.shieldHitT = Math.max(0, g.shieldHitT - dt * 3);
      if (g.shockwaveCD > 0) g.shockwaveCD = Math.max(0, g.shockwaveCD - pMs);
      if (g.shockwavePhase === 'CHARGING') {
        g.shockwaveT += pMs;
        if (g.shockwaveT >= C.GBR_SHOCKWAVE_CHARGE_DUR) this._fireGigaShockwave();
      } else if (g.shockwavePhase === 'BLAST') {
        g.shockwaveT += pMs;
        if (g.shockwaveT >= C.GBR_SHOCKWAVE_BLAST_DUR) {
          g.shockwavePhase = null;
          g.shockwaveT     = 0;
        }
      }
      this._renderGigaBruiser(dt);
      return;
    }

    if (sMs < 0.001) { this._renderGigaBruiser(dt); return; }

    var sc60 = sMs / 16.7;

    // Slow continuous spin + flash decay
    g.angle      += sc60 * 0.013;
    g.shieldRot  += sc60 * 0.025;
    g.bodyHitT    = Math.max(0, g.bodyHitT   - dt * 4);
    g.shieldHitT  = Math.max(0, g.shieldHitT - dt * 3);

    // Shockwave state machine. Body is anchored in place while charging /
    // blasting so the windup reads clearly and the ring is centred on him.
    if (g.shockwaveCD > 0) g.shockwaveCD = Math.max(0, g.shockwaveCD - sMs);
    if (g.shockwavePhase === 'CHARGING') {
      g.shockwaveT += sMs;
      g.vx *= Math.pow(0.82, sc60); g.vy *= Math.pow(0.82, sc60);
      if (g.shockwaveT >= C.GBR_SHOCKWAVE_CHARGE_DUR) this._fireGigaShockwave();
      // Render and stop here — no movement, no swarm spawn during the windup.
      this._renderGigaBruiser(dt);
      return;
    }
    if (g.shockwavePhase === 'BLAST') {
      g.shockwaveT += sMs;
      g.vx *= Math.pow(0.85, sc60); g.vy *= Math.pow(0.85, sc60);
      if (g.shockwaveT >= C.GBR_SHOCKWAVE_BLAST_DUR) {
        g.shockwavePhase = null;
        g.shockwaveT     = 0;
      }
      // Boss still doesn't roam mid-blast — but swarms tick is gated below
      // by phase too, so we just keep rendering and skip motion.
      this._renderGigaBruiser(dt);
      return;
    }

    // Shield respawn animation → snap shield back on
    if (!g.shielded && g.shieldRespawnT > 0) {
      g.shieldRespawnT -= sMs;
      if (g.shieldRespawnT <= 0) {
        g.shielded       = true;
        g.shieldRespawnT = 0;
        this._explode(g.x, g.y, [120, 220, 255], 22);
        this._explode(g.x, g.y, [255, 255, 255], 10);
        this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SIZE * 2.2, color: 0x66ddff, expandTime: 0.20 });
        this.cameras.main.shake(60, 0.004);
      }
    }

    // Movement: approach until trigger range, then idle in place. The boss
    // never charges the player — it's a slow heavy threat that anchors the
    // arena while its bruiser swarms harass.
    var ddx = p.x - g.x, ddy = p.y - g.y;
    var dd  = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    if (dd > C.GBR_TRIGGER_RANGE) {
      var nax = ddx / dd, nay = ddy / dd;
      g.vx += (nax * C.GBR_APPROACH_SPD - g.vx) * 0.05 * sc60;
      g.vy += (nay * C.GBR_APPROACH_SPD - g.vy) * 0.05 * sc60;
    } else {
      var fric = Math.pow(0.92, sc60);
      g.vx *= fric; g.vy *= fric;
    }
    g.x += g.vx * sc60;
    g.y += g.vy * sc60;

    // Hard clamp to the world rectangle so the boss is always reachable.
    var mw = C.WORLD_HALF - C.GBR_SIZE * 1.2;
    if (g.x < -mw) g.x = -mw; else if (g.x > mw) g.x = mw;
    if (g.y < -mw) g.y = -mw; else if (g.y > mw) g.y = mw;

    // Bruiser-swarm spawner — mirrors the generator's cadence (T3_SPAWN_CD)
    // but with a deliberate two-step ritual:
    //   1) TELEGRAPH (last GBR_SPAWN_TELEGRAPH_DUR ms): targeting markers
    //      appear at the future slots so the player can read the swarm coming.
    //   2) POP: bruisers burst out of the markers with ring fx + camera punch.
    g.spawnCD -= sMs;
    if (!g.spawnPending && g.spawnCD <= C.GBR_SPAWN_TELEGRAPH_DUR && g.spawnCD > 0) {
      this._gigaBruiserBeginSpawnTelegraph();
    }
    if (g.spawnPending) {
      g.spawnTelegraphT = Math.max(0, g.spawnTelegraphT - sMs);
    }
    if (g.spawnCD <= 0) {
      g.spawnCD = C.GBR_SPAWN_CD * (0.85 + Math.random() * 0.3);
      this._gigaBruiserPopSwarm();
    }

    this._renderGigaBruiser(dt);
  };

  /* ================================================================
     CINEMATIC ENTRANCE — slow materialisation in the player's view
     ================================================================ */
  M._gigaBruiserTickArrival = function (g, p, dt) {
    var DUR = C.GBR_ARRIVE_DUR;
    g.spawnT += dt * 1000;
    var t = g.spawnT / DUR; if (t > 1) t = 1;
    g.introT01 = t;

    // Stays lively while forming — winds down toward the idle spin once formed.
    g.angle     += dt * 60 * 0.05;
    g.shieldRot += dt * 60 * 0.07;

    // Scale: slow smoothstep build to a 1.12 overshoot, then settle to 1.0.
    var grow;
    if (t < 0.82) { var u = t / 0.82;        grow = (u * u * (3 - 2 * u)) * 1.12; }
    else          { var v = (t - 0.82) / 0.18; grow = 1.12 - 0.12 * (v * v * (3 - 2 * v)); }
    g.introScale = grow;
    g.introAlpha = Math.min(1, t / 0.32);   // fade in over the first third

    // Ambient energy sparks while it coalesces.
    if (Math.random() < 0.18) this._explode(g.x, g.y, [255, 150, 255], 4);

    // Halfway "lock-in" pulse — the silhouette snaps into focus.
    if (!g._gatherBurst && t >= 0.5) {
      g._gatherBurst = true;
      this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SIZE * 1.7, color: 0xff66ff, expandTime: 0.20 });
      this._explode(g.x, g.y, [255, 120, 255], 14);
      this.cameras.main.shake(180, 0.006);
    }

    if (t >= 1) this._gigaBruiserFinishArrival(g);
  };

  M._gigaBruiserFinishArrival = function (g) {
    g.spawnPhase = null;
    g.introScale = 1.0; g.introAlpha = 1.0;
    if (g.spawnFxGfx) g.spawnFxGfx.clear();

    // Big "fully formed" burst — layered rings + shrapnel + a cyan shield snap.
    this._spawnWaveRing(g.x, g.y, { maxRadius: 300,             color: 0x9933ff, expandTime: 0.34 });
    this._spawnWaveRing(g.x, g.y, { maxRadius: 200,             color: 0xffffff, expandTime: 0.22 });
    this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SIZE * 2.6, color: 0x66ddff, expandTime: 0.20 });
    this._explode(g.x, g.y, [187, 0, 255],  34);
    this._explode(g.x, g.y, [255, 180, 255], 20);
    this._explode(g.x, g.y, [255, 255, 255], 16);
    this.cameras.main.flash(180, 200, 120, 255);
    this.cameras.main.shake(240, 0.014);
    this._triggerHitstop(C.HITSTOP_DUR);
  };

  /* Cinematic gather FX — converging rings, inrushing streaks, a forming core
     and an early targeting reticle. Drawn on the full-alpha spawnFxGfx so it
     reads bright while the body itself is still fading in. */
  M._drawGigaArrivalFx = function (afx, g) {
    var gt = this.gameTime;
    var t  = g.introT01 || 0;
    var R  = C.GBR_SIZE;

    // ── Targeting reticle (strong early, fades as the body forms) ──
    var telA = Math.max(0, 1 - t / 0.6);
    if (telA > 0) {
      var rr = R * (2.6 - 1.4 * t) + 8 * Math.sin(gt * 6);
      afx.lineStyle(2, 0xff66ff, telA * 0.7);
      this._strokeHex(afx, g.x, g.y, rr, -gt * 0.6);
      afx.lineStyle(1, 0xffffff, telA * 0.4);
      this._strokeHex(afx, g.x, g.y, rr * 1.12, gt * 0.4);
      for (var c = 0; c < 4; c++) {
        var ca = (Math.PI / 2) * c + gt * 1.5;
        afx.lineStyle(1.5, 0xff88ff, telA * 0.8);
        afx.lineBetween(
          g.x + Math.cos(ca) * (rr + 6),  g.y + Math.sin(ca) * (rr + 6),
          g.x + Math.cos(ca) * (rr + 18), g.y + Math.sin(ca) * (rr + 18)
        );
      }
    }

    // ── Converging energy rings — a steady stream collapsing inward ──
    for (var k = 0; k < 4; k++) {
      var rp = ((t * 2.6 + k / 4) % 1);              // 0 (far) → 1 (centre)
      var cr = R * (3.4 * (1 - rp) + 0.25);
      var ca2 = rp * 0.55 * Math.min(1, t * 1.6);    // brightens as it slams in
      afx.lineStyle(2.5, 0xff66ff, ca2);
      afx.strokeCircle(g.x, g.y, cr);
      afx.lineStyle(1, 0xffffff, ca2 * 0.5);
      afx.strokeCircle(g.x, g.y, cr * 0.96);
    }

    // ── Inrushing streaks (energy pulled into the forming core) ──
    var sN = 10;
    for (var s = 0; s < sN; s++) {
      var sa    = (TAU / sN) * s + gt * 0.8;
      var phase = ((t * 2.0 + s / sN) % 1);
      var outR  = R * (3.2 - 2.4 * phase);
      var inR   = Math.max(0, outR - (16 + 22 * t));
      var sA    = phase * 0.6 * Math.min(1, t * 1.6);
      afx.lineStyle(2, 0xffaaff, sA);
      afx.lineBetween(
        g.x + Math.cos(sa) * outR, g.y + Math.sin(sa) * outR,
        g.x + Math.cos(sa) * inR,  g.y + Math.sin(sa) * inR
      );
    }

    // ── Forming core (white-hot, grows with t) ──
    var coreR = R * (0.10 + 0.22 * t) * (1 + 0.18 * Math.sin(gt * 12));
    afx.fillStyle(0xff88ff, 0.4 * t);
    afx.fillCircle(g.x, g.y, coreR * 2.4);
    afx.fillStyle(0xffffff, 0.5 + 0.5 * t);
    afx.fillCircle(g.x, g.y, coreR);
  };

  /* ================================================================
     SWARM SPAWN — telegraph (markers + beams), then pop
     ================================================================ */
  M._gigaBruiserBeginSpawnTelegraph = function () {
    var g = this._gigaBruiser;
    var slots = C.MAX_ENEMIES - this.enemies.length;
    var swarmN = Math.min(slots, C.GBR_SWARM_SIZE);
    if (swarmN <= 0) return;   // arena is full — skip this beat

    g.spawnPending    = true;
    g.spawnTelegraphT = C.GBR_SPAWN_TELEGRAPH_DUR;
    g.spawnSlots      = [];
    var baseAng = Math.random() * TAU;
    var ringR   = C.GBR_SIZE * 1.65;
    for (var ss = 0; ss < swarmN; ss++) {
      var sAng = baseAng + (ss / swarmN) * TAU;
      g.spawnSlots.push({
        x:   g.x + Math.cos(sAng) * ringR,
        y:   g.y + Math.sin(sAng) * ringR,
        ang: sAng,
      });
    }
    // Soft charge-up burst at the boss centre + slot pings
    this._explode(g.x, g.y, [255, 120, 255], 8);
    for (var ps = 0; ps < g.spawnSlots.length; ps++) {
      this._explode(g.spawnSlots[ps].x, g.spawnSlots[ps].y, [255, 200, 255], 4);
    }
  };

  M._gigaBruiserPopSwarm = function () {
    var g = this._gigaBruiser;
    if (!g.spawnSlots || g.spawnSlots.length === 0) {
      g.spawnPending = false;
      g.spawnSlots   = null;
      return;
    }

    // Spawn each bruiser at its locked telegraph slot, with a small radial pop
    for (var sw = 0; sw < g.spawnSlots.length; sw++) {
      if (this.enemies.length >= C.MAX_ENEMIES) break;
      var slot = g.spawnSlots[sw];
      var sx = slot.x, sy = slot.y, sa = slot.ang;
      this._spawnBruiserAt(sx, sy);
      var spawned = this.enemies[this.enemies.length - 1];
      // Eject harder than the old version so the pop reads
      spawned.vx = Math.cos(sa) * 9;
      spawned.vy = Math.sin(sa) * 9;
      spawned.stunTimer = 220;     // brief stagger after pop-out (own AI takes over)
      // Connection beam from boss → bruiser
      this._hiveSpawnBeam(g.x, g.y, sx, sy);
      // Per-slot mini-explosion + tiny wave ring so each pop is its own moment
      this._explode(sx, sy, [187, 0, 255], 14);
      this._explode(sx, sy, [255, 150, 255], 8);
      this._explode(sx, sy, [255, 255, 255], 6);
      this._spawnWaveRing(sx, sy, { maxRadius: C.T3_SIZE * 4, color: 0x9933ff, expandTime: 0.16 });
    }

    // Central burst on the boss — bigger than the per-slot pops so the
    // origin is clearly the boss, not the bruisers themselves
    this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SIZE * 2.4, color: 0x9933ff, expandTime: 0.22 });
    this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SIZE * 1.6, color: 0xffffff, expandTime: 0.16 });
    this._explode(g.x, g.y, [187, 0, 255], 28);
    this._explode(g.x, g.y, [255, 150, 255], 16);
    this._explode(g.x, g.y, [255, 255, 255], 12);
    this.cameras.main.shake(140, 0.007);

    g.spawnPending = false;
    g.spawnSlots   = null;
  };

  /* ================================================================
     RENDER — hex body (tinted by HP), fractures, shield ring
     ================================================================ */
  M._renderGigaBruiser = function (_dt) {
    var g = this._gigaBruiser;
    if (!g) return;
    var gt = this.gameTime;
    // Materialisation transform — the whole boss scales + fades in during the
    // ARRIVING cinematic (introScale/introAlpha default to 1 once formed).
    var introScale = (g.introScale != null) ? g.introScale : 1;
    var R  = C.GBR_SIZE * introScale;

    // Body colour: purple → red as HP drops. Charging tints it toward white.
    var hpFrac = Math.max(0, g.hp / g.hpMax);
    var dmg    = 1 - hpFrac;
    var br = Math.round(0x6a + (0xff - 0x6a) * dmg);
    var bg = Math.round(0x0d * hpFrac + 0x10 * dmg);
    var bb = Math.round(0xad * hpFrac + 0x22 * dmg);

    var charging = g.shockwavePhase === 'CHARGING';
    var blasting = g.shockwavePhase === 'BLAST';
    var chargeT  = charging ? Math.min(1, g.shockwaveT / C.GBR_SHOCKWAVE_CHARGE_DUR) : 0;
    var blastT   = blasting ? Math.min(1, g.shockwaveT / C.GBR_SHOCKWAVE_BLAST_DUR)  : 0;

    var bodyCol;
    if (g.bodyHitT > 0) {
      bodyCol = 0xffffff;
    } else if (charging) {
      // Shift toward white as the windup progresses
      var cr2 = Math.round(br + (255 - br) * chargeT);
      var cg2 = Math.round(bg + (255 - bg) * chargeT);
      var cb2 = Math.round(bb + (255 - bb) * chargeT);
      bodyCol = (cr2 << 16) | (cg2 << 8) | cb2;
    } else {
      bodyCol = (br << 16) | (bg << 8) | bb;
    }

    var gfx = g.gfx;
    gfx.clear();

    // ── OUTER COUNTER-ROTATING RING (hex outline, slow) ───────────────────
    var outerRot = -g.angle * 0.55;
    var outerR   = R * (1.34 + 0.04 * Math.sin(gt * 2.4) + chargeT * 0.14);
    gfx.lineStyle(2.5, bodyCol, 0.42 + chargeT * 0.30);
    this._strokeHex(gfx, g.x, g.y, outerR, outerRot);
    gfx.lineStyle(1.2, 0xffffff, 0.18);
    this._strokeHex(gfx, g.x, g.y, outerR * 1.07, outerRot * 0.85);

    // ── 6 OUTWARD SPIKES at the body vertices ─────────────────────────────
    for (var sp = 0; sp < 6; sp++) {
      var sa = g.angle + (TAU / 6) * sp - Math.PI / 6;
      var baseR = R * 1.00;
      var tipR  = R * (1.22 + 0.04 * Math.sin(gt * 4 + sp) + chargeT * 0.10);
      var perp  = sa + Math.PI / 2;
      var halfW = R * 0.10;
      var bx    = g.x + Math.cos(sa) * baseR;
      var by    = g.y + Math.sin(sa) * baseR;
      var tx    = g.x + Math.cos(sa) * tipR;
      var ty    = g.y + Math.sin(sa) * tipR;
      var lx    = bx + Math.cos(perp) * halfW;
      var ly    = by + Math.sin(perp) * halfW;
      var rx    = bx - Math.cos(perp) * halfW;
      var ry    = by - Math.sin(perp) * halfW;
      gfx.fillStyle(bodyCol, 0.85);
      gfx.beginPath();
      gfx.moveTo(tx, ty);
      gfx.lineTo(lx, ly);
      gfx.lineTo(rx, ry);
      gfx.closePath();
      gfx.fillPath();
    }

    // ── OUTER GLOW HALO ───────────────────────────────────────────────────
    var glowR = R * (1.14 + 0.03 * Math.sin(gt * 3.4) + chargeT * 0.22);
    this._drawHex(gfx, g.x, g.y, glowR, g.angle, bodyCol, 0.18 + chargeT * 0.30);

    // ── MAIN BODY ─────────────────────────────────────────────────────────
    this._drawHex(gfx, g.x, g.y, R * 1.04, g.angle, bodyCol, 0.55);
    this._drawHex(gfx, g.x, g.y, R,        g.angle, bodyCol, 1.00);

    // ── DARK SEAM (inner stroke) between main hex and inner highlight ─────
    gfx.lineStyle(2, 0x220033, 0.55);
    this._strokeHex(gfx, g.x, g.y, R * 0.72, g.angle);

    // ── ENERGY VEINS — 6 lines from core to vertex, pulsing ───────────────
    for (var vi = 0; vi < 6; vi++) {
      var va    = g.angle + (TAU / 6) * vi - Math.PI / 6;
      var pulse = 0.55 + 0.45 * Math.sin(gt * 4 - vi + chargeT * 8);
      gfx.lineStyle(1.6, 0xffffff, 0.18 + pulse * 0.40 + chargeT * 0.25);
      gfx.lineBetween(
        g.x, g.y,
        g.x + Math.cos(va) * R * 0.92,
        g.y + Math.sin(va) * R * 0.92
      );
    }

    // ── INNER HEX HIGHLIGHT ───────────────────────────────────────────────
    var innerA = 0.18 + 0.08 * Math.sin(gt * 5) + g.bodyHitT * 0.40 + chargeT * 0.30;
    this._drawHex(gfx, g.x, g.y, R * 0.60, g.angle, 0xffffff, innerA);

    // ── GLOWING ENERGY CORE ───────────────────────────────────────────────
    var corePulse = 1.0 + 0.20 * Math.sin(gt * 6) + chargeT * 0.85;
    var coreR     = R * 0.16 * corePulse;
    gfx.fillStyle(0xff88ff, 0.45 + chargeT * 0.4);
    gfx.fillCircle(g.x, g.y, coreR * 2.0);
    gfx.fillStyle(0xffffff, 0.95);
    gfx.fillCircle(g.x, g.y, coreR);

    // ── CHARGING OVERLAY — contracting white ring sucking energy inward ───
    if (charging) {
      var contractR = R * (3.4 - chargeT * 2.4);
      gfx.lineStyle(4, 0xffffff, 0.50 + chargeT * 0.50);
      gfx.strokeCircle(g.x, g.y, contractR);
      gfx.lineStyle(2, 0xff88ff, 0.50);
      gfx.strokeCircle(g.x, g.y, contractR * 0.94);
      // Inrushing tick marks at 8 angles
      for (var ti2 = 0; ti2 < 8; ti2++) {
        var tia = (TAU / 8) * ti2 + gt * 2;
        var t1x = g.x + Math.cos(tia) * contractR;
        var t1y = g.y + Math.sin(tia) * contractR;
        var t2x = g.x + Math.cos(tia) * (contractR + 14);
        var t2y = g.y + Math.sin(tia) * (contractR + 14);
        gfx.lineStyle(2, 0xffffff, 0.6);
        gfx.lineBetween(t1x, t1y, t2x, t2y);
      }
    }

    // ── BLAST RING — drawn on the body gfx so it tracks the boss exactly ──
    if (blasting) {
      var ringR = C.GBR_SHOCKWAVE_MAX_RADIUS * blastT;
      var ringA = 1.0 - blastT;
      gfx.lineStyle(14, 0xffffff, ringA * 0.85);
      gfx.strokeCircle(g.x, g.y, ringR);
      gfx.lineStyle(8, 0xff66ff, ringA * 0.75);
      gfx.strokeCircle(g.x, g.y, ringR * 0.96);
      gfx.lineStyle(4, 0x88ddff, ringA * 0.55);
      gfx.strokeCircle(g.x, g.y, ringR * 1.04);
    }

    // ── SPAWN TELEGRAPH MARKERS ──────────────────────────────────────────
    // Targeting reticles at each upcoming bruiser slot — outer ring contracts,
    // inner ring expands, cardinal ticks spin, and a faint dotted-feel beam
    // connects boss → slot. The whole thing intensifies as countdown → 0.
    if (g.spawnPending && g.spawnSlots) {
      var teleFrac = 1 - g.spawnTelegraphT / C.GBR_SPAWN_TELEGRAPH_DUR;  // 0 → 1
      var teleA    = 0.40 + 0.55 * teleFrac;
      for (var ts = 0; ts < g.spawnSlots.length; ts++) {
        var slot   = g.spawnSlots[ts];
        var baseR  = C.T3_SIZE * (1.6 - teleFrac * 0.6);   // outer ring CONTRACTS in
        var innerR = C.T3_SIZE * (0.4 + teleFrac * 0.9);   // inner ring EXPANDS out
        // Connecting beam (tracks the boss live — slots are static so the beam
        // visibly snaps onto each marker as the boss drifts)
        gfx.lineStyle(1.5, 0xff88ff, teleA * 0.45);
        gfx.lineBetween(g.x, g.y, slot.x, slot.y);
        // Outer contracting ring
        gfx.lineStyle(2.0 + teleFrac * 2.4, 0xff66ff, teleA);
        gfx.strokeCircle(slot.x, slot.y, baseR);
        // Inner expanding ring
        gfx.lineStyle(2.0, 0xffffff, teleA * 0.65);
        gfx.strokeCircle(slot.x, slot.y, innerR);
        // 4 cardinal tick marks spinning around the marker
        for (var ck = 0; ck < 4; ck++) {
          var ca   = (Math.PI / 2) * ck + gt * 3.0;
          var tickIn  = baseR + 3;
          var tickOut = baseR + 11 + teleFrac * 4;
          var cx1 = slot.x + Math.cos(ca) * tickIn;
          var cy1 = slot.y + Math.sin(ca) * tickIn;
          var cx2 = slot.x + Math.cos(ca) * tickOut;
          var cy2 = slot.y + Math.sin(ca) * tickOut;
          gfx.lineStyle(1.5, 0xff66ff, teleA);
          gfx.lineBetween(cx1, cy1, cx2, cy2);
        }
        // Central crosshair dot
        gfx.fillStyle(0xffffff, teleA * 0.85);
        gfx.fillCircle(slot.x, slot.y, 1.8 + teleFrac * 1.6);
      }
    }

    // ── FRACTURES (separate gfx so they sit cleanly on top of the body) ──
    var fgfx = g.fractureGfx;
    fgfx.clear();
    for (var fi = 0; fi < g.fractures.length; fi++) {
      var fr = g.fractures[fi];
      fgfx.lineStyle(fr.w, 0xffffff, fr.a);
      fgfx.beginPath();
      for (var pti = 0; pti < fr.points.length; pti++) {
        var pt = fr.points[pti];
        var fx = g.x + Math.cos(g.angle + pt.a) * pt.r;
        var fy = g.y + Math.sin(g.angle + pt.a) * pt.r;
        if (pti === 0) fgfx.moveTo(fx, fy); else fgfx.lineTo(fx, fy);
      }
      fgfx.strokePath();
    }

    // ── SHIELD ────────────────────────────────────────────────────────────
    var sgfx = g.shieldGfx;
    sgfx.clear();
    if (g.shielded) {
      var sPulse  = 0.92 + 0.08 * Math.sin(gt * Math.PI * 3);
      var sAlpha  = 0.55 + 0.20 * Math.sin(gt * Math.PI * 4) + g.shieldHitT * 0.5;
      var sBaseR  = R * 1.40 * sPulse;
      var sCol    = g.shieldHitT > 0 ? 0xffffff : 0x66ccff;

      // Triple concentric ring
      sgfx.lineStyle(2.0, 0x66ccff, sAlpha * 0.35);
      sgfx.strokeCircle(g.x, g.y, sBaseR * 1.10);
      sgfx.lineStyle(4.0, sCol, sAlpha);
      sgfx.strokeCircle(g.x, g.y, sBaseR);
      sgfx.lineStyle(2.0, 0xffffff, sAlpha * 0.45);
      sgfx.strokeCircle(g.x, g.y, sBaseR * 0.88);

      // Six rotating dash-arcs
      for (var ai = 0; ai < 6; ai++) {
        var arcA = g.shieldRot + (TAU / 6) * ai;
        sgfx.lineStyle(3, 0x66ccff, sAlpha * 0.7);
        sgfx.beginPath();
        sgfx.arc(g.x, g.y, sBaseR + 4, arcA, arcA + 0.46);
        sgfx.strokePath();
      }

      // Counter-rotating inner hex frame
      sgfx.lineStyle(2.0, 0x88ddff, sAlpha * 0.40);
      this._strokeHex(sgfx, g.x, g.y, sBaseR * 0.72, -g.shieldRot * 1.5);

      // Six energy nodes on the shield, each with a glow + bright pinprick
      for (var ni = 0; ni < 6; ni++) {
        var na      = g.shieldRot * 2.0 + (TAU / 6) * ni;
        var nx      = g.x + Math.cos(na) * sBaseR;
        var ny      = g.y + Math.sin(na) * sBaseR;
        var nPulse  = 0.65 + 0.35 * Math.sin(gt * 6 + ni);
        sgfx.fillStyle(0xaaeeff, sAlpha * 0.45 * nPulse);
        sgfx.fillCircle(nx, ny, 9);
        sgfx.fillStyle(0xffffff, sAlpha * 0.95 * nPulse);
        sgfx.fillCircle(nx, ny, 3.4);
      }

      // Occasional jagged arc between two adjacent nodes
      for (var li = 0; li < 6; li++) {
        if (Math.random() > 0.18) continue;
        var la1 = g.shieldRot * 2.0 + (TAU / 6) * li;
        var la2 = g.shieldRot * 2.0 + (TAU / 6) * ((li + 1) % 6);
        var lx1 = g.x + Math.cos(la1) * sBaseR;
        var ly1 = g.y + Math.sin(la1) * sBaseR;
        var lx2 = g.x + Math.cos(la2) * sBaseR;
        var ly2 = g.y + Math.sin(la2) * sBaseR;
        var mx  = (lx1 + lx2) / 2 + (Math.random() - 0.5) * 22;
        var my  = (ly1 + ly2) / 2 + (Math.random() - 0.5) * 22;
        sgfx.lineStyle(1.6, 0xaaeeff, sAlpha * 0.65);
        sgfx.beginPath();
        sgfx.moveTo(lx1, ly1);
        sgfx.lineTo(mx, my);
        sgfx.lineTo(lx2, ly2);
        sgfx.strokePath();
      }
    } else if (g.shieldRespawnT > 0) {
      // Respawn-in animation: ring grows from 0 → full radius, crackles toward end.
      var respawnFrac = 1 - g.shieldRespawnT / C.GBR_SHIELD_RESPAWN;
      var growR       = R * 1.40 * respawnFrac;
      sgfx.lineStyle(2 + 4 * respawnFrac, 0x66ccff, 0.15 + respawnFrac * 0.45);
      sgfx.strokeCircle(g.x, g.y, growR);
      // Reforging sparks once the ring is mostly there
      if (respawnFrac > 0.45) {
        var crackleN = Math.floor((respawnFrac - 0.45) * 16);
        for (var cri = 0; cri < crackleN; cri++) {
          var cra = Math.random() * TAU;
          var cx1 = g.x + Math.cos(cra) * (growR - 6);
          var cy1 = g.y + Math.sin(cra) * (growR - 6);
          var cx2 = g.x + Math.cos(cra) * (growR + 6);
          var cy2 = g.y + Math.sin(cra) * (growR + 6);
          sgfx.lineStyle(1.5, 0xaaeeff, 0.55);
          sgfx.lineBetween(cx1, cy1, cx2, cy2);
        }
      }
    }

    // ── CINEMATIC ARRIVAL FX + MATERIALISATION FADE ──────────────────────
    // The gather FX layer is full-alpha (drawn behind the forming body); the
    // body + fractures + shield fade in together via introAlpha.
    var afx = g.spawnFxGfx;
    if (afx) {
      afx.clear();
      if (g.spawnPhase === 'ARRIVING') this._drawGigaArrivalFx(afx, g);
    }
    var ia = (g.introAlpha != null) ? g.introAlpha : 1;
    gfx.setAlpha(ia);
    fgfx.setAlpha(ia);
    sgfx.setAlpha(ia);
  };

  /* Stroke + fill a flat-topped hexagon centred on (cx,cy). The Phaser Graphics
     API expects beginPath/closePath/fillPath wrapping moveTo/lineTo. */
  M._drawHex = function (gfx, cx, cy, r, rot, col, alpha) {
    gfx.fillStyle(col, alpha);
    gfx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = rot + (TAU / 6) * i - Math.PI / 6;
      var hx = cx + Math.cos(a) * r;
      var hy = cy + Math.sin(a) * r;
      if (i === 0) gfx.moveTo(hx, hy); else gfx.lineTo(hx, hy);
    }
    gfx.closePath();
    gfx.fillPath();
  };

  /* Same shape but stroke-only — uses the lineStyle the caller sets up. */
  M._strokeHex = function (gfx, cx, cy, r, rot) {
    gfx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = rot + (TAU / 6) * i - Math.PI / 6;
      var hx = cx + Math.cos(a) * r;
      var hy = cy + Math.sin(a) * r;
      if (i === 0) gfx.moveTo(hx, hy); else gfx.lineTo(hx, hy);
    }
    gfx.closePath();
    gfx.strokePath();
  };

  /* ================================================================
     DAMAGE — body hits (only when unshielded)
     ================================================================ */
  M._damageGigaBruiser = function (amount) {
    var g = this._gigaBruiser;
    if (!g || g.dead || g.shielded) return;
    g.hp -= amount;
    g.bodyHitT = 1.0;
    // Add a fracture per hit; later cracks scale up so it really "shatters"
    // toward the end. A few duplicate cracks early on look like a real spider-web.
    var dmgDone = 1 - Math.max(0, g.hp / g.hpMax);
    var addN    = (amount >= 2) ? 2 : 1;   // big hits leave bigger marks
    for (var k = 0; k < addN; k++) this._addGigaFracture(g, dmgDone);

    this._explode(g.x, g.y, [255, 70, 70], 14);
    this._explode(g.x, g.y, [255, 255, 255], 6);
    this._triggerHitstop(C.HITSTOP_DUR);
    this.cameras.main.shake(80, 0.009);

    if (g.hp <= 0) { this._killGigaBruiser(); return; }

    // Build the shockwave meter. Once enough HP has been chipped off since the
    // last blast (and the cooldown is up), the boss winds up the panic attack.
    g.dmgAccum += amount;
    if (g.dmgAccum >= C.GBR_SHOCKWAVE_THRESHOLD
        && !g.shockwavePhase
        && g.shockwaveCD <= 0) {
      this._beginGigaShockwave();
    }
  };

  /* ================================================================
     SHOCKWAVE — windup + blast. Triggered automatically by damage.
     ================================================================ */
  M._beginGigaShockwave = function () {
    var g = this._gigaBruiser;
    if (!g || g.dead) return;
    g.shockwavePhase = 'CHARGING';
    g.shockwaveT     = 0;
    g.dmgAccum       = 0;

    // Pull-in particles + low rumble while charging
    this._explode(g.x, g.y, [255, 255, 255], 10);
    this._explode(g.x, g.y, [255, 120, 255], 6);
    this.cameras.main.shake(C.GBR_SHOCKWAVE_CHARGE_DUR, 0.009);
  };

  M._fireGigaShockwave = function () {
    var g = this._gigaBruiser;
    if (!g || g.dead) return;
    g.shockwavePhase = 'BLAST';
    g.shockwaveT     = 0;
    g.shockwaveCD    = C.GBR_SHOCKWAVE_COOLDOWN;

    // The shockwave is also a defensive reset: the boss snaps its shield back
    // on instantly (skipping the slow respawn animation). This means each
    // shockwave forces the player to break the shield again — so even with a
    // perfect run, you can't burn through HP between shockwaves.
    var shieldWasDown = !g.shielded;
    g.shielded       = true;
    g.shieldRespawnT = 0;
    g.shieldHitT     = 1.0;       // flash so the reform is super visible

    // BIG visual burst — layered rings (purple core, white shell, cyan trail)
    this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SHOCKWAVE_MAX_RADIUS,        color: 0xffffff, expandTime: 0.42 });
    this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SHOCKWAVE_MAX_RADIUS * 0.78, color: 0xff66ff, expandTime: 0.36 });
    this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SHOCKWAVE_MAX_RADIUS * 0.55, color: 0x9933ff, expandTime: 0.30 });
    this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SHOCKWAVE_MAX_RADIUS * 0.34, color: 0x88ddff, expandTime: 0.22 });
    this._explode(g.x, g.y, [255, 255, 255], 70);
    this._explode(g.x, g.y, [255, 100, 255], 48);
    this._explode(g.x, g.y, [200, 60, 255],  32);
    if (shieldWasDown) {
      // Extra shield-reform burst, cyan accent so the reset reads instantly
      this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SIZE * 2.6, color: 0x66ddff, expandTime: 0.20 });
      this._explode(g.x, g.y, [120, 220, 255], 28);
    }
    this.cameras.main.flash(220, 255, 200, 255);
    this.cameras.main.shake(380, 0.024);
    this._triggerHitstop(C.DEFLECT_HEAVY_HS);

    // During The World the shockwave is purely a defensive re-shield — it must
    // NOT fling the (time-stopped) player around or shove the frozen crowd.
    // Outside time stop it does its full knockback below.
    if (!this._twActive) {
      // Push the player FAR outward. The impulse barely drops with distance so
      // wherever you are inside the field, you get launched hard.
      var p   = this.p;
      var maxR = C.GBR_SHOCKWAVE_MAX_RADIUS;
      var pdx = p.x - g.x, pdy = p.y - g.y;
      var pd  = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pd < maxR) {
        if (pd < 0.1) {
          // Right on top of him: pick a random direction so the push has a vector
          var ra = Math.random() * Math.PI * 2;
          pdx = Math.cos(ra); pdy = Math.sin(ra); pd = 1;
        }
        // Plancher de 80% → près ou loin, tu pars en orbite.
        var pdrop = Math.max(0.80, 1 - pd / maxR);
        var pimp  = C.GBR_SHOCKWAVE_FORCE * pdrop;
        // OVERWRITE velocity rather than add — incoming dash speed shouldn't
        // partially cancel the launch when the player is moving toward the boss.
        p.vx = (pdx / pd) * pimp;
        p.vy = (pdy / pd) * pimp;
        // Longer i-frames so the long flight doesn't end in instant chip damage
        if (!p.invincible) { p.invincible = true; p.invincTimer = 420; p.dashInvinc = true; }
        // Break out of any in-progress attack/dash-attack — the blast resets state
        if (p.state === 'ATTACKING' || p.state === 'DASH_ATTACKING') {
          p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
          p.atkAvailable = true; p.atkCooldown = 0;
        }
      }

      // Push every enemy outward + stun them briefly
      for (var i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        var edx = e.x - g.x, edy = e.y - g.y;
        var ed  = Math.sqrt(edx * edx + edy * edy);
        if (ed >= maxR) continue;
        if (ed < 0.1) { edx = (Math.random() - 0.5); edy = (Math.random() - 0.5); ed = 1; }
        var edrop = Math.max(0.65, 1 - ed / maxR);
        var eimp  = C.GBR_SHOCKWAVE_ENEMY_FORCE * edrop;
        e.vx += (edx / ed) * eimp;
        e.vy += (edy / ed) * eimp;
        e.stunTimer = Math.max(e.stunTimer || 0, 420);
      }
    }
  };

  M._addGigaFracture = function (g, dmgDone) {
    // 3–5 segment jagged crack starting near the rim and meandering inward.
    var startA = Math.random() * TAU;
    var n      = 3 + ((Math.random() * 3) | 0);
    var pts    = [];
    var rr     = C.GBR_SIZE * (0.92 + Math.random() * 0.10);
    var aa     = startA;
    for (var i = 0; i < n; i++) {
      pts.push({ a: aa, r: rr });
      aa += (Math.random() - 0.5) * 0.85;
      rr -= C.GBR_SIZE * (0.18 + Math.random() * 0.22);
      if (rr < 4) rr = 4;
    }
    g.fractures.push({
      points: pts,
      w: 0.9 + dmgDone * 2.6,
      a: 0.45 + dmgDone * 0.45,
    });
  };

  /* ================================================================
     SHIELD BREAK — dash-attack only; player gets knocked back, anim starts
     ================================================================ */
  M._breakGigaShield = function () {
    var g = this._gigaBruiser;
    if (!g || !g.shielded) return;
    g.shielded       = false;
    g.shieldRespawnT = C.GBR_SHIELD_RESPAWN;
    g.shieldHitT     = 1.0;

    this._explode(g.x, g.y, [120, 220, 255], 32);
    this._explode(g.x, g.y, [255, 255, 255], 20);
    this._explode(g.x, g.y, [170, 200, 255], 14);
    this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SIZE * 3.2, color: 0x88ddff, expandTime: 0.24 });
    this._spawnWaveRing(g.x, g.y, { maxRadius: C.GBR_SIZE * 2.0, color: 0xffffff, expandTime: 0.18 });
    this.cameras.main.flash(140, 180, 220, 255);
    this.cameras.main.shake(220, 0.016);
    this._triggerHitstop(C.DEFLECT_HEAVY_HS);
  };

  /* ================================================================
     DEATH — shatter animation + free upgrade (like the anomaly)
     ================================================================ */
  M._killGigaBruiser = function () {
    var g = this._gigaBruiser;
    if (!g || g.dead) return;
    g.dead = true;
    var ex = g.x, ey = g.y;

    // Custom kill banner — bigger and stays on screen much longer than the
    // generic _floatLabel so the moment really lands.
    var killTxt = this.add.text(ex, ey - C.GBR_SIZE - 18, 'GIGA BRUISER KILLED', {
      fontFamily: 'monospace', fontSize: '38px', fontStyle: 'bold',
      color: '#ff66ff', stroke: '#000000', strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: '#ff66ff', blur: 14, fill: true },
    });
    killTxt.setOrigin(0.5, 1);
    killTxt.setDepth(75);
    killTxt.setAlpha(0);
    killTxt.setScale(0.55);
    // Pop in with a satisfying overshoot
    this.tweens.add({
      targets: killTxt, scaleX: 1.0, scaleY: 1.0, alpha: 1.0,
      duration: 320, ease: 'Back.easeOut',
    });
    // Drift slowly upward while held visible
    this.tweens.add({
      targets: killTxt, y: ey - C.GBR_SIZE - 62,
      duration: 2200, ease: 'Sine.easeOut', delay: 320,
    });
    // Fade out at the end
    this.tweens.add({
      targets: killTxt, alpha: 0,
      duration: 600, ease: 'Cubic.easeIn', delay: 2200,
      onComplete: function () { killTxt.destroy(); },
    });

    // Big death burst — purple core with white shrapnel, red embers
    this._explode(ex, ey, [255, 80, 80],   60);
    this._explode(ex, ey, [255, 180, 255], 44);
    this._explode(ex, ey, [120, 0, 200],   32);
    this._explode(ex, ey, [255, 255, 255], 28);
    this._spawnWaveRing(ex, ey, { maxRadius: C.GBR_SIZE * 5.5, color: 0xffffff, expandTime: 0.34 });
    this._spawnWaveRing(ex, ey, { maxRadius: C.GBR_SIZE * 3.8, color: 0xff66ff, expandTime: 0.26 });
    this._spawnWaveRing(ex, ey, { maxRadius: C.GBR_SIZE * 2.4, color: 0x9933ff, expandTime: 0.20 });
    this.cameras.main.flash(280, 255, 200, 255);
    this.cameras.main.shake(300, 0.020);
    this._triggerHitstop(C.DETONATION_HITSTOP);

    this._clearGigaBruiser(true);

    // Share the cooldown gate with the anomaly so bosses stay rare.
    this._anomalyCooldownT = C.ANO_COOLDOWN;

    // Free upgrade, independent of the kill-count threshold (same as anomaly).
    var self = this;
    this.time.delayedCall(420, function () {
      if (!self._upgradeLevels) return;
      if (self._upgradeDraftOpen || self._upSlowMoPhase) return;
      if (self._upgradePool && self._upgradePool.length > 0) self._beginUpgradeSlowMo();
    });
  };

  /* ================================================================
     PLAYER MELEE vs GIGA BRUISER (boss lives outside this.enemies)
     ================================================================ */
  M._checkGigaBruiserCollision = function () {
    var g = this._gigaBruiser;
    if (!g || g.dead) return;
    if (g.spawnPhase === 'ARRIVING') return;   // intangible while materialising
    var p = this.p;
    var isAtk  = p.state === 'ATTACKING';
    var isDAtk = p.state === 'DASH_ATTACKING';
    if (!isAtk && !isDAtk) return;

    var pR  = C.SIZE * 0.6;
    var dx  = p.x - g.x, dy = p.y - g.y;
    var d2  = dx * dx + dy * dy;
    // Larger reach when shielded (the shield sticks out past the hex body).
    var reach = g.shielded ? C.GBR_SIZE * 1.42 : C.GBR_SIZE * 1.02;
    var thr   = pR + reach;
    if (d2 > thr * thr) return;
    var dist = Math.sqrt(d2) || 0.001;
    var nx   = dx / dist, ny = dy / dist;

    if (g.shielded) {
      if (isAtk) {
        // Base attack blocked — small rebound, brief iframes
        g.shieldHitT = 1.0;
        p.vx = nx * C.REBOUND_IMP; p.vy = ny * C.REBOUND_IMP;
        p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
        p.atkAvailable = true; p.atkCooldown = 0;
        this._explode(g.x, g.y, [120, 220, 255], 8);
        this._triggerHitstop(C.HITSTOP_DUR);
        if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
      } else {
        // Dash-attack BREAKS the shield + knocks the player back hard
        this._breakGigaShield();
        p.vx = nx * C.GBR_REBOUND_IMP; p.vy = ny * C.GBR_REBOUND_IMP;
        p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
        p.atkAvailable = true; p.atkCooldown = 0;
        p.hasHitDuringDashAttack = true;
        if (!p.invincible) { p.invincible = true; p.invincTimer = 180; p.dashInvinc = true; }
      }
      return;
    }

    // ---- Unshielded body ----
    if (isAtk) {
      // Light push-back so the player can chain base attacks freely
      this._damageGigaBruiser(C.GBR_ATK_DMG);
      p.vx = nx * 5; p.vy = ny * 5;
      p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
      p.atkAvailable = true; p.atkCooldown = 0;
      if (!p.invincible) { p.invincible = true; p.invincTimer = 100; p.dashInvinc = true; }
    } else {
      // Dash-attack bounces off — more damage, but enforces spacing
      this._damageGigaBruiser(C.GBR_DASH_DMG);
      p.vx = nx * C.GBR_BOUNCE_IMP; p.vy = ny * C.GBR_BOUNCE_IMP;
      p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
      p.atkAvailable = true; p.atkCooldown = 0;
      p.hasHitDuringDashAttack = true;
      if (!p.invincible) { p.invincible = true; p.invincTimer = 160; p.dashInvinc = true; }
    }
  };

})();

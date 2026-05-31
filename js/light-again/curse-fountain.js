/* ==========================================================================
   Light Again — The Curse Fountain (random "malédiction" event)

   A dark geometric obelisk wreathed in evil mist rises from a fountain basin
   somewhere on the arena. It is the ONLY source of curses now (they no longer
   drop from the upgrade draft).

     1. SPAWN    — rare, gated, one at a time, far from the player. UNGUIDED:
                   no chevron points the way (the player must find it). Only the
                   debug/test shortcut (scene.js KeyU) spawns a guided one, with
                   the magenta chevron, to make it easy to locate while testing.
     2. IDLE     — the obelisk breathes; a ring of black mist (≈ a no-upgrade
                   dash-mark detonation wide) roils around it and SWALLOWS any
                   enemy or projectile that enters: a smooth dissolve, NO score
                   and NO combo. The player is never absorbed.
     3. OFFER    — step deep enough in (within the inner basin) and the world
                   ramps into slow-mo (the upgrade-draft machinery) for a single
                   accept / refuse CURSE choice.
     4. DISSOLVE — whichever you pick, the fountain crumbles away and re-arms on
                   a cooldown.
     5. BOSS     — when ANY boss appears the fountain is forced away (an on-screen
                   one dissolves on camera; an off-screen one just goes) and then
                   re-spawns, unguided, far from the player when the boss dies.

   Self-contained on this._fount (plain data) + four shared, persistent graphics
   objects created in init (mirrors digital-tree.js). Driven from update() on
   real dt so the cinematics read smoothly.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  /* Palette — cursed neon: violet + crimson-magenta over a near-black pool. */
  var F_DARK    = 0x0b0414;   // pool body (NORMAL blend) — near-black violet
  var F_VIOLET  = 0x7a28e0;   // neon violet
  var F_MAGENTA = 0xd11e74;   // neon crimson-magenta
  var F_CORE    = 0xff66bf;   // hot-pink core
  var F_PUFF    = [150, 40, 200];   // absorb puff (reads on ADD)

  function smooth(t) { return t * t * (3 - 2 * t); }       // smoothstep
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  /* Consume-dissolve radius envelope: after a choice the mist ring GROWS past
     its rest size, holds a beat, then eases smoothly to nothing — a comfortable
     absorbing pocket that lingers once the obelisk itself is gone. 0→1 over
     CURSE_FOUNT_LINGER_DUR; returns a × of the rest radius. */
  function fountLingerFactor(t) {
    var E = C.CURSE_FOUNT_LINGER_EXPAND, G = 0.28;
    if (t <= 0) return 1;
    if (t < G)  return 1 + (E - 1) * easeOut(t / G);     // swell outward
    return E * (1 - smooth((t - G) / (1 - G)));          // ...then ease down to 0
  }

  /* Is at least one curse still untaken? (the fountain has nothing to give once
     all curses are owned, so it stops spawning). */
  function hasUntakenCurse(scene) {
    var taken = scene._takenCurses || {};
    for (var k in LA.CURSES) { if (LA.CURSES.hasOwnProperty(k) && !taken[k]) return true; }
    return false;
  }
  function pickUntakenCurse(scene) {
    var taken = scene._takenCurses || {};
    var avail = [];
    for (var k in LA.CURSES) { if (LA.CURSES.hasOwnProperty(k) && !taken[k]) avail.push(k); }
    if (!avail.length) return null;
    return avail[(Math.random() * avail.length) | 0];
  }

  /* Self-contained keyframes for the accept/refuse overlay (the upgrade-draft
     ones may not exist yet — a fountain offer can be the first overlay shown). */
  function ensureFountStyles() {
    if (document.getElementById('_la-fount-styles')) return;
    var st = document.createElement('style');
    st.id = '_la-fount-styles';
    st.textContent = [
      '@keyframes la-fount-fade{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes la-fount-glow{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 26px 7px rgba(209,30,116,0.32)}}',
    ].join('');
    document.head.appendChild(st);
  }

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initCurseFount = function () {
    this._fount            = null;
    this._fountSpawnRollT  = 0;
    // Boss-kill gate (replaces the old time cooldown): a fountain may appear only
    // once enough bosses have fallen since the last one was CONSUMED, and the bar
    // rises each time (1 → 2 → 3 …) so fountains grow rarer / more spaced out.
    this._fountBossKills   = 0;                          // bosses defeated since the last consume
    this._fountBossReq     = C.CURSE_FOUNT_BOSS_REQ_START; // bosses needed before the next may appear
    this._fountBossSeen    = false;   // was a boss alive last tick (edge detection)
    this._fountBossHidden  = false;   // a live fountain was forced away by a boss → owe a respawn
    this._fountRespawnQueued = false; // honoured by _maybeSpawnFount once conditions clear

    // Persistent shared graphics (destroyed with the scene; cleared per-frame).
    this._fountDarkGfx = this.add.graphics();
    this._fountDarkGfx.setDepth(5);                   // dark mist pool — under enemies (20)

    this._fountGfx = this.add.graphics();
    this._fountGfx.setDepth(6);                        // pool neon + absorb FX (ground level)
    this._fountGfx.setBlendMode(Phaser.BlendModes.ADD);

    this._fountObGfx = this.add.graphics();
    this._fountObGfx.setDepth(27);                     // the obelisk stands above enemies
    this._fountObGfx.setBlendMode(Phaser.BlendModes.ADD);

    this._fountPtrGfx = this.add.graphics();
    this._fountPtrGfx.setDepth(66);                    // guidance chevron (like the ANO ptr)
    this._fountPtrGfx.setBlendMode(Phaser.BlendModes.ADD);
  };

  /* Drop the live fountain (graphics persist — just cleared). */
  M._clearCurseFount = function (silent) {
    this._fount = null;
    if (this._fountDarkGfx) this._fountDarkGfx.clear();
    if (this._fountGfx)     this._fountGfx.clear();
    if (this._fountObGfx)   this._fountObGfx.clear();
    if (this._fountPtrGfx)  this._fountPtrGfx.clear();
  };

  /* Count a defeated boss toward the next fountain's spawn gate. Called from the
     unified _bossDefeatSequence (every boss routes through it). Tutorial kills are
     ignored — the real run re-inits this counter from scratch. */
  M._noteBossDefeat = function () {
    if (this._tutorialActive) return;
    this._fountBossKills = (this._fountBossKills || 0) + 1;
  };

  /* ================================================================
     SPAWN — natural / post-boss respawn (both unguided; only debug is guided)
     ================================================================ */
  M._maybeSpawnFount = function (dt) {
    if (this._tutorialActive) return;
    if (this._anomaly || this._gigaBruiser || this._mirror || this._snake) return;
    if (!this.p || this.p.state === 'DEAD') return;
    // Mid-draft (boss reward or a fountain offer): hold — never drop a queued respawn.
    if (this._upgradeDraftOpen || this._upSlowMoPhase || this._bossDraftPending) return;
    if (!hasUntakenCurse(this)) { this._fountRespawnQueued = false; return; }

    // A boss death owes us a respawn (a live fountain the boss interrupted):
    // guaranteed, unguided, bypasses the boss-kill gate — it was already earned.
    if (this._fountRespawnQueued) {
      this._fountRespawnQueued = false;
      this._spawnCurseFount({ guided: false });
      return;
    }

    // Boss-kill gate: hold until enough bosses have fallen since the last fountain
    // was consumed (the bar rises each time — see _consumeFount / _noteBossDefeat).
    if (this._fountBossKills < this._fountBossReq) return;

    // Eligible — pick the exact moment with a per-second Bernoulli roll so the
    // fountain still surfaces unannounced somewhere in the play that follows.
    this._fountSpawnRollT += dt * 1000;
    if (this._fountSpawnRollT < 1000) return;
    this._fountSpawnRollT -= 1000;
    // Natural spawns are UNGUIDED — no chevron points the player to the fountain.
    // (Only the debug/test shortcut spawns a guided one; see scene.js KeyU.)
    if (Math.random() < C.CURSE_FOUNT_SPAWN_CHANCE) this._spawnCurseFount({ guided: false });
  };

  M._spawnCurseFount = function (opts) {
    opts = opts || {};
    if (this._fount) return;
    if (!this.p || this.p.state === 'DEAD') return;
    if (!hasUntakenCurse(this)) return;

    var dMin = opts.near ? 360 : C.CURSE_FOUNT_SPAWN_DIST_MIN;
    var dMax = opts.near ? 360 : C.CURSE_FOUNT_SPAWN_DIST_MAX;
    var m    = C.WORLD_HALF - C.CURSE_FOUNT_ZONE_R - 40;
    // Random spot far from the player AND clear of a live Digital Tree, so the
    // two map events never crowd each other (re-roll a few times, then accept).
    var avoid = this._tree, sep2 = C.MAP_FEATURE_MIN_SEP * C.MAP_FEATURE_MIN_SEP;
    var x, y, tries = 0;
    do {
      var ang  = Math.random() * TAU;
      var dist = dMin + Math.random() * (dMax - dMin);
      x = Math.max(-m, Math.min(m, this.p.x + Math.cos(ang) * dist));
      y = Math.max(-m, Math.min(m, this.p.y + Math.sin(ang) * dist));
      tries++;
    } while (avoid && tries < 20 && (x - avoid.x) * (x - avoid.x) + (y - avoid.y) * (y - avoid.y) < sep2);

    this._fount = {
      x: x, y: y,
      phase: 'IDLE',
      guided: !!opts.guided,
      zoneR: C.CURSE_FOUNT_ZONE_R,
      absorbR: C.CURSE_FOUNT_ZONE_R,    // live absorb radius (animates during the dissolve linger)
      triggerR: C.CURSE_FOUNT_TRIGGER_R,
      growT: 0,                 // 0→1 sprout-in
      age: 0,
      swirl: Math.random() * TAU,
      seed: Math.random() * 1000,
      curseId: null,
      offerT: 0,                // OFFER surge 0→1
      dissolveT: 0,             // DISSOLVE 0→dur (s)
      fadeT: 0,                 // BOSS_FADE 0→dur (s)
      plume: [], plumeT: 0,     // mist motes rising from the core
      embers: [], emberT: 0,    // motes drifting in the basin
      absorbing: [],            // dissolve FX for swallowed enemies/projectiles
    };

    // Rise burst — a rift of mist opens and the obelisk surfaces.
    this._spawnWaveRing(x, y, { maxRadius: C.CURSE_FOUNT_ZONE_R * 0.9, color: F_MAGENTA, expandTime: 0.5 });
    this._spawnWaveRing(x, y, { maxRadius: 96, color: F_VIOLET, expandTime: 0.32 });
    this._explode(x, y, [210, 40, 120], 22);
    this._explode(x, y, [120, 40, 200], 14);
  };

  /* ================================================================
     UPDATE — boss edge-detection, spawn gate, then tick the live one
     ================================================================ */
  M._updateCurseFount = function (dt) {
    var bossAlive = !!(this._anomaly || this._gigaBruiser || this._mirror || this._snake);
    // Rising edge: a boss just appeared → a live fountain is forced away.
    if (bossAlive && !this._fountBossSeen && this._fount) this._dismissFountForBoss();
    // Falling edge: the boss is gone → owe a respawn if one was hidden for it.
    if (!bossAlive && this._fountBossSeen && this._fountBossHidden) {
      this._fountBossHidden = false;
      this._fountRespawnQueued = true;
    }
    this._fountBossSeen = bossAlive;

    if (!this._fount) { this._maybeSpawnFount(dt); }
    if (this._fount)  { this._tickFount(dt); }
  };

  /* A boss appeared — a live (IDLE/OFFER) fountain leaves the field and owes a
     respawn at the boss's death. An already-dissolving one just vanishes. */
  M._dismissFountForBoss = function () {
    var f = this._fount;
    if (!f) return;
    if (this._fountPtrGfx) this._fountPtrGfx.clear();
    if (f.phase === 'DISSOLVE' || f.phase === 'BOSS_FADE') { this._clearCurseFount(true); return; }

    this._fountBossHidden = true;
    var onScreen = this.cameras.main.worldView.contains(f.x, f.y);
    if (onScreen) {
      f.phase = 'BOSS_FADE';
      f.fadeT = 0;
      this._spawnWaveRing(f.x, f.y, { maxRadius: f.zoneR * 0.8, color: F_VIOLET, expandTime: 0.42 });
      this._explode(f.x, f.y, [120, 30, 180], 16);
    } else {
      this._clearCurseFount(true);
    }
  };

  /* ================================================================
     TICK — idle absorb / offer trigger / dissolve, plus mote sims (real dt)
     ================================================================ */
  M._tickFount = function (dt) {
    var f = this._fount, p = this.p, ms = dt * 1000;

    f.growT = Math.min(1, f.growT + dt * 1.4);
    f.swirl += dt;
    f.age   += ms;

    // Effective absorb radius per phase: the rest zone while live; an expanding-
    // then-fading pocket through the post-choice dissolve (the "comfortable zone").
    var canAbsorb = false;
    if (f.phase === 'IDLE') {
      f.absorbR = f.zoneR;
      canAbsorb = true;
      // Stepped deep into the basin → the curse offer.
      if (p && p.state !== 'DEAD' && !this._twActive) {
        var pdx = p.x - f.x, pdy = p.y - f.y;
        if (pdx * pdx + pdy * pdy <= f.triggerR * f.triggerR) this._beginFountOffer();
      }
    } else if (f.phase === 'OFFER') {
      f.absorbR = f.zoneR;
      f.offerT = Math.min(1, f.offerT + dt / 0.6);   // surge over the slow-mo ramp
    } else if (f.phase === 'DISSOLVE') {
      f.dissolveT += dt;
      var prog = Math.min(1, f.dissolveT / (C.CURSE_FOUNT_LINGER_DUR / 1000));
      f.absorbR = f.zoneR * fountLingerFactor(prog);   // swell, then ease to nothing
      canAbsorb = f.absorbR > 4;                        // keeps swallowing as it lingers
      if (prog >= 1) { this._clearCurseFount(true); return; }
    } else if (f.phase === 'BOSS_FADE') {
      f.absorbR = 0;                                    // a boss is here — no safe pocket
      f.fadeT += dt;
      if (f.fadeT >= C.CURSE_FOUNT_FADE_DUR / 1000) { this._clearCurseFount(true); return; }
    }

    // Swallow enemies/projectiles in range (skip while Time Stop owns the board).
    if (canAbsorb && !this._twActive) this._fountAbsorb();

    this._fountTickMotes(dt);
    this._fountTickAbsorbing(dt);

    this._renderFount(dt);
    this._renderFountPointer();
  };

  /* Swallow every enemy + projectile whose centre lies inside the mist ring.
     Removed SILENTLY: no kill count, no score, no combo, no float. */
  M._fountAbsorb = function () {
    var f = this._fount;
    var R = f.absorbR != null ? f.absorbR : f.zoneR, zr2 = R * R;

    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      var dx = e.x - f.x, dy = e.y - f.y;
      if (dx * dx + dy * dy <= zr2) {
        var col = e.tier === 3 ? [180, 90, 255] : e.tier === 2 ? [255, 150, 70] : [255, 50, 90];
        this._spawnAbsorb(e.x, e.y, e.size, e.tier, col);
        e.spr.destroy();
        for (var t = 0; t < e.trSpr.length; t++) e.trSpr[t].destroy();
        if (e.shieldGfx) { e.shieldGfx.destroy(); e.shieldGfx = null; }
        this.enemies.splice(i, 1);
      }
    }

    for (var j = this.projectiles.length - 1; j >= 0; j--) {
      var pr = this.projectiles[j];
      var px = pr.x - f.x, py = pr.y - f.y;
      if (px * px + py * py <= zr2) {
        this._spawnAbsorb(pr.x, pr.y, C.PROJ_RADIUS, 0, [220, 70, 170]);
        this._destroyProjectile(pr);
        this.projectiles.splice(j, 1);
      }
    }
  };

  /* Register a smooth "sucked into the mist" dissolve at (x,y). tier 0 = a
     projectile (a small quick implode); 1-3 = an enemy (a shrinking polygon). */
  M._spawnAbsorb = function (x, y, size, tier, col) {
    var f = this._fount;
    if (!f || f.absorbing.length >= 64) return;
    f.absorbing.push({
      x: x, y: y, ox: x, oy: y,
      size: size, tier: tier, col: col,
      t: 0, dur: tier === 0 ? 0.30 : (0.40 + Math.random() * 0.12),
      spin: Math.random() * TAU, spinV: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 5),
      wisps: [],
    });
    this._explode(x, y, F_PUFF, tier === 0 ? 3 : 6);
  };

  M._fountTickAbsorbing = function (dt) {
    var f = this._fount;
    for (var i = f.absorbing.length - 1; i >= 0; i--) {
      var a = f.absorbing[i];
      a.t += dt;
      var pr = a.t / a.dur;
      if (pr >= 1) { f.absorbing.splice(i, 1); continue; }
      a.spin += a.spinV * dt;
      // Eased pull part-way toward the obelisk, with a slight upward lift (it
      // rises into the mist as it unravels) — never the whole way, so it reads
      // as "dragged in and dissolved" rather than teleporting to the centre.
      var e = smooth(pr);
      a.x = a.ox + (f.x - a.ox) * e * 0.5;
      a.y = a.oy + (f.y - a.oy) * e * 0.5 - e * 12;
      if (Math.random() < 0.5 && a.wisps.length < 6) {
        a.wisps.push({ x: a.x, y: a.y, vx: (Math.random() - 0.5) * 14, vy: -20 - Math.random() * 24, life: 1 });
      }
      for (var w = a.wisps.length - 1; w >= 0; w--) {
        var ws = a.wisps[w];
        ws.x += ws.vx * dt; ws.y += ws.vy * dt; ws.life -= dt * 1.6;
        if (ws.life <= 0) a.wisps.splice(w, 1);
      }
    }
  };

  /* Mist plume (rises from the core, arcs out and rains back into the basin)
     + faint embers drifting in the pool. Both pause once the fountain is going. */
  M._fountTickMotes = function (dt) {
    var f = this._fount, ms = dt * 1000, grow = smooth(f.growT);
    // The mist stays alive through the lingering dissolve (it rises from the pool
    // now the obelisk is gone); only a boss arrival cuts it dead.
    var settled = f.phase !== 'BOSS_FADE';
    var dissolving = f.phase === 'DISSOLVE';
    var curR = f.absorbR != null ? f.absorbR : f.zoneR;

    f.plumeT += ms;
    if (settled && grow > 0.4 && f.plume.length < 28 && f.plumeT > 64) {
      f.plumeT = 0;
      var H = C.CURSE_FOUNT_SIZE * 1.7 * grow * (dissolving ? 0.2 : 1);   // low, ground-hugging once dissolving
      f.plume.push({
        x: f.x + (Math.random() - 0.5) * 10, y: f.y - H * 0.62,
        vx: (Math.random() - 0.5) * 18, vy: -28 - Math.random() * 26,
        side: Math.random() < 0.5 ? -1 : 1, life: 1, size: 3 + Math.random() * 4,
      });
    }
    for (var i = f.plume.length - 1; i >= 0; i--) {
      var mo = f.plume[i];
      mo.vy += 64 * dt;                 // gravity → the fountain "fall"
      mo.vx += mo.side * 16 * dt;       // spread outward on the way down
      mo.x += mo.vx * dt; mo.y += mo.vy * dt;
      mo.life -= dt * 0.5;
      if (mo.life <= 0 || mo.y > f.y + 6) f.plume.splice(i, 1);
    }

    f.emberT += ms;
    if (settled && grow > 0.5 && f.embers.length < 22 && f.emberT > 110) {
      f.emberT = 0;
      var ea = Math.random() * TAU, er = Math.random() * curR * 0.92 * grow;
      f.embers.push({ x: f.x + Math.cos(ea) * er, y: f.y + Math.sin(ea) * er,
                      vx: (Math.random() - 0.5) * 8, vy: -6 - Math.random() * 10,
                      life: 1, size: 1 + Math.random() * 2 });
    }
    for (var j = f.embers.length - 1; j >= 0; j--) {
      var em = f.embers[j];
      em.x += em.vx * dt; em.y += em.vy * dt; em.life -= dt * 0.6;
      if (em.life <= 0) f.embers.splice(j, 1);
    }
  };

  /* ================================================================
     OFFER — slow-mo into a single accept/refuse curse choice
     ================================================================ */
  M._beginFountOffer = function () {
    var f = this._fount;
    if (!f || f.phase !== 'IDLE') return;
    var cid = pickUntakenCurse(this);
    if (!cid) { this._consumeFount(false); return; }   // nothing left to give → just dissolve

    f.curseId = cid;
    f.phase   = 'OFFER';
    f.offerT  = 0;
    if (this._fountPtrGfx) this._fountPtrGfx.clear();

    // Ominous reaction, then ramp the world into the choice (upgrade slow-mo).
    this._explode(f.x, f.y, [210, 40, 120], 20);
    this._spawnWaveRing(f.x, f.y, { maxRadius: f.zoneR * 0.7, color: F_MAGENTA, expandTime: 0.45 });
    this.cameras.main.shake(140, 0.005);
    this._beginCurseFountainOffer(cid);
  };

  /* Accepted or refused, the fountain is spent: dissolve away + re-arm cooldown.
     Called from the accept/refuse UI handlers (the scene is resumed right after). */
  M._consumeFount = function (accepted) {
    var f = this._fount;
    // Escalating boss-kill gate: a consumed fountain (accepted OR refused) pushes
    // the next one further out — it needs one more boss kill than this one did
    // (1 → 2 → 3 …). Counter resets so the wait starts from this consume.
    this._fountBossKills  = 0;
    this._fountBossReq    = (this._fountBossReq || C.CURSE_FOUNT_BOSS_REQ_START) + C.CURSE_FOUNT_BOSS_REQ_STEP;
    this._fountSpawnRollT = 0;
    if (!f) return;
    f.phase = 'DISSOLVE';
    f.dissolveT = 0;
    f.accepted = !!accepted;
    f.absorbR = f.zoneR;
    // No plain shockwave ring: the obelisk crumbles and its mist ring SWELLS
    // outward then fades to nothing (still swallowing enemies/projectiles the
    // whole time — a comfortable pocket that lingers a beat). See _tickFount.
    if (accepted) {
      this._explode(f.x, f.y, [220, 20, 80], 24);
      this._explode(f.x, f.y, [120, 0, 160], 14);
    } else {
      this._explode(f.x, f.y, [120, 40, 180], 16);
    }
  };

  /* ================================================================
     RENDER — dark mist pool (NORMAL) + neon basin/absorb FX (ADD) + the
     obelisk & its mist plume (ADD, above enemies).
     ================================================================ */
  M._renderFount = function (dt) {
    var f = this._fount, gt = this.gameTime;
    var dg = this._fountDarkGfx, ng = this._fountGfx, og = this._fountObGfx;
    dg.clear(); ng.clear(); og.clear();
    if (!f) return;

    var grow = smooth(f.growT);
    var surge = f.phase === 'OFFER' ? smooth(f.offerT) : 0;
    var x = f.x, y = f.y;

    // Pool radius + body alpha, plus a SEPARATE obelisk-crumble factor so the
    // monolith can vanish well before the mist pocket finishes dissipating.
    var R, bodyA, obDissolve;
    if (f.phase === 'DISSOLVE') {
      var prog = Math.min(1, f.dissolveT / (C.CURSE_FOUNT_LINGER_DUR / 1000));
      var rr0  = (f.absorbR != null ? f.absorbR : f.zoneR);
      R = rr0 * grow;
      bodyA = grow * Math.min(1, rr0 / f.zoneR);           // full while swollen, fades as it shrinks
      obDissolve = smooth(Math.min(1, prog / 0.4));         // obelisk gone by ~40% of the linger
    } else if (f.phase === 'BOSS_FADE') {
      var fd = smooth(Math.min(1, f.fadeT / (C.CURSE_FOUNT_FADE_DUR / 1000)));
      R = f.zoneR * grow * (1 - 0.45 * fd);
      bodyA = grow * (1 - fd);
      obDissolve = 0;                                        // obelisk fades uniformly with the pool here
    } else {
      R = f.zoneR * grow * (1 - 0.10 * surge);
      bodyA = grow;
      obDissolve = 0;
    }
    if (bodyA <= 0.001) return;
    var hot = 0.6 + 0.4 * Math.sin(gt * 3 + f.seed);   // shared pulse

    // ---------- DARK MIST POOL (normal blend, layered radial dark) ----------
    var steps = 6;
    for (var s = steps; s >= 1; s--) {
      var rr = R * (s / steps);
      dg.fillStyle(F_DARK, 0.16 * bodyA);
      dg.fillCircle(x, y, rr);
    }
    // Dark drifting puffs near the rim give the pool a roiling, smoky body.
    for (var dpi = 0; dpi < 10; dpi++) {
      var da = (dpi / 10) * TAU + f.swirl * 0.6;
      var dr = R * (0.62 + 0.26 * Math.sin(gt * 1.4 + dpi * 1.7 + f.seed));
      dg.fillStyle(F_DARK, 0.18 * bodyA);
      dg.fillCircle(x + Math.cos(da) * dr, y + Math.sin(da) * dr * 0.9, 26 * grow);
    }

    // ---------- BASIN NEON (ADD) — roiling rim, swirling arcs, embers ----------
    // Perturbed rim ring: a closed path whose radius wobbles with angle + time.
    var N = 64, rimGlow = (0.5 + 0.5 * hot);
    function rimAt(k) {
      var ang = (k / N) * TAU;
      var wob = 1 + 0.06 * Math.sin(ang * 3 + gt * 1.6 + f.seed)
                  + 0.04 * Math.sin(ang * 7 - gt * 2.1)
                  + 0.05 * surge * Math.sin(ang * 5 + gt * 6);
      return { ax: x + Math.cos(ang) * R * wob, ay: y + Math.sin(ang) * R * wob };
    }
    // soft outer glow then a crisp magenta edge
    ng.lineStyle(7 * grow, F_MAGENTA, 0.10 * bodyA * rimGlow);
    ng.beginPath();
    for (var k0 = 0; k0 <= N; k0++) { var pA = rimAt(k0 % N); if (k0 === 0) ng.moveTo(pA.ax, pA.ay); else ng.lineTo(pA.ax, pA.ay); }
    ng.strokePath();
    ng.lineStyle(2.2 * grow, F_MAGENTA, (0.5 + 0.4 * surge) * bodyA * rimGlow);
    ng.beginPath();
    for (var k1 = 0; k1 <= N; k1++) { var pB = rimAt(k1 % N); if (k1 === 0) ng.moveTo(pB.ax, pB.ay); else ng.lineTo(pB.ax, pB.ay); }
    ng.strokePath();

    // Rotating inner mist arcs (the swirl), three radii / speeds.
    for (var arc = 0; arc < 3; arc++) {
      var ar = R * (0.34 + arc * 0.22);
      var aStart = f.swirl * (0.5 + arc * 0.35) + arc * 2.1;
      var aLen   = 1.6 + 0.5 * Math.sin(gt * 1.3 + arc);
      ng.lineStyle((3 - arc * 0.6) * grow, arc % 2 ? F_VIOLET : F_MAGENTA, (0.30 - arc * 0.06) * bodyA);
      ng.beginPath();
      ng.arc(x, y, ar, aStart, aStart + aLen, false);
      ng.strokePath();
    }

    // Inner basin ring (telegraphs where the curse offer triggers).
    var trR = f.triggerR * grow * (1 + 0.04 * Math.sin(gt * 4));
    ng.lineStyle(1.6 * grow, F_CORE, (0.22 + 0.18 * hot + 0.4 * surge) * bodyA);
    ng.strokeCircle(x, y, trR);

    // Drifting embers in the basin.
    for (var ei = 0; ei < f.embers.length; ei++) {
      var em = f.embers[ei];
      var ea2 = Math.max(0, em.life);
      ng.fillStyle(F_CORE, ea2 * 0.5 * bodyA);
      ng.fillCircle(em.x, em.y, em.size);
    }

    // Absorb FX — shrinking, spinning silhouettes dragged into the mist.
    this._renderAbsorbing(ng, bodyA);

    // ---------- THE OBELISK (ADD, above enemies) + mist plume ----------
    this._renderObelisk(og, dg, x, y, grow, bodyA, obDissolve, surge, hot, gt);

    // Mist plume motes (glowing wisps rising from the core, falling to the pool).
    for (var pi = 0; pi < f.plume.length; pi++) {
      var mo = f.plume[pi];
      var ml = Math.max(0, mo.life);
      og.fillStyle(F_VIOLET, ml * 0.22 * bodyA);
      og.fillCircle(mo.x, mo.y, mo.size * 1.8);
      og.fillStyle(F_CORE, ml * 0.5 * bodyA);
      og.fillCircle(mo.x, mo.y, mo.size * 0.7);
    }
  };

  /* Shrinking neon silhouettes for swallowed entities (drawn on the basin ADD
     layer). Enemies fade red/orange/violet → cursed violet as they unravel. */
  M._renderAbsorbing = function (g, bodyA) {
    var f = this._fount;
    for (var i = 0; i < f.absorbing.length; i++) {
      var a = f.absorbing[i];
      var pr = a.t / a.dur, fade = (1 - pr) * bodyA;
      if (fade <= 0) continue;
      // Colour bleeds from its native tint toward cursed violet as it dissolves.
      var cr = Math.round(a.col[0] * (1 - pr) + 122 * pr);
      var cg = Math.round(a.col[1] * (1 - pr) + 40 * pr);
      var cb = Math.round(a.col[2] * (1 - pr) + 224 * pr);
      var col = (cr << 16) | (cg << 8) | cb;
      var sz = a.size * (1 - smooth(pr)) * 1.15;

      // rising wisps
      for (var w = 0; w < a.wisps.length; w++) {
        var ws = a.wisps[w];
        g.fillStyle(F_VIOLET, Math.max(0, ws.life) * 0.5 * bodyA);
        g.fillCircle(ws.x, ws.y, 2.2);
      }
      if (sz < 0.5) continue;

      // a small spinning polygon outline (sides by tier) + a hot core
      var sides = a.tier === 0 ? 0 : (a.tier === 3 ? 6 : a.tier === 2 ? 4 : 3);
      g.fillStyle(col, 0.35 * fade);
      g.fillCircle(a.x, a.y, sz * 1.5);
      if (sides >= 3) {
        g.lineStyle(2, col, 0.95 * fade);
        g.beginPath();
        for (var v = 0; v <= sides; v++) {
          var va = a.spin + (v / sides) * TAU;
          var vx = a.x + Math.cos(va) * sz, vy = a.y + Math.sin(va) * sz;
          if (v === 0) g.moveTo(vx, vy); else g.lineTo(vx, vy);
        }
        g.strokePath();
      }
      g.fillStyle(0xffffff, 0.7 * fade);
      g.fillCircle(a.x, a.y, sz * 0.4);
    }
  };

  /* The dark geometric obelisk: a faceted monolith with neon edges, internal
     veins, a pulsing core that breathes the mist, and a pair of orbiting rune
     rings. `dg` (dark layer) carries faceted shadow fills; `g` (ADD) the neon. */
  M._renderObelisk = function (g, dg, x, y, grow, bodyA, dissolve, surge, hot, gt) {
    var f = this._fount;
    var obA = bodyA * (1 - dissolve);                                   // monolith fades as it crumbles
    var H  = C.CURSE_FOUNT_SIZE * 1.7 * grow * (1 - 0.7 * dissolve);    // ...and sinks into the basin
    var hw = C.CURSE_FOUNT_SIZE * 0.34 * grow * (1 - 0.4 * dissolve);
    var by = y - 2;                 // base sits just behind the pool centre
    var ty = by - H;                // apex
    var coreX = x, coreY = by - H * 0.6;
    var neonA = obA * (0.85 + 0.3 * surge);

    // Outline points (bottom-L → mid-L → shoulder-L → apex → shoulder-R → mid-R → bottom-R)
    var pts = [
      { x: x - hw,        y: by },
      { x: x - hw * 0.82, y: by - H * 0.5 },
      { x: x - hw * 0.5,  y: by - H * 0.82 },
      { x: x,             y: ty },
      { x: x + hw * 0.5,  y: by - H * 0.82 },
      { x: x + hw * 0.82, y: by - H * 0.5 },
      { x: x + hw,        y: by },
    ];

    // Faceted dark body (NORMAL layer) — left/right facets split by the ridge.
    function poly(layer, arr, color, alpha) {
      layer.fillStyle(color, alpha);
      layer.beginPath();
      layer.moveTo(arr[0].x, arr[0].y);
      for (var i = 1; i < arr.length; i++) layer.lineTo(arr[i].x, arr[i].y);
      layer.closePath();
      layer.fillPath();
    }
    var apex = pts[3], base = { x: x, y: by };
    poly(dg, [pts[0], pts[1], pts[2], apex, base], 0x140a22, 0.92 * obA);            // left facet (darker)
    poly(dg, [apex, pts[4], pts[5], pts[6], base], 0x0c0518, 0.92 * obA);            // right facet (darkest)

    // Faint violet interior glow (ADD) so the monolith reads as a dark crystal.
    poly(g, pts, F_VIOLET, 0.10 * neonA);

    // Neon edge — soft glow pass then a crisp bright pass.
    g.lineStyle(5 * grow, F_VIOLET, 0.16 * neonA);
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (var i1 = 1; i1 < pts.length; i1++) g.lineTo(pts[i1].x, pts[i1].y);
    g.closePath(); g.strokePath();
    g.lineStyle(2 * grow, F_MAGENTA, 0.95 * neonA);
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (var i2 = 1; i2 < pts.length; i2++) g.lineTo(pts[i2].x, pts[i2].y);
    g.closePath(); g.strokePath();

    // Central ridge + two internal veins (the geometric "circuitry").
    g.lineStyle(1.5 * grow, F_CORE, 0.7 * neonA);
    g.beginPath(); g.moveTo(base.x, base.y); g.lineTo(apex.x, apex.y); g.strokePath();
    g.lineStyle(1.2 * grow, F_VIOLET, (0.4 + 0.3 * hot) * neonA);
    g.beginPath(); g.moveTo(pts[1].x, pts[1].y); g.lineTo(coreX, coreY); g.lineTo(pts[5].x, pts[5].y); g.strokePath();
    g.beginPath(); g.moveTo(pts[2].x, pts[2].y); g.lineTo(coreX, coreY); g.lineTo(pts[4].x, pts[4].y); g.strokePath();

    // Orbiting rune rings near the apex (two thin ellipses, counter-rotating).
    for (var rr = 0; rr < 2; rr++) {
      var rot = f.swirl * (rr ? -1.1 : 1.4) + rr * 1.0;
      var rRad = (hw * (1.5 + rr * 0.7));
      g.lineStyle(1.2 * grow, rr ? F_MAGENTA : F_VIOLET, (0.35 + 0.25 * hot) * neonA);
      g.beginPath();
      for (var a3 = 0; a3 <= 24; a3++) {
        var aa = (a3 / 24) * TAU;
        var rx = coreX + Math.cos(aa) * rRad;
        var ry = coreY + Math.sin(aa) * rRad * 0.34 + Math.sin(rot) * 1.2;
        if (a3 === 0) g.moveTo(rx, ry); else g.lineTo(rx, ry);
      }
      g.strokePath();
    }

    // Pulsing core "eye" that breathes the mist.
    var coreP = 0.6 + 0.4 * Math.sin(gt * 5 + f.seed) + 0.5 * surge;
    var coreR = (5 + 3 * coreP) * grow;
    g.fillStyle(F_MAGENTA, 0.30 * neonA);
    g.fillCircle(coreX, coreY, coreR * 2.4);
    g.fillStyle(F_CORE, 0.9 * neonA);
    g.fillCircle(coreX, coreY, coreR);
    g.fillStyle(0xffffff, 0.95 * neonA);
    g.fillCircle(coreX, coreY, coreR * 0.42);

    // A faint dark "mouth" of mist at the obelisk base on the dark layer.
    dg.fillStyle(F_DARK, 0.4 * obA);
    dg.fillEllipse(x, by, hw * 2.2, 8 * grow);
  };

  /* ================================================================
     GUIDANCE CHEVRON — identical logic & look to the Anomaly/Tree pointer,
     here in cursed magenta. Debug/test spawns only (f.guided); every in-game
     spawn — natural and post-boss respawn alike — is blind.
     ================================================================ */
  M._renderFountPointer = function () {
    var f = this._fount, p = this.p, pg = this._fountPtrGfx, gt = this.gameTime;
    pg.clear();
    if (!f || !f.guided || f.phase !== 'IDLE' || !p || p.state === 'DEAD') return;

    var pdx = f.x - p.x, pdy = f.y - p.y;
    var pdd = Math.sqrt(pdx * pdx + pdy * pdy);
    if (pdd <= 1) return;

    var pAng = Math.atan2(pdy, pdx);
    var D    = C.CURSE_FOUNT_PTR_DIST;
    var px = p.x + Math.cos(pAng) * D;
    var py = p.y + Math.sin(pAng) * D;
    var pulse = 0.55 + 0.45 * Math.abs(Math.sin(gt * Math.PI * 3.2));
    var col   = F_MAGENTA;
    var size  = 18;

    var nose = { x: Math.cos(pAng) * size,       y: Math.sin(pAng) * size };
    var lwn  = { x: Math.cos(pAng + 2.5) * size, y: Math.sin(pAng + 2.5) * size };
    var rwn  = { x: Math.cos(pAng - 2.5) * size, y: Math.sin(pAng - 2.5) * size };

    pg.fillStyle(col, 0.18 * pulse);
    pg.fillTriangle(px + nose.x * 1.35, py + nose.y * 1.35,
                    px + lwn.x  * 1.35, py + lwn.y  * 1.35,
                    px + rwn.x  * 1.35, py + rwn.y  * 1.35);
    pg.fillStyle(col, 0.85 * pulse);
    pg.fillTriangle(px + nose.x, py + nose.y,
                    px + lwn.x,  py + lwn.y,
                    px + rwn.x,  py + rwn.y);
    pg.fillStyle(0xffffff, 0.9 * pulse);
    pg.fillTriangle(px + nose.x * 0.55, py + nose.y * 0.55,
                    px + lwn.x  * 0.45, py + lwn.y  * 0.45,
                    px + rwn.x  * 0.45, py + rwn.y  * 0.45);
    pg.lineStyle(1.5, 0xffffff, 0.9 * pulse);
    pg.beginPath();
    pg.moveTo(px + nose.x, py + nose.y);
    pg.lineTo(px + lwn.x,  py + lwn.y);
    pg.lineTo(px + rwn.x,  py + rwn.y);
    pg.closePath();
    pg.strokePath();
  };

  /* ================================================================
     ACCEPT / REFUSE UI — a DOM overlay (reuses the draft overlay id so the
     existing _closeDraft teardown cleans it up). Shown by _openUpgradeDraft
     once the slow-mo ramp finishes (see upgrades.js).
     ================================================================ */
  M._showCurseFountainUI = function (curseId) {
    if (document.getElementById('_la-upgrade-overlay')) return;
    ensureFountStyles();

    var canvas    = this.game.canvas;
    var container = canvas.parentElement;
    var sceneRef  = this;
    var t         = LA.laGoT;
    var cdef      = LA.CURSES[curseId];

    var overlay = document.createElement('div');
    overlay.id = '_la-upgrade-overlay';
    overlay.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:55',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(8,2,12,0.74)', 'font-family:monospace',
      'pointer-events:auto',
    ].join(';');

    var panel = document.createElement('div');
    panel.style.cssText = [
      'text-align:center', 'padding:1.5rem 1.8rem 1.2rem',
      'border:2px solid rgba(209,30,116,0.6)', 'border-radius:16px',
      'background:linear-gradient(135deg, rgba(18,4,14,0.94) 0%, rgba(30,6,28,0.94) 100%)',
      'max-width:400px', 'width:92%',
      'color:#ffcce0',
      'animation:la-fount-fade 0.5s cubic-bezier(0.22,1,0.36,1) both,la-fount-glow 2.2s ease infinite',
      'box-shadow:0 0 40px 8px rgba(209,30,116,0.18), inset 0 0 30px rgba(122,40,224,0.06)',
    ].join(';');

    // Title
    var title = document.createElement('div');
    title.style.cssText = 'font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:#ff5c9c;margin-bottom:.7rem';
    title.textContent = t('laFountTitle');
    panel.appendChild(title);

    // Icon
    var imgWrap = document.createElement('div');
    imgWrap.style.cssText = [
      'width:72px', 'height:72px', 'margin:0 auto .6rem',
      'border:2px solid rgba(209,30,116,0.5)', 'border-radius:10px',
      'background:rgba(122,40,224,0.10)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:2rem', 'color:#ff5c9c',
    ].join(';');
    imgWrap.innerHTML = LA.iconSvg(curseId, 'la-up-ph');
    var _fIco = imgWrap.firstChild;
    if (_fIco && _fIco.setAttribute) { _fIco.setAttribute('width', '46'); _fIco.setAttribute('height', '46'); }
    panel.appendChild(imgWrap);

    // Curse name
    var name = document.createElement('div');
    name.style.cssText = 'font-size:.86rem;font-weight:700;color:#ff5c9c;margin-bottom:.25rem;letter-spacing:.06em';
    name.textContent = t(cdef.i18nName);
    panel.appendChild(name);

    // Badge
    var badge = document.createElement('span');
    badge.style.cssText = [
      'display:inline-block',
      'font-size:.48rem', 'letter-spacing:.1em', 'text-transform:uppercase',
      'padding:.12rem .5rem', 'border-radius:4px', 'margin-bottom:.5rem',
      'background:rgba(209,30,116,0.18)', 'color:#ff5c9c',
      'border:1px solid rgba(209,30,116,0.45)',
    ].join(';');
    badge.textContent = t('laUpCurseBadge');
    panel.appendChild(badge);

    // Description
    var desc = document.createElement('div');
    desc.style.cssText = 'font-size:.58rem;color:#e0a6c4;line-height:1.5;margin:.1rem 0 .5rem';
    desc.textContent = t(cdef.i18nDesc);
    panel.appendChild(desc);

    // Question
    var ask = document.createElement('div');
    ask.style.cssText = 'font-size:.6rem;color:#caa6d8;margin-bottom:.9rem;font-weight:700';
    ask.textContent = t('laFountQuestion');
    panel.appendChild(ask);

    // --- Accept / Refuse buttons ---
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:.8rem;justify-content:center;align-items:stretch';

    function mkBtn(label, accent, bg, accept) {
      var b = document.createElement('button');
      b.className = '_la-up-card';
      b.style.cssText = [
        'flex:1 1 0', 'padding:.6rem .8rem',
        'border:1.5px solid ' + accent, 'border-radius:10px',
        'background:' + bg, 'color:#fff', 'cursor:pointer',
        'font-family:monospace', 'font-size:.7rem', 'font-weight:700',
        'letter-spacing:.06em', 'text-transform:uppercase',
        'transition:transform .14s,box-shadow .2s,border-color .2s', 'outline:none',
        'animation:la-fount-fade 0.45s cubic-bezier(0.22,1,0.36,1) both',
      ].join(';');
      b.textContent = label;
      b.addEventListener('mouseenter', function () {
        b.style.transform = 'translateY(-3px) scale(1.04)';
        b.style.boxShadow = '0 0 20px 4px ' + accent;
      });
      b.addEventListener('mouseleave', function () {
        b.style.transform = '';
        b.style.boxShadow = '';
      });
      b.addEventListener('click', function () {
        if (b._done) return; b._done = true;
        if (accept) {
          sceneRef._applyCurse(curseId);
          sceneRef._floatLabel(sceneRef.p.x, sceneRef.p.y - 30, t(cdef.i18nName), '#ff5c9c');
        } else {
          sceneRef._floatLabel(sceneRef.p.x, sceneRef.p.y - 30, t('laFountRefused'), '#b9a0e8');
        }
        sceneRef._consumeFount(accept);
        sceneRef._closeDraft();
      });
      return b;
    }

    row.appendChild(mkBtn(t('laFountRefuse'), 'rgba(150,120,220,0.85)', 'rgba(40,24,64,0.92)', false));
    row.appendChild(mkBtn(t('laFountAccept'), 'rgba(230,40,90,0.95)',  'rgba(60,8,24,0.95)',  true));
    panel.appendChild(row);

    overlay.appendChild(panel);
    container.appendChild(overlay);

    overlay.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    var firstBtn = overlay.querySelector('._la-up-card');
    if (firstBtn) setTimeout(function () { firstBtn.focus(); }, 80);
  };

})();

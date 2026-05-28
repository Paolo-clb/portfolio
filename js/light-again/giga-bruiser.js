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
  };

  /* ================================================================
     SPAWN — same far-off arrival as the anomaly, just no intro cinematic
     ================================================================ */
  M._spawnGigaBruiser = function () {
    if (this._gigaBruiser || this._anomaly) return;
    if (!this.p || this.p.state === 'DEAD') return;

    var ang  = Math.random() * TAU;
    var dist = 820;
    var m    = C.WORLD_HALF - C.GBR_SIZE * 1.5;
    var x = Math.max(-m, Math.min(m, this.p.x + Math.cos(ang) * dist));
    var y = Math.max(-m, Math.min(m, this.p.y + Math.sin(ang) * dist));

    var gfx         = this.add.graphics(); gfx.setDepth(25);
    var fractureGfx = this.add.graphics(); fractureGfx.setDepth(26);
    var shieldGfx   = this.add.graphics(); shieldGfx.setDepth(27);
    shieldGfx.setBlendMode(Phaser.BlendModes.ADD);

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
      fractures: [],         // accumulated jagged crack lines
      // Shockwave attack state — see _beginGigaShockwave / _fireGigaShockwave
      shockwavePhase: null,  // null | 'CHARGING' | 'BLAST'
      shockwaveT:     0,     // ms elapsed in the current phase
      shockwaveCD:    0,     // ms until another shockwave is allowed
      dmgAccum:       0,     // HP lost since last shockwave (or since spawn)
      gfx: gfx, shieldGfx: shieldGfx, fractureGfx: fractureGfx,
      dead: false,
    };

    // Arrival burst (purple — bruiser palette, not anomaly's magenta)
    this._spawnWaveRing(x, y, { maxRadius: 240, color: 0x9933ff, expandTime: 0.34 });
    this._spawnWaveRing(x, y, { maxRadius: 160, color: 0xffffff, expandTime: 0.22 });
    this._explode(x, y, [187, 0, 255], 28);
    this._explode(x, y, [255, 180, 255], 16);
    this._explode(x, y, [255, 255, 255], 14);
    this.cameras.main.shake(160, 0.010);
  };

  /* ================================================================
     UPDATE — per-frame logic (scaled world-time sMs)
     ================================================================ */
  M._updateGigaBruiser = function (sMs, pMs, dt) {
    if (!this._gigaBruiser) return;
    var g = this._gigaBruiser, p = this.p;
    if (p.state === 'DEAD') { this._renderGigaBruiser(dt); return; }
    if (this._twActive || sMs < 0.001) { this._renderGigaBruiser(dt); return; }

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
    g.spawnCD -= sMs;
    if (g.spawnCD <= 0) {
      g.spawnCD = C.GBR_SPAWN_CD * (0.85 + Math.random() * 0.3);
      var slots  = C.MAX_ENEMIES - this.enemies.length;
      var swarmN = Math.min(slots, C.GBR_SWARM_SIZE);
      if (swarmN > 0) {
        var baseAng = Math.random() * TAU;
        var ringR   = C.GBR_SIZE * 1.5;
        for (var sw = 0; sw < swarmN; sw++) {
          var sAng = baseAng + (sw / swarmN) * TAU;
          var spx  = g.x + Math.cos(sAng) * ringR;
          var spy  = g.y + Math.sin(sAng) * ringR;
          this._spawnBruiserAt(spx, spy);
          var spawned = this.enemies[this.enemies.length - 1];
          spawned.vx = Math.cos(sAng) * 5;
          spawned.vy = Math.sin(sAng) * 5;
          this._hiveSpawnBeam(g.x, g.y, spx, spy);
        }
        this._explode(g.x, g.y, [187, 0, 255], 20);
        this._explode(g.x, g.y, [255, 150, 255], 10);
        this.cameras.main.shake(70, 0.004);
      }
    }

    this._renderGigaBruiser(dt);
  };

  /* ================================================================
     RENDER — hex body (tinted by HP), fractures, shield ring
     ================================================================ */
  M._renderGigaBruiser = function (_dt) {
    var g = this._gigaBruiser;
    if (!g) return;
    var gt = this.gameTime;
    var R  = C.GBR_SIZE;

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

    this._floatLabel(ex, ey - C.GBR_SIZE - 14, 'GIGA SHATTERED', '#ff66ff', 0);

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

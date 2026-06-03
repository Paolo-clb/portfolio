/* ==========================================================================
   Light Again — The Sniper (T4 "Œil-scope"): AI, fire, render (scene methods)
   --------------------------------------------------------------------------
   A cyclopean steel scope-lens that snipes from the far edge of the screen.
   Lives in this.enemies as tier 4 (2 HP, no shield). Its cycle:

     CLOAK   near-invisible + INVINCIBLE, slowly orbiting to a fresh far
             vantage. The World does NOT reveal it here.
     CHARGE  it materialises at a guaranteed on-screen vantage and an
             iris/réticule locks onto the player with a visible charge
             animation. This is the ONLY window it can be hit.
     FIRE    a single, very fast, NON-reflectable laser bolt aimed at the
             player's position at the instant of the shot (no trajectory
             telegraph), then a recoil + muzzle flash.
     VANISH  it snaps shut, fades out and re-cloaks.

   During CHARGE/FIRE a dash-attack or a detonation ONE-SHOTS it (collisions.js
   gives a dash-attack 2 dmg vs a sniper), else 2 basic hits. While CLOAK it is
   intangible to every damage source via e._snIntangible (guarded across
   collisions / reflected projectiles / detonation / delayed-exp / drones /
   core / prism / mirror / snake). Its laser is a normal enemy projectile
   (pr.laser) that hurts the player but can't be parried, and greys + halts
   like an enemy during The World (see rendering.js _renderProjectiles).
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  /* Almond "eye" outline (à la the typing-game eye icon): two sine-curved lids
     that meet at the corners (±hw, 0) and bow apart by ho at the centre. ho is
     the eyelid OPENING — 0 is a shut line, growing as the eye opens. The shape
     is rotated by (ca,sa) = (cos,sin) of the facing angle and translated to
     (cx,cy). Leaves a closed path ready for fillPath()/strokePath(). */
  function _eyeAlmond(g, cx, cy, ca, sa, hw, ho, N) {
    g.beginPath();
    var k, t, x, y, wx, wy;
    for (k = 0; k <= N; k++) {                       // top lid: left → right
      t = k / N; x = -hw + 2 * hw * t; y = -ho * Math.sin(Math.PI * t);
      wx = cx + x * ca - y * sa; wy = cy + x * sa + y * ca;
      if (k === 0) g.moveTo(wx, wy); else g.lineTo(wx, wy);
    }
    for (k = N; k >= 0; k--) {                       // bottom lid: right → left
      t = k / N; x = -hw + 2 * hw * t; y = ho * Math.sin(Math.PI * t);
      wx = cx + x * ca - y * sa; wy = cy + x * sa + y * ca;
      g.lineTo(wx, wy);
    }
    g.closePath();
  }

  /* The vantage distance: the desired keep-distance, capped so the lens always
     stays inside the on-screen "safe radius" (visible at any bearing), with a
     hard floor so it never charges point-blank. */
  M._sniperVantageDist = function () {
    var cam = this.cameras.main;
    var visR = 0.5 * Math.min(cam.width, cam.height) / (cam.zoom || 1);
    var d = Math.min(C.T4_KEEP_DIST, visR * C.T4_VANTAGE_VIS_FRAC);
    return Math.max(C.T4_VANTAGE_MIN, d);
  };

  /* Keep a vantage point inside BOTH the arena disc AND — when it's up — the
     Anomaly's quarantine firewall. A sniper that belongs in the zone then
     actually materialises (and plays its appear FX) INSIDE it, instead of
     opening just outside and getting snapped in by the shared barrier clamp. */
  M._sniperClampPos = function (x, y) {
    var ab = this._anomaly;
    if (this._anomalyBarrierActive && ab && ab.phase !== 'INTRO') {
      var bdx = x - ab.bx, bdy = y - ab.by;
      var blim = ab.R - C.T4_SIZE * 1.6;
      if (blim < 0) blim = 0;
      var bd2 = bdx * bdx + bdy * bdy;
      if (bd2 > blim * blim) {
        var bd = Math.sqrt(bd2) || 1;
        x = ab.bx + (bdx / bd) * blim;
        y = ab.by + (bdy / bd) * blim;
      }
    }
    var c = LA.clampDisc(x, y, C.T4_SIZE * 1.4);
    return { x: c.x, y: c.y };
  };

  /* Begin a charge at the sniper's CURRENT position (clamped only into the disc
     / Anomaly zone — never a teleport jump), opening the eye. Shared by the
     cloak-timer expiry, the trapped/exposed re-charge, and the spawn — it's what
     lets a followed dash-marked eye open exactly where you tracked it to. */
  M._sniperBeginCharge = function (e, p) {
    var cp = this._sniperClampPos(e.x, e.y);
    e.x = cp.x; e.y = cp.y; e.vx = 0; e.vy = 0;
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    e.snAimAngle = e.angle;
    e.snState = 'CHARGE';
    e.snTimer = C.T4_CHARGE_DUR;
    e.snChargeT = 0;
    e.snAppearT = 0;
    e._snIntangible = false;
    e.snGhost = null;   // drop the cloak afterimage trail — the eye is opening here
    this._explode(e.x, e.y, C.T4_TINT_ARR, 12);
    this._spawnWaveRing(e.x, e.y, { maxRadius: C.T4_SIZE * 3.2, color: C.T4_HOT, expandTime: 0.22 });
  };

  /* Per-frame AI. ms / sc60 are SCALED world time. */
  M._updateSniper = function (e, ms, sc60) {
    var p = this.p;
    // The World freezes the sniper INSTANTLY and COMPLETELY (not the slow ~2%
    // world crawl the rest of the board drifts at): it must never finish
    // appearing / charging / vanishing while time is stopped, so a sniper you
    // stop time to go kill stays frozen mid-charge — killable — for you.
    if (this._twActive) return;
    var msec = ms / 1000;   // scaled seconds

    // NB: inside the Anomaly quarantine the sniper behaves NORMALLY (cloak →
    // glide → charge → fire). It is NOT permanently exposed — you clear it during
    // a charge window like anywhere else. The only special case is the spawn
    // (_spawnSniperAt), which materialises it OPEN so the vacuum-in is visible.
    if (e.snState === 'CLOAK') {
      e._snIntangible = true;
      // GLIDE (never teleport) toward the next firing vantage, so a dash-MARKED
      // eye can be FOLLOWED to exactly where it'll open and picked off there.
      if (e.snOrbAng == null) e.snOrbAng = Math.atan2(e.y - p.y, e.x - p.x);
      e.snOrbAng += (e.snOrbDir || 1) * C.T4_ORBIT_RATE * msec;
      var vant = this._sniperVantageDist();
      var tp = this._sniperClampPos(p.x + Math.cos(e.snOrbAng) * vant, p.y + Math.sin(e.snOrbAng) * vant);
      var k = Math.min(1, C.T4_GLIDE_RATE * msec);
      e.x += (tp.x - e.x) * k; e.y += (tp.y - e.y) * k;
      e.vx = 0; e.vy = 0;
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.snTimer -= ms;
      if (e.snTimer <= 0) this._sniperBeginCharge(e, p);   // opens RIGHT HERE — no teleport jump
      return;
    }

    if (e.snState === 'CHARGE') {
      e._snIntangible = false;
      // Brake to a near-stop and hold position while charging.
      e.vx *= 0.82; e.vy *= 0.82;
      e.x += e.vx * sc60; e.y += e.vy * sc60;
      // Track the player (aim freezes during The World, like every other enemy).
      if (!this._twActive) {
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        e.snAimAngle = e.angle;
      }
      e.snAppearT = Math.min(1, e.snAppearT + ms / C.T4_APPEAR_DUR);
      e.snTimer -= ms;
      e.snChargeT = Math.max(0, Math.min(1, 1 - e.snTimer / C.T4_CHARGE_DUR));
      if (e.snTimer <= 0) {
        // FIRE — a single very fast bolt at the player's position right now.
        // If the projectile pool is SATURATED the shot is skipped entirely: the
        // eye just closes (no muzzle flash / recoil / FX) instead of "firing into
        // the void" with nothing leaving the barrel.
        var fa = Math.atan2(p.y - e.y, p.x - e.x);
        e.snAimAngle = fa; e.angle = fa;
        if (this._fireSniperLaser(e, fa)) {
          e.vx -= Math.cos(fa) * 7; e.vy -= Math.sin(fa) * 7;   // recoil
          e.snFireFlash = 1.0;
          this._explode(e.x, e.y, [255, 255, 255], 16);
          this._explode(e.x, e.y, C.T4_TINT_ARR, 10);
          this.cameras.main.shake(55, 0.004);
        }
        e.snState = 'VANISH';
        e.snTimer = C.T4_VANISH_DUR;
      }
      return;
    }

    // VANISH — the eye snaps shut, then re-cloaks.
    e._snIntangible = true;
    e.vx *= 0.86; e.vy *= 0.86;
    e.x += e.vx * sc60; e.y += e.vy * sc60;
    if (e.snFireFlash > 0) e.snFireFlash = Math.max(0, e.snFireFlash - ms / 160);
    e.snTimer -= ms;
    if (e.snTimer <= 0) {
      e.snState = 'CLOAK';
      e.snTimer = C.T4_CLOAK_DUR * (0.82 + Math.random() * 0.36);
      e.snChargeT = 0; e.snAppearT = 0; e.snFireFlash = 0;
      e.snOrbDir = Math.random() < 0.5 ? -1 : 1;
      // Pick a fresh bearing to one SIDE of the current one so the eye visibly
      // RELOCATES to a new (adjacent) spot — far enough to read as a move, near
      // enough that a dash-marked eye is easy to follow there.
      var curB = Math.atan2(e.y - p.y, e.x - p.x);
      e.snOrbAng = curB + (Math.random() < 0.5 ? 1 : -1) * (Math.PI * 0.28 + Math.random() * Math.PI * 0.44);
    }
  };

  /* Spawn one laser bolt: a very fast, non-reflectable enemy projectile. It
     rides the normal projectiles array (so player-hit / OOB / nuke-clear all
     work), tagged pr.laser so projectiles.js skips its reflect + default trail
     and rendering.js draws it as a beam. */
  M._fireSniperLaser = function (e, ang) {
    if (this.projectiles.length >= C.MAX_PROJECTILES) return false;
    var spd = C.T4_LASER_SPEED;
    var spr = this.add.image(e.x, e.y, '_laser');
    spr.setBlendMode(Phaser.BlendModes.ADD);
    spr.setDepth(22);
    spr.setRotation(ang);
    this.projectiles.push({
      spr: spr, x: e.x, y: e.y,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      life: C.T4_LASER_LIFE, isReflected: false, smashed: false,
      shooterRef: e, rotSpeed: 0, trailSlots: [],
      laser: true,
    });
    this._explode(e.x, e.y, [200, 240, 255], 8);   // muzzle spark
    return true;
  };

  /* Dash-MARK tracker for a CLOAKED sniper. Rather than a target reticle, the
     mark reveals the invisible eye as a CYAN HOLOGRAM — and crucially draws it
     SHUT (a thin breathing slit, never a wide open eye). Two reads are wanted:
       • "revealed but NOT killable": the eye only becomes vulnerable once it
         OPENS to charge, so a closed, pupil-less slit says "I see it, but it
         can't be hit yet" — no glowing pupil to mistake for an active target;
       • "still invisible, only seen through the mark": it phases like an x-ray
         ghost (double-exposed outline + slow breathing alpha) instead of a
         solid eyeball, yet stays bright enough to PRE-AIM its next opening.
     Fading cyan afterimages trace its glide path so you can follow it there.
     Sparks jut out from the marked-enemy particles emitted in _updateEnemies.
     (Frozen-static under The World, where it isn't gliding.) */
  M._renderSniperGhostTrail = function (e, gt, i) {
    var g = e.scopeGfx;
    if (!g) return;
    var s = e.size, tw = this._twActive;
    var ca = Math.cos(e.angle), sa = Math.sin(e.angle);
    var pca = -sa, psa = ca;
    var hw = s * 1.7;

    // Sample the gliding path into a short afterimage buffer (skip while TW-frozen).
    if (!e.snGhost) e.snGhost = [];
    var buf = e.snGhost;
    if (!tw) {
      var last = buf.length ? buf[buf.length - 1] : null;
      var dgx = last ? e.x - last.x : 999, dgy = last ? e.y - last.y : 999;
      if (!last || dgx * dgx + dgy * dgy > 100) {
        buf.push({ x: e.x, y: e.y, pca: pca, psa: psa });
        if (buf.length > 14) buf.shift();
      }
    }

    // Slow, DEEP "breathing" — the phantom mostly hovers at the faint edge of
    // visibility and only briefly surges into view (the ^2 curve keeps it low
    // most of the time, so the eye "appears" rarely / rémanent), reading as
    // something invisible bleeding through the mark rather than a solid, killable
    // marked enemy. A faster shimmer on top makes it flicker like a hologram.
    // Static under The World (no gt-driven motion there).
    var breathe = tw ? 0.5 : Math.pow(0.5 + 0.5 * Math.sin(gt * Math.PI * 1.4 + i), 2);
    var shimmer = tw ? 1 : (0.6 + 0.4 * Math.abs(Math.sin(gt * Math.PI * 11 + i * 2.3)));
    var slit = s * (0.24 + 0.12 * breathe);   // gently-open lid — an eye, not a line
    var cx = e.x, cy = e.y;

    // Fading afterimages along the glide path — a LONG, persistent trail of faint
    // cyan eye-ghosts is the main "where is it / where's it going" read while the
    // head phases in and out.
    for (var k = 0; k < buf.length; k++) {
      var gh = buf[k];
      var a = ((k + 1) / (buf.length + 1)) * 0.3;
      _eyeAlmond(g, gh.x, gh.y, gh.pca, gh.psa, hw * 0.9, s * 0.18, 12);
      g.lineStyle(1.4, 0x00ffff, a);
      g.strokePath();
    }

    // Twinkling spark motes orbiting the eye — a shimmer of étincelles that keeps
    // marking the phantom's spot even at the bottom of a breath (drawn on the ADD
    // gfx, independent of the real emitter particles).
    if (!tw) {
      for (var sp = 0; sp < 7; sp++) {
        var orb = gt * 0.7 + sp * 2.399 + i;                       // slow drift
        var rad = hw * (0.95 + 0.55 * (0.5 + 0.5 * Math.sin(sp * 1.7 + i)));
        var twk = 0.5 + 0.5 * Math.sin(gt * Math.PI * (6 + sp) + sp * 2.1 + i);
        var sx = cx + Math.cos(orb) * rad, sy = cy + Math.sin(orb) * rad;
        g.fillStyle(sp % 2 ? 0xbafcff : 0x00ffff, 0.5 * twk);
        g.fillCircle(sx, sy, 0.9 + 1.7 * twk);
      }
    }

    // 1. Soft reveal halo — barely-there glow that swells on a breath.
    g.fillStyle(0x00e6ff, (0.03 + 0.07 * breathe) * shimmer);
    g.fillCircle(cx, cy, hw * (1.04 + 0.14 * breathe));

    // 2. Translucent sclera — see-through cyan glass, never a solid eyeball.
    _eyeAlmond(g, cx, cy, pca, psa, hw, slit, 14);
    g.fillStyle(0x00e6ff, (0.04 + 0.06 * breathe) * shimmer);
    g.fillPath();

    // 3. Holographic TRIPLE exposure: the lid drawn three times, slightly offset,
    //    so it reads as a glitching projection instead of a solid, hittable edge.
    _eyeAlmond(g, cx, cy, pca, psa, hw, slit, 14);
    g.lineStyle(2, 0xbafcff, (0.22 + 0.5 * breathe) * shimmer);
    g.strokePath();
    _eyeAlmond(g, cx + 1.6, cy - 1.6, pca, psa, hw, slit, 14);
    g.lineStyle(1, 0x9ffcff, (0.08 + 0.22 * breathe) * shimmer);
    g.strokePath();
    _eyeAlmond(g, cx - 1.6, cy + 1.6, pca, psa, hw, slit, 14);
    g.lineStyle(1, 0x9ffcff, (0.08 + 0.22 * breathe) * shimmer);
    g.strokePath();

    // 4. The lid crease — a faint line across the gently-shut eye. Together with
    //    the slit (not a wide open eye) this is the "closed → can't be hit yet"
    //    cue; no pupil is ever drawn while cloaked.
    g.lineStyle(2, 0x00ffff, (0.25 + 0.4 * breathe) * shimmer);
    g.beginPath();
    g.moveTo(cx - pca * hw * 0.94, cy - psa * hw * 0.94);
    g.lineTo(cx + pca * hw * 0.94, cy + psa * hw * 0.94);
    g.strokePath();

    // 5. Corner lock-ticks — tiny brackets that say "your mark is tracking it".
    g.lineStyle(1.6, 0x00ffff, (0.25 + 0.35 * breathe) * shimmer);
    for (var lc = -1; lc <= 1; lc += 2) {
      var bx = cx + pca * hw * 1.06 * lc, by = cy + psa * hw * 1.06 * lc;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + pca * s * 0.32 * lc, by + psa * s * 0.32 * lc);
      g.strokePath();
    }
  };

  /* Full self-render: cloak / open-close eye / charge animation / dash mark /
     muzzle flash. e.spr position is already set by _renderEnemies; the body
     texture is _sniper (swapped to _sniper_gray by The World). The animated
     eye lives on e.scopeGfx (an ADD graphics). */
  M._renderSniper = function (e, gt, i) {
    var g  = e.scopeGfx;
    var tw = this._twActive;
    var s  = e.size;   // T4_SIZE
    e.spr.setRotation(e.angle);
    e.spr.setBlendMode(Phaser.BlendModes.ADD);
    for (var t = 0; t < this.ENEMY_TRAIL_N; t++) e.trSpr[t].setVisible(false);
    if (g) g.clear();

    var st = e.snState;
    // Dash MARK on the eye: shared cyan/white blink (faster as it nears expiry).
    var marked  = !!e.isMarked;
    var urgency = marked ? Math.max(0, 1 - e.markTimer / (e.markMaxTimer || 3000)) : 0;
    var mflick  = marked ? Math.sin(gt * Math.PI * (22 + urgency * 20) + i) : 0;

    // FULLY invisible between shots (cloaked) — nothing drawn, EXCEPT a MARKED
    // eye flickers visible + leaves fading cyan afterimages so you can follow the
    // invisible sniper to where it'll next open and pick it off at the exit.
    if (st === 'CLOAK') {
      e.spr.setAlpha(0);
      if (marked && g) this._renderSniperGhostTrail(e, gt, i);
      else if (e.snGhost) e.snGhost = null;   // unmarked → drop any stale afterimage trail
      return;
    }

    // The baked lens sprite stays hidden — the eye is 100% procedural on the
    // ADD scopeGfx so the eyelids can actually open/close. e.spr only ever
    // shows on a TW "condemned" death flash (handled in _renderEnemies).
    e.spr.setAlpha(0);
    if (!g) return;

    var appear = (st === 'CHARGE') ? (e.snAppearT || 0) : 1;
    var vanish = (st === 'VANISH') ? Math.max(0, Math.min(1, e.snTimer / C.T4_VANISH_DUR)) : 1;
    var op    = Math.max(0, Math.min(1, Math.min(appear, vanish)));   // eyelid openness 0→1
    var chg   = e.snChargeT || 0;
    var flash = e.snFireFlash || 0;
    var dmg   = e.hp <= 1;   // already took a hit → a wounded, BLOODSHOT eye

    var cx = e.x, cy = e.y;
    var ca = Math.cos(e.angle), sa = Math.sin(e.angle);   // AIM frame (toward the player)
    var pca = -sa, psa = ca;                              // PERP frame (the eye's wide axis ⟂ to the aim)
    // Wounded eye trembles slightly (along its wide axis).
    if (dmg && !tw) { var jit = Math.sin(gt * Math.PI * 24 + i) * 0.7; cx += pca * jit; cy += psa * jit; }

    // Palettes. Pristine = icy steel-white; wounded (1 HP) = angry bloodshot
    // crimson. During The World everything goes TERNE (desaturated, like the
    // rest of the board) — but a wounded eye still reads as a muted dull red, so
    // a hit landed under time-stop immediately shows its 1-HP sprite.
    var lidCol    = tw ? (dmg ? 0xc7a8a4 : 0xaab0b6) : (dmg ? 0xff9a86 : 0xeaf6ff);
    var scleraCol = tw ? (dmg ? 0x946560 : 0x7e848a) : (dmg ? 0xff5a4a : C.T4_TINT);
    var irisCol   = tw ? (dmg ? 0xab625b : 0x868c93) : (dmg ? (chg > 0.5 ? 0xff7a66 : 0xff3344)
                                                            : (chg > 0.55 ? 0xffffff : C.T4_HOT));
    var hotWhite  = tw ? 0xccd2d8 : 0xffffff;   // lock-core / muzzle white, dulled under TW
    // A dash-MARKED eye recolours to cyan so the mark reads clearly ON the eye —
    // kept even under The World (the mark effect must persist while time is
    // stopped), exactly like every other marked enemy.
    if (marked) {
      lidCol    = 0xbafcff;
      scleraCol = 0x00e6ff;
      irisCol   = mflick > 0 ? 0x00ffff : 0xffffff;
      hotWhite  = 0xffffff;
    }

    var hw  = s * 1.85;          // eye half-width (the wide axis, ⟂ to the aim)
    var ho  = s * 1.08 * op;     // eyelid half-opening along the aim axis (0 = shut)
    var aMul = op;               // everything fades in/out with the opening
    // Iris/pupil sit a touch toward the player so the eye "looks at" them.
    var gz = ho * 0.18, ix = cx + ca * gz, iy = cy + sa * gz;

    // 1. Soft outer glow around the eye.
    g.fillStyle(scleraCol, 0.06 * aMul);
    g.fillCircle(cx, cy, hw * (1.0 + 0.12 * chg));

    // 2. Sclera (the eyeball) — almond fill, wide axis ⟂ to the aim.
    _eyeAlmond(g, cx, cy, pca, psa, hw, ho, 16);
    g.fillStyle(scleraCol, (0.15 + 0.14 * chg) * aMul);
    g.fillPath();

    // 3. Iris ring + constricting pupil + lock telegraph (once open enough).
    if (op > 0.22) {
      var ri = Math.min(hw * 0.46, ho * 0.82);
      // Glowing iris annulus (dark centre reads as the pupil under ADD).
      g.lineStyle(ri * (0.46 - 0.16 * chg), irisCol, (0.55 + 0.4 * chg) * aMul);
      g.strokeCircle(ix, iy, ri * 0.7);
      // Iris outer rim.
      g.lineStyle(1.6, lidCol, 0.5 * aMul);
      g.strokeCircle(ix, iy, ri);
      // Contracting LOCK ring — telegraphs the imminent shot (stays inside the
      // eye so it never reads as a pre-drawn trajectory).
      var lr = ri * (1.5 - 0.5 * chg);
      g.lineStyle(1 + 1.6 * chg, irisCol, (0.25 + 0.5 * chg) * aMul);
      g.strokeCircle(ix, iy, lr);
      // White-hot lock core fills the pupil as the shot locks in.
      var hot = ri * (0.06 + 0.5 * chg * chg);
      g.fillStyle(hotWhite, (0.35 + 0.65 * chg) * aMul);
      g.fillCircle(ix, iy, hot);

      // Spinning aim ticks just outside the iris.
      var rot = gt * (2 + chg * 8);
      g.lineStyle(2, irisCol, (0.5 + 0.4 * chg) * aMul);
      for (var k = 0; k < 4; k++) {
        var a = rot + (Math.PI / 2) * k;
        var t0 = ri * 1.18, t1 = ri * (1.6 - 0.25 * chg);
        g.beginPath();
        g.moveTo(ix + Math.cos(a) * t0, iy + Math.sin(a) * t0);
        g.lineTo(ix + Math.cos(a) * t1, iy + Math.sin(a) * t1);
        g.strokePath();
      }

      // Wounded: fractures across the iris + a few bloodshot veins (fixed
      // offsets so they don't strobe; rotated onto the eye's wide axis).
      if (dmg) {
        g.lineStyle(1.5, 0xfff0e8, 0.7 * aMul);
        var cracks = [[-0.95, -0.15, -0.2, 0.12, 0.55, -0.5], [0.7, 0.45, 0.1, -0.1, -0.5, 0.6]];
        for (var cI = 0; cI < cracks.length; cI++) {
          var cseg = cracks[cI];
          g.beginPath();
          for (var pI = 0; pI < cseg.length; pI += 2) {
            var lx = cseg[pI] * ri, ly = cseg[pI + 1] * ri;
            var wxc = ix + lx * pca - ly * psa, wyc = iy + lx * psa + ly * pca;
            if (pI === 0) g.moveTo(wxc, wyc); else g.lineTo(wxc, wyc);
          }
          g.strokePath();
        }
        g.lineStyle(1, 0xff5a4a, 0.5 * aMul);
        for (var vI = 0; vI < 5; vI++) {
          var va = (Math.PI * 2 / 5) * vI + 0.4;
          g.beginPath();
          g.moveTo(ix + Math.cos(va) * ri * 0.55, iy + Math.sin(va) * ri * 0.55);
          g.lineTo(ix + Math.cos(va) * ri * 1.04, iy + Math.sin(va) * ri * 1.04);
          g.strokePath();
        }
      }
    }

    // 4. Eyelid outline — the crisp open-eye lids (the key "it's an eye" read).
    _eyeAlmond(g, cx, cy, pca, psa, hw, ho, 16);
    g.lineStyle(2.4, lidCol, (0.55 + 0.45 * op) * aMul);
    g.strokePath();
    // Two short lash flicks at the eye corners.
    g.lineStyle(2, lidCol, 0.5 * aMul);
    for (var lc = -1; lc <= 1; lc += 2) {
      var cxp = cx + pca * hw * lc, cyp = cy + psa * hw * lc;
      g.beginPath();
      g.moveTo(cxp, cyp);
      g.lineTo(cxp + pca * s * 0.4 * lc, cyp + psa * s * 0.4 * lc);
      g.strokePath();
    }

    // 5. Muzzle flash (just fired) — burst + a forward beam stub from the pupil.
    if (flash > 0) {
      var fa = e.snAimAngle != null ? e.snAimAngle : e.angle;
      g.fillStyle(hotWhite, 0.85 * flash);
      g.fillCircle(ix, iy, s * (0.4 + 0.9 * flash));
      g.fillStyle(tw ? 0x9aa0a6 : (dmg ? 0xff6655 : C.T4_HOT), 0.5 * flash);
      g.fillCircle(ix, iy, s * (0.9 + 1.4 * flash));
      g.lineStyle(4 * flash, hotWhite, 0.85 * flash);
      g.beginPath();
      g.moveTo(ix, iy);
      g.lineTo(ix + Math.cos(fa) * s * (2 + 6 * flash), iy + Math.sin(fa) * s * (2 + 6 * flash));
      g.strokePath();
    }
  };

})();

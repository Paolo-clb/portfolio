/* ==========================================================================
   Light Again — Persistent BOSS GUIDANCE ARROW

   A chevron that stands ~90px from the player and points at the active boss,
   coloured to match it. Unlike the Anomaly's own pointer (which only shows
   while it wanders / its shield is down and HIDES once the fight is sealed in),
   this arrow stays up for the WHOLE fight — from spawn to death — so the player
   never loses track of a boss that teleports, dashes or burrows off-screen.

   Covers the three bosses that had no guide of their own: the Giga Bruiser, the
   Mirror and the Serpent. The Anomaly keeps its bespoke transient pointer
   (drawn in anomaly.js) — it's tied to that boss's shield mechanic.

   Self-contained: owns one ADD-blended Graphics layer, adds methods to
   LA.sceneMethods, and is driven by the per-frame _updateBossArrow(dt) call in
   scene.update() + the _clearBossArrow() teardown on shutdown.
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  var D = 90;   // px the chevron stands from the player (matches the Anomaly's)

  /* Which boss to point at right now + its signature colour and live position.
     Returns null when no arrow-bearing boss is alive. The Anomaly is excluded
     on purpose: it owns a transient pointer of its own.
     For the Serpent (which can split into several worms) we aim at the head of
     the NEAREST worm so the guide always leads to the closest threat. */
  M._bossArrowTarget = function (p) {
    // Teams can field several bosses at once — point at the NEAREST arrow-bearing
    // one (the Anomaly is excluded: it owns a transient pointer of its own).
    var best = null, bd = Infinity;
    var consider = function (x, y, col) {
      var dx = x - p.x, dy = y - p.y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = { x: x, y: y, col: col }; }
    };
    var GL = this._gigaList;
    if (GL) for (var gi = 0; gi < GL.length; gi++) { var g = GL[gi]; if (g && !g.dead) consider(g.x, g.y, 0x9933ff); }   // purple
    var ML = this._mirrorList;
    if (ML) for (var mi = 0; mi < ML.length; mi++) { var m = ML[mi]; if (m && !m.dead) consider(m.x, m.y, 0xff3aa0); }   // magenta
    var SL = this._snakeList;
    if (SL) for (var si = 0; si < SL.length; si++) {
      var s = SL[si];
      if (!s || s.dead || !s.worms) continue;
      for (var wi = 0; wi < s.worms.length; wi++) {
        var w = s.worms[wi];
        if (!w.segs || !w.segs.length) continue;   // a fully-cleared worm has no head
        consider(w.hx, w.hy, 0x33ff88);   // green → leads to the closest worm head
      }
    }
    return best;
  };

  /* ---- per-frame driver (called from scene.update) ---- */
  M._updateBossArrow = function (dt) {
    var p = this.p;
    var tgt = (p && p.state !== 'DEAD') ? this._bossArrowTarget(p) : null;

    if (!tgt) {
      if (this._bossArrowGfx) this._bossArrowGfx.clear();
      return;
    }

    // Lazy layer creation (depth 67 = above enemies, under HUD; same as the
    // Anomaly pointer). Destroyed with the scene; _clearBossArrow drops the ref.
    var pg = this._bossArrowGfx;
    if (!pg) {
      pg = this.add.graphics();
      pg.setDepth(67);
      pg.setBlendMode(Phaser.BlendModes.ADD);
      this._bossArrowGfx = pg;
    }
    pg.clear();

    var pdx = tgt.x - p.x, pdy = tgt.y - p.y;
    var pdd = Math.sqrt(pdx * pdx + pdy * pdy);
    if (pdd <= 1) return;   // standing on top of it: no meaningful direction

    var gt   = this.gameTime;
    var pAng = Math.atan2(pdy, pdx);
    var px   = p.x + Math.cos(pAng) * D;
    var py   = p.y + Math.sin(pAng) * D;
    var pulse = 0.55 + 0.45 * Math.abs(Math.sin(gt * Math.PI * 3.2));
    var col   = tgt.col;
    var size  = 18;

    var nose = { x: Math.cos(pAng)       * size, y: Math.sin(pAng)       * size };
    var lwn  = { x: Math.cos(pAng + 2.5) * size, y: Math.sin(pAng + 2.5) * size };
    var rwn  = { x: Math.cos(pAng - 2.5) * size, y: Math.sin(pAng - 2.5) * size };

    // Soft outer glow
    pg.fillStyle(col, 0.18 * pulse);
    pg.fillTriangle(px + nose.x * 1.35, py + nose.y * 1.35,
                    px + lwn.x  * 1.35, py + lwn.y  * 1.35,
                    px + rwn.x  * 1.35, py + rwn.y  * 1.35);
    // Main fill
    pg.fillStyle(col, 0.85 * pulse);
    pg.fillTriangle(px + nose.x, py + nose.y,
                    px + lwn.x,  py + lwn.y,
                    px + rwn.x,  py + rwn.y);
    // White-hot inner core
    pg.fillStyle(0xffffff, 0.9 * pulse);
    pg.fillTriangle(px + nose.x * 0.55, py + nose.y * 0.55,
                    px + lwn.x  * 0.45, py + lwn.y  * 0.45,
                    px + rwn.x  * 0.45, py + rwn.y  * 0.45);
    // Outline pulse
    pg.lineStyle(1.5, 0xffffff, 0.9 * pulse);
    pg.beginPath();
    pg.moveTo(px + nose.x, py + nose.y);
    pg.lineTo(px + lwn.x,  py + lwn.y);
    pg.lineTo(px + rwn.x,  py + rwn.y);
    pg.closePath();
    pg.strokePath();
  };

  /* ---- teardown (scene shutdown / restart) ---- */
  M._clearBossArrow = function () {
    if (this._bossArrowGfx) { this._bossArrowGfx.destroy(); this._bossArrowGfx = null; }
  };
})();

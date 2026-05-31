/* ==========================================================================
   Light Again — The Digital Tree + Cyber-Fairy (random "extra-life" event)

   A glowing circuit-board tree sprouts somewhere on the arena from time to
   time. Natural spawns are UNGUIDED — the player must find the tree. Only the
   debug/test shortcut (scene.js KeyP) spawns a guided one, led by a green
   guidance chevron (the SAME logic & look as the Anomaly's pointer):

     1. SPAWN   — rare, gated, one tree at a time, away from the player.
     2. IDLE    — the tree breathes: branches sway, nodes pulse, data-bits
                  drift upward. Stays put until harvested (or withers away).
     3. HARVEST — touch it and it doesn't just pop: a smooth, cinematic
                  collapse where the fruit-energy spirals up and coalesces
                  into a forming Cyber-Fairy that peels off toward the ship.
     4. FAIRY   — a little cyber-féerique drone that physically follows the
                  ship (eased hover + bob + flapping wings + sparkle trail).
     5. NUKE    — the fairy is a ONE-SHOT extra life. If the player would die,
                  it intercepts the game-over, plunges onto the arrow, and
                  detonates a screen-wide NUKE that wipes every enemy, then
                  resurrects the ship with i-frames.

   Self-contained on this._tree + this._fairy (plain data) and three shared,
   persistent graphics objects created in scene.create (mirrors the drone
   module). Driven from update() on real dt so the cinematics read smoothly.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  /* Palette — circuit-green with a near-white core (ADD blend everywhere). */
  var TREE_GREEN  = 0x33ff99;
  var TREE_CORE   = 0xccffe0;
  var TREE_FRUIT  = 0x66ffd0;
  var FAIRY_GREEN = 0x66ffcc;
  var FAIRY_CORE  = 0xeafff4;

  function smooth(t) { return t * t * (3 - 2 * t); }      // smoothstep

  /* Critically-damped smooth follow (Game-Programming-Gems "SmoothDamp"): eases
     `cur` toward `target` with no overshoot and smooth accel + decel, carrying
     velocity in `st[k]`. Returns the new position; updates the velocity in place.
     Frame-rate independent. Gives a buttery catch-up with no darts or hard stops. */
  function smoothDamp(cur, target, st, k, smoothTime, dt) {
    var omega = 2 / smoothTime;
    var x = omega * dt;
    var exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    var change = cur - target;
    var temp = (st[k] + omega * change) * dt;
    st[k] = (st[k] - omega * temp) * exp;
    return target + (change + temp) * exp;
  }

  /* Squared distance from point (px,py) to segment (ax,ay)-(bx,by). */
  function segDistSq(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var cx = ax + dx * t, cy = ay + dy * t;
    var ex = px - cx, ey = py - cy;
    return ex * ex + ey * ey;
  }

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initDigitalTree = function () {
    this._tree            = null;
    this._fairy           = null;
    this._treeCooldownT   = C.TREE_SPAWN_MIN_DELAY;  // wait before the very first one
    this._treeSpawnRollT  = 0;
    this._fairySaving     = false;
    this._fairyReviving   = false;

    // Persistent shared graphics (destroyed with the scene; cleared per-frame).
    this._treeGfx = this.add.graphics();
    this._treeGfx.setDepth(26);                       // above drones (24), below ship (30)
    this._treeGfx.setBlendMode(Phaser.BlendModes.ADD);

    this._treePtrGfx = this.add.graphics();
    this._treePtrGfx.setDepth(66);                    // on top, beside the ship (like ANO ptr)
    this._treePtrGfx.setBlendMode(Phaser.BlendModes.ADD);

    this._fairyGfx = this.add.graphics();
    this._fairyGfx.setDepth(33);                      // above the ship so it always reads
    this._fairyGfx.setBlendMode(Phaser.BlendModes.ADD);
  };

  /* Drop the live tree (graphics persist — just cleared). `silent` skips FX. */
  M._clearDigitalTree = function (silent) {
    this._tree = null;
    if (this._treeGfx)    this._treeGfx.clear();
    if (this._treePtrGfx) this._treePtrGfx.clear();
  };

  /* Drop the fairy follower (used on shutdown). */
  M._clearFairy = function () {
    this._fairy = null;
    this._fairySaving = false;
    this._fairyReviving = false;
    if (this._fairyGfx) this._fairyGfx.clear();
  };

  /* ================================================================
     PROCEDURAL TREE — a small recursive branch skeleton, generated once at
     spawn. Parent indices are always < child indices (parents pushed first),
     so a single forward pass resolves every tip position each frame.
     ================================================================ */
  function _genBranches() {
    var nodes = [];
    var MAX_DEPTH = 4;
    function grow(parent, angle, len, depth) {
      var idx = nodes.length;
      nodes.push({
        parent: parent, restAngle: angle, len: len, depth: depth,
        phase: Math.random() * TAU, leaf: false,
        tipX: 0, tipY: 0, cum: 0,
      });
      if (depth >= MAX_DEPTH || len < 14) { nodes[idx].leaf = true; return; }
      // The short trunk (depth 0) forks straight into 3 main boughs; above that
      // it keeps splitting 2–3 ways. Wide spread + long first boughs give a big,
      // airy canopy sitting on a small stem.
      var n = depth === 0 ? 3 : (Math.random() < 0.5 ? 2 : 3);
      for (var b = 0; b < n; b++) {
        var spread = (b - (n - 1) / 2) * (depth === 0 ? 0.82 : (0.62 + Math.random() * 0.4));
        var na = angle + spread + (Math.random() - 0.5) * 0.18;
        // First boughs grow LONGER than the trunk (canopy reaches out); deeper
        // limbs taper down normally.
        var nl = depth === 0 ? len * (1.05 + Math.random() * 0.25)
                             : len * (0.70 + Math.random() * 0.14);
        grow(idx, na, nl, depth + 1);
      }
    }
    grow(-1, -Math.PI / 2, C.TREE_SIZE * 0.5, 0);   // short trunk, pointing up
    return nodes;
  }

  /* ================================================================
     NATURAL SPAWN — rare, gated, both modes (driven from update on real dt)
     ================================================================ */
  M._maybeSpawnTree = function (dt) {
    // One tree + one fairy at a time; none while carrying a fairy, mid-save,
    // during the tutorial, the anomaly quarantine, a pending boss draft, or
    // while the player is dead.
    if (this._tree || this._fairy || this._fairySaving) return;
    if (this._tutorialActive) return;
    if (this._anomalyBarrierActive || this._anomalyIntroActive) return;
    if (this._bossDraftPending) return;
    if (!this.p || this.p.state === 'DEAD') return;

    if (this._treeCooldownT > 0) { this._treeCooldownT -= dt * 1000; return; }

    // Per-second Bernoulli roll (accumulate real ms, fire once per second).
    this._treeSpawnRollT += dt * 1000;
    if (this._treeSpawnRollT < 1000) return;
    this._treeSpawnRollT -= 1000;
    if (Math.random() < C.TREE_SPAWN_CHANCE) this._spawnDigitalTree();
  };

  M._spawnDigitalTree = function (opts) {
    opts = opts || {};
    if (this._tree || this._fairy) return;
    if (!this.p || this.p.state === 'DEAD') return;

    var m    = C.WORLD_HALF - C.TREE_SIZE * 2;
    // Random spot far from the player AND clear of a live Curse Fountain so the
    // two map events never crowd each other (re-roll a few times, then accept).
    var avoid = this._fount, sep2 = C.MAP_FEATURE_MIN_SEP * C.MAP_FEATURE_MIN_SEP;
    var x, y, tries = 0;
    do {
      var ang  = Math.random() * TAU;
      var dist = C.TREE_SPAWN_DIST_MIN + Math.random() * (C.TREE_SPAWN_DIST_MAX - C.TREE_SPAWN_DIST_MIN);
      x = Math.max(-m, Math.min(m, this.p.x + Math.cos(ang) * dist));
      y = Math.max(-m, Math.min(m, this.p.y + Math.sin(ang) * dist));
      tries++;
    } while (avoid && tries < 20 && (x - avoid.x) * (x - avoid.x) + (y - avoid.y) * (y - avoid.y) < sep2);

    var nodes = _genBranches();
    // Seed every tip at the base so _treeTouched (which runs before the first
    // render) never tests against unresolved (0,0) world-origin tips.
    for (var ni = 0; ni < nodes.length; ni++) { nodes[ni].tipX = x; nodes[ni].tipY = y; }

    this._tree = {
      x: x, y: y,
      phase: 'IDLE',
      guided: !!opts.guided,    // only the debug/test spawn shows a guidance chevron
      nodes: nodes,
      growT: 0,                 // 0→1 sprout-in animation
      age: 0,                   // ms alive (for the wither timer)
      sway: 0, gust: 0,
      harvestT: 0,
      canopyX: x, canopyY: y - C.TREE_SIZE,
      bits: [],                 // rising "data" motes
      bitT: 0,
    };

    // Sprout burst — a rift opens and the tree rises out of it.
    this._spawnWaveRing(x, y, { maxRadius: 150, color: TREE_GREEN, expandTime: 0.42 });
    this._spawnWaveRing(x, y, { maxRadius: 90,  color: 0xffffff,   expandTime: 0.30 });
    this._explode(x, y, [80, 255, 170], 26);
    this._explode(x, y, [220, 255, 235], 14);
  };

  /* ================================================================
     UPDATE — tree idle/harvest + fairy follow/dive (all on real dt)
     ================================================================ */
  M._updateDigitalTree = function (dt) {
    // Spawn gate runs whether or not one is currently alive.
    if (!this._tree && !this._fairy && !this._fairySaving) { this._maybeSpawnTree(dt); }
    else if (!this._tree) { /* a fairy exists → no new tree until it's spent */ }

    if (this._tree) this._tickTree(dt);
    this._updateFairy(dt);
  };

  /* True if (px,py) is touching the tree's silhouette — its base bulb or within
     a small slack of ANY branch segment (limbs are thicker near the trunk). Uses
     the node tips resolved by the previous render (the tree spawns far from the
     player, so the one-frame lag is never observable). */
  M._treeTouched = function (px, py) {
    var t = this._tree;
    if (!t) return false;
    var pad = C.SIZE * 0.6;                          // the ship's own half-extent
    var dbx = px - t.x, dby = py - t.y;
    if (dbx * dbx + dby * dby < (40 + pad) * (40 + pad)) return true;   // base bulb
    var nodes = t.nodes;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var bx = n.parent < 0 ? t.x : nodes[n.parent].tipX;
      var by = n.parent < 0 ? t.y : nodes[n.parent].tipY;
      var rr = pad + 22 + (4 - n.depth) * 4;          // thicker contact near the trunk
      if (segDistSq(px, py, bx, by, n.tipX, n.tipY) < rr * rr) return true;
    }
    return false;
  };

  M._tickTree = function (dt) {
    var t = this._tree, p = this.p;
    var ms = dt * 1000;

    // Sprout-in + a slow wandering "wind" so the idle never reads as static.
    t.growT = Math.min(1, t.growT + dt * 1.6);
    t.gust  = t.gust + (Math.random() - 0.5) * dt * 1.2;
    t.gust  = Math.max(-1, Math.min(1, t.gust * 0.985));
    t.sway += dt;

    if (t.phase === 'IDLE') {
      t.age += ms;

      // Rising data-bits (cheap motes drifting up out of the canopy).
      t.bitT += ms;
      if (t.bitT > 140 && t.growT > 0.5 && t.bits.length < 18) {
        t.bitT = 0;
        var bn = t.nodes[(Math.random() * t.nodes.length) | 0];
        t.bits.push({ x: bn.tipX || t.x, y: bn.tipY || t.canopyY, vy: -18 - Math.random() * 22,
                      vx: (Math.random() - 0.5) * 12, life: 1, size: 1 + Math.random() * 2 });
      }

      // Harvest on contact with ANY part of the tree (trunk, limbs or canopy).
      if (p && p.state !== 'DEAD' && this._treeTouched(p.x, p.y)) {
        this._beginHarvest();
      }

      // Wither away if left uncollected for too long.
      if (t.age >= C.TREE_LIFETIME) { this._witherTree(); }
    } else if (t.phase === 'HARVEST') {
      t.harvestT += ms / C.TREE_HARVEST_DUR;
      if (t.harvestT >= 1) {
        // Birth the fairy at the canopy and retire the tree.
        var bx = t.canopyX, by = t.canopyY;
        this._clearDigitalTree(true);
        this._spawnFairy(bx, by);
      }
    }

    // Advance + cull data-bits.
    for (var i = t.bits ? t.bits.length - 1 : -1; i >= 0; i--) {
      var b = t.bits[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt * 0.9;
      if (b.life <= 0) t.bits.splice(i, 1);
    }

    this._renderTree(dt);
    this._renderTreePointer();
  };

  /* Touch → enter the cinematic harvest (no world freeze — keeps the flow). */
  M._beginHarvest = function () {
    var t = this._tree;
    if (!t || t.phase !== 'IDLE') return;
    t.phase = 'HARVEST';
    t.harvestT = 0;
    this._explode(t.x, t.canopyY, [120, 255, 200], 18);
    this._spawnWaveRing(t.x, t.y, { maxRadius: 120, color: TREE_GREEN, expandTime: 0.34 });
    this.cameras.main.shake(120, 0.006);
    this._triggerHitstop(40);
    if (this._treePtrGfx) this._treePtrGfx.clear();    // guidance done
  };

  /* Uncollected for too long → it dissolves with a soft green poof. */
  M._witherTree = function () {
    var t = this._tree;
    if (!t) return;
    this._explode(t.canopyX, t.canopyY, [80, 200, 150], 16);
    this._explode(t.x, t.y, [60, 180, 130], 12);
    this._spawnWaveRing(t.x, t.y, { maxRadius: 110, color: 0x2bbb88, expandTime: 0.4 });
    this._clearDigitalTree(true);
    this._treeCooldownT = C.TREE_COOLDOWN;
  };

  /* ================================================================
     RENDER — circuit tree: glowing trunk/branches, pulsing nodes, fruit orbs,
     a rift glow at the base, and rising data-bits. During HARVEST the canopy
     energy spirals up into a forming fairy seed.
     ================================================================ */
  M._renderTree = function (dt) {
    var t = this._tree, g = this._treeGfx, gt = this.gameTime;
    g.clear();
    if (!t) return;

    var grow = smooth(t.growT);
    var harv = t.phase === 'HARVEST' ? t.harvestT : 0;
    // Wither fade in the final TREE_WITHER_WARN ms.
    var wither = 1;
    if (t.phase === 'IDLE' && t.age > C.TREE_LIFETIME - C.TREE_WITHER_WARN) {
      wither = Math.max(0, 1 - (t.age - (C.TREE_LIFETIME - C.TREE_WITHER_WARN)) / C.TREE_WITHER_WARN);
      wither = 0.25 + 0.75 * wither;          // never fully invisible until gone
    }
    // Branches retract + dim as the harvest collapses them into the canopy.
    var lenScale = grow * (1 - 0.55 * smooth(harv));
    var bodyAlpha = wither * (1 - 0.85 * smooth(harv));

    // ---- Base rift glow (a slit of light the tree stands in) ----
    var riftPulse = 0.5 + 0.5 * Math.sin(gt * 3);
    g.fillStyle(TREE_GREEN, 0.10 * grow * wither);
    g.fillEllipse(t.x, t.y + 4, C.TREE_SIZE * 0.9 * grow, 14 * grow);
    g.fillStyle(TREE_CORE, (0.18 + 0.12 * riftPulse) * grow * wither);
    g.fillEllipse(t.x, t.y + 2, C.TREE_SIZE * 0.5 * grow, 7 * grow);

    // ---- Resolve every node tip (parents already computed) ----
    var nodes = t.nodes, swayAmp = 0.05;
    var leafTipX = 0, leafTipY = 0, leafN = 0, minY = t.y;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var baseX = n.parent < 0 ? t.x : nodes[n.parent].tipX;
      var baseY = n.parent < 0 ? t.y : nodes[n.parent].tipY;
      var parentCum = n.parent < 0 ? 0 : nodes[n.parent].cum;
      // Per-node sway: deeper branches lash more; a slow gust biases the whole tree.
      var s = swayAmp * (n.depth + 1) * Math.sin(gt * 1.7 + n.phase) + t.gust * 0.04 * (n.depth + 1);
      n.cum = parentCum + s;
      var ang = n.restAngle + n.cum;
      var L   = n.len * lenScale;
      n.tipX = baseX + Math.cos(ang) * L;
      n.tipY = baseY + Math.sin(ang) * L;
      if (n.tipY < minY) minY = n.tipY;

      // Branch stroke: width tapers with depth; layered for glow.
      var w = (5 - n.depth) * grow;
      if (w < 1) w = 1;
      g.lineStyle(w + 3, TREE_GREEN, 0.12 * bodyAlpha);
      g.beginPath(); g.moveTo(baseX, baseY); g.lineTo(n.tipX, n.tipY); g.strokePath();
      g.lineStyle(w, TREE_GREEN, 0.7 * bodyAlpha);
      g.beginPath(); g.moveTo(baseX, baseY); g.lineTo(n.tipX, n.tipY); g.strokePath();
      g.lineStyle(Math.max(1, w * 0.45), TREE_CORE, 0.6 * bodyAlpha);
      g.beginPath(); g.moveTo(baseX, baseY); g.lineTo(n.tipX, n.tipY); g.strokePath();

      // Pulsing junction node.
      var np = 0.6 + 0.4 * Math.sin(gt * 4 + n.phase);
      g.fillStyle(TREE_CORE, 0.5 * np * bodyAlpha);
      g.fillCircle(n.tipX, n.tipY, (1.5 + (4 - n.depth) * 0.6) * grow);

      // Leaf "fruit": a glowing energy orb that, during harvest, spirals up.
      if (n.leaf) {
        leafTipX += n.tipX; leafTipY += n.tipY; leafN++;
        var fx = n.tipX, fy = n.tipY;
        if (harv > 0) {
          var sp = smooth(Math.min(1, harv * 1.25));
          fx = n.tipX + (t.canopyX - n.tipX) * sp + Math.cos(gt * 6 + n.phase) * (1 - sp) * 10;
          fy = n.tipY + (t.canopyY - n.tipY) * sp - sp * 14;
        }
        var fp = 0.55 + 0.45 * Math.sin(gt * 5 + n.phase * 2);
        var fr = (4 + 2 * fp) * grow;
        g.fillStyle(TREE_FRUIT, 0.22 * bodyAlpha);
        g.fillCircle(fx, fy, fr * 2.0);
        g.fillStyle(TREE_FRUIT, 0.85 * (harv > 0 ? 1 : bodyAlpha));
        g.fillCircle(fx, fy, fr);
        g.fillStyle(0xffffff, 0.9 * (harv > 0 ? 1 : bodyAlpha));
        g.fillCircle(fx, fy, fr * 0.4);
      }
    }
    t.canopyX = leafN ? leafTipX / leafN : t.x;
    t.canopyY = leafN ? leafTipY / leafN : (t.y - C.TREE_SIZE * grow);

    // ---- Data-bits drifting up ----
    for (var bi = 0; bi < t.bits.length; bi++) {
      var b = t.bits[bi];
      g.fillStyle(TREE_FRUIT, Math.max(0, b.life) * 0.7 * wither);
      g.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
    }

    // ---- HARVEST: a forming fairy "seed" swells at the canopy ----
    if (harv > 0) {
      var seedT = smooth(Math.min(1, (harv - 0.25) / 0.75));
      if (seedT > 0) {
        var sx = t.canopyX, sy = t.canopyY - 6;
        var halo = (10 + 26 * seedT) * (0.85 + 0.15 * Math.sin(gt * 12));
        g.fillStyle(FAIRY_GREEN, 0.25 * seedT);
        g.fillCircle(sx, sy, halo);
        g.fillStyle(FAIRY_CORE, 0.9 * seedT);
        g.fillCircle(sx, sy, 4 + 5 * seedT);
        // Nascent wings flicker open near the end.
        if (seedT > 0.5) this._drawFairyWings(g, sx, sy, -Math.PI / 2, (seedT - 0.5) * 2, gt, 0.7);
        // A little birth shimmer.
        if (Math.random() < 0.3) this._explode(sx, sy, [150, 255, 210], 3);
      }
    }
  };

  /* ================================================================
     GUIDANCE CHEVRON — identical logic & appearance to the Anomaly pointer
     (a green chevron standing ~90px from the ship, aimed at the tree).
     Debug/test spawns only (t.guided); natural spawns are blind.
     ================================================================ */
  M._renderTreePointer = function () {
    var t = this._tree, p = this.p, pg = this._treePtrGfx, gt = this.gameTime;
    pg.clear();
    if (!t || !t.guided || t.phase !== 'IDLE' || !p || p.state === 'DEAD') return;

    var pdx = t.x - p.x, pdy = t.y - p.y;
    var pdd = Math.sqrt(pdx * pdx + pdy * pdy);
    if (pdd <= 1) return;

    var pAng = Math.atan2(pdy, pdx);
    var D    = C.TREE_PTR_DIST;
    var px = p.x + Math.cos(pAng) * D;
    var py = p.y + Math.sin(pAng) * D;
    var pulse = 0.55 + 0.45 * Math.abs(Math.sin(gt * Math.PI * 3.2));
    var col   = TREE_GREEN;
    var size  = 18;

    var nose = { x: Math.cos(pAng) * size,       y: Math.sin(pAng) * size };
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

  /* ================================================================
     CYBER-FAIRY — spawned by the harvest, then follows the ship.
     ================================================================ */
  M._spawnFairy = function (x, y) {
    this._fairy = {
      x: x, y: y, vx: 0, vy: 0,  // vx/vy = smooth-damp velocity state (px/s)
      anchorAng: Math.random() * TAU,
      facing: -Math.PI / 2,
      wing: Math.random() * TAU,
      bob: Math.random() * TAU,
      trail: [],                 // {x,y} history for the sparkle tail
      trailT: 0,
      state: 'FOLLOW',
    };
    this._treeCooldownT = C.TREE_COOLDOWN;   // gate the next tree

    // Birth flourish + a clear callout.
    this._explode(x, y, [150, 255, 210], 30);
    this._explode(x, y, [235, 255, 245], 16);
    this._spawnWaveRing(x, y, { maxRadius: 130, color: FAIRY_GREEN, expandTime: 0.4 });
    this._spawnWaveRing(x, y, { maxRadius: 70,  color: 0xffffff,    expandTime: 0.3 });
    this.cameras.main.flash(220, 90, 255, 170);
    this._floatLabel(this.p.x, this.p.y - 30, LA.laGoT('laFairyGained'), '#66ffcc');
  };

  M._updateFairy = function (dt) {
    var f = this._fairy, g = this._fairyGfx, p = this.p;
    if (!f) { if (g) g.clear(); return; }

    if (f.state === 'REVIVE') { this._updateFairyRevive(dt); return; }

    // ---- FOLLOW: a slow hover anchor orbits the ship; the fairy smooth-damps
    //      onto it. When you sprint off it trails, then glides back in with
    //      smooth accel + decel — a fluid catch-up, no darts, no hard stops. ----
    f.anchorAng += dt * C.FAIRY_ORBIT_SPEED;
    f.bob += dt * 2.4;
    var R  = C.FAIRY_ORBIT_R;
    var ax = p.x + Math.cos(f.anchorAng) * R;
    var ay = p.y + Math.sin(f.anchorAng) * R * 0.62 - R * 0.30 + Math.sin(f.bob) * C.FAIRY_BOB_AMP;

    // Keep the hover target clear of the ship so the fairy never sits on it.
    var ddx = ax - p.x, ddy = ay - p.y, dd = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dd < C.FAIRY_MIN_DIST && dd > 0.01) {
      ax = p.x + (ddx / dd) * C.FAIRY_MIN_DIST;
      ay = p.y + (ddy / dd) * C.FAIRY_MIN_DIST;
    }

    var T = C.FAIRY_FOLLOW_TIME;
    f.x = smoothDamp(f.x, ax, f, 'vx', T, dt);
    f.y = smoothDamp(f.y, ay, f, 'vy', T, dt);

    // Final soft floor — the trailing lag can dip a touch inside the target ring,
    // so keep the fairy itself clear of the ship too (rarely active → no stutter).
    var fdx = f.x - p.x, fdy = f.y - p.y, fdd = Math.sqrt(fdx * fdx + fdy * fdy);
    if (fdd < C.FAIRY_MIN_DIST && fdd > 0.01) {
      f.x = p.x + (fdx / fdd) * C.FAIRY_MIN_DIST;
      f.y = p.y + (fdy / fdd) * C.FAIRY_MIN_DIST;
    }

    this._fairyCommon(f, dt);
    this._renderFairy(dt);
  };

  /* Shared per-frame bits: facing, wing-flap, sparkle trail. */
  M._fairyCommon = function (f, dt) {
    var sp = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
    if (sp > 12) {
      var want = Math.atan2(f.vy, f.vx);
      var diff = Phaser.Math.Angle.Wrap(want - f.facing);
      f.facing += diff * Math.min(1, 10 * dt);
    }
    f.wing += dt * (10 + Math.min(sp, 1600) * 0.01);

    f.trailT += dt * 1000;
    if (f.trailT > 24) {
      f.trailT = 0;
      f.trail.push({ x: f.x, y: f.y, a: 1 });
      if (f.trail.length > 16) f.trail.shift();
    }
    for (var i = 0; i < f.trail.length; i++) f.trail[i].a -= dt * 1.7;
  };

  /* ================================================================
     RENDER — fairy: sparkle trail, glow halo, flapping wings, bright core.
     ================================================================ */
  M._renderFairy = function (dt) {
    var f = this._fairy, g = this._fairyGfx, gt = this.gameTime;
    g.clear();
    if (!f) return;
    var flare = f.state === 'REVIVE';        // brighter/larger during the rescue

    // ---- Sparkle trail (oldest → newest) ----
    for (var i = 0; i < f.trail.length; i++) {
      var tr = f.trail[i];
      if (tr.a <= 0) continue;
      var rr = 1.4 + (i / f.trail.length) * 3.2;
      g.fillStyle(FAIRY_GREEN, tr.a * 0.4);
      g.fillCircle(tr.x, tr.y, rr);
      g.fillStyle(0xffffff, tr.a * 0.5);
      g.fillCircle(tr.x, tr.y, rr * 0.4);
    }

    // ---- Glow halo (breathes; flares during the rescue) ----
    var pulse = 0.6 + 0.4 * Math.sin(gt * 8);
    var haloR = (flare ? 20 : 14) * (0.85 + 0.15 * pulse);
    g.fillStyle(FAIRY_GREEN, 0.22 * (flare ? 1.4 : 1));
    g.fillCircle(f.x, f.y, haloR);
    g.fillStyle(FAIRY_GREEN, 0.14);
    g.fillCircle(f.x, f.y, haloR * 1.7);

    // ---- Wings (two flapping pairs) ----
    this._drawFairyWings(g, f.x, f.y, f.facing, 1, gt, flare ? 1 : 0.9);

    // ---- Body core ----
    g.fillStyle(FAIRY_GREEN, 0.9);
    g.fillCircle(f.x, f.y, flare ? 6 : 5);
    g.fillStyle(FAIRY_CORE, 1);
    g.fillCircle(f.x, f.y, 2.6 + 0.6 * pulse);

    // Occasional pixie-dust sparkle (lively throughout its existence).
    if (Math.random() < 0.12) {
      g.fillStyle(0xffffff, 0.9);
      var sa = Math.random() * TAU, sd = 6 + Math.random() * 10;
      g.fillCircle(f.x + Math.cos(sa) * sd, f.y + Math.sin(sa) * sd, 1.2);
    }
  };

  /* Two flapping wing-pairs (upper + lower) sprouting perpendicular to
     `facing`. `wingAmt` (0→1) scales overall openness — used to "unfurl" the
     wings on the harvest seed. Reused by the harvest seed + the live fairy. */
  M._drawFairyWings = function (g, x, y, facing, wingAmt, gt, alpha) {
    var wingPh = this._fairy ? this._fairy.wing : gt * 9;
    var flap = 0.4 + 0.6 * Math.abs(Math.sin(wingPh));   // 0=folded, 1=spread
    var perp = facing + Math.PI / 2;
    var back = facing + Math.PI;
    // Build each blade from a root near the body, a far tip, and a trailing
    // point — a slim leaf shape that visibly opens/closes with the flap.
    for (var s = -1; s <= 1; s += 2) {            // two flanks
      for (var row = 0; row < 2; row++) {         // upper / lower wing
        var scale = (row === 0 ? 1.0 : 0.66) * wingAmt;
        var reach = (14 + 9 * flap) * scale;       // how far the tip extends sideways
        var sweep = (8 + 4 * flap) * scale;        // back-sweep of the blade
        // Root sits just forward of the body so wings attach at the "shoulders".
        var rootX = x + Math.cos(facing) * 2 * scale;
        var rootY = y + Math.sin(facing) * 2 * scale;
        // Tip: out along the perpendicular (flank s) and swept slightly back.
        var tipX = rootX + Math.cos(perp) * s * reach + Math.cos(back) * sweep * 0.5;
        var tipY = rootY + Math.sin(perp) * s * reach + Math.sin(back) * sweep * 0.5;
        // Trailing point: further back so the blade has a closing edge.
        var tailX = rootX + Math.cos(back) * sweep + Math.cos(perp) * s * reach * 0.35;
        var tailY = rootY + Math.sin(back) * sweep + Math.sin(perp) * s * reach * 0.35;
        g.fillStyle(FAIRY_GREEN, 0.30 * alpha);
        g.fillTriangle(rootX, rootY, tipX, tipY, tailX, tailY);
        g.fillStyle(FAIRY_CORE, 0.45 * alpha * flap);
        g.fillTriangle(rootX, rootY, (tipX + rootX) / 2, (tipY + rootY) / 2, tailX, tailY);
      }
    }
  };

  /* ================================================================
     EXTRA-LIFE — cinematic resurrection
       The ship dies for real (same burst), a beat passes, then the fairy
       drifts SLOWLY to the death spot, rebuilds the arrow there, and the board
       clears as the arrow returns. Driven on real dt from scene.update's DEAD
       branch via _updateFairyRevive.
     ================================================================ */
  /* Called from the very top of _triggerGameOver. Returns true if the fairy
     takes the hit instead — the run continues. */
  M._fairyInterceptGameOver = function () {
    if (this._fairyReviving) return true;        // already mid-rescue → keep blocking death
    var f = this._fairy;
    if (!f || f.state !== 'FOLLOW') return false;
    var p = this.p;

    this._fairySaving   = true;
    this._fairyReviving = true;
    this._fairyDeathX = p.x;
    this._fairyDeathY = p.y;

    // The ship dies for real — the SAME burst as an ordinary game-over.
    this._explode(p.x, p.y, [255, 60, 0],  60);
    this._explode(p.x, p.y, [255, 220, 50], 30);
    this._explode(p.x, p.y, [255, 255, 255], 20);
    this.cameras.main.shake(280, 0.016);
    this.cameras.main.flash(300, 255, 60, 0);
    this._spawnWaveRing(p.x, p.y, { maxRadius: 170, color: 0xff5a00, expandTime: 0.42 });

    // Nothing left at the spot: hide the arrow, its trail and its orbs.
    this.playerSpr.setVisible(false);
    for (var ti = 0; ti < this.TRAIL_CAP; ti++) this._trail[ti].spr.setVisible(false);
    for (var oi = 0; oi < this._shieldOrbs.length; oi++) this._shieldOrbs[oi].setVisible(false);

    // Freeze the world ON the death; the revive cinematic runs on real dt from
    // the DEAD branch of scene.update.
    p.state = 'DEAD';
    p.invincible = true; p.invincTimer = 999999; p.dashInvinc = false;
    p.vx = 0; p.vy = 0;
    this.spawnTimer = -999999;

    // The fairy reacts, then begins its slow march to the death spot.
    f.state = 'REVIVE';
    f.rev = 'REACT'; f.revT = 0;
    f.revFromX = f.x; f.revFromY = f.y;

    this._triggerHitstop(240);     // mini "temps d'arrêt"
    return true;
  };

  /* The revive state machine — REACT → TRAVEL → REBUILD → finish. Real dt. */
  M._updateFairyRevive = function (dt) {
    var f = this._fairy, p = this.p;
    if (!f) return;
    var dxs = this._fairyDeathX, dys = this._fairyDeathY;
    // Hard-pin the ship at the death spot for the WHOLE cinematic — the game is
    // truly frozen: the player cannot move or drift until the resurrection.
    p.x = dxs; p.y = dys; p.vx = 0; p.vy = 0;
    f.revT += dt * 1000;
    f.wing += dt * 9;          // keep fluttering throughout
    f.bob  += dt * 3;

    if (f.rev === 'REACT') {
      // A startled beat: hovers, rises a touch, brightens.
      var rt = Math.min(1, f.revT / C.FAIRY_REV_REACT);
      f.x = f.revFromX;
      f.y = f.revFromY - 12 * smooth(rt) + Math.sin(f.bob) * 3;
      f.facing = Math.atan2(dys - f.y, dxs - f.x);
      if (f.revT >= C.FAIRY_REV_REACT) {
        f.rev = 'TRAVEL'; f.revT = 0;
        f.revFromX = f.x; f.revFromY = f.y;
      }
    } else if (f.rev === 'TRAVEL') {
      // Slow, eased, gently arcing glide to just above the death spot.
      var tt = Math.min(1, f.revT / C.FAIRY_REV_TRAVEL);
      var e  = smooth(tt);
      var arc = Math.sin(tt * Math.PI) * -48;           // lift over the midpoint
      var hoverY = dys - 24;
      f.x = f.revFromX + (dxs - f.revFromX) * e;
      f.y = f.revFromY + (hoverY - f.revFromY) * e + arc;
      f.facing = Math.atan2((hoverY - f.y) || -1, (dxs - f.x));
      if (Math.random() < 0.22) this._explode(f.x, f.y, [120, 255, 200], 3);
      if (tt >= 1) {
        f.rev = 'REBUILD'; f.revT = 0;
        f.x = dxs; f.y = dys - 24;
        this._spawnWaveRing(dxs, dys, { maxRadius: 120, color: FAIRY_GREEN, expandTime: 0.4 });
        this._explode(dxs, dys, [150, 255, 210], 18);
      }
    } else if (f.rev === 'REBUILD') {
      // The fairy hovers over the spot and pours energy down; the arrow assembles
      // back into being (fades + scales + spins to rest).
      var bt = Math.min(1, f.revT / C.FAIRY_REV_REBUILD);
      var eb = smooth(bt);
      f.x = dxs; f.y = dys - 24 - Math.sin(this.gameTime * 6) * 3;
      f.facing = -Math.PI / 2;

      p.x = dxs; p.y = dys;
      this.playerSpr.setTexture(this._pTexKey());
      this.playerSpr.setPosition(dxs, dys);
      this.playerSpr.setRotation(-Math.PI / 2 + (1 - eb) * 7);   // spins to upright
      this.playerSpr.setScale(0.3 + 0.75 * eb);
      this.playerSpr.setAlpha(eb);
      this.playerSpr.setTint(0x66ffcc);
      this.playerSpr.setBlendMode(Phaser.BlendModes.ADD);
      this.playerSpr.setVisible(true);

      // Converging assembly motes + the odd afterimage of the forming arrow.
      if (Math.random() < 0.6) {
        var aa = Math.random() * TAU, ar = 42 + Math.random() * 30;
        this._explode(dxs + Math.cos(aa) * ar, dys + Math.sin(aa) * ar, [120, 255, 200], 2);
      }
      if (eb > 0.4 && Math.random() < 0.25) this._addGhost(dxs, dys, 0.5 * eb, -Math.PI / 2, false);

      if (f.revT >= C.FAIRY_REV_REBUILD) { this._fairyReviveFinish(); return; }
    }

    // Trail + render (kept lively across the whole cinematic).
    f.trailT += dt * 1000;
    if (f.trailT > 24) {
      f.trailT = 0;
      f.trail.push({ x: f.x, y: f.y, a: 1 });
      if (f.trail.length > 16) f.trail.shift();
    }
    for (var i = 0; i < f.trail.length; i++) f.trail[i].a -= dt * 1.7;
    this._renderFairy(dt);
  };

  /* Arrow is back, under control → restore the player and clear the board. */
  M._fairyReviveFinish = function () {
    var p = this.p, dxs = this._fairyDeathX, dys = this._fairyDeathY;
    p.x = dxs; p.y = dys;
    p.state = 'MOVING'; p.vx = 0; p.vy = 0; p.angle = -Math.PI / 2;
    p.invincible = true; p.invincTimer = C.FAIRY_SAVE_IFRAMES; p.dashInvinc = false;
    p.dashAvailable = true; p.dashCooldown = 0;
    p.atkAvailable = true; p.atkCooldown = 0;
    p.spinAngle = 0; p.recoveryTimer = 0; p.recoveryWhiff = false;
    if (this.playerShields < 1) this.playerShields = Math.min(1, this.MAX_SHIELDS);

    // Hand the sprite back to _renderPlayer in a clean state.
    this.playerSpr.clearTint();
    this.playerSpr.setAlpha(1);
    this.playerSpr.setScale(1);
    this.playerSpr.setBlendMode(Phaser.BlendModes.ADD);
    this.playerSpr.setVisible(true);
    this.timeScale = 1.0;
    this.spawnTimer = 0;            // resume natural spawns (intercept had frozen them)

    // Consume the fairy + re-arm the event.
    this._fairy = null;
    if (this._fairyGfx) this._fairyGfx.clear();
    this._fairySaving = false;
    this._fairyReviving = false;
    this._treeCooldownT = C.TREE_COOLDOWN;
    this._floatLabel(dxs, dys - 120, LA.laGoT('laFairyRevive'), '#66ffcc');

    // The board clears as the arrow returns: a green nuke sweep wipes the screen
    // (the wave is advanced by _updateClearWave now that the player is alive).
    this._fairyNukeClear(dxs, dys);
  };

  /* Screen-wide green clear-sweep + projectile purge (the resurrection nuke). */
  M._fairyNukeClear = function (x, y) {
    var cam = this.cameras.main, zoom = cam.zoom || 1;
    var reach = Math.sqrt(cam.width * cam.width + cam.height * cam.height) * 0.5 / zoom + 640;
    this._clearWave = { active: true, t: 0, dur: 0.52, r: 0, maxR: reach };
    this._spawnWaveRing(x, y, { maxRadius: reach,        color: 0x66ffcc,   expandTime: 0.52 });
    this._spawnWaveRing(x, y, { maxRadius: reach * 0.82, color: FAIRY_GREEN, expandTime: 0.46 });
    this._spawnWaveRing(x, y, { maxRadius: reach * 0.55, color: 0xffffff,   expandTime: 0.38 });
    cam.flash(380, 150, 255, 190);
    cam.shake(340, 0.02);
    this._explode(x, y, [150, 255, 210], 54);
    this._explode(x, y, [235, 255, 245], 30);
    this._triggerHitstop(90);

    // Sweep hostile projectiles frozen during the cinematic.
    for (var pi = this.projectiles.length - 1; pi >= 0; pi--) {
      var pr = this.projectiles[pi];
      this._explode(pr.x, pr.y, [200, 255, 230], 4);
      this._destroyProjectile(pr);
      this.projectiles.splice(pi, 1);
    }
  };

})();

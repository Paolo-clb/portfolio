/* ==========================================================================
   Light Again — Data Highways (Autoroutes de Données)

   Long, thin, luminous "wind / code" corridors that streak across the arena.
   They are TERRAIN, not a pickup: stepping in — or, far better, DASHING through
   — carries the player along the flow like a conveyor belt, up to ~3× normal
   top speed. The flow direction is FIXED and random, so a highway is an
   unpredictable actor: it can rocket you out of trouble, or fling you straight
   into a wall. Pure mobility — no score, no damage, and (by request) NO
   guidance arrow: you find them at random.

     1. SPAWN  — gated + paced (≈ every 20–30 s, ~1 at a time). Placed via a
                 capsule fit so the WHOLE corridor (glow included) always sits
                 inside the map — never clipped by the world edge. Biased to
                 pass near the player so it's discoverable without a pointer.
     2. FORM   — the road "draws itself" from the upstream end (a bright
                 wavefront races along) over HIGHWAY_FADE_IN.
     3. LIVE   — flow particles stream, chevrons scroll, edges shimmer; the
                 conveyor carries anything (the player) riding the band. Strength
                 eases by how centred you are (lateral) and how far from the ends
                 (axial), so entering and leaving is buttery, never a snap.
     4. EVAPORATE — over HIGHWAY_FADE_OUT it retracts downstream and fades to
                 nothing, the carry easing off with it.

   Self-contained on this._highways (plain data) + one shared ADD graphics layer
   (depth 8 — under enemies/player, so they ride ON the road). The conveyor PUSH
   is applied from scene.js' player-movement block (player time, so it works
   during The World); the lifecycle + render tick on real dt from update().
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  /* ---- Flow look (local tuning; gameplay-facing numbers live in constants.js) ---- */
  var FLOW_PX_PER_S = 1080;  // how fast the streaming motes travel along the road
  var MOTE_SPACING  = 64;    // avg px between flow motes along the axis
  var CHEV_GAP      = 132;   // px between scrolling ">" chevrons
  var CHEV_PX_S     = 360;   // chevron scroll speed (slower than motes, like road arrows)
  var CHEV_SIZE     = 27;    // chevron length along the flow (px)
  var CHEV_HALF     = 16;    // chevron half-height (px)
  var SCAN_PX_S     = 760;   // a bright "scan" band sweeping the road
  var EDGE_WOB_AMP  = 6;     // edge wobble amplitude (px) — the "wind" ripple
  var EDGE_WOB_FREQ = 0.019; // edge wobble spatial frequency
  var EDGE_WOB_SPD  = 3.4;   // edge wobble scroll speed
  var BAND_N        = 36;    // samples along the corridor (band polygon + wavy edges)
  // The corridor tapers to soft points instead of stopping with a flat cut + a
  // deco circle — a long spindle: short pointed INTAKE upstream, longer pointed
  // EXHAUST downstream (asymmetry reads the flow direction), wisps spraying off.
  var NOSE_IN       = 240;   // px the upstream end tapers in over (sharper intake)
  var NOSE_OUT      = 380;   // px the downstream end tapers out over (longer, softer exhaust)

  var COL_CORE = 0xeaffff;   // hot near-white core
  var COL_WHITE = 0xffffff;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initDataHighways = function () {
    this._highways        = [];
    this._highwaySpawnT   = 0;
    this._highwayNextDelay = C.HIGHWAY_SPAWN_MIN_DELAY;  // wait before the very first one
    this._highwayGhostT   = 0;   // throttles the player speed-trail ghosts
    this._highwayBoost    = 0;   // strongest strength the player rode this frame (FX read)
    this._highwayInvuln   = false; // true while the player is protected by a highway
    this._highwayInvulnT  = 0;   // ms of remaining ride-invincibility (lingers briefly after exit)

    // One shared persistent ADD layer, sat UNDER enemies (20) and player (30) so
    // entities ride visibly on top of the road. Destroyed with the scene.
    this._highwayGfx = this.add.graphics();
    this._highwayGfx.setDepth(8);
    this._highwayGfx.setBlendMode(Phaser.BlendModes.ADD);

    // GROUND ANCHOR — a separate NORMAL (non-ADD) layer just ABOVE the PCB
    // (depth -9) and just BELOW the ADD band (8). A dark, slightly-wider pass on
    // it carves a "rainure" into the PCB so the road reads as engraved into the
    // board, not floating over it. Own layer because the blend mode is a
    // per-object setting — it can't differ from the ADD band on a shared object.
    this._highwayGrooveGfx = this.add.graphics();
    this._highwayGrooveGfx.setDepth(7.6);
  };

  /* Drop every live highway (the graphics object persists — just cleared). */
  M._clearDataHighways = function (silent) {
    if (this._highways) this._highways.length = 0;
    this._highwayBoost = 0;
    if (this._highwayGfx) this._highwayGfx.clear();
    if (this._highwayGrooveGfx) this._highwayGrooveGfx.clear();
  };

  /* ================================================================
     SPAWN GATE — paced, never during curated / fully-frozen states
     ================================================================ */
  // Block NEW spawns (existing ones still tick + render) during: the tutorial,
  // the upgrade slow-mo / draft, the Anomaly INTRO cinematic (player + world are
  // frozen — terrain shouldn't pop into a frozen frame), and Time Stop. The
  // Anomaly BARRIER fight is now FAIR GAME: highways still pace in, but spawn
  // CONFINED inside the quarantine circle (see _spawnHighway) as an in-zone dodge
  // tool. Giga/Mirror/Snake are fair game too — a highway helps you dodge them.
  M._highwaysSpawnSuspended = function () {
    return !!(this._tutorialActive || this._upSlowMoPhase || this._bossDraftPending ||
              this._upgradeDraftOpen || this._anomalyIntroActive ||
              this._twActive || !this.p || this.p.state === 'DEAD');
  };

  M._maybeSpawnHighway = function (dt) {
    if (this._highways.length >= C.HIGHWAY_MAX) return;
    this._highwaySpawnT += dt * 1000;
    if (this._highwaySpawnT < this._highwayNextDelay) return;
    this._highwaySpawnT = 0;
    this._highwayNextDelay = C.HIGHWAY_SPAWN_INTERVAL_MIN +
      Math.random() * (C.HIGHWAY_SPAWN_INTERVAL_MAX - C.HIGHWAY_SPAWN_INTERVAL_MIN);
    this._spawnHighway({});
  };

  /* ----------------------------------------------------------------
     PLACEMENT AVOIDANCE — a highway must never form ON a live map feature
     (Cache / Greed / Curse Fountain / Unstable Core / Prism) or right on the
     player, and reciprocally those features must never spawn on a live highway.
     The highway is a CAPSULE (centreline segment + HALF_WIDTH+FEATHER band), so
     every test is point(feature)-to-segment(centreline), not centre-to-centre.
     ---------------------------------------------------------------- */

  /* [x, y, exclusionRadius] for each live map feature + the player, for a NEW
     highway to dodge. A feature's radius is its interactive extent + FEATURE_PAD;
     the player gets a small personal bubble (SIZE + PLAYER_PAD). Greed is a SQUARE —
     use its CIRCUMSCRIBED circle (half·√2) so the band can't clip a corner either.
     Refs are optional (a feature may be absent) → guarded. Kept symmetric with the
     reciprocal radii the features pass to _pointClearsHighways. */
  M._highwayAvoidList = function () {
    var pad = C.HIGHWAY_FEATURE_PAD, list = [], p = this.p;
    if (p)           list.push([p.x, p.y, C.SIZE + C.HIGHWAY_PLAYER_PAD]);
    if (this._cache) list.push([this._cache.x, this._cache.y, this._cache.zoneR + pad]);
    if (this._greed) list.push([this._greed.x, this._greed.y, this._greed.half * Math.SQRT2 + pad]);
    if (this._fount) list.push([this._fount.x, this._fount.y, this._fount.zoneR + pad]);
    if (this._core)  list.push([this._core.x,  this._core.y,  C.CORE_FIELD_RADIUS + pad]);
    if (this._prism) list.push([this._prism.x, this._prism.y, C.PRISM_TRIGGER_R + pad]);
    return list;
  };

  /* Minimum signed clearance of the capsule (ax,ay)-(bx,by) against an avoid list:
     for each [x,y,r], (dist from the point to the centreline) − (r + band half-width).
     ≥ 0 everywhere ⇒ fully clear; the most-negative value measures the worst overlap
     (used to rank fallback rolls). Empty list ⇒ +∞ (nothing to avoid). */
  M._highwayCapsuleSlack = function (ax, ay, bx, by, list) {
    if (!list || !list.length) return Infinity;
    var hw = C.HIGHWAY_HALF_WIDTH + C.HIGHWAY_EDGE_FEATHER, worst = Infinity;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var slack = Math.sqrt(LA.segDistSq(o[0], o[1], ax, ay, bx, by)) - (hw + o[2]);
      if (slack < worst) worst = slack;
    }
    return worst;
  };

  /* Reciprocal test the map features call: true if a circle (x,y,r) stays clear of
     EVERY live highway band by FEATURE_PAD (so a feature never spawns on a highway).
     No highways ⇒ trivially true. */
  M._pointClearsHighways = function (x, y, r) {
    var hs = this._highways;
    if (!hs || !hs.length) return true;
    var need = r + C.HIGHWAY_HALF_WIDTH + C.HIGHWAY_EDGE_FEATHER + C.HIGHWAY_FEATURE_PAD;
    var need2 = need * need;
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (LA.segDistSq(x, y, h.ax, h.ay, h.bx, h.by) < need2) return false;
    }
    return true;
  };

  /* Place a highway as a capsule fully inside the disc map. The corridor centre
     is kept within a radius (Rk - half) of the origin, where Rk = WORLD_HALF -
     margin - (halfWidth+feather); since every capsule point is within `half` of
     the centre, the ENTIRE capsule (glow included) is guaranteed in-bounds.
     Biased so the road passes near the player (discoverable without a pointer),
     and re-rolled so the band never forms on a live map feature or on the ship
     (see _highwayAvoidList / _highwayCapsuleSlack). */
  M._spawnHighway = function (opts) {
    opts = opts || {};
    if (!this.p || this.p.state === 'DEAD') return;
    if (this._highways.length >= C.HIGHWAY_MAX) return;
    var p = this.p;

    var W  = C.HIGHWAY_HALF_WIDTH + C.HIGHWAY_EDGE_FEATHER;

    // Keep-in disc for the corridor. Normally that's the whole arena. But while
    // the Anomaly firewall is up the player is confined, so we fit the WHOLE
    // capsule inside the QUARANTINE circle instead (centre a.bx,a.by, radius a.R)
    // — a real in-zone dodge tool that never crosses the barrier. The keep-in
    // maths are identical (every capsule point lies within `half`+W of the
    // centreline centre); only the origin + radius change.
    var confined = !!(this._anomalyBarrierActive && this._anomaly);
    var az = confined ? this._anomaly : null;
    var ox = 0, oy = 0, Rk;
    if (confined) {
      ox = az.bx; oy = az.by;
      Rk = az.R - C.HIGHWAY_MARGIN_ZONE - W;
    } else {
      Rk = C.WORLD_HALF - C.HIGHWAY_MARGIN - W;
    }
    if (Rk < 40) Rk = 40;   // degenerate-zone guard (still produce a short stub)

    // Avoid forming ON a live map feature or the player: roll the placement up to
    // HIGHWAY_PLACE_TRIES times for a corridor whose band clears everything, keeping
    // the LEAST-overlapping roll as a fallback so a road always still appears, near +
    // in view. Skipped while CONFINED (the quarantine owns the arena and the features
    // are already dismissed for the anomaly) — a single roll there, as before.
    var avoid = confined ? null : this._highwayAvoidList();
    var maxTries = (avoid && avoid.length) ? C.HIGHWAY_PLACE_TRIES : 1;

    var dirx, diry, len, half, cx, cy, ax, ay, bx, by, alongOff;
    var best = null, bestSlack = -Infinity;
    for (var attempt = 0; attempt < maxTries; attempt++) {
      var ang = Math.random() * TAU;
      dirx = Math.cos(ang); diry = Math.sin(ang);
      len  = C.HIGHWAY_LEN_MIN + Math.random() * (C.HIGHWAY_LEN_MAX - C.HIGHWAY_LEN_MIN);
      half = len / 2;

      // In a quarantine, cap the corridor well under the zone diameter so it can be
      // placed OFF-centre (near the player) instead of being forced dead-centre.
      if (confined && half > az.R * C.HIGHWAY_ZONE_LEN_FRAC) half = az.R * C.HIGHWAY_ZONE_LEN_FRAC;
      // Shrink a corridor too long to leave the centre any room inside the keep-in disc.
      if (half > Rk * 0.96) { half = Rk * 0.96; }
      len = half * 2;
      var limR = Math.max(0, Rk - half);   // keep-in radius for the centreline centre

      // Target a near-point a short way from the player, then slide it somewhere
      // along the corridor's length so the player doesn't always land mid-road.
      // (Confined, the centre clamp below caps how far it can sit from the zone
      // centre, so the near-point is reined in to that same budget.)
      var nAng  = Math.random() * TAU;
      var nearMax = confined ? Math.min(C.HIGHWAY_SPAWN_NEAR_MAX, limR) : C.HIGHWAY_SPAWN_NEAR_MAX;
      var nearMin = Math.min(C.HIGHWAY_SPAWN_NEAR_MIN, nearMax);
      var nDist = nearMin + Math.random() * (nearMax - nearMin);
      var nearX = p.x + Math.cos(nAng) * nDist;
      var nearY = p.y + Math.sin(nAng) * nDist;
      alongOff = (Math.random() - 0.5) * 1.2 * half;   // ∈ [-0.6, 0.6]·half (bias to the boostable middle)
      cx = nearX - dirx * alongOff;
      cy = nearY - diry * alongOff;

      // Clamp the centre to the keep-in disc so the whole capsule stays inside the
      // map (or, while confined, inside the quarantine circle around ox,oy).
      var rcx = cx - ox, rcy = cy - oy;
      var cd = Math.sqrt(rcx * rcx + rcy * rcy);
      if (cd > limR && cd > 0) { var cs = limR / cd; cx = ox + rcx * cs; cy = oy + rcy * cs; }

      ax = cx - dirx * half; ay = cy - diry * half;   // upstream end
      bx = cx + dirx * half; by = cy + diry * half;   // downstream end

      if (!avoid) break;                              // confined / nothing to avoid → take this roll
      var slack = this._highwayCapsuleSlack(ax, ay, bx, by, avoid);
      if (slack >= 0) { best = null; break; }         // fully clear → use these vars as-is
      if (slack > bestSlack) {                         // remember the least-overlapping roll
        bestSlack = slack;
        best = { dirx: dirx, diry: diry, len: len, half: half, cx: cx, cy: cy,
                 ax: ax, ay: ay, bx: bx, by: by, alongOff: alongOff };
      }
    }
    if (best) {   // no fully-clear roll in the budget → fall back to the least-overlapping one
      dirx = best.dirx; diry = best.diry; len = best.len; half = best.half;
      cx = best.cx; cy = best.cy; ax = best.ax; ay = best.ay; bx = best.bx; by = best.by;
      alongOff = best.alongOff;
    }

    var h = {
      ax: ax, ay: ay, bx: bx, by: by, cx: cx, cy: cy,
      dirx: dirx, diry: diry, len: len,
      age: 0, lifeFactor: 0, sweep: 0, dissolve: 0,
      flowPhase: Math.random() * 1000, shimmer: Math.random() * 1000,
      seed: Math.random() * 1000,
      flowFracPerSec: FLOW_PX_PER_S / len,
      motes: [],
      _pInside: false, _dissolveFx: false, dead: false,
    };

    var nMotes = Math.max(8, Math.round(len / MOTE_SPACING));
    for (var i = 0; i < nMotes; i++) {
      h.motes.push({
        u: Math.random(),
        lat: (Math.random() * 2 - 1) * C.HIGHWAY_HALF_WIDTH * 0.82,
        len: 13 + Math.random() * 26,
        thick: 1.3 + Math.random() * 1.9,
        bright: 0.5 + Math.random() * 0.5,
        spd: 0.82 + Math.random() * 0.62,            // parallax: motes travel at slightly different speeds
      });
    }

    this._highways.push(h);

    // Materialise FX — a soft ring at the near-point + a spark at each mouth.
    var cols = LA.getColors();
    this._spawnWaveRing(ax + dirx * Math.min(half, Math.abs(alongOff) + 60),
                        ay + diry * Math.min(half, Math.abs(alongOff) + 60),
                        { maxRadius: 150, color: cols.cyan, expandTime: 0.5 });
    this._explode(ax, ay, cols.cyanArr, 8);
    this._explode(bx, by, cols.cyanArr, 8);
  };

  /* ================================================================
     UPDATE — spawn gate, tick each highway, cull expired, render
     ================================================================ */
  M._updateDataHighways = function (dt) {
    // The barrier slam wipes any FULL-MAP highway streaking across the arena (it
    // would cross the firewall) — a one-shot scatter on the rising edge. Fresh
    // CONFINED highways then pace in DURING the fight, placed wholly inside the
    // quarantine by _spawnHighway. Edge-only: spawns made later in the same fight
    // (already confined) are NOT re-dismissed.
    var trapped = !!(this._anomalyBarrierActive || this._anomalyIntroActive);
    if (trapped && !this._highwayTrappedPrev && this._highways.length) this._dismissHighwaysForAnomaly();
    this._highwayTrappedPrev = trapped;

    if (!this._highwaysSpawnSuspended()) this._maybeSpawnHighway(dt);

    var hs = this._highways;
    for (var i = hs.length - 1; i >= 0; i--) {
      this._tickHighway(hs[i], dt);
      if (hs[i].dead) hs.splice(i, 1);
    }
    this._renderHighways(dt);
  };

  /* The anomaly just trapped the player → blow every live highway off the field
     with a quick scatter (the quarantine owns the arena now). */
  M._dismissHighwaysForAnomaly = function () {
    var cols = LA.getColors();
    for (var i = 0; i < this._highways.length; i++) {
      var h = this._highways[i];
      this._spawnWaveRing(h.cx, h.cy, { maxRadius: 170, color: cols.cyan, expandTime: 0.4 });
      this._explode(h.cx, h.cy, cols.cyanArr, 12);
      this._explode(h.bx, h.by, [200, 255, 255], 8);
    }
    this._clearDataHighways(true);
    this._highwayInvuln = false;
    this._highwayInvulnT = 0;
  };

  M._tickHighway = function (h, dt) {
    var ms = dt * 1000;
    h.age += ms;
    var L = C.HIGHWAY_LIFETIME, fi = C.HIGHWAY_FADE_IN, fo = C.HIGHWAY_FADE_OUT;

    if (h.age < fi)            h.lifeFactor = smooth(h.age / fi);
    else if (h.age > L - fo)   h.lifeFactor = smooth(Math.max(0, L - h.age) / fo);
    else                        h.lifeFactor = 1;

    h.sweep    = Math.min(1, h.age / fi);
    h.dissolve = h.age > L - fo ? Math.min(1, (h.age - (L - fo)) / fo) : 0;

    // One-shot scatter puffs when it starts evaporating.
    if (h.dissolve > 0 && !h._dissolveFx) {
      h._dissolveFx = true;
      var cols = LA.getColors();
      this._explode(h.cx, h.cy, cols.cyanArr, 10);
      this._explode(h.bx, h.by, [200, 255, 255], 8);
    }

    if (h.age >= L) { h.dead = true; return; }

    h.flowPhase += dt;
    h.shimmer   += dt;

    var vU = h.flowFracPerSec;
    for (var i = 0; i < h.motes.length; i++) {
      var mo = h.motes[i];
      mo.u += vU * mo.spd * dt;
      if (mo.u >= 1) mo.u -= 1;
      else if (mo.u < 0) mo.u += 1;
    }
  };

  /* ================================================================
     CONVEYOR PUSH — applied from the player-movement block (scene.js),
     on PLAYER time (pS60), so it carries you even during The World.
     Pure positional conveyor: never mutates p.vx, so entry/exit is smooth
     and the player keeps full control of their own velocity.
     ================================================================ */
  M._applyHighwayFlow = function (pS60, pMs) {
    // Ride-invincibility grace decays every frame; it's refreshed below while the
    // player is actually in a flow band, so it lingers HIGHWAY_INVULN_GRACE ms
    // after stepping off (a smooth protective tail, not a hard cutoff).
    this._highwayInvulnT = Math.max(0, (this._highwayInvulnT || 0) - (pMs || 0));

    var hs = this._highways;
    if (!hs || !hs.length) { this._highwayBoost = 0; this._highwayInvuln = this._highwayInvulnT > 0; return; }
    // NB: during the Anomaly BARRIER the conveyor stays ON — the only live roads
    // there are CONFINED inside the quarantine, so the carry never fights the
    // player's confinement (and the ride-invuln helps you dodge the lasers). The
    // INTRO never reaches here (scene.js freezes + early-returns before movement).
    var p = this.p;
    if (!p || p.state === 'DEAD') { this._highwayBoost = 0; this._highwayInvuln = false; this._highwayInvulnT = 0; return; }

    var accVx = 0, accVy = 0, best = 0;
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      var s = this._highwayStrength(h, p.x, p.y);
      if (s <= 0.001) {
        if (h._pInside) h._pInside = false;
        continue;
      }
      accVx += h.dirx * C.HIGHWAY_FLOW_SPEED * s;
      accVy += h.diry * C.HIGHWAY_FLOW_SPEED * s;
      if (s > best) best = s;

      // Entry whoosh — edge-triggered the first frame you bite into the flow.
      if (!h._pInside && s > 0.28) { h._pInside = true; this._highwayEntryFx(h); }
      if (h._pInside && s < 0.12)  { h._pInside = false; }
    }

    // Overlap guard: cap the summed conveyor so two overlapping roads can't fling
    // the player at runaway speed.
    var cap = C.HIGHWAY_FLOW_SPEED * C.HIGHWAY_FLOW_CAP_MULT;
    var mag = Math.sqrt(accVx * accVx + accVy * accVy);
    if (mag > cap) { var k = cap / mag; accVx *= k; accVy *= k; }

    p.x += accVx * pS60;
    p.y += accVy * pS60;
    this._highwayBoost = best;

    // While meaningfully inside a flow band, you're UNTOUCHABLE (refresh the grace
    // timer). Guard checked in player.js _damagePlayer. Threshold > the entry
    // feather so merely grazing the very edge doesn't grant it.
    if (best > 0.12) this._highwayInvulnT = C.HIGHWAY_INVULN_GRACE;
    this._highwayInvuln = this._highwayInvulnT > 0;

    // Speed-trail: leave extra ghosts while genuinely riding fast, to sell the ×3.
    if (best > 0.45) {
      this._highwayGhostT++;
      var sp2 = p.vx * p.vx + p.vy * p.vy;
      if ((this._highwayGhostT % 2) === 0 && (sp2 > 5 || best > 0.7)) {
        this._addGhost(p.x, p.y, 0.42 * best, p.angle, p.state === 'DASH_ATTACKING');
      }
    }
  };

  /* Strength of a highway's pull at (x,y): life × axial-ease × lateral-ease,
     each smoothstepped so the boost fades in/out with no snap. 0 = outside. */
  M._highwayStrength = function (h, x, y) {
    var life = h.lifeFactor;
    if (life <= 0) return 0;

    var rx = x - h.ax, ry = y - h.ay;
    var t = rx * h.dirx + ry * h.diry;          // distance from the upstream end along the axis
    if (t <= 0 || t >= h.len) return 0;

    var ef = C.HIGHWAY_END_FEATHER;
    var axial;
    if (t < ef)               axial = smooth(t / ef);
    else if (t > h.len - ef)  axial = smooth((h.len - t) / ef);
    else                      axial = 1;
    if (axial <= 0) return 0;

    var perp = Math.abs(ry * h.dirx - rx * h.diry);   // |perpendicular distance to the centreline|
    var Wc = C.HIGHWAY_HALF_WIDTH, F = C.HIGHWAY_EDGE_FEATHER;
    var lateral;
    if (perp <= Wc)        lateral = 1;
    else if (perp >= Wc + F) return 0;
    else                   lateral = smooth(1 - (perp - Wc) / F);

    return life * axial * lateral;
  };

  M._highwayEntryFx = function (h) {
    var p = this.p, cols = LA.getColors();
    this._explode(p.x, p.y, cols.cyanArr, 6);
    for (var i = 0; i < 3; i++) {
      this._addGhost(p.x - h.dirx * i * 7, p.y - h.diry * i * 7, 0.5, p.angle, false);
    }
  };

  /* The flow is TERRAIN, so it sweeps enemies too (the "unpredictable actor"):
     a pure positional carry on WORLD time (s60), so it freezes with the board
     during The World / hitstop. Slightly weaker than the player's carry
     (HIGHWAY_ENEMY_FLOW_MULT) so a highway still reads as YOUR escape tool.
     Near the DOWNSTREAM mouth, enemies also get a real velocity LAUNCH (forward
     + a lateral fan) so they're spat out and scattered instead of piling up just
     past the end of the road. Called from update() right after _updateEnemies.
     Projectiles are NOT swept (the user kept those on rails). */
  M._applyHighwayFlowToEnemies = function (s60) {
    var hs = this._highways;
    if (!hs || !hs.length || s60 <= 0) return;
    var enemies = this.enemies;
    if (!enemies || !enemies.length) return;

    // While the Anomaly firewall is up, the trapped crowd must stay INSIDE the
    // quarantine — clamp swept enemies to the barrier and skip the exhaust LAUNCH
    // (a velocity kick could fling a sub-enemy out of the zone, and the shield
    // only drops once every trapped enemy is dead → an escapee would soft-lock it).
    var confined = !!(this._anomalyBarrierActive && this._anomaly);
    var az = confined ? this._anomaly : null;
    var bLim = confined ? (az.R - C.SIZE) : 0;

    var fs  = C.HIGHWAY_FLOW_SPEED * C.HIGHWAY_ENEMY_FLOW_MULT;
    var cap = fs * C.HIGHWAY_FLOW_CAP_MULT;
    var wLimMargin = C.SIZE;              // belt-and-suspenders edge guard (unreachable in practice)
    var W = C.HIGHWAY_HALF_WIDTH, F = C.HIGHWAY_EDGE_FEATHER, WF = W + F;
    var ef = C.HIGHWAY_END_FEATHER, ez = C.HIGHWAY_EXHAUST_ZONE;
    var ejSpeed = C.HIGHWAY_EJECT_SPEED, ejSpread = C.HIGHWAY_EJECT_SPREAD;

    for (var e = 0; e < enemies.length; e++) {
      var en = enemies[e];
      if (en._spawnAnimT != null && en._spawnAnimT < 1) continue;  // not done materialising → leave it
      var accx = 0, accy = 0, touched = false;
      for (var i = 0; i < hs.length; i++) {
        var h = hs[i];
        if (h.lifeFactor <= 0) continue;
        var dirx = h.dirx, diry = h.diry;
        var rx = en.x - h.ax, ry = en.y - h.ay;
        var t = rx * dirx + ry * diry;                 // along-axis distance from the upstream end
        var perpS = ry * dirx - rx * diry;             // signed perpendicular
        var perp = perpS < 0 ? -perpS : perpS;
        if (perp > WF) continue;                       // outside the lateral band entirely

        // Conveyor carry — only within the segment, smoothstepped like the player's.
        if (t > 0 && t < h.len) {
          var axial = t < ef ? smooth(t / ef) : (t > h.len - ef ? smooth((h.len - t) / ef) : 1);
          var lateral = perp <= W ? 1 : smooth(1 - (perp - W) / F);
          var s = h.lifeFactor * axial * lateral;
          if (s > 0.001) { accx += dirx * fs * s; accy += diry * fs * s; touched = true; }
        }

        // Exhaust LAUNCH near + just past the downstream mouth (anti-stack): bring
        // the along-flow velocity up to a target (no overshoot) so they keep moving
        // out, plus a lateral fan so they scatter rather than queue single-file.
        // Disabled while confined (a kick could escape the quarantine — see above).
        if (!confined && t > h.len - ez && t < h.len + ez * 0.5) {
          var zoneF = smooth((t - (h.len - ez)) / ez) * h.lifeFactor;
          if (zoneF > 0.02) {
            var vAlong = en.vx * dirx + en.vy * diry;
            var targetV = ejSpeed * zoneF;
            if (vAlong < targetV) { var addF = targetV - vAlong; en.vx += dirx * addF; en.vy += diry * addF; }
            var sgn = perpS >= 0 ? 1 : -1;
            if (perpS === 0) sgn = (e & 1) ? 1 : -1;
            en.vx += (-diry) * sgn * ejSpread * zoneF * s60;
            en.vy += (dirx)  * sgn * ejSpread * zoneF * s60;
            touched = true;
          }
        }
      }
      if (!touched) continue;
      if (accx !== 0 || accy !== 0) {
        var mag = Math.sqrt(accx * accx + accy * accy);
        if (mag > cap) { var k = cap / mag; accx *= k; accy *= k; }
        en.x += accx * s60;
        en.y += accy * s60;
      }
      var enc = LA.clampDisc(en.x, en.y, wLimMargin); en.x = enc.x; en.y = enc.y;
      // Keep swept enemies inside the firewall (see confined note above).
      if (confined) {
        var bdx = en.x - az.bx, bdy = en.y - az.by;
        var bd = Math.sqrt(bdx * bdx + bdy * bdy);
        if (bd > bLim && bd > 0) { var bk = bLim / bd; en.x = az.bx + bdx * bk; en.y = az.by + bdy * bk; }
      }
    }
  };

  /* ================================================================
     RENDER — one shared ADD layer; cull per-highway + per-mote to the view.
     ================================================================ */
  M._renderHighways = function (dt) {
    var g = this._highwayGfx;
    if (!g) return;
    g.clear();
    // Groove layer is cleared in lockstep with the ADD band so they never desync.
    var gg = this._highwayGrooveGfx;
    if (gg) gg.clear();
    var cols = LA.getColors();
    var hs = this._highways;
    if (hs && hs.length) {
      var view = this.cameras.main.worldView;
      for (var i = 0; i < hs.length; i++) this._renderOneHighway(g, hs[i], view, cols, gg);
    }
    // ---- Ride-invincibility aura around the arrow (fades out with the grace) ----
    if (this._highwayInvuln && this.p && this.p.state !== 'DEAD') {
      var p = this.p, gt = this.gameTime || 0;
      var fade = Math.min(1, (this._highwayInvulnT || 0) / C.HIGHWAY_INVULN_GRACE);
      var pulse = 0.6 + 0.4 * Math.sin(gt * 9);
      var rr = C.SIZE * 1.7 + 3 * pulse;
      g.fillStyle(cols.cyan, 0.10 * fade);
      g.fillCircle(p.x, p.y, rr * 1.18);
      g.lineStyle(2.4, COL_WHITE, 0.5 * pulse * fade);
      g.strokeCircle(p.x, p.y, rr);
      g.lineStyle(1.3, cols.cyan, 0.7 * fade);
      g.strokeCircle(p.x, p.y, rr * 0.76);
    }
  };

  M._renderOneHighway = function (g, h, view, cols, gg) {
    var life = h.lifeFactor;
    if (life <= 0.004) return;

    // Whole-capsule AABB cull (expanded a touch for glow).
    var W  = C.HIGHWAY_HALF_WIDTH, F = C.HIGHWAY_EDGE_FEATHER, WF = W + F;
    var pad = WF + 40;
    var minx = Math.min(h.ax, h.bx) - pad, maxx = Math.max(h.ax, h.bx) + pad;
    var miny = Math.min(h.ay, h.by) - pad, maxy = Math.max(h.ay, h.by) + pad;
    if (maxx < view.x || minx > view.right || maxy < view.y || miny > view.bottom) return;

    var dirx = h.dirx, diry = h.diry, px = -diry, py = dirx;   // perp = (-diry, dirx)
    var ax = h.ax, ay = h.ay, len = h.len, cyan = cols.cyan;
    var vL = view.x - 80, vR = view.right + 80, vT = view.y - 80, vB = view.bottom + 80;

    // Visible axial window: draw-in sweep from the front, evaporation retract from the back.
    var t0 = h.dissolve > 0 ? smooth(h.dissolve) * len * 0.82 : 0;
    var t1 = h.sweep < 1 ? h.sweep * len : len;
    if (t1 <= t0 + 1) return;

    function pt(t, lat) {
      return { x: ax + dirx * t + px * lat, y: ay + diry * t + py * lat };
    }
    function onScreen(q) { return q.x >= vL && q.x <= vR && q.y >= vT && q.y <= vB; }

    // Spindle profile: half-width tapers smoothly to ~0 at the visible ends (no
    // flat cut). Short nose upstream, longer nose downstream → the shape itself
    // reads which way the flow runs.
    var niN = Math.min(NOSE_IN,  (t1 - t0) * 0.45);
    var noN = Math.min(NOSE_OUT, (t1 - t0) * 0.45);
    function bandHalf(t) {
      var a = (t - t0) / niN; if (a > 1) a = 1; else if (a < 0) a = 0;
      var b = (t1 - t) / noN; if (b > 1) b = 1; else if (b < 0) b = 0;
      return smooth(a < b ? a : b);
    }

    var A = life;                                          // base alpha
    var hot = 0.7 + 0.3 * Math.sin(h.shimmer * 3 + h.seed);

    // Sample the centreline + taper once, reuse for every layer.
    var sc = [];
    for (var k = 0; k <= BAND_N; k++) {
      var tk = t0 + (t1 - t0) * (k / BAND_N);
      sc.push({ x: ax + dirx * tk, y: ay + diry * tk, h: bandHalf(tk) });
    }

    // Reusable spindle filler (target gfx + width mult on the per-sample taper).
    // Used both for the dark groove (NORMAL layer) and the glow band (ADD layer).
    function spindle(gfx, halfW, color, alpha) {
      if (alpha <= 0.003) return;
      gfx.fillStyle(color, alpha);
      gfx.beginPath();
      var s0 = sc[0], h0 = halfW * s0.h;
      gfx.moveTo(s0.x + px * h0, s0.y + py * h0);
      for (var a = 1; a <= BAND_N; a++) { var sa = sc[a], ha = halfW * sa.h; gfx.lineTo(sa.x + px * ha, sa.y + py * ha); }
      for (var b = BAND_N; b >= 0; b--) { var sb = sc[b], hb = halfW * sb.h; gfx.lineTo(sb.x - px * hb, sb.y - py * hb); }
      gfx.closePath(); gfx.fillPath();
    }

    // ---- GROUND ANCHOR: dark NORMAL groove a touch WIDER than the band, on a
    // lower-depth non-ADD layer, so the road looks engraved INTO the PCB (a
    // shadowed channel) rather than floating on top. Two soft passes (wide rim +
    // inner pit) fade with life so it appears/retracts with the road. ----
    if (gg) {
      spindle(gg, WF * 1.30, 0x000000, 0.10 * A);   // wide soft rim of the channel
      spindle(gg, WF * 1.05, 0x040810, 0.18 * A);   // inner pit — slightly cool-black
    }

    // ---- Glowing tapered band (3 nested spindle polygons: halo → glow → core) ----
    function bandPoly(halfW, color, alpha) { spindle(g, halfW, color, alpha); }
    bandPoly(WF * 1.12, cyan, 0.05 * A);
    bandPoly(WF,        cyan, 0.085 * A);
    bandPoly(W,         cyan, 0.12 * A * (0.85 + 0.15 * hot));

    // ---- AXIAL GRADIENT: an extra ADD overlay whose alpha ramps from the
    // upstream INTAKE (sourd) to the downstream EXHAUST (chaud), reinforcing the
    // sense of flow already carried by the chevrons. Built as a strip of quads
    // along the existing samples so each segment can carry its own alpha — cheap
    // (BAND_N quads, reusing sc[]). Purely additive: it warms the exit, it never
    // darkens or alters the band already drawn. ----
    for (var ag = 0; ag < BAND_N; ag++) {
      var s1 = sc[ag], s2 = sc[ag + 1];
      // f: 0 at intake → 1 at exhaust (along the visible window).
      var f0 = ag / BAND_N, f1 = (ag + 1) / BAND_N;
      // Bias to the back half so the head stays restrained and the tail glows hot.
      var aA = (0.018 + 0.085 * smooth(f0)) * A * (0.85 + 0.15 * hot);
      var aB = (0.018 + 0.085 * smooth(f1)) * A * (0.85 + 0.15 * hot);
      var avg = (aA + aB) * 0.5;
      if (avg <= 0.004) continue;
      var w1 = W * 0.92 * s1.h, w2 = W * 0.92 * s2.h;
      g.fillStyle(COL_CORE, avg);
      g.beginPath();
      g.moveTo(s1.x + px * w1, s1.y + py * w1);
      g.lineTo(s2.x + px * w2, s2.y + py * w2);
      g.lineTo(s2.x - px * w2, s2.y - py * w2);
      g.lineTo(s1.x - px * w1, s1.y - py * w1);
      g.closePath(); g.fillPath();
    }

    // ---- Wavy edge lines (the "wind") — follow the spindle, converge at the tips ----
    function drawEdge(side, width, color, alpha) {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      for (var k2 = 0; k2 <= BAND_N; k2++) {
        var s = sc[k2];
        var tk2 = t0 + (t1 - t0) * (k2 / BAND_N);
        var wob = Math.sin(tk2 * EDGE_WOB_FREQ + h.shimmer * EDGE_WOB_SPD * side + side) * EDGE_WOB_AMP;
        var hw = (W + wob) * s.h;
        var qx = s.x + px * side * hw, qy = s.y + py * side * hw;
        if (k2 === 0) g.moveTo(qx, qy); else g.lineTo(qx, qy);
      }
      g.strokePath();
    }
    drawEdge(1,  6, cyan, 0.10 * A); drawEdge(1,  2, COL_CORE, 0.75 * A * hot);
    drawEdge(-1, 6, cyan, 0.10 * A); drawEdge(-1, 2, COL_CORE, 0.75 * A * hot);

    // ---- Speed lines: a few SHORT, STATIC streaks parallel to the band for grain
    // (etched into the lane, not moving — the motes already carry the motion). Seeded
    // off h.seed so each road keeps the same set; very low alpha so it never saturates. ----
    var SL_N = 7;
    g.lineStyle(1, cyan, 0.06 * A);
    for (var sl = 0; sl < SL_N; sl++) {
      // Pseudo-random but stable placement along/across the lane from the seed.
      var r1 = (Math.sin(h.seed * 12.9898 + sl * 78.233) * 43758.5453);
      r1 = r1 - Math.floor(r1);
      var r2 = (Math.sin(h.seed * 39.346 + sl * 11.135) * 24634.6345);
      r2 = r2 - Math.floor(r2);
      var slt = t0 + (t1 - t0) * (0.06 + 0.88 * r1);   // keep clear of the pointed tips
      if (slt <= t0 || slt >= t1) continue;
      var slhalf = bandHalf(slt);
      if (slhalf <= 0.05) continue;
      var slen = 18 + 30 * r2;                          // short streaks
      var slat = (r2 * 2 - 1) * W * 0.72 * slhalf;      // offset across the lane, inside the taper
      var sA = pt(slt, slat);
      if (!onScreen(sA)) continue;
      var sB = pt(slt + slen, slat);
      g.beginPath(); g.moveTo(sA.x, sA.y); g.lineTo(sB.x, sB.y); g.strokePath();
    }

    // ---- Scan band: a bright cross-glow sweeping along the road ----
    var st = ((h.flowPhase * SCAN_PX_S) % len + len) % len;
    if (st > t0 && st < t1) {
      var scc = pt(st, 0);
      if (onScreen(scc)) {
        var hwS = W * bandHalf(st);
        var e1 = pt(st, hwS), e2 = pt(st, -hwS);
        g.lineStyle(5, COL_WHITE, 0.20 * A);
        g.beginPath(); g.moveTo(e1.x, e1.y); g.lineTo(e2.x, e2.y); g.strokePath();
      }
    }

    // ---- Flow motes — streaming streaks (kept inside the spindle by the taper) ----
    for (var mi = 0; mi < h.motes.length; mi++) {
      var mo = h.motes[mi];
      var mt = mo.u * len;
      if (mt <= t0 || mt >= t1) continue;
      var c = pt(mt, mo.lat * bandHalf(mt));
      if (!onScreen(c)) continue;
      var tail = { x: c.x - dirx * mo.len, y: c.y - diry * mo.len };
      var mA = A * mo.bright;
      g.lineStyle(mo.thick, cyan, 0.85 * mA);
      g.beginPath(); g.moveTo(tail.x, tail.y); g.lineTo(c.x, c.y); g.strokePath();
      g.fillStyle(COL_WHITE, 0.9 * mA);
      g.fillCircle(c.x, c.y, mo.thick * 0.62);
    }

    // ---- Scrolling ">>>" chevrons down the centre (unmistakable flow direction) ----
    var off = ((h.flowPhase * CHEV_PX_S) % CHEV_GAP + CHEV_GAP) % CHEV_GAP;
    for (var ct = off; ct < t1; ct += CHEV_GAP) {
      if (ct < t0) continue;
      var cc = pt(ct, 0);
      if (!onScreen(cc)) continue;
      var endFade = smooth(Math.min(ct - t0, t1 - ct) / 120);
      var travel  = 0.55 + 0.45 * Math.sin(ct * 0.02 - h.flowPhase * 6 + h.seed);
      var cA = A * endFade * travel;
      if (cA <= 0.02) continue;
      var chf = Math.max(0.35, bandHalf(ct));
      var tip = pt(ct + CHEV_SIZE * 0.5 * chf, 0);
      var bl  = pt(ct - CHEV_SIZE * 0.5 * chf,  CHEV_HALF * chf);
      var br  = pt(ct - CHEV_SIZE * 0.5 * chf, -CHEV_HALF * chf);
      g.lineStyle(4.5, cyan, 0.45 * cA);
      g.beginPath(); g.moveTo(bl.x, bl.y); g.lineTo(tip.x, tip.y); g.lineTo(br.x, br.y); g.strokePath();
      g.lineStyle(2, COL_CORE, 0.95 * cA);
      g.beginPath(); g.moveTo(bl.x, bl.y); g.lineTo(tip.x, tip.y); g.lineTo(br.x, br.y); g.strokePath();
    }

    // ---- Upstream INTAKE: just a soft glow at the pointed mouth ----
    if (t0 < 30) {
      var tipA = pt(0, 0);
      if (onScreen(tipA)) { g.fillStyle(COL_CORE, 0.30 * A * hot); g.fillCircle(tipA.x, tipA.y, 4); }
    }

    // ---- Downstream EXHAUST: just a soft glow at the pointed mouth ----
    if (t1 >= len - 2) {
      var tipB = pt(len, 0);
      if (onScreen(tipB)) { g.fillStyle(COL_CORE, 0.40 * A * hot); g.fillCircle(tipB.x, tipB.y, 4.5); }
    }

    // ---- Draw-in leading tip (only while forming): a bright comet head, not a bar ----
    if (h.sweep < 1) {
      var fc = pt(t1, 0);
      if (onScreen(fc)) {
        g.fillStyle(cyan, 0.32 * A);   g.fillCircle(fc.x, fc.y, 20);
        g.fillStyle(COL_WHITE, 0.85 * A); g.fillCircle(fc.x, fc.y, 9);
        var fp = pt(t1 + 18, 0);
        g.fillStyle(COL_CORE, 0.5 * A); g.fillCircle(fp.x, fp.y, 4);
      }
    }
  };

})();

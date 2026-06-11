/* ==========================================================================
   Light Again — Canvas Texture Generators
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;

  /* ---- Arrow path (shared helper) ---- */

  function _drawArrowPath(g2, ox, oy, s) {
    g2.beginPath();
    g2.moveTo(ox + s,          oy);
    g2.lineTo(ox - s * 0.6,   oy - s * 0.55);
    g2.lineTo(ox - s * 0.25,  oy);
    g2.lineTo(ox - s * 0.6,   oy + s * 0.55);
    g2.closePath();
  }

  /* ---- Public texture builders ---- */

  LA.buildArrowTex = function (tm, key, r, g, b, s, blur, isDashAtk) {
    if (tm.exists(key)) tm.remove(key);
    var pad = blur + 4;
    var W = Math.ceil(s * 2.2 + pad * 2);
    var H = Math.ceil(s * 1.2 + pad * 2);
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    var g2 = oc.getContext('2d');
    var ox = W / 2, oy = H / 2;

    if (isDashAtk) {
      // Bicolor outer halo: separate cyan (tip) and crimson (tail) glow passes
      g2.save();
      g2.globalCompositeOperation = 'lighter';
      g2.shadowColor = 'rgba(0,220,255,0.55)';
      g2.shadowBlur = 62;
      _drawArrowPath(g2, ox, oy, s);
      g2.fillStyle = 'rgba(0,220,255,0.02)';
      g2.fill();
      g2.shadowColor = 'rgba(255,20,60,0.50)';
      g2.shadowBlur = 44;
      _drawArrowPath(g2, ox, oy, s);
      g2.fillStyle = 'rgba(255,20,60,0.02)';
      g2.fill();
      g2.shadowBlur = 0;
      g2.restore();
    }

    // Middle glow pass
    g2.save();
    g2.globalCompositeOperation = 'lighter';
    if (isDashAtk) {
      var mg = g2.createLinearGradient(ox - s * 0.6, oy, ox + s, oy);
      mg.addColorStop(0,   'rgba(255,20,60,0.45)');
      mg.addColorStop(0.5, 'rgba(210,0,200,0.35)');
      mg.addColorStop(1,   'rgba(0,210,255,0.45)');
      g2.shadowColor = 'rgba(160,40,200,0.70)';
      g2.shadowBlur = blur;
      _drawArrowPath(g2, ox, oy, s);
      g2.fillStyle = mg;
    } else {
      g2.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.9)';
      g2.shadowBlur = blur;
      _drawArrowPath(g2, ox, oy, s);
      g2.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.35)';
    }
    g2.fill();
    g2.shadowBlur = 0;
    g2.restore();

    // Solid body fill
    _drawArrowPath(g2, ox, oy, s);
    if (isDashAtk) {
      var bg = g2.createLinearGradient(ox - s * 0.6, oy, ox + s, oy);
      bg.addColorStop(0,    'rgb(255,20,60)');    // tail = crimson
      bg.addColorStop(0.45, 'rgb(220,10,190)');   // mid  = magenta
      bg.addColorStop(1,    'rgb(0,200,255)');    // tip  = cyan
      g2.fillStyle = bg;
    } else {
      // Directional volume: darker tail → full colour → near-white hot tip, so the
      // arrow reads as a lit dart with a clear facing instead of a flat fill.
      var tipR = (r + (255 - r) * 0.6) | 0, tipG = (g + (255 - g) * 0.6) | 0, tipB = (b + (255 - b) * 0.6) | 0;
      var tlR = (r * 0.5) | 0, tlG = (g * 0.5) | 0, tlB = (b * 0.5) | 0;
      var bgr = g2.createLinearGradient(ox - s * 0.6, oy, ox + s, oy);
      bgr.addColorStop(0,   'rgb(' + tlR + ',' + tlG + ',' + tlB + ')');
      bgr.addColorStop(0.5, 'rgb(' + r + ',' + g + ',' + b + ')');
      bgr.addColorStop(1,   'rgb(' + tipR + ',' + tipG + ',' + tipB + ')');
      g2.fillStyle = bgr;
    }
    g2.fill();

    if (!isDashAtk) {
      // Neon edge lip + a small specular flash near the tip (additive) — gives the
      // most-seen sprite (the resting cyan/yellow arrow) a crisp lit rim.
      g2.save();
      g2.globalCompositeOperation = 'lighter';
      g2.lineJoin = 'round';
      g2.lineWidth = 1.4;
      g2.strokeStyle = 'rgba(255,255,255,0.7)';
      _drawArrowPath(g2, ox, oy, s);
      g2.stroke();
      g2.beginPath();
      g2.moveTo(ox + s * 0.82, oy);
      g2.lineTo(ox + s * 0.05, oy - s * 0.16);
      g2.lineTo(ox + s * 0.05, oy + s * 0.16);
      g2.closePath();
      g2.fillStyle = 'rgba(255,255,255,0.28)';
      g2.fill();
      g2.restore();
    }

    tm.addCanvas(key, oc);
  };

  /* The Steve pickaxe skin uses real PNG assets (assets/light-again/Diamond_Pickaxe.png
     + Golden_Pickaxe.png), baked into '_la_pickaxe' / '_la_pickaxe_gold' in
     rendering.js (_genTextures) — no procedural pickaxe generator here. */

  LA.buildEnemyTex = function (tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var size = C.RUSHER_SIZE;
    var gs = size * 1.6, pad = 4;
    var W = Math.ceil(gs * 2 + pad * 2);
    var H = Math.ceil(gs * 0.5 + pad * 2);
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    var g2 = oc.getContext('2d');
    var ox = W / 2, oy = H / 2;

    g2.save();
    g2.globalCompositeOperation = 'lighter';
    g2.beginPath();
    g2.moveTo(ox + gs, oy);
    g2.lineTo(ox - gs * 0.5, oy - gs * 0.22);
    g2.lineTo(ox - gs * 0.5, oy + gs * 0.22);
    g2.closePath();
    g2.fillStyle = 'rgba(255,0,68,0.18)';
    g2.fill();
    g2.restore();

    g2.beginPath();
    g2.moveTo(ox + size, oy);
    g2.lineTo(ox - size * 0.5, oy - size * 0.18);
    g2.lineTo(ox - size * 0.5, oy + size * 0.18);
    g2.closePath();
    // Directional volume: dark garnet tail → body red → hot near-white tip, so the
    // charge direction (the tip) reads at a glance instead of a flat triangle.
    var rg = g2.createLinearGradient(ox - size * 0.5, oy, ox + size, oy);
    rg.addColorStop(0,    '#7a0020');
    rg.addColorStop(0.55, '#ff2347');
    rg.addColorStop(1,    '#ffd6dd');
    g2.fillStyle = rg;
    g2.fill();

    // Bright crest along the leading top edge (additive lit rim).
    g2.save();
    g2.globalCompositeOperation = 'lighter';
    g2.lineWidth = 1; g2.lineJoin = 'round';
    g2.strokeStyle = 'rgba(255,150,170,0.65)';
    g2.beginPath();
    g2.moveTo(ox - size * 0.5, oy - size * 0.18);
    g2.lineTo(ox + size, oy);
    g2.stroke();
    g2.restore();

    tm.addCanvas(key, oc);
  };

  LA.buildShooterTex = function (tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var s = C.T2_SIZE, pad = 6;
    var W = Math.ceil(s * 2.4 + pad * 2), H = Math.ceil(s * 2.4 + pad * 2);
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    var g2 = oc.getContext('2d');
    var ox = W / 2, oy = H / 2;

    g2.save();
    g2.globalCompositeOperation = 'lighter';
    g2.shadowColor = 'rgba(255,180,30,0.6)'; g2.shadowBlur = 14;
    g2.beginPath();
    g2.moveTo(ox + s, oy); g2.lineTo(ox, oy - s * 0.7);
    g2.lineTo(ox - s, oy); g2.lineTo(ox, oy + s * 0.7);
    g2.closePath();
    g2.fillStyle = 'rgba(255,160,20,0.25)'; g2.fill();
    g2.shadowBlur = 0; g2.restore();

    g2.beginPath();
    g2.moveTo(ox + s * 0.75, oy); g2.lineTo(ox, oy - s * 0.5);
    g2.lineTo(ox - s * 0.75, oy); g2.lineTo(ox, oy + s * 0.5);
    g2.closePath();
    // Radial "turret lens": white-hot core → orange → dark rim (volume).
    var srg = g2.createRadialGradient(ox, oy, 0, ox, oy, s * 0.8);
    srg.addColorStop(0,    '#fff2cc');
    srg.addColorStop(0.45, '#ffb030');
    srg.addColorStop(1,    '#6a3300');
    g2.fillStyle = srg; g2.fill();

    // Thin bright rim around the lens.
    g2.save(); g2.globalCompositeOperation = 'lighter';
    g2.lineWidth = 1; g2.lineJoin = 'round';
    g2.strokeStyle = 'rgba(255,210,120,0.7)';
    g2.beginPath();
    g2.moveTo(ox + s * 0.75, oy); g2.lineTo(ox, oy - s * 0.5);
    g2.lineTo(ox - s * 0.75, oy); g2.lineTo(ox, oy + s * 0.5);
    g2.closePath(); g2.stroke(); g2.restore();

    tm.addCanvas(key, oc);
  };

  LA.buildProjTex = function (tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var S = 30;
    var oc = document.createElement('canvas');
    oc.width = S; oc.height = S;
    var g2 = oc.getContext('2d');
    var cx = S / 2, cy = S / 2;

    g2.save();
    g2.globalCompositeOperation = 'lighter';
    g2.shadowColor = 'rgba(255,200,30,1)';
    g2.shadowBlur = 14;
    g2.beginPath();
    g2.moveTo(cx,       cy - 13);
    g2.lineTo(cx + 4.5, cy);
    g2.lineTo(cx,       cy + 13);
    g2.lineTo(cx - 4.5, cy);
    g2.closePath();
    g2.fillStyle = 'rgba(255,180,20,0.4)';
    g2.fill();
    g2.shadowBlur = 0;
    g2.restore();

    g2.beginPath();
    g2.moveTo(cx,       cy - 12);
    g2.lineTo(cx + 4,   cy);
    g2.lineTo(cx,       cy + 12);
    g2.lineTo(cx - 4,   cy);
    g2.closePath();
    g2.fillStyle = '#ffaa22';
    g2.fill();

    g2.beginPath();
    g2.moveTo(cx,       cy - 8);
    g2.lineTo(cx + 1.5, cy);
    g2.lineTo(cx,       cy + 8);
    g2.lineTo(cx - 1.5, cy);
    g2.closePath();
    g2.fillStyle = '#ffffff';
    g2.globalAlpha = 0.7;
    g2.fill();
    g2.globalAlpha = 1;

    tm.addCanvas(key, oc);
  };

  /* ====================================================================
     PCB FLOOR — procedural circuit-board tile.

     The layout comes from a SEEDED PRNG: deterministic, so theme switches
     recolour the very same board instead of reshuffling it under the player.
     Every element is drawn at 3×3 wrapped offsets (_wrap9) so geometry that
     crosses a tile edge re-enters on the opposite side — the tile is seamless
     by construction, and full-span power rails chain into infinite lines.
     Rendered twice: a subtle base layer + a brighter glow overlay (the
     '<key>Glow' texture, ADD-blended with an animated alpha at runtime).
     ==================================================================== */

  function _seededRng(seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function _wrap9(g, S, fn) {
    for (var ox = -1; ox <= 1; ox++)
      for (var oy = -1; oy <= 1; oy++) {
        g.save(); g.translate(ox * S, oy * S); fn(g); g.restore();
      }
  }

  function _strokePts(g, pts) {
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
  }

  /* 45°-constrained random walk — authentic PCB routing (straight runs with
     diagonal elbows, never arbitrary angles). */
  var _DIRS8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  function _route(rnd, x, y, di, segs, base) {
    var pts = [{ x: x, y: y }];
    for (var s = 0; s < segs; s++) {
      var d = _DIRS8[((di % 8) + 8) % 8];
      var len = base * (1 + (rnd() * 2.4 | 0));
      x += d[0] * len; y += d[1] * len;
      pts.push({ x: x, y: y });
      di += rnd() < 0.5 ? -1 : 1;
    }
    return pts;
  }

  /* Cheap perpendicular offset of a polyline — exact enough at bus spacing. */
  function _offsetPts(pts, off) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
      var dx = p1.x - p0.x, dy = p1.y - p0.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
      out.push({ x: pts[i].x - dy / L * off, y: pts[i].y + dx / L * off });
    }
    return out;
  }

  /* Board layout shared by the base render and the glow render. */
  function _genBoard(S, rnd) {
    var b = { rails: [], traces: [], thin: [], buses: [], vias: [], chips: [],
              hatches: [], fids: [], labels: [] };
    var i, k, pts, e;

    // Power rails: full-span runs (they tile into infinite lines across the
    // arena) broken by small connector gaps, a drilled via guarding each cut.
    var nH = 2 + (rnd() * 2 | 0);
    for (i = 0; i < nH; i++) {
      var ry = (0.08 + 0.84 * rnd()) * S;
      var gx = rnd() * S, gw = 12 + rnd() * 10;
      b.rails.push({ pts: [{ x: 0, y: ry }, { x: gx - gw / 2, y: ry }] });
      b.rails.push({ pts: [{ x: gx + gw / 2, y: ry }, { x: S, y: ry }] });
      b.vias.push({ x: gx - gw / 2, y: ry, r: 2.0, drill: true });
      b.vias.push({ x: gx + gw / 2, y: ry, r: 2.0, drill: true });
    }
    var nV = 2 + (rnd() * 2 | 0);
    for (i = 0; i < nV; i++) {
      var rx = (0.08 + 0.84 * rnd()) * S;
      var gy = rnd() * S, gh = 12 + rnd() * 10;
      b.rails.push({ pts: [{ x: rx, y: 0 }, { x: rx, y: gy - gh / 2 }] });
      b.rails.push({ pts: [{ x: rx, y: gy + gh / 2 }, { x: rx, y: S }] });
      b.vias.push({ x: rx, y: gy - gh / 2, r: 2.0, drill: true });
      b.vias.push({ x: rx, y: gy + gh / 2, r: 2.0, drill: true });
    }

    // Signal traces (main + hairline), a via terminating each end.
    for (i = 0; i < 16; i++) {
      pts = _route(rnd, rnd() * S, rnd() * S, rnd() * 8 | 0, 3 + (rnd() * 4 | 0), 26);
      b.traces.push({ pts: pts });
      b.vias.push({ x: pts[0].x, y: pts[0].y, r: 1.5 + rnd() * 0.7, drill: rnd() < 0.4 });
      e = pts[pts.length - 1];
      b.vias.push({ x: e.x, y: e.y, r: 1.5 + rnd() * 0.7, drill: rnd() < 0.4 });
    }
    for (i = 0; i < 22; i++) {
      pts = _route(rnd, rnd() * S, rnd() * S, rnd() * 8 | 0, 2 + (rnd() * 4 | 0), 17);
      b.thin.push({ pts: pts });
      if (rnd() < 0.6) b.vias.push({ x: pts[0].x, y: pts[0].y, r: 1.0 + rnd() * 0.5, drill: false });
    }

    // Buses: 3-5 parallel lines snaking together — the signature PCB look —
    // each line ending on its own via (a tidy terminator row).
    for (i = 0; i < 5; i++) {
      var spine = _route(rnd, rnd() * S, rnd() * S, rnd() * 8 | 0, 4 + (rnd() * 3 | 0), 30);
      var lines = 3 + (rnd() * 3 | 0), gap = 4, bus = [];
      for (k = 0; k < lines; k++) {
        var lp = _offsetPts(spine, (k - (lines - 1) / 2) * gap);
        bus.push(lp);
        b.vias.push({ x: lp[0].x, y: lp[0].y, r: 1.1, drill: false });
        b.vias.push({ x: lp[lp.length - 1].x, y: lp[lp.length - 1].y, r: 1.1, drill: false });
      }
      b.buses.push(bus);
    }

    // IC footprints: body + pin stubs on the two long sides + pin-1 dot.
    for (i = 0; i < 6; i++) {
      var horiz = rnd() < 0.5;
      b.chips.push({
        x: rnd() * S, y: rnd() * S, horiz: horiz,
        w: horiz ? 28 + rnd() * 20 : 16 + rnd() * 12,
        h: horiz ? 16 + rnd() * 12 : 28 + rnd() * 20,
      });
    }

    // Scattered test points.
    for (i = 0; i < 14; i++)
      b.vias.push({ x: rnd() * S, y: rnd() * S, r: 1.0 + rnd() * 1.3, drill: rnd() < 0.3 });

    // Ground-pour patches: faint 45° hatching — quiet regional texture.
    for (i = 0; i < 3; i++)
      b.hatches.push({ x: rnd() * S, y: rnd() * S, w: 70 + rnd() * 70, h: 60 + rnd() * 60 });

    // Fiducial markers (circle + crosshair) and silkscreen "labels" (dash rows
    // that read as tiny unreadable part numbers).
    for (i = 0; i < 2; i++) b.fids.push({ x: rnd() * S, y: rnd() * S, r: 3.5 + rnd() * 1.5 });
    for (i = 0; i < 5; i++) {
      var n = 3 + (rnd() * 5 | 0), dashes = [];
      for (k = 0; k < n; k++) dashes.push(2 + rnd() * 4);
      b.labels.push({ x: rnd() * S, y: rnd() * S, dashes: dashes });
    }
    return b;
  }

  LA.buildPCBTex = function (tm, key, colors) {
    if (tm.exists(key)) tm.remove(key);
    var S = C.PCB_TILE;
    var board = _genBoard(S, _seededRng(0x51AC0B7D));   // fixed seed → stable layout

    var tr = (colors.pcbTrace >> 16) & 0xff;
    var tg = (colors.pcbTrace >> 8) & 0xff;
    var tb = colors.pcbTrace & 0xff;
    var traceCol = 'rgba(' + tr + ',' + tg + ',' + tb + ',' + colors.pcbTraceA + ')';
    var vr = (colors.pcbVia >> 16) & 0xff;
    var vg = (colors.pcbVia >> 8) & 0xff;
    var vb = colors.pcbVia & 0xff;
    var viaCol = 'rgba(' + vr + ',' + vg + ',' + vb + ',' + colors.pcbViaA + ')';

    var oc = document.createElement('canvas');
    oc.width = S; oc.height = S;
    var g = oc.getContext('2d');

    _wrap9(g, S, function (g) {
      var i, k, p, v;

      // Ground pour (lowest, faintest)
      g.strokeStyle = traceCol; g.lineWidth = 0.5; g.globalAlpha = 0.30;
      for (i = 0; i < board.hatches.length; i++) {
        var hz = board.hatches[i];
        g.save();
        g.beginPath(); g.rect(hz.x, hz.y, hz.w, hz.h); g.clip();
        g.beginPath();
        for (var d = -hz.h; d < hz.w + hz.h; d += 7) {
          g.moveTo(hz.x + d, hz.y); g.lineTo(hz.x + d + hz.h, hz.y + hz.h);
        }
        g.stroke();
        g.restore();
        g.strokeRect(hz.x, hz.y, hz.w, hz.h);
      }
      g.globalAlpha = 1;

      g.lineCap = 'square'; g.lineJoin = 'round';
      g.strokeStyle = traceCol; g.lineWidth = 1.4;
      for (i = 0; i < board.rails.length; i++) _strokePts(g, board.rails[i].pts);
      g.lineWidth = 0.8;
      for (i = 0; i < board.buses.length; i++)
        for (k = 0; k < board.buses[i].length; k++) _strokePts(g, board.buses[i][k]);
      g.lineWidth = 1.1;
      for (i = 0; i < board.traces.length; i++) _strokePts(g, board.traces[i].pts);
      g.lineWidth = 0.55; g.globalAlpha = 0.8;
      for (i = 0; i < board.thin.length; i++) _strokePts(g, board.thin[i].pts);
      g.globalAlpha = 1;

      // IC footprints
      for (i = 0; i < board.chips.length; i++) {
        var ch = board.chips[i], x0 = ch.x - ch.w / 2, y0 = ch.y - ch.h / 2;
        g.fillStyle = 'rgba(' + tr + ',' + tg + ',' + tb + ',0.05)';
        g.fillRect(x0, y0, ch.w, ch.h);
        g.strokeStyle = traceCol; g.lineWidth = 0.8;
        g.strokeRect(x0, y0, ch.w, ch.h);
        g.lineWidth = 0.5; g.beginPath();
        if (ch.horiz) {
          for (p = x0 + 4; p <= x0 + ch.w - 4; p += 5) {
            g.moveTo(p, y0);         g.lineTo(p, y0 - 3);
            g.moveTo(p, y0 + ch.h);  g.lineTo(p, y0 + ch.h + 3);
          }
        } else {
          for (p = y0 + 4; p <= y0 + ch.h - 4; p += 5) {
            g.moveTo(x0, p);         g.lineTo(x0 - 3, p);
            g.moveTo(x0 + ch.w, p);  g.lineTo(x0 + ch.w + 3, p);
          }
        }
        g.stroke();
        g.fillStyle = viaCol;
        g.beginPath(); g.arc(x0 + 3.5, y0 + 3.5, 1.1, 0, Math.PI * 2); g.fill();
      }

      // Vias, then drill holes punched into the bigger ones
      g.fillStyle = viaCol;
      for (i = 0; i < board.vias.length; i++) {
        v = board.vias[i];
        g.beginPath(); g.arc(v.x, v.y, v.r, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = 'rgba(5,5,16,0.85)';
      for (i = 0; i < board.vias.length; i++) {
        v = board.vias[i];
        if (!v.drill) continue;
        g.beginPath(); g.arc(v.x, v.y, v.r * 0.45, 0, Math.PI * 2); g.fill();
      }

      // Fiducials + silkscreen dashes (quiet storytelling detail)
      g.strokeStyle = viaCol; g.lineWidth = 0.6; g.globalAlpha = 0.7;
      for (i = 0; i < board.fids.length; i++) {
        var f = board.fids[i];
        g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2); g.stroke();
        g.beginPath();
        g.moveTo(f.x - f.r - 2, f.y); g.lineTo(f.x + f.r + 2, f.y);
        g.moveTo(f.x, f.y - f.r - 2); g.lineTo(f.x, f.y + f.r + 2);
        g.stroke();
      }
      g.globalAlpha = 0.5; g.lineWidth = 1.2; g.strokeStyle = traceCol; g.lineCap = 'butt';
      for (i = 0; i < board.labels.length; i++) {
        var lb = board.labels[i], lx = lb.x;
        g.beginPath();
        for (k = 0; k < lb.dashes.length; k++) {
          g.moveTo(lx, lb.y); g.lineTo(lx + lb.dashes[k], lb.y);
          lx += lb.dashes[k] + 2;
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    });

    tm.addCanvas(key, oc);

    /* Glow overlay: same geometry, neon — a soft wide pass under a bright core. */
    var gk = key + 'Glow';
    if (tm.exists(gk)) tm.remove(gk);
    var oc2 = document.createElement('canvas');
    oc2.width = S; oc2.height = S;
    var g2 = oc2.getContext('2d');
    var glowSoft = 'rgba(' + tr + ',' + tg + ',' + tb + ',0.14)';
    var glowCol  = 'rgba(' + tr + ',' + tg + ',' + tb + ',0.38)';
    var glowVia  = 'rgba(' + tr + ',' + tg + ',' + tb + ',0.50)';

    _wrap9(g2, S, function (g) {
      var i, k;
      g.lineCap = 'round'; g.lineJoin = 'round';
      var passes = [{ col: glowSoft, mul: 3.0 }, { col: glowCol, mul: 1.0 }];
      for (var pz = 0; pz < passes.length; pz++) {
        g.strokeStyle = passes[pz].col;
        g.lineWidth = 2.4 * passes[pz].mul;
        for (i = 0; i < board.rails.length; i++) _strokePts(g, board.rails[i].pts);
        g.lineWidth = 2.0 * passes[pz].mul;
        for (i = 0; i < board.traces.length; i++) _strokePts(g, board.traces[i].pts);
        g.lineWidth = 1.3 * passes[pz].mul;
        for (i = 0; i < board.buses.length; i++)
          for (k = 0; k < board.buses[i].length; k++) _strokePts(g, board.buses[i][k]);
      }
      g.fillStyle = glowVia;
      for (i = 0; i < board.vias.length; i++) {
        var v = board.vias[i];
        g.beginPath(); g.arc(v.x, v.y, v.r + 0.8, 0, Math.PI * 2); g.fill();
      }
    });
    tm.addCanvas(gk, oc2);
  };

  /* ====================================================================
     FRACTURED-DIMENSION FLOOR — the alternate tile dimension.js swaps in when
     the portal snaps. Same discreet luminance budget as the PCB, different
     subject: a permanently fissured violet floor — crack webs, "ghost"
     circuits with corrupted (displaced) segments, chromatic glitch slices,
     glyph debris, soft void pools. Fixed rift palette (semantic), so it is
     built once and ignores the site theme.
     ==================================================================== */
  LA.buildPCBDimTex = function (tm, key) {
    if (tm.exists(key) && tm.exists(key + 'Glow')) return;
    if (tm.exists(key)) tm.remove(key);
    var S = C.PCB_TILE;
    var rnd = _seededRng(0x0D14E957);

    var cracks = [], ghosts = [], corrupt = [], slices = [], glyphs = [], pools = [], specks = [];
    var i, k;

    // Crack webs — random walks with the occasional branch (a frozen, miniature
    // echo of the live rifts that tore the arena open during the ramp).
    for (i = 0; i < 9; i++) {
      var pts = [{ x: rnd() * S, y: rnd() * S }], ang = rnd() * Math.PI * 2;
      var segs = 4 + (rnd() * 4 | 0);
      for (k = 0; k < segs; k++) {
        ang += (rnd() - 0.5) * 1.1;
        var L = 26 + rnd() * 52;
        pts.push({ x: pts[k].x + Math.cos(ang) * L, y: pts[k].y + Math.sin(ang) * L });
      }
      cracks.push(pts);
      if (rnd() < 0.7) {
        var bp = pts[1 + (rnd() * (pts.length - 2) | 0)];
        var bAng = ang + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.6);
        var bpts = [{ x: bp.x, y: bp.y }], bs = 2 + (rnd() * 3 | 0);
        for (k = 0; k < bs; k++) {
          bAng += (rnd() - 0.5) * 1.0;
          bpts.push({ x: bpts[k].x + Math.cos(bAng) * (18 + rnd() * 34),
                      y: bpts[k].y + Math.sin(bAng) * (18 + rnd() * 34) });
        }
        cracks.push(bpts);
      }
    }

    // Ghost circuits — the memory of the old world: 45° routes with chunks
    // missing; some pieces knocked sideways and recoloured → corrupted data.
    for (i = 0; i < 12; i++) {
      var route = _route(rnd, rnd() * S, rnd() * S, rnd() * 8 | 0, 3 + (rnd() * 3 | 0), 24);
      for (k = 0; k < route.length - 1; k++) {
        var a = route[k], b = route[k + 1], roll = rnd();
        if (roll < 0.28) continue;                       // missing chunk
        var seg = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
        if (roll < 0.45) {                               // displaced + recoloured
          var dx = b.y - a.y, dy = -(b.x - a.x);
          var L2 = Math.sqrt(dx * dx + dy * dy) || 1;
          var off = (rnd() < 0.5 ? -1 : 1) * (2 + rnd() * 2);
          seg.x1 += dx / L2 * off; seg.y1 += dy / L2 * off;
          seg.x2 += dx / L2 * off; seg.y2 += dy / L2 * off;
          corrupt.push(seg);
        } else ghosts.push(seg);
      }
    }

    for (i = 0; i < 5; i++)
      slices.push({ x: rnd() * S, y: rnd() * S, w: 46 + rnd() * 90, h: 2 + rnd() * 2.5 });
    for (i = 0; i < 18; i++)
      glyphs.push({ x: rnd() * S, y: rnd() * S, s: 2.5 + rnd() * 3, t: rnd() * 3 | 0, a: rnd() * Math.PI * 2 });
    for (i = 0; i < 3; i++)
      pools.push({ x: rnd() * S, y: rnd() * S, r: 60 + rnd() * 60 });
    for (i = 0; i < 24; i++)
      specks.push({ x: rnd() * S, y: rnd() * S, r: 0.5 + rnd() * 0.9 });

    var HALO = '122,45,255', BODY = '226,77,255', CYAN = '0,229,255';

    var oc = document.createElement('canvas');
    oc.width = S; oc.height = S;
    var g = oc.getContext('2d');

    _wrap9(g, S, function (g) {
      var i;
      // Void pools first — soft holes torn into the floor
      for (i = 0; i < pools.length; i++) {
        var pl = pools[i];
        var rg = g.createRadialGradient(pl.x, pl.y, 0, pl.x, pl.y, pl.r);
        rg.addColorStop(0, 'rgba(2,0,8,0.30)');
        rg.addColorStop(1, 'rgba(2,0,8,0)');
        g.fillStyle = rg;
        g.beginPath(); g.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2); g.fill();
      }
      // Ghost circuits (faded indigo) + corrupted pieces (magenta)
      g.lineCap = 'square';
      g.strokeStyle = 'rgba(150,128,210,0.13)'; g.lineWidth = 1.0;
      g.beginPath();
      for (i = 0; i < ghosts.length; i++) { g.moveTo(ghosts[i].x1, ghosts[i].y1); g.lineTo(ghosts[i].x2, ghosts[i].y2); }
      g.stroke();
      g.strokeStyle = 'rgba(' + BODY + ',0.14)';
      g.beginPath();
      for (i = 0; i < corrupt.length; i++) { g.moveTo(corrupt[i].x1, corrupt[i].y1); g.lineTo(corrupt[i].x2, corrupt[i].y2); }
      g.stroke();
      // Crack webs: violet halo → magenta channel → pale core. Alphas are LOW
      // on purpose: the camera bloom + the ADD glow overlay amplify these a
      // lot in-game — anything hotter floods the playfield with pink.
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(' + HALO + ',0.08)'; g.lineWidth = 4.5;
      for (i = 0; i < cracks.length; i++) _strokePts(g, cracks[i]);
      g.strokeStyle = 'rgba(' + BODY + ',0.13)'; g.lineWidth = 1.5;
      for (i = 0; i < cracks.length; i++) _strokePts(g, cracks[i]);
      g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 0.6;
      for (i = 0; i < cracks.length; i++) _strokePts(g, cracks[i]);
      // Chromatic glitch slices (magenta + cyan halves, slightly sheared)
      for (i = 0; i < slices.length; i++) {
        var sl = slices[i];
        g.fillStyle = 'rgba(' + BODY + ',0.10)';
        g.fillRect(sl.x, sl.y, sl.w, sl.h);
        g.fillStyle = 'rgba(' + CYAN + ',0.08)';
        g.fillRect(sl.x + 3, sl.y + sl.h, sl.w * 0.8, sl.h * 0.8);
      }
      // Glyph debris (tiny hollow squares / triangles / crosses)
      g.strokeStyle = 'rgba(' + HALO + ',0.16)'; g.lineWidth = 0.8;
      for (i = 0; i < glyphs.length; i++) {
        var gl = glyphs[i], s = gl.s;
        g.save(); g.translate(gl.x, gl.y); g.rotate(gl.a);
        g.beginPath();
        if (gl.t === 0) g.rect(-s / 2, -s / 2, s, s);
        else if (gl.t === 1) { g.moveTo(0, -s / 2); g.lineTo(s / 2, s / 2); g.lineTo(-s / 2, s / 2); g.closePath(); }
        else { g.moveTo(-s / 2, 0); g.lineTo(s / 2, 0); g.moveTo(0, -s / 2); g.lineTo(0, s / 2); }
        g.stroke();
        g.restore();
      }
      // Pale dust
      g.fillStyle = 'rgba(240,214,255,0.12)';
      for (i = 0; i < specks.length; i++) {
        g.beginPath(); g.arc(specks[i].x, specks[i].y, specks[i].r, 0, Math.PI * 2); g.fill();
      }
    });
    tm.addCanvas(key, oc);

    // Glow overlay — the fissures + corrupted pieces shimmer (driven by the
    // same animated pcbGlow alpha as the normal floor).
    var gk = key + 'Glow';
    if (tm.exists(gk)) tm.remove(gk);
    var oc2 = document.createElement('canvas');
    oc2.width = S; oc2.height = S;
    var g2 = oc2.getContext('2d');
    _wrap9(g2, S, function (g) {
      var i;
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(' + HALO + ',0.08)'; g.lineWidth = 6;
      for (i = 0; i < cracks.length; i++) _strokePts(g, cracks[i]);
      g.strokeStyle = 'rgba(' + BODY + ',0.16)'; g.lineWidth = 2.0;
      for (i = 0; i < cracks.length; i++) _strokePts(g, cracks[i]);
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 0.8;
      for (i = 0; i < cracks.length; i++) _strokePts(g, cracks[i]);
      g.strokeStyle = 'rgba(' + BODY + ',0.20)'; g.lineWidth = 1.2;
      g.beginPath();
      for (i = 0; i < corrupt.length; i++) { g.moveTo(corrupt[i].x1, corrupt[i].y1); g.lineTo(corrupt[i].x2, corrupt[i].y2); }
      g.stroke();
      // Crack endpoints burn a little hotter
      g.fillStyle = 'rgba(255,255,255,0.30)';
      for (i = 0; i < cracks.length; i++) {
        var e = cracks[i][cracks[i].length - 1];
        g.beginPath(); g.arc(e.x, e.y, 1.6, 0, Math.PI * 2); g.fill();
      }
    });
    tm.addCanvas(gk, oc2);
  };

  /* Aurora layer: a few huge ultra-soft colour pools on a transparent tile —
     ADD-blended at very low alpha between the circuit layers, it breaks the
     flat darkness with slowly drifting colour without competing with gameplay.
     `cols` = array of [r,g,b] hues (theme nebulaArr, or the rift palette). */
  LA.buildNebulaTex = function (tm, key, cols) {
    if (tm.exists(key)) tm.remove(key);
    var S = 512;
    var rnd = _seededRng(0x4EBB1A05);
    var blobs = [];
    for (var i = 0; i < 6; i++)
      blobs.push({ x: rnd() * S, y: rnd() * S, r: 120 + rnd() * 130, c: cols[i % cols.length] });
    var oc = document.createElement('canvas');
    oc.width = S; oc.height = S;
    var g = oc.getContext('2d');
    _wrap9(g, S, function (g) {
      for (var k = 0; k < blobs.length; k++) {
        var b = blobs[k], c = b.c;
        var rg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        rg.addColorStop(0,   'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.50)');
        rg.addColorStop(0.5, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.18)');
        rg.addColorStop(1,   'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        g.fillStyle = rg;
        g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
      }
    });
    tm.addCanvas(key, oc);
  };

  LA.buildBruiserTex = function (tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var s = C.T3_SIZE, pad = 10;
    var W = Math.ceil(s * 2.6 + pad * 2), H = Math.ceil(s * 2.6 + pad * 2);
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    var g2 = oc.getContext('2d');
    var ox = W / 2, oy = H / 2, r = s * 1.1;

    g2.save();
    g2.globalCompositeOperation = 'lighter';
    g2.shadowColor = 'rgba(92,0,153,0.7)'; g2.shadowBlur = 16;
    g2.beginPath();
    for (var hi = 0; hi < 6; hi++) {
      var ha = Math.PI / 3 * hi - Math.PI / 6;
      var hx = ox + Math.cos(ha) * r * 1.15;
      var hy = oy + Math.sin(ha) * r * 1.15;
      if (hi === 0) g2.moveTo(hx, hy); else g2.lineTo(hx, hy);
    }
    g2.closePath();
    g2.fillStyle = 'rgba(92,0,153,0.18)';
    g2.fill();
    g2.shadowBlur = 0;
    g2.restore();

    g2.beginPath();
    for (var hi2 = 0; hi2 < 6; hi2++) {
      var ha2 = Math.PI / 3 * hi2 - Math.PI / 6;
      var hx2 = ox + Math.cos(ha2) * r;
      var hy2 = oy + Math.sin(ha2) * r;
      if (hi2 === 0) g2.moveTo(hx2, hy2); else g2.lineTo(hx2, hy2);
    }
    g2.closePath();
    // Radial body gradient (bright violet core → deep magenta-violet rim) for volume.
    var hrg = g2.createRadialGradient(ox, oy, 0, ox, oy, r);
    hrg.addColorStop(0, '#9b30e0');
    hrg.addColorStop(1, '#4a007a');
    g2.fillStyle = hrg;
    g2.fill();

    // Recursive inner hex "nest" rings + a glowing core — reads as a generator/hive
    // (this enemy's whole job is to spawn minions), not a blank polygon.
    g2.save();
    g2.globalCompositeOperation = 'lighter';
    for (var nring = 0; nring < 2; nring++) {
      var rr = r * (0.62 - nring * 0.24);
      g2.beginPath();
      for (var hn = 0; hn < 6; hn++) {
        var na = Math.PI / 3 * hn - Math.PI / 6;
        var nx = ox + Math.cos(na) * rr, ny = oy + Math.sin(na) * rr;
        if (hn === 0) g2.moveTo(nx, ny); else g2.lineTo(nx, ny);
      }
      g2.closePath();
      g2.lineWidth = 1.2;
      g2.strokeStyle = 'rgba(200,110,255,' + (0.5 - nring * 0.16) + ')';
      g2.stroke();
    }
    g2.fillStyle = 'rgba(232,202,255,0.55)';
    g2.beginPath(); g2.arc(ox, oy, r * 0.16, 0, Math.PI * 2); g2.fill();
    g2.restore();

    tm.addCanvas(key, oc);
  };





  /* ---- Grayscale variant (Partial Desaturation & T2 exception) ---- */
  LA.buildGrayscaleVariant = function (tm, srcKey, dstKey) {
    if (tm.exists(dstKey)) tm.remove(dstKey);
    var srcCanvas = tm.get(srcKey).getSourceImage();
    var W = srcCanvas.width, H = srcCanvas.height;
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    var ctx = oc.getContext('2d');
    ctx.drawImage(srcCanvas, 0, 0);
    var imgData = ctx.getImageData(0, 0, W, H);
    var d = imgData.data;

    // Valeurs par défaut (pour les T1, T3, etc.)
    var desat = 0.85; 
    var brightness = 1.0; // Luminosité normale

    // Exception pour le T2 (les losanges jaunes)
    // Remplacer 'enemy_t2' par la vraie clé de ton sprite jaune
    if (srcKey.indexOf('_shooter') !== -1) {
      desat = 0.98;       // Presque 100% gris pour tuer le jaune
      brightness = 0.65;  // On baisse drastiquement la luminosité (-35%)
    }

    for (var i = 0; i < d.length; i += 4) {
      // On calcule la luminance et on y applique le multiplicateur de luminosité
      var lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * brightness;
      
      d[i]     = Math.round(lum * desat + (d[i] * brightness)     * (1 - desat)); // R
      d[i + 1] = Math.round(lum * desat + (d[i + 1] * brightness) * (1 - desat)); // G
      d[i + 2] = Math.round(lum * desat + (d[i + 2] * brightness) * (1 - desat)); // B
    }
    
    ctx.putImageData(imgData, 0, 0);
    tm.addCanvas(dstKey, oc);
  };


  /* ---- The Anomaly: an unstable "amas de pixels" (glitch cluster) ----
     Pure-white blocky blob on transparent ground. Rendered three times at
     jittered offsets with pure R/G/B tints (ADD blend) to fake chromatic
     aberration — the overlap reads white, the fringes bleed red/green/blue
     like a broken CRT. Kept white here so tinting controls the channels. */
  LA.buildAnomalyTex = function (tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var s = C.ANO_SIZE, pad = 8;
    var W = Math.ceil(s * 2 + pad * 2), H = Math.ceil(s * 2 + pad * 2);
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    var g2 = oc.getContext('2d');
    var ox = W / 2, oy = H / 2;

    // Soft halo so it glows even before per-channel ADD passes
    g2.save();
    g2.globalCompositeOperation = 'lighter';
    g2.shadowColor = 'rgba(255,255,255,0.9)';
    g2.shadowBlur = 12;
    g2.fillStyle = 'rgba(255,255,255,0.10)';
    g2.beginPath(); g2.arc(ox, oy, s * 0.7, 0, Math.PI * 2); g2.fill();
    g2.restore();

    // Jagged pixel cluster — a deterministic-ish scatter of square shards so
    // the silhouette is "wrong" / data-moshed rather than a clean polygon.
    g2.fillStyle = '#ffffff';
    var shards = [
      [-0.55, -0.20, 0.42, 0.34], [ 0.16, -0.62, 0.30, 0.46],
      [-0.10, -0.10, 0.55, 0.50], [ 0.30,  0.12, 0.40, 0.38],
      [-0.62,  0.18, 0.34, 0.40], [-0.18,  0.34, 0.46, 0.34],
      [ 0.04,  0.02, 0.30, 0.30], [-0.34, -0.50, 0.26, 0.28],
    ];
    for (var i = 0; i < shards.length; i++) {
      var sx = ox + shards[i][0] * s, sy = oy + shards[i][1] * s;
      g2.fillRect(sx, sy, shards[i][2] * s, shards[i][3] * s);
    }
    // Dense white core
    g2.beginPath(); g2.arc(ox, oy, s * 0.34, 0, Math.PI * 2); g2.fill();

    tm.addCanvas(key, oc);
  };

  /* ---- The Anomaly's own projectile skin — tiny white "glitch byte" --------
     A small cluster of bright pixel shards (white core with chromatic shards on
     the edges). Stays white so it can be tinted per-channel at render time for
     the RGB-flicker effect, matching the body's aesthetic. ------------------- */
  LA.buildAnomalyProjTex = function (tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var S = 18, pad = 2;
    var oc = document.createElement('canvas');
    oc.width = S + pad * 2; oc.height = S + pad * 2;
    var g2 = oc.getContext('2d');
    var cx = oc.width / 2, cy = oc.height / 2;

    g2.save();
    g2.globalCompositeOperation = 'lighter';
    g2.shadowColor = 'rgba(255,255,255,0.9)';
    g2.shadowBlur = 8;
    g2.fillStyle = 'rgba(255,255,255,0.18)';
    g2.beginPath(); g2.arc(cx, cy, 5, 0, Math.PI * 2); g2.fill();
    g2.restore();

    // Asymmetric data-moshed shards around a bright core
    g2.fillStyle = '#ffffff';
    var shards = [
      [-3, -2, 3, 2], [1, -3, 2, 3], [-2, 1, 4, 2], [2, 1, 2, 3], [-1, -1, 3, 3],
    ];
    for (var i = 0; i < shards.length; i++) {
      g2.fillRect(cx + shards[i][0], cy + shards[i][1], shards[i][2], shards[i][3]);
    }
    g2.beginPath(); g2.arc(cx, cy, 2.5, 0, Math.PI * 2); g2.fill();

    tm.addCanvas(key, oc);
  };

  LA.buildPixelTex = function (tm, key) {
    if (tm.exists(key)) return;
    var oc = document.createElement('canvas');
    oc.width = 8; oc.height = 8;
    var g2 = oc.getContext('2d');
    g2.fillStyle = '#ffffff';
    g2.fillRect(0, 0, 8, 8);
    tm.addCanvas(key, oc);
  };

  /* Soft round particle: a radial-gradient disc (bright core → transparent rim).
     Drop-in for the flat '_pxl' square in the ADD-blend emitters, so every burst
     reads as a glowing neon spark instead of a hard pixel. 16px keeps roughly the
     old on-screen footprint (≈ same scale) while adding a soft glowing halo. */
  LA.buildSparkTex = function (tm, key) {
    if (tm.exists(key)) return;
    var S = 16, oc = document.createElement('canvas');
    oc.width = S; oc.height = S;
    var g2 = oc.getContext('2d');
    var cx = S / 2;
    var grad = g2.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grad.addColorStop(0,    'rgba(255,255,255,1)');
    grad.addColorStop(0.30, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.6,  'rgba(255,255,255,0.28)');
    grad.addColorStop(1,    'rgba(255,255,255,0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, S, S);
    tm.addCanvas(key, oc);
  };

  /* ---- The Sniper (T4) body: a static open EYE (almond + iris + pupil) -------
     The live sniper is drawn 100% procedurally (open/close eyelids, charge
     animation) on a per-enemy graphics overlay in sniper.js, so this baked
     sprite is only used for the The-World "condemned" death flash (tinted
     crimson) and the grayscale variant. Baked in cold WHITE/steel so it tints
     cleanly. Wide axis is horizontal; the runtime rotates it ⟂ to the aim. */
  LA.buildSniperTex = function (tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var s = C.T4_SIZE, pad = 10;
    var hw = s * 1.85, ho = s * 1.08;
    var W = Math.ceil(hw * 2 + pad * 2), H = Math.ceil(ho * 2.6 + pad * 2);
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    var g2 = oc.getContext('2d');
    var ox = W / 2, oy = H / 2;

    function almond(eho) {
      g2.beginPath();
      g2.moveTo(ox - hw, oy);
      g2.quadraticCurveTo(ox, oy - eho * 1.5, ox + hw, oy);   // top lid
      g2.quadraticCurveTo(ox, oy + eho * 1.5, ox - hw, oy);   // bottom lid
      g2.closePath();
    }

    // Soft glow halo.
    g2.save();
    g2.globalCompositeOperation = 'lighter';
    g2.shadowColor = 'rgba(210,235,255,0.7)'; g2.shadowBlur = 14;
    almond(ho);
    g2.fillStyle = 'rgba(210,235,255,0.12)'; g2.fill();
    g2.shadowBlur = 0; g2.restore();

    // Sclera (eyeball) — radial cold gradient.
    var grd = g2.createRadialGradient(ox, oy, 2, ox, oy, hw);
    grd.addColorStop(0,    '#f4fbff');
    grd.addColorStop(0.6,  '#cfe3f2');
    grd.addColorStop(1,    '#8aa0b4');
    almond(ho);
    g2.fillStyle = grd; g2.fill();

    // Iris (radial) + rim.
    var ri = ho * 0.82;
    var irg = g2.createRadialGradient(ox, oy, 1, ox, oy, ri);
    irg.addColorStop(0,    '#eaf6ff');
    irg.addColorStop(0.55, '#bfeaff');
    irg.addColorStop(1,    '#6f9bb8');
    g2.beginPath(); g2.arc(ox, oy, ri, 0, Math.PI * 2);
    g2.fillStyle = irg; g2.fill();
    g2.lineWidth = Math.max(1, s * 0.08);
    g2.strokeStyle = 'rgba(120,150,175,0.85)';
    g2.beginPath(); g2.arc(ox, oy, ri, 0, Math.PI * 2); g2.stroke();

    // Pupil + catchlight.
    g2.beginPath(); g2.arc(ox, oy, ri * 0.42, 0, Math.PI * 2);
    g2.fillStyle = 'rgba(16,26,38,0.92)'; g2.fill();
    g2.beginPath(); g2.arc(ox - ri * 0.16, oy - ri * 0.16, ri * 0.12, 0, Math.PI * 2);
    g2.fillStyle = 'rgba(255,255,255,0.9)'; g2.fill();

    // Eyelid outline.
    almond(ho);
    g2.lineWidth = Math.max(2, s * 0.16); g2.lineJoin = 'round';
    g2.strokeStyle = 'rgba(245,251,255,0.95)';
    g2.stroke();

    tm.addCanvas(key, oc);
  };

  /* ---- The Sniper's laser bolt: a fast white-hot beam streak --------------
     Baked horizontal (points +x), white-cyan, tapered at both ends, with an
     additive glow halo. The render layer rotates it to the velocity heading,
     stretches it along its length, and tints it (bright in play, gray during
     The World — so it reads "halted like an enemy", never a parryable bullet). */
  LA.buildLaserTex = function (tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var W = 72, H = 18;
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    var g2 = oc.getContext('2d');
    var cy = H / 2;

    g2.save();
    g2.globalCompositeOperation = 'lighter';

    // Soft cyan glow halo (wide, low alpha).
    g2.shadowColor = 'rgba(143,230,255,0.9)'; g2.shadowBlur = 12;
    var halo = g2.createLinearGradient(0, 0, W, 0);
    halo.addColorStop(0,    'rgba(143,230,255,0)');
    halo.addColorStop(0.5,  'rgba(143,230,255,0.55)');
    halo.addColorStop(1,    'rgba(143,230,255,0)');
    g2.fillStyle = halo;
    g2.fillRect(0, cy - 5, W, 10);
    g2.shadowBlur = 0;

    // Bright body — white-cyan, tapered via the horizontal alpha gradient.
    var body = g2.createLinearGradient(0, 0, W, 0);
    body.addColorStop(0,    'rgba(200,245,255,0)');
    body.addColorStop(0.18, 'rgba(220,250,255,0.85)');
    body.addColorStop(0.5,  'rgba(255,255,255,1)');
    body.addColorStop(0.82, 'rgba(220,250,255,0.85)');
    body.addColorStop(1,    'rgba(200,245,255,0)');
    g2.fillStyle = body;
    g2.fillRect(0, cy - 2.4, W, 4.8);

    // White-hot core line.
    var core = g2.createLinearGradient(0, 0, W, 0);
    core.addColorStop(0,   'rgba(255,255,255,0)');
    core.addColorStop(0.5, 'rgba(255,255,255,1)');
    core.addColorStop(1,   'rgba(255,255,255,0)');
    g2.fillStyle = core;
    g2.fillRect(0, cy - 1, W, 2);

    // Hot leading tip.
    g2.beginPath(); g2.arc(W - 8, cy, 3.2, 0, Math.PI * 2);
    g2.fillStyle = 'rgba(255,255,255,0.95)'; g2.fill();

    g2.restore();
    tm.addCanvas(key, oc);
  };

})();

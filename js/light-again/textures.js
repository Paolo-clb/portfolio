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

  LA.buildPCBTex = function (tm, key, colors) {
    if (tm.exists(key)) tm.remove(key);
    var S = C.PCB_TILE;
    var oc = document.createElement('canvas');
    oc.width = S; oc.height = S;
    var g = oc.getContext('2d');

    var tr = (colors.pcbTrace >> 16) & 0xff;
    var tg = (colors.pcbTrace >> 8) & 0xff;
    var tb = colors.pcbTrace & 0xff;
    var traceCol = 'rgba(' + tr + ',' + tg + ',' + tb + ',' + colors.pcbTraceA + ')';
    var vr = (colors.pcbVia >> 16) & 0xff;
    var vg = (colors.pcbVia >> 8) & 0xff;
    var vb = colors.pcbVia & 0xff;
    var viaCol = 'rgba(' + vr + ',' + vg + ',' + vb + ',' + colors.pcbViaA + ')';

    g.strokeStyle = traceCol; g.lineWidth = 1.0; g.lineCap = 'square';
    g.beginPath();
    g.moveTo(0,S*0.22); g.lineTo(S*0.61,S*0.22);
    g.moveTo(S*0.68,S*0.22); g.lineTo(S,S*0.22);
    g.moveTo(0,S*0.71); g.lineTo(S*0.38,S*0.71);
    g.moveTo(S*0.45,S*0.71); g.lineTo(S,S*0.71);
    g.moveTo(S*0.18,0); g.lineTo(S*0.18,S*0.55);
    g.moveTo(S*0.18,S*0.62); g.lineTo(S*0.18,S);
    g.moveTo(S*0.77,0); g.lineTo(S*0.77,S*0.34);
    g.moveTo(S*0.77,S*0.41); g.lineTo(S*0.77,S);
    g.stroke();

    g.lineWidth = 0.55; g.beginPath();
    g.moveTo(S*0.18,S*0.44); g.lineTo(S*0.52,S*0.44);
    g.moveTo(S*0.52,S*0.55); g.lineTo(S*0.77,S*0.55);
    g.moveTo(0,S*0.88); g.lineTo(S*0.40,S*0.88);
    g.moveTo(S*0.60,S*0.10); g.lineTo(S,S*0.10);
    g.moveTo(S*0.38,S*0.22); g.lineTo(S*0.38,S*0.71);
    g.moveTo(S*0.61,0); g.lineTo(S*0.61,S*0.22);
    g.moveTo(S*0.52,S*0.44); g.lineTo(S*0.52,S*0.55);
    g.moveTo(S*0.88,S*0.71); g.lineTo(S*0.88,S);
    g.moveTo(S*0.18,S*0.55); g.lineTo(S*0.18,S*0.62);
    g.moveTo(S*0.77,S*0.34); g.lineTo(S*0.61,S*0.34);
    g.moveTo(S*0.61,S*0.22); g.lineTo(S*0.61,S*0.34);
    g.moveTo(S*0.38,S*0.71); g.lineTo(S*0.38,S*0.88);
    g.stroke();

    g.lineWidth = 0.6; g.beginPath();
    g.moveTo(S*0.18,S*0.44); g.lineTo(S*0.08,S*0.34);
    g.moveTo(S*0.08,S*0.34); g.lineTo(S*0.08,S*0.22);
    g.moveTo(S*0.38,S*0.44); g.lineTo(S*0.52,S*0.44);
    g.moveTo(S*0.77,S*0.55); g.lineTo(S*0.88,S*0.44);
    g.moveTo(S*0.88,S*0.44); g.lineTo(S*0.88,S*0.22);
    g.moveTo(S*0.40,S*0.88); g.lineTo(S*0.52,S*0.76);
    g.moveTo(S*0.52,S*0.76); g.lineTo(S*0.60,S*0.76);
    g.moveTo(S*0.61,S*0.34); g.lineTo(S*0.68,S*0.27);
    g.moveTo(S*0.68,S*0.27); g.lineTo(S*0.77,S*0.27);
    g.stroke();

    var vias = [
      [0.18,0.22,2.2],[0.38,0.22,1.6],[0.61,0.22,2.0],[0.77,0.22,1.4],
      [0.88,0.22,1.6],[0.08,0.22,1.4],[0.18,0.44,1.8],[0.38,0.44,1.4],
      [0.52,0.44,1.8],[0.18,0.71,2.0],[0.38,0.71,1.6],[0.77,0.55,1.4],
      [0.88,0.71,1.6],[0.38,0.88,1.8],[0.52,0.76,1.4],[0.61,0.34,1.8],
      [0.77,0.27,1.4],[0.88,0.44,1.6],[0.08,0.34,1.2],
    ];
    g.fillStyle = viaCol;
    for (var vi = 0; vi < vias.length; vi++) {
      g.beginPath();
      g.arc(S * vias[vi][0], S * vias[vi][1], vias[vi][2], 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(5,5,16,0.85)';
    var drills = [[0.18,0.22,1.0],[0.61,0.22,0.9],[0.18,0.71,0.9],[0.52,0.44,0.8],[0.38,0.88,0.8]];
    for (var di = 0; di < drills.length; di++) {
      g.beginPath();
      g.arc(S*drills[di][0], S*drills[di][1], drills[di][2], 0, Math.PI*2);
      g.fill();
    }
    g.strokeStyle = traceCol; g.lineWidth = 0.7;
    g.strokeRect(S*0.42,S*0.57,S*0.20,S*0.10);
    var pins = [0.44,0.47,0.50,0.53,0.56];
    g.lineWidth = 0.5;
    for (var pi = 0; pi < pins.length; pi++) {
      g.beginPath();
      g.moveTo(S*pins[pi],S*0.57); g.lineTo(S*pins[pi],S*0.55);
      g.moveTo(S*pins[pi],S*0.67); g.lineTo(S*pins[pi],S*0.69);
      g.stroke();
    }
    g.lineWidth = 0.6; g.strokeStyle = viaCol;
    g.strokeRect(S*0.06,S*0.42,S*0.06,S*0.04);
    g.strokeRect(S*0.70,S*0.58,S*0.04,S*0.06);

    tm.addCanvas(key, oc);

    /* Glow overlay: brighter, thicker traces with neon tint */
    var gk = key + 'Glow';
    if (tm.exists(gk)) tm.remove(gk);
    var oc2 = document.createElement('canvas');
    oc2.width = S; oc2.height = S;
    var g2 = oc2.getContext('2d');

    var cr = (colors.pcbTrace >> 16) & 0xff;
    var cg2 = (colors.pcbTrace >> 8) & 0xff;
    var cb = colors.pcbTrace & 0xff;
    var glowCol = 'rgba(' + cr + ',' + cg2 + ',' + cb + ',0.38)';
    var glowVia = 'rgba(' + cr + ',' + cg2 + ',' + cb + ',0.50)';

    g2.strokeStyle = glowCol; g2.lineWidth = 2.2; g2.lineCap = 'round';
    g2.beginPath();
    g2.moveTo(0,S*0.22); g2.lineTo(S*0.61,S*0.22);
    g2.moveTo(S*0.68,S*0.22); g2.lineTo(S,S*0.22);
    g2.moveTo(0,S*0.71); g2.lineTo(S*0.38,S*0.71);
    g2.moveTo(S*0.45,S*0.71); g2.lineTo(S,S*0.71);
    g2.moveTo(S*0.18,0); g2.lineTo(S*0.18,S*0.55);
    g2.moveTo(S*0.18,S*0.62); g2.lineTo(S*0.18,S);
    g2.moveTo(S*0.77,0); g2.lineTo(S*0.77,S*0.34);
    g2.moveTo(S*0.77,S*0.41); g2.lineTo(S*0.77,S);
    g2.stroke();

    g2.lineWidth = 1.4; g2.beginPath();
    g2.moveTo(S*0.18,S*0.44); g2.lineTo(S*0.52,S*0.44);
    g2.moveTo(S*0.52,S*0.55); g2.lineTo(S*0.77,S*0.55);
    g2.moveTo(0,S*0.88); g2.lineTo(S*0.40,S*0.88);
    g2.moveTo(S*0.60,S*0.10); g2.lineTo(S,S*0.10);
    g2.moveTo(S*0.38,S*0.22); g2.lineTo(S*0.38,S*0.71);
    g2.moveTo(S*0.61,0); g2.lineTo(S*0.61,S*0.22);
    g2.moveTo(S*0.52,S*0.44); g2.lineTo(S*0.52,S*0.55);
    g2.moveTo(S*0.88,S*0.71); g2.lineTo(S*0.88,S);
    g2.moveTo(S*0.18,S*0.55); g2.lineTo(S*0.18,S*0.62);
    g2.moveTo(S*0.77,S*0.34); g2.lineTo(S*0.61,S*0.34);
    g2.moveTo(S*0.61,S*0.22); g2.lineTo(S*0.61,S*0.34);
    g2.moveTo(S*0.38,S*0.71); g2.lineTo(S*0.38,S*0.88);
    g2.stroke();

    g2.fillStyle = glowVia;
    for (var gi = 0; gi < vias.length; gi++) {
      g2.beginPath();
      g2.arc(S * vias[gi][0], S * vias[gi][1], vias[gi][2] + 0.8, 0, Math.PI * 2);
      g2.fill();
    }

    tm.addCanvas(gk, oc2);
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

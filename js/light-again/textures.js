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
      g2.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    g2.fill();

    tm.addCanvas(key, oc);
  };

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
    g2.fillStyle = '#FF0044';
    g2.fill();

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
    g2.fillStyle = '#FFaa22'; g2.fill();

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
    g2.fillStyle = '#6a0dad';
    g2.fill();

    g2.beginPath();
    var ri = r * 0.55;
    for (var hi3 = 0; hi3 < 6; hi3++) {
      var ha3 = Math.PI / 3 * hi3 - Math.PI / 6;
      var hx3 = ox + Math.cos(ha3) * ri;
      var hy3 = oy + Math.sin(ha3) * ri;
      if (hi3 === 0) g2.moveTo(hx3, hy3); else g2.lineTo(hx3, hy3);
    }
    g2.closePath();
    g2.fillStyle = '#ffffff';
    g2.globalAlpha = 0.25;
    g2.fill();
    g2.globalAlpha = 1;

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
    if (srcKey.includes('_shooter')) { 
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


  LA.buildPixelTex = function (tm, key) {
    if (tm.exists(key)) return;
    var oc = document.createElement('canvas');
    oc.width = 8; oc.height = 8;
    var g2 = oc.getContext('2d');
    g2.fillStyle = '#ffffff';
    g2.fillRect(0, 0, 8, 8);
    tm.addCanvas(key, oc);
  };

})();

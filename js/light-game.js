/* ==========================================================================
   Light Again — Phaser 3 (WebGL) Game Engine
   Factory: window.createLightGame(parentEl) -> { start, stop, pause, resume }
   ========================================================================== */

(function () {
  'use strict';

  /* ================================================================
     PALETTE — theme-aware, cached
     ================================================================ */

  var _colorCache = null;
  var _colorTheme = '';

  function getColors() {
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    if (theme === _colorTheme) return _colorCache;
    _colorTheme = theme;
    if (theme === 'dark') _colorCache = {
      cyan:   0x00ffff,  cyanArr:   [0,255,255],
      yellow: 0xffdc3c,  yellowArr: [255,220,60],
      /** Flèche + fantômes de dash (identique au thème nature : bleu, pas violet) */
      dashArrowArr: [60, 120, 200],
      pcbTrace: 0x643cdc, pcbTraceA: 0.22,
      pcbVia:   0x8c50ff, pcbViaA:   0.30,
      bgColor:  0x04040d,
    };
    else if (theme === 'nature') _colorCache = {
      cyan:   0x50ffc8,  cyanArr: [80,255,200],
      yellow: 0xdcf050,  yellowArr: [220,240,80],
      dashArrowArr: [60, 120, 200],
      pcbTrace: 0x1e7850, pcbTraceA: 0.22,
      pcbVia:   0x32b464, pcbViaA:   0.30,
      bgColor:  0x030801,
    };
    else _colorCache = {
      cyan:   0x00ffff,  cyanArr: [0,255,255],
      yellow: 0xffdc3c,  yellowArr: [255,220,60],
      dashArrowArr: [60, 120, 200],
      /* PCB tout en tons orange (palette claire #F2A285) pour un rendu uni */
      pcbTrace: 0xf2a285, pcbTraceA: 0.20,
      pcbVia:   0xf2a285, pcbViaA:   0.28,
      bgColor:  0x08080f,
    };
    return _colorCache;
  }

  /* ================================================================
     CONSTANTS
     ================================================================ */

  var ACCEL       = 0.7;
  var FRICTION    = 0.92;
  var SIZE        = 20;
  var DASH_IMP    = 28;
  var DASH_DUR    = 120;
  var DASH_CD     = 1200;
  var ATK_IMP     = 18;
  var ATK_DUR     = 280;
  var ATK_CD      = 0;
  var ATK_SPIN    = 28;
  var DASH_ATK_IMP  = 30;
  var DASH_ATK_DUR  = 300;
  var DASH_ATK_SPIN = 50;
  var RECOVERY_DUR      = 180;
  var RECOVERY_FRIC     = 0.80;
  var ATK_WHIFF_DUR     = 220;
  var DASHATK_WHIFF_DUR  = 380;
  var DASHATK_WHIFF_FRIC = 0.70;
  var DASHATK_CHAIN_EXT  = 40;
  var DASHATK_MAX_EXT    = 180;
  var HITSTOP_DUR        = 40;
  var HITSTOP_MAX        = 80;
  var DETONATION_HITSTOP = 120;
  var IFRAMES_DUR   = 800;
  var SPAWN_DIST      = 650;
  var MAX_ENEMIES     = 300;
  /** Vague T1 : plus d’unités, montée plus rapide, plateau à plus de kills (min/max restent décalés de +1). */
  var SPAWN_T1_RAMP_KILLS = 950;
  var SPAWN_T1_MIN_BASE   = 4;
  var SPAWN_T1_MIN_SPAN   = 12;
  var SPAWN_T1_MAX_BASE   = 5;
  var SPAWN_T1_MAX_SPAN   = 12;
  /** T2 : pic de proba à ~SPAWN_T2_RAMP_KILLS kills (plus bas = montée plus rapide). */
  var SPAWN_T2_RAMP_KILLS = 450;
  var SPAWN_T2_CHANCE_1   = 0.56;
  var SPAWN_T2_CHANCE_2   = 0.28;
  /** T3 : pas avant START ; pic à START+RAMP kills, toujours > SPAWN_T2_RAMP_KILLS. */
  var SPAWN_T3_START_KILLS = 75;
  var SPAWN_T3_RAMP_KILLS  = 520;
  var SPAWN_T3_CHANCE_1    = 0.36;
  /** 500→1000 kills : facteurs par tier (×1 → max), linéaire entre START et END. */
  var SPAWN_LATE_START_KILLS = 500;
  var SPAWN_LATE_END_KILLS   = 1000;
  var SPAWN_LATE_MULT_T1     = 1.7;
  var SPAWN_LATE_MULT_T2     = 2.0;
  var SPAWN_LATE_MULT_T3     = 1.9;
  /** >1000 kills : chance de doubler la vague (×2 effectifs) ; plafond 50 % à 2000 kills, plus fort si peu d’ennemis. */
  var SPAWN_DOUBLE_KILLS_START = 1000;
  var SPAWN_DOUBLE_KILLS_FULL  = 2000;
  var SPAWN_DOUBLE_PROB_MAX    = 0.5;
  /** Overlay plein jeu : frames avant fade ; relance = plus court que le 1er chargement. */
  var LOADER_WARMUP_FRAMES        = 45;
  var LOADER_RESTART_WARMUP_FRAMES = 24;
  var SEPARATION_RADIUS = 30;
  var SEPARATION_FORCE  = 4.0;
  var REBOUND_IMP       = 14;
  var SHOCKWAVE_RADIUS  = 110;
  var SHOCKWAVE_FORCE   = 14;
  var SHOCKWAVE_STUN    = 300;
  var LANDING_BURST_RADIUS = 180;
  var LANDING_BURST_FORCE  = 28;
  var LANDING_BURST_STUN   = 500;
  var DASH_MARK_RADIUS     = 30;
  var CAM_LERP    = 0.10;
  var WORLD_HALF  = 4000;
  var PCB_TILE    = 256;
  var RUSHER_SPEED = 3.0;
  var RUSHER_SIZE  = 14;

  var T2_SIZE      = 16;
  var T2_SPEED     = 1.8;
  var T2_KEEP_DIST = 280;
  var T2_FIRE_CD   = 4500;
  var T2_CHARGE_DUR = 500;
  var T2_RECOIL    = 6;
  var PROJ_SPEED   = 380;
  var PROJ_RADIUS  = 7;
  var PROJ_LIFE    = 4000;
  var PROJ_REFLECT_MULT = 1.8;
  var DEFLECT_HITSTOP   = 40;
  var DEFLECT_HEAVY_HS  = 80;
  var MAX_PROJECTILES   = 60;

  var T3_SIZE           = 24;
  var T3_SPEED          = 1.2;
  var T3_SPAWN_CD       = 3500;
  var T3_SHIELD_RADIUS  = 42;

  /* ================================================================
     TEXTURE GENERATORS
     ================================================================ */

  function _drawArrowPath(g2, ox, oy, s) {
    g2.beginPath();
    g2.moveTo(ox + s,          oy);
    g2.lineTo(ox - s * 0.6,   oy - s * 0.55);
    g2.lineTo(ox - s * 0.25,  oy);
    g2.lineTo(ox - s * 0.6,   oy + s * 0.55);
    g2.closePath();
  }

  function _buildArrowTex(tm, key, r, g, b, s, blur, isDashAtk) {
    if (tm.exists(key)) tm.remove(key);
    var pad = blur + 4;
    var W = Math.ceil(s * 2.2 + pad * 2);
    var H = Math.ceil(s * 1.2 + pad * 2);
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    var g2 = oc.getContext('2d');
    var ox = W / 2, oy = H / 2;

    if (isDashAtk) {
      g2.save();
      g2.globalCompositeOperation = 'lighter';
      g2.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.7)';
      g2.shadowBlur = 52;
      _drawArrowPath(g2, ox, oy, s);
      g2.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.04)';
      g2.fill();
      g2.shadowBlur = 0;
      g2.restore();
    }

    g2.save();
    g2.globalCompositeOperation = 'lighter';
    g2.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.9)';
    g2.shadowBlur = blur;
    _drawArrowPath(g2, ox, oy, s);
    g2.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.35)';
    g2.fill();
    g2.shadowBlur = 0;
    g2.restore();

    _drawArrowPath(g2, ox, oy, s);
    g2.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    g2.fill();

    tm.addCanvas(key, oc);
  }

  function _buildEnemyTex(tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var size = RUSHER_SIZE;
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
  }

  function _buildShooterTex(tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var s = T2_SIZE, pad = 6;
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
  }

  function _buildProjTex(tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var S = 30;
    var oc = document.createElement('canvas');
    oc.width = S; oc.height = S;
    var g2 = oc.getContext('2d');
    var cx = S / 2, cy = S / 2;

    // Outer glow halo
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

    // Solid diamond body
    g2.beginPath();
    g2.moveTo(cx,       cy - 12);
    g2.lineTo(cx + 4,   cy);
    g2.lineTo(cx,       cy + 12);
    g2.lineTo(cx - 4,   cy);
    g2.closePath();
    g2.fillStyle = '#ffaa22';
    g2.fill();

    // Bright core ridge
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
  }

  function _buildPCBTex(tm, key, colors) {
    if (tm.exists(key)) tm.remove(key);
    var S = PCB_TILE;
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
  }

  function _buildBruiserTex(tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var s = T3_SIZE, pad = 10;
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
  }

  function _buildPixelTex(tm, key) {
    if (tm.exists(key)) return;
    var oc = document.createElement('canvas');
    oc.width = 8; oc.height = 8;
    var g2 = oc.getContext('2d');
    g2.fillStyle = '#ffffff';
    g2.fillRect(0, 0, 8, 8);
    tm.addCanvas(key, oc);
  }

  /* ================================================================
     LOOTLOCKER — Guest session & Leaderboard helpers
     ================================================================ */

  function _escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Game-over strings: resolve even when __siteT only returns the key (missing SITE_I18N row, unknown lang, etc.). */
  function _laGoT(key) {
    var FB_FR = {
      laGoScore: 'Score', laGoBestCombo: 'Meilleur combo', laGoKills: 'Ennemis éliminés',
      laGoRecord: 'Record personnel', laGoReplay: 'Rejouer', laGoEnterHint: 'ou appuie sur Entrée',
      laGoWorldRecord: 'Top 10 mondial', laGoLoading: 'Chargement…', laGoRestarting: 'Relance…', laGoError: 'Hors-ligne',
      laGoSubmit: 'Soumettre', laGoSubmitted: 'Envoyé !', laGoNewRecord: 'Nouveau record !',
      laGoNamePlc: 'Ton pseudo',
    };
    var FB_EN = {
      laGoScore: 'Score', laGoBestCombo: 'Best combo', laGoKills: 'Enemies eliminated',
      laGoRecord: 'Personal best', laGoReplay: 'Play again', laGoEnterHint: 'or press Enter',
      laGoWorldRecord: 'World Top 10', laGoLoading: 'Loading…', laGoRestarting: 'Restarting…', laGoError: 'Offline',
      laGoSubmit: 'Submit', laGoSubmitted: 'Submitted!', laGoNewRecord: 'New record!',
      laGoNamePlc: 'Your name',
    };
    var lang = 'fr';
    try {
      lang = (localStorage.getItem('portfolio_lang') || document.documentElement.getAttribute('lang') || 'fr').toLowerCase().slice(0, 2);
    } catch (e) { /* ignore */ }
    var FB = lang === 'en' ? FB_EN : FB_FR;
    var si = window.SITE_I18N;
    if (si) {
      var row = si[lang] || si.en || si.fr;
      if (row && row[key]) return row[key];
      if (si.fr && si.fr[key]) return si.fr[key];
    }
    if (typeof window.__siteT === 'function') {
      var r = window.__siteT(key);
      if (r && r !== key) return r;
    }
    return FB[key] || key;
  }

  function _injectLaRestartLoader(host) {
    if (!host || document.getElementById('_la-restart-loading')) return;
    var bgCol = getColors().bgColor;
    var bgCss = '#' + ('000000' + bgCol.toString(16)).slice(-6);
    var label = _escHtml(_laGoT('laGoRestarting'));
    var lo = document.createElement('div');
    lo.id = '_la-restart-loading';
    lo.setAttribute('role', 'status');
    lo.setAttribute('aria-live', 'polite');
    lo.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:82',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:' + bgCss,
      'pointer-events:none',
    ].join(';');
    lo.innerHTML =
      '<style>@keyframes _la-rs-spin{to{transform:rotate(360deg)}}@keyframes _la-rs-pulse{0%,100%{opacity:.42}50%{opacity:.95}}</style>' +
      '<div style="display:flex;flex-direction:column;align-items:center;gap:.55rem">' +
        '<div style="width:26px;height:26px;border:2px solid rgba(0,255,255,0.1);border-top-color:rgba(0,255,255,0.72);border-radius:50%;animation:_la-rs-spin .55s linear infinite"></div>' +
        '<span style="font-family:monospace;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(0,255,255,0.4);animation:_la-rs-pulse .95s ease-in-out infinite">' + label + '</span>' +
      '</div>';
    host.style.position = 'relative';
    host.appendChild(lo);
  }

  var LL_API      = 'https://api.lootlocker.io';
  var LL_GAME_KEY = 'dev_9c2377a4f943498fb6c581ffa111a7e4';
  var LL_LB_KEY   = 'global_high_scores';
  var _llToken    = null;
  var _llPlayerId = null;
  var _llPlayerIdentifier = null;

  function _llInit(cb) {
    var stored = localStorage.getItem('ll_player_id');
    var body = { game_key: LL_GAME_KEY, game_version: '1.0.0' };
    if (stored) body.player_identifier = stored;

    fetch(LL_API + '/game/v2/session/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.success) {
        _llToken = d.session_token;
        _llPlayerId = d.player_id;
        _llPlayerIdentifier = d.player_identifier;
        localStorage.setItem('ll_player_id', d.player_identifier);
      }
      if (cb) cb(d.success ? null : 'login_failed');
    })
    .catch(function () { if (cb) cb('network'); });
  }

  function _llGetTop(count, cb) {
    if (!_llToken) { cb('no_session', null); return; }
    var bust = '&_=' + Date.now();
    fetch(LL_API + '/game/leaderboards/' + LL_LB_KEY + '/list?count=' + count + bust, {
      headers: { 'x-session-token': _llToken, 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) { cb('http', null); return; }
      cb(null, (res.d && res.d.items) ? res.d.items : []);
    })
    .catch(function () { cb('network', null); });
  }

  function _llSetName(name, cb) {
    if (!_llToken) { cb('no_session'); return; }
    fetch(LL_API + '/game/player/name', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-session-token': _llToken },
      body: JSON.stringify({ name: name }),
    })
    .then(function (r) { return r.json(); })
    .then(function () { cb(null); })
    .catch(function () { cb('network'); });
  }

  function _llSubmitScore(score, cb) {
    if (!_llToken) { cb('no_session'); return; }
    var scoreInt = Math.round(Number(score));
    fetch(LL_API + '/game/leaderboards/' + LL_LB_KEY + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': _llToken },
      body: JSON.stringify({ member_id: String(_llPlayerId), score: scoreInt }),
    })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      var d = res.d;
      if (!res.ok || (d && d.success === false)) {
        var msg = (d && (d.message || d.error || (d.messages && d.messages[0]) || d.text)) || 'submit_failed';
        cb(msg, d);
        return;
      }
      cb(null, d);
    })
    .catch(function () { cb('network', null); });
  }

  /** Meilleur score déjà présent sur le classement API pour ce guest, ou null. */
  function _llGetMyBestSubmittedWorldScore(playerId, apiItems) {
    var pid = String(playerId);
    var best = null;
    var i, sc;
    for (i = 0; i < (apiItems || []).length; i++) {
      if (String(apiItems[i].member_id) !== pid) continue;
      sc = Number(apiItems[i].score);
      if (best === null || sc > best) best = sc;
    }
    return best;
  }

  function _llCountScoresStrictlyAbove(apiItems, playerScore) {
    var n = 0;
    for (var i = 0; i < (apiItems || []).length; i++) {
      if (Number(apiItems[i].score) > playerScore) n++;
    }
    return n;
  }

  /* ================================================================
     PHASER SCENE
     ================================================================ */

  var GameScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function GameScene() {
      Phaser.Scene.call(this, { key: 'GameScene' });
    },

    create: function () {
      var self = this;
      this._texTheme = '';
      this._genTextures();
      var restartPending = typeof window !== 'undefined' && window.__laRestartPending;
      if (restartPending) window.__laRestartPending = false;
      this._warmupTargetFrames = restartPending ? LOADER_RESTART_WARMUP_FRAMES : LOADER_WARMUP_FRAMES;
      this._loaderOverlayId = restartPending ? '_la-restart-loading' : '_la-loading';
      if (restartPending && this.game && this.game.canvas && this.game.canvas.parentElement) {
        _injectLaRestartLoader(this.game.canvas.parentElement);
      }
      // Loader froid (_la-loading) est injecté dans start() ; relance : _la-restart-loading (voir ci-dessus).
      this._loaderRemoved = false;
      this._warmupFrames  = 0;

      // LootLocker guest session (fire-and-forget, non-blocking)
      if (!_llToken) _llInit(null);

      var cam = this.cameras.main;
      this.pcbTile = this.add.tileSprite(0, 0, cam.width, cam.height, '_pcb');
      this.pcbTile.setOrigin(0, 0);
      this.pcbTile.setScrollFactor(0);
      this.pcbTile.setDepth(-10);

      this.p = {
        x: 0, y: 0, vx: 0, vy: 0,
        angle: 0, spinAngle: 0,
        state: 'MOVING',
        dashAvailable: true, dashCooldown: 0, dashTimer: 0,
        dashDx: 0, dashDy: 0, dashHitCount: 0,
        atkAvailable: true, atkCooldown: 0, atkTimer: 0,
        atkDx: 0, atkDy: 0,
        recoveryTimer: 0, recoveryWhiff: false,
        hasHitDuringDashAttack: false, dashAtkExtended: 0,
        hp: 1, invincible: false, invincTimer: 0, dashInvinc: false,
      };

      // Shield orbs — start with 1
      this.playerShields = 1;
      this.MAX_SHIELDS   = 3;
      /** Décale les labels « +1 SHIELD » s’il y en a plusieurs la même frame (nuke). */
      this._shieldFloatStack = 0;
      this._shieldAngle  = 0;
      this._shieldOrbs   = [];
      var SHIELD_ORBS_N  = 3;
      for (var oi = 0; oi < SHIELD_ORBS_N; oi++) {
        var og = this.add.graphics();
        og.setDepth(35);
        og.setBlendMode(Phaser.BlendModes.ADD);
        og.setVisible(false);
        this._shieldOrbs.push(og);
      }

      this.playerSpr = this.add.image(0, 0, '_ar_cyan');
      this.playerSpr.setBlendMode(Phaser.BlendModes.ADD);
      this.playerSpr.setDepth(30);

      this.TRAIL_CAP = 6;
      this.TRAIL_DIST_SQ = 9;
      this._trail = [];
      for (var ti = 0; ti < this.TRAIL_CAP; ti++) {
        var tSpr = this.add.image(0, 0, '_ar_cyan');
        tSpr.setBlendMode(Phaser.BlendModes.ADD);
        tSpr.setDepth(25);
        tSpr.setVisible(false);
        this._trail.push({ spr: tSpr, x: 0, y: 0, angle: 0, ok: false });
      }
      this._trW = 0; this._trN = 0; this._trLX = 0; this._trLY = 0;

      this.MAX_GHOSTS = 48;
      this._ghosts = [];
      for (var gi = 0; gi < this.MAX_GHOSTS; gi++) {
        var gSpr = this.add.image(0, 0, '_ar_cyan');
        gSpr.setDepth(10);
        gSpr.setVisible(false);
        this._ghosts.push({ spr: gSpr, active: false, alpha: 0 });
      }
      this._ghostW = 0;

      this.enemies = [];
      this.ENEMY_TRAIL_N = 4;
      this.spawnTimer = 0;
      this.nextSpawnDelay = 3500;

      _buildPixelTex(this.textures, '_pxl');

      // Emitter principal pour les explosions ennemies (overkill WebGL)
      this._emitter = this.add.particles(0, 0, '_pxl', {
        speed: { min: 60, max: 520 },
        lifespan: { min: 250, max: 800 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1.0, end: 0 },
        gravityY: 0,
        drag: 320,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      });
      this._emitter.setDepth(40);

      // Second emitter — éclats secondaires plus doux
      this._emitter2 = this.add.particles(0, 0, '_pxl', {
        speed: { min: 20, max: 180 },
        lifespan: { min: 400, max: 1000 },
        scale: { start: 0.4, end: 0 },
        alpha: { start: 0.7, end: 0 },
        drag: 180,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      });
      this._emitter2.setDepth(39);

      // Pool global de sprites pour les traînes de projectiles
      // Reflété = ~2× plus de segments que normal (traîne plus longue au renvoi)
      var PROJ_TRAIL_PER = 12;
      this._PROJ_TRAIL_PER = PROJ_TRAIL_PER;
      this._projTrailPool = [];
      for (var pti = 0; pti < MAX_PROJECTILES * PROJ_TRAIL_PER; pti++) {
        var pts = this.add.image(0, 0, '_proj');
        pts.setBlendMode(Phaser.BlendModes.ADD);
        pts.setDepth(21);
        pts.setVisible(false);
        this._projTrailPool.push({ spr: pts, x: 0, y: 0, alpha: 0, active: false });
      }
      this._projTrailPoolW = 0;

      // Projectile pool (manual, no Arcade Physics group needed for manual collision)
      this.projectiles = [];

      // Pool de cercles pour l'onde de choc de fin de dash
      this._waveRings = [];
      for (var wi = 0; wi < 4; wi++) {
        var wg = this.add.graphics();
        wg.setDepth(35);
        wg.setVisible(false);
        this._waveRings.push({ gfx: wg, x: 0, y: 0, r: 0, alpha: 0, active: false });
      }
      this._waveRingW = 0;

      // Pool de faisceaux d'invocation pour la Ruche
      this._hiveBeams = [];
      for (var hbi = 0; hbi < 12; hbi++) {
        var hbg = this.add.graphics();
        hbg.setDepth(24);
        hbg.setVisible(false);
        this._hiveBeams.push({ gfx: hbg, x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, active: false });
      }
      this._hiveBeamW = 0;

      // World-space border: glow wall at the arena edge
      var WH = WORLD_HALF;
      var bGfx = this.add.graphics();
      bGfx.setDepth(-5);
      // Soft inner glow (wide transparent band)
      bGfx.lineStyle(28, 0x00ffff, 0.06);
      bGfx.strokeRect(-WH, -WH, WH * 2, WH * 2);
      bGfx.lineStyle(16, 0x00ffff, 0.12);
      bGfx.strokeRect(-WH, -WH, WH * 2, WH * 2);
      // Crisp visible border line
      bGfx.lineStyle(3, 0x00ffff, 0.70);
      bGfx.strokeRect(-WH, -WH, WH * 2, WH * 2);
      // Corner accent squares
      var cS = 18;
      var corners = [[-WH, -WH], [WH - cS, -WH], [-WH, WH - cS], [WH - cS, WH - cS]];
      bGfx.lineStyle(2, 0x00ffff, 0.90);
      for (var ci = 0; ci < corners.length; ci++) {
        bGfx.strokeRect(corners[ci][0], corners[ci][1], cS, cS);
      }

      this.hudGfx = this.add.graphics();
      this.hudGfx.setScrollFactor(0);
      this.hudGfx.setDepth(100);

      this.fpsTxt = this.add.text(10, 10, '', {
        fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#00ff88',
      });
      this.fpsTxt.setScrollFactor(0);
      this.fpsTxt.setDepth(101);

      this.hitstopTimer = 0;
      this.timeScale = 1.0;
      this.gameTime = 0;

      // Score & Combo
      this.score = 0;
      this.totalKills = 0;
      this.bestCombo = 1;
      this.comboMultiplier = 1;
      this.comboTimer = 0;
      this._comboPulse = 0;
      this._batchScore = 0;
      this._batchLabel = '';
      this._batchActive = false;

      this._scoreTxt = this.add.text(cam.width / 2, 16, '0', {
        fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: '#00ffff',
        stroke: '#003344', strokeThickness: 3,
      });
      this._scoreTxt.setScrollFactor(0);
      this._scoreTxt.setOrigin(0.5, 0);
      this._scoreTxt.setDepth(102);
      this._scoreTxt.setBlendMode(Phaser.BlendModes.ADD);
      this._scoreTxt.setAlpha(0.95);

      this._comboTxt = this.add.text(cam.width / 2, 48, '', {
        fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#ffcc00',
        stroke: '#332200', strokeThickness: 2,
      });
      this._comboTxt.setScrollFactor(0);
      this._comboTxt.setOrigin(0.5, 0);
      this._comboTxt.setDepth(102);
      this._comboTxt.setBlendMode(Phaser.BlendModes.ADD);
      this._comboTxt.setAlpha(0);

      // Combo FX: x10+ trail emitter (reuse _pxl)
      this._comboTrailEmitter = this.add.particles(0, 0, '_pxl', {
        speed: { min: 20, max: 80 },
        lifespan: { min: 200, max: 500 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.9, end: 0 },
        drag: 60,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      });
      this._comboTrailEmitter.setDepth(28);
      this._comboTrailEmitter.setParticleTint(0x00ffff);
      this._comboTrailActive = false;

      // Combo FX: x50+ aura graphics
      this._comboAuraGfx = this.add.graphics();
      this._comboAuraGfx.setDepth(29);
      this._comboAuraGfx.setVisible(false);
      this._comboAuraRot = 0;
      this._comboAuraActive = false;

      // Combo FX: x50+ spark emitter
      this._comboSparkEmitter = this.add.particles(0, 0, '_pxl', {
        speed: { min: 100, max: 320 },
        lifespan: { min: 100, max: 300 },
        scale: { start: 0.65, end: 0 },
        alpha: { start: 1.0, end: 0 },
        drag: 180,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      });
      this._comboSparkEmitter.setDepth(31);
      this._comboSparkEmitter.setParticleTint(0x00ffff);
      this._comboSparkActive = false;

      this._chromaFX = null;

      cam.setBackgroundColor(getColors().bgColor);

      // Bloom PostFX — néons qui bavent sans aveugler
      if (cam.postFX) {
        this._bloomFX = cam.postFX.addBloom(0xffffff, 1, 1, 0.6, 1.4, 4);
      }

      this._keys = {};
      this.input.keyboard.on('keydown', function (ev) {
        self._keys[ev.code] = true;
        if ((ev.code === 'Space' || ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') && !ev.repeat) {
          ev.preventDefault();
          self._tryDash();
        }
        if (ev.code === 'KeyI' && !ev.repeat) {
          ev.preventDefault();
          self._debugSpawnTestTier(1, 20);
        }
        if (ev.code === 'KeyO' && !ev.repeat) {
          ev.preventDefault();
          self._debugSpawnTestTier(2, 10);
        }
        if (ev.code === 'KeyP' && !ev.repeat) {
          ev.preventDefault();
          self._debugSpawnTestTier(3, 5);
        }
      });
      this.input.keyboard.on('keyup', function (ev) {
        self._keys[ev.code] = false;
      });

      this._mouseX = cam.width / 2;
      this._mouseY = cam.height / 2;
      this.input.on('pointermove', function (ptr) {
        self._mouseX = ptr.x; self._mouseY = ptr.y;
      });
      this.input.on('pointerdown', function (ptr) {
        if (ptr.leftButtonDown())  self._tryAttack();
        if (ptr.rightButtonDown()) self._tryDash();
      });

      this.game.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

      // Expose attack-ready flag for the cursor-halo hover poll in main.js
      window.__lightGameAtkReady = function () {
        var p = self.p;
        if (!p) return false;
        if (p.state === 'DEAD') return false;
        if (p.invincible && !p.dashInvinc) return false; // hit i-frames (flicker) → not ready
        if (p.state === 'ATTACKING' || p.state === 'DASH_ATTACKING') return false;
        if (p.state === 'RECOVERY') return false;
        return true;
      };
      // Clean up on scene shutdown (restart / close)
      this.events.once('shutdown', function () {
        window.__lightGameAtkReady = null;
      });
    },

    _genTextures: function () {
      var c = getColors();
      var tm = this.textures;
      this._texTheme = document.documentElement.getAttribute('data-theme') || 'light';

      var ca = c.cyanArr;
      _buildArrowTex(tm, '_ar_cyan',  ca[0], ca[1], ca[2], SIZE, 18, false);
      var ya = c.yellowArr;
      _buildArrowTex(tm, '_ar_yel',   ya[0], ya[1], ya[2], SIZE, 18, false);
      _buildArrowTex(tm, '_ar_atk',   255, 30, 60,  SIZE, 18, false);
      _buildArrowTex(tm, '_ar_datk',  255, 20, 200, SIZE * 1.35, 28, true);
      var da = c.dashArrowArr;
      _buildArrowTex(tm, '_ar_dash',  da[0], da[1], da[2], SIZE, 18, false);
      _buildArrowTex(tm, '_ar_whiff', 80,  80,  90, SIZE, 4, false);

      _buildEnemyTex(tm, '_enemy');
      _buildShooterTex(tm, '_shooter');
      _buildBruiserTex(tm, '_bruiser');
      _buildProjTex(tm, '_proj');
      _buildPCBTex(tm, '_pcb', c);
    },

    _checkTheme: function () {
      var cur = document.documentElement.getAttribute('data-theme') || 'light';
      if (cur === this._texTheme) return;
      _colorTheme = '';
      this._genTextures();
      this.cameras.main.setBackgroundColor(getColors().bgColor);
      if (this.pcbTile) this.pcbTile.setTexture('_pcb');
      for (var i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        var texK = e.tier === 3 ? '_bruiser' : e.tier === 2 ? '_shooter' : '_enemy';
        e.spr.setTexture(texK);
        for (var j = 0; j < e.trSpr.length; j++) e.trSpr[j].setTexture(texK);
      }
    },

    _pTexKey: function () {
      var p = this.p;
      if (p.state === 'DASH_ATTACKING') return '_ar_datk';
      if (p.state === 'ATTACKING')      return '_ar_atk';
      if (p.state === 'DASHING')        return '_ar_dash';
      if (p.state === 'RECOVERY' && p.recoveryWhiff) return '_ar_whiff';
      return p.dashAvailable ? '_ar_cyan' : '_ar_yel';
    },

    _inputVec: function () {
      var dx = 0, dy = 0, k = this._keys;
      if (k['ArrowUp']    || k['KeyW'] || k['KeyZ']) dy -= 1;
      if (k['ArrowDown']  || k['KeyS'])              dy += 1;
      if (k['ArrowLeft']  || k['KeyA'] || k['KeyQ']) dx -= 1;
      if (k['ArrowRight'] || k['KeyD'])               dx += 1;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) { dx /= len; dy /= len; }
      return { dx: dx, dy: dy };
    },

    _tryDash: function () {
      var p = this.p;
      if (!p.dashAvailable || p.state !== 'MOVING') return;
      var inp = this._inputVec();
      var dx = inp.dx, dy = inp.dy;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        dx = Math.cos(p.angle); dy = Math.sin(p.angle);
      }
      p.vx += dx * DASH_IMP;
      p.vy += dy * DASH_IMP;
      p.state = 'DASHING';
      p.dashAvailable = false;
      p.dashTimer = DASH_DUR;
      p.dashCooldown = 0;
      p.dashDx = dx; p.dashDy = dy;
      p.dashHitCount = 0;
    },

    _tryAttack: function () {
      var p = this.p;
      if (p.state === 'ATTACKING' || p.state === 'DASH_ATTACKING') return;
      if (p.state === 'RECOVERY') return;
      if (p.state === 'DASHING') { this._triggerDashAtk(); return; }

      var cam = this.cameras.main;
      var wmx = this._mouseX + cam.scrollX;
      var wmy = this._mouseY + cam.scrollY;
      var adx = wmx - p.x, ady = wmy - p.y;
      var al = Math.sqrt(adx * adx + ady * ady);
      if (al < 1) { adx = Math.cos(p.angle); ady = Math.sin(p.angle); }
      else { adx /= al; ady /= al; }

      // Auto-aim: prioritise closest marked enemy in attack range, then follow mouse
      var atkRange = SIZE * 0.6 + RUSHER_SIZE + ATK_DUR * 0.02 * ATK_IMP;
      var bestMarkD = atkRange, bestMark = null;
      for (var ne = 0; ne < this.enemies.length; ne++) {
        var en = this.enemies[ne];
        if (!en.isMarked) continue;
        var ndx = en.x - p.x, ndy = en.y - p.y;
        var nd = Math.sqrt(ndx * ndx + ndy * ndy);
        if (nd < bestMarkD) { bestMarkD = nd; bestMark = en; }
      }
      if (bestMark) {
        var mAdx = bestMark.x - p.x, mAdy = bestMark.y - p.y;
        var mAl = Math.sqrt(mAdx * mAdx + mAdy * mAdy);
        if (mAl > 0.1) { adx = mAdx / mAl; ady = mAdy / mAl; }
      }

      p.vx += adx * ATK_IMP; p.vy += ady * ATK_IMP;
      p.state = 'ATTACKING'; p.atkAvailable = false;
      p.atkTimer = ATK_DUR; p.atkCooldown = 0;
      p.atkDx = adx; p.atkDy = ady; p.spinAngle = 0;
    },

    _triggerDashAtk: function () {
      var p = this.p;
      var cam = this.cameras.main;
      var wmx = this._mouseX + cam.scrollX;
      var wmy = this._mouseY + cam.scrollY;
      var adx = wmx - p.x, ady = wmy - p.y;
      var al = Math.sqrt(adx * adx + ady * ady);
      if (al < 1) { adx = Math.cos(p.angle); ady = Math.sin(p.angle); }
      else { adx /= al; ady /= al; }

      p.vx = adx * DASH_ATK_IMP; p.vy = ady * DASH_ATK_IMP;
      p.state = 'DASH_ATTACKING'; p.atkAvailable = false;
      p.atkTimer = DASH_ATK_DUR; p.atkCooldown = 0;
      p.atkDx = adx; p.atkDy = ady; p.spinAngle = 0;
      p.hasHitDuringDashAttack = false; p.dashAtkExtended = 0;
      p.dashTimer = 0; p.dashCooldown = DASH_CD;
    },

    _spawnRusher: function () {
      if (this.enemies.length >= MAX_ENEMIES) return;
      var ang = Math.random() * Math.PI * 2;
      this._spawnRusherAt(
        this.p.x + Math.cos(ang) * SPAWN_DIST,
        this.p.y + Math.sin(ang) * SPAWN_DIST
      );
    },

    _spawnWave: function () {
      var t1Progress = Math.min(this.totalKills / SPAWN_T1_RAMP_KILLS, 1.0);
      var minT1 = Math.floor(SPAWN_T1_MIN_BASE + t1Progress * SPAWN_T1_MIN_SPAN);
      var maxT1 = Math.floor(SPAWN_T1_MAX_BASE + t1Progress * SPAWN_T1_MAX_SPAN);
      if (maxT1 < minT1) maxT1 = minT1;
      var t1Count = Phaser.Math.Between(minT1, maxT1);

      var t2Progress = Math.min(this.totalKills / SPAWN_T2_RAMP_KILLS, 1.0);
      var chance1T2 = t2Progress * SPAWN_T2_CHANCE_1;
      var chance2T2 = t2Progress * SPAWN_T2_CHANCE_2;

      var t3Eff = Math.max(0, this.totalKills - SPAWN_T3_START_KILLS);
      var t3Progress = Math.min(t3Eff / SPAWN_T3_RAMP_KILLS, 1.0);
      var chance1T3 = t3Progress * SPAWN_T3_CHANCE_1;

      var spawnQueue = [];
      for (var i = 0; i < t1Count; i++) spawnQueue.push(1);

      var rollT2 = Math.random();
      if (rollT2 < chance2T2) {
        spawnQueue.push(2, 2);
      } else if (rollT2 < chance2T2 + chance1T2) {
        spawnQueue.push(2);
      }

      if (Math.random() < chance1T3) spawnQueue.push(3);

      var kills = this.totalKills;
      var lateP = 0;
      if (kills > SPAWN_LATE_START_KILLS) {
        lateP = Math.min(
          (kills - SPAWN_LATE_START_KILLS) / (SPAWN_LATE_END_KILLS - SPAWN_LATE_START_KILLS),
          1
        );
      }
      var lm1 = 1 + lateP * (SPAWN_LATE_MULT_T1 - 1);
      var lm2 = 1 + lateP * (SPAWN_LATE_MULT_T2 - 1);
      var lm3 = 1 + lateP * (SPAWN_LATE_MULT_T3 - 1);
      var cnt1 = 0;
      var cnt2 = 0;
      var cnt3 = 0;
      for (var si = 0; si < spawnQueue.length; si++) {
        if (spawnQueue[si] === 1) cnt1++;
        else if (spawnQueue[si] === 2) cnt2++;
        else if (spawnQueue[si] === 3) cnt3++;
      }
      var n1 = Math.max(1, Math.round(cnt1 * lm1));
      var n2 = Math.max(0, Math.round(cnt2 * lm2));
      var n3 = Math.max(0, Math.round(cnt3 * lm3));
      spawnQueue = [];
      for (var qi = 0; qi < n1; qi++) spawnQueue.push(1);
      for (var qj = 0; qj < n2; qj++) spawnQueue.push(2);
      for (var qk = 0; qk < n3; qk++) spawnQueue.push(3);

      var tk2 = this.totalKills;
      if (tk2 > SPAWN_DOUBLE_KILLS_START && spawnQueue.length > 0) {
        var dProg = Math.min(
          (tk2 - SPAWN_DOUBLE_KILLS_START) / (SPAWN_DOUBLE_KILLS_FULL - SPAWN_DOUBLE_KILLS_START),
          1
        );
        var pMax = dProg * SPAWN_DOUBLE_PROB_MAX;
        var emptyF = (MAX_ENEMIES - this.enemies.length) / MAX_ENEMIES;
        if (pMax > 0 && emptyF > 0 && Math.random() < pMax * emptyF) {
          spawnQueue = spawnQueue.concat(spawnQueue.slice());
        }
      }

      var slots = MAX_ENEMIES - this.enemies.length;
      if (slots <= 0) return;
      var finalCount = Math.min(spawnQueue.length, slots);

      var baseAng = Math.random() * Math.PI * 2;
      var spread = (finalCount > 1) ? (Math.PI * 0.9) : 0;
      for (var j = 0; j < finalCount; j++) {
        var t = finalCount > 1 ? j / (finalCount - 1) : 0.5;
        var ang = baseAng + (t - 0.5) * spread + (Math.random() - 0.5) * 0.3;
        var dist = SPAWN_DIST + Math.random() * 120;
        var sx = this.p.x + Math.cos(ang) * dist;
        var sy = this.p.y + Math.sin(ang) * dist;

        var tier = spawnQueue[j];
        if (tier === 3) this._spawnBruiserAt(sx, sy);
        else if (tier === 2) this._spawnShooterAt(sx, sy);
        else this._spawnRusherAt(sx, sy);
      }
    },

    /** Test dev : I=20×T1, O=10×T2, P=5×T3 (même arc que les vagues). */
    _debugSpawnTestTier: function (tier, want) {
      if (!this.p || this.p.state === 'DEAD') return;
      var slots = MAX_ENEMIES - this.enemies.length;
      var n = Math.min(want, slots);
      if (n <= 0) return;
      var baseAng = Math.random() * Math.PI * 2;
      var spread = n > 1 ? Math.PI * 0.9 : 0;
      for (var j = 0; j < n; j++) {
        var t = n > 1 ? j / (n - 1) : 0.5;
        var ang = baseAng + (t - 0.5) * spread + (Math.random() - 0.5) * 0.3;
        var dist = SPAWN_DIST + Math.random() * 120;
        var sx = this.p.x + Math.cos(ang) * dist;
        var sy = this.p.y + Math.sin(ang) * dist;
        if (tier === 3) this._spawnBruiserAt(sx, sy);
        else if (tier === 2) this._spawnShooterAt(sx, sy);
        else this._spawnRusherAt(sx, sy);
      }
    },

    _spawnRusherAt: function (ex, ey) {
      var spr = this.add.image(ex, ey, '_enemy');
      spr.setBlendMode(Phaser.BlendModes.ADD);
      spr.setDepth(20);

      var trSpr = [], trData = [];
      for (var t = 0; t < this.ENEMY_TRAIL_N; t++) {
        var ts = this.add.image(ex, ey, '_enemy');
        ts.setBlendMode(Phaser.BlendModes.ADD);
        ts.setDepth(15); ts.setVisible(false);
        trSpr.push(ts);
        trData.push({ x: ex, y: ey, angle: 0 });
      }

      this.enemies.push({
        spr: spr, x: ex, y: ey, vx: 0, vy: 0,
        angle: 0, hp: 1, size: RUSHER_SIZE,
        speed: RUSHER_SPEED + Math.random() * 0.8,
        stunTimer: 0, isMarked: false, markTimer: 0,
        trail: trData, trSpr: trSpr, _tw: 0, _tn: 0,
        tier: 1, fireCD: 0, chargeTimer: 0, isCharging: false,
      });
    },

    _spawnShooterAt: function (ex, ey) {
      var spr = this.add.image(ex, ey, '_shooter');
      spr.setBlendMode(Phaser.BlendModes.ADD);
      spr.setDepth(20);

      var trSpr = [], trData = [];
      for (var t = 0; t < this.ENEMY_TRAIL_N; t++) {
        var ts = this.add.image(ex, ey, '_shooter');
        ts.setBlendMode(Phaser.BlendModes.ADD);
        ts.setDepth(15); ts.setVisible(false);
        trSpr.push(ts);
        trData.push({ x: ex, y: ey, angle: 0 });
      }

      this.enemies.push({
        spr: spr, x: ex, y: ey, vx: 0, vy: 0,
        angle: 0, hp: 1, size: T2_SIZE,
        speed: T2_SPEED + Math.random() * 0.4,
        stunTimer: 0, isMarked: false, markTimer: 0,
        trail: trData, trSpr: trSpr, _tw: 0, _tn: 0,
        tier: 2, fireCD: T2_FIRE_CD * (0.8 + Math.random() * 0.4),
        chargeTimer: 0, isCharging: false, fireFlashTimer: 0,
      });
    },

    _spawnBruiserAt: function (ex, ey) {
      var spr = this.add.image(ex, ey, '_bruiser');
      spr.setBlendMode(Phaser.BlendModes.ADD);
      spr.setDepth(20);

      var trSpr = [], trData = [];
      for (var t = 0; t < this.ENEMY_TRAIL_N; t++) {
        var ts = this.add.image(ex, ey, '_bruiser');
        ts.setBlendMode(Phaser.BlendModes.ADD);
        ts.setDepth(15); ts.setVisible(false);
        trSpr.push(ts);
        trData.push({ x: ex, y: ey, angle: 0 });
      }

      var shieldGfx = this.add.graphics();
      shieldGfx.setDepth(23);

      this.enemies.push({
        spr: spr, x: ex, y: ey, vx: 0, vy: 0,
        angle: 0, hp: 2, size: T3_SIZE,
        speed: T3_SPEED + Math.random() * 0.3,
        stunTimer: 0, isMarked: false, markTimer: 0,
        trail: trData, trSpr: trSpr, _tw: 0, _tn: 0,
        tier: 3, fireCD: 0, chargeTimer: 0, isCharging: false, fireFlashTimer: 0,
        hasShield: true,
        shieldGfx: shieldGfx,
        shieldRot: 0,
        spawnCD: T3_SPAWN_CD * (0.7 + Math.random() * 0.6),
        spawnCycle: 0,
        targetWaypoint: { x: ex, y: ey },
        waypointTimer: 0,
      });
    },

    _spawnProjectile: function (ex, ey, angle, spd, shooter) {
      if (this.projectiles.length >= MAX_PROJECTILES) return;
      var spr = this.add.image(ex, ey, '_proj');
      spr.setBlendMode(Phaser.BlendModes.ADD);
      spr.setDepth(22);
      this.projectiles.push({
        spr: spr, x: ex, y: ey,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        life: PROJ_LIFE, isReflected: false, smashed: false,
        shooterRef: shooter || null,
        rotSpeed: 8,
        trailSlots: [],
      });
    },

    _destroyProjectile: function (pr) {
      for (var si = 0; si < pr.trailSlots.length; si++) {
        pr.trailSlots[si].active = false;
        pr.trailSlots[si].spr.setVisible(false);
      }
      pr.trailSlots.length = 0;
      pr.spr.destroy();
    },

    _addGhost: function (x, y, alpha, angle, isDashAtk) {
      var g = this._ghosts[this._ghostW];
      g.active = true; g.alpha = alpha;
      g.spr.setPosition(x, y);
      g.spr.setRotation(angle);
      g.spr.setAlpha(alpha * 0.6);
      g.spr.setTexture(isDashAtk ? '_ar_datk' : '_ar_dash');
      g.spr.setVisible(true);
      this._ghostW = (this._ghostW + 1) % this.MAX_GHOSTS;
    },

    _decayGhosts: function (dt) {
      for (var i = 0; i < this.MAX_GHOSTS; i++) {
        var g = this._ghosts[i];
        if (!g.active) continue;
        g.alpha -= dt * 3.5;
        if (g.alpha <= 0) { g.active = false; g.spr.setVisible(false); }
        else g.spr.setAlpha(g.alpha * 0.6);
      }
    },

    _explode: function (x, y, color, n) {
      var tint = Phaser.Display.Color.GetColor(color[0], color[1], color[2]);
      this._emitter.setPosition(x, y);
      this._emitter.setParticleTint(tint);
      this._emitter.explode(n || 25);
      this._emitter2.setPosition(x, y);
      this._emitter2.setParticleTint(tint);
      this._emitter2.explode(Math.round((n || 25) * 0.5));
    },

    // ctx: { batch: bool, reflected: bool }
    _killEnemy: function (idx, ctx) {
      var e = this.enemies[idx];
      var ex = e.x, ey = e.y;
      var killTier = e.tier;
      ctx = ctx || {};

      // Scoring
      this.totalKills++;
      var basePts = e.tier === 3 ? 100 : e.tier === 2 ? 30 : 10;
      var pts = basePts * this.comboMultiplier;
      if (ctx.reflected) pts *= 2;
      this.score += pts;
      this.comboTimer = 2000;
      var prevCm = this.comboMultiplier;
      this.comboMultiplier++;
      var newCm = this.comboMultiplier;
      if (newCm > this.bestCombo) this.bestCombo = newCm;
      this._comboPulse = 1.0;

      // Shield acquisition aux paliers 10 et 50 (plusieurs paliers possibles si combo bondit d’un coup)
      var shieldMilestones = [10, 50];
      for (var sm = 0; sm < shieldMilestones.length; sm++) {
        var ms = shieldMilestones[sm];
        if (prevCm < ms && newCm >= ms && this.playerShields < this.MAX_SHIELDS) {
          this.playerShields++;
          var shLabel = 'Combo X' + ms + ' : +1 SHIELD';
          var stk = this._shieldFloatStack++;
          this._floatLabel(this.p.x, this.p.y - 30 - stk * 28, shLabel, '#00ffff', stk);
          this.cameras.main.flash(180, 0, 220, 255);
        }
      }

      if (ctx.batch) {
        this._batchScore += pts;
      } else {
        this._floatScore(ex, ey, pts, killTier);
      }

      // Explosion overkill
      var cnt = Math.round(30 + (e.size / RUSHER_SIZE) * 20);
      cnt = Math.min(cnt, 50);
      this._explode(ex, ey, [255, 30, 60], cnt);
      this._explode(ex, ey, [255, 160, 80], Math.round(cnt * 0.5));
      this._explode(ex, ey, [255, 255, 220], Math.round(cnt * 0.25));

      e.spr.destroy();
      for (var t = 0; t < e.trSpr.length; t++) e.trSpr[t].destroy();
      if (e.shieldGfx) { e.shieldGfx.destroy(); e.shieldGfx = null; }
      this.enemies.splice(idx, 1);

      this._triggerHitstop(HITSTOP_DUR);
      this.cameras.main.shake(60, 0.005);

      for (var k = 0; k < this.enemies.length; k++) {
        var o = this.enemies[k];
        if (o.tier === 3) continue;
        var sdx = o.x - ex, sdy = o.y - ey;
        var sd = Math.sqrt(sdx * sdx + sdy * sdy);
        if (sd < SHOCKWAVE_RADIUS) {
          var f = 1.0 - sd / SHOCKWAVE_RADIUS;
          var nx = sd > 0.1 ? sdx / sd : Math.random() - 0.5;
          var ny = sd > 0.1 ? sdy / sd : Math.random() - 0.5;
          o.vx += nx * SHOCKWAVE_FORCE * f;
          o.vy += ny * SHOCKWAVE_FORCE * f;
          o.stunTimer = SHOCKWAVE_STUN * f;
        }
      }
    },

    _breakShield: function (e) {
      if (!e.hasShield) return;
      e.hasShield = false;
      this._explode(e.x, e.y, [0, 255, 255], 20);
      this._explode(e.x, e.y, [255, 255, 255], 10);
      this.cameras.main.shake(60, 0.006);
      this._triggerHitstop(HITSTOP_DUR);
    },

    _triggerDetonation: function (markedIdx) {
      var p = this.p;
      var e = this.enemies[markedIdx];
      var ex = e.x, ey = e.y;
      var detRadius = SHOCKWAVE_RADIUS * 2.5;

      this._beginBatch('NUKE');
      this._killEnemy(markedIdx, { batch: true });

      for (var i = this.enemies.length - 1; i >= 0; i--) {
        var o = this.enemies[i];
        var odx = o.x - ex, ody = o.y - ey;
        var od = Math.sqrt(odx * odx + ody * ody);
        if (od < detRadius) {
          this._explode(o.x, o.y, [0, 255, 255], 10);
          if (o.tier === 3 && o.hasShield) {
            this._breakShield(o);
          } else if (o.tier === 3) {
            o.hp -= 2;
            if (o.hp <= 0) this._killEnemy(i, { batch: true });
          } else {
            this._killEnemy(i, { batch: true });
          }
        }
      }
      this._endBatch();

      for (var pi = this.projectiles.length - 1; pi >= 0; pi--) {
        var pr = this.projectiles[pi];
        var pdx = pr.x - ex, pdy = pr.y - ey;
        if (Math.sqrt(pdx * pdx + pdy * pdy) < detRadius) {
          this._explode(pr.x, pr.y, [0, 255, 255], 5);
          this._destroyProjectile(pr);
          this.projectiles.splice(pi, 1);
        }
      }

      this.cameras.main.flash(200, 0, 255, 255, false);
      this.cameras.main.shake(200, 0.018);
      this._triggerHitstop(DETONATION_HITSTOP);
      this._spawnWaveRing(ex, ey);

      this._explode(ex, ey, [0, 255, 255], 50);
      this._explode(ex, ey, [255, 255, 255], 30);
    },

    _triggerLandingBurst: function () {
      var p = this.p;

      for (var i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        if (e.tier !== 1) continue;
        var dx = e.x - p.x, dy = e.y - p.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < LANDING_BURST_RADIUS && d > 0.1) {
          var f = 1.0 - d / LANDING_BURST_RADIUS;
          // Reduced force so nearby enemies stay attackable
          e.vx += (dx / d) * LANDING_BURST_FORCE * 0.25 * (0.5 + f * 0.5);
          e.vy += (dy / d) * LANDING_BURST_FORCE * 0.25 * (0.5 + f * 0.5);
          e.stunTimer = Math.max(e.stunTimer, LANDING_BURST_STUN * f * 0.5);
        }
      }

      // Subtle visual ring (smaller, faster fade)
      var ring = this._waveRings[this._waveRingW % this._waveRings.length];
      this._waveRingW++;
      ring.x = p.x; ring.y = p.y;
      ring.r = 10; ring.alpha = 0.45; ring.active = true;
      ring.gfx.setVisible(true);

      // Dash-attack i-frames: cyan look
      p.invincible = true; p.invincTimer = 250; p.dashInvinc = true;
    },

    _spawnWaveRing: function (x, y) {
      var ring = this._waveRings[this._waveRingW % this._waveRings.length];
      this._waveRingW++;
      ring.x = x; ring.y = y;
      ring.r = 10; ring.alpha = 0.9; ring.active = true;
      ring.gfx.setVisible(true);
    },

    _hiveSpawnBeam: function (x1, y1, x2, y2) {
      var b = this._hiveBeams[this._hiveBeamW % this._hiveBeams.length];
      this._hiveBeamW++;
      b.x1 = x1; b.y1 = y1; b.x2 = x2; b.y2 = y2;
      b.alpha = 1.0; b.active = true;
      b.gfx.setVisible(true);
    },

    _updateHiveBeams: function (dt) {
      for (var i = 0; i < this._hiveBeams.length; i++) {
        var b = this._hiveBeams[i];
        if (!b.active) continue;
        b.alpha -= dt * 2.2;
        if (b.alpha <= 0) {
          b.active = false;
          b.gfx.clear();
          b.gfx.setVisible(false);
          continue;
        }
        b.gfx.clear();
        // Thick glow core
        b.gfx.lineStyle(6, 0xbb00ff, b.alpha * 0.55);
        b.gfx.beginPath();
        b.gfx.moveTo(b.x1, b.y1);
        b.gfx.lineTo(b.x2, b.y2);
        b.gfx.strokePath();
        // Bright inner line
        b.gfx.lineStyle(2.5, 0xdd66ff, b.alpha * 0.95);
        b.gfx.beginPath();
        b.gfx.moveTo(b.x1, b.y1);
        b.gfx.lineTo(b.x2, b.y2);
        b.gfx.strokePath();
        // White hot center
        b.gfx.lineStyle(1, 0xffffff, b.alpha * 0.7);
        b.gfx.beginPath();
        b.gfx.moveTo(b.x1, b.y1);
        b.gfx.lineTo(b.x2, b.y2);
        b.gfx.strokePath();
      }
    },

    _triggerHitstop: function (durMs) {
      // Ne s'additionne pas — prend le max, plafonné à HITSTOP_MAX
      var cap = (durMs >= DETONATION_HITSTOP) ? DETONATION_HITSTOP : HITSTOP_MAX;
      this.hitstopTimer = Math.min(Math.max(this.hitstopTimer, durMs), cap);
      this.timeScale = 0;
    },

    // Generic floating label (shield acquire / game-over annotation)
    // stackIdx : décale légèrement l’anim si plusieurs labels (évite superposition visuelle)
    _floatLabel: function (wx, wy, label, col, stackIdx) {
      var cam = this.cameras.main;
      var stagger = (stackIdx || 0) * 45;
      var txt = this.add.text(wx - cam.scrollX, wy - cam.scrollY, label, {
        fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: col,
        stroke: '#000000', strokeThickness: 2,
        shadow: { offsetX: 0, offsetY: 2, color: col, blur: 8, fill: true },
      });
      txt.setOrigin(0.5, 1); txt.setDepth(70 + (stackIdx || 0)); txt.setScrollFactor(0);
      this.tweens.add({
        targets: txt, y: txt.y - 30, duration: 600, ease: 'Linear', delay: stagger,
      });
      this.tweens.add({
        targets: txt, alpha: 0, duration: 400, ease: 'Cubic.easeIn', delay: 400 + stagger,
        onComplete: function () { txt.destroy(); },
      });
    },

    // Centralised player damage handler
    _damagePlayer: function (nx, ny) {
      var p = this.p;
      if (p.invincible) return;

      if (this.playerShields > 0) {
        // Consume one shield
        this.playerShields--;
        this._breakCombo();
        // Orb-burst particles at shield orb position (approximated at player)
        this._explode(p.x, p.y, [0, 255, 255], 18);
        this._explode(p.x, p.y, [255, 255, 255], 12);
        this.cameras.main.shake(200, 0.022);
        this._triggerHitstop(90);
        // Standard I-frames with flicker
        p.invincible = true; p.invincTimer = IFRAMES_DUR; p.dashInvinc = false;
        // Knockback
        if (nx !== 0 || ny !== 0) { p.vx += nx * 8; p.vy += ny * 8; }
      } else {
        // No shields — instant death
        this._triggerGameOver();
      }
    },

    _triggerGameOver: function () {
      var p = this.p;
      if (p.state === 'DEAD') return; // guard against multiple calls in same frame
      p.state = 'DEAD';
      p.invincible = true; p.invincTimer = 99999;
      // Freeze all gameplay time immediately
      this.timeScale = 0;
      this.hitstopTimer = 0;
      // Explosion at player
      this._explode(p.x, p.y, [255, 60, 0], 60);
      this._explode(p.x, p.y, [255, 220, 50], 30);
      this._explode(p.x, p.y, [255, 255, 255], 20);
      // Moderate shake + flash
      this.cameras.main.shake(280, 0.016);
      this.cameras.main.flash(300, 255, 60, 0);
      // Hide player sprite and orbs
      this.playerSpr.setVisible(false);
      for (var ti = 0; ti < this.TRAIL_CAP; ti++) this._trail[ti].spr.setVisible(false);
      for (var oi = 0; oi < this._shieldOrbs.length; oi++) this._shieldOrbs[oi].setVisible(false);
      // Stop enemy spawning
      this.spawnTimer = -999999;
      // Show Game Over popup after short delay (camera effects still run via real time)
      var self = this;
      this.time.delayedCall(900, function () {
        self._showGameOverScreen();
      });
    },

    _showGameOverScreen: function () {
      if (document.getElementById('_la-go-overlay')) return;

      var canvas    = this.game.canvas;
      var container = canvas.parentElement;
      var playerScore = this.score;
      var bestCombo   = Math.max(this.bestCombo || 1, this.comboMultiplier);
      var totalKills  = this.totalKills || 0;
      var sceneRef    = this;

      // ----- Local record -----
      var prevRecord = parseInt(localStorage.getItem('lightGameHighScore'), 10) || 0;
      var isNewRecord = playerScore > prevRecord;
      if (isNewRecord) localStorage.setItem('lightGameHighScore', playerScore);
      var localBest = Math.max(playerScore, prevRecord);

      // ----- i18n (robust: never show raw keys + values run together on missing SITE_I18N) -----
      var t = _laGoT;

      // ----- Inject keyframes -----
      if (!document.getElementById('_la-go-styles')) {
        var st = document.createElement('style');
        st.id = '_la-go-styles';
        st.textContent =
          '@keyframes la-go-fade-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}' +
          '@keyframes la-go-glow{0%,100%{box-shadow:0 0 0 0 rgba(0,255,255,0.2)}50%{box-shadow:0 0 22px 4px rgba(0,255,255,0.12)}}' +
          '@keyframes la-go-spin{to{transform:rotate(360deg)}}';
        document.head.appendChild(st);
      }

      // ----- CSS helpers -----
      var sLbl = 'font-size:.55rem;letter-spacing:.1em;color:#7799bb;text-transform:uppercase;display:block;margin-bottom:.15rem';
      var sVal = function (c) { return 'font-size:1.2rem;font-weight:700;color:' + c + ';text-shadow:0 0 8px ' + c + '44'; };
      var sSection = 'font-size:.55rem;letter-spacing:.12em;color:#5577aa;text-transform:uppercase;margin:1rem 0 .4rem;text-align:left';

      // ----- Build overlay -----
      var overlay = document.createElement('div');
      overlay.id  = '_la-go-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:monospace';

      var panel = document.createElement('div');
      panel.style.cssText = [
        'pointer-events:auto', 'text-align:center',
        'padding:1.3rem 1.8rem 1rem', 'border:1px solid rgba(0,255,255,0.28)', 'border-radius:14px',
        'background:rgba(4,5,18,0.72)', 'max-width:420px', 'width:92%', 'color:#e0e0ff',
        'max-height:85vh', 'overflow-y:auto',
        'animation:la-go-fade-in 0.4s cubic-bezier(0.22,1,0.36,1) both,la-go-glow 2.4s ease infinite',
      ].join(';');

      // Row 1: Score / Best Combo / Kills
      var statCol = 'display:flex;flex-direction:column;align-items:center;gap:.12rem;min-width:0';
      var row1 =
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem .6rem;margin-bottom:.5rem">' +
          '<div style="' + statCol + '"><span style="' + sLbl + '">' + t('laGoScore') + '</span><span style="' + sVal('#00ffff') + '">' + playerScore + '</span></div>' +
          '<div style="' + statCol + '"><span style="' + sLbl + '">' + t('laGoBestCombo') + '</span><span style="' + sVal('#ffcc00') + '">x' + bestCombo + '</span></div>' +
          '<div style="' + statCol + '"><span style="' + sLbl + '">' + t('laGoKills') + '</span><span style="' + sVal('#ff6644') + '">' + totalKills + '</span></div>' +
        '</div>';

      // Row 2: Personal Record
      var recColor = isNewRecord ? '#00ff88' : '#aabbcc';
      var recExtra = isNewRecord ? '  <span style="font-size:.6rem;color:#00ff88;margin-left:.4rem">' + t('laGoNewRecord') + '</span>' : '';
      var row2 =
        '<div style="margin-bottom:.6rem;display:flex;flex-direction:column;align-items:center;gap:.12rem">' +
          '<span style="' + sLbl + '">' + t('laGoRecord') + '</span>' +
          '<span style="' + sVal(recColor) + '">' + localBest + '</span>' + recExtra +
        '</div>';

      // Replay button
      var btnHtml =
        '<button id="_la-go-replay" style="' +
          'padding:.55rem 1.8rem;border:1.5px solid rgba(0,255,255,0.5);border-radius:8px;' +
          'background:rgba(0,255,255,0.08);color:#00ffff;font-family:monospace;font-size:.88rem;' +
          'font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;' +
          'transition:background .2s,box-shadow .2s;display:block;margin:0 auto .4rem' +
        '">' + t('laGoReplay') + '</button>' +
        '<div style="font-size:.55rem;color:#556688;letter-spacing:.06em;margin-bottom:.6rem">' + t('laGoEnterHint') + '</div>';

      // Leaderboard placeholder (outer = relative pour overlay post-submit)
      var lbSpinRow =
        '<div style="width:18px;height:18px;border:2px solid rgba(0,255,255,0.15);border-top-color:rgba(0,255,255,0.7);border-radius:50%;animation:la-go-spin .7s linear infinite"></div>' +
        '<span style="margin-left:.5rem;font-size:.65rem;color:#6688aa">' + t('laGoLoading') + '</span>';
      var lbHtml =
        '<div style="' + sSection + '">' + t('laGoWorldRecord') + '</div>' +
        '<div id="_la-go-lb" style="position:relative;min-height:60px">' +
          '<div id="_la-go-lb-body" style="min-height:60px;display:flex;align-items:center;justify-content:center">' +
            lbSpinRow +
          '</div>' +
        '</div>';

      panel.innerHTML = row1 + row2 + btnHtml + lbHtml;
      overlay.appendChild(panel);

      // ----- Wire replay button -----
      var btn = panel.querySelector('#_la-go-replay');
      btn.addEventListener('mouseenter', function () { btn.style.background = 'rgba(0,255,255,0.16)'; btn.style.boxShadow = '0 0 16px rgba(0,255,255,0.22)'; });
      btn.addEventListener('mouseleave', function () { btn.style.background = 'rgba(0,255,255,0.08)'; btn.style.boxShadow = ''; });

      function clearGameOverHostFlag() {
        try { delete container.dataset.laGameover; } catch (e) { /* ignore */ }
      }
      function doReplay() {
        clearGameOverHostFlag();
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        try { window.__laRestartPending = true; } catch (e) { /* ignore */ }
        sceneRef.scene.resume();
        sceneRef.scene.restart();
      }
      function onKey(e) {
        if (e.key !== 'Enter') return;
        var ae = document.activeElement;
        if (ae && ae.id === '_la-go-name') return;
        e.preventDefault();
        doReplay();
      }
      btn.addEventListener('click', doReplay);
      document.addEventListener('keydown', onKey);
      this.events.once('shutdown', function () {
        document.removeEventListener('keydown', onKey);
        clearGameOverHostFlag();
        var el = document.getElementById('_la-go-overlay');
        if (el) el.remove();
      });

      container.style.position = 'relative';
      container.dataset.laGameover = '1';
      container.appendChild(overlay);

      // Pause scene
      var self2 = this;
      this.time.delayedCall(50, function () { self2.scene.pause(); });

      // ----- Leaderboard fetch -----
      var lbEl = panel.querySelector('#_la-go-lb');
      /** Dernier top affiché (restauration si le poll post-submit échoue). */
      var lastRenderedLbItems = null;

      function getLbBody() {
        return lbEl.querySelector('#_la-go-lb-body') || lbEl;
      }

      function removeLbOverlay() {
        var sh = lbEl.querySelector('#_la-go-lb-shade');
        if (sh) sh.remove();
        var body = getLbBody();
        if (body !== lbEl) {
          body.style.opacity = '';
          body.style.pointerEvents = '';
          body.style.transition = '';
        }
      }

      function setLbBodyHtml(inner) {
        removeLbOverlay();
        var body = getLbBody();
        body.innerHTML = inner;
      }

      /** Chargement initial (pas de tableau) : spinner seul. Après submit : tableau visible + overlay. */
      function renderLeaderboardLoading() {
        lbEl.style.display = 'block';
        var body = getLbBody();
        var spinWrap = '<div style="min-height:60px;display:flex;align-items:center;justify-content:center">' + lbSpinRow + '</div>';
        if (body.querySelector('table')) {
          body.style.transition = 'opacity .22s ease';
          body.style.opacity = '0.48';
          body.style.pointerEvents = 'none';
          var shade = lbEl.querySelector('#_la-go-lb-shade');
          if (!shade) {
            shade = document.createElement('div');
            shade.id = '_la-go-lb-shade';
            shade.style.cssText =
              'position:absolute;left:0;top:0;right:0;bottom:0;z-index:2;display:flex;' +
              'align-items:center;justify-content:center;background:rgba(4,12,24,0.35);' +
              'backdrop-filter:blur(1px);-webkit-backdrop-filter:blur(1px)';
            shade.innerHTML = spinWrap;
            lbEl.appendChild(shade);
          } else {
            shade.innerHTML = spinWrap;
            shade.style.display = 'flex';
          }
        } else {
          removeLbOverlay();
          body.style.display = 'flex';
          body.style.alignItems = 'center';
          body.style.justifyContent = 'center';
          body.innerHTML = spinWrap;
        }
      }

      function renderLeaderboard(items) {
        items = items || [];
        lastRenderedLbItems = items.slice();
        removeLbOverlay();
        var body = getLbBody();
        body.style.display = 'block';
        body.style.width = '100%';
        var html = '<table style="width:100%;border-collapse:collapse;font-size:.68rem">';
        html += '<tr style="color:#5577aa;text-transform:uppercase;letter-spacing:.08em"><td style="text-align:left;padding:.2rem .3rem">#</td><td style="text-align:left;padding:.2rem .3rem">Player</td><td style="text-align:right;padding:.2rem .3rem">Score</td></tr>';
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          var name = (it.player && it.player.name) ? it.player.name : ('Player ' + it.member_id);
          var isMe = String(it.member_id) === String(_llPlayerId);
          var rowCol = isMe ? 'color:#00ffff;font-weight:700' : 'color:#ccddef';
          var bg = i % 2 === 0 ? 'background:rgba(0,255,255,0.03)' : '';
          var rankDisp = it.rank;
          html += '<tr style="' + bg + ';' + rowCol + '">';
          html += '<td style="text-align:left;padding:.22rem .3rem;color:#5577aa;font-weight:700">' + rankDisp + '</td>';
          html += '<td style="text-align:left;padding:.22rem .3rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">' + _escHtml(name) + '</td>';
          html += '<td style="text-align:right;padding:.22rem .3rem;font-weight:700">' + it.score + '</td>';
          html += '</tr>';
        }
        html += '</table>';
        lbEl.style.display = 'block';
        body.innerHTML = html;
      }

      /**
       * Après submit, la liste LootLocker peut rester un instant sur l’ancien score (CDN / propagation).
       * Re-fetch avec délais ; en dernier recours, corrige la ligne locale du joueur pour l’affichage.
       */
      function pollLeaderboardAfterSubmit(expectedScore, submittedName, triesLeft, delayMs) {
        var exp = Number(expectedScore);
        _llGetTop(10, function (err2, items2) {
          if (err2 || !items2) {
            if (triesLeft <= 1) {
              if (lastRenderedLbItems && lastRenderedLbItems.length) renderLeaderboard(lastRenderedLbItems);
              else setLbBodyHtml('<span style="font-size:.65rem;color:#775555">' + t('laGoError') + '</span>');
              return;
            }
            setTimeout(function () {
              pollLeaderboardAfterSubmit(expectedScore, submittedName, triesLeft - 1, Math.min(Math.round(delayMs * 1.65), 4000));
            }, delayMs);
            return;
          }
          var mine = null;
          var ri;
          for (ri = 0; ri < items2.length; ri++) {
            if (String(items2[ri].member_id) === String(_llPlayerId)) {
              mine = items2[ri];
              break;
            }
          }
          var listOk = mine && Number(mine.score) >= exp;
          if (listOk || triesLeft <= 1) {
            if (mine && Number(mine.score) < exp) {
              mine.score = exp;
              mine.player = mine.player || {};
              mine.player.name = submittedName;
            }
            renderLeaderboard(items2);
            return;
          }
          setTimeout(function () {
            pollLeaderboardAfterSubmit(expectedScore, submittedName, triesLeft - 1, Math.min(Math.round(delayMs * 1.65), 4000));
          }, delayMs);
        });
      }

      function showSubmitForm() {
        var formId = '_la-go-submit-form';
        if (document.getElementById(formId)) return;
        var form = document.createElement('div');
        form.id = formId;
        form.style.cssText = 'margin:.6rem 0;display:flex;gap:.4rem;justify-content:center;align-items:center';
        form.innerHTML =
          '<input id="_la-go-name" type="text" maxlength="16" placeholder="' + _escHtml(t('laGoNamePlc')) + '" style="' +
            'padding:.35rem .6rem;border:1px solid rgba(0,255,255,0.35);border-radius:6px;' +
            'background:rgba(0,0,0,0.35);color:#e0e0ff;font-family:monospace;font-size:.75rem;' +
            'width:120px;outline:none' +
          '">' +
          '<button id="_la-go-send" style="' +
            'padding:.35rem .8rem;border:1.5px solid rgba(0,255,255,0.5);border-radius:6px;' +
            'background:rgba(0,255,255,0.10);color:#00ffff;font-family:monospace;font-size:.72rem;' +
            'font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;' +
            'transition:background .2s' +
          '">' + t('laGoSubmit') + '</button>';
        lbEl.parentNode.insertBefore(form, lbEl);

        var nameIn = form.querySelector('#_la-go-name');
        var sendBtn = form.querySelector('#_la-go-send');
        // Retrieve last used name
        var savedName = localStorage.getItem('ll_player_name') || '';
        if (savedName) nameIn.value = savedName;

        sendBtn.addEventListener('click', function () {
          var name = nameIn.value.trim();
          if (!name) { nameIn.style.borderColor = '#ff4444'; return; }
          sendBtn.disabled = true;
          sendBtn.textContent = '…';
          localStorage.setItem('ll_player_name', name);

          _llSetName(name, function () {
            _llSubmitScore(playerScore, function (err) {
              if (err) {
                sendBtn.disabled = false;
                sendBtn.textContent = t('laGoError');
                return;
              }
              form.innerHTML = '<span style="font-size:.7rem;color:#00ff88">' + t('laGoSubmitted') + '</span>';
              renderLeaderboardLoading();
              pollLeaderboardAfterSubmit(playerScore, name, 8, 200);
            });
          });
        });

        nameIn.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); sendBtn.click(); }
        });
        nameIn.focus();
      }

      // Fetch leaderboard
      _llGetTop(10, function (err, items) {
        if (err || !items) {
          setLbBodyHtml('<span style="font-size:.65rem;color:#775555">' + t('laGoError') + '</span>');
          return;
        }
        renderLeaderboard(items);
        var submittedBest = _llGetMyBestSubmittedWorldScore(_llPlayerId, items);
        var beatsSubmittedWorld = (submittedBest === null) || (playerScore > submittedBest);
        var strictlyBetter = _llCountScoresStrictlyAbove(items, playerScore);
        var qualifiesTop10 = strictlyBetter < 10;
        if (qualifiesTop10 && beatsSubmittedWorld && _llToken) showSubmitForm();
      });
    },

    _breakCombo: function () {
      if (this.comboMultiplier <= 1) return;
      // Flash the combo text red briefly before resetting
      var self = this;
      this._comboTxt.setColor('#ff2222');
      this._comboTxt.setAlpha(1.0);
      this.tweens.add({
        targets: this._comboTxt, alpha: 0, duration: 350, ease: 'Cubic.easeIn',
        onComplete: function () { self._comboTxt.setAlpha(0); },
      });
      this.comboMultiplier = 1;
      this.comboTimer = 0;
      this._comboPulse = 0;
    },

    _floatScore: function (wx, wy, pts, tier) {
      // Fill colors match enemy body tints (_enemy #FF0044, _shooter #FFaa22, bruiser purple family).
      var col, sz, shCol;
      if (tier === 3) {
        col = '#b44dff'; sz = '30px'; shCol = 'rgba(40,0,72,0.75)';
      } else if (tier === 2) {
        col = '#ffaa22'; sz = '26px'; shCol = 'rgba(48,24,0,0.72)';
      } else {
        col = '#ff0044'; sz = '22px'; shCol = 'rgba(40,0,12,0.75)';
      }
      var txt = this.add.text(wx, wy - 10, '+' + pts, {
        fontFamily: 'monospace', fontSize: sz, fontStyle: 'normal', color: col,
        stroke: '#ffffff', strokeThickness: 1,
        shadow: { offsetX: 0, offsetY: 2, color: shCol, blur: 5, stroke: true, fill: true },
      });
      txt.setOrigin(0.5, 1); txt.setDepth(60);
      txt.setBlendMode(Phaser.BlendModes.ADD);
      txt.setAlpha(1.0);
      txt.setScale(1.38);
      this.tweens.add({
        targets: txt,
        y: wy - 80,
        scaleX: 0.92, scaleY: 0.92,
        alpha: 0,
        duration: 950,
        ease: 'Cubic.easeOut',
        onComplete: function () { txt.destroy(); },
      });
    },

    _renderShieldOrbs: function () {
      var p = this.p;
      var ORB_RADIUS = 38;
      var ORB_SIZE   = 5;
      for (var oi = 0; oi < this._shieldOrbs.length; oi++) {
        var og = this._shieldOrbs[oi];
        if (oi >= this.playerShields) {
          og.setVisible(false);
          continue;
        }
        og.setVisible(true);
        // Evenly spaced around the player, rotating
        var baseAng = (Math.PI * 2 / this.MAX_SHIELDS) * oi + this._shieldAngle;
        var ox = p.x + Math.cos(baseAng) * ORB_RADIUS;
        var oy = p.y + Math.sin(baseAng) * ORB_RADIUS;
        og.clear();
        // Outer glow ring
        og.lineStyle(4, 0x00ffff, 0.30);
        og.strokeCircle(0, 0, ORB_SIZE + 4);
        // Bright core
        og.fillStyle(0x00ffff, 0.95);
        og.fillCircle(0, 0, ORB_SIZE);
        og.setPosition(ox, oy);
      }
    },

    _floatScoreBig: function (label, pts) {
      var cam = this.cameras.main;
      var sx = cam.width / 2, sy = cam.height * 0.3;
      var col = label === 'PARADE' ? '#aa44ff' : label === 'NUKE' ? '#00ffff' : '#ffcc00';
      var txt = this.add.text(sx, sy, '+' + pts + ' ' + label + '!', {
        fontFamily: 'monospace', fontSize: '32px', fontStyle: 'bold', color: col,
      });
      txt.setOrigin(0.5); txt.setDepth(105);
      txt.setScrollFactor(0);
      txt.setBlendMode(Phaser.BlendModes.ADD);
      txt.setScale(0.5);
      this.tweens.add({
        targets: txt, scaleX: 1.1, scaleY: 1.1,
        duration: 150, ease: 'Back.easeOut',
        yoyo: true, hold: 100,
      });
      this.tweens.add({
        targets: txt, y: sy - 50, alpha: 0,
        duration: 1200, ease: 'Cubic.easeOut', delay: 300,
        onComplete: function () { txt.destroy(); },
      });
    },

    _beginBatch: function (label) {
      this._batchScore = 0;
      this._batchLabel = label;
      this._batchActive = true;
    },

    _endBatch: function () {
      if (!this._batchActive) return;
      this._batchActive = false;
      if (this._batchScore > 0) {
        this._floatScoreBig(this._batchLabel, this._batchScore);
      }
    },

    _checkCollisions: function () {
      var p = this.p;
      var pR = SIZE * 0.6;
      var isAtk = p.state === 'ATTACKING';
      var isDAtk = p.state === 'DASH_ATTACKING';
      var isDash = p.state === 'DASHING';
      var vuln = !isAtk && !isDAtk && !isDash;

      // Dash marks enemies instead of killing them
      if (isDash) {
        for (var mi = 0; mi < this.enemies.length; mi++) {
          var me = this.enemies[mi];
          if (me.isMarked) continue;
          var mdx = p.x - me.x, mdy = p.y - me.y;
          var md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < DASH_MARK_RADIUS + me.size * 0.5) {
            me.isMarked = true;
            me.markTimer = 3000;
            me.stunTimer = 200;
            p.dashHitCount++;
            this._explode(me.x, me.y, [0, 255, 255], 8);
          }
        }
      }

      for (var i = this.enemies.length - 1; i >= 0; i--) {
        var e = this.enemies[i];
        var dx = p.x - e.x, dy = p.y - e.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < pR + e.size * 0.5) {
          if (isAtk) {
            // Detonation on marked enemy — ignores shield entirely
            if (e.isMarked) {
              this._triggerDetonation(i);
              p.state = 'MOVING';
              p.spinAngle = 0; p.atkTimer = 0;
              p.atkAvailable = true; p.atkCooldown = 0;
              return;
            }
            // Shield blocks basic attack — rebound
            if (e.tier === 3 && e.hasShield) {
              if (dist > 0.1) { p.vx = (dx / dist) * REBOUND_IMP; p.vy = (dy / dist) * REBOUND_IMP; }
              this._explode(e.x, e.y, [0, 255, 255], 6);
              this._triggerHitstop(HITSTOP_DUR);
              p.state = 'MOVING';
              p.spinAngle = 0; p.atkTimer = 0;
              p.atkAvailable = true; p.atkCooldown = 0;
              if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
              return;
            }
            var atkDmg = (e.tier === 3) ? 1 : 1;
            e.hp -= atkDmg;
            if (e.hp <= 0) {
              this._killEnemy(i);
            } else {
              if (dist > 0.1) { e.vx -= (dx / dist) * 10; e.vy -= (dy / dist) * 10; }
              e.stunTimer = 300;
              this._explode(e.x, e.y, [255, 200, 60], 8);
              this._triggerHitstop(HITSTOP_DUR);
            }
            p.state = 'MOVING';
            p.spinAngle = 0; p.atkTimer = 0;
            p.atkAvailable = true; p.atkCooldown = 0;
            p.vx *= 0.3; p.vy *= 0.3;
            if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
            return;
          } else if (isDAtk) {
            if (e.tier === 3 && e.hasShield) {
              this._breakShield(e);
              p.vx = 0; p.vy = 0;
              if (dist > 0.1) {
                p.x = e.x + (dx / dist) * (e.size * 0.5 + pR + 2);
                p.y = e.y + (dy / dist) * (e.size * 0.5 + pR + 2);
              }
              p.hasHitDuringDashAttack = true;
              p.atkTimer = 0;
              p.state = 'MOVING';
              p.spinAngle = 0;
              this._triggerLandingBurst();
              return;
            }
            var datkDmg = (e.tier === 3) ? 2 : 1;
            e.hp -= datkDmg;
            if (e.hp <= 0) {
              this._killEnemy(i);
            } else {
              e.stunTimer = 200;
              this._explode(e.x, e.y, [255, 200, 60], 8);
              this._triggerHitstop(HITSTOP_DUR);
            }
            p.hasHitDuringDashAttack = true;
            if (p.dashAtkExtended < DASHATK_MAX_EXT) {
              var ext = Math.min(DASHATK_CHAIN_EXT, DASHATK_MAX_EXT - p.dashAtkExtended);
              p.atkTimer += ext; p.dashAtkExtended += ext;
            }
          } else if (vuln && !p.invincible) {
            var cnx = dist > 0.1 ? dx / dist : 0;
            var cny = dist > 0.1 ? dy / dist : 0;
            this._damagePlayer(cnx, cny);
          }
        }
      }
    },

    update: function (_time, delta) {
      var dt = Math.min(delta / 1000, 0.05);
      this._shieldFloatStack = 0;

      // Loader : couvre le pic shader au 1er frame ; relance = moins de frames + fade plus court.
      if (!this._loaderRemoved) {
        this._warmupFrames = (this._warmupFrames || 0) + 1;
        var wTarget = this._warmupTargetFrames != null ? this._warmupTargetFrames : LOADER_WARMUP_FRAMES;
        if (this._warmupFrames >= wTarget) {
          this._loaderRemoved = true;
          var lid = this._loaderOverlayId || '_la-loading';
          var loEl = document.getElementById(lid);
          if (loEl) {
            var isRestart = lid === '_la-restart-loading';
            var fadeSec = isRestart ? '0.38s' : '0.55s';
            var removeMs = isRestart ? 450 : 600;
            loEl.style.transition = 'opacity ' + fadeSec + ' ease';
            loEl.style.opacity = '0';
            setTimeout(function () { if (loEl.parentNode) loEl.parentNode.removeChild(loEl); }, removeMs);
          }
        }
      }

      this._checkTheme();

      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= delta;
        if (this.hitstopTimer <= 0) { this.hitstopTimer = 0; this.timeScale = 1.0; }
        else this.timeScale = 0;
      }

      var sDt  = dt * this.timeScale;
      var s60  = sDt * 60;
      var ms   = sDt * 1000;

      var fps = Math.round(this.game.loop.actualFps);
      this.fpsTxt.setText(fps + ' FPS');
      this.fpsTxt.setColor(fps >= 55 ? '#00ff88' : fps >= 30 ? '#ffcc00' : '#ff4444');

      if (ms < 0.001) {
        this._decayGhosts(dt);
        this._renderPlayer();
        return;
      }

      var p = this.p;

      // Skip all gameplay while dead — scene is fully frozen
      if (p.state === 'DEAD') {
        return;
      }

      if (p.invincible) {
        p.invincTimer -= ms;
        if (p.invincTimer <= 0) { p.invincible = false; p.invincTimer = 0; p.dashInvinc = false; }
      }

      var frDt = Math.pow(FRICTION, s60);
      if (p.state === 'MOVING') {
        var inp = this._inputVec();
        p.vx = (p.vx + inp.dx * ACCEL * s60) * frDt;
        p.vy = (p.vy + inp.dy * ACCEL * s60) * frDt;
      } else if (p.state === 'RECOVERY') {
        var rf = p.recoveryWhiff ? DASHATK_WHIFF_FRIC : RECOVERY_FRIC;
        p.vx *= Math.pow(rf, s60); p.vy *= Math.pow(rf, s60);
      } else {
        p.vx *= frDt; p.vy *= frDt;
      }
      p.x += p.vx * s60; p.y += p.vy * s60;

      var wM = WORLD_HALF - SIZE * 1.5;
      if (p.x < -wM) { p.x = -wM; p.vx *= -0.4; }
      if (p.x >  wM) { p.x =  wM; p.vx *= -0.4; }
      if (p.y < -wM) { p.y = -wM; p.vy *= -0.4; }
      if (p.y >  wM) { p.y =  wM; p.vy *= -0.4; }

      if (p.state === 'DASHING') {
        p.dashTimer -= ms;
        if (Math.sqrt(p.vx * p.vx + p.vy * p.vy) > 2) {
          this._addGhost(p.x, p.y, 0.55, p.angle, false);
        }
        if (p.dashTimer <= 0) {
          p.state = 'MOVING'; p.dashCooldown = DASH_CD;
          p.invincible = true; p.invincTimer = 220; p.dashInvinc = true;
        }
      }
      if (p.state !== 'DASHING' && p.dashCooldown > 0) {
        p.dashCooldown = Math.max(0, p.dashCooldown - ms);
        if (p.dashCooldown <= 0) p.dashAvailable = true;
      }

      if (p.state === 'ATTACKING') {
        p.atkTimer -= ms; p.spinAngle += sDt * ATK_SPIN;
        if (p.atkTimer <= 0) {
          // Whiff — attack missed, short recovery
          p.state = 'RECOVERY'; p.recoveryTimer = ATK_WHIFF_DUR;
          p.recoveryWhiff = true; p.spinAngle = 0;
          p.vx *= 0.15; p.vy *= 0.15;
        }
      }

      if (p.state === 'DASH_ATTACKING') {
        p.atkTimer -= ms; p.spinAngle += sDt * DASH_ATK_SPIN;
        this._addGhost(p.x, p.y, 0.70, p.angle, true);
        if (p.atkTimer <= 0) {
          if (p.hasHitDuringDashAttack) { this._triggerLandingBurst(); p.state = 'MOVING'; }
          else {
            p.state = 'RECOVERY'; p.recoveryTimer = DASHATK_WHIFF_DUR;
            p.recoveryWhiff = true; p.vx *= 0.05; p.vy *= 0.05;
          }
          p.spinAngle = 0;
        }
      }

      if (p.state === 'RECOVERY') {
        p.recoveryTimer -= ms;
        if (p.recoveryTimer <= 0) { p.state = 'MOVING'; p.recoveryTimer = 0; }
      }
      if (p.state !== 'ATTACKING' && p.state !== 'DASH_ATTACKING') {
        p.atkAvailable = true;
      }

      this._decayGhosts(dt);

      if (p.state === 'ATTACKING' || p.state === 'DASH_ATTACKING') {
        p.angle = Math.atan2(p.atkDy, p.atkDx) + p.spinAngle;
      } else {
        var cam = this.cameras.main;
        p.angle = Phaser.Math.Angle.Between(
          p.x, p.y,
          this._mouseX + cam.scrollX, this._mouseY + cam.scrollY
        );
      }

      var tdx = p.x - this._trLX, tdy = p.y - this._trLY;
      if (tdx * tdx + tdy * tdy > this.TRAIL_DIST_SQ) {
        var sl = this._trail[this._trW % this.TRAIL_CAP];
        sl.x = p.x; sl.y = p.y; sl.angle = p.angle; sl.ok = true;
        this._trW++;
        if (this._trN < this.TRAIL_CAP) this._trN++;
        this._trLX = p.x; this._trLY = p.y;
      }

      this._updateEnemies(sDt);
      this._updateProjectiles(sDt);
      this._checkCollisions();

      // Guard: skip spawn if game over flag
      if (this.spawnTimer > -999000) {
        this.spawnTimer += ms;
        if (this.spawnTimer >= this.nextSpawnDelay) {
          this.spawnTimer = 0;
          this.nextSpawnDelay = Phaser.Math.Between(3000, 5000);
          this._spawnWave();
        }
      }

      // Rotate shield orbs
      this._shieldAngle += sDt * 1.8;
      this._renderShieldOrbs();

      var cam = this.cameras.main;
      var cA = 1 - Math.pow(1 - CAM_LERP, s60);
      cam.scrollX += (p.x - cam.width  / 2 - cam.scrollX) * cA;
      cam.scrollY += (p.y - cam.height / 2 - cam.scrollY) * cA;

      this.pcbTile.tilePositionX = cam.scrollX;
      this.pcbTile.tilePositionY = cam.scrollY;
      this.pcbTile.setSize(cam.width, cam.height);

      this.gameTime += dt;

      // Combo timer decay
      if (this.comboTimer > 0) {
        this.comboTimer -= ms;
        if (this.comboTimer <= 0) {
          this.comboTimer = 0;
          this.comboMultiplier = 1;
          this._comboPulse = 0;
        }
      }

      // Anneaux d'onde de choc
      this._updateWaveRings(dt);
      this._updateHiveBeams(dt);

      this._updateComboFX(sDt);
      this._renderPlayer();
      this._renderEnemies();
      this._renderProjectiles();
      this._renderHUD();
    },

    _updateWaveRings: function (dt) {
      var c = getColors();
      for (var i = 0; i < this._waveRings.length; i++) {
        var ring = this._waveRings[i];
        if (!ring.active) continue;
        ring.r     += dt * LANDING_BURST_RADIUS * 3.5;
        ring.alpha -= dt * 3.2;
        if (ring.alpha <= 0) {
          ring.active = false;
          ring.gfx.clear();
          ring.gfx.setVisible(false);
          continue;
        }
        ring.gfx.clear();
        ring.gfx.lineStyle(2.5, c.cyan, ring.alpha);
        ring.gfx.strokeCircle(ring.x, ring.y, ring.r);
        // Second anneau intérieur plus fin
        if (ring.r > 20) {
          ring.gfx.lineStyle(1, c.cyan, ring.alpha * 0.4);
          ring.gfx.strokeCircle(ring.x, ring.y, ring.r * 0.6);
        }
      }
    },

    _updateEnemies: function (dt) {
      var ms = dt * 1000, sc60 = dt * 60;
      var stDrg = Math.pow(0.92, sc60);
      var stK   = 1 - Math.pow(1 - 0.08, sc60);
      var p = this.p, en = this.enemies;

      for (var i = 0; i < en.length; i++) {
        var a = en[i];
        for (var j = i + 1; j < en.length; j++) {
          var b = en[j];
          var sdx = a.x - b.x, sdy = a.y - b.y;
          var sd = Math.sqrt(sdx * sdx + sdy * sdy);
          if (sd < SEPARATION_RADIUS && sd > 0.01) {
            var ov = (SEPARATION_RADIUS - sd) / SEPARATION_RADIUS;
            var fx = (sdx / sd) * SEPARATION_FORCE * ov * sc60;
            var fy = (sdy / sd) * SEPARATION_FORCE * ov * sc60;
            // Mass ratio: heavier tier receives less push, lighter tier receives more.
            // mass: T1=1, T2=2.5, T3=6
            var massA = a.tier === 3 ? 6.0 : a.tier === 2 ? 2.5 : 1.0;
            var massB = b.tier === 3 ? 6.0 : b.tier === 2 ? 2.5 : 1.0;
            var total = massA + massB;
            a.vx += fx * (massB / total); a.vy += fy * (massB / total);
            b.vx -= fx * (massA / total); b.vy -= fy * (massA / total);
          }
        }
      }

      for (var i = 0; i < en.length; i++) {
        var e = en[i];
        var tSl = e.trail[e._tw % this.ENEMY_TRAIL_N];
        tSl.x = e.x; tSl.y = e.y; tSl.angle = e.angle;
        e._tw++; if (e._tn < this.ENEMY_TRAIL_N) e._tn++;

        // Mark expiry timer
        if (e.isMarked) {
          e.markTimer -= ms;
          if (e.markTimer <= 0) {
            e.isMarked = false; e.markTimer = 0;
          }
        }

        // Micro-particles on marked enemies (instability visual)
        if (e.isMarked && Math.random() < 0.18) {
          this._emitter2.setPosition(
            e.x + (Math.random() - 0.5) * 12,
            e.y + (Math.random() - 0.5) * 8
          );
          this._emitter2.setParticleTint(0x00ffff);
          this._emitter2.explode(1);
        }

        if (e.stunTimer > 0) {
          e.stunTimer -= ms;
          e.vx *= stDrg; e.vy *= stDrg;
          e.x += e.vx * sc60; e.y += e.vy * sc60;
        } else if (e.tier === 2) {
          if (e.fireFlashTimer > 0) e.fireFlashTimer -= ms;
          // Tier 2: keep distance, face player, charge & shoot
          var dx2 = p.x - e.x, dy2 = p.y - e.y;
          var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (d2 > 0.1) e.angle = Math.atan2(dy2, dx2);

          if (d2 < T2_KEEP_DIST * 0.7) {
            // too close — flee
            var fx2 = d2 > 0.1 ? (-dx2 / d2) * e.speed * 1.5 : 0;
            var fy2 = d2 > 0.1 ? (-dy2 / d2) * e.speed * 1.5 : 0;
            e.vx += (fx2 - e.vx) * stK; e.vy += (fy2 - e.vy) * stK;
          } else if (d2 > T2_KEEP_DIST * 1.3) {
            // too far — approach
            var ax2 = (dx2 / d2) * e.speed, ay2 = (dy2 / d2) * e.speed;
            e.vx += (ax2 - e.vx) * stK; e.vy += (ay2 - e.vy) * stK;
          } else {
            // orbit range — slow drift
            e.vx *= stDrg; e.vy *= stDrg;
          }
          e.x += e.vx * sc60; e.y += e.vy * sc60;

          // Firing logic
          e.fireCD -= ms;
          if (e.fireCD <= 0 && !e.isCharging) {
            e.isCharging = true; e.chargeTimer = T2_CHARGE_DUR;
          }
          if (e.isCharging) {
            e.chargeTimer -= ms;
            if (e.chargeTimer <= 0) {
              // Fire!
              var fAng = Math.atan2(p.y - e.y, p.x - e.x);
              this._spawnProjectile(e.x, e.y, fAng, PROJ_SPEED, e);
              // Recoil
              e.vx -= Math.cos(fAng) * T2_RECOIL;
              e.vy -= Math.sin(fAng) * T2_RECOIL;
              e.isCharging = false;
              e.fireFlashTimer = 180;
              e.fireCD = T2_FIRE_CD * (0.8 + Math.random() * 0.4);
            }
          }
        } else if (e.tier === 3) {
          // Always face player for visual clarity, but movement is independent
          var dx3 = p.x - e.x, dy3 = p.y - e.y;
          var d3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
          if (d3 > 0.1) e.angle = Math.atan2(dy3, dx3);

          // Bunker Mobile: drift toward a fixed waypoint near the player
          e.waypointTimer -= ms;
          var wpDx = e.targetWaypoint.x - e.x;
          var wpDy = e.targetWaypoint.y - e.y;
          var wpD = Math.sqrt(wpDx * wpDx + wpDy * wpDy);

          if (wpD < 22 || e.waypointTimer <= 0) {
            // Anchored or timer expired — pick a new waypoint
            // Waypoint is placed relative to the Hive's *current position*, not the player,
            // so it drifts independently. A bias keeps it loosely within the arena.
            var wpAng = Math.random() * Math.PI * 2;
            // Vary radius widely so behaviour feels unpredictable
            var wpR = 250 + Math.random() * 350;
            var candidateX = e.x + Math.cos(wpAng) * wpR;
            var candidateY = e.y + Math.sin(wpAng) * wpR;
            // Soft bias: if the candidate drifts further than ~700px from the player,
            // nudge it back by blending 30% toward a point near the player instead
            var candDx = candidateX - p.x, candDy = candidateY - p.y;
            var candD = Math.sqrt(candDx * candDx + candDy * candDy);
            if (candD > 700) {
              var pullAng = Math.random() * Math.PI * 2;
              var nearR = 350 + Math.random() * 200;
              candidateX = candidateX * 0.35 + (p.x + Math.cos(pullAng) * nearR) * 0.65;
              candidateY = candidateY * 0.35 + (p.y + Math.sin(pullAng) * nearR) * 0.65;
            }
            // Clamp to world bounds (generous, allows slight off-screen)
            var wM3 = WORLD_HALF - T3_SIZE * 2;
            e.targetWaypoint.x = Math.max(-wM3, Math.min(wM3, candidateX));
            e.targetWaypoint.y = Math.max(-wM3, Math.min(wM3, candidateY));
            e.waypointTimer = 3500 + Math.random() * 2000;
            if (wpD < 22) { e.vx *= 0.05; e.vy *= 0.05; }
          } else {
            // Glide toward waypoint with heavy inertia
            var T3_DRIFT_SPD = 1.4;
            var T3_ACCEL_K = 0.018;
            var wpNx = wpDx / wpD, wpNy = wpDy / wpD;
            var targetVx = wpNx * T3_DRIFT_SPD;
            var targetVy = wpNy * T3_DRIFT_SPD;
            e.vx += (targetVx - e.vx) * T3_ACCEL_K * sc60;
            e.vy += (targetVy - e.vy) * T3_ACCEL_K * sc60;
          }
          e.x += e.vx * sc60; e.y += e.vy * sc60;

          // Spawner logic — pas d’anim / cooldown long si la limite d’ennemis est déjà atteinte
          e.spawnCD -= ms;
          if (e.spawnCD <= 0) {
            var hiveSlots = MAX_ENEMIES - this.enemies.length;
            if (hiveSlots <= 0) {
              e.spawnCD = 120;
            } else {
              e.spawnCD = T3_SPAWN_CD * (0.7 + Math.random() * 0.6);
              e.spawnCycle++;
              var hiveDid = false;
              if (e.spawnCycle % 3 === 0) {
                var sx2 = e.x + (Math.random() - 0.5) * 40;
                var sy2 = e.y + (Math.random() - 0.5) * 40;
                this._spawnShooterAt(sx2, sy2);
                hiveDid = true;
                this._hiveSpawnBeam(e.x, e.y, sx2, sy2);
                this._explode(sx2, sy2, [187, 0, 255], 14);
                this._explode(sx2, sy2, [255, 150, 255], 7);
              } else {
                for (var sw = 0; sw < 3; sw++) {
                  if (this.enemies.length >= MAX_ENEMIES) break;
                  var sAng = e.angle + Math.PI + (sw - 1) * 0.7;
                  var spx = e.x + Math.cos(sAng) * 35;
                  var spy = e.y + Math.sin(sAng) * 35;
                  this._spawnRusherAt(spx, spy);
                  var spawned = this.enemies[this.enemies.length - 1];
                  spawned.vx = Math.cos(sAng) * 6;
                  spawned.vy = Math.sin(sAng) * 6;
                  this._hiveSpawnBeam(e.x, e.y, spx, spy);
                  hiveDid = true;
                }
                if (hiveDid) {
                  this._explode(e.x, e.y, [187, 0, 255], 12);
                  this._explode(e.x, e.y, [255, 150, 255], 6);
                }
              }
              if (hiveDid) this.cameras.main.shake(40, 0.0015);
            }
          }
        } else {
          // Tier 1: rush toward player
          var dx = p.x - e.x, dy = p.y - e.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > 0.1) {
            e.angle = Math.atan2(dy, dx);
            var ax = (dx / d) * e.speed, ay = (dy / d) * e.speed;
            e.vx += (ax - e.vx) * stK; e.vy += (ay - e.vy) * stK;
          }
          e.x += e.vx * sc60; e.y += e.vy * sc60;
        }

        // --- World border clamp: bounce off arena walls ---
        var eHalf = e.tier === 3 ? T3_SIZE : e.tier === 2 ? T2_SIZE : SIZE;
        var eMargin = WORLD_HALF - eHalf * 1.2;
        var BOUNCE = 0.55;
        if (e.x < -eMargin) { e.x = -eMargin; if (e.vx < 0) e.vx = Math.abs(e.vx) * BOUNCE; }
        if (e.x >  eMargin) { e.x =  eMargin; if (e.vx > 0) e.vx = -Math.abs(e.vx) * BOUNCE; }
        if (e.y < -eMargin) { e.y = -eMargin; if (e.vy < 0) e.vy = Math.abs(e.vy) * BOUNCE; }
        if (e.y >  eMargin) { e.y =  eMargin; if (e.vy > 0) e.vy = -Math.abs(e.vy) * BOUNCE; }
      }
    },

    _updateProjectiles: function (dt) {
      var ms = dt * 1000, sc60 = dt * 60;
      var p = this.p;
      var pR = SIZE * 0.6;
      var isAtk = p.state === 'ATTACKING';
      var isDAtk = p.state === 'DASH_ATTACKING';
      var vuln = !isAtk && !isDAtk && p.state !== 'DASHING';

      for (var i = this.projectiles.length - 1; i >= 0; i--) {
        var pr = this.projectiles[i];
        pr.life -= ms;
        pr.x += pr.vx * dt; pr.y += pr.vy * dt;
        pr.spr.setPosition(pr.x, pr.y);
        pr.spr.rotation += pr.rotSpeed * dt;

        // Traîne sprite : injection d'un nouveau slot dans le pool global
        var spd = Math.sqrt(pr.vx * pr.vx + pr.vy * pr.vy);
        if (spd > 0.1) {
          var slot = this._projTrailPool[this._projTrailPoolW % this._projTrailPool.length];
          this._projTrailPoolW++;
          slot.x = pr.x;
          slot.y = pr.y;
          slot.alpha = pr.isReflected ? 0.85 : 0.55;
          slot.tint = pr.isReflected ? 0xaa44ff : 0xffaa22;
          slot.rot = pr.spr.rotation;
          slot.active = true;
          slot.spr.setVisible(true);
          pr.trailSlots.push(slot);
          var maxTrail = pr.isReflected ? this._PROJ_TRAIL_PER : Math.ceil(this._PROJ_TRAIL_PER * 0.45);
          if (pr.trailSlots.length > maxTrail) {
            pr.trailSlots.shift();
          }
        }

        // Boost visuel violet sur renvoi smashed
        if (pr.isReflected && pr.smashed && Math.random() < 0.3) {
          this._emitter2.setPosition(pr.x, pr.y);
          this._emitter2.setParticleTint(0xaa44ff);
          this._emitter2.explode(1);
        }

        // OOB / expired
        if (pr.life <= 0 || Math.abs(pr.x) > WORLD_HALF || Math.abs(pr.y) > WORLD_HALF) {
          this._destroyProjectile(pr);
          this.projectiles.splice(i, 1);
          continue;
        }

        if (pr.isReflected) {
          // Reflected projectile hits enemies
          for (var ei = this.enemies.length - 1; ei >= 0; ei--) {
            var e = this.enemies[ei];
            var edx = pr.x - e.x, edy = pr.y - e.y;
            var ed = Math.sqrt(edx * edx + edy * edy);
            if (ed < PROJ_RADIUS + e.size * 0.5) {
              // Shield intercept: reflected proj breaks shield
              if (e.tier === 3 && e.hasShield) {
                this._breakShield(e);
                this._destroyProjectile(pr);
                this.projectiles.splice(i, 1);
                break;
              }
              if (pr.smashed) {
                this._beginBatch('PARADE');
                var smashAoe = SHOCKWAVE_RADIUS * 0.75;
                var directDmg = (e.tier === 3) ? 2 : 2;
                e.hp -= directDmg;
                if (e.hp <= 0) {
                  this._killEnemy(ei, { batch: true, reflected: true });
                } else {
                  e.stunTimer = 300;
                }
                for (var si = this.enemies.length - 1; si >= 0; si--) {
                  var se = this.enemies[si];
                  var sdx2 = se.x - pr.x, sdy2 = se.y - pr.y;
                  var sd2 = Math.sqrt(sdx2 * sdx2 + sdy2 * sdy2);
                  if (sd2 < smashAoe && sd2 > 0.1) {
                    if (se.tier === 3 && se.hasShield) {
                      this._breakShield(se);
                    } else {
                      var aoeDmg = (se.tier === 3) ? 1 : 1;
                      se.hp -= aoeDmg;
                      if (se.hp <= 0) { this._killEnemy(si, { batch: true, reflected: true }); }
                    }
                    var sf = 1.0 - sd2 / smashAoe;
                    se.vx += (sdx2 / sd2) * SHOCKWAVE_FORCE * 1.5 * sf;
                    se.vy += (sdy2 / sd2) * SHOCKWAVE_FORCE * 1.5 * sf;
                    se.stunTimer = Math.max(se.stunTimer, 250 * sf);
                  }
                }
                this._endBatch();
                this._explode(pr.x, pr.y, [170, 68, 255], 30);
                this._explode(pr.x, pr.y, [255, 255, 255], 15);
                this._explode(pr.x, pr.y, [200, 120, 255], 10);
                this._triggerHitstop(DEFLECT_HEAVY_HS);
                this.cameras.main.shake(80, 0.008);
                this._spawnWaveRing(pr.x, pr.y);
              } else {
                e.hp -= 1;
                if (e.hp <= 0) {
                  this._killEnemy(ei, { reflected: true });
                } else {
                  e.stunTimer = 200;
                  this._explode(e.x, e.y, [0, 255, 255], 6);
                }
              }
              this._destroyProjectile(pr);
              this.projectiles.splice(i, 1);
              break;
            }
          }
        } else {
          // Enemy projectile hits player
          if (vuln && !p.invincible) {
            var pdx = p.x - pr.x, pdy = p.y - pr.y;
            var pd = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pd < pR + PROJ_RADIUS) {
              var pnx = pd > 0.1 ? pdx / pd : 0;
              var pny = pd > 0.1 ? pdy / pd : 0;
              this._damagePlayer(pnx, pny);
              this._destroyProjectile(pr);
              this.projectiles.splice(i, 1);
              continue;
            }
          }

          // Deflect: only dash attack can reflect projectiles
          if (isDAtk) {
            var ddx = p.x - pr.x, ddy = p.y - pr.y;
            var dd = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dd < pR + PROJ_RADIUS + 8) {
              var refSpd = PROJ_SPEED * PROJ_REFLECT_MULT;

              var refAng;
              if (pr.shooterRef && pr.shooterRef.hp > 0) {
                refAng = Phaser.Math.Angle.Between(pr.x, pr.y, pr.shooterRef.x, pr.shooterRef.y);
              } else {
                var bestD = Infinity, bestE = null;
                for (var hi = 0; hi < this.enemies.length; hi++) {
                  var he = this.enemies[hi];
                  if (he.tier < 2) continue;
                  var hdx = he.x - pr.x, hdy = he.y - pr.y;
                  var hd = Math.sqrt(hdx * hdx + hdy * hdy);
                  if (hd < bestD) { bestD = hd; bestE = he; }
                }
                if (bestE) {
                  refAng = Phaser.Math.Angle.Between(pr.x, pr.y, bestE.x, bestE.y);
                } else {
                  refAng = Phaser.Math.Angle.Between(p.x, p.y, pr.x, pr.y);
                }
              }
              pr.vx = Math.cos(refAng) * refSpd;
              pr.vy = Math.sin(refAng) * refSpd;
              pr.isReflected = true;
              pr.smashed = true;
              pr.life = PROJ_LIFE;
              pr.rotSpeed = 28;
              pr.spr.setTint(0xaa44ff);

              p.hasHitDuringDashAttack = true;
              this._triggerHitstop(DEFLECT_HEAVY_HS);
              this.cameras.main.shake(80, 0.008);
              this._explode(pr.x, pr.y, [170, 68, 255], 15);
            }
          }
        }
      }
    },

    _updateComboFX: function (dt) {
      var p = this.p;
      var cm = this.comboMultiplier;

      // Tier 1: x10+ cyan particle trail — burst per frame at player world pos
      if (cm >= 10) {
        this._comboTrailActive = true;
        var trailQty = cm >= 50 ? 3 : cm >= 25 ? 2 : 1;
        this._comboTrailEmitter.setPosition(p.x, p.y);
        this._comboTrailEmitter.explode(trailQty);
      } else if (this._comboTrailActive) {
        this._comboTrailActive = false;
      }

      // Tier 2: x25+ Warp/Barrel distortion PostFX
      if (cm >= 25) {
        var chromaStr = Math.min(8, (cm - 25) * 0.15 + 1);
        if (!this._chromaFX && this.cameras.main.postFX) {
          this._chromaFX = this.cameras.main.postFX.addBarrel(1.0);
        }
        if (this._chromaFX) {
          this._chromaFX.amount = 1.0 + chromaStr * 0.004;
        }
      } else if (this._chromaFX) {
        this.cameras.main.postFX.remove(this._chromaFX);
        this._chromaFX = null;
      }

      // Tier 3: x50+ small rotating arcs + sparks
      if (cm >= 50) {
        this._comboAuraActive = true;
        this._comboSparkActive = true;
        this._comboAuraGfx.setVisible(true);
      } else if (this._comboAuraActive) {
        this._comboAuraGfx.setVisible(false);
        this._comboAuraGfx.clear();
        this._comboAuraActive = false;
        this._comboSparkActive = false;
      }

      if (this._comboAuraActive) {
        this._comboAuraRot += dt * 18;
        this._comboAuraGfx.clear();
        // 3 short bright arcs rotating around player — small, dynamic, not a full shield
        var aR = SIZE * 1.5;
        var aPulse = 0.6 + 0.35 * Math.sin(this.gameTime * Math.PI * 8);
        for (var ai2 = 0; ai2 < 3; ai2++) {
          var baseA = this._comboAuraRot + (Math.PI * 2 / 3) * ai2;
          this._comboAuraGfx.lineStyle(2.5, 0x00ffff, aPulse);
          this._comboAuraGfx.beginPath();
          this._comboAuraGfx.arc(p.x, p.y, aR, baseA, baseA + 0.55);
          this._comboAuraGfx.strokePath();
        }

        // Sparks: 2 per frame at random offsets around player
        this._comboSparkEmitter.setPosition(
          p.x + (Math.random() - 0.5) * SIZE * 2,
          p.y + (Math.random() - 0.5) * SIZE * 2
        );
        this._comboSparkEmitter.explode(2);
      }
    },

    _renderProjectiles: function () {
      var gt = this.gameTime;

      // Decay de tous les slots de traîne actifs
      for (var si = 0; si < this._projTrailPool.length; si++) {
        var sl = this._projTrailPool[si];
        if (!sl.active) continue;
        sl.alpha -= 0.07;
        if (sl.alpha <= 0) {
          sl.active = false;
          sl.spr.setVisible(false);
        } else {
          sl.spr.setPosition(sl.x, sl.y);
          sl.spr.setRotation(sl.rot);
          sl.spr.setTint(sl.tint);
          sl.spr.setAlpha(sl.alpha);
          sl.spr.setScale(0.6 + sl.alpha * 0.5);
        }
      }

      for (var i = 0; i < this.projectiles.length; i++) {
        var pr = this.projectiles[i];
        if (pr.isReflected) {
          var pa = 0.75 + 0.25 * Math.sin(gt * Math.PI * 28 + i);
          pr.spr.setAlpha(pa);
          pr.spr.setScale(pr.smashed ? 1.7 : 1.3);
          pr.spr.setTint(0xaa44ff);
        } else {
          var ys = 1.0 + 0.12 * Math.sin(gt * Math.PI * 16 + i * 1.3);
          pr.spr.setAlpha(1.0);
          pr.spr.setScale(ys);
          pr.spr.setTint(0xffaa22);
        }
      }
    },

    _renderPlayer: function () {
      var p = this.p;
      var key = this._pTexKey();

      // Normal hit i-frames: flicker
      if (p.invincible && !p.dashInvinc && Math.floor(this.gameTime * 12.5) % 2 === 0) {
        this.playerSpr.setVisible(false);
        for (var i = 0; i < this.TRAIL_CAP; i++) this._trail[i].spr.setVisible(false);
        return;
      }

      this.playerSpr.setTexture(key);
      this.playerSpr.setPosition(p.x, p.y);
      this.playerSpr.setRotation(p.angle);
      this.playerSpr.setVisible(true);

      // Arrow scale escalates with combo (kept subtle vs older, larger steps)
      var cm = this.comboMultiplier;
      var baseScale, scaleLabel;
      if (cm >= 50) {
        baseScale = 1.30 + 0.08 * Math.sin(this.gameTime * Math.PI * 14);
      } else if (cm >= 25) {
        baseScale = 1.14 + 0.055 * Math.sin(this.gameTime * Math.PI * 9);
      } else if (cm >= 10) {
        baseScale = 1.06 + 0.035 * Math.sin(this.gameTime * Math.PI * 5);
      } else if (cm >= 5) {
        baseScale = 1.025 + 0.02 * Math.sin(this.gameTime * Math.PI * 4);
      } else {
        baseScale = 1.0;
      }
      if (p.state === 'DASH_ATTACKING') baseScale *= 1.08;
      this.playerSpr.setScale(baseScale);

      // Dash i-frames: keep dash look (cyan tint, ADD blend, full alpha)
      if (p.invincible && p.dashInvinc) {
        this.playerSpr.setTint(0x00ffff);
        this.playerSpr.setAlpha(0.85);
        this.playerSpr.setBlendMode(Phaser.BlendModes.ADD);
      } else {
        this.playerSpr.clearTint();
        this.playerSpr.setAlpha(1.0);
        this.playerSpr.setBlendMode(
          (p.state === 'RECOVERY' && p.recoveryWhiff) ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD
        );
      }

      for (var i = 0; i < this.TRAIL_CAP; i++) this._trail[i].spr.setVisible(false);
      for (var hi = 0; hi < this._trN; hi++) {
        var idx = (this._trW - this._trN + hi) % this.TRAIL_CAP;
        if (idx < 0) idx += this.TRAIL_CAP;
        var sl = this._trail[idx];
        if (!sl.ok) continue;
        var dx = sl.x - p.x, dy = sl.y - p.y;
        if (dx * dx + dy * dy < 4) continue;
        sl.spr.setTexture(key);
        sl.spr.setPosition(sl.x, sl.y);
        sl.spr.setRotation(sl.angle);
        var trAlpha = (hi + 1) / (this._trN + 1) * (p.invincible && p.dashInvinc ? 0.55 : 0.35);
        sl.spr.setAlpha(trAlpha);
        sl.spr.setScale(baseScale * ((hi + 1) / (this._trN + 1) * 0.5 + 0.5));
        if (p.invincible && p.dashInvinc) sl.spr.setTint(0x00ffff);
        else sl.spr.clearTint();
        sl.spr.setVisible(true);
      }
    },

    _renderEnemies: function () {
      var gt = this.gameTime;
      for (var i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        e.spr.setPosition(e.x, e.y);
        e.spr.setRotation(e.angle);

        if (e.tier === 3) {
          // T3: apply mark visual OR normal tint
          if (e.isMarked) {
            var urgency = Math.max(0, 1 - e.markTimer / 3000);
            var flickFreq = 22 + urgency * 20;
            var flick = Math.sin(gt * Math.PI * flickFreq + i);
            var tintColor = flick > 0 ? 0x00ffff : 0xffffff;
            e.spr.setTint(tintColor);
            e.spr.setAlpha(0.7 + Math.abs(flick) * 0.3);
            e.spr.setScale(1.0 + Math.abs(flick) * 0.15);
          } else {
            var t3tint = e.hp >= 2 ? 0x5c0099 : 0x8b0000;
            e.spr.setTint(t3tint);
            e.spr.setAlpha(1.0);
            e.spr.setScale(1.0);
          }

          // Shield ring — ALWAYS updated so it tracks position
          if (e.shieldGfx) {
            e.shieldGfx.clear();
            if (e.hasShield) {
              e.shieldRot += 0.015;
              var sPulse, sAlpha, sR;
              if (e.isMarked) {
                // Marked: shield looks cracked/weak — dim, shrunk, fast flicker
                var mFlick2 = Math.sin(gt * Math.PI * 28 + i);
                sPulse = 0.6 + 0.15 * Math.abs(mFlick2);
                sAlpha = 0.40 + 0.55 * Math.abs(mFlick2);
                sR = T3_SHIELD_RADIUS * sPulse;
                var shCol = mFlick2 > 0 ? 0x00ffff : 0x4488ff;
                e.shieldGfx.lineStyle(2, shCol, sAlpha);
              } else {
                sPulse = 0.85 + 0.15 * Math.sin(gt * Math.PI * 3);
                sAlpha = 0.55 + 0.2 * Math.sin(gt * Math.PI * 4);
                sR = T3_SHIELD_RADIUS * sPulse;
                e.shieldGfx.lineStyle(3, 0x00ffff, sAlpha);
              }
              e.shieldGfx.strokeCircle(e.x, e.y, sR);
              e.shieldGfx.lineStyle(1.5, 0xffffff, sAlpha * 0.4);
              e.shieldGfx.strokeCircle(e.x, e.y, sR * 0.8);
              for (var ai = 0; ai < 4; ai++) {
                var arcA = e.shieldRot + (Math.PI / 2) * ai;
                e.shieldGfx.lineStyle(2, 0x00ffff, sAlpha * 0.7);
                e.shieldGfx.beginPath();
                e.shieldGfx.arc(e.x, e.y, sR + 3, arcA, arcA + 0.4);
                e.shieldGfx.strokePath();
              }
            }
          }
        } else if (e.isMarked) {
          var urgency = Math.max(0, 1 - e.markTimer / 3000);
          var flickFreq = 22 + urgency * 20;
          var flick = Math.sin(gt * Math.PI * flickFreq + i);
          var tintColor = flick > 0 ? 0x00ffff : 0xffffff;
          e.spr.setTint(tintColor);
          e.spr.setAlpha(0.7 + Math.abs(flick) * 0.3);
          e.spr.setScale(1.0 + Math.abs(flick) * 0.15);
        } else if (e.tier === 2) {
          if (e.fireFlashTimer > 0) {
            // Tir : jaune brillant bref
            var flash = e.fireFlashTimer / 180;
            e.spr.setTint(0xffff66);
            e.spr.setScale(1.0 + (1 - flash) * 0.45);
            e.spr.setAlpha(0.95 + flash * 0.05);
          } else if (e.isCharging) {
            // Charge : glissement lent vers l'orange (courbe > 1 = reste jaune-orange longtemps)
            var chg = 1 - e.chargeTimer / T2_CHARGE_DUR;
            var slow = Math.pow(chg, 1.85);
            var csc = 1.0 + chg * 0.32;
            var g0 = 195, g1 = 72;
            var b0 = 45, b1 = 8;
            var cg = Math.round(g0 + (g1 - g0) * slow);
            var cb = Math.round(b0 + (b1 - b0) * slow);
            e.spr.setTint(Phaser.Display.Color.GetColor(255, cg, cb));
            e.spr.setScale(csc);
            e.spr.setAlpha(0.62 + chg * 0.38);
          } else {
            e.spr.setTint(0xffaa22);
            e.spr.setScale(1.0);
            e.spr.setAlpha(1.0);
          }
        } else {
          e.spr.clearTint();
          e.spr.setAlpha(1.0);
          e.spr.setScale(1.0);
        }

        for (var t = 0; t < this.ENEMY_TRAIL_N; t++) e.trSpr[t].setVisible(false);
        for (var ti = 0; ti < e._tn; ti++) {
          var tr = e.trail[(e._tw - e._tn + ti) % this.ENEMY_TRAIL_N];
          var ts = e.trSpr[ti % this.ENEMY_TRAIL_N];
          ts.setPosition(tr.x, tr.y);
          ts.setRotation(tr.angle);
          ts.setAlpha((ti + 1) / (e._tn + 1) * 0.30);
          if (e.isMarked) ts.setTint(0x00ffff);
          else ts.clearTint();
          ts.setVisible(true);
        }
      }
    },

    _renderHUD: function () {
      var p = this.p, cam = this.cameras.main;
      var cx = cam.width / 2, h = cam.height;
      var c = getColors();

      this.hudGfx.clear();

      // Dash cooldown bar (only while recharging)
      if (!p.dashAvailable) {
        var bW = 80, bH = 4, bX = cx - 40, bY = h - 28;
        var f = p.state === 'DASHING' ? 0 : 1 - p.dashCooldown / DASH_CD;
        this.hudGfx.fillStyle(0xffffff, 0.10);
        this.hudGfx.fillRect(bX, bY, bW, bH);
        this.hudGfx.fillStyle(c.cyan, 0.8);
        this.hudGfx.fillRect(bX, bY, bW * f, bH);
      }

      // Score display — recentered each frame to handle resize
      var cx2 = cam.width / 2;
      this._scoreTxt.setPosition(cx2, 16);
      this._scoreTxt.setText(this.score);

      // Combo multiplier
      if (this.comboMultiplier > 1) {
        this._comboTxt.setPosition(cx2, 48);
        this._comboTxt.setText('x' + this.comboMultiplier);
        // Pulse animation on increment
        if (this._comboPulse > 0) {
          var ps = 1.0 + this._comboPulse * 0.45;
          this._comboTxt.setScale(ps);
          this._comboPulse = Math.max(0, this._comboPulse - 0.055);
        } else {
          this._comboTxt.setScale(1.0);
        }
        // Timer urgency: flash alpha when running low
        var comboRatio = this.comboTimer / 2000;
        var comboAlpha = comboRatio > 0.3 ? 0.95 : 0.35 + 0.6 * Math.abs(Math.sin(this.gameTime * Math.PI * 10));
        this._comboTxt.setAlpha(comboAlpha);
        // Color escalation
        if (this.comboMultiplier >= 50) this._comboTxt.setColor('#00ffff');
        else if (this.comboMultiplier >= 25) this._comboTxt.setColor('#ff6600');
        else if (this.comboMultiplier >= 10) this._comboTxt.setColor('#ffcc00');
        else this._comboTxt.setColor('#ffffff');
        // Combo timer bar centered under the multiplier text
        var timerW = 100;
        var timerCol = this.comboMultiplier >= 50 ? 0x00ffff : this.comboMultiplier >= 25 ? 0xff6600 : 0xffcc00;
        this.hudGfx.fillStyle(0xffffff, 0.08);
        this.hudGfx.fillRect(cx2 - timerW / 2, 76, timerW, 3);
        this.hudGfx.fillStyle(timerCol, 0.75);
        this.hudGfx.fillRect(cx2 - timerW / 2, 76, timerW * comboRatio, 3);
      } else {
        this._comboTxt.setAlpha(0);
      }
    },
  });

  /* ================================================================
     FACTORY
     ================================================================ */

  window.createLightGame = function (parentEl) {
    if (!parentEl) return null;
    var game = null;

    function start() {
      // Overlay _la-loading (long) pendant l’init WebGL ; la relance utilise _la-restart-loading dans create().
      var bgCol = getColors().bgColor;
      // Convert Phaser hex int to CSS hex string
      var bgCss = '#' + ('000000' + bgCol.toString(16)).slice(-6);
      if (!document.getElementById('_la-loading')) {
        var lo = document.createElement('div');
        lo.id = '_la-loading';
        lo.style.cssText = [
          'position:absolute', 'inset:0', 'z-index:80',
          'display:flex', 'align-items:center', 'justify-content:center',
          'background:' + bgCss,
          'pointer-events:none',
        ].join(';');
        lo.innerHTML =
          '<style>@keyframes _la-spin{to{transform:rotate(360deg)}}@keyframes _la-pulse{0%,100%{opacity:.5}50%{opacity:1}}</style>' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:1rem">' +
            '<div style="width:36px;height:36px;border:2.5px solid rgba(0,255,255,0.15);border-top-color:rgba(0,255,255,0.85);border-radius:50%;animation:_la-spin .7s linear infinite"></div>' +
            '<span style="font-family:monospace;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(0,255,255,0.45);animation:_la-pulse 1.4s ease-in-out infinite">Light Again</span>' +
          '</div>';
        parentEl.style.position = 'relative';
        parentEl.appendChild(lo);
      }

      game = new Phaser.Game({
        type: Phaser.WEBGL,
        parent: parentEl,
        width: parentEl.clientWidth,
        height: parentEl.clientHeight,
        backgroundColor: getColors().bgColor,
        transparent: false,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        input: {
          mouse: { preventDefaultDown: true, preventDefaultUp: true },
          keyboard: { target: window },
        },
        scene: [GameScene],
        disableContextMenu: true,
      });
    }

    function stop() {
      if (game) { game.destroy(true); game = null; }
    }

    function pause() {
      if (game && game.scene) game.scene.pause('GameScene');
    }

    function resume() {
      if (game && game.scene) game.scene.resume('GameScene');
    }

    return { start: start, stop: stop, pause: pause, resume: resume };
  };

})();

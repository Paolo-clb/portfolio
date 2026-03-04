/* ==========================================================================
   Rain Worker — ENHANCED edition
   Runs physics + rendering in a SEPARATE THREAD.
   
   Effects:
   • 160 rain drops with varying width & bright alpha
   • 5 splash particles per impact in TWO colors (rain + accent)
   • Ripple rings expanding on surface hits
   • Higher-res rendering (0.65) for crisp streaks
   ========================================================================== */

/* ── Configuration ──────────────────────────────────────── */
var MAX_DROPS    = 160;
var MAX_SPLASHES = 350;
var MAX_RIPPLES  = 60;
var DROP_MIN_SPD = 7;
var DROP_MAX_SPD = 14;
var DROP_W_MIN   = 1.2;
var DROP_W_MAX   = 2.4;
var SPLASH_PER   = 5;
var SPLASH_G     = 0.22;
var RES          = 0.65;

/* ── State ──────────────────────────────────────────────── */
var canvas, ctx;
var W = 0, H = 0;
var scrollY   = 0;
var running   = false;
var dropCount = 160;

var drops    = [];
var splashes = [];
var splashN  = 0;
var ripples  = [];
var rippleN  = 0;

var surfAbs  = [];

// Colors — 3 channels: rain, splash-primary, splash-accent
var rainRGB    = '220,220,240';
var splashRGB  = '242,200,190';
var accentRGB  = '180,210,255';   // blue-ish highlight for secondary splashlets

/* ── Drop pool ──────────────────────────────────────────── */
function resetDrop(d) {
  d.x   = Math.random() * W;
  d.y   = -(Math.random() * 100 + 10);
  d.vy  = DROP_MIN_SPD + Math.random() * (DROP_MAX_SPD - DROP_MIN_SPD);
  d.vx  = -0.7 + Math.random() * 1.4;
  d.len = d.vy * 1.2 + Math.random() * 5;
  d.w   = DROP_W_MIN + Math.random() * (DROP_W_MAX - DROP_W_MIN);
  d.a   = 0.35 + Math.random() * 0.4;
  d.bou = false;
  d.lif = 1;
  d._ca = 0;
}

function buildDrops(n) {
  drops.length = n;
  for (var i = 0; i < n; i++) {
    var d = drops[i] || {};
    resetDrop(d);
    d.y = -(Math.random() * H + 10);
    drops[i] = d;
  }
}

/* ── Splash pool (dual-color) ───────────────────────────── */
function buildSplashes() {
  splashes.length = MAX_SPLASHES;
  for (var i = 0; i < MAX_SPLASHES; i++)
    splashes[i] = splashes[i] || {x:0,y:0,vx:0,vy:0,lif:0,dec:0,r:0,acc:0};
  splashN = 0;
}

function spawnSplash(x, y) {
  for (var i = 0; i < SPLASH_PER; i++) {
    if (splashN >= MAX_SPLASHES) return;
    var s = splashes[splashN++];
    s.x = x + (-3 + Math.random() * 6);
    s.y = y;
    s.vx = -2.5 + Math.random() * 5;
    s.vy = -1.5 - Math.random() * 2.8;
    s.lif = 1;
    s.dec = 1 / (14 + Math.random() * 10);
    s.r = 0.8 + Math.random() * 1.4;
    s.acc = (i >= 3) ? 1 : 0;   // last 2 splashlets use accent color
  }
}

/* ── Ripple ring pool ───────────────────────────────────── */
function buildRipples() {
  ripples.length = MAX_RIPPLES;
  for (var i = 0; i < MAX_RIPPLES; i++)
    ripples[i] = ripples[i] || {x:0,y:0,r:0,maxR:0,lif:0,dec:0};
  rippleN = 0;
}

function spawnRipple(x, y) {
  if (rippleN >= MAX_RIPPLES) return;
  var rp = ripples[rippleN++];
  rp.x = x;
  rp.y = y;
  rp.r = 0;
  rp.maxR = 6 + Math.random() * 10;
  rp.lif = 1;
  rp.dec = 1 / (18 + Math.random() * 12);
}

/* ── Hit test ───────────────────────────────────────────── */
function hitSurface(x, tipY) {
  for (var i = 0, n = surfAbs.length; i < n; i++) {
    var s = surfAbs[i];
    var vTop = s.absTop - scrollY;
    var vBot = s.absBottom - scrollY;
    if (vBot < 0 || vTop > H) continue;
    if (x >= s.left && x <= s.right && tipY >= vTop && tipY <= vTop + 10)
      return vTop;
  }
  return -1;
}

/* ── Draw loop ──────────────────────────────────────────── */
function draw() {
  if (!running) return;
  requestAnimationFrame(draw);

  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.clearRect(0, 0, W, H);

  var i, d, a, vTop, count = drops.length;

  /* ── Physics ── */
  for (i = 0; i < count; i++) {
    d = drops[i];
    if (d.bou) {
      d.x += d.vx; d.y += d.vy;
      d.vy += SPLASH_G; d.lif -= 0.06;
      if (d.lif <= 0 || d.y > H + 10) resetDrop(d);
    } else {
      d.x += d.vx; d.y += d.vy;
      vTop = hitSurface(d.x, d.y + d.len);
      if (vTop >= 0) {
        d.y = vTop - d.len;
        spawnSplash(d.x, vTop);
        spawnRipple(d.x, vTop);
        d.bou = true;
        d.vy = -(Math.abs(d.vy) * (0.15 + Math.random() * 0.15));
        d.vx = -2 + Math.random() * 4;
        d.len *= 0.35; d.lif = 1;
      } else if (d.y > H + 10 || d.x < -10 || d.x > W + 10) {
        resetDrop(d);
      }
    }
    a = d.a * d.lif;
    d._ca = a >= 0.02 ? a : 0;
  }

  /* ── Drop drawing — 2 width groups × 3 alpha buckets ── */
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgb(' + rainRGB + ')';

  var bLo  = [0.02, 0.25, 0.48];
  var bHi  = [0.25, 0.48, 1.01];
  var bAlp = [0.18, 0.38, 0.58];

  // Thin drops (w < 1.8) then thick drops (w >= 1.8) — 2 lineWidth changes
  var wThresh = (DROP_W_MIN + DROP_W_MAX) * 0.5;
  var wVals   = [DROP_W_MIN + 0.15, DROP_W_MAX - 0.15];

  for (var wg = 0; wg < 2; wg++) {
    ctx.lineWidth = wVals[wg];
    for (var b = 0; b < 3; b++) {
      var lo = bLo[b], hi = bHi[b], has = false;
      ctx.globalAlpha = bAlp[b];
      ctx.beginPath();
      for (i = 0; i < count; i++) {
        d = drops[i]; a = d._ca;
        if (a < lo || a >= hi) continue;
        if (wg === 0 && d.w >= wThresh) continue;
        if (wg === 1 && d.w < wThresh) continue;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.vx * 0.35, d.y + d.len);
        has = true;
      }
      if (has) ctx.stroke();
    }
  }

  /* ── Ripple rings ── */
  if (rippleN > 0) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgb(' + accentRGB + ')';
    for (var k = rippleN - 1; k >= 0; k--) {
      var rp = ripples[k];
      rp.r += (rp.maxR - rp.r) * 0.12;
      rp.lif -= rp.dec;
      if (rp.lif <= 0) {
        rippleN--;
        if (k < rippleN) { var tmp = ripples[rippleN]; ripples[k] = tmp; ripples[rippleN] = rp; }
        continue;
      }
      ctx.globalAlpha = rp.lif * 0.35;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.35, 0, 0, 6.2832);
      ctx.stroke();
    }
  }

  /* ── Splash particles — dual color ── */
  if (splashN > 0) {
    // Physics pass
    for (var j = splashN - 1; j >= 0; j--) {
      var sp = splashes[j];
      sp.x += sp.vx; sp.y += sp.vy;
      sp.vy += SPLASH_G; sp.lif -= sp.dec;
      if (sp.lif <= 0) {
        splashN--;
        if (j < splashN) { var t2 = splashes[splashN]; splashes[j] = t2; splashes[splashN] = sp; }
      }
    }

    // Draw primary-color splashes (acc === 0)
    ctx.fillStyle = 'rgb(' + splashRGB + ')';
    // Bucket 1: bright
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    var hc = false;
    for (j = 0; j < splashN; j++) {
      sp = splashes[j];
      if (sp.acc || sp.lif < 0.45) continue;
      var r = sp.r * sp.lif;
      ctx.moveTo(sp.x + r, sp.y); ctx.arc(sp.x, sp.y, r, 0, 6.2832);
      hc = true;
    }
    if (hc) ctx.fill();
    // Bucket 2: dim
    ctx.globalAlpha = 0.22;
    ctx.beginPath(); hc = false;
    for (j = 0; j < splashN; j++) {
      sp = splashes[j];
      if (sp.acc || sp.lif >= 0.45 || sp.lif <= 0) continue;
      var r3 = sp.r * sp.lif;
      ctx.moveTo(sp.x + r3, sp.y); ctx.arc(sp.x, sp.y, r3, 0, 6.2832);
      hc = true;
    }
    if (hc) ctx.fill();

    // Draw accent-color splashes (acc === 1)
    ctx.fillStyle = 'rgb(' + accentRGB + ')';
    ctx.globalAlpha = 0.45;
    ctx.beginPath(); hc = false;
    for (j = 0; j < splashN; j++) {
      sp = splashes[j];
      if (!sp.acc || sp.lif < 0.4) continue;
      var r4 = sp.r * sp.lif;
      ctx.moveTo(sp.x + r4, sp.y); ctx.arc(sp.x, sp.y, r4, 0, 6.2832);
      hc = true;
    }
    if (hc) ctx.fill();
    ctx.globalAlpha = 0.16;
    ctx.beginPath(); hc = false;
    for (j = 0; j < splashN; j++) {
      sp = splashes[j];
      if (!sp.acc || sp.lif >= 0.4 || sp.lif <= 0) continue;
      var r5 = sp.r * sp.lif;
      ctx.moveTo(sp.x + r5, sp.y); ctx.arc(sp.x, sp.y, r5, 0, 6.2832);
      hc = true;
    }
    if (hc) ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/* ── Message handler ────────────────────────────────────── */
self.onmessage = function (e) {
  var msg = e.data;

  switch (msg.type) {
    case 'init':
      canvas = msg.canvas;
      ctx = canvas.getContext('2d');
      W = msg.width;
      H = msg.height;
      dropCount = msg.dropCount || MAX_DROPS;
      canvas.width  = Math.ceil(W * RES);
      canvas.height = Math.ceil(H * RES);
      break;

    case 'start':
      if (!canvas) return;
      running = true;
      scrollY = msg.scrollY || 0;
      buildDrops(dropCount);
      buildSplashes();
      buildRipples();
      requestAnimationFrame(draw);
      break;

    case 'stop':
      running = false;
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      splashN = 0;
      rippleN = 0;
      break;

    case 'scroll':
      scrollY = msg.scrollY;
      break;

    case 'resize':
      W = msg.width;
      H = msg.height;
      dropCount = msg.dropCount;
      if (canvas) {
        canvas.width  = Math.ceil(W * RES);
        canvas.height = Math.ceil(H * RES);
      }
      if (running) buildDrops(dropCount);
      break;

    case 'surfaces':
      surfAbs = msg.surfaces;
      break;

    case 'theme':
      var theme = msg.theme;
      if (theme === 'dark') {
        rainRGB   = '200,140,255';
        splashRGB = '220,160,255';
        accentRGB = '160,100,240';
      } else if (theme === 'nature') {
        rainRGB   = '120,210,240';
        splashRGB = '140,230,120';
        accentRGB = '90,200,200';
      } else {
        rainRGB   = '220,220,240';
        splashRGB = '242,200,190';
        accentRGB = '180,210,255';
      }
      break;
  }
};

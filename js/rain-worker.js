/* ==========================================================================
   Rain Worker — ENHANCED edition v2
   Runs physics + rendering in a SEPARATE THREAD.
   
   Effects:
   • 160 rain drops with varying width & bright alpha
   • 5 splash particles per impact — rain-colored
   • Ripple rings expanding on surface hits
   • Cursor halo bounce — drops deflect off cursor circle
   • Drain mode — drops finish falling gracefully on disable
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

// Cursor bounce
var CURSOR_R     = 22;   // halo ring radius (~38px CSS / 2 + margin)

/* ── State ──────────────────────────────────────────────── */
var canvas, ctx;
var W = 0, H = 0;
var scrollY   = 0;
var running   = false;
var draining  = false;  // true = no new drops, wait for all to exit
var dropCount = 160;

var drops    = [];
var splashes = [];
var splashN  = 0;
var ripples  = [];
var rippleN  = 0;

var surfAbs  = [];

// Cursor position (viewport coords, sent from main thread)
var curX = -999, curY = -999;

// Colors — uniform rain color for drops, splashes, and ripples
var rainRGB    = '220,220,240';

/* ── Drop pool ──────────────────────────────────────────── */
function resetDrop(d) {
  // In drain mode, mark drop as dead instead of recycling
  if (draining) { d.lif = 0; d._ca = 0; return; }
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

/* ── Splash pool ─────────────────────────────────────────── */
function buildSplashes() {
  splashes.length = MAX_SPLASHES;
  for (var i = 0; i < MAX_SPLASHES; i++)
    splashes[i] = splashes[i] || {x:0,y:0,vx:0,vy:0,lif:0,dec:0,r:0};
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
  rp.x = x; rp.y = y; rp.r = 0;
  rp.maxR = 6 + Math.random() * 10;
  rp.lif = 1;
  rp.dec = 1 / (18 + Math.random() * 12);
}

/* ── Cursor hit test ────────────────────────────────────── */
function hitCursor(x, tipY) {
  var dx = x - curX;
  var dy = tipY - curY;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < CURSOR_R) return dist;
  return -1;
}

/* ── Surface hit test ───────────────────────────────────── */
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

  // Check drain completion
  if (draining) {
    var alive = 0;
    for (i = 0; i < count; i++) if (drops[i].lif > 0) alive++;
    if (alive === 0 && splashN === 0 && rippleN === 0) {
      running = false;
      draining = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      self.postMessage({ type: 'drained' });
      return;
    }
  }

  /* ── Physics ── */
  for (i = 0; i < count; i++) {
    d = drops[i];
    if (d.lif <= 0) { d._ca = 0; continue; }

    if (d.bou) {
      d.x += d.vx; d.y += d.vy;
      d.vy += SPLASH_G; d.lif -= 0.06;
      if (d.lif <= 0 || d.y > H + 10) resetDrop(d);
    } else {
      d.x += d.vx; d.y += d.vy;

      // Cursor bounce
      var cDist = hitCursor(d.x, d.y + d.len);
      if (cDist >= 0 && cDist > 1) {
        var cdx = d.x - curX;
        var cdy = (d.y + d.len) - curY;
        var cn = Math.sqrt(cdx * cdx + cdy * cdy);
        d.vx = (cdx / cn) * 3.5 + (Math.random() - 0.5);
        d.vy = (cdy / cn) * 2.5;
        d.bou = true;
        d.len *= 0.4;
        d.lif = 0.8 + Math.random() * 0.2;
        spawnSplash(d.x, d.y + d.len);
        spawnRipple(d.x, d.y + d.len);
      } else {
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
    ctx.strokeStyle = 'rgb(' + rainRGB + ')';
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

    // Draw splashes — uniform rain color
    ctx.fillStyle = 'rgb(' + rainRGB + ')';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    var hc = false;
    for (j = 0; j < splashN; j++) {
      sp = splashes[j];
      if (sp.lif < 0.4) continue;
      var r = sp.r * sp.lif;
      ctx.moveTo(sp.x + r, sp.y); ctx.arc(sp.x, sp.y, r, 0, 6.2832);
      hc = true;
    }
    if (hc) ctx.fill();
    ctx.globalAlpha = 0.2;
    ctx.beginPath(); hc = false;
    for (j = 0; j < splashN; j++) {
      sp = splashes[j];
      if (sp.lif >= 0.4 || sp.lif <= 0) continue;
      var r3 = sp.r * sp.lif;
      ctx.moveTo(sp.x + r3, sp.y); ctx.arc(sp.x, sp.y, r3, 0, 6.2832);
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
      running  = true;
      draining = false;
      scrollY  = msg.scrollY || 0;
      buildDrops(dropCount);
      buildSplashes();
      buildRipples();
      requestAnimationFrame(draw);
      break;

    case 'stop':
      // Instant stop — clear everything
      running = false;
      draining = false;
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      splashN = 0;
      rippleN = 0;
      break;

    case 'drain':
      // Graceful stop — no new drops, let existing ones finish
      draining = true;
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
      if (running && !draining) buildDrops(dropCount);
      break;

    case 'surfaces':
      surfAbs = msg.surfaces;
      break;

    case 'cursor':
      curX = msg.x;
      curY = msg.y;
      break;

    case 'theme':
      var theme = msg.theme;
      if (theme === 'dark') {
        rainRGB   = '200,140,255';
      } else if (theme === 'nature') {
        rainRGB   = '120,210,240';
      } else {
        rainRGB   = '220,220,240';
      }
      break;
  }
};

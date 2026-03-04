/* ==========================================================================
   Rain Effect — OffscreenCanvas + Web Worker architecture v2
   
   Main thread (this file): creates canvas, button, toggle.
   Sends scroll / resize / surface / theme / cursor / click data to Worker.
   ALL physics + rendering run in a SEPARATE thread → zero main-thread cost.
   
   Features:
   • Cursor halo bounce — mouse position forwarded to Worker
   • Drain mode — disabling lets existing drops finish falling
   • Falls back to main-thread rendering if OffscreenCanvas unsupported
   ========================================================================== */
(function () {
  'use strict';

  /* ── Config ────────────────────────────────────────────── */
  var MAX_DROPS        = 160;
  var MAX_DROPS_MOBILE = 60;
  var STORAGE_KEY      = 'portfolio_rain';
  var SURFACE_RECALC_MS = 3000;
  var SURFACE_SELECTORS =
    '.project-card,.skills-group,.contact__form,.cv-section__card,.footer,.typing-game__text';

  /* ── State ─────────────────────────────────────────────── */
  var canvas, worker;
  var enabled   = false;
  var W = 0, H = 0;
  var dropCount;
  var btnEl;
  var surfRecalcTimer = null;
  var useWorker = false;

  /* ── Fallback state (main-thread, only used if no OffscreenCanvas) ── */
  var fbCtx, fbRafId;
  var fbDrops = [], fbSplashes = [], fbSplashN = 0;
  var fbSurfAbs = [];
  var fbScrollY = 0;
  var fbRainRGB = '220,220,240';
  var FB_RES = 0.5, FB_DROP_W = 1.8;

  /* ── Surface queries (main thread only — DOM access) ──── */
  function querySurfaces() {
    var els = document.querySelectorAll(SURFACE_SELECTORS);
    var sy  = window.pageYOffset || 0;
    var arr = [];
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      arr.push({
        absTop:    r.top + sy,
        absBottom: r.bottom + sy,
        left:      r.left,
        right:     r.right
      });
    }
    // Add umbrella button as bounce surface when rain is active (open dome)
    if (enabled && btnEl) {
      var br = btnEl.getBoundingClientRect();
      arr.push({
        absTop:    br.top + sy,
        absBottom: br.bottom + sy,
        left:      br.left,
        right:     br.right
      });
    }
    return arr;
  }

  function sendSurfaces() {
    var s = querySurfaces();
    if (useWorker && worker) {
      worker.postMessage({ type: 'surfaces', surfaces: s });
    } else {
      fbSurfAbs = s;
    }
  }

  /* ── Theme helper ──────────────────────────────────────── */
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function sendTheme() {
    var t = currentTheme();
    if (useWorker && worker) {
      worker.postMessage({ type: 'theme', theme: t });
    } else {
      if (t === 'dark')        { fbRainRGB='200,140,255'; }
      else if (t === 'nature') { fbRainRGB='120,210,240'; }
      else                     { fbRainRGB='220,220,240'; }
    }
  }

  /* ── Start / Stop ──────────────────────────────────────── */
  function start() {
    enabled = true;
    canvas.style.display = '';
    sendTheme();
    sendSurfaces();

    if (useWorker) {
      worker.postMessage({
        type: 'start',
        scrollY: window.pageYOffset || 0
      });
    } else {
      fbStart();
    }

    // Periodically refresh surface positions (layout may shift)
    surfRecalcTimer = setInterval(sendSurfaces, SURFACE_RECALC_MS);
  }

  function stop() {
    enabled = false;
    if (surfRecalcTimer) { clearInterval(surfRecalcTimer); surfRecalcTimer = null; }

    if (useWorker) {
      // Drain: stop spawning, let existing drops finish falling
      worker.postMessage({ type: 'drain' });
      // Worker will postMessage 'drained' when done → hide canvas
    } else {
      fbStop();
      canvas.style.display = 'none';
    }
  }

  /* ── Toggle ────────────────────────────────────────────── */
  function toggle() {
    if (enabled) {
      stop();
      btnEl.classList.remove('rain-toggle--active');
      localStorage.setItem(STORAGE_KEY, 'off');
    } else {
      start();
      btnEl.classList.add('rain-toggle--active');
      localStorage.setItem(STORAGE_KEY, 'on');
    }
  }

  /* ── Resize ────────────────────────────────────────────── */
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    dropCount = W < 600 ? MAX_DROPS_MOBILE : MAX_DROPS;

    if (useWorker) {
      worker.postMessage({
        type: 'resize',
        width: W,
        height: H,
        dropCount: dropCount
      });
    } else {
      if (canvas) {
        canvas.width  = Math.ceil(W * FB_RES);
        canvas.height = Math.ceil(H * FB_RES);
      }
      if (enabled) fbBuildDrops(dropCount);
    }

    if (enabled) sendSurfaces();
  }

  /* =======================================================================
     Umbrella SVG Button — reworked for better inactive visibility
     ======================================================================= */
  function createUmbrellaButton() {
    var btn = document.createElement('button');
    btn.className = 'rain-toggle';
    btn.setAttribute('aria-label', 'Toggle rain effect');
    btn.setAttribute('title', 'Pluie');
    // SVG umbrella: dome path morphs between closed (furled) and open via CSS d property
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
        '<path class="umbrella-dome" d="M12 2 C6.5 2 2 6.5 3 12 H21 C22 6.5 17.5 2 12 2 Z" fill="currentColor" fill-opacity="0.15" stroke-width="2"/>' +
        '<g class="umbrella-handle" stroke-width="2">' +
          '<line x1="12" y1="12" x2="12" y2="21"/>' +
          '<path d="M12 21c0 0-2 0-2-1.5S12 18 12 18" fill="none"/>' +
        '</g>' +
      '</svg>';

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    return btn;
  }

  function placeButton(btn) {
    var h2 = document.querySelector('#hero .section__title');
    if (!h2) return;
    // Create inline wrapper so button sits right next to the title text
    var row = document.createElement('div');
    row.className = 'hero__title-row';
    h2.parentNode.insertBefore(row, h2);
    row.appendChild(h2);
    row.appendChild(btn);
  }

  /* =======================================================================
     Fallback — main-thread rendering (only if OffscreenCanvas unavailable)
     Identical physics/batched-draw from the old IIFE, kept minimal.
     ======================================================================= */
  function fbResetDrop(d) {
    d.x=Math.random()*W; d.y=-(Math.random()*80+10);
    d.vy=7+Math.random()*6; d.vx=-0.5+Math.random();
    d.len=d.vy*1.1+Math.random()*4; d.a=0.3+Math.random()*0.35;
    d.bou=false; d.lif=1; d._ca=0;
  }
  function fbBuildDrops(n) {
    fbDrops.length=n;
    for(var i=0;i<n;i++){var d=fbDrops[i]||{};fbResetDrop(d);d.y=-(Math.random()*H+10);fbDrops[i]=d;}
  }
  function fbBuildSplashes() {
    fbSplashes.length=150;
    for(var i=0;i<150;i++) fbSplashes[i]=fbSplashes[i]||{x:0,y:0,vx:0,vy:0,lif:0,dec:0,r:0};
    fbSplashN=0;
  }
  function fbSpawnSplash(x,y) {
    for(var i=0;i<3;i++){if(fbSplashN>=150)return;var s=fbSplashes[fbSplashN++];
    s.x=x;s.y=y;s.vx=-2+Math.random()*4;s.vy=-1.2-Math.random()*2.2;s.lif=1;s.dec=1/(12+Math.random()*8);s.r=0.7+Math.random();}
  }
  function fbHitSurface(x,tipY,vy) {
    var pT=tipY-vy;
    for(var i=0,n=fbSurfAbs.length;i<n;i++){
      var s=fbSurfAbs[i],vT=s.absTop-fbScrollY;
      if(s.absBottom-fbScrollY<0||vT>H)continue;
      if(x>=s.left&&x<=s.right&&tipY>=vT&&pT<vT)return vT;
    } return -1;
  }
  function fbDraw() {
    if(!enabled){fbRafId=null;return;}
    fbRafId=requestAnimationFrame(fbDraw);
    var c=fbCtx; c.setTransform(FB_RES,0,0,FB_RES,0,0); c.clearRect(0,0,W,H);
    var i,d,a,vTop,count=fbDrops.length;
    for(i=0;i<count;i++){d=fbDrops[i];
      if(d.bou){d.x+=d.vx;d.y+=d.vy;d.vy+=0.25;d.lif-=0.07;if(d.lif<=0||d.y>H+10)fbResetDrop(d);}
      else{d.x+=d.vx;d.y+=d.vy;vTop=fbHitSurface(d.x,d.y+d.len,d.vy);
        if(vTop>=0){d.y=vTop-d.len;fbSpawnSplash(d.x,vTop);d.bou=true;d.vy=-(Math.abs(d.vy)*(0.12+Math.random()*0.12));d.vx=-1.5+Math.random()*3;d.len*=0.4;d.lif=1;}
        else if(d.y>H+10||d.x<-10||d.x>W+10)fbResetDrop(d);}
      a=d.a*d.lif;d._ca=a>=0.02?a:0;
    }
    c.lineCap='butt';c.lineWidth=FB_DROP_W;c.strokeStyle='rgb('+fbRainRGB+')';
    var bLo=[0.02,0.22,0.42],bHi=[0.22,0.42,1.01],bAl=[0.14,0.32,0.52];
    for(var b=0;b<3;b++){var lo=bLo[b],hi=bHi[b],has=false;c.globalAlpha=bAl[b];c.beginPath();
      for(i=0;i<count;i++){d=fbDrops[i];a=d._ca;if(a<lo||a>=hi)continue;c.moveTo(d.x,d.y);c.lineTo(d.x+d.vx*0.3,d.y+d.len);has=true;}
      if(has)c.stroke();}
    if(fbSplashN>0){ctx.fillStyle='rgb('+fbRainRGB+')';
      for(var j=fbSplashN-1;j>=0;j--){var sp=fbSplashes[j];sp.x+=sp.vx;sp.y+=sp.vy;sp.vy+=0.25;sp.lif-=sp.dec;
        if(sp.lif<=0){fbSplashN--;if(j<fbSplashN){var t=fbSplashes[fbSplashN];fbSplashes[j]=t;fbSplashes[fbSplashN]=sp;}}}
      c.globalAlpha=0.4;c.beginPath();var hc=false;
      for(j=0;j<fbSplashN;j++){sp=fbSplashes[j];if(sp.lif<0.5)continue;var r=sp.r*sp.lif;c.moveTo(sp.x+r,sp.y);c.arc(sp.x,sp.y,r,0,6.2832);hc=true;}
      if(hc)c.fill();
      c.globalAlpha=0.18;c.beginPath();hc=false;
      for(j=0;j<fbSplashN;j++){sp=fbSplashes[j];if(sp.lif>=0.5||sp.lif<=0)continue;var r2=sp.r*sp.lif;c.moveTo(sp.x+r2,sp.y);c.arc(sp.x,sp.y,r2,0,6.2832);hc=true;}
      if(hc)c.fill();}
    c.globalAlpha=1;
  }
  function fbStart() {
    fbScrollY=window.pageYOffset||0;
    fbBuildDrops(dropCount); fbBuildSplashes();
    sendTheme();
    if(!fbRafId) fbRafId=requestAnimationFrame(fbDraw);
  }
  function fbStop() {
    if(fbRafId){cancelAnimationFrame(fbRafId);fbRafId=null;}
    if(fbCtx){fbCtx.setTransform(1,0,0,1,0,0);fbCtx.clearRect(0,0,canvas.width,canvas.height);}
    fbSplashN=0;
  }

  /* =======================================================================
     Init
     ======================================================================= */
  function init() {
    W = window.innerWidth;
    H = window.innerHeight;
    dropCount = W < 600 ? MAX_DROPS_MOBILE : MAX_DROPS;

    // ── Create canvas ──
    canvas = document.createElement('canvas');
    canvas.className = 'rain-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.display = 'none';

    var tint = document.querySelector('.bg-tint-overlay');
    if (tint) tint.after(canvas);
    else document.body.insertBefore(canvas, document.body.firstChild);

    // ── Try OffscreenCanvas + Worker ──
    var canUseWorker = typeof canvas.transferControlToOffscreen === 'function';

    if (canUseWorker) {
      try {
        var offscreen = canvas.transferControlToOffscreen();
        worker = new Worker('js/rain-worker.js');
        worker.postMessage({
          type: 'init',
          canvas: offscreen,
          width: W,
          height: H,
          dropCount: dropCount
        }, [offscreen]);
        useWorker = true;

        // Listen for drain completion
        worker.onmessage = function (e) {
          if (e.data.type === 'drained') {
            canvas.style.display = 'none';
          }
        };
      } catch (err) {
        useWorker = false;
      }
    }

    // Fallback: main-thread context
    if (!useWorker) {
      canvas.width  = Math.ceil(W * FB_RES);
      canvas.height = Math.ceil(H * FB_RES);
      fbCtx = canvas.getContext('2d');
    }

    // ── Button ──
    btnEl = createUmbrellaButton();
    placeButton(btnEl);

    // ── Scroll → forward to worker (or cache for fallback) ──
    window.addEventListener('scroll', function () {
      var sy = window.pageYOffset || 0;
      if (useWorker && worker) {
        worker.postMessage({ type: 'scroll', scrollY: sy });
      } else {
        fbScrollY = sy;
      }
    }, { passive: true });

    // ── Mouse → forward cursor position to worker for halo bounce ──
    // Throttle: send at most every 16ms (~60fps) to avoid flooding
    var lastCursorSend = 0;
    document.addEventListener('mousemove', function (e) {
      if (!useWorker || !worker) return;
      var now = performance.now();
      if (now - lastCursorSend < 16) return;
      lastCursorSend = now;
      worker.postMessage({ type: 'cursor', x: e.clientX, y: e.clientY });
    }, { passive: true });

    // ── Resize ──
    window.addEventListener('resize', resize);

    // ── Theme change → forward to worker ──
    new MutationObserver(function () {
      sendTheme();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // ── Restore saved state ──
    if (localStorage.getItem(STORAGE_KEY) === 'on') {
      start();
      btnEl.classList.add('rain-toggle--active');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

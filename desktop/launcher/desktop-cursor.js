/* ==========================================================================
   Light Again desktop — custom cursor halo.

   A clean port of the portfolio's cursor (js/main.js initCursorHalo), trimmed
   to JUST the Light Again behaviour + generic buttons. A smooth ring + dot
   follow the native cursor; the ring grows and lights up (cyan, via
   desktop-overrides.css) to signal "this is clickable" — and, on the game
   canvas, when window.__lightGameAtkReady() reports an attack / left-click will
   actually trigger something. The native cursor is kept for aiming.

   Lives only in desktop/launcher/ — the portfolio is untouched.
   Reuses the .cursor-halo* CSS already shipped in css/styles.css.
   ========================================================================== */
(function () {
  'use strict';

  function init() {
    // No follower on touch devices
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (document.querySelector('.cursor-halo')) return; // guard double-init

    var halo = document.createElement('div'); halo.className = 'cursor-halo';
    var ring = document.createElement('div'); ring.className = 'cursor-halo__ring';
    var dot  = document.createElement('div'); dot.className  = 'cursor-halo__dot';
    halo.appendChild(ring); halo.appendChild(dot);
    document.body.appendChild(halo);

    var mouseX = -200, mouseY = -200;
    var ringX = -200, ringY = -200, dotX = -200, dotY = -200;
    var started = false, raf = null;
    var currentOpacity = 0, targetOpacity = 0;
    var opacitySpeed = 0.07;
    var pollId = null;                 // __lightGameAtkReady polling handle
    var lerpRing = 0.15, lerpDot = 0.30;

    function lerp(a, b, t) { return a + (b - a) * t; }

    function tick() {
      ringX = lerp(ringX, mouseX, lerpRing);
      ringY = lerp(ringY, mouseY, lerpRing);
      dotX  = lerp(dotX, mouseX, lerpDot);
      dotY  = lerp(dotY, mouseY, lerpDot);

      // Keep the dot tethered inside the ring
      var offX = dotX - ringX, offY = dotY - ringY;
      var dist = Math.sqrt(offX * offX + offY * offY), maxR = 14;
      if (dist > maxR) { var s = maxR / dist; dotX = ringX + offX * s; dotY = ringY + offY * s; }

      ring.style.transform = 'translate(-50%,-50%) translate3d(' + ringX + 'px,' + ringY + 'px,0)';
      dot.style.transform  = 'translate(-50%,-50%) translate3d(' + dotX  + 'px,' + dotY  + 'px,0)';

      if (currentOpacity !== targetOpacity) {
        currentOpacity = currentOpacity < targetOpacity
          ? Math.min(currentOpacity + opacitySpeed, targetOpacity)
          : Math.max(currentOpacity - opacitySpeed, targetOpacity);
        halo.style.opacity = String(Math.round(currentOpacity * 1000) / 1000);
      }
      if (currentOpacity <= 0 && targetOpacity <= 0) { halo.style.opacity = '0'; raf = null; return; }
      raf = requestAnimationFrame(tick);
    }
    function ensureRunning() { if (!raf) raf = requestAnimationFrame(tick); }

    // First move snaps the follower into place and reveals it
    document.addEventListener('mousemove', function onFirst(e) {
      mouseX = ringX = dotX = e.clientX;
      mouseY = ringY = dotY = e.clientY;
      started = true; targetOpacity = 1; ensureRunning();
      document.removeEventListener('mousemove', onFirst);
    });
    document.addEventListener('mousemove', function (e) { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });

    // Canvas attack-ready poll (steady 50 ms — independent of mouse motion)
    function startPoll() {
      if (pollId) return;
      pollId = setInterval(function () {
        var ready = typeof window.__lightGameAtkReady === 'function' && window.__lightGameAtkReady();
        if (ready) halo.classList.add('cursor-halo--hover');
        else       halo.classList.remove('cursor-halo--hover');
      }, 50);
    }
    function stopPoll() {
      if (pollId) { clearInterval(pollId); pollId = null; }
      halo.classList.remove('cursor-halo--hover');
    }

    document.addEventListener('mouseover', function (e) {
      var t = e.target;
      // Fullscreen overlay margins outside the panel → nothing clickable
      if (t.closest('.light-again-overlay') && !t.closest('.light-again-modal')) {
        stopPoll(); halo.classList.remove('cursor-halo--hover', 'cursor-halo--game'); return;
      }
      if (t.closest('.light-again-modal')) {
        halo.classList.add('cursor-halo--game');
        if (t.closest('button')) {
          // Upgrade/curse draft: only the cards and the enabled footer buttons are
          // clickable; a disabled Reroll stays inert. Chrome buttons (×, ?, pause)
          // are always hoverable.
          var inUpgrade = t.closest('#_la-upgrade-overlay');
          var clickableUp = t.closest('._la-up-card') || t.closest('._la-up-foot:not(:disabled)');
          stopPoll();
          if (inUpgrade && !clickableUp) halo.classList.remove('cursor-halo--hover');
          else halo.classList.add('cursor-halo--hover');
        } else if (t.closest('#_la-mode-select')) {
          // Mode-select menu: regular UI, not gameplay → normal ring (drop --game)
          stopPoll(); halo.classList.remove('cursor-halo--game');
          if (t.closest('.la-ms-card--enabled') || t.closest('.la-ms-steve') ||
              t.closest('.la-ms-resume-btn') || t.closest('.la-lo-chip'))
            halo.classList.add('cursor-halo--hover');
          else halo.classList.remove('cursor-halo--hover');
        } else if (t.closest('#_la-go-overlay')) {
          // Game-over panel: the Steve toggle, Big-text toggle + name input are non-button clickables
          stopPoll(); halo.classList.remove('cursor-halo--game');
          if (t.closest('#_la-go-steve-wrap') || t.closest('#_la-go-bigtext-wrap') || t.closest('#_la-go-name'))
            halo.classList.add('cursor-halo--hover');
          else halo.classList.remove('cursor-halo--hover');
        } else if (t.closest('#_la-upgrade-overlay')) {
          stopPoll(); halo.classList.remove('cursor-halo--hover');  // non-button area
        } else if (t.closest('.light-again-canvas')) {
          startPoll();                                              // gameplay → atk-ready poll
        } else if (t.closest('.light-again-help-overlay') && !t.closest('.light-again-help-popup')) {
          stopPoll(); halo.classList.add('cursor-halo--hover');     // backdrop closes help
        } else {
          stopPoll();
        }
        return;
      }
      // Anything else clickable (defensive — little exists outside the game here)
      if (t.closest('a, button, [role="button"], input, textarea')) halo.classList.add('cursor-halo--hover');
    }, { passive: true });

    document.addEventListener('mouseout', function (e) {
      var t = e.target, r = e.relatedTarget;
      if (t.closest('a, button, [role="button"], input, textarea')) halo.classList.remove('cursor-halo--hover');
      if (t.closest('.light-again-help-overlay') && !t.closest('.light-again-help-popup') &&
          !(r && r.closest('.light-again-help-overlay') && !r.closest('.light-again-help-popup')))
        halo.classList.remove('cursor-halo--hover');
      if (t.closest('.light-again-canvas') && !(r && r.closest('.light-again-canvas'))) stopPoll();
      if (t.closest('.light-again-modal') && !(r && r.closest('.light-again-modal'))) {
        stopPoll(); halo.classList.remove('cursor-halo--game');
      }
    }, { passive: true });

    // Click pulse
    document.addEventListener('mousedown', function () { halo.classList.add('cursor-halo--click'); });
    document.addEventListener('mouseup',   function () { halo.classList.remove('cursor-halo--click'); });

    // When the game overlay is torn down (e.g. Escape → menu reopen), reset state
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.removedNodes.forEach(function (n) {
          if (n.nodeType === 1 && n.classList && n.classList.contains('light-again-overlay')) {
            stopPoll(); halo.classList.remove('cursor-halo--game', 'cursor-halo--hover');
          }
        });
      });
    }).observe(document.body, { childList: true });

    // Hide when the pointer/window leaves, show on return
    document.documentElement.addEventListener('mouseleave', function () { if (started) { targetOpacity = 0; ensureRunning(); } });
    document.documentElement.addEventListener('mouseenter', function (e) {
      if (!started) return;
      mouseX = ringX = dotX = e.clientX; mouseY = ringY = dotY = e.clientY;
      targetOpacity = 1; ensureRunning();
    });
    window.addEventListener('blur', function () { if (started) { targetOpacity = 0; ensureRunning(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

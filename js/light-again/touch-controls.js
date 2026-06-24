/* ==========================================================================
   Light Again — On-screen TOUCH controls (mobile)  [scene methods]
   --------------------------------------------------------------------------
   Mobile-only. Reuses the SAME input abstraction as the gamepad (gamepad.js):
   we drive the movement vector (this._padMove), the aim unit vector
   (this._padAim) and the VIRTUAL cursor (this._mouseX/_mouseY) projected ahead
   of the ship, then call the same entry points (_tryAttack / _tryDash /
   _tryTimeStop). So every existing aim/attack path works with zero changes.

   Scheme (single-stick, like a phone twin-less shooter):
     • Left half  → a DYNAMIC movement joystick (appears where you touch).
                    Aim follows the movement direction (no separate aim stick).
     • Attack button (bottom-right) → tap fires; HOLD = autofire (throttled,
                    exactly like holding the gamepad's right stick).
     • Dash button.
     • The World button — shown only once unlocked; greys out + shows a radial
                    cooldown while recharging. Tap = time stop.

   Enabled only on touch-primary devices (pointer: coarse) or when forced via
   window.__laMobile (the mobile build can set it). On desktop it does nothing.
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var M  = LA.sceneMethods;
  var C  = LA.C;

  var STICK_MAX        = 64;    // px from the joystick centre to full deflection
  var STICK_DEAD       = 0.16;  // fraction of STICK_MAX ignored (dead centre)
  var TOUCH_AUTOFIRE_CD = 160;  // ms between auto-fires while the attack button is held

  // Touch-primary device? (the mobile build may also force it via window.__laMobile)
  function isTouchDevice() {
    if (window.__laMobile) return true;
    try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); }
    catch (e) { return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); }
  }

  /* ---------- icons (small inline SVGs, currentColor) ---------- */
  var SVG_ATK  = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>';
  var SVG_DASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 6 11 12 5 18"/><polyline points="12 6 18 12 12 18"/></svg>';
  var SVG_TW   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>';
  // Clear-board: an outward burst (reads as "sweep everything").
  var SVG_CLEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.1 5.1l2.1 2.1M16.8 16.8l2.1 2.1M18.9 5.1l-2.1 2.1M7.2 16.8l-2.1 2.1"/></svg>';

  /* ================================================================
     INIT — build the UI on a touch device (called from scene create)
     ================================================================ */
  M._initTouch = function () {
    this._touchUI = null;
    this._touch = {
      stickId: null, baseX: 0, baseY: 0, dx: 0, dy: 0,
      atkId: null, atkHeld: false, dashEdge: false, twEdge: false, autoFireCd: 0,
      spawnId: null,
    };
    if (!isTouchDevice()) return;
    this._buildTouchUI();
  };

  M._buildTouchUI = function () {
    var self = this;
    var host = (this.game && this.game.canvas && this.game.canvas.parentElement) || document.body;

    var root = document.createElement('div');
    root.className = 'la-touch';
    root.id = '_la-touch';

    var moveZone = document.createElement('div');
    moveZone.className = 'la-touch__movezone';

    var stick = document.createElement('div');
    stick.className = 'la-touch__stick';
    var nub = document.createElement('div');
    nub.className = 'la-touch__nub';
    stick.appendChild(nub);

    var btns = document.createElement('div');
    btns.className = 'la-touch__btns';

    var twBtn = document.createElement('button');
    twBtn.type = 'button';
    twBtn.className = 'la-touch__btn la-touch__tw';
    twBtn.innerHTML = '<span class="la-touch__glyph">' + SVG_TW + '</span><span class="la-touch__cdtxt"></span>';
    twBtn.style.display = 'none';   // shown once The World is unlocked

    var dashBtn = document.createElement('button');
    dashBtn.type = 'button';
    dashBtn.className = 'la-touch__btn la-touch__dash';
    dashBtn.innerHTML = '<span class="la-touch__glyph">' + SVG_DASH + '</span>';

    var atkBtn = document.createElement('button');
    atkBtn.type = 'button';
    atkBtn.className = 'la-touch__btn la-touch__atk';
    atkBtn.innerHTML = '<span class="la-touch__glyph">' + SVG_ATK + '</span>';

    btns.appendChild(twBtn);
    btns.appendChild(dashBtn);
    btns.appendChild(atkBtn);

    // --- Sandbox-only tools (mobile): a Clear-board button + a spawn-rate slider,
    //     so the wheel / Delete features (and therefore the final tutorial step)
    //     are reachable on touch. Shown only in sandbox by _updateTouchSandbox. ---
    var sandbox = document.createElement('div');
    sandbox.className = 'la-touch__sandbox';
    sandbox.style.display = 'none';

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'la-touch__btn la-touch__clear';
    clearBtn.innerHTML = '<span class="la-touch__glyph">' + SVG_CLEAR + '</span>';

    var spawn = document.createElement('div');
    spawn.className = 'la-touch__spawn';
    spawn.innerHTML = '<div class="la-touch__spawn-fill"></div>' +
                      '<div class="la-touch__spawn-val"></div>';

    sandbox.appendChild(clearBtn);
    sandbox.appendChild(spawn);

    // Joystick hint for the tutorial "Move" step — a pulsing ghost ring, lower-left.
    var moveHint = document.createElement('div');
    moveHint.className = 'la-touch__movehint';
    moveHint.style.display = 'none';

    root.appendChild(moveZone);
    root.appendChild(stick);
    root.appendChild(btns);
    root.appendChild(sandbox);
    root.appendChild(moveHint);
    host.appendChild(root);

    this._touchUI = { root: root, moveZone: moveZone, stick: stick, nub: nub,
                      tw: twBtn, dash: dashBtn, atk: atkBtn, twShown: false, twCdLast: -1,
                      sandbox: sandbox, clear: clearBtn, spawn: spawn,
                      spawnFill: spawn.querySelector('.la-touch__spawn-fill'),
                      spawnVal: spawn.querySelector('.la-touch__spawn-val'),
                      moveHint: moveHint, sandboxShown: false };

    var t = this._touch;

    /* ---- Joystick (dynamic, in the left move-zone) ---- */
    var rootRect = function () { return root.getBoundingClientRect(); };
    moveZone.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (t.stickId !== null) return;           // already tracking a stick touch
      var to = e.changedTouches[0];
      t.stickId = to.identifier;
      var r = rootRect();
      t.baseX = to.clientX - r.left; t.baseY = to.clientY - r.top;
      t.dx = 0; t.dy = 0;
      stick.style.left = t.baseX + 'px';
      stick.style.top  = t.baseY + 'px';
      stick.classList.add('la-touch__stick--on');
      nub.style.transform = 'translate(-50%,-50%)';
    }, { passive: false });

    moveZone.addEventListener('touchmove', function (e) {
      if (t.stickId === null) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var to = e.changedTouches[i];
        if (to.identifier !== t.stickId) continue;
        e.preventDefault();
        var r = rootRect();
        var vx = (to.clientX - r.left) - t.baseX;
        var vy = (to.clientY - r.top)  - t.baseY;
        var d = Math.sqrt(vx * vx + vy * vy);
        var cl = d > STICK_MAX ? STICK_MAX / d : 1;       // clamp to the ring
        var nx = vx * cl, ny = vy * cl;                   // nub offset in px
        nub.style.transform = 'translate(calc(-50% + ' + nx + 'px), calc(-50% + ' + ny + 'px))';
        var mag = Math.min(1, d / STICK_MAX);
        if (mag < STICK_DEAD) { t.dx = 0; t.dy = 0; }
        else {
          var k = (mag - STICK_DEAD) / (1 - STICK_DEAD);  // rescale past the deadzone
          var inv = d > 0 ? 1 / d : 0;
          t.dx = vx * inv * k; t.dy = vy * inv * k;
        }
        break;
      }
    }, { passive: false });

    var endStick = function (e) {
      if (t.stickId === null) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === t.stickId) {
          t.stickId = null; t.dx = 0; t.dy = 0;
          stick.classList.remove('la-touch__stick--on');
          break;
        }
      }
    };
    moveZone.addEventListener('touchend', endStick, { passive: false });
    moveZone.addEventListener('touchcancel', endStick, { passive: false });

    /* ---- Buttons (multi-touch friendly, tracked by identifier) ---- */
    atkBtn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      t.atkHeld = true; t.autoFireCd = 0;       // first shot fires immediately
      if (t.atkId === null) t.atkId = e.changedTouches[0].identifier;
      atkBtn.classList.add('la-touch__btn--press');
    }, { passive: false });
    var endAtk = function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === t.atkId) {
          t.atkId = null; t.atkHeld = false;
          atkBtn.classList.remove('la-touch__btn--press');
          return;
        }
      }
      // Fallback: if we somehow lost the id, releasing any touch here clears it.
      t.atkHeld = false; atkBtn.classList.remove('la-touch__btn--press');
    };
    atkBtn.addEventListener('touchend', endAtk, { passive: false });
    atkBtn.addEventListener('touchcancel', endAtk, { passive: false });

    var tapBtn = function (btn, set) {
      btn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        set();
        btn.classList.add('la-touch__btn--press');
      }, { passive: false });
      var up = function () { btn.classList.remove('la-touch__btn--press'); };
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('touchcancel', up, { passive: false });
    };
    tapBtn(dashBtn, function () { t.dashEdge = true; });
    tapBtn(twBtn,   function () { t.twEdge = true; });

    /* Clear-board button (sandbox only — gated exactly like Delete/Backspace in
       scene.js: blocked mid-tutorial except the final free-play step). */
    clearBtn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      clearBtn.classList.add('la-touch__btn--press');
      if (window.__laGameMode === 'sandbox' && (!self._tutorialActive || self._tutSandboxStep) &&
          self.p && self.p.state !== 'DEAD') {
        self._clearBoard();
      }
    }, { passive: false });
    var endClear = function () { clearBtn.classList.remove('la-touch__btn--press'); };
    clearBtn.addEventListener('touchend', endClear, { passive: false });
    clearBtn.addEventListener('touchcancel', endClear, { passive: false });

    /* Spawn-rate slider (sandbox only — mirrors the mouse wheel). Vertical: drag UP
       = faster. Widens (.is-active) while dragged. Sets _sandboxRate directly. */
    var setRate = function (clientY) {
      var r = spawn.getBoundingClientRect();
      if (r.height <= 0) return;
      var frac = 1 - (clientY - r.top) / r.height;
      frac = frac < 0 ? 0 : frac > 1 ? 1 : frac;
      self._sandboxRate = frac * (C.SANDBOX_RATE_MAX || 16);
      self._spdUiTimer  = C.SANDBOX_SPEED_UI_DUR;   // also flash the on-ship rate readout
    };
    spawn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      var to = e.changedTouches[0]; t.spawnId = to.identifier;
      spawn.classList.add('is-active');
      setRate(to.clientY);
    }, { passive: false });
    spawn.addEventListener('touchmove', function (e) {
      if (t.spawnId === null) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === t.spawnId) { e.preventDefault(); setRate(e.changedTouches[i].clientY); break; }
      }
    }, { passive: false });
    var endSpawn = function (e) {
      if (t.spawnId === null) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === t.spawnId) { t.spawnId = null; spawn.classList.remove('is-active'); break; }
      }
    };
    spawn.addEventListener('touchend', endSpawn, { passive: false });
    spawn.addEventListener('touchcancel', endSpawn, { passive: false });
  };

  M._destroyTouchUI = function () {
    if (this._touchUI && this._touchUI.root && this._touchUI.root.parentNode) {
      this._touchUI.root.parentNode.removeChild(this._touchUI.root);
    }
    this._touchUI = null;
  };

  /* ================================================================
     POLL — called each frame AFTER _pollGamepad (so it owns _padMove on
     mobile, where the gamepad poll finds no pad and zeroes it).
     ================================================================ */
  M._pollTouch = function () {
    var ui = this._touchUI; if (!ui) return;
    var t = this._touch;

    // A shell DOM menu/overlay is up → hide the controls (they'd intercept the
    // menu's own touches) and feed no input. Mirrors the gamepad stand-down.
    var menu = this._padMenuOverlayOpen ? this._padMenuOverlayOpen() : false;
    if (menu) {
      if (ui.root.style.display !== 'none') ui.root.style.display = 'none';
      this._padMove.dx = 0; this._padMove.dy = 0;
      t.atkHeld = false; t.dashEdge = false; t.twEdge = false; t.stickId = null;
      ui.stick.classList.remove('la-touch__stick--on');
      return;
    }
    if (ui.root.style.display === 'none') ui.root.style.display = '';

    // Movement from the joystick.
    this._padMove.dx = t.dx; this._padMove.dy = t.dy;
    // Aim follows the movement direction (single-stick); keep last aim when idle.
    var mag = Math.sqrt(t.dx * t.dx + t.dy * t.dy);
    if (mag > 0.01) { this._padAim.dx = t.dx / mag; this._padAim.dy = t.dy / mag; }
    this._padAimActive = false;
    this._inputMode = 'pad';

    // Project the virtual cursor ahead of the ship (same trick as the gamepad).
    if (this.p) {
      var cam = this.cameras.main, R = 320;
      this._mouseX = (this.p.x - cam.scrollX) + this._padAim.dx * R;
      this._mouseY = (this.p.y - cam.scrollY) + this._padAim.dy * R;
    }

    // Edge actions (the _tryX guards handle DEAD / cooldown / locked).
    if (t.dashEdge) { t.dashEdge = false; this._tryDash(); }
    if (t.twEdge)   { t.twEdge = false;   this._tryTimeStop(); }

    // Attack: held = autofire, throttled like the gamepad; immediate while DASHING
    // so the dash-attack (dash → attack) stays responsive.
    if (t.atkHeld) {
      var dashing = this.p && this.p.state === 'DASHING';
      t.autoFireCd -= (this._frameDt || 0.016) * 1000;
      if (dashing || t.autoFireCd <= 0) { this._tryAttack(); t.autoFireCd = TOUCH_AUTOFIRE_CD; }
    } else {
      t.autoFireCd = 0;
    }

    this._updateTouchTwButton();
    this._updateTouchSandbox();
  };

  /* The World button: shown only once unlocked; greyed with a radial cooldown
     wedge while recharging (and while time IS stopped). --cd = fraction of the
     cooldown REMAINING → the CSS conic wedge shrinks as it recharges. */
  M._updateTouchTwButton = function () {
    var ui = this._touchUI; if (!ui || !ui.tw) return;
    var unlocked = !!this._twUnlocked;
    if (ui.twShown !== unlocked) { ui.twShown = unlocked; ui.tw.style.display = unlocked ? '' : 'none'; }
    if (!unlocked) return;
    var max = C.TW_COOLDOWN || 1;
    var cd  = this._twActive ? max : (this._twCooldown || 0);   // active → show as fully "spent"
    var unavailable = this._twActive || (this._twCooldown || 0) > 0;
    var frac = Math.max(0, Math.min(1, cd / max));
    if (ui.twCdLast !== frac) {
      ui.twCdLast = frac;
      ui.tw.style.setProperty('--cd', String(frac));
      ui.tw.classList.toggle('la-touch__btn--cd', unavailable);
      var txtEl = ui.tw.querySelector('.la-touch__cdtxt');
      if (txtEl) txtEl.textContent = (unavailable && !this._twActive) ? Math.ceil((this._twCooldown || 0) / 1000) : '';
    }
  };

  /* Sandbox tools cluster: shown only in sandbox mode (and, during the tutorial,
     only on the final free-play step, matching the Clear-board gate). Keeps the
     slider's fill + value in sync with the live _sandboxRate. */
  M._updateTouchSandbox = function () {
    var ui = this._touchUI; if (!ui || !ui.sandbox) return;
    var on = window.__laGameMode === 'sandbox' && (!this._tutorialActive || this._tutSandboxStep);
    if (ui.sandboxShown !== on) { ui.sandboxShown = on; ui.sandbox.style.display = on ? '' : 'none'; }
    if (!on) return;
    var max = C.SANDBOX_RATE_MAX || 16;
    var r = this._sandboxRate || 0;
    var frac = Math.max(0, Math.min(1, r / max));
    if (ui.spawnFill) ui.spawnFill.style.height = (frac * 100) + '%';
    if (ui.spawnVal) ui.spawnVal.textContent = 'x' + (r % 1 === 0 ? String(r) : r.toFixed(1));
  };

  /* Tutorial: highlight the touch control(s) a step is teaching. `which` is a key
     or array of keys among 'move','atk','dash','tw','clear','spawn' (null clears).
     No-op off mobile / before the UI is built. */
  M._tutGlowTouch = function (which) {
    var ui = this._touchUI; if (!ui) return;
    var set = {};
    if (which) { (which.push ? which : [which]).forEach(function (w) { set[w] = true; }); }
    var map = { atk: ui.atk, dash: ui.dash, tw: ui.tw, clear: ui.clear, spawn: ui.spawn };
    for (var k in map) {
      if (map[k]) map[k].classList.toggle('la-touch__btn--glow', !!set[k]);
    }
    if (ui.moveHint) ui.moveHint.style.display = set.move ? '' : 'none';
  };

})();

/* ==========================================================================
   Light Again — Gamepad / Controller support (scene methods)
   --------------------------------------------------------------------------
   Twin-stick scheme (W3C "standard" mapping), polled every frame via the
   native navigator.getGamepads() API (no Phaser gamepad plugin needed):

     • Left stick  → movement (analog; fed into _inputVec).
     • Right stick → aim. When deflected, the arrow faces the right stick and
       the torpedo fires that way. When idle, aim falls back to the MOVEMENT
       direction (left stick) — slightly different from the mouse/keyboard feel,
       as requested.
     • Right trigger (RT) → torpedo (basic attack), launched along the aim dir.
     • Left  trigger (LT) → dash, launched along the movement direction.
     • Either small bumper (LB or RB) → The World (time stop).

   The trick: while the pad is the active device we drive the VIRTUAL cursor
   (this._mouseX/_mouseY) from the aim direction, projected onto the screen
   ahead of the ship. Every existing mouse-aim path (attack/dash-attack/prism/
   idle-facing) then aims at the stick with zero changes. Facing while MOVING is
   the one exception — handled explicitly in scene.js so the right stick can
   override the "movement = facing" rule (true twin-stick aiming).
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var M  = LA.sceneMethods;

  var STICK_DEAD = 0.24;   // left-stick radial deadzone
  var AIM_DEAD   = 0.30;   // right-stick deflection needed to take over aim
  var TRIG_ON    = 0.5;    // analog trigger press threshold
  var AUTOFIRE_CD = 160;   // ms between right-stick AUTO-fires (so a held stick can't out-click a human)

  // Standard-mapping button indices
  var BTN_LB = 4, BTN_RB = 5, BTN_LT = 6, BTN_RT = 7;
  // Right-side face buttons (A/B/X/Y · cross/circle/square/triangle) — sandbox Clear Board.
  var FACE_BTNS = [0, 1, 2, 3];
  // Left-side D-pad up/down — sandbox spawn-rate pacing (replaces the mouse wheel).
  var BTN_DUP = 12, BTN_DDOWN = 13;

  // Radial deadzone with edge rescaling: returns a vector whose magnitude is 0
  // at the deadzone edge and 1 at full deflection (so slow walks stay possible).
  function radialDead(x, y, dead) {
    var mag = Math.sqrt(x * x + y * y);
    if (mag < dead) return { x: 0, y: 0, mag: 0 };
    var scaled = (mag - dead) / (1 - dead);
    if (scaled > 1) scaled = 1;
    return { x: (x / mag) * scaled, y: (y / mag) * scaled, mag: scaled };
  }

  M._initGamepad = function () {
    this._padMove = { dx: 0, dy: 0 };   // left-stick movement (analog), read by _inputVec
    this._padAim  = { dx: 1, dy: 0 };   // last effective aim unit vector (defaults to +x)
    this._padAimActive = false;         // right stick currently deflected (facing override)
    // Edge-detection of the action buttons (fire on press, not while held).
    // dup/ddown = D-pad ↑/↓ (sandbox rate); face = any right-side face button (clear board).
    this._padPrev = { lt: false, rt: false, lb: false, rb: false, dup: false, ddown: false, face: false };
    this._padAutoFireCd = 0;   // ms left before the next right-stick auto-fire (throttle)
    // On the first poll after a (re)start, pause/resume, or a closed menu overlay,
    // re-sync _padPrev to whatever is held instead of firing — so a button still
    // pressed from the click/tap that launched or un-paused the run can't instantly
    // trigger an attack / dash / clear-board. (Set here + on the scene 'resume'
    // event in scene.js; the overlay-bail branch below re-arms it every frame.)
    this._padResync = true;
  };

  // True while a shell DOM menu/overlay (home menu, upgrade draft, game over,
  // help, tutorial confirm/complete) is on screen. The shell's own gamepad
  // navigator (shell.js) drives those; the in-scene poll stands down so a menu
  // button press can't ALSO fire a gameplay action behind the overlay.
  M._padMenuOverlayOpen = function () {
    return !!(document.getElementById('_la-upgrade-overlay') ||
              document.getElementById('_la-mode-select') ||
              document.getElementById('_la-go-overlay') ||
              document.getElementById('_la-tutorial-confirm') ||
              document.querySelector('.light-again-help-overlay') ||
              document.querySelector('.la-tut-complete'));
  };

  M._pollGamepad = function () {
    var pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    var gp = null, i;
    // Prefer a standard-mapping pad; otherwise take the first connected one.
    for (i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected && pads[i].mapping === 'standard') { gp = pads[i]; break; }
    }
    if (!gp) {
      for (i = 0; i < pads.length; i++) { if (pads[i] && pads[i].connected) { gp = pads[i]; break; } }
    }
    if (!gp) { this._padMove.dx = 0; this._padMove.dy = 0; this._padAimActive = false; return; }

    var ax = gp.axes || [];
    var lstick = radialDead(ax[0] || 0, ax[1] || 0, STICK_DEAD);
    var rstick = radialDead(ax[2] || 0, ax[3] || 0, AIM_DEAD);

    var btns = gp.buttons || [];
    function pressed(idx) { var b = btns[idx]; return !!b && (b.pressed || b.value > TRIG_ON); }
    var lt = pressed(BTN_LT), rt = pressed(BTN_RT), lb = pressed(BTN_LB), rb = pressed(BTN_RB);
    var dup   = pressed(BTN_DUP), ddown = pressed(BTN_DDOWN);
    var face  = pressed(FACE_BTNS[0]) || pressed(FACE_BTNS[1]) ||
                pressed(FACE_BTNS[2]) || pressed(FACE_BTNS[3]);
    var prev = this._padPrev;

    // A shell DOM menu/overlay owns the pad → the shell's gamepad navigator
    // handles it (focus + A/B + Home/Start toggle). Stand down here: freeze
    // movement/aim and keep _padPrev synced so the frame the overlay closes can
    // never fire a stale edge (and re-arm _padResync for that first live frame).
    if (this._padMenuOverlayOpen()) {
      this._padMove.dx = 0; this._padMove.dy = 0; this._padAimActive = false;
      prev.lt = lt; prev.rt = rt; prev.lb = lb; prev.rb = rb;
      prev.dup = dup; prev.ddown = ddown; prev.face = face;
      this._padResync = true;
      return;
    }
    // First live frame after a start / resume / closed overlay: adopt the held
    // buttons as the baseline (no edges this frame) so a button still pressed from
    // dismissing a menu doesn't immediately attack / dash / clear the board.
    if (this._padResync) {
      this._padResync = false;
      this._padMove.dx = lstick.x; this._padMove.dy = lstick.y;
      prev.lt = lt; prev.rt = rt; prev.lb = lb; prev.rb = rb;
      prev.dup = dup; prev.ddown = ddown; prev.face = face;
      this._padAutoFireCd = AUTOFIRE_CD;   // don't auto-fire the instant a menu closes while the stick is held
      return;
    }

    this._padMove.dx = lstick.x;
    this._padMove.dy = lstick.y;

    // Effective aim: right stick when deflected, else the movement direction,
    // else keep the previous aim (so holding still still fires forward).
    this._padAimActive = rstick.mag > 0;
    if (this._padAimActive) {
      var rl = Math.sqrt(rstick.x * rstick.x + rstick.y * rstick.y);
      this._padAim.dx = rstick.x / rl; this._padAim.dy = rstick.y / rl;
    } else if (lstick.mag > 0) {
      var ll = Math.sqrt(lstick.x * lstick.x + lstick.y * lstick.y);
      this._padAim.dx = lstick.x / ll; this._padAim.dy = lstick.y / ll;
    }

    // Any meaningful pad input makes the gamepad the active aiming device. The
    // pointermove handler flips this back to 'mouse' the moment the mouse moves.
    if (lstick.mag > 0 || rstick.mag > 0 || lt || rt || lb || rb) this._inputMode = 'pad';

    // While the pad drives input, project the aim onto the screen ahead of the
    // ship so all the existing mouse-aim code reads it. R cancels out for the
    // direction; it only needs to clear the idle-facing dead-zone check.
    if (this._inputMode === 'pad' && this.p) {
      var cam = this.cameras.main, R = 320;
      this._mouseX = (this.p.x - cam.scrollX) + this._padAim.dx * R;
      this._mouseY = (this.p.y - cam.scrollY) + this._padAim.dy * R;
    }

    // Edge-triggered actions (re-use the same entry points as mouse/keyboard, so
    // all their state guards — DEAD / cooldown / TW-locked — apply unchanged).
    if (rt && !prev.rt) this._tryAttack();                       // torpedo, along aim (manual, as before)
    if (lt && !prev.lt) this._tryDash();                         // dash, along movement
    if ((lb && !prev.lb) || (rb && !prev.rb)) this._tryTimeStop(); // The World

    // RIGHT-STICK = aim AND auto-fire. Deflecting the right stick faces the arrow
    // that way (via the aim/cursor above) AND fires the basic attack, like aiming
    // with the cursor and left-clicking. The auto-fire is THROTTLED to AUTOFIRE_CD
    // so a held stick can't out-click a human (firing every available frame felt
    // abusive). EXCEPTION: while DASHING, fire immediately (no throttle) so the
    // dash-attack — dash with LT, then flick the stick — stays responsive. The RT
    // button above is unthrottled (manual fire) for players who prefer it.
    if (this._padAimActive) {
      var padDashing = this.p && this.p.state === 'DASHING';
      this._padAutoFireCd -= (this._frameDt || 0.016) * 1000;
      if (padDashing || this._padAutoFireCd <= 0) {
        this._tryAttack();
        this._padAutoFireCd = AUTOFIRE_CD;
      }
    } else {
      this._padAutoFireCd = 0;   // idle → the next deflection fires instantly (responsive first shot)
    }

    // Sandbox-only controls (mirror the keyboard/wheel gates in scene.js):
    //  • D-pad ↑/↓ pace the spawn rate (like the mouse wheel) — sandbox only.
    //  • Any right-side face button sweeps the board (like Delete/Backspace) —
    //    sandbox only, blocked mid-tutorial except the final free-play step, alive.
    if (window.__laGameMode === 'sandbox') {
      if (dup   && !prev.dup)   this._adjustSandboxRate(1);
      if (ddown && !prev.ddown) this._adjustSandboxRate(-1);
      if (face  && !prev.face &&
          (!this._tutorialActive || this._tutSandboxStep) &&
          this.p && this.p.state !== 'DEAD') {
        this._clearBoard();
      }
    }

    prev.lt = lt; prev.rt = rt; prev.lb = lb; prev.rb = rb;
    prev.dup = dup; prev.ddown = ddown; prev.face = face;
  };

})();

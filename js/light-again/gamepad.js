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

    var btns = gp.buttons || [];
    function pressed(idx) { var b = btns[idx]; return !!b && (b.pressed || b.value > TRIG_ON); }
    var lt = pressed(BTN_LT), rt = pressed(BTN_RT), lb = pressed(BTN_LB), rb = pressed(BTN_RB);

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

    var dup   = pressed(BTN_DUP), ddown = pressed(BTN_DDOWN);
    var face  = pressed(FACE_BTNS[0]) || pressed(FACE_BTNS[1]) ||
                pressed(FACE_BTNS[2]) || pressed(FACE_BTNS[3]);

    // Edge-triggered actions (re-use the same entry points as mouse/keyboard, so
    // all their state guards — DEAD / cooldown / TW-locked — apply unchanged).
    var prev = this._padPrev;
    if (rt && !prev.rt) this._tryAttack();                       // torpedo, along aim
    if (lt && !prev.lt) this._tryDash();                         // dash, along movement
    if ((lb && !prev.lb) || (rb && !prev.rb)) this._tryTimeStop(); // The World

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

/* ==========================================================================
   Light Again — Interactive Tutorial (scene methods + DOM overlay)
   --------------------------------------------------------------------------
   Replaces the old static help popup with a guided, hands-on tutorial that
   runs INSIDE a sandbox session. Each step shows a big tooltip (action +
   keys) and a "quest" the player must actually perform to advance. The
   environment for every step is curated (one enemy / a small crowd / a star)
   so the lesson is isolated and self-healing (missing enemies respawn).

   Completing OR skipping the tutorial unlocks Hardcore mode + the "I am Steve"
   skin (see lootlocker.js → la_tutorial_done).

   Triggered from shell.js: first launch, the ? button, or a hardcore→sandbox
   switch all arm window.__laStartTutorialOnReady; scene.update() then calls
   _startTutorial() once the loader has cleared.
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  // Number of tutorial steps — kept in sync with the array in _tutBuildSteps.
  // Exposed so the home menu can render the progress bar without a live scene.
  LA.TUTORIAL_STEP_COUNT = 11;

  /* ---- language (mirror shell.js help popup) ---- */
  function tutFr() {
    try { return (localStorage.getItem('portfolio_lang') || 'fr') !== 'en'; }
    catch (e) { return true; }
  }

  function esc(s) { return LA.escHtml ? LA.escHtml(s) : String(s); }

  function buildKeysHtml(keys, fr) {
    var sep = '<span class="la-tut-or">' + (fr ? 'ou' : 'or') + '</span>';
    return keys.map(function (k) {
      return '<span class="la-tut-kbd">' + esc(k) + '</span>';
    }).join(sep);
  }

  /* ---- inject stylesheet once ---- */
  function ensureTutStyles() {
    if (document.getElementById('_la-tut-styles')) return;
    var st = document.createElement('style');
    st.id = '_la-tut-styles';
    st.textContent = [
      '@keyframes la-tut-in{from{opacity:0;transform:translate(-50%,14px)}to{opacity:1;transform:translate(-50%,0)}}',
      '@keyframes la-tut-pop{from{opacity:0;transform:translate(-50%,-46%) scale(.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}',

      '#_la-tut-overlay{position:absolute;inset:0;z-index:56;pointer-events:none;font-family:monospace;color:#e6f6ff}',

      /* Quest banner (top, under the score HUD) — a column: a header row
         (badge + title + progress) plus, on multi-goal steps, a sub-quest checklist. */
      '#_la-tut-overlay .la-tut-quest{position:absolute;top:6.2rem;left:50%;transform:translateX(-50%);' +
        'display:flex;flex-direction:column;align-items:center;gap:.45rem;' +
        'max-width:min(620px,92%);padding:.6rem 1.05rem;border-radius:12px;' +
        'background:transparent;border:1px solid var(--la-accent-soft);' +
        'text-align:center}',
      '#_la-tut-overlay .la-tut-quest-head{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;justify-content:center}',
      '#_la-tut-overlay .la-tut-quest.la-tut-done{border-color:rgba(61,220,132,.7);background:transparent}',
      '#_la-tut-overlay .la-tut-badge{font-size:calc(.56rem * var(--la-ui-scale));letter-spacing:.22em;font-weight:700;' +
        'padding:.18rem .5rem;border-radius:6px;background:var(--la-accent-fill);color:var(--la-accent);' +
        'border:1px solid var(--la-accent-soft);flex:none}',
      '#_la-tut-overlay .la-tut-done .la-tut-badge{background:rgba(61,220,132,.18);color:#3ddc84;border-color:rgba(61,220,132,.45)}',
      '#_la-tut-overlay .la-tut-quest-text{font-size:calc(.95rem * var(--la-ui-scale));font-weight:700;letter-spacing:.01em;color:#dff6ff;' +
        'text-shadow:0 1px 4px #000,0 0 9px rgba(0,0,0,.95)}',
      '#_la-tut-overlay .la-tut-progress{font-size:calc(.86rem * var(--la-ui-scale));font-weight:700;color:#ffcc00;letter-spacing:.05em}',

      /* Sub-quest checklist (multi-goal steps, e.g. the final sandbox step):
         one ticked-off line per goal so it's obvious BOTH must be done. */
      '#_la-tut-overlay .la-tut-subquests{display:flex;flex-direction:column;gap:.32rem;width:100%;margin-top:.05rem}',
      '#_la-tut-overlay .la-tut-subq{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;justify-content:center;' +
        'font-size:calc(.82rem * var(--la-ui-scale));font-weight:700;color:#bcd4e6;text-shadow:0 1px 4px #000,0 0 9px rgba(0,0,0,.95);' +
        'opacity:.9;transition:color .25s,opacity .25s}',
      '#_la-tut-overlay .la-tut-subq-ic{flex:none;width:1.15rem;height:1.15rem;line-height:1;display:inline-flex;' +
        'align-items:center;justify-content:center;border-radius:50%;font-size:.66rem;font-weight:800;' +
        'color:#7fb0c8;border:1.5px solid var(--la-accent-soft);background:var(--la-accent-faint)}',
      '#_la-tut-overlay .la-tut-subq-label b{color:#dff6ff}',
      '#_la-tut-overlay .la-tut-subq-label .c-dash{color:#00ffff}',
      '#_la-tut-overlay .la-tut-subq-label .c-shield{color:#00ffff}',
      '#_la-tut-overlay .la-tut-subq-prog{flex:none;font-size:calc(.78rem * var(--la-ui-scale));font-weight:700;color:#ffcc00;letter-spacing:.04em}',
      '#_la-tut-overlay .la-tut-subq .la-tut-kbd{padding:.13rem .4rem;font-size:calc(.71rem * var(--la-ui-scale));border-bottom-width:2px}',
      '#_la-tut-overlay .la-tut-subq-done{color:#9be8bf;opacity:1}',
      '#_la-tut-overlay .la-tut-subq-done .la-tut-subq-ic{color:#08160f;background:#3ddc84;border-color:#3ddc84}',
      '#_la-tut-overlay .la-tut-subq-done .la-tut-subq-prog{color:#3ddc84}',
      '@keyframes la-tut-subq-pop{0%{transform:scale(1)}40%{transform:scale(1.09)}100%{transform:scale(1)}}',
      '#_la-tut-overlay .la-tut-subq-pop{animation:la-tut-subq-pop .42s ease-out}',

      /* Combo-indicator highlight (combo step only) — a pulsing ring framing the
         on-canvas combo counter at the top, with a caption pointing at it. */
      '#_la-tut-overlay .la-tut-combo-cue{position:absolute;top:43px;left:50%;transform:translateX(-50%);' +
        'width:120px;height:36px;border-radius:11px;border:2px solid #ffcc00;pointer-events:none;' +
        'animation:la-tut-cue-pulse 1.05s ease-in-out infinite}',
      '#_la-tut-overlay .la-tut-combo-tag{position:absolute;left:100%;top:50%;transform:translateY(-50%);' +
        'margin-left:.55rem;white-space:nowrap;font-size:calc(.8rem * var(--la-ui-scale));font-weight:700;color:#ffcc00;' +
        'text-shadow:0 1px 4px #000,0 0 9px rgba(0,0,0,.95)}',
      '@keyframes la-tut-cue-pulse{0%,100%{opacity:.5;box-shadow:0 0 10px rgba(255,204,0,.4),inset 0 0 8px rgba(255,204,0,.16)}' +
        '50%{opacity:1;box-shadow:0 0 22px rgba(255,204,0,.85),inset 0 0 15px rgba(255,204,0,.32)}}',

      /* Big tooltip card (lower third) */
      '#_la-tut-overlay .la-tut-tip{position:absolute;left:50%;bottom:4.6rem;transform:translateX(-50%);' +
        'width:min(560px,92%);padding:1.05rem 1.3rem 1.15rem;border-radius:16px;text-align:center;' +
        'background:transparent;border:1px solid var(--la-accent-soft)}',
      '#_la-tut-overlay .la-tut-tip-title{font-size:calc(1.5rem * var(--la-ui-scale));font-weight:800;letter-spacing:.16em;' +
        'text-transform:uppercase;color:var(--la-accent);text-shadow:0 0 14px var(--la-accent-glow),0 2px 5px #000;margin-bottom:.7rem}',
      '#_la-tut-overlay .la-tut-keys{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;justify-content:center;margin-bottom:.7rem}',
      '#_la-tut-overlay .la-tut-kbd{display:inline-block;padding:.3rem .62rem;border-radius:7px;' +
        'background:var(--la-accent-fill);border:1px solid var(--la-accent-line);border-bottom-width:3px;' +
        'color:var(--la-accent);font-weight:700;font-size:calc(.82rem * var(--la-ui-scale));letter-spacing:.02em}',
      '#_la-tut-overlay .la-tut-or{opacity:.45;font-size:calc(.66rem * var(--la-ui-scale));margin:0 .1rem;letter-spacing:.1em}',
      '#_la-tut-overlay .la-tut-desc{font-size:calc(.82rem * var(--la-ui-scale));line-height:1.6;color:#bcd4e6;' +
        'text-shadow:0 1px 3px #000,0 0 7px rgba(0,0,0,.9)}',
      '#_la-tut-overlay .la-tut-desc b{color:#dff6ff}',
      '#_la-tut-overlay .la-tut-desc .c-dash{color:#00ffff}',
      '#_la-tut-overlay .la-tut-desc .c-datk{color:#ff14c8}',
      '#_la-tut-overlay .la-tut-desc .c-torp{color:#ff3b56}',
      '#_la-tut-overlay .la-tut-desc .c-shooter{color:#ffaa22}',
      '#_la-tut-overlay .la-tut-desc .c-mark{color:#2a9fd6}',
      '#_la-tut-overlay .la-tut-desc .c-shield{color:#00ffff}',
      '#_la-tut-overlay .la-tut-desc .c-combo{color:#ffcc00}',
      '#_la-tut-overlay .la-tut-desc .c-star{color:#ff14c8}',
      '#_la-tut-overlay .la-tut-desc .c-bruiser{color:#b066ff}',

      /* Animation helper for quest + tip */
      '#_la-tut-overlay .la-tut-anim{animation:la-tut-in .4s cubic-bezier(.22,1,.36,1) both}',

      /* Bottom controls */
      '#_la-tut-overlay .la-tut-controls{position:absolute;bottom:1rem;left:0;right:0;display:flex;' +
        'align-items:center;justify-content:center;gap:1rem;pointer-events:none}',
      '#_la-tut-overlay .la-tut-step{font-size:calc(.7rem * var(--la-ui-scale));letter-spacing:.18em;color:#6f93b8;font-weight:700}',
      '#_la-tut-overlay .la-tut-btn{pointer-events:auto;cursor:pointer;font-family:monospace;font-weight:700;' +
        'font-size:calc(.72rem * var(--la-ui-scale));letter-spacing:.08em;padding:.42rem .9rem;border-radius:8px;' +
        'background:rgba(8,12,28,.85);border:1px solid var(--la-accent-soft);color:#bdeaff;' +
        'transition:background .2s,border-color .2s,transform .15s}',
      '#_la-tut-overlay .la-tut-btn:hover{background:var(--la-accent-fill);border-color:var(--la-accent-line);transform:translateY(-1px)}',
      '#_la-tut-overlay .la-tut-skip{color:#d8b9c4;border-color:rgba(255,120,150,.3)}',
      '#_la-tut-overlay .la-tut-skip:hover{background:rgba(255,80,120,.12);border-color:rgba(255,120,150,.6)}',

      /* Completion celebration card */
      '#_la-tut-overlay .la-tut-complete{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' +
        'pointer-events:auto;width:min(440px,92%);padding:2rem 1.6rem 1.6rem;border-radius:18px;text-align:center;' +
        'background:linear-gradient(160deg,rgba(8,14,28,.96),rgba(14,10,26,.96));' +
        'border:1px solid var(--la-accent-soft);box-shadow:0 0 50px var(--la-accent-glow),inset 0 0 30px var(--la-accent-faint);' +
        'animation:la-tut-pop .45s cubic-bezier(.22,1,.36,1) both}',
      '#_la-tut-overlay .la-tut-complete-glyph{font-size:2.6rem;line-height:1;margin-bottom:.5rem}',
      '#_la-tut-overlay .la-tut-complete-title{font-size:calc(1.15rem * var(--la-ui-scale));font-weight:800;letter-spacing:.1em;' +
        'text-transform:uppercase;color:#5fe0cf;margin-bottom:1.1rem;text-shadow:0 0 16px rgba(95,224,207,.35)}',
      '#_la-tut-overlay .la-tut-unlock{display:flex;align-items:center;gap:.6rem;justify-content:center;' +
        'font-size:calc(.82rem * var(--la-ui-scale));color:#c8dceb;margin:.45rem 0}',
      '#_la-tut-overlay .la-tut-unlock b{color:#fff}',
      '#_la-tut-overlay .la-tut-unlock-ic{font-size:1.05rem;flex:none}',
      '#_la-tut-overlay .la-tut-complete-hint{font-size:calc(.66rem * var(--la-ui-scale));letter-spacing:.06em;color:#6f8aa0;margin:1.1rem 0 1.3rem}',
      '#_la-tut-overlay .la-tut-continue{pointer-events:auto;cursor:pointer;font-family:monospace;font-weight:800;' +
        'font-size:calc(.85rem * var(--la-ui-scale));letter-spacing:.12em;text-transform:uppercase;padding:.6rem 1.8rem;border-radius:10px;' +
        'background:var(--la-accent-fill);border:1.5px solid var(--la-accent-line);color:var(--la-accent);transition:transform .15s,box-shadow .2s,background .2s}',
      '#_la-tut-overlay .la-tut-continue:hover{transform:translateY(-2px);background:var(--la-accent-fill-hi);box-shadow:0 0 22px var(--la-accent-glow)}',

      '@media (max-width:560px){#_la-tut-overlay .la-tut-tip-title{font-size:calc(1.2rem * var(--la-ui-scale))}#_la-tut-overlay .la-tut-tip{bottom:3.6rem}}',
    ].join('');
    document.head.appendChild(st);
  }

  /* ================================================================
     INIT — called once in scene.create()
     ================================================================ */
  M._initTutorial = function () {
    this._tutorialActive   = false;
    this._tutData          = null;
    this._tutSteps         = null;
    this._tutStepIdx       = -1;
    this._tutTransitioning = false;
    this._tutEvents        = { nuke: 0, parade: 0, shieldBreak: 0, basicKill: 0, clear: 0 };
    this._tutDom           = null;
    this._tutLastProg      = undefined;
    this._tutDone          = false;
    // True only during the final free-play step — re-enables the sandbox-only
    // natural spawner + Clear Board (both gated off elsewhere while a tutorial runs).
    this._tutSandboxStep   = false;
    // True while the player has not yet acted on the current step — freezes enemy
    // AI (scene.js gates _updateEnemies on this) so reading is never punished.
    // Re-armed each step in _tutNext, cleared on the first player action, then
    // re-armed again on respawn (see _tutBurstT).
    this._tutEnemiesFrozen = false;
    // Seconds left in the post-respawn knockback window, during which enemies
    // stay live so they get flung away before the freeze re-latches. 0 = none.
    this._tutBurstT = 0;
    // true → skip/finish bounces back to the home menu; false → stays in the
    // live game (tutorial launched in-place via the ? button mid-run).
    // Re-armed on every scene (re)create so a restart (hardcore→sandbox switch,
    // ?-button restart) can still trigger the tutorial. _initTutorial runs in
    // create(), so this resets per scene lifecycle.
    this._tutArmChecked    = false;
    // Invalidates stale step-transition callbacks if the tutorial is relaunched.
    this._tutEpoch         = (this._tutEpoch || 0) + 1;
  };

  /* Event hook — called (guarded) from combat.js / projectiles.js so the
     tutorial can detect actions it can't infer from player state alone. */
  M._tutEvent = function (name) {
    if (!this._tutorialActive || !this._tutEvents) return;
    this._tutEvents[name] = (this._tutEvents[name] || 0) + 1;
  };

  /* ================================================================
     ENTER / EXIT
     ================================================================ */
  M._startTutorial = function (startStep) {
    ensureTutStyles();
    // Resume point: explicit arg wins, else the global armed by shell.js, else 0.
    if (startStep == null) startStep = window.__laTutorialStartStep || 0;
    window.__laTutorialStartStep = 0;
    // Finishing/skipping always continues straight into live sandbox play now, so
    // we no longer track whether the tutorial was launched from the home menu.
    window.__laTutorialFromHome  = false;
    this._tutorialActive = true;
    window.__laTutorialActive = true;
    if (typeof window.__laOnTutorialChange === 'function') window.__laOnTutorialChange(true);
    try { localStorage.setItem('la_tutorial_seen', '1'); } catch (e) { /* ignore */ }

    // Force sandbox rules (respawn on death) so the lesson is forgiving.
    window.__laGameMode = 'sandbox';

    // New run epoch — invalidates any pending step-transition callback from a
    // previous run (e.g. relaunched in place via ? during a transition).
    this._tutEpoch = (this._tutEpoch || 0) + 1;
    this._tutDone = false;

    // Purge any live mini-boss FIRST — the Anomaly / Giga-Bruiser live OUTSIDE
    // this.enemies, so _tutClearBoard alone would leave one roaming (and an
    // unfinished intro freezes the world → soft-lock). Clears their world state.
    if (this._clearAnomaly) this._clearAnomaly(true);
    if (this._clearGigaBruiser) this._clearGigaBruiser(true);
    if (this._clearMirror) this._clearMirror(true);
    if (this._clearSnake) this._clearSnake(true);
    if (this._clearCurseFount) this._clearCurseFount(true);   // also drop a live Curse Fountain
    if (this._clearDataHighways) this._clearDataHighways(true); // and any live Data Highway
    if (this._clearCacheZone) this._clearCacheZone(true);     // and any live Cache Zone (also lifts enemy rage)
    this._anomalyBarrierActive = false;
    this._anomalyIntroActive = false;
    this._anomalyCooldownT = 0;

    // Clean slate: clear the board, recenter the player, give a 2-shield buffer.
    this._tutClearBoard();
    // Defuse any in-flight time effects (hitstop / upgrade slow-mo) so the
    // lesson runs at normal speed even if launched mid-action from a live run.
    this.hitstopTimer = 0;
    this.timeScale = 1.0;
    this._upSlowMoPhase = null;
    this._upSlowMoTarget = 1.0;
    this._upgradeDraftOpen = false;
    // Also defuse a pending BOSS-defeat draft: a boss kill sets _bossDraftPending
    // (which suppresses natural spawns) ~1.3s before the overlay exists, so the ?
    // button can land mid-window. Without this, the flag would stay set forever and
    // permanently kill enemy spawns for the resumed run.
    this._bossDraftPending = false;
    this._draftPicksRemaining = 0;
    // Defuse the Curse Fountain too: a mid-ramp offer or an owed post-boss
    // respawn must not survive a tutorial relaunch (mirrors the boss-draft defuse).
    this._upCurseFountain   = false;
    this._curseFountainId   = null;
    this._fountRespawnQueued = false;
    this._fountBossHidden   = false;
    this._fountBossSeen     = false;
    this._fountBossKills    = 0;
    this._fountBossReq      = C.CURSE_FOUNT_BOSS_REQ_START;
    if (this._upSlowMoBanner) { this._upSlowMoBanner.destroy(); this._upSlowMoBanner = null; }
    this._tutResetPlayer();
    this.MAX_SHIELDS    = 2;
    this.playerShields  = 1;
    this.comboMultiplier = 1;
    this.comboTimer     = 0;
    this.spawnTimer     = 0;
    this._tutSandboxStep = false;
    this._tutEvents     = { nuke: 0, parade: 0, shieldBreak: 0, basicKill: 0, clear: 0 };
    this._tutLastProg   = undefined;

    this._tutBuildSteps();
    this._tutBuildDom();

    // Clamp the resume point into range; _tutNext increments first, so start at idx-1.
    var maxIdx = this._tutSteps.length - 1;
    startStep = Math.max(0, Math.min(startStep | 0, maxIdx));
    this._tutStepIdx = startStep - 1;
    this._tutTransitioning = false;
    this._tutData = { prevState: 'MOVING', poweredPrev: false };
    this._tutNext();
  };

  M._tutResetPlayer = function () {
    var p = this.p;
    if (!p) return;
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
    p.angle = 0; p.spinAngle = 0;
    p.state = 'MOVING';
    p.dashAvailable = true;  p.dashCooldown = 0; p.dashTimer = 0; p.dashHitCount = 0;
    p.atkAvailable  = true;  p.atkCooldown  = 0; p.atkTimer  = 0;
    p.recoveryTimer = 0; p.recoveryWhiff = false;
    p.hasHitDuringDashAttack = false; p.dashAtkExtended = 0;
    p.invincible = true; p.invincTimer = 1500; p.dashInvinc = false; p.dashCoyote = false;
    this.isStarPowered = false; this._starPowerTimer = 0; this._starPowerWarning = false; this._starPowerMax = 0;
    if (this.playerSpr) this.playerSpr.setVisible(true);
    var cam = this.cameras && this.cameras.main;
    if (cam) { cam.scrollX = p.x - cam.width / 2; cam.scrollY = p.y - cam.height / 2; }
  };

  // Silently remove every enemy, projectile and star pickup from the arena.
  M._tutClearBoard = function () {
    var i, t;
    if (this.enemies) {
      for (i = this.enemies.length - 1; i >= 0; i--) {
        var e = this.enemies[i];
        if (e.spr) e.spr.destroy();
        if (e.trSpr) for (t = 0; t < e.trSpr.length; t++) e.trSpr[t].destroy();
        if (e.shieldGfx) { e.shieldGfx.destroy(); e.shieldGfx = null; }
      }
      this.enemies.length = 0;
    }
    if (this.projectiles) {
      for (i = this.projectiles.length - 1; i >= 0; i--) this._destroyProjectile(this.projectiles[i]);
      this.projectiles.length = 0;
    }
    if (this._starPickups) {
      for (i = this._starPickups.length - 1; i >= 0; i--) {
        var s = this._starPickups[i];
        if (s && s.spr) { this.tweens.killTweensOf(s.spr); s.spr.destroy(); }
      }
      this._starPickups = [];
    }
  };

  M._tutEndMode = function () {
    this._tutorialActive = false;
    this._tutSandboxStep = false;
    this._tutEnemiesFrozen = false;
    this._tutBurstT = 0;
    window.__laTutorialActive = false;
    if (typeof window.__laOnTutorialChange === 'function') window.__laOnTutorialChange(false);

    var ov = document.getElementById('_la-tut-overlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    this._tutDom = null;
    this._tutData = null;
    this._tutSteps = null;
    this._tutStepIdx = -1;
    this._tutTransitioning = false;

    // Hand back to normal sandbox free-play. Restore the shield cap from any
    // owned upgrade level (don't clobber it to 1 — the tutorial may have been
    // launched mid-run by a player who already took the Shield upgrade).
    this._tutClearBoard();
    var shLvl = (this._upgradeLevels && this._upgradeLevels.shield) || 0;
    this.MAX_SHIELDS = 1 + shLvl;
    this.playerShields = Math.min(Math.max(1, this.playerShields), this.MAX_SHIELDS);
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.spawnTimer = 0;
    this._tutResetPlayer();
  };

  /* ================================================================
     SPAWN HELPERS (curated lesson environments)
     ================================================================ */
  // Straight "up" on screen (camera is y-down, so up is the -Y direction).
  // Tutorial enemies always spawn in a fan ABOVE the player so they never
  // encircle them and stay grouped in plain view while the player reads.
  var TUT_UP = -Math.PI / 2;
  // Pull every curated spawn a bit closer to the player than its nominal radius
  // so the group sits comfortably in view (not way up near the top edge).
  var TUT_DIST_SCALE = 0.78;

  // Force the just-spawned enemy fully visible NOW (skip the scale-up/fade-in
  // pop). Its spawn anim only advances inside _updateEnemies, which the tutorial
  // freezes while the player is still — without this, frozen enemies stay
  // invisible (scale/alpha 0) until the player first moves.
  M._tutRevealLast = function () {
    var e = this.enemies[this.enemies.length - 1];
    if (e) e._spawnAnimT = 1.0;
    return e || null;
  };

  M._tutSpawnOne = function (tier, dist) {
    if (this.enemies.length >= C.MAX_ENEMIES) return null;
    var ang = TUT_UP + (Math.random() - 0.5) * 0.7;   // small jitter around "up"
    var pos = this._spawnPosNear(ang, dist * TUT_DIST_SCALE, tier);
    this._spawnTierAt(tier, pos.x, pos.y);
    return this._tutRevealLast();
  };

  // A group fanned across an arc ABOVE the player. Spread angularly + in depth
  // so they read as distinct, spaced-out targets (enemy separation is frozen
  // with the rest of the AI, so their spawn layout is what the player sees).
  M._tutSpawnRing = function (tier, count, dist) {
    var SPREAD = 1.0;   // half-arc (~57° each side → ~114° fan above the player)
    for (var i = 0; i < count; i++) {
      if (this.enemies.length >= C.MAX_ENEMIES) break;
      var frac = count > 1 ? i / (count - 1) : 0.5;        // 0..1 across the fan
      var ang  = TUT_UP + (frac - 0.5) * 2 * SPREAD + (Math.random() - 0.5) * 0.14;
      var d    = dist * TUT_DIST_SCALE + (Math.random() - 0.5) * 90;  // depth variation → spacing
      var pos  = this._spawnPosNear(ang, d, tier);
      this._spawnTierAt(tier, pos.x, pos.y);
      this._tutRevealLast();
    }
  };

  M._tutCountTier = function (tier) {
    var n = 0;
    for (var i = 0; i < this.enemies.length; i++) if (this.enemies[i].tier === tier) n++;
    return n;
  };

  /* ================================================================
     STEP DEFINITIONS
     ================================================================ */
  M._tutBuildSteps = function () {
    var self = this;
    var fr = tutFr();
    var d  = function () { return self._tutData; };
    // Spawn-rate the player must scroll up to in the final step (≈ floods the
    // arena so the wheel's effect is obvious before the Clear Board payoff).
    var sandTarget = 3;

    this._tutSteps = [
      /* 0 — MOVE */
      {
        title: fr ? 'Déplacement' : 'Move',
        quest: fr ? 'Déplace-toi dans l’arène' : 'Move around the arena',
        keys:  fr ? ['Z Q S D', 'W A S D', 'Flèches'] : ['W A S D', 'Z Q S D', 'Arrows'],
        desc:  fr
          ? 'Bienvenue ! <b>Bouge</b> dans la direction des touches.'
          : 'Welcome! <b>Move</b> in the key direction.',
        setup: function () { d().moveT = 0; },
        check: function (dt) {
          var inp = self._inputVec();
          if (Math.abs(inp.dx) > 0.01 || Math.abs(inp.dy) > 0.01) d().moveT += dt;
          return d().moveT > 0.55;
        },
      },

      /* 1 — DASH */
      {
        title: 'Dash',
        quest: fr ? 'Réalise un dash' : 'Perform a dash',
        keys:  fr ? ['Maj', 'Espace', 'Clic droit'] : ['Shift', 'Space', 'Right click'],
        desc:  fr
          ? 'Le <span class="c-dash">dash</span> te propulse dans la direction de ton déplacement, avec une brève invincibilité.'
          : 'The <span class="c-dash">dash</span> launches you in your movement direction, with brief invincibility.',
        check: function () { return !!d().dashed; },
      },

      /* 2 — TORPEDO ATTACK */
      {
        title: fr ? 'Attaque Torpille' : 'Torpedo Attack',
        quest: fr ? 'Détruis l’éclaireur à l’attaque torpille' : 'Destroy the scout with the torpedo attack',
        keys:  fr ? ['Clic gauche'] : ['Left click'],
        desc:  fr
          ? 'L’<span class="c-torp">attaque torpille</span> : ta flèche fonce vers le curseur en rotation. Vise l’éclaireur <span class="c-torp">▲</span> ! <b>⚠️ La rater</b> te laisse vulnérable un instant (récupération).'
          : 'The <span class="c-torp">torpedo attack</span>: your arrow spins toward the cursor. Aim at the scout <span class="c-torp">▲</span>! <b>⚠️ Whiffing it</b> leaves you exposed for a moment (recovery).',
        setup: function () { self._tutSpawnOne(1, 340); },
        // Must be a BASIC-attack kill — killing it another way (e.g. dash-attack) does NOT count.
        check: function () { return self._tutEvents.basicKill - d().basicKill0 >= 1; },
        maintain: function () { if (self._tutCountTier(1) === 0) self._tutSpawnOne(1, 340); },
      },

      /* 3 — SPAM WAVE (basic-attack chaining) */
      {
        title: fr ? 'Vague' : 'Wave',
        quest: fr ? 'Enchaîne : élimine 5 éclaireurs à l’attaque' : 'Chain it: take out 5 scouts',
        keys:  fr ? ['Clic gauche  ×  spam'] : ['Left click  ×  spam'],
        desc:  fr
          ? 'Astuce clé : <b>chaque kill réarme aussitôt ton attaque</b>. Tu peux donc <b>spammer</b> l’<span class="c-torp">attaque torpille</span> à travers toute une vague d’éclaireurs <span class="c-torp">▲</span> sans temps mort !'
          : 'Key tip: <b>every kill instantly re-arms your attack</b>. So you can <b>spam</b> the <span class="c-torp">torpedo attack</span> through a whole scout wave <span class="c-torp">▲</span> with no downtime!',
        setup: function () { self._tutSpawnRing(1, 9, 320); },
        progress: function () { return Math.min(5, self._tutEvents.basicKill - d().basicKill0) + ' / 5'; },
        // Only basic-attack kills count toward the chain (teaches the reset-on-kill loop).
        check: function () { return (self._tutEvents.basicKill - d().basicKill0) >= 5; },
        maintain: function () { if (self._tutCountTier(1) < 5) self._tutSpawnRing(1, 6, 320); },
      },

      /* 4 — DASH-ATTACK */
      {
        title: fr ? 'Dash-Attaque' : 'Dash-Attack',
        quest: fr ? 'Touche l’éclaireur avec une dash-attaque' : 'Hit the scout with a dash-attack',
        keys:  fr ? ['Clic gauche  (pendant un dash)'] : ['Left click  (during a dash)'],
        desc:  fr
          ? 'Clique pendant un <span class="c-dash">dash</span> : la <span class="c-datk">dash-attaque</span> est plus rapide, plus large, et traverse les ennemis. <b>⚠️ Récupération plus longue qu’une attaque ratée.'
          : 'Click during a <span class="c-dash">dash</span>: the <span class="c-datk">dash-attack</span> is faster, wider, and pierces enemies. <b>⚠️ A longer recovery than a missed attack.',
        setup: function () { self._tutSpawnOne(1, 360); },
        check: function () { return !!d().dashAtkHit; },
        maintain: function () { if (self._tutCountTier(1) === 0) self._tutSpawnOne(1, 360); },
      },

      /* 5 — MARK + NUKE */
      {
        title: fr ? 'Marque & Détonation' : 'Mark & Detonation',
        quest: fr ? 'Marque un ennemi au dash, puis fais-le détoner' : 'Mark an enemy on a dash, then detonate it',
        keys:  fr ? ['Dash  →  torpille torpille'] : ['Dash  →  torpedo-attack'],
        desc:  fr
          ? '<span class="c-dash">Dashe</span> À TRAVERS un ennemi pour le <span class="c-mark">marquer</span> (étincelles bleues), puis fais une <span class="c-torp">attaque torpille</span> dessus → <span class="c-shield">NUKE</span> à zone d’effet ! (⚠️ La dash-attaque ne déclenche pas la nuke.)'
          : '<span class="c-dash">Dash</span> THROUGH an enemy to <span class="c-mark">mark</span> it (blue sparks), then <span class="c-torp">torpedo-attack</span> it → AoE <span class="c-shield">NUKE</span>! (⚠️ Dash-attack does NOT trigger it.)',
        setup: function () { d().nuke0 = self._tutEvents.nuke; self._tutSpawnRing(1, 6, 230); },
        check: function () { return self._tutEvents.nuke > d().nuke0; },
        maintain: function () { if (self._tutCountTier(1) < 3) self._tutSpawnRing(1, 5, 230); },
      },

      /* 6 — COMBO → SHIELD */
      {
        title: fr ? 'Combo & Bouclier' : 'Combo & Shield',
        quest: fr ? 'Atteins un combo x10 pour gagner un bouclier' : 'Reach a x10 combo to earn a shield',
        keys:  null,
        highlightCombo: true,   // point the player at the combo counter up top
        desc:  fr
          ? 'Tue sans t’arrêter : chaque kill monte le <span class="c-combo">combo</span>. À <span class="c-combo">x10</span>, tu gagnes un <span class="c-shield">bouclier</span> (absorbe un coup).'
          : 'Keep killing: each kill raises the <span class="c-combo">combo</span>. At <span class="c-combo">x10</span> you earn a <span class="c-shield">shield</span> (absorbs one hit).',
        setup: function () {
          self.comboMultiplier = 1; self.comboTimer = 0;
          self.MAX_SHIELDS = 2; self.playerShields = 1;
          self._tutSpawnRing(1, 12, 300);
        },
        progress: function () { return 'x' + self.comboMultiplier; },
        // Reaching x10 IS the lesson (and grants the shield). Keyed on the combo,
        // not the shield count — getting hit mid-chain consumes the shield, so a
        // shield-count check could never become true (soft-lock).
        check: function () { return self.comboMultiplier >= 10; },
        maintain: function () { if (self._tutCountTier(1) < 6) self._tutSpawnRing(1, 8, 320); },
      },

      /* 7 — STAR POWER (the "bonus dash attack") */
      {
        title: fr ? 'Star Power' : 'Star Power',
        quest: fr ? 'Ramasse l’étoile et pulvérise 3 ennemis' : 'Grab the star and smash 3 enemies',
        keys:  fr ? ['Clic gauche  (survolté)'] : ['Left click  (overdriven)'],
        desc:  fr
          ? 'Au contract de l’<span class="c-star">étoile bonus</span> : ton attaque devient un <span class="c-datk">dash-attaque spammable</span>. Fonce dans le tas !'
          : 'The <span class="c-star">bonus star</span> overdrives you : your attack becomes a <span class="c-datk">spammable dash-attack</span>. Go wild!',
        setup: function () {
          self._tutSpawnRing(1, 8, 300);
          self._spawnStar(self.p.x + 120, self.p.y - 40);
          d().everPowered = self.isStarPowered;
          d().powerKills0 = self.totalKills;
          d().poweredPrev = self.isStarPowered;
        },
        progress: function () {
          if (!d().everPowered) return fr ? '★ ?' : '★ ?';
          var n = Math.min(3, self.totalKills - d().powerKills0);
          return n + ' / 3';
        },
        check: function () {
          return d().everPowered && (self.totalKills - d().powerKills0) >= 3;
        },
        maintain: function () {
          // Re-arm the star if it expired before pickup / before the goal.
          if (!self.isStarPowered && (!d().everPowered || (self.totalKills - d().powerKills0) < 3)) {
            var hasStar = self._starPickups && self._starPickups.length > 0;
            if (!hasStar) self._spawnStar(self.p.x + 120, self.p.y - 40);
          }
          if (self._tutCountTier(1) < 4) self._tutSpawnRing(1, 6, 300);
        },
      },

      /* 8 — PARADE (reflect T2 projectile) */
      {
        title: fr ? 'Parade' : 'Parry',
        quest: fr ? 'Renvoie le projectile du Tireur' : 'Reflect the Shooter’s projectile',
        keys:  fr ? ['Dash-attaque sur le projectile'] : ['Dash-attack onto the projectile'],
        desc:  fr
          ? 'Le Tireur <span class="c-shooter">◆</span> garde ses distances et tire. Un <span class="c-datk">dash-attaque</span> sur un projectile le <span class="c-datk">renvoie</span> à l’envoyeur (<span class="c-combo">x2 points</span>). ⚠️ L’attaque simple ne renvoie pas.'
          : 'The Shooter <span class="c-shooter">◆</span> keeps its distance and fires. A <span class="c-datk">dash-attack</span> on a projectile <span class="c-datk">reflects</span> it back (<span class="c-combo">x2 points</span>). ⚠️ The basic attack does not.',
        setup: function () {
          d().parade0 = self._tutEvents.parade;
          var e = self._tutSpawnOne(2, 430);
          if (e) e.fireCD = 700;
        },
        check: function () { return self._tutEvents.parade > d().parade0; },
        maintain: function () {
          var sh = null;
          for (var i = 0; i < self.enemies.length; i++) { if (self.enemies[i].tier === 2) { sh = self.enemies[i]; break; } }
          if (!sh) { var ne = self._tutSpawnOne(2, 430); if (ne) ne.fireCD = 700; }
          else if (sh.fireCD > 1600) sh.fireCD = 1200;
        },
      },

      /* 9 — BRUISER (break shield) */
      {
        title: fr ? 'Bruiser' : 'Bruiser',
        quest: fr ? 'Brise le bouclier du Bruiser et achève-le' : 'Break the Bruiser’s shield and finish it',
        keys:  fr ? ['Dash-attaque  →  brise le bouclier'] : ['Dash-attack  →  break the shield'],
        desc:  fr
          ? 'Le <span class="c-bruiser">Bruiser ⬢</span> a un <span class="c-shield">bouclier</span> que seule la <span class="c-datk">dash-attaque</span> brise, puis achève-le. Astuce : <span class="c-mark">marque-le</span> au dash puis <span class="c-shield">NUKE</span> — one shot !'
          : 'The <span class="c-bruiser">Bruiser ⬢</span> has a <span class="c-shield">shield</span> only the <span class="c-datk">dash-attack</span> can break — then finish it. Tip: <span class="c-mark">mark it</span> on a dash then <span class="c-shield">NUKE</span> — one shot !',
        setup: function () { d().bruiser = self._tutSpawnOne(3, 360); },
        check: function () {
          var b = d().bruiser;
          return !!b && self.enemies.indexOf(b) === -1;
        },
        maintain: function () {
          if (!d().bruiser || self.enemies.indexOf(d().bruiser) === -1) {
            // Only (re)spawn if it never appeared — once it dies, check() wins first.
            if (!d().bruiser) d().bruiser = self._tutSpawnOne(3, 360);
          }
        },
      },

      /* 10 — SANDBOX TOOLS — two quests in one step: pace the spawn rate with the
         mouse wheel, then sweep the board with Delete / Backspace. Both are
         sandbox-only and normally gated OFF mid-tutorial; _tutSandboxStep re-opens
         them (and the real natural spawner) just for this final free-play step. */
      {
        title: fr ? 'Sandbox' : 'Sandbox',
        // Free play: never freeze enemies — the live spawner is the whole lesson,
        // and the quest (wheel + Clear) doesn't require moving.
        noFreeze: true,
        quest: fr ? 'Les 2 outils du bac à sable' : 'The 2 sandbox tools',
        keys:  fr ? ['Molette ↑', 'Suppr / Retour arrière'] : ['Wheel ↑', 'Delete / Backspace'],
        desc:  fr
          ? 'Outils <b>bac à sable</b> : la <span class="c-dash">molette</span> <b>accélère</b> (↑) ou calme (↓) l’apparition des ennemis. <span class="c-shield">Suppr</span> ou <span class="c-shield">Retour arrière</span> déclenche une onde qui <b>balaie l’arène</b> — sans points.'
          : 'Sandbox-only tools : the <span class="c-dash">mouse wheel</span> <b>speeds up</b> (↑) or calms (↓) enemy spawns. <span class="c-shield">Delete</span> or <span class="c-shield">Backspace</span> fires a wave that <b>sweeps the arena</b> — no points.',
        setup: function () {
          // Free play: let the REAL sandbox spawner run (paced live by the wheel)
          // and re-enable Clear Board for this step only.
          self._tutSandboxStep = true;
          self._sandboxRate = C.SANDBOX_RATE_DEFAULT;  // back to x1 so the speed-up is felt
          self._spdUiTimer  = C.SANDBOX_SPEED_UI_DUR;  // flash the speed slider into view
          self.spawnTimer   = 0;
          d().clear0      = self._tutEvents.clear || 0;
          d().sandSped    = false;
          d().sandCleared = false;
          self._tutSpawnRing(1, 4, 320);              // a few starters to multiply
        },
        // Two explicit, separately-ticked sub-quests so it's unmistakable that
        // BOTH must be done: pace the spawns UP with the wheel, AND sweep the
        // board with Delete/Backspace. Rendered as a checklist under the header.
        subQuests: [
          {
            label: fr ? 'Accélère l’apparition à la <span class="c-dash">molette</span>'
                      : 'Speed up the spawns with the <span class="c-dash">wheel</span>',
            keys:  fr ? ['Molette ↑'] : ['Wheel ↑'],
            prog:  function () {
              var r = self._sandboxRate;
              var rateStr = (r % 1 === 0) ? String(r) : r.toFixed(1);
              return 'x' + rateStr + ' / x' + sandTarget;
            },
            done:  function () { return !!d().sandSped; },
          },
          {
            label: fr ? 'Balaie toute l’arène d’un coup' : 'Sweep the whole arena at once',
            keys:  fr ? ['Suppr', 'Retour arrière'] : ['Delete', 'Backspace'],
            done:  function () { return !!d().sandCleared; },
          },
        ],
        // Two sticky goals; the step clears once BOTH are satisfied.
        maintain: function () {
          var dd = d();
          if (self._sandboxRate >= sandTarget) dd.sandSped = true;
          if ((self._tutEvents.clear || 0) > dd.clear0) dd.sandCleared = true;
        },
        check: function () {
          var dd = d();
          return !!dd.sandSped && !!dd.sandCleared;
        },
      },
    ];
  };

  /* ================================================================
     PER-FRAME UPDATE — called from scene.update()
     ================================================================ */
  // True the moment the player does anything — moves, dashes, or attacks. Used
  // to thaw the frozen enemies on a step's (or a respawn's) first input.
  M._tutPlayerActed = function (p) {
    var inp = this._inputVec();
    if (Math.abs(inp.dx) > 0.01 || Math.abs(inp.dy) > 0.01) return true;
    return p.state === 'DASHING' || p.state === 'DASH_ATTACKING' ||
           p.state === 'ATTACKING' || p.state === 'RECOVERY';
  };

  M._tutTrack = function (dt) {
    var p = this.p, d = this._tutData;
    if (!p || !d) return;
    // Freeze model: enemies spawn but hold still until the player's FIRST input
    // on the step. Once that input lands they activate and STAY active (they do
    // NOT re-freeze when the player stops). Dying re-arms the freeze: the respawn
    // knockback shoves enemies away (burst window below), then they hold again
    // and wait for a fresh input — exactly like a fresh step start. The sandbox
    // free-play step opts out (noFreeze) and always runs live.
    var step = this._tutSteps && this._tutSteps[this._tutStepIdx];
    if (step && step.noFreeze) {
      this._tutEnemiesFrozen = false;
    } else if (this._tutBurstT > 0) {
      // Respawn knockback: keep enemies live just long enough to be flung back,
      // then latch the freeze on so they wait for the next input.
      this._tutBurstT -= dt;
      this._tutEnemiesFrozen = false;
      if (this._tutBurstT <= 0) { this._tutBurstT = 0; this._tutEnemiesFrozen = true; }
    } else if (this._tutEnemiesFrozen && this._tutPlayerActed(p)) {
      this._tutEnemiesFrozen = false;
    }
    if (p.state === 'DASHING' && d.prevState !== 'DASHING') d.dashed = true;
    if (p.state === 'DASH_ATTACKING' && p.hasHitDuringDashAttack) d.dashAtkHit = true;
    // Capture the kill baseline only on the FIRST star pickup so the 3-kill goal
    // is cumulative across re-collects (a re-arm shouldn't discard prior progress).
    if (this.isStarPowered && !d.poweredPrev && !d.everPowered) {
      d.everPowered = true; d.powerKills0 = this.totalKills;
    }
    d.poweredPrev = this.isStarPowered;
    d.prevState = p.state;
  };

  M._updateTutorial = function (dt) {
    if (!this._tutorialActive || !this._tutData) return;
    this._tutTrack(dt);
    if (this._tutTransitioning) return;
    var step = this._tutSteps[this._tutStepIdx];
    if (!step) return;

    if (step.maintain) step.maintain();

    if (step.progress && this._tutDom) {
      var ps = step.progress();
      if (ps !== this._tutLastProg) {
        this._tutLastProg = ps;
        this._tutDom.progress.textContent = ps || '';
        this._tutDom.progress.style.display = ps ? '' : 'none';
      }
    }

    // Multi-goal steps tick their checklist live (the final sandbox step).
    if (this._tutDom && this._tutDom.subqRows) this._tutUpdateSubQuests();

    if (step.check(dt)) this._tutSucceed();
  };

  /* ================================================================
     STEP FLOW
     ================================================================ */
  M._tutNext = function () {
    this._tutStepIdx++;
    if (this._tutStepIdx >= this._tutSteps.length) { this._tutFinish(); return; }

    // Persist the furthest step reached so the home menu can offer "Resume"
    // (covers Skip AND closing the modal mid-tutorial). Cleared on completion.
    try { if (LA.laSetTutorialProgress) LA.laSetTutorialProgress(this._tutStepIdx); } catch (e) { /* ignore */ }

    var step = this._tutSteps[this._tutStepIdx];
    var d = this._tutData;
    // Reset per-step baselines BEFORE setup (setup may override, e.g. shields).
    d.kills0   = this.totalKills;
    d.shields0 = this.playerShields;
    d.basicKill0 = this._tutEvents.basicKill;
    d.moveT    = 0;
    d.dashed   = false;
    d.dashAtkHit = false;
    d.everPowered = this.isStarPowered;
    d.powerKills0 = this.totalKills;
    d.poweredPrev = this.isStarPowered;
    d.nuke0    = this._tutEvents.nuke;
    d.parade0  = this._tutEvents.parade;
    d.bruiser  = null;
    this._tutSandboxStep = false;  // setup() re-arms it only for the sandbox step
    // Freeze enemies until the player acts on this step (see _tutTrack). The
    // sandbox free-play step never freezes — its spawner is the lesson.
    this._tutEnemiesFrozen = !step.noFreeze;
    this._tutBurstT = 0;   // no respawn-knockback window at a fresh step
    this._tutLastProg = undefined;
    this._tutTransitioning = false;

    if (step.setup) step.setup();
    this._tutRenderStep(step);
  };

  M._tutRenderStep = function (step) {
    var dom = this._tutDom;
    if (!dom) return;
    var fr = tutFr();
    dom.title.textContent     = step.title;
    dom.questText.textContent = step.quest;
    dom.badge.textContent     = fr ? 'QUÊTE' : 'QUEST';
    dom.quest.classList.remove('la-tut-done');

    if (step.keys && step.keys.length) {
      dom.keys.innerHTML = buildKeysHtml(step.keys, fr);
      dom.keys.style.display = '';
    } else {
      dom.keys.innerHTML = '';
      dom.keys.style.display = 'none';
    }
    dom.desc.innerHTML = step.desc;
    dom.step.textContent = (this._tutStepIdx + 1) + ' / ' + this._tutSteps.length;
    dom.progress.textContent = '';
    dom.progress.style.display = 'none';

    // Sub-quest checklist: steps that bundle several goals into one step (the
    // final sandbox step) list each goal on its own ticked line so it's obvious
    // BOTH must be done. Rebuilt per step; hidden for single-goal steps.
    this._tutBuildSubQuests(step);

    // Combo-indicator highlight: shown only on the step that teaches the combo,
    // pointing the player at the on-canvas combo counter up top.
    if (dom.comboCue) dom.comboCue.style.display = step.highlightCombo ? '' : 'none';

    // Re-trigger the enter animation on quest + tip.
    [dom.quest, dom.tip].forEach(function (el) {
      el.classList.remove('la-tut-anim');
      void el.offsetWidth;
      el.classList.add('la-tut-anim');
    });
  };

  /* Sub-quest checklist — builds one ticked-off line per goal for multi-goal
     steps (currently only the final sandbox step). Rebuilt every step; the
     container is hidden for single-goal steps. Each sub-quest is a plain object
     { label, keys?, done(), prog?() }: done() flips the line to ✓, prog() feeds
     the little per-line counter (e.g. "x1 / x3"). Both are polled per frame in
     _tutUpdateSubQuests so the checklist ticks live as the player acts. */
  M._tutBuildSubQuests = function (step) {
    var dom = this._tutDom;
    if (!dom || !dom.subquests) return;
    var wrap = dom.subquests;
    wrap.innerHTML = '';
    dom.subqRows = null;

    var subs = step && step.subQuests;
    if (!subs || !subs.length) { wrap.style.display = 'none'; return; }

    var fr = tutFr();
    var rows = [];
    for (var i = 0; i < subs.length; i++) {
      var sq = subs[i];
      var keysHtml = (sq.keys && sq.keys.length) ? ' ' + buildKeysHtml(sq.keys, fr) : '';
      var row = document.createElement('div');
      row.className = 'la-tut-subq';
      row.innerHTML =
        '<span class="la-tut-subq-ic">' + (i + 1) + '</span>' +
        '<span class="la-tut-subq-label">' + sq.label + keysHtml + '</span>' +
        '<span class="la-tut-subq-prog"></span>';
      wrap.appendChild(row);
      rows.push({
        el:     row,
        ic:     row.querySelector('.la-tut-subq-ic'),
        prog:   row.querySelector('.la-tut-subq-prog'),
        doneFn: sq.done,
        progFn: sq.prog,
        idx:    i,
        _done:  undefined,
        _prog:  undefined,
      });
    }
    dom.subqRows = rows;
    wrap.style.display = '';
    this._tutUpdateSubQuests();
  };

  /* Per-frame refresh of the sub-quest checklist — flips each line to ✓ (with a
     pop) the moment its goal fires, and updates its little progress counter.
     Called from _updateTutorial only while subqRows exist. */
  M._tutUpdateSubQuests = function () {
    var dom = this._tutDom;
    if (!dom || !dom.subqRows) return;
    var rows = dom.subqRows;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var done = !!(r.doneFn && r.doneFn());
      if (done !== r._done) {
        r._done = done;
        r.el.classList.toggle('la-tut-subq-done', done);
        r.ic.textContent = done ? '✓' : String(r.idx + 1);
        if (done) {                       // replay the tick-off pop
          r.el.classList.remove('la-tut-subq-pop');
          void r.el.offsetWidth;
          r.el.classList.add('la-tut-subq-pop');
        }
      }
      var pg = done ? '' : (r.progFn ? r.progFn() : '');
      if (pg !== r._prog) {
        r._prog = pg;
        r.prog.textContent = pg || '';
        r.prog.style.display = pg ? '' : 'none';
      }
    }
  };

  M._tutSucceed = function () {
    this._tutTransitioning = true;
    // Stop the sandbox-step spawner immediately so no enemies pour in behind the
    // "Done!" flash or the completion card.
    this._tutSandboxStep = false;
    var fr = tutFr();
    var dom = this._tutDom;
    if (dom) {
      dom.quest.classList.add('la-tut-done');
      dom.badge.textContent = '✓';
      dom.questText.textContent = fr ? 'Réussi !' : 'Done!';
      dom.progress.style.display = 'none';
      if (dom.comboCue) dom.comboCue.style.display = 'none';
    }
    if (this.cameras && this.cameras.main) this.cameras.main.flash(180, 0, 255, 200);
    this._triggerHitstop(60);

    var self = this;
    var ep = this._tutEpoch;
    this.time.delayedCall(900, function () {
      // Bail if the run ended (Skip / finish) or was relaunched (epoch changed)
      // meanwhile — otherwise a stale timer would advance/clear the fresh run.
      if (!self._tutorialActive || self._tutDone || ep !== self._tutEpoch) return;
      self._tutClearBoard();
      self._tutNext();
    });
  };

  // SKIP — no rewards. Save the resume point, then drop straight into the live
  // sandbox run so the player keeps playing (never bounced back to the home menu).
  M._tutSkip = function () {
    if (this._tutDone) return;
    try { if (LA.laSetTutorialProgress) LA.laSetTutorialProgress(this._tutStepIdx); } catch (e) { /* ignore */ }
    this._tutEndMode();
  };

  // FINISH — only reached by completing the LAST step. Grants the rewards (once).
  M._tutFinish = function () {
    if (this._tutDone) return;
    this._tutDone = true;
    this._tutTransitioning = true;
    // If the rewards were already earned on a previous run, don't show the
    // celebration popup again — just close out.
    var wasAlreadyDone = !!(LA.laIsTutorialDone && LA.laIsTutorialDone());
    try { if (LA.laMarkTutorialDone) LA.laMarkTutorialDone(); } catch (e) { /* ignore */ }
    this._tutClearBoard();
    if (wasAlreadyDone) {
      // Rewards already earned on a prior run — skip the celebration, keep playing.
      this._tutEndMode();
    } else {
      this._tutShowComplete();
    }
  };

  M._tutShowComplete = function () {
    var fr = tutFr();
    var dom = this._tutDom;
    var ov  = (dom && dom.overlay) ? dom.overlay : document.getElementById('_la-tut-overlay');
    if (!ov) { this._tutEndMode(); return; }

    // Hide the step UI.
    if (dom) {
      if (dom.quest)    dom.quest.style.display = 'none';
      if (dom.tip)      dom.tip.style.display = 'none';
      if (dom.comboCue) dom.comboCue.style.display = 'none';
      var ctrl = ov.querySelector('.la-tut-controls');
      if (ctrl) ctrl.style.display = 'none';
    }

    var titleTxt = fr ? 'Tutoriel terminé !' : 'Tutorial complete!';

    var panel = document.createElement('div');
    panel.className = 'la-tut-complete';
    panel.innerHTML =
      '<div class="la-tut-complete-glyph">🎓</div>' +
      '<div class="la-tut-complete-title">' + titleTxt + '</div>' +
      '<div class="la-tut-unlock"><span class="la-tut-unlock-ic" style="color:#ff5530">☠</span><span>' +
        (fr ? 'Mode <b>Hardcore</b> débloqué' : '<b>Hardcore</b> mode unlocked') + '</span></div>' +
      '<div class="la-tut-unlock"><span class="la-tut-unlock-ic" style="color:#5fe0cf">⛏</span><span>' +
        (fr ? 'Skin <b>« I am Steve »</b> débloqué' : '<b>“I am Steve”</b> skin unlocked') + '</span></div>' +
      '<div class="la-tut-complete-hint">' + (fr ? 'Retrouve-les dans le menu 🏠' : 'Find them in the menu 🏠') + '</div>' +
      '<button type="button" class="la-tut-continue">' + (fr ? 'Continuer ▶' : 'Continue ▶') + '</button>';
    ov.appendChild(panel);

    var self = this;
    // "Continue ▶" drops straight into live sandbox play instead of the home menu.
    panel.querySelector('.la-tut-continue').addEventListener('click', function () {
      self._tutEndMode();
    });

    if (this.cameras && this.cameras.main) {
      this.cameras.main.flash(300, 255, 210, 80);
      this.time.delayedCall(120, function () {
        if (self.cameras && self.cameras.main) self.cameras.main.flash(300, 0, 255, 220);
      });
    }
  };

  /* ================================================================
     DOM OVERLAY
     ================================================================ */
  M._tutBuildDom = function () {
    var container = this.game && this.game.canvas && this.game.canvas.parentElement;
    if (!container) return;

    var old = document.getElementById('_la-tut-overlay');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var fr = tutFr();
    var ov = document.createElement('div');
    ov.id = '_la-tut-overlay';
    ov.innerHTML =
      '<div class="la-tut-quest la-tut-anim">' +
        '<div class="la-tut-quest-head">' +
          '<span class="la-tut-badge">' + (fr ? 'QUÊTE' : 'QUEST') + '</span>' +
          '<span class="la-tut-quest-text"></span>' +
          '<span class="la-tut-progress"></span>' +
        '</div>' +
        '<div class="la-tut-subquests" style="display:none"></div>' +
      '</div>' +
      '<div class="la-tut-tip la-tut-anim">' +
        '<div class="la-tut-tip-title"></div>' +
        '<div class="la-tut-keys"></div>' +
        '<div class="la-tut-desc"></div>' +
      '</div>' +
      '<div class="la-tut-combo-cue" style="display:none">' +
        '<span class="la-tut-combo-tag">' + (fr ? '← Ton combo' : '← Your combo') + '</span>' +
      '</div>' +
      '<div class="la-tut-controls">' +
        '<button type="button" class="la-tut-btn la-tut-ref">' + (fr ? 'Voir l’aide' : 'View help') + '</button>' +
        '<span class="la-tut-step"></span>' +
        '<button type="button" class="la-tut-btn la-tut-skip">' + (fr ? 'Passer ▶' : 'Skip ▶') + '</button>' +
      '</div>';

    container.style.position = 'relative';
    container.appendChild(ov);

    var self = this;
    this._tutDom = {
      overlay:   ov,
      quest:     ov.querySelector('.la-tut-quest'),
      badge:     ov.querySelector('.la-tut-badge'),
      questText: ov.querySelector('.la-tut-quest-text'),
      progress:  ov.querySelector('.la-tut-progress'),
      tip:       ov.querySelector('.la-tut-tip'),
      title:     ov.querySelector('.la-tut-tip-title'),
      keys:      ov.querySelector('.la-tut-keys'),
      desc:      ov.querySelector('.la-tut-desc'),
      step:      ov.querySelector('.la-tut-step'),
      skipBtn:   ov.querySelector('.la-tut-skip'),
      refBtn:    ov.querySelector('.la-tut-ref'),
      comboCue:  ov.querySelector('.la-tut-combo-cue'),
      subquests: ov.querySelector('.la-tut-subquests'),
      subqRows:  null,   // [{el,ic,prog,_done,_prog}] — rebuilt per step in _tutBuildSubQuests
    };
    this._tutDom.progress.style.display = 'none';

    this._tutDom.skipBtn.addEventListener('click', function () { self._tutSkip(); });
    this._tutDom.refBtn.addEventListener('click', function () {
      if (typeof window.__laOpenReference === 'function') window.__laOpenReference();
    });
    this._tutDone = false;
  };

})();

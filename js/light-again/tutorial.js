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
  LA.TUTORIAL_STEP_COUNT = 10;

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

      /* Quest banner (top, under the score HUD) */
      '#_la-tut-overlay .la-tut-quest{position:absolute;top:6.2rem;left:50%;transform:translateX(-50%);' +
        'display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;justify-content:center;' +
        'max-width:min(620px,92%);padding:.6rem 1.05rem;border-radius:12px;' +
        'background:rgba(4,8,20,.78);border:1px solid rgba(0,255,255,.32);' +
        '-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);' +
        'box-shadow:0 6px 26px rgba(0,0,0,.4);text-align:center}',
      '#_la-tut-overlay .la-tut-quest.la-tut-done{border-color:rgba(61,220,132,.7);background:rgba(6,22,14,.82)}',
      '#_la-tut-overlay .la-tut-badge{font-size:.56rem;letter-spacing:.22em;font-weight:700;' +
        'padding:.18rem .5rem;border-radius:6px;background:rgba(0,255,255,.14);color:#00ffff;' +
        'border:1px solid rgba(0,255,255,.3);flex:none}',
      '#_la-tut-overlay .la-tut-done .la-tut-badge{background:rgba(61,220,132,.18);color:#3ddc84;border-color:rgba(61,220,132,.45)}',
      '#_la-tut-overlay .la-tut-quest-text{font-size:.95rem;font-weight:700;letter-spacing:.01em;color:#dff6ff}',
      '#_la-tut-overlay .la-tut-progress{font-size:.86rem;font-weight:700;color:#ffcc00;letter-spacing:.05em}',

      /* Big tooltip card (lower third) */
      '#_la-tut-overlay .la-tut-tip{position:absolute;left:50%;bottom:4.6rem;transform:translateX(-50%);' +
        'width:min(560px,92%);padding:1.05rem 1.3rem 1.15rem;border-radius:16px;text-align:center;' +
        'background:rgba(4,6,18,.82);border:1px solid rgba(0,255,255,.28);' +
        'box-shadow:0 0 22px rgba(0,255,255,.08);' +
        '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
      '#_la-tut-overlay .la-tut-tip-title{font-size:1.5rem;font-weight:800;letter-spacing:.16em;' +
        'text-transform:uppercase;color:#00ffff;text-shadow:0 0 14px rgba(0,255,255,.4);margin-bottom:.7rem}',
      '#_la-tut-overlay .la-tut-keys{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;justify-content:center;margin-bottom:.7rem}',
      '#_la-tut-overlay .la-tut-kbd{display:inline-block;padding:.3rem .62rem;border-radius:7px;' +
        'background:rgba(0,255,255,.08);border:1px solid rgba(0,255,255,.45);border-bottom-width:3px;' +
        'color:#b9f6ff;font-weight:700;font-size:.82rem;letter-spacing:.02em}',
      '#_la-tut-overlay .la-tut-or{opacity:.45;font-size:.66rem;margin:0 .1rem;letter-spacing:.1em}',
      '#_la-tut-overlay .la-tut-desc{font-size:.82rem;line-height:1.6;color:#a9c4d8}',
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
      '#_la-tut-overlay .la-tut-step{font-size:.7rem;letter-spacing:.18em;color:#6f93b8;font-weight:700}',
      '#_la-tut-overlay .la-tut-btn{pointer-events:auto;cursor:pointer;font-family:monospace;font-weight:700;' +
        'font-size:.72rem;letter-spacing:.08em;padding:.42rem .9rem;border-radius:8px;' +
        'background:rgba(8,12,28,.85);border:1px solid rgba(0,255,255,.3);color:#bdeaff;' +
        'transition:background .2s,border-color .2s,transform .15s}',
      '#_la-tut-overlay .la-tut-btn:hover{background:rgba(0,255,255,.14);border-color:rgba(0,255,255,.6);transform:translateY(-1px)}',
      '#_la-tut-overlay .la-tut-skip{color:#d8b9c4;border-color:rgba(255,120,150,.3)}',
      '#_la-tut-overlay .la-tut-skip:hover{background:rgba(255,80,120,.12);border-color:rgba(255,120,150,.6)}',

      /* Completion celebration card */
      '#_la-tut-overlay .la-tut-complete{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' +
        'pointer-events:auto;width:min(440px,92%);padding:2rem 1.6rem 1.6rem;border-radius:18px;text-align:center;' +
        'background:linear-gradient(160deg,rgba(8,14,28,.96),rgba(14,10,26,.96));' +
        'border:1px solid rgba(0,255,255,.35);box-shadow:0 0 50px rgba(0,255,255,.12),inset 0 0 30px rgba(0,255,255,.04);' +
        'animation:la-tut-pop .45s cubic-bezier(.22,1,.36,1) both}',
      '#_la-tut-overlay .la-tut-complete-glyph{font-size:2.6rem;line-height:1;margin-bottom:.5rem}',
      '#_la-tut-overlay .la-tut-complete-title{font-size:1.15rem;font-weight:800;letter-spacing:.1em;' +
        'text-transform:uppercase;color:#5fe0cf;margin-bottom:1.1rem;text-shadow:0 0 16px rgba(95,224,207,.35)}',
      '#_la-tut-overlay .la-tut-unlock{display:flex;align-items:center;gap:.6rem;justify-content:center;' +
        'font-size:.82rem;color:#c8dceb;margin:.45rem 0}',
      '#_la-tut-overlay .la-tut-unlock b{color:#fff}',
      '#_la-tut-overlay .la-tut-unlock-ic{font-size:1.05rem;flex:none}',
      '#_la-tut-overlay .la-tut-complete-hint{font-size:.66rem;letter-spacing:.06em;color:#6f8aa0;margin:1.1rem 0 1.3rem}',
      '#_la-tut-overlay .la-tut-continue{pointer-events:auto;cursor:pointer;font-family:monospace;font-weight:800;' +
        'font-size:.85rem;letter-spacing:.12em;text-transform:uppercase;padding:.6rem 1.8rem;border-radius:10px;' +
        'background:rgba(0,255,255,.12);border:1.5px solid rgba(0,255,255,.55);color:#00ffff;transition:transform .15s,box-shadow .2s,background .2s}',
      '#_la-tut-overlay .la-tut-continue:hover{transform:translateY(-2px);background:rgba(0,255,255,.2);box-shadow:0 0 22px rgba(0,255,255,.25)}',

      '@media (max-width:560px){#_la-tut-overlay .la-tut-tip-title{font-size:1.2rem}#_la-tut-overlay .la-tut-tip{bottom:3.6rem}}',
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
    this._tutEvents        = { nuke: 0, parade: 0, shieldBreak: 0, basicKill: 0 };
    this._tutDom           = null;
    this._tutLastProg      = undefined;
    this._tutDone          = false;
    // true → skip/finish bounces back to the home menu; false → stays in the
    // live game (tutorial launched in-place via the ? button mid-run).
    this._tutReturnToHome  = false;
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
  M._startTutorial = function (startStep, fromHome) {
    ensureTutStyles();
    // Resume point: explicit arg wins, else the global armed by shell.js, else 0.
    if (startStep == null) startStep = window.__laTutorialStartStep || 0;
    if (fromHome == null)  fromHome  = !!window.__laTutorialFromHome;
    window.__laTutorialStartStep = 0;
    window.__laTutorialFromHome  = false;
    this._tutReturnToHome = !!fromHome;
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
    if (this._upSlowMoBanner) { this._upSlowMoBanner.destroy(); this._upSlowMoBanner = null; }
    this._tutResetPlayer();
    this.MAX_SHIELDS    = 2;
    this.playerShields  = 1;
    this.comboMultiplier = 1;
    this.comboTimer     = 0;
    this.spawnTimer     = 0;
    this._tutEvents     = { nuke: 0, parade: 0, shieldBreak: 0, basicKill: 0 };
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
    this.isStarPowered = false; this._starPowerTimer = 0; this._starPowerWarning = false;
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
  M._tutSpawnOne = function (tier, dist) {
    if (this.enemies.length >= C.MAX_ENEMIES) return null;
    var ang = Math.random() * Math.PI * 2;
    var pos = this._spawnPosNear(ang, dist, tier);
    this._spawnTierAt(tier, pos.x, pos.y);
    return this.enemies[this.enemies.length - 1] || null;
  };

  M._tutSpawnRing = function (tier, count, dist) {
    for (var i = 0; i < count; i++) {
      if (this.enemies.length >= C.MAX_ENEMIES) break;
      var ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      var d   = dist + (Math.random() - 0.5) * 70;
      var pos = this._spawnPosNear(ang, d, tier);
      this._spawnTierAt(tier, pos.x, pos.y);
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

    this._tutSteps = [
      /* 0 — MOVE */
      {
        title: fr ? 'Déplacement' : 'Move',
        quest: fr ? 'Déplace-toi dans l’arène' : 'Move around the arena',
        keys:  fr ? ['Z Q S D', 'W A S D', 'Flèches'] : ['W A S D', 'Z Q S D', 'Arrows'],
        desc:  fr
          ? 'Bienvenue ! On commence par les bases : <b>bouge</b> dans la direction des touches.'
          : 'Welcome! Let’s start with the basics: <b>move</b> in the key direction.',
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
        keys:  fr ? ['Clic droit', 'Espace', 'Maj'] : ['Right click', 'Space', 'Shift'],
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
          ? 'L’<span class="c-torp">attaque torpille</span> : ta flèche fonce vers le curseur en rotation. Vise l’éclaireur <span class="c-torp">▲</span> ! <b>⚠️ La rater</b> te laisse vulnérable un instant (récupération) — vise juste.'
          : 'The <span class="c-torp">torpedo attack</span>: your arrow spins toward the cursor. Aim at the scout <span class="c-torp">▲</span>! <b>⚠️ Whiffing it</b> leaves you exposed for a moment (recovery) — aim true.',
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
          ? 'Clique pendant un <span class="c-dash">dash</span> : la <span class="c-datk">dash-attaque</span> est plus rapide, plus large, et traverse les ennemis. <b>⚠️ La rater coûte cher</b> : récupération encore plus longue qu’une attaque ratée.'
          : 'Click during a <span class="c-dash">dash</span>: the <span class="c-datk">dash-attack</span> is faster, wider, and pierces enemies. <b>⚠️ Whiffing it is costly</b>: an even longer recovery than a missed attack.',
        setup: function () { self._tutSpawnOne(1, 360); },
        check: function () { return !!d().dashAtkHit; },
        maintain: function () { if (self._tutCountTier(1) === 0) self._tutSpawnOne(1, 360); },
      },

      /* 5 — COMBO → SHIELD */
      {
        title: fr ? 'Combo & Bouclier' : 'Combo & Shield',
        quest: fr ? 'Atteins un combo x10 pour gagner un bouclier' : 'Reach a x10 combo to earn a shield',
        keys:  null,
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

      /* 6 — MARK + NUKE */
      {
        title: fr ? 'Marque & Détonation' : 'Mark & Detonation',
        quest: fr ? 'Marque un ennemi au dash, puis fais-le détoner' : 'Mark an enemy on a dash, then detonate it',
        keys:  fr ? ['Dash  →  Clic gauche'] : ['Dash  →  Left click'],
        desc:  fr
          ? '<span class="c-dash">Dashe</span> À TRAVERS un ennemi pour le <span class="c-mark">marquer</span> (étincelles bleues), puis fais une <span class="c-torp">attaque torpille</span> dessus → <span class="c-shield">NUKE</span> à zone d’effet ! (La dash-attaque ne déclenche pas la nuke.)'
          : '<span class="c-dash">Dash</span> THROUGH an enemy to <span class="c-mark">mark</span> it (blue sparks), then <span class="c-torp">torpedo-attack</span> it → AoE <span class="c-shield">NUKE</span>! (Dash-attack does NOT trigger it.)',
        setup: function () { d().nuke0 = self._tutEvents.nuke; self._tutSpawnRing(1, 6, 230); },
        check: function () { return self._tutEvents.nuke > d().nuke0; },
        maintain: function () { if (self._tutCountTier(1) < 3) self._tutSpawnRing(1, 5, 230); },
      },

      /* 7 — STAR POWER (the "bonus dash attack") */
      {
        title: fr ? 'Star Power' : 'Star Power',
        quest: fr ? 'Ramasse l’étoile et pulvérise 3 ennemis' : 'Grab the star and smash 3 enemies',
        keys:  fr ? ['Clic gauche  (survolté)'] : ['Left click  (overdriven)'],
        desc:  fr
          ? 'L’<span class="c-star">étoile bonus</span> te survolte : ton attaque devient une <span class="c-datk">dash-attaque spammable</span>. Fonce dans le tas !'
          : 'The <span class="c-star">bonus star</span> overdrives you: your attack becomes a <span class="c-datk">spammable dash-attack</span>. Go wild!',
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
          ? 'Le Tireur <span class="c-shooter">◆</span> garde ses distances et tire. Une <span class="c-datk">dash-attaque</span> sur un projectile le <span class="c-datk">renvoie</span> à l’envoyeur (<span class="c-combo">x2 points</span>). L’attaque simple ne renvoie pas.'
          : 'The Shooter <span class="c-shooter">◆</span> keeps its distance and fires. A <span class="c-datk">dash-attack</span> on a projectile <span class="c-datk">reflects</span> it back (<span class="c-combo">x2 points</span>). The basic attack does not.',
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
        title: fr ? 'Mastodonte' : 'Bruiser',
        quest: fr ? 'Brise le bouclier du Mastodonte et achève-le' : 'Break the Bruiser’s shield and finish it',
        keys:  fr ? ['Dash-attaque  →  brise le bouclier'] : ['Dash-attack  →  break the shield'],
        desc:  fr
          ? 'Le <span class="c-bruiser">Mastodonte ⬢</span> a un <span class="c-shield">bouclier</span> que seule la <span class="c-datk">dash-attaque</span> brise, puis achève-le. Astuce : <span class="c-mark">marque-le</span> au dash puis <span class="c-shield">NUKE</span> — il ignore le bouclier !'
          : 'The <span class="c-bruiser">Bruiser ⬢</span> has a <span class="c-shield">shield</span> only the <span class="c-datk">dash-attack</span> can break — then finish it. Tip: <span class="c-mark">mark it</span> on a dash then <span class="c-shield">NUKE</span> — it ignores the shield!',
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
    ];
  };

  /* ================================================================
     PER-FRAME UPDATE — called from scene.update()
     ================================================================ */
  M._tutTrack = function (dt) {
    var p = this.p, d = this._tutData;
    if (!p || !d) return;
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

    // Re-trigger the enter animation on quest + tip.
    [dom.quest, dom.tip].forEach(function (el) {
      el.classList.remove('la-tut-anim');
      void el.offsetWidth;
      el.classList.add('la-tut-anim');
    });
  };

  M._tutSucceed = function () {
    this._tutTransitioning = true;
    var fr = tutFr();
    var dom = this._tutDom;
    if (dom) {
      dom.quest.classList.add('la-tut-done');
      dom.badge.textContent = '✓';
      dom.questText.textContent = fr ? 'Réussi !' : 'Done!';
      dom.progress.style.display = 'none';
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

  // SKIP — no rewards. Save the resume point, then return to the home menu if the
  // tutorial was launched FROM the home; otherwise just drop back into the live
  // sandbox run (launched in-place via the ? button).
  M._tutSkip = function () {
    if (this._tutDone) return;
    try { if (LA.laSetTutorialProgress) LA.laSetTutorialProgress(this._tutStepIdx); } catch (e) { /* ignore */ }
    var toHome = this._tutReturnToHome;
    this._tutEndMode();
    if (toHome && typeof window.__laShowHome === 'function') window.__laShowHome();
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
      var toHome = this._tutReturnToHome;
      this._tutEndMode();
      if (toHome && typeof window.__laShowHome === 'function') window.__laShowHome();
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
      if (dom.quest) dom.quest.style.display = 'none';
      if (dom.tip)   dom.tip.style.display = 'none';
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
    panel.querySelector('.la-tut-continue').addEventListener('click', function () {
      var toHome = self._tutReturnToHome;
      self._tutEndMode();
      if (toHome && typeof window.__laShowHome === 'function') window.__laShowHome();
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
        '<span class="la-tut-badge">' + (fr ? 'QUÊTE' : 'QUEST') + '</span>' +
        '<span class="la-tut-quest-text"></span>' +
        '<span class="la-tut-progress"></span>' +
      '</div>' +
      '<div class="la-tut-tip la-tut-anim">' +
        '<div class="la-tut-tip-title"></div>' +
        '<div class="la-tut-keys"></div>' +
        '<div class="la-tut-desc"></div>' +
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
    };
    this._tutDom.progress.style.display = 'none';

    this._tutDom.skipBtn.addEventListener('click', function () { self._tutSkip(); });
    this._tutDom.refBtn.addEventListener('click', function () {
      if (typeof window.__laOpenReference === 'function') window.__laOpenReference();
    });
    this._tutDone = false;
  };

})();

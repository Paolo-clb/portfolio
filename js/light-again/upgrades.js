/* ==========================================================================
   Light Again — Upgrade System (Roguelite Draft)
   Loot-pool management, player upgrade state, slow-mo transition & apply.
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  /* ---- Transition timing ---- */
  var SLOWMO_RAMP_DOWN   = 0.6;   // seconds to reach full pause
  var SLOWMO_RAMP_UP     = 0.6;   // seconds to resume normal speed
  var SLOWMO_MIN_SCALE   = 0.05;  // near-zero before final pause

  /* ================================================================
     INIT — called once in scene.create()
     ================================================================ */
  M._initUpgrades = function () {
    this._upgradeLevels = {
      dashAtk:    0,
      detonation: 0,
      dash:       0,
      baseAtk:    0,
      shield:     0,
      drone:      0,
    };

    this._upgradePool = [];
    var defs = LA.UPGRADES;
    for (var k in defs) {
      if (defs.hasOwnProperty(k)) {
        this._upgradePool.push({ id: k, level: 1 });
      }
    }

    // Draft agency: rerolls (start with N, +1 earned per boss kill), anti-flood
    // memory of the last offer, and a resolved-draft counter (curses only appear
    // from the 2nd draft onward). Curse cards add global modifiers via these knobs.
    this._rerollsAvailable = C.UPGRADE_REROLLS_START;
    this._lastOffered      = null;   // { "id:level": true } of the previous draft's cards
    this._draftsResolved   = 0;
    this._takenCurses      = {};
    this._scoreMult        = 1;      // glassHeart curse
    this._dashCdMult       = 1;      // dashRage curse
    this._blastMult        = 1;      // cursedBlast curse (all player-allied explosion radii)

    // Bosses are the ONLY upgrade source now; the kill counter drives BOSS spawns.
    // Hardcore: the gap grows by +100 each boss (100 → 200 → 300 …).
    // Sandbox: a flat gap. (See _maybeSpawnAnomaly + _advanceBossThreshold.)
    var hardcore = (window.__laGameMode === 'hardcore');
    this._bossKillInterval  = hardcore ? C.BOSS_KILL_INTERVAL_HC_START : C.BOSS_KILL_INTERVAL;
    this._bossKillThreshold = this._bossKillInterval;
    this._bossDraftPending  = false;   // suppresses enemy spawns from boss death until the draft closes
    this._draftPicksRemaining = 0;     // boss kill grants BOSS_DRAFT_PICKS sequential picks
    this._upgradeDraftOpen     = false;

    // Slow-mo transition state
    this._upSlowMoPhase   = null;   // null | 'rampDown' | 'paused' | 'rampUp'
    this._upSlowMoTimer   = 0;
    this._upSlowMoTarget  = 1.0;
    this._upSlowMoBanner  = null;   // Phaser text object
    this._upPendingChoices = null;
    this._upSecretDraft   = false;  // true when showing The World draft
    this._upCurseFountain = false;  // true while a Curse-Fountain accept/refuse offer is ramping
    this._curseFountainId = null;   // the curse the fountain is currently offering
  };

  /* ================================================================
     CHECK TRIGGER — kept as a no-op. Upgrades no longer come from a kill
     threshold; they're awarded ONLY by killing bosses (see _bossDefeatSequence).
     Boss SPAWNS are now driven by the kill counter (see _maybeSpawnAnomaly), and
     The World is offered on a boss kill once every upgrade is maxed.
     ================================================================ */
  M._checkUpgradeTrigger = function () { /* intentionally empty */ };

  /* Advance the kill counter for the NEXT boss. Called on boss death so kills
     scored DURING a boss fight don't shorten the next gap (counter "pauses"). */
  M._advanceBossThreshold = function () {
    if (window.__laGameMode === 'hardcore') {
      this._bossKillInterval += C.BOSS_KILL_INTERVAL_HC_STEP;   // 100 → 200 → 300 …
    }
    this._bossKillThreshold = this.totalKills + this._bossKillInterval;
  };

  /* ================================================================
     DRAW RANDOM CHOICES
     ================================================================ */
  M._drawUpgradeChoices = function () {
    var pool = this._upgradePool;
    if (pool.length === 0) return [];
    var n = Math.min(C.UPGRADE_DRAFT_SIZE, pool.length);

    // Weighted sampling WITHOUT replacement: capstones (Lv2/Lv3) are rarer, and a
    // card offered (but not taken) in the immediately previous draft is heavily
    // de-weighted so the player keeps seeing fresh options (anti-flood).
    var prevOffered = this._lastOffered || {};
    var bag = [];
    for (var i = 0; i < pool.length; i++) {
      var e = pool[i];
      var w = e.level >= 3 ? C.UPGRADE_W_LVL3 : (e.level === 2 ? C.UPGRADE_W_LVL2 : C.UPGRADE_W_LVL1);
      if (prevOffered[e.id + ':' + e.level]) w *= C.UPGRADE_ANTIFLOOD_W;
      bag.push({ entry: e, w: w });
    }

    var choices = [];
    for (var j = 0; j < n && bag.length; j++) {
      var total = 0;
      for (var b = 0; b < bag.length; b++) total += bag[b].w;
      var roll = Math.random() * total, pick = bag.length - 1;
      for (var b2 = 0; b2 < bag.length; b2++) { roll -= bag[b2].w; if (roll <= 0) { pick = b2; break; } }
      choices.push(bag[pick].entry);
      bag.splice(pick, 1);
    }

    // Remember the (normal) cards we just offered for the next draft's anti-flood.
    var offered = {};
    for (var c = 0; c < choices.length; c++) offered[choices[c].id + ':' + choices[c].level] = true;
    this._lastOffered = offered;

    // Risk/reward: occasionally swap one slot for a curse card.
    this._maybeInjectCurse(choices);
    return choices;
  };

  /* Curses no longer drop from the upgrade draft — the Curse Fountain map event
     (curse-fountain.js) is now their ONLY source. Kept as a no-op so the call
     site in _drawUpgradeChoices stays harmless. */
  M._maybeInjectCurse = function (choices) {
    return;
    /* eslint-disable no-unreachable */
    if (!choices || choices.length < 2) return;              // keep ≥1 real upgrade on offer
    if ((this._draftsResolved || 0) < 1) return;             // skip the first-ever draft
    if (Math.random() >= C.UPGRADE_CURSE_CHANCE) return;
    var taken = this._takenCurses || {};
    var avail = [];
    for (var k in LA.CURSES) {
      if (LA.CURSES.hasOwnProperty(k) && !taken[k]) avail.push(k);
    }
    if (!avail.length) return;
    var cid  = avail[Math.floor(Math.random() * avail.length)];
    var slot = Math.floor(Math.random() * choices.length);
    choices[slot] = { curse: true, id: cid };
  };

  /* Reroll the current draft (consumes one reroll). Returns fresh choices, or
     null if no rerolls remain. The UI rebuilds itself with the new list. */
  M._rerollDraft = function () {
    if ((this._rerollsAvailable || 0) <= 0) return null;
    this._rerollsAvailable--;
    return this._drawUpgradeChoices();
  };

  /* Skip ONE pick → heal a shield if (and only if) below max, then move on to
     the next pick (or close if it was the last). The UI label reflects whether a
     heal will actually happen (it recomputes each pick). */
  M._skipDraft = function () {
    if (this.playerShields < this.MAX_SHIELDS) {
      this.playerShields++;
      this._explode(this.p.x, this.p.y, [0, 255, 255], 18);
      this._explode(this.p.x, this.p.y, [255, 255, 255], 10);
      this._floatLabel(this.p.x, this.p.y - 30, '+1 SHIELD', '#00ffff');
      this.cameras.main.flash(180, 0, 220, 255);
    }
    this._advanceDraftPick();
  };

  /* After a pick (upgrade taken, curse taken, or skipped): consume one pick and
     either present a FRESH draw (scene stays paused) or close the draft. */
  M._advanceDraftPick = function () {
    this._draftPicksRemaining = (this._draftPicksRemaining || 1) - 1;
    if (this._draftPicksRemaining > 0 && this._upgradePool.length > 0) {
      var el = document.getElementById('_la-upgrade-overlay');
      if (el && el.parentNode) el.parentNode.removeChild(el);
      var choices = this._drawUpgradeChoices();
      if (choices.length === 0) { this._closeDraft(); return; }
      this._showUpgradeDraftUI(choices);
    } else {
      this._closeDraft();
    }
  };

  /* Boss reward draft: BOSS_DRAFT_PICKS sequential picks. If every upgrade is
     maxed, this is when The World is offered instead (once). */
  M._beginBossUpgradeDraft = function () {
    if (this._upgradePool.length === 0) {
      if (!this._twUnlocked && !this._twSecretOffered) {
        this._twSecretOffered = true;
        this._beginSecretUpgradeDraft();
      } else {
        this._bossDraftPending = false;   // nothing left to offer → just resume
      }
      return;
    }
    this._beginUpgradeSlowMo(C.BOSS_DRAFT_PICKS);
  };

  /* Apply a curse card: every curse costs −1 shield slot, plus its own buff. */
  M._applyCurse = function (cid) {
    this._takenCurses = this._takenCurses || {};
    this._takenCurses[cid] = true;

    // Shared downside: −1 shield slot (floor 1), clamping current shields.
    this.MAX_SHIELDS = Math.max(1, this.MAX_SHIELDS - 1);
    if (this.playerShields > this.MAX_SHIELDS) this.playerShields = this.MAX_SHIELDS;

    if (cid === 'glassHeart')       this._scoreMult  = (this._scoreMult  || 1) * C.CURSE_SCORE_MULT;
    else if (cid === 'dashRage')    this._dashCdMult = (this._dashCdMult || 1) * C.CURSE_DASH_CD_MULT;
    else if (cid === 'cursedBlast') this._blastMult  = (this._blastMult  || 1) * C.CURSE_BLAST_MULT;

    // Ominous red flourish — distinct from the cyan upgrade feedback.
    this.cameras.main.flash(240, 180, 0, 40);
    this.cameras.main.shake(160, 0.010);
    this._explode(this.p.x, this.p.y, [200, 0, 60], 26);
    this._explode(this.p.x, this.p.y, [120, 0, 160], 16);
  };

  /* ================================================================
     SLOW-MO RAMP DOWN — called instead of instant pause
     ================================================================ */
  M._beginUpgradeSlowMo = function (picks) {
    this._upgradeDraftOpen = true;
    this._draftPicksRemaining = picks || 1;
    this._upSlowMoPhase    = 'rampDown';
    this._upSlowMoTimer    = 0;
    this._upPendingChoices = this._drawUpgradeChoices();

    if (this._upPendingChoices.length === 0) {
      this._upgradeDraftOpen = false;
      this._upSlowMoPhase = null;
      this._bossDraftPending = false;
      return;
    }
    // No in-game "upgrade available" banner anymore — the boss-defeat sequence
    // (board clear + power-up animation) telegraphs the draft on its own.
  };

  /* ================================================================
     UPDATE SLOW-MO — called every frame from scene.update()
     ================================================================ */
  M._updateUpgradeSlowMo = function (dt) {
    if (!this._upSlowMoPhase) return;

    if (this._upSlowMoPhase === 'rampDown') {
      this._upSlowMoTimer += dt;
      var progress = Math.min(this._upSlowMoTimer / SLOWMO_RAMP_DOWN, 1.0);
      // Ease in (mirror of ramp-up): decelerate smoothly
      var eased = 1.0 - progress * progress;
      this._upSlowMoTarget = Math.max(SLOWMO_MIN_SCALE, SLOWMO_MIN_SCALE + (1.0 - SLOWMO_MIN_SCALE) * eased);

      // Pulse the banner
      if (this._upSlowMoBanner) {
        var pulseA = 0.7 + 0.3 * Math.sin(this._upSlowMoTimer * Math.PI * 5);
        this._upSlowMoBanner.setAlpha(pulseA);
      }

      if (progress >= 1.0) {
        this._openUpgradeDraft();
      }
    } else if (this._upSlowMoPhase === 'rampUp') {
      this._upSlowMoTimer += dt;
      var prog = Math.min(this._upSlowMoTimer / SLOWMO_RAMP_UP, 1.0);
      // Ease in: accelerate back smoothly
      this._upSlowMoTarget = SLOWMO_MIN_SCALE + (1.0 - SLOWMO_MIN_SCALE) * (prog * prog);

      if (prog >= 1.0) {
        this._upSlowMoTarget = 1.0;
        this._upSlowMoPhase  = null;
      }
    }
  };

  /* ================================================================
     GET UPGRADE TIME SCALE — multiplied with existing timeScale
     ================================================================ */
  M._getUpgradeTimeScale = function () {
    if (!this._upSlowMoPhase) return 1.0;
    return this._upSlowMoTarget;
  };

  /* ================================================================
     OPEN DRAFT — full pause + show UI
     ================================================================ */
  M._openUpgradeDraft = function () {
    this._upSlowMoPhase = 'paused';

    // Destroy banner
    if (this._upSlowMoBanner) {
      this._upSlowMoBanner.destroy();
      this._upSlowMoBanner = null;
    }

    // Freeze scene
    this.scene.pause();

    // Secret upgrade: show golden single-choice UI
    if (this._upSecretDraft) {
      this._upSecretDraft = false;
      this._showSecretUpgradeDraftUI();
      return;
    }

    // Curse Fountain: a single accept/refuse curse choice (the only curse source).
    if (this._upCurseFountain) {
      this._upCurseFountain = false;
      this._showCurseFountainUI(this._curseFountainId);
      return;
    }

    var choices = this._upPendingChoices || this._drawUpgradeChoices();
    this._upPendingChoices = null;

    if (choices.length === 0) {
      this._closeDraft();
      return;
    }

    this._showUpgradeDraftUI(choices);
  };

  /* ================================================================
     CURSE FOUNTAIN OFFER — ramp the world into a single accept/refuse curse
     choice (reuses the upgrade slow-mo → pause → DOM-overlay machinery). The
     overlay itself is _showCurseFountainUI (curse-fountain.js); accept/refuse
     both route back through _consumeFount + _closeDraft.
     ================================================================ */
  M._beginCurseFountainOffer = function (curseId) {
    this._upgradeDraftOpen = true;
    this._upCurseFountain  = true;
    this._curseFountainId  = curseId;
    this._upSecretDraft    = false;
    this._upSlowMoPhase    = 'rampDown';
    this._upSlowMoTimer    = 0;
    this._upPendingChoices = null;   // not a card draft
  };

  /* ================================================================
     SECRET UPGRADE DRAFT — golden presentation for "The World"
     ================================================================ */
  M._beginSecretUpgradeDraft = function () {
    this._upgradeDraftOpen = true;
    this._upSlowMoPhase    = 'rampDown';
    this._upSlowMoTimer    = 0;
    this._upPendingChoices = null; // not used for secret

    var cam = this.cameras.main;
    var t   = LA.laGoT;
    var banner = this.add.text(cam.width / 2, cam.height * 0.13, '???', {
      fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold', color: '#ffc832',
      stroke: '#332200', strokeThickness: 3,
    });
    banner.setOrigin(0.5);
    banner.setDepth(106);
    banner.setScrollFactor(0);
    banner.setBlendMode(Phaser.BlendModes.ADD);
    banner.setAlpha(0);
    this._upSlowMoBanner = banner;
    this._upSecretDraft = true;

    this.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 400,
      ease: 'Cubic.easeOut',
    });
  };

  /* ================================================================
     APPLY UPGRADE
     ================================================================ */
  M._applyUpgrade = function (choiceEntry) {
    var id  = choiceEntry.id;
    var lvl = choiceEntry.level;
    this._upgradeLevels[id] = lvl;

    for (var i = this._upgradePool.length - 1; i >= 0; i--) {
      var e = this._upgradePool[i];
      if (e.id === id && e.level === lvl) {
        this._upgradePool.splice(i, 1);
        break;
      }
    }

    if (lvl < LA.UPGRADES[id].maxLvl) {
      this._upgradePool.push({ id: id, level: lvl + 1 });
    }

    // Shield upgrade: raise max capacity immediately. Lv1 → 2, Lv2 → 3 slots;
    // Lv3 adds NO extra slot (its value is the "explosion on shield loss"), so
    // the slot count is capped at 3. A taken curse may have lowered MAX_SHIELDS,
    // so re-derive it from the level and re-apply any active −1 curse penalties.
    if (id === 'shield') {
      var curseSlotPenalty = 0;
      var tc = this._takenCurses || {};
      for (var ck in tc) { if (tc.hasOwnProperty(ck) && tc[ck]) curseSlotPenalty++; }
      this.MAX_SHIELDS = Math.max(1, (1 + Math.min(lvl, 2)) - curseSlotPenalty);
      if (this.playerShields > this.MAX_SHIELDS) this.playerShields = this.MAX_SHIELDS;
    }

    // Drone upgrade: spawn/replenish the orbiting drones up to the new level.
    if (id === 'drone' && this._ensureDrones) this._ensureDrones();
  };

  /* ================================================================
     CLOSE DRAFT — resume with ramp-up
     ================================================================ */
  M._closeDraft = function () {
    this._upgradeDraftOpen = false;
    this._draftPicksRemaining = 0;
    this._draftsResolved = (this._draftsResolved || 0) + 1;
    // Boss death cleared the whole board, so let natural spawns resume only now —
    // the instant the player has finished choosing and time is about to flow.
    this._bossDraftPending = false;

    var el = document.getElementById('_la-upgrade-overlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);

    // Resume Phaser scene, then ramp up speed. No safe-bubble push anymore: a
    // boss kill wipes the board, so there's nothing crowding the player on resume.
    this._upSlowMoPhase = 'rampUp';
    this._upSlowMoTimer = 0;
    this._upSlowMoTarget = SLOWMO_MIN_SCALE;
    this.scene.resume();
  };

})();

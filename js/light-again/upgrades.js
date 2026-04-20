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
    };

    this._upgradePool = [];
    var defs = LA.UPGRADES;
    for (var k in defs) {
      if (defs.hasOwnProperty(k)) {
        this._upgradePool.push({ id: k, level: 1 });
      }
    }

    this._upgradeKillThreshold = C.UPGRADE_KILL_INTERVAL;
    this._upgradeDraftOpen     = false;

    // Slow-mo transition state
    this._upSlowMoPhase   = null;   // null | 'rampDown' | 'paused' | 'rampUp'
    this._upSlowMoTimer   = 0;
    this._upSlowMoTarget  = 1.0;
    this._upSlowMoBanner  = null;   // Phaser text object
    this._upPendingChoices = null;
    this._upSecretDraft   = false;  // true when showing The World draft
  };

  /* ================================================================
     CHECK TRIGGER — called after each kill / end of batch
     ================================================================ */
  M._checkUpgradeTrigger = function () {
    if (this._upgradeDraftOpen) return;
    if (this._upSlowMoPhase) return;
    if (this._twActive) return;  // don't trigger upgrades during time stop

    // Secret upgrade check: fires independently of normal pool
    if (!this._twUnlocked && !this._twSecretOffered) {
      if (this._checkSecretUpgrade()) {
        this._beginSecretUpgradeDraft();
        return;
      }
    }

    if (this._upgradePool.length === 0) return;
    if (this.totalKills < this._upgradeKillThreshold) return;

    this._upgradeKillThreshold += C.UPGRADE_KILL_INTERVAL;
    this._beginUpgradeSlowMo();
  };

  /* ================================================================
     DRAW RANDOM CHOICES
     ================================================================ */
  M._drawUpgradeChoices = function () {
    var pool = this._upgradePool;
    if (pool.length === 0) return [];
    var n = Math.min(C.UPGRADE_DRAFT_SIZE, pool.length);
    var indices = [];
    for (var i = 0; i < pool.length; i++) indices.push(i);
    for (var j = 0; j < n; j++) {
      var r = j + Math.floor(Math.random() * (indices.length - j));
      var tmp = indices[j]; indices[j] = indices[r]; indices[r] = tmp;
    }
    var choices = [];
    for (var k = 0; k < n; k++) choices.push(pool[indices[k]]);
    return choices;
  };

  /* ================================================================
     SLOW-MO RAMP DOWN — called instead of instant pause
     ================================================================ */
  M._beginUpgradeSlowMo = function () {
    this._upgradeDraftOpen = true;
    this._upSlowMoPhase    = 'rampDown';
    this._upSlowMoTimer    = 0;
    this._upPendingChoices = this._drawUpgradeChoices();

    if (this._upPendingChoices.length === 0) {
      this._upgradeDraftOpen = false;
      this._upSlowMoPhase = null;
      return;
    }

    // Show "upgrade available" banner at the top, above score (y ≈ cam.height * 0.15)
    var cam = this.cameras.main;
    var t   = LA.laGoT;
    var banner = this.add.text(cam.width / 2, cam.height * 0.13, t('laUpAvailable'), {
      fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#00ffff',
      stroke: '#002233', strokeThickness: 3,
    });
    banner.setOrigin(0.5);
    banner.setDepth(106);
    banner.setScrollFactor(0);
    banner.setBlendMode(Phaser.BlendModes.ADD);
    banner.setAlpha(0);
    this._upSlowMoBanner = banner;

    // Fade in the banner
    this.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 400,
      ease: 'Cubic.easeOut',
    });
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

    var choices = this._upPendingChoices || this._drawUpgradeChoices();
    this._upPendingChoices = null;

    if (choices.length === 0) {
      this._closeDraft();
      return;
    }

    this._showUpgradeDraftUI(choices);
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

    // Shield upgrade: raise max capacity immediately
    if (id === 'shield') {
      this.MAX_SHIELDS = 1 + lvl;  // Lv1 → 2 slots, Lv2 → 3 slots
    }
  };

  /* ================================================================
     CLOSE DRAFT — resume with ramp-up
     ================================================================ */
  M._closeDraft = function () {
    this._upgradeDraftOpen = false;

    var el = document.getElementById('_la-upgrade-overlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);

    // Resume Phaser scene, then ramp up speed
    this._upSlowMoPhase = 'rampUp';
    this._upSlowMoTimer = 0;
    this._upSlowMoTarget = SLOWMO_MIN_SCALE;
    this.scene.resume();
  };

})();

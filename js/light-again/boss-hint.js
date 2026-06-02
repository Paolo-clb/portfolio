/* ==========================================================================
   Light Again — First-encounter BOSS WEAKNESS tooltip (SANDBOX only)

   Sandbox is the practice mode, so when the player meets a given mini-boss for
   the FIRST time and is still struggling with it after BOSS_HINT_DELAY_S, a
   styled, non-blocking tooltip slides up from the bottom and briefly spells out
   that boss's weakness. It fires at most ONCE per boss type per run (the first
   time it's encountered) — once you've seen the hint, or beaten that boss type
   quickly, it never nags again.

   Self-contained: adds methods to LA.sceneMethods, owns its own stylesheet +
   DOM node, and stores the boss text inline (FR/EN). No other file needs to
   know about it beyond the per-frame _updateBossHint(dt) call in scene.js and
   the _resetBossHint() teardown hooks (shutdown + tutorial relaunch).
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  /* ---- language (mirror the rest of the game) ---- */
  function bhFr() {
    try { return (localStorage.getItem('portfolio_lang') || 'fr') !== 'en'; }
    catch (e) { return true; }
  }
  function esc(s) { return LA.escHtml ? LA.escHtml(s) : String(s); }

  /* ---- per-boss copy: name, accent colour, glyph, weakness blurb (FR/EN) ----
     `c-key` spans get coloured by the stylesheet so the key verbs/objects pop. */
  var HINTS = {
    anomaly: {
      col: '#ff66cc', glyph: '◈',
      nameFr: "L'Anomalie",          nameEn: 'The Anomaly',
      descFr: "Son <b class='c-key'>bouclier est invulnérable</b> tant qu'elle garde des ennemis prisonniers dans sa zone. <b>Élimine tous les ennemis qu'elle a invoqués</b> pour faire tomber le bouclier — puis frappe-la pendant qu'elle panique.",
      descEn: "Its <b class='c-key'>shield is invulnerable</b> while it keeps enemies trapped in its zone. <b>Clear every enemy it has summoned</b> to drop the shield — then strike while it panics.",
    },
    gigaBruiser: {
      col: '#d98aff', glyph: '⬢',
      nameFr: 'Le Mastodonte',       nameEn: 'The Giga Bruiser',
      descFr: "Tes attaques normales <b>rebondissent</b> sur son bouclier. Brèche-le avec une <b class='c-key'>dash-attaque</b> : il peut alors se téléporter — poursuis-le et frappe son <b>cœur exposé</b> avant qu'il ne se reforme.",
      descEn: "Normal attacks <b>bounce off</b> its shield. Break it with a <b class='c-key'>dash-attack</b>: it may then teleport — chase it down and hit the <b>exposed core</b> before the shield reforms.",
    },
    mirror: {
      col: '#ff8ad0', glyph: '◆',
      nameFr: 'Le Miroir',           nameEn: 'The Mirror',
      descFr: "Il <b>esquive</b> presque tout. Il n'est vulnérable qu'à la <b class='c-key'>fin de son propre dash</b> (surtout s'il rate : longue récupération). Provoque son attaque, esquive, puis punis. Tu peux aussi <b>parer ses projectilesA</b> en dash-attaque.",
      descEn: "It <b>dodges</b> almost everything. It's only open at the <b class='c-key'>end of its own dash</b> (especially on a whiff: long recovery). Bait its attack, dodge, then punish. You can also <b>parry its shards</b> with a dash-attack.",
    },
    snake: {
      col: '#5dff9b', glyph: '⸮',
      nameFr: 'Le Serpent',          nameEn: 'The Serpent',
      descFr: "Sa <b>tête blindée est invulnérable</b> (la toucher en dash te repousse). Vise uniquement les <b class='c-key'>segments du corps</b> : casser un segment <b>scinde</b> le serpent en deux. Pare ses crachats de venin en dash-attaque.",
      descEn: "Its <b>armoured head is invulnerable</b> (dashing into it bounces you off). Hit only the <b class='c-key'>body segments</b>: breaking one <b>splits</b> the serpent in two. Parry its venom spit with a dash-attack.",
    },
  };

  /* ---- stylesheet (injected once) ---- */
  function ensureStyles() {
    if (document.getElementById('_la-boss-hint-styles')) return;
    var st = document.createElement('style');
    st.id = '_la-boss-hint-styles';
    st.textContent = [
      '@keyframes la-bh-in{from{opacity:0;transform:translate(-50%,26px) scale(.96)}to{opacity:1;transform:translate(-50%,0) scale(1)}}',
      '@keyframes la-bh-out{from{opacity:1;transform:translate(-50%,0) scale(1)}to{opacity:0;transform:translate(-50%,18px) scale(.97)}}',
      '@keyframes la-bh-glow{0%,100%{box-shadow:0 0 0 1px var(--bh-col-soft),0 10px 34px -6px rgba(0,0,0,.7),0 0 18px -2px var(--bh-col-glow)}50%{box-shadow:0 0 0 1px var(--bh-col-line),0 10px 34px -6px rgba(0,0,0,.7),0 0 34px 2px var(--bh-col-glow)}}',
      '@keyframes la-bh-sheen{0%{transform:translateX(-120%)}60%,100%{transform:translateX(220%)}}',

      '#_la-boss-hint{position:absolute;left:50%;bottom:5.6rem;transform:translateX(-50%);' +
        'z-index:54;pointer-events:none;font-family:monospace;' +
        'width:min(560px,86%);box-sizing:border-box;' +
        'padding:1rem 1.15rem 1.05rem;border-radius:14px;overflow:hidden;' +
        'border:1.5px solid var(--bh-col-line);' +
        'background:linear-gradient(160deg,rgba(8,10,16,.94),rgba(14,12,22,.97));' +
        'backdrop-filter:blur(3px);' +
        'animation:la-bh-in .46s cubic-bezier(.22,1,.36,1) both,la-bh-glow 2.6s ease-in-out infinite .46s}',
      '#_la-boss-hint.la-bh-closing{animation:la-bh-out .42s ease-in both!important}',

      /* sliding sheen across the card on entry */
      '#_la-boss-hint .la-bh-sheen{position:absolute;top:0;left:0;width:42%;height:100%;pointer-events:none;' +
        'background:linear-gradient(100deg,transparent,var(--bh-col-glow),transparent);opacity:.5;' +
        'animation:la-bh-sheen 1.15s cubic-bezier(.4,0,.2,1) .25s both}',

      /* header row: badge + glyph + boss name */
      '#_la-boss-hint .la-bh-head{display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem}',
      '#_la-boss-hint .la-bh-badge{font-size:calc(.5rem * var(--la-ui-scale));letter-spacing:.24em;font-weight:700;' +
        'text-transform:uppercase;padding:.22rem .5rem;border-radius:6px;white-space:nowrap;' +
        'color:#08060a;background:var(--bh-col);box-shadow:0 0 12px -1px var(--bh-col-glow)}',
      '#_la-boss-hint .la-bh-glyph{font-size:calc(1.05rem * var(--la-ui-scale));line-height:1;color:var(--bh-col);' +
        'text-shadow:0 0 10px var(--bh-col-glow)}',
      '#_la-boss-hint .la-bh-name{font-size:calc(.96rem * var(--la-ui-scale));font-weight:800;letter-spacing:.08em;' +
        'color:var(--bh-col);text-shadow:0 0 12px var(--bh-col-glow)}',

      '#_la-boss-hint .la-bh-desc{font-size:calc(.74rem * var(--la-ui-scale));line-height:1.62;color:#c9d2de}',
      '#_la-boss-hint .la-bh-desc b{color:#eef4fb;font-weight:700}',
      '#_la-boss-hint .la-bh-desc b.c-key{color:var(--bh-col);font-weight:800;text-shadow:0 0 10px var(--bh-col-glow)}',

      /* thin life bar that drains over the tooltip's lifetime */
      '#_la-boss-hint .la-bh-life{position:absolute;left:0;bottom:0;height:3px;width:100%;transform-origin:left center;' +
        'background:var(--bh-col);box-shadow:0 0 10px var(--bh-col-glow);opacity:.85}',
    ].join('');
    document.head.appendChild(st);
  }

  /* hex "#rrggbb" → "rgba(r,g,b,a)" for the soft/line/glow accent variants */
  function rgba(hex, a) {
    var h = hex.replace('#', '');
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ---- live state init / reset ---- */
  M._resetBossHint = function () {
    this._removeBossHintDom();
    // Per-type "already shown / already met" memory. Reset gives a clean slate;
    // within a run it then persists across sandbox respawns (instance state, so a
    // fresh scene — or a tutorial relaunch — starts teaching each boss anew).
    this._bossHintDone     = {};
    this._bossHintMet      = {};
    this._bossHintType     = null;   // boss type currently being timed
    this._bossHintArmed    = false;  // is the timer arming a hint for this instance?
    this._bossHintT        = 0;      // seconds the current boss has been alive
    this._bossHintLifeT    = 0;      // seconds the visible tooltip has left
    this._bossHintShowing  = false;
  };

  /* Which mini-boss is alive and still being fought (null = none / already dead).
     The four bosses are NOT in this.enemies — they're standalone fields, each
     with a `.dead` flag set the instant the player kills it. */
  M._currentBossType = function () {
    if (this._anomaly     && !this._anomaly.dead)     return 'anomaly';
    if (this._gigaBruiser && !this._gigaBruiser.dead) return 'gigaBruiser';
    if (this._mirror      && !this._mirror.dead)      return 'mirror';
    if (this._snake       && !this._snake.dead)       return 'snake';
    return null;
  };

  /* ---- per-frame driver (real dt seconds) — called from scene.update() ---- */
  M._updateBossHint = function (dt) {
    if (this._bossHintDone === undefined) this._resetBossHint();

    // Tick down a visible tooltip independently of the boss still being alive
    // (so it still fades out on its own even after the boss dies).
    if (this._bossHintShowing) {
      this._bossHintLifeT -= dt;
      if (this._bossHintLifeT <= 0) this._dismissBossHint();
      else this._renderBossHintLife();
    }

    var type = this._currentBossType();

    // No boss being fought → forget the current instance (a NEW boss of the same
    // type later is a repeat encounter and won't re-arm; see _bossHintMet).
    if (!type) { this._bossHintType = null; this._bossHintArmed = false; this._bossHintT = 0; return; }

    // A new boss just became the one we're tracking → decide whether to arm.
    if (this._bossHintType !== type) {
      this._bossHintType  = type;
      this._bossHintT     = 0;
      var firstMeeting    = !this._bossHintMet[type];
      this._bossHintMet[type] = true;
      // Arm only in sandbox, only the FIRST time this type is met, only if its
      // hint was never shown, and never over the tutorial's own lesson overlay.
      this._bossHintArmed =
        firstMeeting &&
        !this._bossHintDone[type] &&
        !this._tutorialActive &&
        window.__laGameMode === 'sandbox';
      return;
    }

    if (!this._bossHintArmed) return;

    this._bossHintT += dt;
    if (this._bossHintT >= (C.BOSS_HINT_DELAY_S || 60)) {
      this._bossHintArmed = false;
      this._bossHintDone[type] = true;
      this._showBossWeaknessHint(type);
    }
  };

  /* ---- build + slide in the tooltip ---- */
  M._showBossWeaknessHint = function (type) {
    var data = HINTS[type];
    if (!data) return;
    var container = this.game && this.game.canvas && this.game.canvas.parentElement;
    if (!container) return;

    this._removeBossHintDom();
    ensureStyles();

    var fr = bhFr();
    var box = document.createElement('div');
    box.id = '_la-boss-hint';
    box.style.setProperty('--bh-col',      data.col);
    box.style.setProperty('--bh-col-soft', rgba(data.col, 0.28));
    box.style.setProperty('--bh-col-line', rgba(data.col, 0.6));
    box.style.setProperty('--bh-col-glow', rgba(data.col, 0.45));
    box.innerHTML =
      '<span class="la-bh-sheen"></span>' +
      '<div class="la-bh-head">' +
        '<span class="la-bh-badge">' + (fr ? 'Faiblesse' : 'Weakness') + '</span>' +
        '<span class="la-bh-glyph">' + data.glyph + '</span>' +
        '<span class="la-bh-name">' + esc(fr ? data.nameFr : data.nameEn) + '</span>' +
      '</div>' +
      '<div class="la-bh-desc">' + (fr ? data.descFr : data.descEn) + '</div>' +
      '<span class="la-bh-life"></span>';

    container.style.position = 'relative';
    container.appendChild(box);

    this._bossHintBox     = box;
    this._bossHintLifeEl  = box.querySelector('.la-bh-life');
    this._bossHintShowing = true;
    this._bossHintLifeT   = (C.BOSS_HINT_LIFE_S || 11);
    this._bossHintLifeMax = this._bossHintLifeT;
  };

  /* drain the life bar each frame (cheap; only while showing) */
  M._renderBossHintLife = function () {
    if (!this._bossHintShowing || !this._bossHintLifeEl) return;
    var frac = Math.max(0, this._bossHintLifeT / (this._bossHintLifeMax || 1));
    this._bossHintLifeEl.style.transform = 'scaleX(' + frac + ')';
  };

  /* ---- graceful fade-out, then remove ---- */
  M._dismissBossHint = function () {
    var box = this._bossHintBox;
    this._bossHintShowing = false;
    this._bossHintLifeEl  = null;
    if (!box) return;
    this._bossHintBox = null;
    box.classList.add('la-bh-closing');
    var done = function () { if (box.parentNode) box.parentNode.removeChild(box); };
    box.addEventListener('animationend', done);
    // Backstop in case the animationend never fires (tab backgrounded, etc.).
    setTimeout(done, 600);
  };

  /* ---- hard teardown (no animation) — shutdown / tutorial relaunch ---- */
  M._removeBossHintDom = function () {
    if (this._bossHintBox && this._bossHintBox.parentNode) {
      this._bossHintBox.parentNode.removeChild(this._bossHintBox);
    }
    var stray = document.getElementById('_la-boss-hint');
    if (stray && stray.parentNode) stray.parentNode.removeChild(stray);
    this._bossHintBox     = null;
    this._bossHintLifeEl  = null;
    this._bossHintShowing = false;
  };
})();

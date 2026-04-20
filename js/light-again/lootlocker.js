/* ==========================================================================
   Light Again — LootLocker API & i18n helpers
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;

  /* ---- HTML escaping ---- */

  LA.escHtml = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  /* ---- Game-over i18n (robust fallback) ---- */

  LA.laGoT = function (key) {
    var FB_FR = {
      laGoScore: 'Score', laGoBestCombo: 'Meilleur combo', laGoKills: 'Ennemis éliminés',
      laGoRecord: 'Record personnel', laGoReplay: 'Rejouer', laGoEnterHint: 'ou appuie sur Entrée',
      laGoWorldRecord: 'Top 10 mondial', laGoLoading: 'Chargement…', laGoRestarting: 'Relance…', laGoError: 'Hors-ligne',
      laGoSubmit: 'Soumettre', laGoSubmitted: 'Envoyé !', laGoNewRecord: 'Nouveau record !',
      laGoNamePlc: 'Ton pseudo',
      laUpTitle: 'Choisis une am\u00e9lioration',
      laUpDashAtkName: 'Dash-Attaque', laUpDashAtkDesc1: 'Attaque plus grosse et plus rapide.', laUpDashAtkDesc2: 'L\'attaque aspire les explosions environnantes.',
      laUpDetonationName: 'D\u00e9tonation', laUpDetonationDesc1: 'Les marques durent 2 fois plus longtemps.', laUpDetonationDesc2: 'Le rayon de la d\u00e9tonation est 1.5\u00d7 plus grand.',
      laUpDashName: 'Dash', laUpDashDesc1: 'Dash plus rapide, r\u00e9cup\u00e9ration plus courte.', laUpDashDesc2: 'Le Dash laisse une tornade qui aspire les ennemis proches pendant 3s.',
      laUpBaseAtkName: 'Attaque Torpille', laUpBaseAtkDesc1: 'L\'attaque laisse une explosion \u00e0 l\'impact.', laUpBaseAtkDesc2: 'Chance de d\u00e9clencher une explosion g\u00e9ante.',
      laUpAvailable: 'Amélioration disponible…', laUpShield: 'Shield', laUpShieldName: 'Shield', laUpShieldDesc1: '+1 emplacement de shield.', laUpShieldDesc2: '+1 emplacement de shield supplémentaire.', laUpTheWorldName: 'The World', laUpTheWorldDesc1: 'Le clic molette arrête le temps pendant 3 secondes. (Cooldown : 30s)', laDelayExp: 'Explosion Retardée',
    };
    var FB_EN = {
      laGoScore: 'Score', laGoBestCombo: 'Best combo', laGoKills: 'Enemies eliminated',
      laGoRecord: 'Personal best', laGoReplay: 'Play again', laGoEnterHint: 'or press Enter',
      laGoWorldRecord: 'World Top 10', laGoLoading: 'Loading…', laGoRestarting: 'Restarting…', laGoError: 'Offline',
      laGoSubmit: 'Submit', laGoSubmitted: 'Submitted!', laGoNewRecord: 'New record!',
      laGoNamePlc: 'Your name',
      laUpTitle: 'Choose an upgrade',
      laUpDashAtkName: 'Dash-Attack', laUpDashAtkDesc1: 'Attack is bigger and faster.', laUpDashAtkDesc2: 'Attack pulls in nearby explosions.',
      laUpDetonationName: 'Detonation', laUpDetonationDesc1: 'Enemy marks last twice as long.', laUpDetonationDesc2: 'Detonation radius is 1.5x larger.',
      laUpDashName: 'Dash', laUpDashDesc1: 'Faster dash, shorter cooldown.', laUpDashDesc2: 'Dash leaves a tornado that pulls nearby enemies for 3s.',
      laUpBaseAtkName: 'Torpedo Attack', laUpBaseAtkDesc1: 'Attack leaves a small explosion on impact.', laUpBaseAtkDesc2: 'Chance to trigger a giant explosion.',
      laUpAvailable: 'Upgrade available…', laUpShield: 'Shield', laUpShieldName: 'Shield', laUpShieldDesc1: '+1 shield slot.', laUpShieldDesc2: '+1 additional shield slot.', laUpTheWorldName: 'The World', laUpTheWorldDesc1: 'Middle-click stops time for 3 seconds. (Cooldown: 30s)', laDelayExp: 'Delayed Explosion',
    };
    var lang = 'fr';
    try {
      lang = (localStorage.getItem('portfolio_lang') || document.documentElement.getAttribute('lang') || 'fr').toLowerCase().slice(0, 2);
    } catch (e) { /* ignore */ }
    var FB = lang === 'en' ? FB_EN : FB_FR;
    var si = window.SITE_I18N;
    if (si) {
      var row = si[lang] || si.en || si.fr;
      if (row && row[key]) return row[key];
      if (si.fr && si.fr[key]) return si.fr[key];
    }
    if (typeof window.__siteT === 'function') {
      var r = window.__siteT(key);
      if (r && r !== key) return r;
    }
    return FB[key] || key;
  };

  /* ---- Restart loader overlay ---- */

  LA.injectLaRestartLoader = function (host) {
    if (!host || document.getElementById('_la-restart-loading')) return;
    var bgCol = LA.getColors().bgColor;
    var bgCss = '#' + ('000000' + bgCol.toString(16)).slice(-6);
    var label = LA.escHtml(LA.laGoT('laGoRestarting'));
    var lo = document.createElement('div');
    lo.id = '_la-restart-loading';
    lo.setAttribute('role', 'status');
    lo.setAttribute('aria-live', 'polite');
    lo.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:1',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:' + bgCss,
      'pointer-events:none',
    ].join(';');
    lo.innerHTML =
      '<style>@keyframes _la-rs-spin{to{transform:rotate(360deg)}}@keyframes _la-rs-pulse{0%,100%{opacity:.42}50%{opacity:.95}}</style>' +
      '<div style="display:flex;flex-direction:column;align-items:center;gap:.55rem">' +
        '<div style="width:26px;height:26px;border:2px solid rgba(0,255,255,0.1);border-top-color:rgba(0,255,255,0.72);border-radius:50%;animation:_la-rs-spin .55s linear infinite"></div>' +
        '<span style="font-family:monospace;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(0,255,255,0.4);animation:_la-rs-pulse .95s ease-in-out infinite">' + label + '</span>' +
      '</div>';
    host.style.position = 'relative';
    host.appendChild(lo);
  };

  /* ---- LootLocker API ---- */

  var LL_API      = 'https://api.lootlocker.io';
  var LL_GAME_KEY = 'dev_9c2377a4f943498fb6c581ffa111a7e4';
  var LL_LB_KEY   = 'global_high_scores';
  var _llToken    = null;
  var _llPlayerId = null;
  var _llPlayerIdentifier = null;

  LA.llGetToken    = function () { return _llToken; };
  LA.llGetPlayerId = function () { return _llPlayerId; };

  LA.llInit = function (cb) {
    var stored = localStorage.getItem('ll_player_id');
    var body = { game_key: LL_GAME_KEY, game_version: '1.0.0' };
    if (stored) body.player_identifier = stored;

    fetch(LL_API + '/game/v2/session/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.success) {
        _llToken = d.session_token;
        _llPlayerId = d.player_id;
        _llPlayerIdentifier = d.player_identifier;
        localStorage.setItem('ll_player_id', d.player_identifier);
      }
      if (cb) cb(d.success ? null : 'login_failed');
    })
    .catch(function () { if (cb) cb('network'); });
  };

  LA.llGetTop = function (count, cb) {
    if (!_llToken) { cb('no_session', null); return; }
    var bust = '&_=' + Date.now();
    fetch(LL_API + '/game/leaderboards/' + LL_LB_KEY + '/list?count=' + count + bust, {
      headers: { 'x-session-token': _llToken, 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) { cb('http', null); return; }
      cb(null, (res.d && res.d.items) ? res.d.items : []);
    })
    .catch(function () { cb('network', null); });
  };

  LA.llSetName = function (name, cb) {
    if (!_llToken) { cb('no_session'); return; }
    fetch(LL_API + '/game/player/name', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-session-token': _llToken },
      body: JSON.stringify({ name: name }),
    })
    .then(function (r) { return r.json(); })
    .then(function () { cb(null); })
    .catch(function () { cb('network'); });
  };

  LA.llSubmitScore = function (score, cb) {
    if (!_llToken) { cb('no_session'); return; }
    var scoreInt = Math.round(Number(score));
    fetch(LL_API + '/game/leaderboards/' + LL_LB_KEY + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': _llToken },
      body: JSON.stringify({ member_id: String(_llPlayerId), score: scoreInt }),
    })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      var d = res.d;
      if (!res.ok || (d && d.success === false)) {
        var msg = (d && (d.message || d.error || (d.messages && d.messages[0]) || d.text)) || 'submit_failed';
        cb(msg, d);
        return;
      }
      cb(null, d);
    })
    .catch(function () { cb('network', null); });
  };

  LA.llGetMyBestSubmitted = function (playerId, apiItems) {
    var pid = String(playerId);
    var best = null;
    var i, sc;
    for (i = 0; i < (apiItems || []).length; i++) {
      if (String(apiItems[i].member_id) !== pid) continue;
      sc = Number(apiItems[i].score);
      if (best === null || sc > best) best = sc;
    }
    return best;
  };

  LA.llCountAbove = function (apiItems, playerScore) {
    var n = 0;
    for (var i = 0; i < (apiItems || []).length; i++) {
      if (Number(apiItems[i].score) > playerScore) n++;
    }
    return n;
  };

})();

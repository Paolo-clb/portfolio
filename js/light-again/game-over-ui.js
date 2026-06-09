/* ==========================================================================
   Light Again — Game Over Screen (scene method)
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;

  LA.sceneMethods._showGameOverScreen = function () {
    if (document.getElementById('_la-go-overlay')) return;

    // Visualizer: the run is dead and the music switches to the game-over track —
    // full-brightness menu look + artist label (distinct context from the home menu).
    if (window.LAViz) window.LAViz.toMenu({ muffled: false, context: 'gameover' });

    var canvas    = this.game.canvas;
    var container = canvas.parentElement;
    var playerScore = this.score;
    var runCombo    = Math.max(this.bestCombo || 1, this.comboMultiplier);
    var runKills    = this.totalKills || 0;
    var sceneRef    = this;
    // Handles for the leaderboard-submit poll's self-rescheduling setTimeouts.
    // These run on the real-time clock (not Phaser's), so without explicit
    // cancellation they outlive a restart/Home and keep poking the (now detached)
    // overlay DOM for up to ~4s × retries — a leak that pins the old game-over
    // panel. dismissGameOver clears them.
    var pollTimers  = [];

    var t = LA.laGoT;
    var _escHtml = LA.escHtml;
    var _llPlayerId = LA.llGetPlayerId();

    // ----- All-time records (local) -----
    // Game-over only ever appears in hardcore, so these are the hardcore bests.
    // Each is compared against the run we just finished; a beaten record gets a
    // celebratory pop + green glow + "★ Record !" badge in the Records section.
    function readRec(key) { return parseInt(localStorage.getItem(key), 10) || 0; }
    var prevScore = readRec('lightGameHighScore');
    var prevCombo = readRec('lightGameBestCombo');
    var prevKills = readRec('lightGameBestKills');

    var isNewScore = playerScore > prevScore;
    var isNewCombo = runCombo > prevCombo;
    var isNewKills = runKills > prevKills;

    if (isNewScore) localStorage.setItem('lightGameHighScore', playerScore);
    if (isNewCombo) localStorage.setItem('lightGameBestCombo', runCombo);
    if (isNewKills) localStorage.setItem('lightGameBestKills', runKills);

    var bestScore = Math.max(playerScore, prevScore);
    var bestCombo = Math.max(runCombo, prevCombo);
    var bestKills = Math.max(runKills, prevKills);

    // ----- Inject keyframes -----
    if (!document.getElementById('_la-go-styles')) {
      var st = document.createElement('style');
      st.id = '_la-go-styles';
      st.textContent =
        '@keyframes la-go-fade-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}' +
        '@keyframes la-go-glow{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 22px 4px var(--la-accent-glow)}}' +
        '@keyframes la-go-spin{to{transform:rotate(360deg)}}' +
        // Beaten-record juice: the value pops in, the cell keeps a soft green
        // pulse, and the badge slides down. Green = success (see theming note).
        '@keyframes la-go-rec-pop{0%{transform:scale(.4);opacity:0}55%{transform:scale(1.28)}80%{transform:scale(.94)}100%{transform:scale(1);opacity:1}}' +
        '@keyframes la-go-rec-glow{0%,100%{box-shadow:0 0 7px rgba(0,255,136,0.10);border-color:rgba(0,255,136,0.32)}50%{box-shadow:0 0 18px rgba(0,255,136,0.30);border-color:rgba(0,255,136,0.6)}}' +
        '@keyframes la-go-badge-in{0%{opacity:0;transform:translateY(-5px) scale(.6)}70%{transform:translateY(0) scale(1.12)}100%{opacity:1;transform:none}}';
      document.head.appendChild(st);
    }

    // ----- CSS helpers -----
    // Font-sizes are multiplied by var(--la-ui-scale) so the "Gros texte" toggle
    // (a .la-big-text class on the canvas container) scales this whole pop-up.
    var sLbl = 'font-size:calc(.55rem * var(--la-ui-scale));letter-spacing:.1em;color:#7799bb;text-transform:uppercase;display:block;margin-bottom:.15rem';
    var sVal = function (c) { return 'font-size:calc(1.2rem * var(--la-ui-scale));font-weight:700;color:' + c + ';text-shadow:0 0 8px ' + c + '44'; };
    var sSection = 'font-size:calc(.55rem * var(--la-ui-scale));letter-spacing:.16em;color:#5577aa;text-transform:uppercase;margin:.2rem 0 .45rem;text-align:center';
    var statCol = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.12rem;min-width:0';

    // ----- Build overlay -----
    var overlay = document.createElement('div');
    overlay.id  = '_la-go-overlay';
    // Full-screen scrim matches the home / mode-select look (var(--la-win-bg)):
    // the frozen death scene stays visible behind a soft, theme-aware dim, so the
    // panel itself can be near-transparent instead of a heavy blurred slab.
    overlay.style.cssText = 'position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:monospace;background:var(--la-win-bg)';

    var panel = document.createElement('div');
    panel.style.cssText = [
      'pointer-events:auto', 'text-align:center',
      'padding:1.3rem 1.8rem 1rem', 'border:1px solid var(--la-accent-soft)', 'border-radius:14px',
      // Like the home cards: a very faint accent tint + only a light blur. The
      // overlay scrim above does the legibility work, so this stays see-through.
      'background:var(--la-accent-faint)', 'max-width:430px', 'width:92%', 'color:#e0e0ff',
      '-webkit-backdrop-filter:blur(3px)', 'backdrop-filter:blur(3px)',
      'max-height:85vh', 'overflow-y:auto',
      'animation:la-go-fade-in 0.4s cubic-bezier(0.22,1,0.36,1) both,la-go-glow 2.4s ease infinite',
    ].join(';');

    // ----- Record cell builder (Records section) -----
    // A beaten record pops in, keeps a green pulsing frame, and shows a badge;
    // an un-beaten record sits in a neutral faint frame. `delay` staggers the pops.
    function recCell(label, value, color, beaten, delay) {
      var cell = statCol + ';padding:.5rem .35rem;border-radius:9px;border:1px solid ';
      cell += beaten
        ? 'rgba(0,255,136,0.45);background:rgba(0,255,136,0.06);animation:la-go-rec-glow 1.9s ' + delay + 's ease-in-out infinite'
        : 'rgba(255,255,255,0.07);background:rgba(255,255,255,0.02)';
      var valStyle = sVal(color) + ';display:inline-block';
      if (beaten) valStyle += ';animation:la-go-rec-pop .65s ' + delay + 's cubic-bezier(0.34,1.56,0.64,1) both';
      var badge = beaten
        ? '<span style="display:block;margin-top:.1rem;font-size:calc(.48rem * var(--la-ui-scale));font-weight:700;letter-spacing:.08em;color:#00ff88;text-transform:uppercase;animation:la-go-badge-in .5s ' + (delay + 0.25) + 's both">★ ' + t('laGoNewBadge') + '</span>'
        : '';
      return '<div style="' + cell + '"><span style="' + sLbl + '">' + label + '</span><span style="' + valStyle + '">' + value + '</span>' + badge + '</div>';
    }

    // Row 1: this run's score — the standalone prominent headline.
    var row1 =
      '<div style="margin-bottom:.9rem;display:flex;flex-direction:column;align-items:center;gap:.1rem">' +
        '<span style="' + sLbl + ';font-size:calc(.6rem * var(--la-ui-scale))">' + t('laGoScore') + '</span>' +
        '<span id="_la-go-score-val" style="font-size:calc(2.4rem * var(--la-ui-scale));font-weight:800;line-height:1;color:#00ffff;text-shadow:0 0 16px #00ffff66;display:inline-block">0</span>' +
      '</div>';

    // Row 2: the rest of this run's stats (combo + kills), clearly grouped under
    // a "This run" header so they read as run data, not all-time records.
    var row2 =
      '<div style="' + sSection + '">' + t('laGoThisRun') + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem .6rem;margin-bottom:.6rem">' +
        '<div style="' + statCol + '"><span style="' + sLbl + '">' + t('laGoComboShort') + '</span><span style="' + sVal('#ffcc00') + '">x' + runCombo + '</span></div>' +
        '<div style="' + statCol + '"><span style="' + sLbl + '">' + t('laGoKillsShort') + '</span><span style="' + sVal('#ff6644') + '">' + runKills + '</span></div>' +
      '</div>';

    // Row 3: all-time records — Score / Combo / Kills. Beaten ones celebrate.
    var row3 =
      '<div style="' + sSection + '">' + t('laGoRecords') + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.45rem;margin-bottom:.7rem">' +
        recCell(t('laGoScore'), bestScore, '#00ffff', isNewScore, 0.15) +
        recCell(t('laGoComboShort'), 'x' + bestCombo, '#ffcc00', isNewCombo, 0.30) +
        recCell(t('laGoKillsShort'), bestKills, '#ff6644', isNewKills, 0.45) +
      '</div>';

    // Game-over mode context.
    // Game-over only ever appears in hardcore (sandbox respawns); leaderboard
    // submission lives below and is gated strictly on this flag.
    var isHardcore = window.__laGameMode === 'hardcore';
    var unlocked = typeof LA.laIsHardcoreUnlocked === 'function' ? LA.laIsHardcoreUnlocked() : false;

    // Replay buttons
    var btnHtml =
      '<div style="font-size:calc(.55rem * var(--la-ui-scale));letter-spacing:.12em;color:#5577aa;text-transform:uppercase;margin-bottom:.45rem">' + t('laGoReplayPrompt') + '</div>' +
      '<div style="display:flex;gap:.6rem;justify-content:center;margin-bottom:.4rem">' +
        '<button id="_la-go-sandbox" style="padding:.5rem 1.3rem;border:1.5px solid var(--la-accent-line);border-radius:8px;background:var(--la-accent-fill);color:var(--la-accent);font-family:monospace;font-size:calc(.85rem * var(--la-ui-scale));font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:background .2s,box-shadow .2s">' + t('laGoSandboxBtn') + '</button>' +
        '<button id="_la-go-hardcore"' + (unlocked ? '' : ' disabled') + ' style="padding:.5rem 1.3rem;border:1.5px solid rgba(255,60,0,' + (unlocked ? '0.55' : '0.18') + ');border-radius:8px;background:rgba(255,60,0,' + (unlocked ? '0.1' : '0.04') + ');color:' + (unlocked ? '#ff4422' : '#442211') + ';font-family:monospace;font-size:calc(.85rem * var(--la-ui-scale));font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:' + (unlocked ? 'pointer' : 'not-allowed') + ';transition:background .2s,box-shadow .2s">' + t('laGoHardcoreBtn') + '</button>' +
      '</div>' +
      '<div style="font-size:calc(.55rem * var(--la-ui-scale));color:#556688;letter-spacing:.06em;margin-bottom:.6rem">' + t('laGoEnterHint') + '</div>';

    // Leaderboard only in hardcore
    var lbSpinRow =
      '<div style="width:18px;height:18px;border:2px solid var(--la-accent-soft);border-top-color:var(--la-accent);border-radius:50%;animation:la-go-spin .7s linear infinite"></div>' +
      '<span style="margin-left:.5rem;font-size:calc(.65rem * var(--la-ui-scale));color:#6688aa">' + t('laGoLoading') + '</span>';
    var lbHtml = isHardcore
      ? '<div style="' + sSection + '">' + t('laGoWorldRecord') + '</div>' +
        '<div id="_la-go-lb" style="position:relative;min-height:60px">' +
          '<div id="_la-go-lb-body" style="min-height:60px;display:flex;align-items:center;justify-content:center">' +
            lbSpinRow +
          '</div>' +
        '</div>'
      : '';

    // Options row: the accessibility "Gros texte" toggle plus the "I am Steve"
    // pickaxe skin, side by side (mirrors the pause-menu .la-ms-opts layout).
    var optLabel = 'display:inline-flex;align-items:center;gap:.45rem;margin:0;font-size:calc(.62rem * var(--la-ui-scale));letter-spacing:.05em;color:#8aa3c0;cursor:pointer;user-select:none';
    var optsHtml =
      '<div style="display:flex;gap:1.6rem;flex-wrap:wrap;justify-content:center;align-items:center;margin:0 0 .7rem">' +
        '<label id="_la-go-bigtext-wrap" style="' + optLabel + '">' +
          '<input type="checkbox" id="_la-go-bigtext" style="width:14px;height:14px;margin:0;accent-color:#5fe0cf;cursor:pointer">' +
          '<span>' + t('laGoBigText') + '</span>' +
        '</label>' +
        '<label id="_la-go-steve-wrap" style="' + optLabel + '">' +
          '<input type="checkbox" id="_la-go-steve" style="width:14px;height:14px;margin:0;accent-color:#5fe0cf;cursor:pointer">' +
          '<span>I am Steve</span>' +
        '</label>' +
      '</div>';

    var divider = '<div style="height:1px;margin:.2rem 0 .7rem;background:linear-gradient(90deg,transparent,var(--la-accent-soft),transparent)"></div>';

    panel.innerHTML = row1 + row2 + row3 + divider + btnHtml + optsHtml + lbHtml;
    overlay.appendChild(panel);

    // ----- Wire "Gros texte" toggle (same behaviour as the pause menu) -----
    // Toggles .la-big-text on the modal so --la-ui-scale grows every pop-up at
    // once; the state is read off the modal and mirrored to localStorage.
    var laModal = container.closest('.light-again-modal') || container;
    var bigTextCb = panel.querySelector('#_la-go-bigtext');
    if (bigTextCb) {
      bigTextCb.checked = laModal.classList.contains('la-big-text');
      bigTextCb.addEventListener('change', function () {
        laModal.classList.toggle('la-big-text', bigTextCb.checked);
        try { localStorage.setItem('la_big_text', bigTextCb.checked ? '1' : '0'); } catch (e) { /* ignore */ }
      });
    }

    // ----- Wire "I am Steve" skin toggle (applies on the next replay) -----
    var steveCb = panel.querySelector('#_la-go-steve');
    if (steveCb) {
      steveCb.checked = !!window.__laSteveSkin;
      steveCb.addEventListener('change', function () {
        window.__laSteveSkin = steveCb.checked;
        try { localStorage.setItem('la_skin_steve', steveCb.checked ? '1' : '0'); } catch (e) { /* ignore */ }
      });
    }

    // ----- Wire replay buttons -----
    var sbBtn = panel.querySelector('#_la-go-sandbox');
    var hcBtn = panel.querySelector('#_la-go-hardcore');

    sbBtn.addEventListener('mouseenter', function () { sbBtn.style.background = 'var(--la-accent-fill-hi)'; sbBtn.style.boxShadow = '0 0 16px var(--la-accent-glow)'; });
    sbBtn.addEventListener('mouseleave', function () { sbBtn.style.background = 'var(--la-accent-fill)'; sbBtn.style.boxShadow = ''; });
    if (unlocked) {
      hcBtn.addEventListener('mouseenter', function () { hcBtn.style.background = 'rgba(255,60,0,0.2)'; hcBtn.style.boxShadow = '0 0 14px rgba(255,60,0,0.18)'; });
      hcBtn.addEventListener('mouseleave', function () { hcBtn.style.background = 'rgba(255,60,0,0.11)'; hcBtn.style.boxShadow = ''; });
    }

    function clearGameOverHostFlag() {
      try { delete container.dataset.laGameover; } catch (e) { /* ignore */ }
    }
    function doReplay(mode) {
      clearGameOverHostFlag();
      overlay.remove();
      if (window.LAViz) window.LAViz.toGame();   // game-over → replay: in-game look
      document.removeEventListener('keydown', onKey);
      window.__laGameMode = mode;
      if (typeof window.__laOnModeChange === 'function') window.__laOnModeChange(mode);
      try { window.__laRestartPending = true; } catch (e) { /* ignore */ }
      LA.injectLaRestartLoader(container);
      try { void container.offsetHeight; } catch (e2) { /* ignore */ }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          sceneRef.scene.resume();
          sceneRef.scene.restart();
        });
      });
    }
    function onKey(e) {
      if (e.key !== 'Enter') return;
      var ae = document.activeElement;
      if (ae && ae.id === '_la-go-name') return;
      e.preventDefault();
      // Default: replay the mode just played (hardcore), unless the sandbox button is focused
      if (ae && ae.id === '_la-go-sandbox') doReplay('sandbox');
      else if (unlocked) doReplay('hardcore');
      else doReplay('sandbox');
    }
    sbBtn.addEventListener('click', function () { doReplay('sandbox'); });
    if (unlocked) hcBtn.addEventListener('click', function () { doReplay('hardcore'); });
    document.addEventListener('keydown', onKey);
    // Clean teardown — drops the keydown listener, clears the host flag and pulls
    // the overlay. Exposed so the shell can call it when the player presses Home
    // from this screen (otherwise the mode menu would overlap the translucent
    // game-over panel). Also runs on scene shutdown (replay/restart).
    function dismissGameOver() {
      document.removeEventListener('keydown', onKey);
      for (var pt = 0; pt < pollTimers.length; pt++) clearTimeout(pollTimers[pt]);
      pollTimers.length = 0;
      clearGameOverHostFlag();
      var el = document.getElementById('_la-go-overlay');
      if (el && el.parentNode) el.parentNode.removeChild(el);
      if (window.__laDismissGameOver === dismissGameOver) window.__laDismissGameOver = null;
    }
    window.__laDismissGameOver = dismissGameOver;
    this.events.once('shutdown', dismissGameOver);

    container.style.position = 'relative';
    container.dataset.laGameover = '1';
    container.appendChild(overlay);

    // Animate the headline score: count 0 → final (ease-out) then a small pop, so
    // the most important number on the screen finally has the juice the records do.
    (function () {
      var el = document.getElementById('_la-go-score-val');
      if (!el || !playerScore) { if (el) el.textContent = playerScore; return; }
      var dur = 620, t0 = null;
      function step(ts) {
        if (!document.getElementById('_la-go-overlay')) return;   // bail if dismissed
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur);
        el.textContent = Math.round(playerScore * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
        else { el.textContent = playerScore; el.style.animation = 'la-go-rec-pop .4s cubic-bezier(0.34,1.56,0.64,1)'; }
      }
      requestAnimationFrame(step);
    })();
    // A new personal-best score turns the panel's pulsing glow GREEN (success) —
    // celebrates a record run differently from an ordinary one.
    if (isNewScore) panel.style.setProperty('--la-accent-glow', 'rgba(0,255,136,0.5)');

    // Default keyboard focus on the "replay hardcore" choice (submit form will steal
    // focus to the name input later if the score qualifies for the leaderboard)
    if (unlocked && hcBtn) hcBtn.focus();

    // Pause scene
    var self2 = this;
    this.time.delayedCall(50, function () { self2.scene.pause(); });

    // ----- Leaderboard (hardcore only) -----
    if (!isHardcore) return;
    var lbEl = panel.querySelector('#_la-go-lb');
    var lastRenderedLbItems = null;

    function getLbBody() {
      return lbEl.querySelector('#_la-go-lb-body') || lbEl;
    }

    function removeLbOverlay() {
      var sh = lbEl.querySelector('#_la-go-lb-shade');
      if (sh) sh.remove();
      var body = getLbBody();
      if (body !== lbEl) {
        body.style.opacity = '';
        body.style.pointerEvents = '';
        body.style.transition = '';
      }
    }

    function setLbBodyHtml(inner) {
      removeLbOverlay();
      var body = getLbBody();
      body.innerHTML = inner;
    }

    function renderLeaderboardLoading() {
      lbEl.style.display = 'block';
      var body = getLbBody();
      var spinWrap = '<div style="min-height:60px;display:flex;align-items:center;justify-content:center">' + lbSpinRow + '</div>';
      if (body.querySelector('table')) {
        body.style.transition = 'opacity .22s ease';
        body.style.opacity = '0.48';
        body.style.pointerEvents = 'none';
        var shade = lbEl.querySelector('#_la-go-lb-shade');
        if (!shade) {
          shade = document.createElement('div');
          shade.id = '_la-go-lb-shade';
          shade.style.cssText =
            'position:absolute;left:0;top:0;right:0;bottom:0;z-index:2;display:flex;' +
            'align-items:center;justify-content:center;background:rgba(4,12,24,0.35);' +
            'backdrop-filter:blur(1px);-webkit-backdrop-filter:blur(1px)';
          shade.innerHTML = spinWrap;
          lbEl.appendChild(shade);
        } else {
          shade.innerHTML = spinWrap;
          shade.style.display = 'flex';
        }
      } else {
        removeLbOverlay();
        body.style.display = 'flex';
        body.style.alignItems = 'center';
        body.style.justifyContent = 'center';
        body.innerHTML = spinWrap;
      }
    }

    function renderLeaderboard(items) {
      items = items || [];
      lastRenderedLbItems = items.slice();
      removeLbOverlay();
      var body = getLbBody();
      body.style.display = 'block';
      body.style.width = '100%';
      var html = '<table style="width:100%;border-collapse:collapse;font-size:calc(.68rem * var(--la-ui-scale))">';
      html += '<tr style="color:#5577aa;text-transform:uppercase;letter-spacing:.08em"><td style="text-align:left;padding:.2rem .3rem">#</td><td style="text-align:left;padding:.2rem .3rem">Player</td><td style="text-align:right;padding:.2rem .3rem">Score</td></tr>';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var name = (it.player && it.player.name) ? it.player.name : ('Player ' + it.member_id);
        var isMe = String(it.member_id) === String(_llPlayerId);
        var rowCol = isMe ? 'color:#00ffff;font-weight:700' : 'color:#ccddef';
        var bg = i % 2 === 0 ? 'background:rgba(0,255,255,0.03)' : '';
        var rankDisp = it.rank;
        html += '<tr style="' + bg + ';' + rowCol + '">';
        html += '<td style="text-align:left;padding:.22rem .3rem;color:#5577aa;font-weight:700">' + rankDisp + '</td>';
        html += '<td style="text-align:left;padding:.22rem .3rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">' + _escHtml(name) + '</td>';
        html += '<td style="text-align:right;padding:.22rem .3rem;font-weight:700">' + it.score + '</td>';
        html += '</tr>';
      }
      html += '</table>';
      lbEl.style.display = 'block';
      body.innerHTML = html;
    }

    function pollLeaderboardAfterSubmit(expectedScore, submittedName, triesLeft, delayMs) {
      // Stop the moment the screen is gone (restart/Home) — no point touching a
      // detached overlay, and it lets the closure (and the old scene it holds) GC.
      if (!document.getElementById('_la-go-overlay')) return;
      var exp = Number(expectedScore);
      LA.llGetTop(10, function (err2, items2) {
        if (!document.getElementById('_la-go-overlay')) return;
        if (err2 || !items2) {
          if (triesLeft <= 1) {
            if (lastRenderedLbItems && lastRenderedLbItems.length) renderLeaderboard(lastRenderedLbItems);
            else setLbBodyHtml('<span style="font-size:calc(.65rem * var(--la-ui-scale));color:#775555">' + t('laGoError') + '</span>');
            return;
          }
          pollTimers.push(setTimeout(function () {
            pollLeaderboardAfterSubmit(expectedScore, submittedName, triesLeft - 1, Math.min(Math.round(delayMs * 1.65), 4000));
          }, delayMs));
          return;
        }
        var mine = null;
        var ri;
        for (ri = 0; ri < items2.length; ri++) {
          if (String(items2[ri].member_id) === String(_llPlayerId)) {
            mine = items2[ri];
            break;
          }
        }
        var listOk = mine && Number(mine.score) >= exp;
        if (listOk || triesLeft <= 1) {
          if (mine && Number(mine.score) < exp) {
            mine.score = exp;
            mine.player = mine.player || {};
            mine.player.name = submittedName;
          }
          renderLeaderboard(items2);
          return;
        }
        pollTimers.push(setTimeout(function () {
          pollLeaderboardAfterSubmit(expectedScore, submittedName, triesLeft - 1, Math.min(Math.round(delayMs * 1.65), 4000));
        }, delayMs));
      });
    }

    function showSubmitForm() {
      var formId = '_la-go-submit-form';
      if (document.getElementById(formId)) return;
      var form = document.createElement('div');
      form.id = formId;
      form.style.cssText = 'margin:.6rem 0;display:flex;gap:.4rem;justify-content:center;align-items:center';
      form.innerHTML =
        '<input id="_la-go-name" type="text" maxlength="16" placeholder="' + _escHtml(t('laGoNamePlc')) + '" style="' +
          'padding:.35rem .6rem;border:1px solid var(--la-accent-soft);border-radius:6px;' +
          'background:rgba(0,0,0,0.35);color:#e0e0ff;font-family:monospace;font-size:calc(.75rem * var(--la-ui-scale));' +
          'width:120px;outline:none' +
        '">' +
        '<button id="_la-go-send" style="' +
          'padding:.35rem .8rem;border:1.5px solid var(--la-accent-line);border-radius:6px;' +
          'background:var(--la-accent-fill);color:var(--la-accent);font-family:monospace;font-size:calc(.72rem * var(--la-ui-scale));' +
          'font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;' +
          'transition:background .2s' +
        '">' + t('laGoSubmit') + '</button>';
      lbEl.parentNode.insertBefore(form, lbEl);

      var nameIn = form.querySelector('#_la-go-name');
      var sendBtn = form.querySelector('#_la-go-send');
      var savedName = localStorage.getItem('ll_player_name') || '';
      if (savedName) nameIn.value = savedName;

      sendBtn.addEventListener('click', function () {
        var name = nameIn.value.trim();
        if (!name) { nameIn.style.borderColor = '#ff4444'; return; }
        sendBtn.disabled = true;
        sendBtn.textContent = '…';
        localStorage.setItem('ll_player_name', name);

        LA.llSetName(name, function () {
          LA.llSubmitScore(playerScore, function (err) {
            if (err) {
              sendBtn.disabled = false;
              sendBtn.textContent = t('laGoError');
              return;
            }
            form.innerHTML = '<span style="font-size:calc(.7rem * var(--la-ui-scale));color:#00ff88">' + t('laGoSubmitted') + '</span>';
            renderLeaderboardLoading();
            pollLeaderboardAfterSubmit(playerScore, name, 8, 200);
          });
        });
      });

      nameIn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); sendBtn.click(); }
      });
      nameIn.focus();
    }

    // Fetch leaderboard
    LA.llGetTop(10, function (err, items) {
      // If the player left the game-over screen (Replay/Home destroys the overlay)
      // before this fetch resolved, bail: mutating the detached DOM is pointless and
      // the closure would otherwise pin the old scene until resolution. Mirrors the
      // guards in pollLeaderboardAfterSubmit.
      if (!document.getElementById('_la-go-overlay')) return;
      if (err || !items) {
        setLbBodyHtml('<span style="font-size:calc(.65rem * var(--la-ui-scale));color:#775555">' + t('laGoError') + '</span>');
        return;
      }
      renderLeaderboard(items);
      var submittedBest = LA.llGetMyBestSubmitted(_llPlayerId, items);
      var beatsSubmittedWorld = (submittedBest === null) || (playerScore > submittedBest);
      var strictlyBetter = LA.llCountAbove(items, playerScore);
      var qualifiesTop10 = strictlyBetter < 10;
      if (qualifiesTop10 && beatsSubmittedWorld && LA.llGetToken()) showSubmitForm();
    });
  };

})();

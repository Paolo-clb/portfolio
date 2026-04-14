/* ==========================================================================
   Light Again — Game Over Screen (scene method)
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;

  LA.sceneMethods._showGameOverScreen = function () {
    if (document.getElementById('_la-go-overlay')) return;

    var canvas    = this.game.canvas;
    var container = canvas.parentElement;
    var playerScore = this.score;
    var bestCombo   = Math.max(this.bestCombo || 1, this.comboMultiplier);
    var totalKills  = this.totalKills || 0;
    var sceneRef    = this;

    var t = LA.laGoT;
    var _escHtml = LA.escHtml;
    var _llPlayerId = LA.llGetPlayerId();

    // ----- Local record -----
    var prevRecord = parseInt(localStorage.getItem('lightGameHighScore'), 10) || 0;
    var isNewRecord = playerScore > prevRecord;
    if (isNewRecord) localStorage.setItem('lightGameHighScore', playerScore);
    var localBest = Math.max(playerScore, prevRecord);

    // ----- Inject keyframes -----
    if (!document.getElementById('_la-go-styles')) {
      var st = document.createElement('style');
      st.id = '_la-go-styles';
      st.textContent =
        '@keyframes la-go-fade-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}' +
        '@keyframes la-go-glow{0%,100%{box-shadow:0 0 0 0 rgba(0,255,255,0.2)}50%{box-shadow:0 0 22px 4px rgba(0,255,255,0.12)}}' +
        '@keyframes la-go-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }

    // ----- CSS helpers -----
    var sLbl = 'font-size:.55rem;letter-spacing:.1em;color:#7799bb;text-transform:uppercase;display:block;margin-bottom:.15rem';
    var sVal = function (c) { return 'font-size:1.2rem;font-weight:700;color:' + c + ';text-shadow:0 0 8px ' + c + '44'; };
    var sSection = 'font-size:.55rem;letter-spacing:.12em;color:#5577aa;text-transform:uppercase;margin:1rem 0 .4rem;text-align:left';

    // ----- Build overlay -----
    var overlay = document.createElement('div');
    overlay.id  = '_la-go-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:monospace';

    var panel = document.createElement('div');
    panel.style.cssText = [
      'pointer-events:auto', 'text-align:center',
      'padding:1.3rem 1.8rem 1rem', 'border:1px solid rgba(0,255,255,0.28)', 'border-radius:14px',
      'background:rgba(4,5,18,0.72)', 'max-width:420px', 'width:92%', 'color:#e0e0ff',
      'max-height:85vh', 'overflow-y:auto',
      'animation:la-go-fade-in 0.4s cubic-bezier(0.22,1,0.36,1) both,la-go-glow 2.4s ease infinite',
    ].join(';');

    // Row 1: Score / Best Combo / Kills
    var statCol = 'display:flex;flex-direction:column;align-items:center;gap:.12rem;min-width:0';
    var row1 =
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem .6rem;margin-bottom:.5rem">' +
        '<div style="' + statCol + '"><span style="' + sLbl + '">' + t('laGoScore') + '</span><span style="' + sVal('#00ffff') + '">' + playerScore + '</span></div>' +
        '<div style="' + statCol + '"><span style="' + sLbl + '">' + t('laGoBestCombo') + '</span><span style="' + sVal('#ffcc00') + '">x' + bestCombo + '</span></div>' +
        '<div style="' + statCol + '"><span style="' + sLbl + '">' + t('laGoKills') + '</span><span style="' + sVal('#ff6644') + '">' + totalKills + '</span></div>' +
      '</div>';

    // Row 2: Personal Record
    var recColor = isNewRecord ? '#00ff88' : '#aabbcc';
    var recExtra = isNewRecord ? '  <span style="font-size:.6rem;color:#00ff88;margin-left:.4rem">' + t('laGoNewRecord') + '</span>' : '';
    var row2 =
      '<div style="margin-bottom:.6rem;display:flex;flex-direction:column;align-items:center;gap:.12rem">' +
        '<span style="' + sLbl + '">' + t('laGoRecord') + '</span>' +
        '<span style="' + sVal(recColor) + '">' + localBest + '</span>' + recExtra +
      '</div>';

    // Replay button
    var btnHtml =
      '<button id="_la-go-replay" style="' +
        'padding:.55rem 1.8rem;border:1.5px solid rgba(0,255,255,0.5);border-radius:8px;' +
        'background:rgba(0,255,255,0.08);color:#00ffff;font-family:monospace;font-size:.88rem;' +
        'font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;' +
        'transition:background .2s,box-shadow .2s;display:block;margin:0 auto .4rem' +
      '">' + t('laGoReplay') + '</button>' +
      '<div style="font-size:.55rem;color:#556688;letter-spacing:.06em;margin-bottom:.6rem">' + t('laGoEnterHint') + '</div>';

    // Leaderboard placeholder
    var lbSpinRow =
      '<div style="width:18px;height:18px;border:2px solid rgba(0,255,255,0.15);border-top-color:rgba(0,255,255,0.7);border-radius:50%;animation:la-go-spin .7s linear infinite"></div>' +
      '<span style="margin-left:.5rem;font-size:.65rem;color:#6688aa">' + t('laGoLoading') + '</span>';
    var lbHtml =
      '<div style="' + sSection + '">' + t('laGoWorldRecord') + '</div>' +
      '<div id="_la-go-lb" style="position:relative;min-height:60px">' +
        '<div id="_la-go-lb-body" style="min-height:60px;display:flex;align-items:center;justify-content:center">' +
          lbSpinRow +
        '</div>' +
      '</div>';

    panel.innerHTML = row1 + row2 + btnHtml + lbHtml;
    overlay.appendChild(panel);

    // ----- Wire replay button -----
    var btn = panel.querySelector('#_la-go-replay');
    btn.addEventListener('mouseenter', function () { btn.style.background = 'rgba(0,255,255,0.16)'; btn.style.boxShadow = '0 0 16px rgba(0,255,255,0.22)'; });
    btn.addEventListener('mouseleave', function () { btn.style.background = 'rgba(0,255,255,0.08)'; btn.style.boxShadow = ''; });

    function clearGameOverHostFlag() {
      try { delete container.dataset.laGameover; } catch (e) { /* ignore */ }
    }
    function doReplay() {
      clearGameOverHostFlag();
      overlay.remove();
      document.removeEventListener('keydown', onKey);
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
      doReplay();
    }
    btn.addEventListener('click', doReplay);
    document.addEventListener('keydown', onKey);
    this.events.once('shutdown', function () {
      document.removeEventListener('keydown', onKey);
      clearGameOverHostFlag();
      var el = document.getElementById('_la-go-overlay');
      if (el) el.remove();
    });

    container.style.position = 'relative';
    container.dataset.laGameover = '1';
    container.appendChild(overlay);

    // Pause scene
    var self2 = this;
    this.time.delayedCall(50, function () { self2.scene.pause(); });

    // ----- Leaderboard fetch -----
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
      var html = '<table style="width:100%;border-collapse:collapse;font-size:.68rem">';
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
      var exp = Number(expectedScore);
      LA.llGetTop(10, function (err2, items2) {
        if (err2 || !items2) {
          if (triesLeft <= 1) {
            if (lastRenderedLbItems && lastRenderedLbItems.length) renderLeaderboard(lastRenderedLbItems);
            else setLbBodyHtml('<span style="font-size:.65rem;color:#775555">' + t('laGoError') + '</span>');
            return;
          }
          setTimeout(function () {
            pollLeaderboardAfterSubmit(expectedScore, submittedName, triesLeft - 1, Math.min(Math.round(delayMs * 1.65), 4000));
          }, delayMs);
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
        setTimeout(function () {
          pollLeaderboardAfterSubmit(expectedScore, submittedName, triesLeft - 1, Math.min(Math.round(delayMs * 1.65), 4000));
        }, delayMs);
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
          'padding:.35rem .6rem;border:1px solid rgba(0,255,255,0.35);border-radius:6px;' +
          'background:rgba(0,0,0,0.35);color:#e0e0ff;font-family:monospace;font-size:.75rem;' +
          'width:120px;outline:none' +
        '">' +
        '<button id="_la-go-send" style="' +
          'padding:.35rem .8rem;border:1.5px solid rgba(0,255,255,0.5);border-radius:6px;' +
          'background:rgba(0,255,255,0.10);color:#00ffff;font-family:monospace;font-size:.72rem;' +
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
            form.innerHTML = '<span style="font-size:.7rem;color:#00ff88">' + t('laGoSubmitted') + '</span>';
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
      if (err || !items) {
        setLbBodyHtml('<span style="font-size:.65rem;color:#775555">' + t('laGoError') + '</span>');
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

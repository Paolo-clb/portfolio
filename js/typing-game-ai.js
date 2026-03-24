/* ==========================================================================
   Typing Game — AI Module (Gemini text generation)
   Factory function: receives a deps object from the main IIFE.
   Loaded before typing-game.js. Exposed as window.createTypingGameAI.
   ========================================================================== */

window.createTypingGameAI = function (deps) {
  'use strict';

  /* deps interface:
     t(key)           — translation function
     aiState          — shared state object { uppercase, punctuation, strictWordCount,
                         texts, theme, mode, inlineActive }
     getContainer()   — returns container DOM element
     getNavbar()      — returns navbarEl DOM element
     getTextEl()      — returns textEl DOM element
     getFocusHint()   — returns focusHintEl DOM element
     clearBlurHint()  — clears blur hint timer
     saveAiOptions()  — persists AI toggle state to cookies
  */

  var t = deps.t;
  var S = deps.aiState;
  var WORKER_URL = 'https://gemini-proxy.colombatpaolo.workers.dev';

  // Module-internal state
  var aiInlineEl = null;
  var aiLoading = false;

  /* ---- Post-processing ---- */

  function postProcessAiTexts(parsed) {
    var langs = ['fr', 'en'];
    var modes = ['10', '25', '50', '100'];
    langs.forEach(function (lang) {
      if (!parsed[lang]) return;
      modes.forEach(function (mode) {
        if (!Array.isArray(parsed[lang][mode])) return;
        var modeLimit = parseInt(mode, 10);
        parsed[lang][mode] = parsed[lang][mode].map(function (text) {
          if (typeof text !== 'string') return text;
          if (!S.uppercase) text = text.toLowerCase();
          if (!S.punctuation) {
            text = text.replace(/[.,;:!?]/g, '');
            text = text.replace(/ {2,}/g, ' ').trim();
          }
          if (S.strictWordCount) {
            var words = text.split(/\s+/);
            if (words.length > modeLimit) {
              text = words.slice(0, modeLimit).join(' ');
            }
          }
          return text;
        });
      });
    });
  }

  /* ---- Fetch ---- */

  function fetchAiTexts(theme, onSuccess, onError) {
    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: theme })
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (d) {
            throw new Error(d.error || 'HTTP ' + res.status);
          });
        }
        return res.json();
      })
      .then(function (parsed) {
        if (parsed.error) throw new Error(parsed.error);
        onSuccess(parsed);
      })
      .catch(function (err) {
        onError(err);
      });
  }

  /* ---- Inline loader (replaces popup after 3 s) ---- */

  function showAiInlineLoader(theme, uppercase, punctuation, strictWc) {
    var navbarEl = deps.getNavbar();
    var textEl = deps.getTextEl();
    var container = deps.getContainer();
    var focusHintEl = deps.getFocusHint();

    if (navbarEl) navbarEl.classList.add('typing-game__navbar--disabled');

    aiInlineEl = document.createElement('div');
    aiInlineEl.className = 'typing-game__ai-inline';

    var settingsHtml = '';
    if (uppercase) settingsHtml += '<span class="typing-game__ai-inline-tag">ABC</span>';
    if (punctuation) settingsHtml += '<span class="typing-game__ai-inline-tag">.,;!?</span>';
    var wcLabel = strictWc ? t('wcStrict') : t('wcFree');
    var wcTooltip = strictWc ? t('wcStrictTip') : t('wcFreeTip');
    settingsHtml += '<span class="typing-game__ai-inline-tag typing-game__ai-inline-tag--wc" data-tip="' + wcTooltip.replace(/"/g, '&quot;') + '">' + wcLabel + '<span class="typing-game__ai-inline-tag-tip">' + wcTooltip + '</span></span>';

    aiInlineEl.innerHTML =
      '<div class="typing-game__ai-inline-content">' +
        '<div class="typing-game__ai-inline-spinner"></div>' +
        '<div class="typing-game__ai-inline-info">' +
          '<div class="typing-game__ai-inline-theme">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ' +
            theme +
          '</div>' +
          '<div class="typing-game__ai-inline-tags">' + settingsHtml + '</div>' +
        '</div>' +
        '<div class="typing-game__ai-inline-text">' + t('generating') + '</div>' +
      '</div>' +
      '<div class="typing-game__ai-inline-result"></div>';

    if (textEl) {
      textEl.appendChild(aiInlineEl);
    } else {
      container.appendChild(aiInlineEl);
    }

    // Attach custom tooltip hover for the word-count tag
    var wcTag = aiInlineEl.querySelector('.typing-game__ai-inline-tag--wc');
    if (wcTag) {
      wcTag.addEventListener('mouseenter', function () {
        var tip = wcTag.querySelector('.typing-game__ai-inline-tag-tip');
        if (tip) { void tip.offsetWidth; tip.classList.add('typing-game__ai-inline-tag-tip--visible'); }
      });
      wcTag.addEventListener('mouseleave', function () {
        var tip = wcTag.querySelector('.typing-game__ai-inline-tag-tip');
        if (tip) tip.classList.remove('typing-game__ai-inline-tag-tip--visible');
      });
    }

    aiInlineEl.offsetHeight;
    aiInlineEl.classList.add('typing-game__ai-inline--visible');

    S.inlineActive = true;
    deps.clearBlurHint();
    if (focusHintEl) focusHintEl.classList.remove('typing-game__focus-hint--visible');
    container.classList.remove('typing-game--blurred');
    container.blur();
  }

  function finishAiInlineLoader(success, message, onDone) {
    if (!aiInlineEl) return;

    var resultEl = aiInlineEl.querySelector('.typing-game__ai-inline-result');
    var contentEl = aiInlineEl.querySelector('.typing-game__ai-inline-content');

    contentEl.classList.add('typing-game__ai-inline-content--hidden');

    setTimeout(function () {
      resultEl.innerHTML =
        '<div class="typing-game__ai-inline-result-icon">' +
          (success
            ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
          ) +
        '</div>' +
        '<div class="typing-game__ai-inline-result-msg">' + message + '</div>';
      resultEl.classList.add('typing-game__ai-inline-result--visible');
      resultEl.classList.add(success ? 'typing-game__ai-inline-result--success' : 'typing-game__ai-inline-result--error');

      setTimeout(function () {
        dismissAiInlineLoader(onDone);
      }, success ? 1000 : 2000);
    }, 300);
  }

  function dismissAiInlineLoader(onDone) {
    if (!aiInlineEl) { if (typeof onDone === 'function') onDone(); return; }
    var navbarEl = deps.getNavbar();
    var container = deps.getContainer();

    aiInlineEl.classList.remove('typing-game__ai-inline--visible');
    aiInlineEl.addEventListener('transitionend', function handler() {
      aiInlineEl.removeEventListener('transitionend', handler);
      if (aiInlineEl.parentNode) aiInlineEl.remove();
      aiInlineEl = null;
      if (typeof onDone === 'function') onDone();
    });
    if (navbarEl) navbarEl.classList.remove('typing-game__navbar--disabled');
    aiLoading = false;
    S.inlineActive = false;
    delete document.body.dataset.aiLoading;
    container.focus();
  }

  /* ---- AI popup ---- */

  function showAiPopup(onConfirm) {
    var container = deps.getContainer();
    var isReopen = !!(S.texts);

    var overlay = document.createElement('div');
    overlay.className = 'zen-popup-overlay';
    var popup = document.createElement('div');
    popup.className = 'zen-popup typing-game__ai-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', t('aiTitle'));

    popup.innerHTML =
      '<button class="modal__close zen-popup__close" aria-label="' + t('closeLbl') + '">&times;</button>' +
      '<div class="zen-popup__title">' + t('aiTitle') + '</div>' +
      '<p class="zen-popup__text">' + t('aiQuestion') + '</p>' +
      '<input class="typing-game__ai-input typing-game__ai-theme-input" type="text" placeholder="' + t('aiPlaceholder') + '" maxlength="100" />' +
      '<div class="typing-game__ai-options">' +
        '<label class="typing-game__ai-opt">' +
          '<input type="checkbox" class="typing-game__ai-opt-check" data-key="uppercase"' + (S.uppercase ? ' checked' : '') + '/>' +
          '<span class="typing-game__ai-opt-toggle"></span>' +
          '<span class="typing-game__ai-opt-label">' + t('uppercase') + '</span>' +
          '<span class="typing-game__ai-opt-hint">ABC</span>' +
        '</label>' +
        '<label class="typing-game__ai-opt">' +
          '<input type="checkbox" class="typing-game__ai-opt-check" data-key="punctuation"' + (S.punctuation ? ' checked' : '') + '/>' +
          '<span class="typing-game__ai-opt-toggle"></span>' +
          '<span class="typing-game__ai-opt-label">' + t('punctuation') + '</span>' +
          '<span class="typing-game__ai-opt-hint">.,;!?</span>' +
        '</label>' +
        '<label class="typing-game__ai-opt typing-game__ai-opt--strict">' +
          '<input type="checkbox" class="typing-game__ai-opt-check" data-key="strictwc"' + (S.strictWordCount ? ' checked' : '') + '/>' +
          '<span class="typing-game__ai-opt-toggle"></span>' +
          '<span class="typing-game__ai-opt-label">' + t('aiStrictLabel') + '</span>' +
          '<span class="typing-game__ai-opt-hint">#</span>' +
          '<span class="typing-game__ai-opt-tip">' + t('aiStrictTip') + '</span>' +
        '</label>' +
      '</div>' +
      '<div class="typing-game__ai-status"></div>' +
      '<div class="typing-game__ai-loader">' +
        '<div class="typing-game__ai-loader-spinner"></div>' +
        '<div class="typing-game__ai-loader-text">' + t('generating') + '</div>' +
      '</div>' +
      '<button class="zen-popup__btn typing-game__ai-confirm">' + t('aiGenerate') + '</button>';
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    var themeInput = popup.querySelector('.typing-game__ai-theme-input');
    var confirmBtn = popup.querySelector('.typing-game__ai-confirm');
    var statusEl = popup.querySelector('.typing-game__ai-status');
    var loaderEl = popup.querySelector('.typing-game__ai-loader');
    var optionsEl = popup.querySelector('.typing-game__ai-options');

    var localUppercase = S.uppercase;
    var localPunctuation = S.punctuation;
    var localStrictWc = S.strictWordCount;

    popup.querySelectorAll('.typing-game__ai-opt-check').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var key = chk.getAttribute('data-key');
        if (key === 'uppercase') localUppercase = chk.checked;
        if (key === 'punctuation') localPunctuation = chk.checked;
        if (key === 'strictwc') localStrictWc = chk.checked;
      });
    });

    if (S.theme) themeInput.value = S.theme;

    overlay.offsetHeight;
    overlay.classList.add('zen-popup-overlay--visible');
    var _aiTrap = window.__trapFocus ? window.__trapFocus(overlay) : null;

    setTimeout(function () { themeInput.focus(); }, 350);

    function close(generated) {
      if (_aiTrap) { _aiTrap(); _aiTrap = null; }
      overlay.classList.remove('zen-popup-overlay--visible');
      overlay.addEventListener('transitionend', function handler() {
        overlay.removeEventListener('transitionend', handler);
        overlay.remove();
        if (!generated && !isReopen) {
          S.uppercase = localUppercase;
          S.punctuation = localPunctuation;
          S.strictWordCount = localStrictWc;
          S.theme = themeInput.value.trim();
          deps.saveAiOptions();
        }
        container.focus();
      });
    }

    function getErrorMsg(err) {
      var msg = err && err.message || '';
      if (msg === 'ORIGIN_BLOCKED') return t('errOrigin');
      if (msg === 'RATE_LIMIT') return t('errRate');
      if (msg === 'TRUNCATED') return t('errTrunc');
      if (msg === 'TIMEOUT') return t('errTimeout');
      return t('errGeneric');
    }

    function doGenerate() {
      var theme = themeInput.value.trim();
      if (!theme) {
        themeInput.classList.add('typing-game__ai-input--error');
        setTimeout(function () { themeInput.classList.remove('typing-game__ai-input--error'); }, 600);
        return;
      }
      confirmBtn.disabled = true;
      confirmBtn.style.display = 'none';
      themeInput.disabled = true;
      statusEl.textContent = '';
      statusEl.className = 'typing-game__ai-status';
      loaderEl.classList.add('typing-game__ai-loader--active');
      optionsEl.classList.add('typing-game__ai-options--loading');
      aiLoading = true;
      document.body.dataset.aiLoading = '1';

      var resolved = false;
      var movedInline = false;

      var inlineTimer = setTimeout(function () {
        if (resolved) return;
        movedInline = true;
        close(true);
        showAiInlineLoader(theme, localUppercase, localPunctuation, localStrictWc);
      }, 3000);

      fetchAiTexts(theme, function (texts) {
        if (resolved) return;
        resolved = true;
        clearTimeout(inlineTimer);
        aiLoading = false;
        S.uppercase = localUppercase;
        S.punctuation = localPunctuation;
        S.strictWordCount = localStrictWc;
        S.theme = theme;
        deps.saveAiOptions();
        postProcessAiTexts(texts);
        S.texts = texts;

        if (movedInline) {
          finishAiInlineLoader(true, t('textsOk'), function () {
            if (typeof onConfirm === 'function') onConfirm();
          });
        } else {
          delete document.body.dataset.aiLoading;
          loaderEl.classList.remove('typing-game__ai-loader--active');
          optionsEl.classList.remove('typing-game__ai-options--loading');
          close(true);
          if (typeof onConfirm === 'function') onConfirm();
        }
      }, function (err) {
        if (resolved) return;
        resolved = true;
        clearTimeout(inlineTimer);
        aiLoading = false;

        if (movedInline) {
          finishAiInlineLoader(false, getErrorMsg(err));
        } else {
          delete document.body.dataset.aiLoading;
          loaderEl.classList.remove('typing-game__ai-loader--active');
          optionsEl.classList.remove('typing-game__ai-options--loading');
          confirmBtn.disabled = false;
          confirmBtn.style.display = '';
          themeInput.disabled = false;
          confirmBtn.textContent = t('aiRetry');
          statusEl.textContent = getErrorMsg(err);
          statusEl.className = 'typing-game__ai-status typing-game__ai-status--error';
        }
      });
    }

    popup.querySelector('.zen-popup__close').addEventListener('click', function () {
      if (!aiLoading) close();
    });
    confirmBtn.addEventListener('click', doGenerate);
    popup.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        doGenerate();
      }
      if (e.key === 'Escape' && !aiLoading) close();
    });
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay && !aiLoading) close();
    });
  }

  /* ---- Public API ---- */

  return {
    showPopup: showAiPopup,
    isInlineActive: function () { return S.inlineActive; },
    isLoading: function () { return aiLoading; }
  };
};

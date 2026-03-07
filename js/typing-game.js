/* ==========================================================================
   Typing Game — self-contained hero mini-game
   Depends on: #typing-game container in the DOM
   ========================================================================== */

(function () {
  'use strict';

  /* ---- Cookie helpers ---- */

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function getBestKey(mode) {
    return 'typing_best_' + mode;
  }

  function getBestWPM(mode) {
    var val = getCookie(getBestKey(mode));
    return val ? parseInt(val, 10) : 0;
  }

  function saveBestWPM(mode, wpm) {
    var current = getBestWPM(mode);
    if (wpm > current) {
      setCookie(getBestKey(mode), wpm, 365);
      return true; // new record
    }
    return false;
  }

  function saveSettings(lang, mode, showErrorsState) {
    setCookie('typing_lang', lang, 365);
    setCookie('typing_mode', mode, 365);
    if (typeof showErrorsState !== 'undefined') {
      setCookie('typing_show_errors', showErrorsState ? '1' : '0', 365);
    }
  }

  function saveSettingsOptions() {
    setCookie('typing_opt_uppercase', settingsUppercase ? '1' : '0', 365);
    setCookie('typing_opt_numbers', settingsNumbers ? '1' : '0', 365);
    setCookie('typing_opt_punctuation', settingsPunctuation ? '1' : '0', 365);
    setCookie('typing_opt_special', settingsSpecial ? '1' : '0', 365);
  }

  function saveAiOptions() {
    setCookie('typing_ai_uppercase', aiState.uppercase ? '1' : '0', 365);
    setCookie('typing_ai_punctuation', aiState.punctuation ? '1' : '0', 365);
    setCookie('typing_ai_strict_wc', aiState.strictWordCount ? '1' : '0', 365);
  }

  function loadSettings() {
    var lang = getCookie('typing_lang');
    var mode = getCookie('typing_mode');
    var showErrorsCookie = getCookie('typing_show_errors');
    return {
      lang: (lang === 'fr' || lang === 'en') ? lang : null,
      mode: mode && ['10', '25', '50', '100', 'zen'].indexOf(mode) !== -1 ? mode : null,
      showErrors: showErrorsCookie === '1',
      hardcore: false,
      uppercase: getCookie('typing_opt_uppercase') === '1',
      numbers: getCookie('typing_opt_numbers') === '1',
      punctuation: getCookie('typing_opt_punctuation') === '1',
      special: getCookie('typing_opt_special') === '1',
      aiUppercase: getCookie('typing_ai_uppercase') === '1',
      aiPunctuation: getCookie('typing_ai_punctuation') === '1',
      aiStrictWordCount: getCookie('typing_ai_strict_wc') === '1',
    };
  }

  function isGameUnlocked() {
    return getCookie('typing_game_unlocked') === '1';
  }

  function unlockGame() {
    setCookie('typing_game_unlocked', '1', 365);
    // Clean up old cookie that is no longer used
    setCookie('typing_played', '', -1);
  }

  /* ---- Text data by language and mode (loaded from typing-texts.js) ---- */

  const TEXTS = window.TYPING_TEXTS;

  /* ---- Translations (loaded from typing-game-i18n.js) ---- */

  var I18N = window.TYPING_GAME_I18N;

  // uiLang follows site-wide language for all UI text / tooltips.
  // currentLang is only for selecting which text pool to type from.
  var uiLang = localStorage.getItem('portfolio_lang') || 'fr';

  function t(key) {
    return (I18N[uiLang] && I18N[uiLang][key]) || I18N.fr[key] || key;
  }

  /* ---- State ---- */

  let introActive = false; // whether the intro typewriter is showing (game not yet unlocked)
  let currentLang = 'fr';
  let currentMode = '25';
  let text = '';
  let typed = [];
  let startTime = null;
  let finished = false;
  let wpmInterval = null;
  let paused = false; // whether the game is currently paused (lost focus)
  let pauseStart = null; // timestamp when pause started
  let totalPaused = 0; // accumulated paused milliseconds
  let totalKeystrokes = 0;
  let lockedIndex = 0;
  let correctWords = 0;
  let comboStreak = 0;
  let wpmBoost = 0; // DEBUG: artificial WPM boost (Ctrl+ArrowUp/Down)
  let showErrors = false;
  let isFocused = true; // whether the game container has focus
  let blurHintTimer = null; // debounce timer for focus hint
  let trailTimestamps = []; // timestamps of recent correct keystrokes for trail speed calc
  let trailSpeed = 0; // 0–1 speed factor for trail intensity
  let zenWordCount = 0; // word counter for zen mode
  let currentTextIndex = -1; // current text index in pool (-1 = random)
  let hardcoreMode = false; // hardcore toggle
  let hardcorePhase = null; // 'memorize' | 'typing' | null
  let hardcoreCountdown = 0; // countdown seconds remaining
  let hardcoreTimer = null; // setInterval id for countdown
  let hardcoreFailed = false; // whether the player made an error
  let settingsUppercase = false; // text setting: add uppercase letters
  let settingsNumbers = false; // text setting: add numbers
  let settingsPunctuation = false; // text setting: add punctuation
  let settingsSpecial = false; // text setting: add special characters
  let charSpans = []; // pre-built span elements (one per character in text)
  let cachedLH = 0; // cached line-height in px for scroll calculations

  // AI state — shared object passed by reference to the AI module
  var aiState = {
    mode: false,            // AI text generation toggle
    texts: null,            // generated texts: { fr: { '10': [...], ... }, en: { ... } }
    theme: '',              // AI theme description
    uppercase: false,       // AI popup setting: uppercase
    punctuation: false,     // AI popup setting: punctuation
    strictWordCount: false, // AI popup setting: strict word count
    inlineActive: false     // whether the AI inline loader is displayed
  };
  let aiThemeBtn = null; // reference to the "change theme" button in navbar

  // Module instances (set in init)
  var ai = null;   // AI module (typing-game-ai.js)
  var intro = null; // Intro module (typing-game-intro.js)

  /* ---- DOM refs (set in init) ---- */

  let container, navbarEl, textEl, innerEl, wpmEl, accEl, timeEl, bestEl, restartEl, statsRow, focusHintEl, hardcoreCountdownEl;
  let heroTitleEl; // intro mode DOM ref

  /* ---- Helpers ---- */

  var RESTART_ICON = '<svg class="typing-game__restart__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> ';
  var ZEN_STOP_ICON = '<svg class="typing-game__restart__icon typing-game__restart__icon--zen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> ';

  function setRestartText(msg, icon) {
    restartEl.innerHTML = (icon || RESTART_ICON) + '<span>' + msg + '</span>';
  }

  function showRestart() {
    restartEl.dataset.shouldShow = '1';
    if (isFocused) restartEl.classList.add('typing-game__restart--visible');
  }

  function hideRestart() {
    restartEl.dataset.shouldShow = '0';
    restartEl.classList.remove('typing-game__restart--visible');
  }

  function getActiveTexts() {
    return (aiState.mode && aiState.texts) ? aiState.texts : TEXTS;
  }

  function pickText(avoidIndex) {
    if (currentMode === 'zen') return '';
    var source = getActiveTexts();
    if (!source[currentLang] || !source[currentLang][currentMode] || source[currentLang][currentMode].length === 0) {
      // Fallback to default texts if AI texts missing for this lang/mode
      source = TEXTS;
    }
    const pool = source[currentLang][currentMode];
    // Replay same text after finishing (currentTextIndex preserved)
    if (currentTextIndex >= 0 && currentTextIndex < pool.length) {
      return pool[currentTextIndex];
    }
    // Pick a new random text (different from previous if possible)
    var avoid = avoidIndex !== undefined ? avoidIndex : currentTextIndex;
    var idx;
    if (pool.length > 1) {
      do { idx = Math.floor(Math.random() * pool.length); } while (idx === avoid);
    } else {
      idx = 0;
    }
    currentTextIndex = idx;
    return pool[idx];
  }

  /* ---- Text variant selection (settings: uppercase, punctuation, numbers, specials) ---- */

  function transformText(rawText) {
    // Zen mode: no transformation
    if (currentMode === 'zen') {
      return (typeof rawText === 'string') ? rawText : (rawText ? rawText[0] : '');
    }

    // AI texts are plain strings — return as-is (no enriched variant)
    if (typeof rawText === 'string') return rawText;

    // Hardcoded texts are [base, full] arrays
    if (!rawText) return '';
    var base = rawText[0];
    var full = rawText[1];
    if (!full) return base; // safety fallback

    // If no settings active, use base text directly
    if (!settingsUppercase && !settingsPunctuation && !settingsNumbers && !settingsSpecial) {
      return base;
    }

    // Start from fully enriched text and strip disabled layers
    var result = full;

    if (!settingsUppercase) {
      result = result.toLowerCase();
    }
    if (!settingsPunctuation) {
      result = result.replace(/[.,;!?:]/g, '');
    }
    if (!settingsNumbers) {
      result = result.replace(/\d+/g, '');
    }
    if (!settingsSpecial) {
      result = result.replace(/[@#$%]/g, '');
    }

    // Normalize whitespace (collapse multiple spaces, trim)
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * Scan all words from lockedIndex forward.
   * As soon as a CORRECT word is found, lock everything up to and
   * including it (wrong words before it get locked too — they just
   * don't count for WPM). Only correct words increment the counter.
   */
  function tryLockWord() {
    let wordStart = lockedIndex;
    let lastCorrectEnd = -1;   // track the furthest correct word boundary
    let correctInBatch = 0;    // correct words found in this scan

    // Scan every word the user has typed past
    while (true) {
      let wordEnd = text.indexOf(' ', wordStart);
      if (wordEnd === -1) wordEnd = text.length;

      // Haven't finished typing this word yet — stop scanning
      if (typed.length < wordEnd) break;

      // Check if this word is correct (skip zero-length segments)
      let wordCorrect = wordEnd > wordStart;
      for (let i = wordStart; i < wordEnd; i++) {
        if (typed[i] !== text[i]) { wordCorrect = false; break; }
      }

      if (wordCorrect) {
        correctInBatch++;
        // Include the space after if typed correctly
        if (wordEnd < text.length && typed.length > wordEnd && typed[wordEnd] === ' ') {
          lastCorrectEnd = wordEnd + 1;
        } else {
          lastCorrectEnd = wordEnd;
        }
      }

      // Move to next word
      if (wordEnd >= text.length) break;
      wordStart = wordEnd + 1;
      if (typed.length <= wordStart) break;
    }

    // If we found at least one correct word, lock everything up to it
    if (lastCorrectEnd > lockedIndex) {
      correctWords += correctInBatch;
      lockedIndex = lastCorrectEnd;
    }
  }

  function calcWPM() {
    if (!startTime) return 0;
    const minutes = (Date.now() - startTime - totalPaused) / 60000;
    if (minutes < 0.01) return 0;
    if (currentMode === 'zen') {
      return Math.round(zenWordCount / minutes) + wpmBoost;
    }
    return Math.round(correctWords / minutes) + wpmBoost;
  }

  function calcAccuracy() {
    if (currentMode === 'zen') return 100;
    if (totalKeystrokes === 0) return 100;
    let correctChars = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === text[i]) correctChars++;
    }
    return Math.round((correctChars / totalKeystrokes) * 100);
  }

  /* ---- Trail speed calculator ---- */

  function updateTrailSpeed() {
    if (trailTimestamps.length < 2) { trailSpeed = 0; return; }
    // Average interval between last N keystrokes (ms)
    var recent = trailTimestamps.slice(-8);
    var totalInterval = recent[recent.length - 1] - recent[0];
    var avgInterval = totalInterval / (recent.length - 1);
    // Map: 50ms (very fast) → 1.0, 500ms (slow) → 0.0
    trailSpeed = Math.max(0, Math.min(1, 1 - (avgInterval - 50) / 450));
  }

  /* ---- DOM span builder (runs once per game start) ---- */

  function buildCharSpans() {
    charSpans = [];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var span = document.createElement('span');
      span.className = 'typing-game__char';
      span.textContent = text[i] === ' ' ? ' ' : text[i];
      span._cls = 'typing-game__char';
      span._sty = '';
      span._err = false;
      span._wc = null;
      frag.appendChild(span);
      charSpans.push(span);
    }
    if (!innerEl) {
      innerEl = document.createElement('div');
      innerEl.className = 'typing-game__text-inner';
      textEl.textContent = '';
      var clipEl = document.createElement('div');
      clipEl.className = 'typing-game__text-clip';
      clipEl.appendChild(innerEl);
      textEl.appendChild(clipEl);
    } else {
      innerEl.textContent = '';
    }
    innerEl.appendChild(frag);
    // Cache line-height once the spans are in the DOM
    cachedLH = parseFloat(getComputedStyle(textEl).fontSize) * 1.6;
  }

  /* ---- Zen mode rendering ---- */

  function renderZen() {
    let html = '';
    let comboStyle = '';

    // Trail for zen mode
    var trailLen = 0;
    if (comboStreak >= 10 && trailSpeed > 0.05) {
      var comboFactor = Math.min(comboStreak / 150, 1);
      trailLen = Math.round(2 + comboFactor * 28);
      trailLen = Math.round(trailLen * (0.15 + trailSpeed * 0.85));
    }
    var zenDk = document.documentElement.dataset.theme === 'dark';
    var zenNat = document.documentElement.dataset.theme === 'nature';
    var trailR = zenNat ? 94 : zenDk ? 156 : 242, trailG = zenNat ? 184 : zenDk ? 39 : 162, trailB = zenNat ? 58 : zenDk ? 176 : 133;

    for (let i = 0; i < typed.length; i++) {
      let cls = 'typing-game__char typing-game__char--correct';
      var trailAttr = '';

      // Trail
      if (!finished && trailLen > 0) {
        var distFromCursor = typed.length - i;
        if (distFromCursor <= trailLen && distFromCursor >= 1) {
          cls += ' typing-game__char--trail';
          var trailOpacity = (1 - (distFromCursor - 1) / trailLen) * trailSpeed;
          trailOpacity = Math.max(0.05, Math.min(1, trailOpacity));
          trailAttr = ' style="--trail-opacity:' + trailOpacity.toFixed(3)
            + ';--trail-r:' + trailR
            + ';--trail-g:' + trailG
            + ';--trail-b:' + trailB + '"';
        }
      }

      var ch = typed[i] === ' ' ? ' ' : typed[i];
      html += '<span class="' + cls + '"' + trailAttr + '>' + ch + '</span>';
    }

    // Cursor after all typed chars
    if (!finished) {
      var cursorCls = 'typing-game__char typing-game__char--cursor';
      if (comboStreak >= 60) cursorCls += ' typing-game__char--combo-3';
      else if (comboStreak >= 30) cursorCls += ' typing-game__char--combo-2';
      else if (comboStreak >= 10) cursorCls += ' typing-game__char--combo-1';

      // Use a zero-width space so the cursor span has position
      html += '<span class="' + cursorCls + '"' + comboStyle + '>\u200B</span>';
    }

    if (!innerEl) {
      innerEl = document.createElement('div');
      innerEl.className = 'typing-game__text-inner';
      textEl.textContent = '';
      var clipEl = document.createElement('div');
      clipEl.className = 'typing-game__text-clip';
      clipEl.appendChild(innerEl);
      textEl.appendChild(clipEl);
    }
    innerEl.innerHTML = html;

    requestAnimationFrame(scrollToCursor);
  }

  /* ---- Rendering ---- */

  function render() {
    if (currentMode === 'zen') { renderZen(); return; }

    // Build span elements once per game; reuse on every keystroke
    if (charSpans.length === 0) buildCharSpans();

    // In hardcore typing phase, untyped chars are hidden
    var hideUntyped = hardcoreMode && hardcorePhase === 'typing' && !finished;

    // Trail length from combo streak + speed
    var trailLen = 0;
    if (comboStreak >= 10 && trailSpeed > 0.05) {
      var comboFactor = Math.min(comboStreak / 150, 1);
      trailLen = Math.round(2 + comboFactor * 28);
      trailLen = Math.round(trailLen * (0.15 + trailSpeed * 0.85));
    }

    // Trail color shift: primary → accent/hover
    var isDark = document.documentElement.dataset.theme === 'dark';
    var isNature = document.documentElement.dataset.theme === 'nature';
    var trailR = isNature ? 94 : isDark ? 156 : 242, trailG = isNature ? 184 : isDark ? 39 : 162, trailB = isNature ? 58 : isDark ? 176 : 133;
    var trailHR = isNature ? 74 : isDark ? 255 : 242, trailHG = isNature ? 181 : isDark ? 78 : 128, trailHB = isNature ? 214 : isDark ? 203 : 128;
    if (comboStreak >= 50) {
      var tc = Math.min((comboStreak - 50) / 50, 1);
      trailR = Math.round(trailR + tc * (trailHR - trailR));
      trailG = Math.round(trailG + tc * (trailHG - trailG));
      trailB = Math.round(trailB + tc * (trailHB - trailB));
    }

    // Combo cursor color
    var comboStyleStr = '';
    if (comboStreak >= 50) {
      var cc = Math.min((comboStreak - 50) / 50, 1);
      var cBaseR = isNature ? 94 : isDark ? 156 : 242, cBaseG = isNature ? 184 : isDark ? 39 : 162, cBaseB = isNature ? 58 : isDark ? 176 : 133;
      var cHoverR = isNature ? 74 : isDark ? 255 : 242, cHoverG = isNature ? 181 : isDark ? 78 : 128, cHoverB = isNature ? 214 : isDark ? 203 : 128;
      var cr = Math.round(cBaseR + cc * (cHoverR - cBaseR));
      var cg = Math.round(cBaseG + cc * (cHoverG - cBaseG));
      var cb = Math.round(cBaseB + cc * (cHoverB - cBaseB));
      comboStyleStr = '--combo-clr:rgb(' + cr + ',' + cg + ',' + cb + ')';
    }

    for (var i = 0; i < charSpans.length; i++) {
      var span = charSpans[i];
      var cls = 'typing-game__char';
      var styleStr = '';

      if (i < typed.length) {
        // Typed character
        cls += typed[i] === text[i]
          ? ' typing-game__char--correct'
          : ' typing-game__char--incorrect';
        if (i < lockedIndex) cls += ' typing-game__char--locked';

        // Trail on correct chars near cursor
        if (!finished && trailLen > 0 && typed[i] === text[i]) {
          var distFromCursor = typed.length - i;
          if (distFromCursor <= trailLen && distFromCursor >= 1) {
            cls += ' typing-game__char--trail';
            var trailOpacity = (1 - (distFromCursor - 1) / trailLen) * trailSpeed;
            trailOpacity = Math.max(0.05, Math.min(1, trailOpacity));
            styleStr = '--trail-opacity:' + trailOpacity.toFixed(3)
              + ';--trail-r:' + trailR
              + ';--trail-g:' + trailG
              + ';--trail-b:' + trailB;
          }
        }
      } else if (i === typed.length && !finished) {
        // Cursor
        cls += ' typing-game__char--cursor';
        if (comboStreak >= 60) cls += ' typing-game__char--combo-3';
        else if (comboStreak >= 30) cls += ' typing-game__char--combo-2';
        else if (comboStreak >= 10) cls += ' typing-game__char--combo-1';
        if (comboStyleStr) styleStr = comboStyleStr;
        // Hardcore: cursor is hidden too
        if (hideUntyped) cls += ' typing-game__char--hidden';
      } else {
        // Untyped characters
        if (hideUntyped) cls += ' typing-game__char--hidden';
      }

      // Finished: static cursor after last char
      if (finished && i === text.length - 1) {
        cls += ' typing-game__char--cursor typing-game__char--cursor-end';
      }

      // --- Update DOM only when state changed ---
      if (span._cls !== cls) {
        span.className = cls;
        span._cls = cls;
      }
      if (span._sty !== styleStr) {
        if (styleStr) span.style.cssText = styleStr;
        else if (span._sty) { span.style.cssText = ''; }
        span._sty = styleStr;
      }

      // Error display: swap innerHTML only for incorrect chars
      if (i < typed.length && typed[i] !== text[i]) {
        if (!span._err || span._wc !== typed[i]) {
          var ch = text[i] === ' ' ? ' ' : text[i];
          var wrong = typed[i] === ' ' ? '␣' : typed[i];
          span.innerHTML = '<span class="typing-game__char-expected">' + ch +
            '</span><span class="typing-game__char-wrong">' + wrong + '</span>';
          span._err = true;
          span._wc = typed[i];
        }
      } else if (span._err) {
        // Revert to normal character display
        span.textContent = text[i] === ' ' ? ' ' : text[i];
        span._err = false;
        span._wc = null;
      }
    }

    // Scroll so the cursor stays on the middle visible line
    requestAnimationFrame(scrollToCursor);
  }

  function scrollToCursor() {
    if (!innerEl) return;
    // After hardcore fail, don't scroll — keep all lines visible
    if (hardcoreFailed && finished) return;

    // Direct access to cursor span instead of querySelector
    var cursorSpanEl = null;
    if (currentMode === 'zen') {
      // Zen uses innerHTML — find cursor via DOM query
      cursorSpanEl = innerEl.querySelector('.typing-game__char--cursor');
    } else if (finished && charSpans.length > 0) {
      cursorSpanEl = charSpans[text.length - 1];
    } else if (typed.length < charSpans.length) {
      cursorSpanEl = charSpans[typed.length];
    }
    if (!cursorSpanEl) return;

    // Use cached line-height (computed once in buildCharSpans)
    var lh = cachedLH || parseFloat(getComputedStyle(textEl).fontSize) * 1.6;

    var innerRect = innerEl.getBoundingClientRect();
    var cursorRect = cursorSpanEl.getBoundingClientRect();

    var cursorY = cursorRect.top - innerRect.top;
    var cursorLine = Math.floor(cursorY / lh);

    // Keep cursor on line 1 (middle of 3 visible lines)
    var scrollLines = Math.max(0, cursorLine - 1);
    innerEl.style.transform = 'translateY(' + -(scrollLines * lh) + 'px)';
  }

  function updateStats() {
    const wpm = calcWPM();
    const acc = calcAccuracy();
    wpmEl.textContent = `${wpm} WPM`;
    if (currentMode === 'zen') {
      accEl.textContent = `${zenWordCount} ${t('words')}`;
    } else if (aiState.mode && !aiState.strictWordCount && text && finished) {
      var wc = text.trim().split(/\s+/).length;
      accEl.textContent = `${acc}% \u00b7 ${wc} ${t('words')}`;
    } else {
      accEl.textContent = `${acc}%`;
    }
    updateTextBackground(wpm);

    // Trail decay: if no recent keystrokes, fade the trail
    if (trailTimestamps.length > 0) {
      var timeSinceLast = Date.now() - trailTimestamps[trailTimestamps.length - 1];
      if (timeSinceLast > 300) {
        // Decay speed factor based on idle time
        trailSpeed = Math.max(0, trailSpeed - 0.15);
        if (trailSpeed <= 0.01) {
          trailTimestamps = [];
          trailSpeed = 0;
        }
        render();
      }
    }
  }

  function updateTextBackground(wpm) {
    if (!textEl) return;
    var isDark = document.documentElement.dataset.theme === 'dark';
    var isNature = document.documentElement.dataset.theme === 'nature';
    // Theme-aware color channels
    var bgR  = isNature ? 21  : isDark ? 26  : 27,  bgG  = isNature ? 34  : isDark ? 0   : 26,  bgB  = isNature ? 16  : isDark ? 51  : 39;
    var brR  = isNature ? 42  : isDark ? 63  : 191, brG  = isNature ? 69  : isDark ? 81  : 153, brB  = isNature ? 34  : isDark ? 181 : 160;
    // Dark: #9c27b0 (156,39,176) → #ff4ecb (255,78,203)
    // Light: #F2A285 (242,162,133) → #F28080 (242,128,128)
    // Nature: #5eb83a (94,184,58) → #7bda4e (123,218,78)
    var pR   = isNature ? 94  : isDark ? 156 : 242, pG   = isNature ? 184 : isDark ? 39  : 162, pB   = isNature ? 58  : isDark ? 176 : 133;
    var phR  = isNature ? 123 : isDark ? 255 : 242, phG  = isNature ? 218 : isDark ? 78  : 128, phB  = isNature ? 78  : isDark ? 203 : 128;

    // If not focused (and not finished with focus), use dim but visible background
    if (!isFocused) {
      var unfocusedAlpha = (isDark || isNature) ? 0.35 : 0.15;
      textEl.style.background = 'rgba(' + bgR + ', ' + bgG + ', ' + bgB + ', ' + unfocusedAlpha + ')';
      textEl.style.borderColor = 'rgba(' + brR + ', ' + brG + ', ' + brB + ', 0.06)';
      textEl.style.boxShadow = '0 0 0 0 rgba(' + pR + ', ' + pG + ', ' + pB + ', 0)';
      return;
    }

    // Ramp-up factor: dampen glow intensity during the first 2 seconds
    // to avoid a flash when WPM is artificially inflated at the start
    var ramp = 1;
    if (startTime && !finished) {
      var elapsed = (Date.now() - startTime - totalPaused) / 1000; // seconds
      ramp = Math.min(elapsed / 2, 1); // 0→1 over 2 seconds
      ramp = ramp * ramp; // ease-in curve for smoother buildup
    }

    // Linear 0–200 mapping, fully opaque at 200
    var t = Math.min(wpm / 200, 1) * ramp;
    // Background opacity: starts visible, fully opaque at 200
    // Dark/Nature theme: higher base for readability
    var bgAlpha = (isDark || isNature) ? (0.6 + t * 0.4) : (0.4 + t * 0.6);
    // Border: visible base, strong at high WPM
    var borderAlpha = 0.25 + t * 0.75;
    // Glow: strong base, intense scaling with WPM
    var glowAlpha = 0.25 + t * 0.75;
    var glowSize = Math.round(20 + t * 60);
    // Secondary outer glow for more spread
    var outerAlpha = 0.08 + t * 0.35;
    var outerSize = Math.round(30 + t * 90);

    // Color transition: primary → accent/hover from 60–130 WPM (also dampened by ramp)
    var effectiveWpm = wpm * ramp;
    var r = pR, g = pG, b = pB;
    if (effectiveWpm >= 60) {
      var ct = Math.min((effectiveWpm - 60) / 70, 1);
      r = Math.round(pR + ct * (phR - pR));
      g = Math.round(pG + ct * (phG - pG));
      b = Math.round(pB + ct * (phB - pB));
    }

    textEl.style.background = 'rgba(' + bgR + ', ' + bgG + ', ' + bgB + ', ' + bgAlpha.toFixed(3) + ')';
    textEl.style.borderColor = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + borderAlpha.toFixed(3) + ')';
    textEl.style.boxShadow = '0 0 ' + glowSize + 'px rgba(' + r + ', ' + g + ', ' + b + ', ' + glowAlpha.toFixed(3) + '), '
                           + '0 0 ' + outerSize + 'px rgba(' + r + ', ' + g + ', ' + b + ', ' + outerAlpha.toFixed(3) + ')';
  }

  function showFinalStats() {
    const wpm = calcWPM();
    const acc = calcAccuracy();
    const seconds = Math.round((Date.now() - startTime - totalPaused) / 1000);
    wpmEl.textContent = `${t('wpmFinal')} : ${wpm}`;
    if (currentMode === 'zen') {
      accEl.textContent = `${t('wordsFinal')} : ${zenWordCount}`;
    } else if (aiState.mode && !aiState.strictWordCount && text) {
      var wc = text.trim().split(/\s+/).length;
      accEl.textContent = `${t('accFinal')} : ${acc}% \u00b7 ${wc} ${t('words')}`;
    } else {
      accEl.textContent = `${t('accFinal')} : ${acc}%`;
    }
    timeEl.textContent = `${t('timeFinal')} : ${seconds}s`;
    timeEl.classList.add('typing-game__time--visible');

    // Best score
    var isNewRecord = saveBestWPM(currentMode, wpm);
    var best = getBestWPM(currentMode);
    bestEl.textContent = `${t('bestFinal')} : ${best} WPM`;
    bestEl.classList.add('typing-game__best--visible');
    if (isNewRecord && wpm > 0) {
      bestEl.classList.add('typing-game__best--new');
    } else {
      bestEl.classList.remove('typing-game__best--new');
    }
  }

  /* ---- Game lifecycle ---- */

  function startGame(forceNewText) {
    // Reset text index to pick a new random text unless replaying after finish
    var prevTextIndex = currentTextIndex;
    if (forceNewText) currentTextIndex = -1;
    text = pickText(forceNewText ? prevTextIndex : undefined);
    text = transformText(text);
    typed = [];
    startTime = null;
    delete container.dataset.playing;
    paused = false;
    pauseStart = null;
    totalPaused = 0;
    finished = false;
    totalKeystrokes = 0;
    lockedIndex = 0;
    correctWords = 0;
    comboStreak = 0;
    wpmBoost = 0;
    trailTimestamps = [];
    trailSpeed = 0;
    zenWordCount = 0;
    if (innerEl) {
      innerEl.remove();
    }
    innerEl = null;
    charSpans = [];
    cachedLH = 0;

    // Remove hardcore/finished states first so display:none overrides are cleared
    container.classList.remove('typing-game--finished');
    container.classList.remove('typing-game--hardcore-memorize', 'typing-game--hardcore-typing', 'typing-game--hardcore-fail', 'typing-game--hardcore-success');
    // Instantly hide stats only after hardcore fail (prevent flash), otherwise let transition play
    if (hardcoreFailed) {
      wpmEl.style.transition = 'none';
      accEl.style.transition = 'none';
    }
    wpmEl.classList.remove('typing-game__wpm--visible');
    accEl.classList.remove('typing-game__acc--visible');
    wpmEl.textContent = '0 WPM';
    if (currentMode === 'zen') {
      accEl.textContent = '0 ' + t('words');
    } else {
      accEl.textContent = '100%';
    }
    if (hardcoreFailed) {
      void wpmEl.offsetHeight;
      wpmEl.style.transition = '';
      accEl.style.transition = '';
    }
    // Reset text background
    updateTextBackground(0);
    timeEl.classList.remove('typing-game__time--visible');
    bestEl.classList.remove('typing-game__best--visible');
    bestEl.classList.remove('typing-game__best--new');
    // Instant collapse (no reverse animation)
    timeEl.style.transition = 'none';
    bestEl.style.transition = 'none';
    requestAnimationFrame(function() {
      timeEl.style.transition = '';
      bestEl.style.transition = '';
    });
    restartEl.classList.remove('typing-game__restart--visible');
    restartEl.dataset.shouldShow = '0';
    // Reset stats to centered position
    wpmEl.style.transform = '';
    accEl.style.transform = '';
    if (wpmInterval) clearInterval(wpmInterval);
    wpmInterval = null;
    // Toggle zen-specific classes
    if (currentMode === 'zen') {
      container.classList.add('typing-game--zen');
      setRestartText(t('zenHint'), ZEN_STOP_ICON);
    } else {
      container.classList.remove('typing-game--zen');
      setRestartText(t('restartHint'));
    }
    // Update translatable UI elements on language change
    var focusHintText = focusHintEl && focusHintEl.querySelector('.typing-game__focus-hint-text');
    if (focusHintText) focusHintText.textContent = t('focusHint');
    if (heroTitleEl && !introActive) heroTitleEl.textContent = t('heroTitle');
    // Hardcore mode reset
    hardcorePhase = null;
    hardcoreFailed = false;
    if (hardcoreTimer) { clearInterval(hardcoreTimer); hardcoreTimer = null; }
    if (hardcoreCountdownEl) hardcoreCountdownEl.classList.remove('typing-game__hc-countdown--visible');
    // If hardcore is active and mode is compatible, start memorize phase
    if (hardcoreMode && currentMode !== 'zen' && ['10'].indexOf(currentMode) !== -1) {
      hardcorePhase = 'memorize';
      hardcoreCountdown = 3;
      container.classList.add('typing-game--hardcore-memorize');
      render();
      // Show countdown overlay
      if (hardcoreCountdownEl) {
        hardcoreCountdownEl.textContent = hardcoreCountdown;
        hardcoreCountdownEl.classList.add('typing-game__hc-countdown--visible');
      }
      hardcoreTimer = setInterval(function () {
        hardcoreCountdown--;
        if (hardcoreCountdown > 0) {
          if (hardcoreCountdownEl) {
            // Re-trigger pop animation by removing & re-adding class
            hardcoreCountdownEl.classList.remove('typing-game__hc-countdown--visible');
            hardcoreCountdownEl.offsetHeight; // force reflow
            hardcoreCountdownEl.textContent = hardcoreCountdown;
            hardcoreCountdownEl.classList.add('typing-game__hc-countdown--visible');
          }
        } else {
          clearInterval(hardcoreTimer);
          hardcoreTimer = null;
          hardcorePhase = 'typing';
          container.classList.remove('typing-game--hardcore-memorize');
          container.classList.add('typing-game--hardcore-typing');
          if (hardcoreCountdownEl) hardcoreCountdownEl.classList.remove('typing-game__hc-countdown--visible');
          render();
          container.focus();
        }
      }, 1000);
    } else {
      render();
    }
    container.focus();
  }

  function finishGame() {
    finished = true;
    delete container.dataset.playing;
    // If the user finished while paused, include paused time
    if (paused && pauseStart) {
      totalPaused += Date.now() - pauseStart;
      pauseStart = null;
      paused = false;
    }
    if (wpmInterval) clearInterval(wpmInterval);

    // Hardcore outcome
    if (hardcoreMode && hardcorePhase === 'typing') {
      container.classList.remove('typing-game--hardcore-typing');
      if (hardcoreFailed) {
        container.classList.add('typing-game--hardcore-fail');
        wpmEl.textContent = t('failText');
        wpmEl.classList.add('typing-game__wpm--visible');
        accEl.textContent = '';
        accEl.classList.remove('typing-game__acc--visible');
        // Reset scroll so all lines (including the first) are visible
        if (innerEl) {
          innerEl.style.transform = '';
        }
      } else {
        container.classList.add('typing-game--hardcore-success');
        showFinalStats();
      }
      hardcorePhase = null;
    } else {
      showFinalStats();
    }

    // Update restart hint for finished state
    if (currentMode === 'zen') {
      setRestartText(t('zenFinishHint'));
    } else {
      setRestartText(t('restartHint'));
    }
    showRestart();
    container.classList.add('typing-game--finished');
    render();
  }

  /* ---- Input handling ---- */

  function handleKey(e) {
    // DEBUG: Ctrl+ArrowUp/Down to adjust artificial WPM boost
    if (e.ctrlKey && e.key === 'ArrowUp') { e.preventDefault(); wpmBoost += 10; updateStats(); return; }
    if (e.ctrlKey && e.key === 'ArrowDown') { e.preventDefault(); wpmBoost = Math.max(0, wpmBoost - 10); updateStats(); return; }

    // Ignore modifier combos (Ctrl+C, etc.) except Shift
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // Block all input during AI inline loading
    if (ai && ai.isInlineActive()) return;

    // Allow restarting during hardcore memorize phase
    if (hardcorePhase === 'memorize') {
      if (e.key === 'Enter') {
        e.preventDefault();
        startGame(true);  // Enter: new text
      } else if (e.key === ' ') {
        e.preventDefault();
        startGame(false); // Space: same text
      }
      return;
    }

    // Restart when finished: Enter = new text, Space = same text (zen: both restart)
    if (finished) {
      if (e.key === 'Enter') {
        e.preventDefault();
        startGame(currentMode === 'zen' ? false : true);  // new text (or zen restart)
      } else if (e.key === ' ') {
        e.preventDefault();
        startGame(false); // same text (or zen restart)
      }
      return;
    }

    // Zen mode: Shift+Space finishes the game
    if (currentMode === 'zen' && e.shiftKey && e.key === ' ') {
      e.preventDefault();
      if (startTime) finishGame();
      return;
    }

    // Enter restarts with a new text during gameplay
    if (e.key === 'Enter') {
      e.preventDefault();
      startGame(true);
      return;
    }

    // --- Zen mode input ---
    if (currentMode === 'zen') {
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (typed.length > 0) {
          typed.pop();
          comboStreak = 0;
          trailTimestamps = [];
          trailSpeed = 0;
          render();
        }
        return;
      }
      if (e.key.length !== 1) return;
      e.preventDefault();

      // Start timer on first keypress
      if (!startTime) {
        startTime = Date.now();
        container.dataset.playing = '1';
        wpmEl.classList.add('typing-game__wpm--visible');
        accEl.classList.add('typing-game__acc--visible');
        wpmInterval = setInterval(updateStats, 200);
        // Show the Shift+Space hint while typing in zen mode
        showRestart();
      }

      typed.push(e.key);
      comboStreak++;
      trailTimestamps.push(Date.now());
      if (trailTimestamps.length > 20) trailTimestamps.shift();
      updateTrailSpeed();

      // Count words on space — only if at least one non-space char precedes it
      if (e.key === ' ') {
        var lastNonSpace = false;
        for (var ti = typed.length - 2; ti >= 0; ti--) {
          if (typed[ti] === ' ') break;
          lastNonSpace = true;
          break;
        }
        if (lastNonSpace) zenWordCount++;
      }

      render();
      return;
    }

    // --- Normal mode input ---
    if (e.key === 'Backspace') {
      e.preventDefault();
      // No backspace in hardcore typing phase
      if (hardcoreMode && hardcorePhase === 'typing') return;
      if (typed.length > lockedIndex) {        totalKeystrokes--;
        typed.pop();
        comboStreak = 0;
        trailTimestamps = [];
        trailSpeed = 0;
        render();
      }
      return;
    }

    // Only accept printable single-character keys
    if (e.key.length !== 1) return;
    e.preventDefault();

    // Start timer on first keypress
    if (!startTime) {
      startTime = Date.now();
      container.dataset.playing = '1';
      wpmEl.classList.add('typing-game__wpm--visible');
      accEl.classList.add('typing-game__acc--visible');
      wpmInterval = setInterval(updateStats, 200);
    }

    totalKeystrokes++;
    typed.push(e.key);

    // Track combo streak (consecutive correct chars)
    var lastIdx = typed.length - 1;
    if (typed[lastIdx] === text[lastIdx]) {
      comboStreak++;
      // Track keystroke time for trail speed
      trailTimestamps.push(Date.now());
      // Keep only last 20 timestamps
      if (trailTimestamps.length > 20) trailTimestamps.shift();
      // Compute speed: chars per second over recent window
      updateTrailSpeed();
    } else {
      comboStreak = 0;
      trailTimestamps = [];
      trailSpeed = 0;
      // Hardcore: any error ends the game immediately
      if (hardcoreMode && hardcorePhase === 'typing') {
        hardcoreFailed = true;
        render();
        finishGame();
        return;
      }
    }

    // Try to lock the current word as soon as its last character is typed
    tryLockWord();

    render();

    // Check completion
    if (typed.length === text.length) {
      finishGame();
    }
  }

  /* ---- Zen popup (first time) ---- */

  function showZenPopup() {
    setCookie('typing_zen_seen', '1', 365);
    showInfoPopup(t('zenTitle'),
      t('zenDesc'),
      t('zenShortcut'),);
  }

  /* ---- Hardcore popup (first time) ---- */

  function showHardcorePopup(onClose) {
    setCookie('typing_hardcore_seen', '1', 365);
    showInfoPopup(t('hardcoreTitle'),
      t('hardcoreDesc'),
      t('hardcoreShortcut'),
      onClose);
  }

  /* ---- Shared info popup ---- */

  function showInfoPopup(title, text, shortcut, onClose) {
    var overlay = document.createElement('div');
    overlay.className = 'zen-popup-overlay';
    var popup = document.createElement('div');
    popup.className = 'zen-popup';
    popup.innerHTML =
      '<div class="zen-popup__title">' + title + '</div>' +
      '<p class="zen-popup__text">' + text + '</p>' +
      '<div class="zen-popup__shortcut">' + shortcut + '</div>' +
      '<button class="zen-popup__btn">' + t('gotIt') + '</button>';
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    // Force reflow then animate in
    overlay.offsetHeight;
    overlay.classList.add('zen-popup-overlay--visible');

    function onKeyDown(e) {
      if (e.key === 'Escape') close();
    }
    function close() {
      document.removeEventListener('keydown', onKeyDown);
      overlay.classList.remove('zen-popup-overlay--visible');
      overlay.addEventListener('transitionend', function handler() {
        overlay.removeEventListener('transitionend', handler);
        overlay.remove();
        if (typeof onClose === 'function') onClose();
        container.focus();
      });
    }
    popup.querySelector('.zen-popup__btn').addEventListener('click', close);
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) close();
    });
    document.addEventListener('keydown', onKeyDown);
  }

  /* ---- AI text generation — delegated to typing-game-ai.js module ---- */

  /* ---- Settings popup ---- */

  function showSettingsPopup(onChanged) {
    var overlay = document.createElement('div');
    overlay.className = 'zen-popup-overlay';
    var popup = document.createElement('div');
    popup.className = 'zen-popup typing-game__settings-popup';
    var changed = false;

    var options = [
      { key: 'uppercase', label: t('uppercase'), desc: 'ABC', get: function() { return settingsUppercase; }, set: function(v) { settingsUppercase = v; } },
      { key: 'punctuation', label: t('punctuation'), desc: '.,;!?', get: function() { return settingsPunctuation; }, set: function(v) { settingsPunctuation = v; } },
      { key: 'numbers', label: t('settNumbers'), desc: '123', get: function() { return settingsNumbers; }, set: function(v) { settingsNumbers = v; } },
      { key: 'special', label: t('settSpecial'), desc: '@#$%', get: function() { return settingsSpecial; }, set: function(v) { settingsSpecial = v; } }
    ];

    var html = '<div class="zen-popup__title">' + t('settTitle') + '</div>' +
      '<p class="zen-popup__text">' + t('settDesc') + '</p>' +
      '<div class="typing-game__settings-options">';

    options.forEach(function(opt) {
      html += '<label class="typing-game__settings-option">' +
        '<input type="checkbox" class="typing-game__settings-check" data-key="' + opt.key + '"' + (opt.get() ? ' checked' : '') + '/>' +
        '<span class="typing-game__settings-toggle"></span>' +
        '<span class="typing-game__settings-label">' + opt.label + '</span>' +
        '<span class="typing-game__settings-desc">' + opt.desc + '</span>' +
        '</label>';
    });

    html += '</div>' +
      '<button class="zen-popup__btn typing-game__settings-confirm">' + t('settApply') + '</button>';
    popup.innerHTML = html;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Bind checkbox toggle events
    var checks = popup.querySelectorAll('.typing-game__settings-check');
    checks.forEach(function(check) {
      check.addEventListener('change', function() {
        var key = check.getAttribute('data-key');
        options.forEach(function(o) {
          if (o.key === key) o.set(check.checked);
        });
        changed = true;
      });
    });

    // Animate in
    overlay.offsetHeight;
    overlay.classList.add('zen-popup-overlay--visible');

    function onKeyDown(e) {
      if (e.key === 'Escape') close();
    }
    function close() {
      document.removeEventListener('keydown', onKeyDown);
      overlay.classList.remove('zen-popup-overlay--visible');
      overlay.addEventListener('transitionend', function handler() {
        overlay.removeEventListener('transitionend', handler);
        overlay.remove();
        if (changed) {
          saveSettingsOptions();
          if (typeof onChanged === 'function') onChanged();
        }
        container.focus();
      });
    }

    popup.querySelector('.typing-game__settings-confirm').addEventListener('click', close);
    overlay.addEventListener('click', function(ev) {
      if (ev.target === overlay) close();
    });
    popup.addEventListener('keydown', function(e) {
      e.stopPropagation();
      if (e.key === 'Escape') close();
    });
    document.addEventListener('keydown', onKeyDown);
  }

  /* ---- Navbar builder ---- */

  function buildNavbar() {
    navbarEl = document.createElement('div');
    navbarEl.className = 'typing-game__navbar';

    /* ---- Tooltip system ---- */
    var TOOLTIP_TEXTS = {
      fr: {
        fr: 'Passer en français',
        en: 'Passer en anglais',
        '10': 'Texte de 10 mots',
        '25': 'Texte de 25 mots',
        '50': 'Texte de 50 mots',
        '100': 'Texte de 100 mots',
        zen: 'Lancer le mode zen',
        eye: 'Afficher / masquer les erreurs',
        hardcore: 'Lancer le mode hardcore',
        'hardcore-active': 'Quitter le mode hardcore',
        ai: 'Générer des textes avec l\'IA',
        'ai-active': 'Désactiver les textes IA',
        aiTheme: 'Changer le thème IA',
        settings: 'Paramètres du texte'
      },
      en: {
        fr: 'Switch to French',
        en: 'Switch to English',
        '10': 'Text of 10-word',
        '25': 'Text of 25-word',
        '50': 'Text of 50-word',
        '100': 'Text of 100-word',
        zen: 'Start zen mode',
        eye: 'Show / hide errors',
        hardcore: 'Start hardcore mode',
        'hardcore-active': 'Quit hardcore mode',
        ai: 'Generate texts with AI',
        'ai-active': 'Disable AI texts',
        aiTheme: 'Change AI theme',
        settings: 'Text settings'
      }
    };

    var tooltipEl = document.createElement('div');
    tooltipEl.className = 'typing-game__tooltip';
    var tooltipTimer = null;

    function showTooltip(anchor, key) {
      clearTimeout(tooltipTimer);
      var texts = TOOLTIP_TEXTS[uiLang] || TOOLTIP_TEXTS.fr;
      var resolvedKey = key;
      if (key === 'ai' && aiState.mode) resolvedKey = 'ai-active';
      if (key === 'hardcore' && hardcoreMode) resolvedKey = 'hardcore-active';
      tooltipEl.textContent = texts[resolvedKey] || '';
      if (!tooltipEl.textContent) return;
      anchor.style.position = 'relative';
      anchor.appendChild(tooltipEl);
      // Force reflow then show
      void tooltipEl.offsetWidth;
      tooltipEl.classList.add('typing-game__tooltip--visible');
    }

    function hideTooltip() {
      tooltipEl.classList.remove('typing-game__tooltip--visible');
      tooltipTimer = setTimeout(function() {
        if (tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
      }, 200);
    }

    function attachTooltip(el, key) {
      el.addEventListener('mouseenter', function() { showTooltip(el, key); });
      el.addEventListener('mouseleave', hideTooltip);
      el.addEventListener('click', hideTooltip);
    }

    // Language selector
    const langGroup = buildOptionGroup(
      [{ key: 'fr', label: 'FR' }, { key: 'en', label: 'EN' }],
      currentLang,
      function (key) {
        currentLang = key;
        startGame(false);
      }
    );
    // Attach tooltips to lang buttons
    langGroup.querySelectorAll('.typing-game__option').forEach(function(btn) {
      attachTooltip(btn, btn.getAttribute('data-key'));
    });

    // Separator
    const sep = document.createElement('span');
    sep.className = 'typing-game__navbar-sep';
    sep.textContent = '|';

    // Mode selector
    const modeGroup = buildOptionGroup(
      [
        { key: '10', label: '10' },
        { key: '25', label: '25' },
        { key: '50', label: '50' },
        { key: '100', label: '100' },
        { key: 'zen', label: 'zen' },
      ],
      currentMode,
      function (key) {
        currentMode = key;
        startGame(true);
        // First time zen: show info popup
        if (key === 'zen' && !getCookie('typing_zen_seen')) {
          showZenPopup();
        }
      }
    );
    // Attach tooltips to mode buttons
    modeGroup.querySelectorAll('.typing-game__option').forEach(function(btn) {
      attachTooltip(btn, btn.getAttribute('data-key'));
    });

    // Settings gear button (inside mode group, after zen)
    var settingsGearBtn = document.createElement('button');
    settingsGearBtn.className = 'typing-game__settings';
    settingsGearBtn.setAttribute('tabindex', '-1');
    settingsGearBtn.setAttribute('title', t('settTitleAttr'));
    settingsGearBtn.innerHTML = '<svg class="typing-game__settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
    '</svg>';

    function updateSettingsUI() {
      var anyActive = settingsUppercase || settingsPunctuation || settingsNumbers || settingsSpecial;
      settingsGearBtn.classList.toggle('typing-game__settings--active', anyActive);
    }

    settingsGearBtn.addEventListener('click', function(e) {
      e.preventDefault();
      showSettingsPopup(function() {
        updateSettingsUI();
        startGame(true);
      });
    });

    updateSettingsUI();
    attachTooltip(settingsGearBtn, 'settings');
    modeGroup.appendChild(settingsGearBtn);

    navbarEl.appendChild(langGroup);
    navbarEl.appendChild(sep);
    navbarEl.appendChild(modeGroup);

    // Eye toggle for error details
    var sep2 = document.createElement('span');
    sep2.className = 'typing-game__navbar-sep';
    sep2.textContent = '|';
    navbarEl.appendChild(sep2);

    var eyeBtn = document.createElement('button');
    eyeBtn.className = 'typing-game__eye';
    eyeBtn.setAttribute('tabindex', '-1');
    eyeBtn.setAttribute('title', t('eyeTitleAttr'));
    eyeBtn.innerHTML = '<svg class="typing-game__eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="typing-game__eye-top" d="M1 12s4-8 11-8 11 8 11 8"/><path class="typing-game__eye-bottom" d="M1 12s4 8 11 8 11-8 11-8"/><circle class="typing-game__eye-pupil" cx="12" cy="12" r="3"/><line class="typing-game__eye-slash" x1="2" y1="2" x2="22" y2="22"/></svg>';
    // Appliquer l'état initial de showErrors
    eyeBtn.classList.toggle('typing-game__eye--active', showErrors);
    container.classList.toggle('typing-game--show-errors', showErrors);
    attachTooltip(eyeBtn, 'eye');
    eyeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      showErrors = !showErrors;
      eyeBtn.classList.toggle('typing-game__eye--active', showErrors);
      container.classList.toggle('typing-game--show-errors', showErrors);
      saveSettings(currentLang, currentMode, showErrors);
      container.focus();
    });
    navbarEl.appendChild(eyeBtn);

    // Hardcore toggle (skull icon)
    var hcBtn = document.createElement('button');
    hcBtn.className = 'typing-game__hardcore';
    hcBtn.setAttribute('tabindex', '-1');
    hcBtn.setAttribute('title', t('hcTitleAttr'));
    hcBtn.innerHTML = '<svg class="typing-game__hardcore-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><g class="typing-game__hc-happy"><circle cx="8.5" cy="11" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.5" cy="11" r="1.5" fill="currentColor" stroke="none"/><path d="M8 16c0 0 1.5 2 4 2s4-2 4-2" stroke="currentColor" stroke-width="1.6" fill="none"/></g><g class="typing-game__hc-scary"><rect x="7" y="9" width="3" height="3.5" rx="0.3" fill="currentColor" stroke="none"/><rect x="14" y="9" width="3" height="3.5" rx="0.3" fill="currentColor" stroke="none"/><path d="M8 17h8" stroke="currentColor" stroke-width="1.8"/><path d="M10 17v-1.5M14 17v-1.5" stroke="currentColor" stroke-width="1.4"/></g></svg>';

    function updateHardcoreUI() {
      hcBtn.classList.toggle('typing-game__hardcore--active', hardcoreMode);
      container.classList.toggle('typing-game--hardcore', hardcoreMode);
      // Grey out incompatible modes when hardcore is active
      var modeBtns = modeGroup.querySelectorAll('.typing-game__option');
      modeBtns.forEach(function(btn) {
        var key = btn.getAttribute('data-key');
        if (hardcoreMode && ['25', '50', '100', 'zen'].indexOf(key) !== -1) {
          btn.classList.add('typing-game__option--disabled');
        } else {
          btn.classList.remove('typing-game__option--disabled');
        }
      });
    }

    hcBtn.addEventListener('click', function(e) {
      e.preventDefault();
      hardcoreMode = !hardcoreMode;
      updateHardcoreUI();
      saveSettings(currentLang, currentMode, showErrors);
      // If turning on and mode is incompatible, switch to 10
      if (hardcoreMode && ['25', '50', '100', 'zen'].indexOf(currentMode) !== -1) {
        currentMode = '10';
        // Update active class in mode group
        modeGroup.querySelectorAll('.typing-game__option').forEach(function(b) {
          b.classList.toggle('typing-game__option--active', b.getAttribute('data-key') === currentMode);
        });
      }
      // First time popup — delay startGame until popup is closed
      if (hardcoreMode && !getCookie('typing_hardcore_seen')) {
        showHardcorePopup(function() { startGame(true); });
      } else {
        startGame(true);
      }
    });

    updateHardcoreUI();
    attachTooltip(hcBtn, 'hardcore');
    navbarEl.appendChild(hcBtn);

    // ---- AI mode sub-section ----
    var sep3 = document.createElement('span');
    sep3.className = 'typing-game__navbar-sep';
    sep3.textContent = '|';
    navbarEl.appendChild(sep3);

    // AI toggle button
    var aiBtn = document.createElement('button');
    aiBtn.className = 'typing-game__ai';
    aiBtn.setAttribute('tabindex', '-1');
    aiBtn.setAttribute('title', t('aiTitleAttr'));
    // Dual-star icon with floating mini-stars container
    aiBtn.innerHTML = '<div class="typing-game__ai-wrap">' +
      '<svg class="typing-game__ai-icon" viewBox="0 0 24 24" fill="none">' +
        '<path class="typing-game__ai-star typing-game__ai-star--back" d="M14.5 3l1.3 4 4.2.5-3.1 2.6.8 4.2-3.7-2-3.7 2 .8-4.2-3.1-2.6 4.2-.5z" fill="currentColor" opacity="0.45"/>' +
        '<path class="typing-game__ai-star typing-game__ai-star--front" d="M10 8.5l1.05 3.15 3.32.4-2.45 2.05.65 3.4L10 15.63 7.43 17.5l.65-3.4-2.45-2.05 3.32-.4z" fill="currentColor"/>' +
      '</svg>' +
      '<span class="typing-game__ai-mini typing-game__ai-mini--1"></span>' +
      '<span class="typing-game__ai-mini typing-game__ai-mini--2"></span>' +
      '<span class="typing-game__ai-mini typing-game__ai-mini--3"></span>' +
      '<span class="typing-game__ai-mini typing-game__ai-mini--4"></span>' +
    '</div>';

    // "Change theme" button — only visible when AI mode is active
    aiThemeBtn = document.createElement('button');
    aiThemeBtn.className = 'typing-game__ai-theme';
    aiThemeBtn.setAttribute('tabindex', '-1');
    aiThemeBtn.setAttribute('title', t('aiThemeTitleAttr'));
    aiThemeBtn.innerHTML = '<svg class="typing-game__ai-theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' +
    '</svg>';

    function updateAiUI() {
      aiBtn.classList.toggle('typing-game__ai--active', aiState.mode);
      container.classList.toggle('typing-game--ai', aiState.mode);
      aiThemeBtn.classList.toggle('typing-game__ai-theme--visible', aiState.mode);
    }

    aiBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (aiState.mode) {
        // Deactivate AI mode — revert to default texts
        aiState.mode = false;
        aiState.texts = null;
        aiState.theme = '';
        updateAiUI();
        startGame(true);
      } else {
        // Activate — show popup
        ai.showPopup(function() {
          aiState.mode = true;
          updateAiUI();
          startGame(true);
        });
      }
    });

    aiThemeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      // Reopen popup to change theme while keeping AI mode on
      ai.showPopup(function() {
        startGame(true);
      });
    });

    updateAiUI();
    attachTooltip(aiBtn, 'ai');
    attachTooltip(aiThemeBtn, 'aiTheme');
    navbarEl.appendChild(aiBtn);
    navbarEl.appendChild(aiThemeBtn);

    return navbarEl;
  }

  function buildOptionGroup(options, activeKey, onChange) {
    const group = document.createElement('div');
    group.className = 'typing-game__option-group';

    options.forEach(function (opt) {
      const btn = document.createElement('button');
      btn.className = 'typing-game__option';
      if (opt.key === activeKey) btn.classList.add('typing-game__option--active');
      btn.textContent = opt.label;
      btn.setAttribute('data-key', opt.key);
      btn.setAttribute('tabindex', '-1');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        // Block clicking disabled options (hardcore mode restriction)
        if (btn.classList.contains('typing-game__option--disabled')) return;
        group.querySelectorAll('.typing-game__option').forEach(function (b) {
          b.classList.remove('typing-game__option--active');
        });
        btn.classList.add('typing-game__option--active');
        onChange(opt.key);
        saveSettings(currentLang, currentMode, showErrors);
      });
      group.appendChild(btn);
    });

    return group;
  }

  /* ---- Intro typewriter — delegated to typing-game-intro.js module ---- */

  function buildGameDOM() {
    // Build inner DOM
    var navbar = buildNavbar();

    textEl = document.createElement('div');
    textEl.className = 'typing-game__text';

    wpmEl = document.createElement('div');
    wpmEl.className = 'typing-game__wpm';
    wpmEl.textContent = '0 WPM';

    accEl = document.createElement('div');
    accEl.className = 'typing-game__acc';
    accEl.textContent = '100%';

    timeEl = document.createElement('div');
    timeEl.className = 'typing-game__time';
    timeEl.textContent = '';

    bestEl = document.createElement('div');
    bestEl.className = 'typing-game__best';
    bestEl.textContent = '';

    restartEl = document.createElement('div');
    restartEl.className = 'typing-game__restart';
    restartEl.dataset.shouldShow = '0';
    setRestartText(t('restartHint'));

    // Focus hint (visible when blurred)
    focusHintEl = document.createElement('div');
    focusHintEl.className = 'typing-game__focus-hint';
    focusHintEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg> <span class="typing-game__focus-hint-text">' + t('focusHint') + '</span>';

    // Stats row wraps WPM + Accuracy side by side
    statsRow = document.createElement('div');
    statsRow.className = 'typing-game__stats';
    statsRow.appendChild(wpmEl);
    statsRow.appendChild(accEl);
    statsRow.appendChild(timeEl);
    statsRow.appendChild(bestEl);

    // Hardcore countdown overlay
    hardcoreCountdownEl = document.createElement('div');
    hardcoreCountdownEl.className = 'typing-game__hc-countdown';

    container.appendChild(navbar);
    container.appendChild(textEl);
    container.appendChild(hardcoreCountdownEl);
    container.appendChild(restartEl);
    container.appendChild(focusHintEl);
    container.appendChild(statsRow);

    // Make it focusable & listen for keys
    container.setAttribute('tabindex', '0');
    container.addEventListener('keydown', handleKey);

    // Focus / blur detection
    container.addEventListener('focus', function () {
      // Reject focus while the AI inline loader is active
      if (ai && ai.isInlineActive()) { container.blur(); return; }
      isFocused = true;
      container.dataset.focused = '1';
      if (blurHintTimer) { clearTimeout(blurHintTimer); blurHintTimer = null; }
      container.classList.remove('typing-game--blurred');
      container.classList.add('typing-game--focused');
      if (finished) {
        container.classList.add('typing-game--finished');
      }
      // Hide focus hint & scroll-hint on focus
      focusHintEl.classList.remove('typing-game__focus-hint--visible');
      // Show restart hint if it was flagged visible
      if (restartEl.dataset.shouldShow === '1') {
        restartEl.classList.add('typing-game__restart--visible');
      }
      // Clear fast-blur transition so CSS classes govern focus-in speed
      if (textEl) textEl.style.transition = '';
      // If the game was paused due to blur, resume timing and stats updates
      if (paused && startTime && !finished) {
        // accumulate paused duration
        totalPaused += Date.now() - (pauseStart || Date.now());
        pauseStart = null;
        paused = false;
        if (!wpmInterval) wpmInterval = setInterval(updateStats, 200);
      }
      updateTextBackground(calcWPM());
    });

    container.addEventListener('blur', function () {
      isFocused = false;
      container.classList.remove('typing-game--focused');
      container.classList.remove('typing-game--finished');
      // Hide restart hint on blur
      restartEl.classList.remove('typing-game__restart--visible');
      // Debounce focus hint to avoid flash on navbar clicks
      if (blurHintTimer) clearTimeout(blurHintTimer);
      blurHintTimer = setTimeout(function () {
        if (!isFocused && hardcorePhase !== 'memorize' && !(ai && ai.isInlineActive())) {
          container.classList.add('typing-game--blurred');
          focusHintEl.classList.add('typing-game__focus-hint--visible');
          delete container.dataset.focused;
        }
        blurHintTimer = null;
      }, 120);
      // Pause timing when the container loses focus during an active game
      if (startTime && !finished && !paused) {
        paused = true;
        pauseStart = Date.now();
        if (wpmInterval) {
          clearInterval(wpmInterval);
          wpmInterval = null;
        }
      }
      // Faster transition when unfocusing
      if (textEl) textEl.style.transition = 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease';
      updateTextBackground(0);
    });
  }

  /* ---- Initialisation ---- */

  function init() {
    container = document.getElementById('typing-game');
    if (!container) return;

    // Detect smartphone: narrow screen + touch device
    var isSmartphone = window.matchMedia('(max-width: 600px) and (pointer: coarse)').matches;

    // Load saved settings from cookies
    var saved = loadSettings();
    if (saved.lang) currentLang = saved.lang;
    if (saved.mode) currentMode = saved.mode;
    if (typeof saved.showErrors !== 'undefined') showErrors = saved.showErrors;
    if (saved.hardcore) hardcoreMode = true;
    settingsUppercase = saved.uppercase;
    settingsNumbers = saved.numbers;
    settingsPunctuation = saved.punctuation;
    settingsSpecial = saved.special;
    aiState.uppercase = saved.aiUppercase;
    aiState.punctuation = saved.aiPunctuation;
    aiState.strictWordCount = saved.aiStrictWordCount;
    // If hardcore is on but mode is incompatible, force to 10
    if (hardcoreMode && ['25', '50', '100', 'zen'].indexOf(currentMode) !== -1) {
      currentMode = '10';
    }

    // Create AI module (typing-game-ai.js)
    ai = window.createTypingGameAI({
      t: t,
      aiState: aiState,
      getContainer: function () { return container; },
      getNavbar: function () { return navbarEl; },
      getTextEl: function () { return textEl; },
      getFocusHint: function () { return focusHintEl; },
      clearBlurHint: function () {
        if (blurHintTimer) { clearTimeout(blurHintTimer); blurHintTimer = null; }
      },
      saveAiOptions: function () { saveAiOptions(); }
    });

    // Create intro module (typing-game-intro.js)
    intro = window.createTypingGameIntro({
      t: t,
      getContainer: function () { return container; },
      getHeroTitle: function () { return heroTitleEl; },
      setHeroTitle: function (el) { heroTitleEl = el; },
      setIntroActive: function (v) { introActive = v; },
      showInfoPopup: showInfoPopup,
      unlockGame: unlockGame,
      buildGameDOM: function () { buildGameDOM(); },
      startGame: function (force) { startGame(force); }
    });

    // Listen for site-wide language changes
    document.addEventListener('sitelangchange', function (e) {
      uiLang = e.detail && e.detail.lang || 'fr';
      // Refresh visible UI text if the game DOM is built
      if (container && navbarEl) {
        // Rebuild navbar to update all tooltips & labels
        var oldNav = navbarEl;
        var newNav = buildNavbar();
        if (oldNav.parentNode) oldNav.parentNode.replaceChild(newNav, oldNav);
        // Refresh hints / stats / hero title
        startGame(false);
      }
    });

    // --- If game has never been unlocked: show intro typewriter ---
    if (!isGameUnlocked()) {
      intro.showIntro(isSmartphone);
      return;
    }

    // --- Mobile smartphone mode (already unlocked): show static intro text ---
    if (isSmartphone) {
      heroTitleEl = document.querySelector('#hero .section__title');
      if (heroTitleEl) heroTitleEl.textContent = t('heroIntro');
      intro.buildSmartphoneStaticDOM();
      return;
    }

    // --- Desktop: full game ---
    buildGameDOM();
    startGame(true);

    // Re-render on theme change to update trail/combo colors
    new MutationObserver(function () {
      if (!finished && typed.length > 0) render();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // Boot when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

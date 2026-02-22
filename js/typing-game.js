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

  function loadSettings() {
    var lang = getCookie('typing_lang');
    var mode = getCookie('typing_mode');
    var showErrorsCookie = getCookie('typing_show_errors');
    return {
      lang: (lang === 'fr' || lang === 'en') ? lang : null,
      mode: mode && ['10', '25', '50', '100', 'zen'].indexOf(mode) !== -1 ? mode : null,
      showErrors: showErrorsCookie === '1',
      hardcore: false
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

  /* ---- Gemini AI config ---- */

  var GEMINI_API_KEY = 'AIzaSyACpBeIy-9DC-UbjLoXiltfKHbQHqdJPSE';
  var GEMINI_MODEL = 'gemini-2.5-flash';
  var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=';

  /* ---- Intro presentation text (shown before game is unlocked) ---- */

  const INTRO_TEXT = 'Bienvenue sur mon portfolio ! Je suis Paolo Colombat, développeur full stack passionné, actuellement en 2ème année de BUT Informatique. Ici vous découvrirez mes projets, mes compétences techniques et un moyen de me contacter. Bonne visite !';

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
  let aiMode = false; // AI text generation toggle
  let aiTexts = null; // generated texts when AI mode is active: { fr: { '10': [...], ... }, en: { ... } }
  let aiTheme = ''; // current AI theme description
  let aiLoading = false; // whether an AI request is in-flight
  let aiThemeBtn = null; // reference to the "change theme" button in navbar

  /* ---- DOM refs (set in init) ---- */

  let container, navbarEl, textEl, innerEl, wpmEl, accEl, timeEl, bestEl, restartEl, statsRow, focusHintEl, hardcoreCountdownEl;
  let introTextEl, introButtonEl, heroTitleEl; // intro mode DOM refs

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
    return (aiMode && aiTexts) ? aiTexts : TEXTS;
  }

  function pickText() {
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
    var idx;
    if (pool.length > 1) {
      do { idx = Math.floor(Math.random() * pool.length); } while (idx === currentTextIndex);
    } else {
      idx = 0;
    }
    currentTextIndex = idx;
    return pool[idx];
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
          lastCorrect_end = wordEnd + 1;
        } else {
          lastCorrect_end = wordEnd;
        }
      }

      // Move to next word
      if (wordEnd >= text.length) break;
      wordStart = wordEnd + 1;
      if (typed.length <= wordStart) break;
    }

    // If we found at least one correct word, lock everything up to it
    if (lastCorrect_end > lockedIndex) {
      correctWords += correctInBatch;
      lockedIndex = lastCorrect_end;
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
    var trailR = zenDk ? 156 : 242, trailG = zenDk ? 39 : 162, trailB = zenDk ? 176 : 133;

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
      textEl.appendChild(innerEl);
    }
    innerEl.innerHTML = html;

    requestAnimationFrame(scrollToCursor);
  }

  /* ---- Rendering ---- */

  function render() {
    if (currentMode === 'zen') { renderZen(); return; }
    let html = '';
    let comboStyle = '';

    // In hardcore typing phase, untyped chars are hidden
    var hideUntyped = hardcoreMode && hardcorePhase === 'typing' && !finished;

    // Trail: compute how many chars behind the cursor to highlight
    // Trail length depends on combo streak AND speed
    var trailLen = 0;
    if (comboStreak >= 10 && trailSpeed > 0.05) {
      // Base trail from combo: scales slower, much longer max
      // 2 at streak 3, up to 30 at streak 150+
      var comboFactor = Math.min(comboStreak / 150, 1);
      trailLen = Math.round(2 + comboFactor * 28);
      // Speed amplifies trail length significantly
      trailLen = Math.round(trailLen * (0.15 + trailSpeed * 0.85));
    }

    // Trail color shift: primary → accent/hover matching cursor combo shift
    var isDark = document.documentElement.dataset.theme === 'dark';
    // Dark: #9c27b0 (156,39,176) → #ff4ecb (255,78,203)
    // Light: #F2A285 (242,162,133) → #F28080 (242,128,128)
    var trailR = isDark ? 156 : 242, trailG = isDark ? 39 : 162, trailB = isDark ? 176 : 133;
    var trailHR = isDark ? 255 : 242, trailHG = isDark ? 78 : 128, trailHB = isDark ? 203 : 128;
    if (comboStreak >= 50) {
      var tc = Math.min((comboStreak - 50) / 50, 1);
      trailR = Math.round(trailR + tc * (trailHR - trailR));
      trailG = Math.round(trailG + tc * (trailHG - trailG));
      trailB = Math.round(trailB + tc * (trailHB - trailB));
    }

    for (let i = 0; i < text.length; i++) {
      let cls = 'typing-game__char';
      var trailAttr = '';

      if (i < typed.length) {
        const isLocked = i < lockedIndex;
        cls += typed[i] === text[i]
          ? ' typing-game__char--correct'
          : ' typing-game__char--incorrect';
        if (isLocked) cls += ' typing-game__char--locked';

        // Trail: apply to correct chars near cursor
        if (!finished && trailLen > 0 && typed[i] === text[i]) {
          var distFromCursor = typed.length - i;
          if (distFromCursor <= trailLen && distFromCursor >= 1) {
            cls += ' typing-game__char--trail';
            // Opacity: closer to cursor = brighter, further = dimmer
            var trailOpacity = (1 - (distFromCursor - 1) / trailLen) * trailSpeed;
            trailOpacity = Math.max(0.05, Math.min(1, trailOpacity));
            trailAttr = ' style="--trail-opacity:' + trailOpacity.toFixed(3)
              + ';--trail-r:' + trailR
              + ';--trail-g:' + trailG
              + ';--trail-b:' + trailB + '"';
          }
        }
      }

      // Cursor sits on the next character to type
      if (i === typed.length && !finished) {
        cls += ' typing-game__char--cursor';
        // Combo streak tier classes
        if (comboStreak >= 60) cls += ' typing-game__char--combo-3';
        else if (comboStreak >= 30) cls += ' typing-game__char--combo-2';
        else if (comboStreak >= 10) cls += ' typing-game__char--combo-1';
        // Combo color shift: primary → accent/hover from 50–100 streak
        if (comboStreak >= 50) {
          var cc = Math.min((comboStreak - 50) / 50, 1);
          // Dark: #9c27b0 → #ff4ecb | Light: #F2A285 → #F28080
          var cBaseR = isDark ? 156 : 242, cBaseG = isDark ? 39 : 162, cBaseB = isDark ? 176 : 133;
          var cHoverR = isDark ? 255 : 242, cHoverG = isDark ? 78 : 128, cHoverB = isDark ? 203 : 128;
          var cr = Math.round(cBaseR + cc * (cHoverR - cBaseR));
          var cg = Math.round(cBaseG + cc * (cHoverG - cBaseG));
          var cb = Math.round(cBaseB + cc * (cHoverB - cBaseB));
          comboStyle = ' style="--combo-clr:rgb(' + cr + ',' + cg + ',' + cb + ')"';
        } else {
          comboStyle = '';
        }
      }

      // When finished, put a static cursor AFTER the last character
      if (finished && i === text.length - 1) {
        cls += ' typing-game__char--cursor typing-game__char--cursor-end';
      }

      // Show the original char (spaces wrap normally)
      const ch = text[i] === ' ' ? ' ' : text[i];

      // In hardcore typing phase, hide untyped characters (use real chars for consistent layout)
      if (hideUntyped && i > typed.length) {
        html += '<span class="typing-game__char typing-game__char--hidden">' + ch + '</span>';
        continue;
      }
      // In hardcore typing, cursor position also uses hidden class so letter is invisible
      if (hideUntyped && i === typed.length) {
        // Cursor span with hidden text — cls already includes --cursor
        var extraAttrCursor = comboStyle;
        html += '<span class="' + cls + ' typing-game__char--hidden"' + extraAttrCursor + '>' + ch + '</span>';
        continue;
      }

      // Use comboStyle on cursor span, trailAttr on trail spans
      var extraAttr = (i === typed.length && !finished) ? comboStyle : trailAttr;

      // If incorrect, show the mistyped letter below
      if (i < typed.length && typed[i] !== text[i]) {
        const wrong = typed[i] === ' ' ? '␣' : typed[i];
        html += `<span class="${cls}"${extraAttr}><span class="typing-game__char-expected">${ch}</span><span class="typing-game__char-wrong">${wrong}</span></span>`;
      } else {
        html += `<span class="${cls}"${extraAttr}>${ch}</span>`;
      }
    }

    // Wrap in inner div for scrolling
    if (!innerEl) {
      innerEl = document.createElement('div');
      innerEl.className = 'typing-game__text-inner';
      textEl.textContent = '';
      textEl.appendChild(innerEl);
    }
    innerEl.innerHTML = html;

    // Scroll so the cursor stays on the middle visible line
    requestAnimationFrame(scrollToCursor);
  }

  function scrollToCursor() {
    if (!innerEl) return;
    // After hardcore fail, don't scroll — keep all lines visible
    if (hardcoreFailed && finished) return;
    const cursorSpan = innerEl.querySelector('.typing-game__char--cursor');
    if (!cursorSpan) return;

    var innerRect = innerEl.getBoundingClientRect();
    var cursorRect = cursorSpan.getBoundingClientRect();

    // Line height in px
    var lh = parseFloat(getComputedStyle(textEl).fontSize) * 1.6;

    // Cursor position within content (getBoundingClientRect already accounts for transform)
    var cursorY = cursorRect.top - innerRect.top;
    var cursorLine = Math.floor(cursorY / lh);

    // Keep cursor on line 1 (middle of 3)
    var scrollLines = Math.max(0, cursorLine - 1);
    innerEl.style.transform = 'translateY(' + -(scrollLines * lh) + 'px)';

    // Hide characters on lines that scrolled above the visible area
    // (overflow:hidden clips at padding-box, so chars in the padding zone stay visible otherwise)
    if (scrollLines > 0) {
      var cutoffY = scrollLines * lh;
      var spans = innerEl.children;
      for (var i = 0; i < spans.length; i++) {
        if (spans[i].offsetTop < cutoffY - 2) {
          spans[i].style.visibility = 'hidden';
        } else {
          break;
        }
      }
    }
  }

  function updateStats() {
    const wpm = calcWPM();
    const acc = calcAccuracy();
    wpmEl.textContent = `${wpm} WPM`;
    if (currentMode === 'zen') {
      accEl.textContent = `${zenWordCount} mots`;
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
    // Theme-aware color channels
    var bgR  = isDark ? 26  : 27,  bgG  = isDark ? 0   : 26,  bgB  = isDark ? 51  : 39;
    var brR  = isDark ? 63  : 191, brG  = isDark ? 81  : 153, brB  = isDark ? 181 : 160;
    // Dark: #9c27b0 (156,39,176) → #ff4ecb (255,78,203)
    // Light: #F2A285 (242,162,133) → #F28080 (242,128,128)
    var pR   = isDark ? 156 : 242, pG   = isDark ? 39  : 162, pB   = isDark ? 176 : 133;
    var phR  = isDark ? 255 : 242, phG  = isDark ? 78  : 128, phB  = isDark ? 203 : 128;

    // If not focused (and not finished with focus), use dim but visible background
    if (!isFocused) {
      var unfocusedAlpha = isDark ? 0.35 : 0.15;
      textEl.style.background = 'rgba(' + bgR + ', ' + bgG + ', ' + bgB + ', ' + unfocusedAlpha + ')';
      textEl.style.borderColor = 'rgba(' + brR + ', ' + brG + ', ' + brB + ', 0.06)';
      textEl.style.boxShadow = '0 0 0 0 rgba(' + pR + ', ' + pG + ', ' + pB + ', 0)';
      return;
    }
    // Linear 0–200 mapping, fully opaque at 200
    var t = Math.min(wpm / 200, 1);
    // Background opacity: starts visible, fully opaque at 200
    // Dark theme: higher base for readability
    var bgAlpha = isDark ? (0.6 + t * 0.4) : (0.4 + t * 0.6);
    // Border: visible base, strong at high WPM
    var borderAlpha = 0.25 + t * 0.75;
    // Glow: strong base, intense scaling with WPM
    var glowAlpha = 0.25 + t * 0.75;
    var glowSize = Math.round(20 + t * 60);
    // Secondary outer glow for more spread
    var outerAlpha = 0.08 + t * 0.35;
    var outerSize = Math.round(30 + t * 90);

    // Color transition: primary → accent/hover from 60–130 WPM
    var r = pR, g = pG, b = pB;
    if (wpm >= 60) {
      var ct = Math.min((wpm - 60) / 70, 1);
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
    wpmEl.textContent = `Words Per Minute : ${wpm}`;
    if (currentMode === 'zen') {
      accEl.textContent = `Mots : ${zenWordCount}`;
    } else {
      accEl.textContent = `Accuracy : ${acc}%`;
    }
    timeEl.textContent = `Time : ${seconds}s`;
    timeEl.classList.add('typing-game__time--visible');

    // Best score
    var isNewRecord = saveBestWPM(currentMode, wpm);
    var best = getBestWPM(currentMode);
    bestEl.textContent = `Best : ${best} WPM`;
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
    if (forceNewText) currentTextIndex = -1;
    text = pickText();
    typed = [];
    startTime = null;
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
    accEl.textContent = '100%';
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
    // Show scroll hint again on reset
    var hint = document.getElementById('scroll-hint');
    if (hint) hint.classList.remove('scroll-hint--hidden');
    if (wpmInterval) clearInterval(wpmInterval);
    wpmInterval = null;
    // Toggle zen-specific classes
    if (currentMode === 'zen') {
      container.classList.add('typing-game--zen');
      setRestartText('Shift + Espace pour arrêter', ZEN_STOP_ICON);
    } else {
      container.classList.remove('typing-game--zen');
      setRestartText('Entrée ou Espace pour recommencer');
    }
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
        wpmEl.textContent = 'Échec';
        wpmEl.classList.add('typing-game__wpm--visible');
        accEl.textContent = '';
        accEl.classList.remove('typing-game__acc--visible');
        // Reset scroll so all lines (including the first) are visible
        if (innerEl) {
          innerEl.style.transform = '';
          var spans = innerEl.children;
          for (var si = 0; si < spans.length; si++) {
            spans[si].style.visibility = '';
          }
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
    setRestartText('Entrée ou Espace pour recommencer');
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

    // Block all input during hardcore memorize phase
    if (hardcorePhase === 'memorize') return;

    // Restart on Space or Enter when finished (replay same text)
    if (finished) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startGame(false);
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
        wpmEl.classList.add('typing-game__wpm--visible');
        accEl.classList.add('typing-game__acc--visible');
        wpmInterval = setInterval(updateStats, 200);
        var hint = document.getElementById('scroll-hint');
        if (hint) hint.classList.add('scroll-hint--hidden');
        // Show the Shift+Space hint while typing in zen mode
        showRestart();
      }

      typed.push(e.key);
      comboStreak++;
      trailTimestamps.push(Date.now());
      if (trailTimestamps.length > 20) trailTimestamps.shift();
      updateTrailSpeed();

      // Count words on space
      if (e.key === ' ') {
        zenWordCount++;
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
      wpmEl.classList.add('typing-game__wpm--visible');
      accEl.classList.add('typing-game__acc--visible');
      wpmInterval = setInterval(updateStats, 200);
      // Hide scroll hint while typing
      var hint = document.getElementById('scroll-hint');
      if (hint) hint.classList.add('scroll-hint--hidden');
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
    showInfoPopup('Mode Zen',
      'Tapez librement, sans limite de texte ni validation.<br>Tous les mots comptent pour le WPM.',
      '<kbd>Shift</kbd> + <kbd>Espace</kbd> pour terminer.',);
  }

  /* ---- Hardcore popup (first time) ---- */

  function showHardcorePopup(onClose) {
    setCookie('typing_hardcore_seen', '1', 365);
    showInfoPopup('Mode Hardcore',
      'Le texte s\'affiche pendant 3 secondes puis disparaît.<br>Écrivez tout de mémoire...',
      'Une erreur et c\'est fini !',
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
      '<button class="zen-popup__btn">Compris</button>';
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    // Force reflow then animate in
    overlay.offsetHeight;
    overlay.classList.add('zen-popup-overlay--visible');

    function close() {
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
  }

  /* ---- AI text generation (Gemini) ---- */

  function buildAiPrompt(theme) {
    return 'Generate very informative typing practice texts on a specific theme. ' +
      'Output ONLY valid JSON (no markdown, no code fences, no explanation). ' +
      'The JSON must have this exact structure: ' +
      '{"fr":{"10":[...],"25":[...],"50":[...],"100":[...]},"en":{"10":[...],"25":[...],"50":[...],"100":[...]}}. ' +
      'Rules: ' +
      '- "10" array: 10 sentences each ~10 words in lowercase, ' +
      '- "25" array: 8 paragraphs each ~25 words in lowercase, ' +
      '- "50" array: 5 paragraphs each ~50 words in lowercase, ' +
      '- "100" array: 3 paragraphs each ~100 words in lowercase, ' +
      '- "fr" texts must be in French, "en" texts must be in English ' +
      '- All texts must be about this theme: "' + theme + '" ' +
      '- No accents in French texts except for common ones (é, è, ê, à, ù, ô, î, â, ç) ' +
      '- No special characters, only letters and spaces ' +
      '- Each text must flow naturally and be interesting to type';
  }

  function fetchAiTexts(theme, onSuccess, onError) {
    var body = JSON.stringify({
      contents: [{ parts: [{ text: buildAiPrompt(theme) }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 16384
      }
    });

    fetch(GEMINI_URL + GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      try {
        // Gemini response structure: candidates[0].content.parts[0].text
        var raw = data.candidates &&
                  data.candidates[0] &&
                  data.candidates[0].content &&
                  data.candidates[0].content.parts &&
                  data.candidates[0].content.parts[0] &&
                  data.candidates[0].content.parts[0].text;

        if (!raw) throw new Error('Empty response from Gemini');

        // Strip markdown code fences if model added them despite instructions
        raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

        // Detect truncation before parsing
        if (!raw.endsWith('}')) {
          console.warn('[AI] Response appears truncated (finishReason:', 
            data.candidates[0].finishReason, ')');
          throw new Error('Response truncated — increase maxOutputTokens or reduce requested texts');
        }

        var parsed = JSON.parse(raw);
        onSuccess(parsed);
      } catch (err) {
        onError && onError(err);
      }
    })
    .catch(function(err) {
      onError && onError(err);
    });
  }

  /* ---- AI popup ---- */

  function showAiPopup(onConfirm) {
    var overlay = document.createElement('div');
    overlay.className = 'zen-popup-overlay';
    var popup = document.createElement('div');
    popup.className = 'zen-popup typing-game__ai-popup';
    popup.innerHTML =
      '<div class="zen-popup__title">\uD83E\uDD16 Mode IA</div>' +
      '<p class="zen-popup__text">Que souhaitez-vous taper aujourd\'hui ?</p>' +
      '<input class="typing-game__ai-input" type="text" placeholder="Ex: l\'espace, la cuisine, les chats..." maxlength="100" autofocus />' +
      '<div class="typing-game__ai-status"></div>' +
      '<button class="zen-popup__btn typing-game__ai-confirm">Générer les textes</button>';
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    var input = popup.querySelector('.typing-game__ai-input');
    var confirmBtn = popup.querySelector('.typing-game__ai-confirm');
    var statusEl = popup.querySelector('.typing-game__ai-status');

    // Pre-fill with current theme if any
    if (aiTheme) input.value = aiTheme;

    // Force reflow then animate in
    overlay.offsetHeight;
    overlay.classList.add('zen-popup-overlay--visible');

    // Focus input after animation
    setTimeout(function() { input.focus(); }, 350);

    function close() {
      overlay.classList.remove('zen-popup-overlay--visible');
      overlay.addEventListener('transitionend', function handler() {
        overlay.removeEventListener('transitionend', handler);
        overlay.remove();
        container.focus();
      });
    }

    function doGenerate() {
      var theme = input.value.trim();
      if (!theme) {
        input.classList.add('typing-game__ai-input--error');
        setTimeout(function() { input.classList.remove('typing-game__ai-input--error'); }, 600);
        return;
      }
      // Show loading state
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Génération en cours...';
      statusEl.textContent = '';
      statusEl.className = 'typing-game__ai-status';
      aiLoading = true;

      fetchAiTexts(theme, function(texts) {
        aiLoading = false;
        aiTheme = theme;
        aiTexts = texts;
        close();
        if (typeof onConfirm === 'function') onConfirm();
      }, function(err) {
        aiLoading = false;
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Réessayer';
        statusEl.textContent = 'Erreur de génération. Réessayez plus tard.';
        statusEl.className = 'typing-game__ai-status typing-game__ai-status--error';
      });
    }

    confirmBtn.addEventListener('click', doGenerate);
    input.addEventListener('keydown', function(e) {
      // Block game key handlers while popup is open
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        doGenerate();
      }
    });
    overlay.addEventListener('click', function(ev) {
      if (ev.target === overlay && !aiLoading) close();
    });
  }

  /* ---- Navbar builder ---- */

  function buildNavbar() {
    navbarEl = document.createElement('div');
    navbarEl.className = 'typing-game__navbar';

    // Language selector
    const langGroup = buildOptionGroup(
      [{ key: 'fr', label: 'FR' }, { key: 'en', label: 'EN' }],
      currentLang,
      function (key) {
        currentLang = key;
        startGame(false);
      }
    );

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
    eyeBtn.setAttribute('title', 'Afficher/masquer les erreurs');
    eyeBtn.innerHTML = '<svg class="typing-game__eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="typing-game__eye-top" d="M1 12s4-8 11-8 11 8 11 8"/><path class="typing-game__eye-bottom" d="M1 12s4 8 11 8 11-8 11-8"/><circle class="typing-game__eye-pupil" cx="12" cy="12" r="3"/><line class="typing-game__eye-slash" x1="2" y1="2" x2="22" y2="22"/></svg>';
    // Appliquer l'état initial de showErrors
    eyeBtn.classList.toggle('typing-game__eye--active', showErrors);
    container.classList.toggle('typing-game--show-errors', showErrors);
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
    hcBtn.setAttribute('title', 'Mode Hardcore');
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
    aiBtn.setAttribute('title', 'Mode IA');
    // Sparkle/brain icon with two states
    aiBtn.innerHTML = '<svg class="typing-game__ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<g class="typing-game__ai-off">' +
        '<path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.4V11h-4V9.4C8.8 8.8 8 7.5 8 6a4 4 0 0 1 4-4z"/>' +
        '<path d="M10 11v2a2 2 0 1 0 4 0v-2"/>' +
        '<line x1="12" y1="15" x2="12" y2="19"/>' +
        '<line x1="8" y1="19" x2="16" y2="19"/>' +
        '<line x1="7" y1="6" x2="5" y2="4"/>' +
        '<line x1="17" y1="6" x2="19" y2="4"/>' +
        '<line x1="12" y1="2" x2="12" y2="0"/>' +
      '</g>' +
      '<g class="typing-game__ai-on">' +
        '<path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.4V11h-4V9.4C8.8 8.8 8 7.5 8 6a4 4 0 0 1 4-4z"/>' +
        '<path d="M10 11v2a2 2 0 1 0 4 0v-2"/>' +
        '<line x1="12" y1="15" x2="12" y2="19"/>' +
        '<line x1="8" y1="19" x2="16" y2="19"/>' +
        '<circle cx="6" cy="3" r="1" fill="currentColor" stroke="none" class="typing-game__ai-spark typing-game__ai-spark--1"/>' +
        '<circle cx="19" cy="5" r="0.8" fill="currentColor" stroke="none" class="typing-game__ai-spark typing-game__ai-spark--2"/>' +
        '<circle cx="12" cy="0" r="0.8" fill="currentColor" stroke="none" class="typing-game__ai-spark typing-game__ai-spark--3"/>' +
      '</g>' +
    '</svg>';

    // "Change theme" button — only visible when AI mode is active
    aiThemeBtn = document.createElement('button');
    aiThemeBtn.className = 'typing-game__ai-theme';
    aiThemeBtn.setAttribute('tabindex', '-1');
    aiThemeBtn.setAttribute('title', 'Changer le thème IA');
    aiThemeBtn.innerHTML = '<svg class="typing-game__ai-theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' +
    '</svg>';

    function updateAiUI() {
      aiBtn.classList.toggle('typing-game__ai--active', aiMode);
      container.classList.toggle('typing-game--ai', aiMode);
      aiThemeBtn.classList.toggle('typing-game__ai-theme--visible', aiMode);
    }

    aiBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (aiMode) {
        // Deactivate AI mode — revert to default texts
        aiMode = false;
        aiTexts = null;
        aiTheme = '';
        updateAiUI();
        startGame(true);
      } else {
        // Activate — show popup
        showAiPopup(function() {
          aiMode = true;
          updateAiUI();
          startGame(true);
        });
      }
    });

    aiThemeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      // Reopen popup to change theme while keeping AI mode on
      showAiPopup(function() {
        startGame(true);
      });
    });

    updateAiUI();
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

  /* ---- Intro typewriter mode ---- */

  function showIntro(isSmartphone) {
    introActive = true;
    heroTitleEl = document.querySelector('#hero .section__title');
    if (heroTitleEl) heroTitleEl.textContent = 'Colombat Paolo';

    // Intro text container (reuses typing-game__text styling)
    introTextEl = document.createElement('div');
    introTextEl.className = 'typing-game__text typing-game__text--intro';

    // Inner for typewriter chars
    var introInner = document.createElement('div');
    introInner.className = 'typing-game__text-inner typing-game__intro-inner';
    introTextEl.appendChild(introInner);

    container.appendChild(introTextEl);

    // Button (hidden initially) — desktop only
    if (!isSmartphone) {
      introButtonEl = document.createElement('button');
      introButtonEl.className = 'btn btn--outline typing-game__intro-btn';
      introButtonEl.textContent = 'Jouer au Typing Game';
      container.appendChild(introButtonEl);
    }

    // Start typewriter animation with cursor + trail (zen-style rendering)
    var chars = INTRO_TEXT.split('');
    var idx = 0;
    var speed = 38; // ms per character (slower for readability)
    var introCombo = 0;
    var introTrailTimestamps = [];
    var introTrailSpeed = 0;
    var introFinished = false;
    // Fixed trail color (primary only, no shift) — theme-aware
    function getIntroTrailColor() {
      var dk = document.documentElement.dataset.theme === 'dark';
      return { r: dk ? 156 : 242, g: dk ? 39 : 162, b: dk ? 176 : 133 };
    }

    function calcIntroTrailSpeed() {
      if (introTrailTimestamps.length < 2) { introTrailSpeed = 0; return; }
      var recent = introTrailTimestamps.slice(-8);
      var totalInterval = recent[recent.length - 1] - recent[0];
      var avgInterval = totalInterval / (recent.length - 1);
      introTrailSpeed = Math.max(0, Math.min(1, 1 - (avgInterval - 30) / 450));
    }

    function renderIntro() {
      var html = '';
      var tc = getIntroTrailColor();

      // Trail length from combo + speed
      var trailLen = 0;
      if (introCombo >= 10 && introTrailSpeed > 0.05) {
        var comboFactor = Math.min(introCombo / 150, 1);
        trailLen = Math.round(2 + comboFactor * 28);
        trailLen = Math.round(trailLen * (0.15 + introTrailSpeed * 0.85));
      }

      for (var i = 0; i < idx; i++) {
        var cls = 'typing-game__char typing-game__char--correct';
        var trailAttr = '';

        // Trail behind cursor
        if (!introFinished && trailLen > 0) {
          var distFromCursor = idx - i;
          if (distFromCursor <= trailLen && distFromCursor >= 1) {
            cls += ' typing-game__char--trail';
            var trailOpacity = (1 - (distFromCursor - 1) / trailLen) * introTrailSpeed;
            trailOpacity = Math.max(0.05, Math.min(1, trailOpacity));
            trailAttr = ' style="--trail-opacity:' + trailOpacity.toFixed(3)
              + ';--trail-r:' + tc.r
              + ';--trail-g:' + tc.g
              + ';--trail-b:' + tc.b + '"';
          }
        }

        var ch = chars[i] === ' ' ? ' ' : chars[i];
        html += '<span class="' + cls + '"' + trailAttr + '>' + ch + '</span>';
      }

      // Cursor after typed chars
      if (!introFinished) {
        var cursorCls = 'typing-game__char typing-game__char--cursor';
        if (introCombo >= 60) cursorCls += ' typing-game__char--combo-3';
        else if (introCombo >= 30) cursorCls += ' typing-game__char--combo-2';
        else if (introCombo >= 10) cursorCls += ' typing-game__char--combo-1';
        html += '<span class="' + cursorCls + '">\u200B</span>';
      }

      introInner.innerHTML = html;
    }

    function typeNext() {
      if (idx >= chars.length) {
        introFinished = true;
        renderIntro();
        if (isSmartphone) {
          // On smartphone: auto-unlock, keep intro text visible
          unlockGame();
          introActive = false;
          return;
        }
        // Typewriter finished — show button
        requestAnimationFrame(function () {
          introButtonEl.classList.add('typing-game__intro-btn--visible');
        });
        return;
      }
      introCombo++;
      introTrailTimestamps.push(Date.now());
      if (introTrailTimestamps.length > 20) introTrailTimestamps.shift();
      calcIntroTrailSpeed();
      idx++;
      renderIntro();
      setTimeout(typeNext, speed);
    }

    // Small delay before starting the typewriter
    setTimeout(typeNext, 400);

    // Button click → show popup, then reveal game (desktop only)
    if (introButtonEl) {
      introButtonEl.addEventListener('click', function () {
        showIntroPopup();
      });
    }
  }

  function showIntroPopup() {
    showInfoPopup(
      'Typing Game',
      'Testez votre vitesse de frappe !<br>La barre de navigation au-dessus du texte vous permet de choisir la langue, le mode et les options du jeu.',
      'Amusez-vous bien !',
      function () {
        unlockGame();
        transitionToGame();
      }
    );
  }

  function transitionToGame() {
    introActive = false;

    // Update title
    if (heroTitleEl) heroTitleEl.textContent = 'Colombat Paolo - Typing Game';

    // Fade out intro elements
    introTextEl.classList.add('typing-game__text--intro-out');
    introButtonEl.classList.add('typing-game__intro-btn--out');

    setTimeout(function () {
      // Remove intro elements
      if (introTextEl && introTextEl.parentNode) introTextEl.remove();
      if (introButtonEl && introButtonEl.parentNode) introButtonEl.remove();

      // Build and reveal the real game
      buildGameDOM();
      // Start with hidden state, then animate in
      container.classList.add('typing-game--reveal');
      void container.offsetHeight; // force reflow
      container.classList.add('typing-game--reveal-active');

      startGame(true);

      // Clean up reveal classes after animation
      setTimeout(function () {
        container.classList.remove('typing-game--reveal', 'typing-game--reveal-active');
      }, 700);
    }, 400);
  }

  function buildSmartphoneStaticDOM() {
    // Show intro text statically (no game, no greyed navbar)
    var staticText = document.createElement('div');
    staticText.className = 'typing-game__text typing-game__text--intro';
    staticText.textContent = INTRO_TEXT;
    container.appendChild(staticText);
  }

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
    setRestartText('Entrée ou Espace pour recommencer');

    // Focus hint (visible when blurred)
    focusHintEl = document.createElement('div');
    focusHintEl.className = 'typing-game__focus-hint';
    focusHintEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg> Cliquez ici pour commencer à taper';

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
      isFocused = true;
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
      if (startTime) {
        var hint = document.getElementById('scroll-hint');
        if (hint) hint.classList.add('scroll-hint--hidden');
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
        if (!isFocused && hardcorePhase !== 'memorize') {
          container.classList.add('typing-game--blurred');
          focusHintEl.classList.add('typing-game__focus-hint--visible');
          var hint = document.getElementById('scroll-hint');
          if (hint && window.scrollY <= 80) hint.classList.remove('scroll-hint--hidden');
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
    // If hardcore is on but mode is incompatible, force to 10
    if (hardcoreMode && ['25', '50', '100', 'zen'].indexOf(currentMode) !== -1) {
      currentMode = '10';
    }

    // --- If game has never been unlocked: show intro typewriter ---
    if (!isGameUnlocked()) {
      showIntro(isSmartphone);
      return;
    }

    // --- Mobile smartphone mode (already unlocked): show static intro text ---
    if (isSmartphone) {
      heroTitleEl = document.querySelector('#hero .section__title');
      if (heroTitleEl) heroTitleEl.textContent = 'Colombat Paolo';
      buildSmartphoneStaticDOM();
      return;
    }

    // --- Desktop: full game ---
    buildGameDOM();
    startGame(true);
  }

  // Boot when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

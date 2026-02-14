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
      mode: mode && ['presentation', '10', '25', '50', '100'].indexOf(mode) !== -1 ? mode : null,
      showErrors: showErrorsCookie === '1'
    };
  }

  function hasPlayed() {
    return getCookie('typing_played') === '1';
  }

  function markAsPlayed() {
    if (!hasPlayed()) {
      setCookie('typing_played', '1', 365);
      if (textEl) {
        textEl.classList.remove('typing-game__text--first-visit');
        textEl.classList.add('typing-game__text--fading');
      }
    }
  }

  /* ---- Text data by language and mode ---- */

  const TEXTS = {
    fr: {
      presentation: [
        'salut moi c est paolo developpeur full stack en deuxieme annee de but informatique passionné par le code et toujours pret a relever de nouveaux defis',
      ],
      '10': [
        'le midlaner a flash sous la tourelle ennemie facilement',
        'le jungler commence toujours par le buff rouge ce matin',
        'on doit prendre le dragon avant le prochain combat equipe',
        'le support a posé sa vision dans la rivière complètement',
        'il faut push la botlane avant de faire le baron nashor',
        'le toplaner split push pendant que son equipe defend milieu',
        'premier sang pour le midlaner grâce au gank du jungler',
        'flash et ignite sont en cooldown il faut reculer maintenant',
      ],
      '25': [
        'le jungler a pris le dragon infernal en solo pendant que le midlaner roam en botlane pour aider le support a poser la vision dans la riviere et preparer le prochain objectif',
        'le toplaner a teleporte en botlane pour un gank surprise qui a donne un double kill a notre adc maintenant on peut push la tour et prendre le herald pour accelerer la partie',
        'notre composition est faite pour les teamfight en fin de partie il faut eviter les escarmouches en debut de game et farmer tranquillement jusqu a avoir nos objets cles pour combattre',
      ],
      '50': [
        'la partie commence et le jungler decide de faire un full clear en commencant par le buff rouge il enchaine les camps rapidement et arrive au scuttle en meme temps que le jungler ennemi un duel eclate dans la riviere et grace a l aide du midlaner on remporte le premier sang le moral de l equipe est au plus haut et on decide de mettre la pression sur toutes les lanes en meme temps pour snowball notre avantage le plus vite possible',
      ],
      '100': [
        'le match commence par une invade sur le buff bleu ennemi toute l equipe se regroupe dans le bush et attend le jungler adverse des qu il apparait le support engage avec son ultime et le combat eclate on recupere le buff et le premier sang sans aucune perte le jungler ennemi est en retard sur ses camps et notre jungler en profite pour faire un gank en toplaner qui reussit parfaitement le toplaner ennemi est force de rappeler et on prend la premiere tour de la partie la botlane joue de maniere aggressive et notre adc farm parfaitement atteignant deux cents cs en vingt minutes le support roam en midlane pour aider a poser de la vision autour du dragon notre midlaner controle bien la lane et empeche le midlaner adverse de roam le dragon infernal spawn et on le prend sans contestation grace au controle de vision que le support a mis en place le jungler ennemi tente un vol mais il se fait repousser par toute l equipe',
      ],
    },
    en: {
      presentation: [
        'hi i am paolo a full stack developer in my second year of a computer science degree passionate about code and always ready to take on new challenges',
      ],
      '10': [
        'the midlaner flashed under the enemy turret very boldly today',
        'our jungler started red buff and ganked top lane early',
        'we need to secure dragon before the next big team fight',
        'the support placed deep vision wards inside the enemy jungle',
        'push the bot lane before starting the baron nashor fight',
        'the toplaner is split pushing while the team defends mid',
        'first blood goes to mid thanks to a jungle gank',
        'flash and ignite are on cooldown we should play safe',
      ],
      '25': [
        'the jungler took the infernal dragon solo while the midlaner roamed to bot lane to help the support place deep wards in the river and set up vision control for the next major objective on the map',
        'the toplaner teleported to bot lane for a surprise gank that gave our adc a double kill now we can push the tower and take the rift herald to accelerate the pace of the entire game',
        'our team composition is designed for late game teamfights we need to avoid early skirmishes and farm safely until we reach our core item power spikes then group and force fights around objectives',
      ],
      '50': [
        'the game starts and the jungler decides to do a full clear starting from red buff he clears the camps quickly and arrives at the scuttle crab at the same time as the enemy jungler a duel breaks out in the river and thanks to the midlaner roaming we secure first blood the team morale is high and we decide to put pressure on every lane at the same time to snowball our advantage as quickly as possible before the enemy team can recover',
      ],
      '100': [
        'the match starts with an invade on the enemy blue buff the entire team groups in the bush and waits for the enemy jungler as soon as he appears the support engages with his ultimate and the fight breaks out we secure the buff and first blood without any losses the enemy jungler falls behind on his camps and our jungler takes advantage by ganking top lane which succeeds perfectly the enemy toplaner is forced to recall and we take the first tower of the game the bot lane plays aggressively and our adc farms perfectly reaching two hundred cs in twenty minutes the support roams to midlane to help place vision around the dragon pit our midlaner controls the lane well and prevents the enemy midlaner from roaming the infernal dragon spawns and we take it without contest thanks to the vision control the support set up the enemy jungler attempts a steal but gets pushed back by the entire team we rotate to the mid lane and siege the tower slowly poking the enemies under turret until they are too low to defend',
      ],
    },
  };

  /* ---- State ---- */

  let currentLang = 'fr';
  let currentMode = 'presentation';
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

  /* ---- DOM refs (set in init) ---- */

  let container, navbarEl, textEl, innerEl, wpmEl, accEl, timeEl, bestEl, restartEl, statsRow;

  /* ---- Helpers ---- */

  function pickText() {
    const pool = TEXTS[currentLang][currentMode];
    return pool[Math.floor(Math.random() * pool.length)];
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
    return Math.round(correctWords / minutes) + wpmBoost;
  }

  function calcAccuracy() {
    if (totalKeystrokes === 0) return 100;
    let correctChars = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === text[i]) correctChars++;
    }
    return Math.round((correctChars / totalKeystrokes) * 100);
  }

  /* ---- Rendering ---- */

  function render() {
    let html = '';
    let comboStyle = '';

    for (let i = 0; i < text.length; i++) {
      let cls = 'typing-game__char';

      if (i < typed.length) {
        const isLocked = i < lockedIndex;
        cls += typed[i] === text[i]
          ? ' typing-game__char--correct'
          : ' typing-game__char--incorrect';
        if (isLocked) cls += ' typing-game__char--locked';
      }

      // Cursor sits on the next character to type
      if (i === typed.length && !finished) {
        cls += ' typing-game__char--cursor';
        // Combo streak tier classes
        if (comboStreak >= 60) cls += ' typing-game__char--combo-3';
        else if (comboStreak >= 30) cls += ' typing-game__char--combo-2';
        else if (comboStreak >= 10) cls += ' typing-game__char--combo-1';
        // Combo color shift: #F2A285 → #F28080 from 50–100 streak
        if (comboStreak >= 50) {
          var cc = Math.min((comboStreak - 50) / 50, 1);
          var cg = Math.round(162 - cc * (162 - 128));
          var cb = Math.round(133 - cc * (133 - 128));
          comboStyle = ' style="--combo-clr:rgb(242,' + cg + ',' + cb + ')"';
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

      // Use comboStyle only on cursor span
      var extraAttr = (i === typed.length && !finished) ? comboStyle : '';

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
    accEl.textContent = `${acc}%`;
    updateTextBackground(wpm);
  }

  function updateTextBackground(wpm) {
    if (!textEl) return;
    // If not focused (and not finished with focus), use dim background
    if (!isFocused) {
      textEl.style.background = 'rgba(27, 26, 39, 0.06)';
      textEl.style.borderColor = 'rgba(191, 153, 160, 0.04)';
      textEl.style.boxShadow = '0 0 0 0 transparent';
      return;
    }
    // Linear 0–200 mapping, fully opaque at 200
    var t = Math.min(wpm / 200, 1);
    // Background opacity: starts translucent, fully opaque at 200
    var bgAlpha = 0.2 + t * 0.8;
    // Border: visible base, strong at high WPM
    var borderAlpha = 0.25 + t * 0.75;
    // Glow: noticeable early, intense at top
    var glowAlpha = 0.12 + t * 0.88;
    var glowSize = Math.round(14 + t * 50);

    // Color transition: primary (#F2A285) → primary-hover (#F28080) from 60–130 WPM
    var r = 242, g = 162, b = 133; // base #F2A285
    if (wpm >= 60) {
      var ct = Math.min((wpm - 60) / 70, 1); // 0 at 60, 1 at 130
      g = Math.round(162 - ct * (162 - 128)); // 162 → 128
      b = Math.round(133 - ct * (133 - 128)); // 133 → 128
    }

    textEl.style.background = 'rgba(27, 26, 39, ' + bgAlpha.toFixed(3) + ')';
    textEl.style.borderColor = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + borderAlpha.toFixed(3) + ')';
    textEl.style.boxShadow = '0 0 ' + glowSize + 'px rgba(' + r + ', ' + g + ', ' + b + ', ' + glowAlpha.toFixed(3) + ')';
  }

  function showFinalStats() {
    const wpm = calcWPM();
    const acc = calcAccuracy();
    const seconds = Math.round((Date.now() - startTime - totalPaused) / 1000);
    wpmEl.textContent = `Words Per Minute : ${wpm}`;
    accEl.textContent = `Accuracy : ${acc}%`;
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

  function startGame() {
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
    if (innerEl) {
      innerEl.remove();
    }
    innerEl = null;
    wpmEl.classList.remove('typing-game__wpm--visible');
    accEl.classList.remove('typing-game__acc--visible');
    wpmEl.textContent = '0 WPM';
    accEl.textContent = '100%';
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
    // Reset stats to centered position
    wpmEl.style.transform = '';
    accEl.style.transform = '';
    // Show scroll hint again on reset
    var hint = document.getElementById('scroll-hint');
    if (hint) hint.classList.remove('scroll-hint--hidden');
    if (wpmInterval) clearInterval(wpmInterval);
    wpmInterval = null;
    container.classList.remove('typing-game--finished');
    render();
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
    showFinalStats();
    restartEl.classList.add('typing-game__restart--visible');
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

    // Restart on Space or Enter when finished
    if (finished) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startGame();
      }
      return;
    }

    // Enter restarts even during gameplay
    if (e.key === 'Enter') {
      e.preventDefault();
      startGame();
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (typed.length > lockedIndex) {
        totalKeystrokes--;
        typed.pop();
        comboStreak = 0;
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
      // Mark as played (remove first-visit white text)
      markAsPlayed();
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
    } else {
      comboStreak = 0;
    }

    // Try to lock the current word as soon as its last character is typed
    tryLockWord();

    render();

    // Check completion
    if (typed.length === text.length) {
      finishGame();
    }
  }

  /* ---- Navbar builder ---- */

  function buildNavbar() {
    navbarEl = document.createElement('div');
    navbarEl.className = 'typing-game__navbar';

    // Language selector
    const langGroup = buildOptionGroup(
      [{ key: 'fr', label: 'Français' }, { key: 'en', label: 'English' }],
      currentLang,
      function (key) { currentLang = key; startGame(); }
    );

    // Separator
    const sep = document.createElement('span');
    sep.className = 'typing-game__navbar-sep';
    sep.textContent = '|';

    // Mode selector
    const modeGroup = buildOptionGroup(
      [
        { key: 'presentation', label: 'présentation' },
        { key: '10', label: '10' },
        { key: '25', label: '25' },
        { key: '50', label: '50' },
        { key: '100', label: '100' },
      ],
      currentMode,
      function (key) { currentMode = key; startGame(); }
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
        group.querySelectorAll('.typing-game__option').forEach(function (b) {
          b.classList.remove('typing-game__option--active');
        });
        btn.classList.add('typing-game__option--active');
        onChange(opt.key);
        saveSettings(currentLang, currentMode, showErrors);
        // Clicking a mode marks as played
        markAsPlayed();
      });
      group.appendChild(btn);
    });

    return group;
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

    // --- Mobile smartphone mode: show presentation text only ---
    if (isSmartphone) {
      // Change the title
      var heroTitle = document.querySelector('#hero .section__title');
      if (heroTitle) heroTitle.textContent = 'Colombat Paolo';

      // Build greyed-out navbar
      var navbar = buildNavbar();
      navbar.classList.add('typing-game__navbar--disabled');

      // Unavailable notice
      var notice = document.createElement('div');
      notice.className = 'typing-game__mobile-notice';
      notice.textContent = 'Typing test indisponible sur t\u00e9l\u00e9phone';

      // Show full presentation text (not as a game)
      textEl = document.createElement('div');
      textEl.className = 'typing-game__text typing-game__text--mobile-display';
      var presText = TEXTS[currentLang].presentation[0];
      textEl.textContent = presText;

      container.appendChild(navbar);
      container.appendChild(notice);
      container.appendChild(textEl);
      return;
    }

    // Build inner DOM
    var navbar = buildNavbar();

    textEl = document.createElement('div');
    textEl.className = 'typing-game__text';
    // First visit: white text if never played
    if (!hasPlayed() && currentMode === 'presentation') {
      textEl.classList.add('typing-game__text--first-visit');
    }

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
    restartEl.textContent = 'Entrée ou Espace pour recommencer';

    // Stats row wraps WPM + Accuracy side by side
    statsRow = document.createElement('div');
    statsRow.className = 'typing-game__stats';
    statsRow.appendChild(wpmEl);
    statsRow.appendChild(accEl);
    statsRow.appendChild(timeEl);
    statsRow.appendChild(bestEl);

    container.appendChild(navbar);
    container.appendChild(textEl);
    container.appendChild(statsRow);
    container.appendChild(restartEl);

    // Make it focusable & listen for keys
    container.setAttribute('tabindex', '0');
    container.addEventListener('keydown', handleKey);

    // Focus / blur detection
    container.addEventListener('focus', function () {
      isFocused = true;
      container.classList.remove('typing-game--blurred');
      container.classList.add('typing-game--focused');
      if (finished) {
        container.classList.add('typing-game--finished');
      }
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
      container.classList.add('typing-game--blurred');
      // Pause timing when the container loses focus during an active game
      if (startTime && !finished && !paused) {
        paused = true;
        pauseStart = Date.now();
        if (wpmInterval) {
          clearInterval(wpmInterval);
          wpmInterval = null;
        }
      }
      updateTextBackground(0);
    });

    startGame();
  }

  // Boot when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

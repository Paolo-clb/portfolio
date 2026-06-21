/* ==========================================================================
   Personal projects — Home carousel controller (IIFE)
   Turns the hero into a showcase of personal projects. Typing Game is the
   default slide; Light Again gets a preview slide (video placeholder + text +
   Play). Vertical edge tabs (echoing the sticky Light Again launcher) move
   between projects, and the big hero title swaps per project.

   To add a project later:
     1. push an entry into PROJECTS below ({ key, name, type })
     2. add a matching <div class="hero__slide" data-project="<key>"> in the
        hero carousel (index.html), or extend buildSlide() to render it.
   The nav tabs, title swap and arrows then work automatically.

   Depends on: js/main.js (window.__siteT), and at switch time on
   window.__typingRefreshHeroTitle (typing-game.js) + window.__openLightAgain
   (light-again/shell.js). All are looked up defensively.
   ========================================================================== */
(function () {
  'use strict';

  /* ---- Project registry (order = carousel order, left → right) ----
     The "intro" (presentation) slide sits in the middle and is the default:
     the left arrow goes to the Typing Game, the right arrow to Light Again. */
  var PROJECTS = [
    { key: 'typing',      name: 'Typing Game',  type: 'typing' },
    { key: 'intro',       name: 'Présentation', type: 'intro', nameKey: 'persoIntroName' },
    { key: 'light-again', name: 'Light Again',  type: 'light-again' },
  ];

  // Remembers the last-viewed project across visits (same convention as
  // portfolio_theme / portfolio_lang).
  var PERSO_KEY = 'portfolio_perso_project';

  /* ---- i18n + cookie helpers ---- */
  function t(key) {
    return (typeof window.__siteT === 'function' ? window.__siteT(key) : null) || key;
  }
  function getCookie(name) {
    var m = document.cookie.match('(?:^|;)\\s*' + name + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function isMobile() { return window.matchMedia('(max-width: 768px)').matches; }
  function animationsOff() {
    return document.documentElement.getAttribute('data-animations') === 'off';
  }

  /* ---- DOM refs (set in init) ---- */
  var hero, carousel, heroTitle;
  var slideEls = [];          // index-aligned with PROJECTS
  var navPrev = null, navNext = null;
  var current = 0;            // active project index
  var navReady = false;       // edge tabs revealed?
  var wasMobile = isMobile(); // track responsive boundary for preview rebuilds
  var laVideo = null;         // Light Again preview <video> (placeholder loop)

  /* ---- Hero title (project swap) ----
     The typing game writes the hero title on its own (new round, language
     change). While a non-typing slide is active we keep our title asserted via
     a MutationObserver, and on returning to typing we hand the title back. */
  var lockedHtml = null;
  var titleObserver = null;

  // Display name (lang-aware for slides that expose a nameKey, e.g. the intro)
  function projName(proj) {
    return proj.nameKey ? t(proj.nameKey) : proj.name;
  }
  function projectTitleHtml(name) {
    return 'Paolo Colombat : <em>' + name + '</em>';
  }
  // The hero title for a given slide. The intro keeps the bare name (identical
  // in FR/EN); the others get the "Paolo Colombat : <NAME>" form.
  function titleHtmlFor(proj) {
    if (proj.type === 'intro') return 'Paolo Colombat';
    return projectTitleHtml(projName(proj));
  }
  function ensureObserver() {
    if (titleObserver || !('MutationObserver' in window)) return;
    titleObserver = new MutationObserver(function () {
      if (lockedHtml != null && heroTitle && heroTitle.innerHTML !== lockedHtml) {
        heroTitle.innerHTML = lockedHtml;
      }
    });
  }
  function lockTitle(html) {
    lockedHtml = html;
    if (!heroTitle) return;
    heroTitle.innerHTML = html;
    ensureObserver();
    if (titleObserver) {
      titleObserver.observe(heroTitle, { childList: true, subtree: true, characterData: true });
    }
  }
  function unlockTitle() {
    lockedHtml = null;
    if (titleObserver) titleObserver.disconnect();
  }
  function refreshTypingTitle() {
    if (typeof window.__typingRefreshHeroTitle === 'function') {
      window.__typingRefreshHeroTitle();
    } else if (heroTitle) {
      // Fallback: the canonical typing title (identical FR/EN)
      heroTitle.innerHTML = projectTitleHtml('Typing Game');
    }
  }

  /* ================================================================
     Light Again — preview slide
     ================================================================ */

  // Secondary CTA — opens the "download the game" popup (the native desktop
  // build). Shown alongside Play on desktop and the desktop-note on mobile.
  function downloadCtaHtml() {
    return '<button type="button" class="la-preview__download">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' +
      '</svg>' + t('laPreviewDownload') + '</button>';
  }

  function ctaHtml(mobile) {
    var primary;
    if (mobile) {
      primary = '<span class="la-preview__desktop-note">' +
        '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' +
        '</svg>' + t('laPreviewDesktopOnly') + '</span>';
    } else {
      primary = '<button type="button" class="la-preview__play">' +
        '<svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4"/></svg>' +
        t('laPreviewPlay') + '</button>';
    }
    return primary + downloadCtaHtml();
  }

  function buildLightAgainPreview(host) {
    var mobile = isMobile();
    host.innerHTML =
      '<div class="la-preview__media">' +
        // Placeholder gameplay loop — muted/looping, controlled by syncPreviewVideo()
        // (plays only while this slide is active). Swap gameplay-preview.mp4 for the
        // real footage later; no code change needed.
        '<video class="la-preview__video" muted loop playsinline preload="none" aria-hidden="true">' +
          '<source src="assets/light-again/gameplay-preview.mp4" type="video/mp4">' +
        '</video>' +
      '</div>' +
      '<div class="la-preview__info">' +
        '<span class="la-preview__badge">' + t('laPreviewBadge') + '</span>' +
        '<span class="la-preview__tagline">' + t('lightAgainTagline') + '</span>' +
        '<p class="la-preview__lead">' + t('laPreviewLead') + '</p>' +
        '<p class="la-preview__body">' + t('laPreviewBody') + '</p>' +
        '<p class="la-preview__tech"><b>' + t('laPreviewTechLabel') + '</b> — ' + t('laPreviewTech') + '</p>' +
        '<div class="la-preview__cta-row">' + ctaHtml(mobile) + '</div>' +
      '</div>';

    if (!mobile) {
      var launch = function () {
        if (typeof window.__openLightAgain === 'function') window.__openLightAgain();
      };
      var btn = host.querySelector('.la-preview__play');
      if (btn) btn.addEventListener('click', launch);
      var media = host.querySelector('.la-preview__media');
      if (media) {
        media.style.cursor = 'pointer';
        media.setAttribute('role', 'button');
        media.setAttribute('aria-label', t('laPreviewPlay'));
        media.addEventListener('click', launch);
      }
    }

    // Download button — wired on every rebuild (the element is recreated each
    // time). Present on both mobile and desktop; the popup explains the build.
    var dlBtn = host.querySelector('.la-preview__download');
    if (dlBtn) dlBtn.addEventListener('click', openDownloadPopup);

    // Wire the placeholder video (the element is recreated on every rebuild).
    // It fades in once it actually plays, revealing the gradient placeholder
    // underneath whenever it's paused (animations off, slide hidden, modal open).
    laVideo = host.querySelector('.la-preview__video');
    var mediaEl = host.querySelector('.la-preview__media');
    if (laVideo && mediaEl) {
      laVideo.muted = true; // required for programmatic autoplay
      laVideo.addEventListener('playing', function () { mediaEl.classList.add('la-preview__media--playing'); });
      laVideo.addEventListener('pause', function () { mediaEl.classList.remove('la-preview__media--playing'); });
    }
    syncPreviewVideo();
  }

  // Play the placeholder loop only while the Light Again slide is actually on
  // screen (and animations are on, and the game modal isn't covering it).
  function syncPreviewVideo() {
    if (!laVideo) return;
    var laActive = PROJECTS[current] && PROJECTS[current].type === 'light-again';
    var canPlay = laActive && !animationsOff() && !document.body.classList.contains('la-modal-open');
    if (canPlay) {
      var p = laVideo.play();
      if (p && p.catch) p.catch(function () { /* autoplay may reject; ignore */ });
    } else if (!laVideo.paused) {
      laVideo.pause();
    }
  }

  /* ================================================================
     Light Again — "Download the game" popup
     Same look + behaviour as the portfolio's other pop-ups (weak-device /
     music): fade-in overlay, backdrop + Escape + × close, focus trap. The two
     choices are native <a download> links pointing straight at the committed
     build artifacts, so picking one starts the download and closes the popup.
     ================================================================ */

  // Build artifacts committed to the repo (desktop/ Tauri build output).
  var DL_EXE   = 'assets/downloads/Light-Again.exe';
  var DL_SETUP = 'assets/downloads/Light-Again-Setup.exe';

  // Small local createElement (the global one from main.js if present, else a
  // tiny fallback) — keeps this IIFE self-contained.
  function ce(tag, cls, txt) {
    if (typeof createElement === 'function') return createElement(tag, cls, txt);
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }

  function buildDownloadChoice(href, fileName, iconSvg, name, desc) {
    var a = document.createElement('a');
    a.className = 'la-dl-popup__choice';
    a.href = href;
    a.setAttribute('download', fileName);
    a.innerHTML =
      '<span class="la-dl-popup__choice-icon">' + iconSvg + '</span>' +
      '<span class="la-dl-popup__choice-text">' +
        '<span class="la-dl-popup__choice-name">' + name + '</span>' +
        '<span class="la-dl-popup__choice-desc">' + desc + '</span>' +
      '</span>' +
      '<span class="la-dl-popup__choice-arrow">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
      '</span>';
    return a;
  }

  function openDownloadPopup() {
    if (document.querySelector('.la-dl-popup-overlay')) return; // no stacking

    var overlay = ce('div', 'la-dl-popup-overlay');
    var popup = ce('div', 'la-dl-popup');
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', t('laDownloadTitle'));

    var closeBtn = ce('button', 'la-dl-popup__close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', t('laDownloadClose'));
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    var badge = ce('span', 'la-dl-popup__badge', t('laDownloadBadge'));

    var icon = ce('div', 'la-dl-popup__icon');
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

    var title = ce('h3', 'la-dl-popup__title', t('laDownloadTitle'));
    var intro = ce('p', 'la-dl-popup__intro', t('laDownloadIntro'));

    var tech = ce('p', 'la-dl-popup__tech');
    tech.innerHTML = '<b>' + t('laDownloadTechLabel') + '</b> — ' + t('laDownloadTech');

    var exeIcon   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>';
    var setupIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"/><polyline points="8 6 12 10 16 6"/><rect x="3" y="13" width="18" height="8" rx="2"/></svg>';

    var choices = ce('div', 'la-dl-popup__choices');
    var exeChoice   = buildDownloadChoice(DL_EXE,   'Light Again.exe',       exeIcon,   t('laDownloadExeName'),   t('laDownloadExeDesc'));
    var setupChoice = buildDownloadChoice(DL_SETUP, 'Light Again Setup.exe', setupIcon, t('laDownloadSetupName'), t('laDownloadSetupDesc'));
    choices.appendChild(exeChoice);
    choices.appendChild(setupChoice);

    var note = ce('p', 'la-dl-popup__note', t('laDownloadNote'));

    popup.appendChild(closeBtn);
    popup.appendChild(badge);
    popup.appendChild(icon);
    popup.appendChild(title);
    popup.appendChild(intro);
    popup.appendChild(tech);
    popup.appendChild(choices);
    popup.appendChild(note);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Force reflow then animate in (same pattern as the weak-device popup)
    overlay.offsetHeight;
    overlay.classList.add('la-dl-popup-overlay--visible');

    var trapCleanup = (typeof trapFocus === 'function') ? trapFocus(overlay) : null;
    closeBtn.focus();

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      if (trapCleanup) { trapCleanup(); trapCleanup = null; }
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('la-dl-popup-overlay--visible');
      overlay.addEventListener('transitionend', function () { overlay.remove(); }, { once: true });
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    // Picking either build starts the native download AND closes the popup.
    exeChoice.addEventListener('click', close);
    setupChoice.addEventListener('click', close);
  }

  // Builds the content for a given slide (only Light Again needs JS today)
  function buildSlide(proj, el) {
    if (proj.type === 'light-again') {
      var host = el.querySelector('.la-preview') || el;
      buildLightAgainPreview(host);
    }
  }

  /* ================================================================
     Edge nav tabs
     ================================================================ */

  function chevronSvg(dir) {
    var pts = dir === 'prev' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
    return '<svg class="hero__nav__chevron" viewBox="0 0 24 24" fill="none" ' +
      'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="' + pts + '"/></svg>';
  }

  function makeTab(dir) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'hero__nav hero__nav--' + dir;
    var label = '<span class="hero__nav__label"></span>';
    var chev = chevronSvg(dir);
    b.innerHTML = dir === 'prev' ? chev + label : label + chev;
    b.hidden = true;
    b.addEventListener('click', function () {
      if (dir === 'prev') go(current - 1, -1);
      else                go(current + 1, 1);
    });
    hero.appendChild(b);
    return b;
  }

  function setTab(el, proj) {
    el.hidden = false;
    var name = projName(proj);
    var lbl = el.querySelector('.hero__nav__label');
    if (lbl) lbl.textContent = name;
    el.setAttribute('aria-label', t('persoNavTo').replace('{name}', name));
    if (navReady) el.classList.add('hero__nav--ready');
  }

  // The carousel loops: every slide always has a previous and next neighbour
  // (wrapping at the ends), so an arrow is always shown on both sides.
  function updateNavTabs() {
    if (!navPrev || !navNext) return;
    var n = PROJECTS.length;
    setTab(navPrev, PROJECTS[(current - 1 + n) % n]);
    setTab(navNext, PROJECTS[(current + 1) % n]);
  }

  function positionNavTabs() {
    if (!hero || !navPrev || !navNext) return;
    // Anchor the tabs at a CONSTANT height measured from the hero's top (the
    // tabs are position:absolute inside .hero). This keeps them at the exact
    // same vertical spot whatever slide is shown — the carousel content height
    // and even the hero title's line count (it wraps on mobile) vary per slide,
    // so centring on live content made the arrows jump. A fixed offset doesn't.
    var topPx = isMobile() ? 360 : 430;
    navPrev.style.top = topPx + 'px';
    navNext.style.top = topPx + 'px';
  }

  function revealNav() {
    if (navReady) return;
    navReady = true;
    updateNavTabs();
    positionNavTabs();
  }

  // The sticky launcher (light-again/shell.js) duplicates the carousel's Light
  // Again tab while the hero is on screen. Hide it on the hero and reveal it for
  // 1-click play once the user scrolls into the lower sections. CSS keys off the
  // body class, so it works whenever the launcher gets injected.
  function syncLauncherForHero() {
    if (!hero) return;
    var h = hero.offsetHeight || window.innerHeight;
    document.body.classList.toggle('hero-in-view', window.scrollY < h * 0.55);
  }

  /* ================================================================
     Slide switching
     ================================================================ */

  // instant=true restores a slide on load (no enter animation, no re-save)
  function go(index, dir, instant) {
    // Wrap around so the carousel loops (typing ↔ light-again at the ends)
    var n = PROJECTS.length;
    index = ((index % n) + n) % n;
    if (index === current) return;
    var fromSlide = slideEls[current];
    var toSlide = slideEls[index];
    var proj = PROJECTS[index];

    // Title: each slide owns "Paolo Colombat : <NAME>" (intro keeps the bare
    // name). We assert it and keep it via the MutationObserver, so the typing
    // game writing its own (identical) title on rounds doesn't fight us.
    lockTitle(titleHtmlFor(proj));

    // Swap visible slide
    if (fromSlide) {
      fromSlide.classList.remove('hero__slide--active');
      fromSlide.setAttribute('aria-hidden', 'true');
    }
    if (toSlide) {
      toSlide.classList.add('hero__slide--active');
      toSlide.removeAttribute('aria-hidden');
      if (!instant && !animationsOff()) {
        toSlide.style.setProperty('--enter-x', (dir >= 0 ? 28 : -28) + 'px');
        toSlide.classList.remove('hero__slide--entering');
        void toSlide.offsetWidth; // restart animation
        toSlide.classList.add('hero__slide--entering');
        var clear = function () {
          toSlide.classList.remove('hero__slide--entering');
          toSlide.removeEventListener('animationend', clear);
        };
        toSlide.addEventListener('animationend', clear);
      }
    }

    current = index;
    if (!instant) {
      try { localStorage.setItem(PERSO_KEY, proj.key); } catch (e) { /* private mode */ }
    }
    updateNavTabs();
    positionNavTabs();
    syncPreviewVideo();

    // Hand keyboard focus to the typing game when its slide becomes active
    // (desktop only — the mobile slide is a frozen showcase). preventScroll
    // keeps the page from jumping while the user is still at the top.
    if (proj.type === 'typing' && !isMobile() && !instant) {
      var tg = document.getElementById('typing-game');
      if (tg && tg.focus) {
        setTimeout(function () {
          try { tg.focus({ preventScroll: true }); } catch (e) { tg.focus(); }
        }, 60);
      }
    }
  }

  // Restore the last-viewed project (persisted across visits). Runs after the
  // typing game has set its own title in init(); our lock then holds the right
  // title for a non-typing slide.
  function restoreSavedProject() {
    var savedKey;
    try { savedKey = localStorage.getItem(PERSO_KEY); } catch (e) { return; }
    if (!savedKey) return;
    for (var i = 0; i < PROJECTS.length; i++) {
      if (PROJECTS[i].key === savedKey) {
        if (i !== current) go(i, i >= current ? 1 : -1, true);
        return;
      }
    }
  }

  /* ================================================================
     Language / theme / resize wiring
     ================================================================ */

  function onLangChange() {
    // Rebuild Light Again preview text + refresh nav labels/titles
    var laIdx = -1;
    for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].type === 'light-again') laIdx = i;
    if (laIdx >= 0 && slideEls[laIdx]) buildSlide(PROJECTS[laIdx], slideEls[laIdx]);
    updateNavTabs();
    // Re-assert the active slide's title in the new language (the intro title is
    // the only lang-sensitive one today, but this stays correct regardless).
    if (lockedHtml != null) lockTitle(titleHtmlFor(PROJECTS[current]));
    positionNavTabs();
  }

  function onResize() {
    var nowMobile = isMobile();
    if (nowMobile !== wasMobile) {
      wasMobile = nowMobile;
      // Mobile boundary crossed → swap Play button / desktop note
      var laIdx = -1;
      for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].type === 'light-again') laIdx = i;
      if (laIdx >= 0 && slideEls[laIdx]) buildSlide(PROJECTS[laIdx], slideEls[laIdx]);
      if (nowMobile) revealNav(); // vitrine: always available on mobile
    }
    positionNavTabs();
    syncLauncherForHero();
  }

  /* ================================================================
     Init
     ================================================================ */

  function init() {
    hero = document.querySelector('section.hero');
    carousel = document.getElementById('hero-carousel');
    heroTitle = document.querySelector('#hero .section__title');
    if (!hero || !carousel) return;

    // Map slides to the registry (skip projects without a slide in the DOM)
    var available = [];
    PROJECTS.forEach(function (proj) {
      var el = carousel.querySelector('.hero__slide[data-project="' + proj.key + '"]');
      if (el) { available.push(proj); slideEls.push(el); }
    });
    if (available.length < 2) return; // nothing to navigate — leave hero as-is
    PROJECTS = available;

    // Determine the active slide from the markup (default: typing / first)
    current = 0;
    slideEls.forEach(function (el, i) {
      if (el.classList.contains('hero__slide--active')) current = i;
    });

    // Build non-typing slides + nav tabs
    PROJECTS.forEach(function (proj, i) { buildSlide(proj, slideEls[i]); });
    navPrev = makeTab('prev');
    navNext = makeTab('next');
    updateNavTabs();

    // Assert the active slide's hero title (and attach the observer) so a later
    // title write by the typing game can't leave a stale title on another slide.
    lockTitle(titleHtmlFor(PROJECTS[current]));

    // Position once layout settles, and keep in sync with content/size changes
    positionNavTabs();
    if (window.requestAnimationFrame) requestAnimationFrame(positionNavTabs);
    window.addEventListener('load', positionNavTabs);
    if ('ResizeObserver' in window) {
      new ResizeObserver(positionNavTabs).observe(carousel);
    }
    var resizeTick = false;
    window.addEventListener('resize', function () {
      if (resizeTick) return;
      resizeTick = true;
      requestAnimationFrame(function () { onResize(); resizeTick = false; });
    }, { passive: true });

    // Hide the sticky launcher on the hero, reveal it once scrolled past it
    syncLauncherForHero();
    var scrollTick = false;
    window.addEventListener('scroll', function () {
      if (scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(function () { syncLauncherForHero(); scrollTick = false; });
    }, { passive: true });

    // The hero is a 3-slide showcase now, so the arrows are always available —
    // reveal them immediately on every device.
    revealNav();

    // Re-open the last-viewed project (persistence across reloads)
    restoreSavedProject();

    // Hide edge tabs + pause the preview video while the fullscreen Light Again
    // modal is open; pause/resume the preview when animations are toggled.
    if ('MutationObserver' in window) {
      new MutationObserver(function () {
        var open = !!document.querySelector('.light-again-overlay');
        document.body.classList.toggle('la-modal-open', open);
        syncPreviewVideo();
      }).observe(document.body, { childList: true });
      new MutationObserver(syncPreviewVideo)
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-animations'] });
    }

    // Keep preview text + nav labels in sync with the site language
    document.addEventListener('sitelangchange', onLangChange);

    // Tiny public surface for extensibility / debugging
    window.PersoProjects = {
      go: function (key) {
        for (var i = 0; i < PROJECTS.length; i++) {
          if (PROJECTS[i].key === key) { go(i, i >= current ? 1 : -1); return; }
        }
      },
      current: function () { return PROJECTS[current] && PROJECTS[current].key; },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

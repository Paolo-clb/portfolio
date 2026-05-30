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

  /* ---- Project registry (order = carousel order) ---- */
  var PROJECTS = [
    { key: 'typing',      name: 'Typing Game',  type: 'typing' },
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

  /* ---- Hero title (project swap) ----
     The typing game writes the hero title on its own (new round, language
     change). While a non-typing slide is active we keep our title asserted via
     a MutationObserver, and on returning to typing we hand the title back. */
  var lockedHtml = null;
  var titleObserver = null;

  function projectTitleHtml(name) {
    return 'Paolo Colombat : <em>' + name + '</em>';
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

  function ctaHtml(mobile) {
    if (mobile) {
      return '<span class="la-preview__desktop-note">' +
        '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' +
        '</svg>' + t('laPreviewDesktopOnly') + '</span>';
    }
    return '<button type="button" class="la-preview__play">' +
      '<svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4"/></svg>' +
      t('laPreviewPlay') + '</button>';
  }

  function buildLightAgainPreview(host) {
    var mobile = isMobile();
    host.innerHTML =
      '<div class="la-preview__media">' +
        '<div class="la-preview__play-glyph" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24"><polygon points="8 5 19 12 8 19 8 5"/></svg>' +
        '</div>' +
        '<div class="la-preview__media-caption">' + t('laPreviewVideoSoon') + '</div>' +
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

  function setTab(el, show, proj) {
    if (!show) { el.hidden = true; return; }
    el.hidden = false;
    var lbl = el.querySelector('.hero__nav__label');
    if (lbl) lbl.textContent = proj.name;
    el.setAttribute('aria-label', t('persoNavTo').replace('{name}', proj.name));
    if (navReady) el.classList.add('hero__nav--ready');
  }

  function updateNavTabs() {
    if (!navPrev || !navNext) return;
    setTab(navPrev, current > 0, current > 0 ? PROJECTS[current - 1] : null);
    setTab(navNext, current < PROJECTS.length - 1, current < PROJECTS.length - 1 ? PROJECTS[current + 1] : null);
  }

  function positionNavTabs() {
    if (!hero || !carousel || !navPrev || !navNext) return;
    // Centre the tabs on the carousel content. The sticky launcher no longer
    // collides here: it's hidden + pointer-events:none while the hero is on
    // screen (see body.hero-in-view in css/light-again.css), and it only fades
    // in once the user has scrolled far enough that these tabs have left the top.
    var heroRect = hero.getBoundingClientRect();
    var carRect = carousel.getBoundingClientRect();
    var centerY = (carRect.top - heroRect.top) + carRect.height / 2;
    var topPx = Math.max(76, centerY); // never ride up into the fixed header
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
    if (index < 0 || index >= PROJECTS.length || index === current) return;
    var fromSlide = slideEls[current];
    var toSlide = slideEls[index];
    var proj = PROJECTS[index];

    // Title: typing reclaims its own title; others lock ours in place
    if (proj.type === 'typing') { unlockTitle(); refreshTypingTitle(); }
    else { lockTitle(projectTitleHtml(proj.name)); }

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
    // Re-assert the locked title for the (lang-independent today) active project
    if (lockedHtml != null) lockTitle(projectTitleHtml(PROJECTS[current].name));
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

    // Reveal gating — mirrors the sticky launcher:
    //  • mobile: show immediately (Light Again is a showcase there)
    //  • desktop: once the typing game is activated (cookie / event)
    if (isMobile() || getCookie('typing_game_activated') === '1') {
      revealNav();
    } else {
      document.addEventListener('typinggameready', revealNav, { once: true });
    }

    // Re-open the last-viewed project (persistence across reloads)
    restoreSavedProject();

    // Hide edge tabs while the fullscreen Light Again modal is open
    if ('MutationObserver' in window) {
      new MutationObserver(function () {
        var open = !!document.querySelector('.light-again-overlay');
        document.body.classList.toggle('la-modal-open', open);
      }).observe(document.body, { childList: true });
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

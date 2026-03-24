/**
 * main.js — DOM interactions and dynamic rendering.
 *
 * Depends on js/i18n.js and js/data.js being loaded first.
 * No external libraries — vanilla JS only.
 */

// ---------------------------------------------------------------------------
// Site language state + helpers
// ---------------------------------------------------------------------------
var SITE_LANG_KEY = 'portfolio_lang';
var siteLang = localStorage.getItem(SITE_LANG_KEY) || 'fr';

function siteT(key) {
  return (window.SITE_I18N[siteLang] && window.SITE_I18N[siteLang][key]) || window.SITE_I18N.fr[key] || key;
}
window.__siteT = siteT;

function dataField(obj, field) {
  if (siteLang === 'en' && obj.en && obj.en[field] !== undefined) return obj.en[field];
  return obj[field];
}

function dataDetailField(project, field) {
  if (siteLang === 'en' && project.en && project.en.details && project.en.details[field] !== undefined) return project.en.details[field];
  return project.details ? project.details[field] : undefined;
}

function skillDesc(group, skillIndex) {
  if (siteLang === 'en' && group.en && group.en.skills && group.en.skills[skillIndex]) return group.en.skills[skillIndex].description;
  return group.skills[skillIndex].description;
}

// ---------------------------------------------------------------------------
// Utility: create an element with optional classes and text
// ---------------------------------------------------------------------------
function createElement(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  return el;
}

// ---------------------------------------------------------------------------
// Utility: trap focus inside a dialog overlay
// ---------------------------------------------------------------------------
function trapFocus(overlayEl) {
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function handler(e) {
    if (e.key !== 'Tab') return;
    var focusable = Array.prototype.slice.call(overlayEl.querySelectorAll(FOCUSABLE));
    if (!focusable.length) return;
    var first = focusable[0];
    var last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  overlayEl.addEventListener('keydown', handler);
  // Return cleanup function
  return function () { overlayEl.removeEventListener('keydown', handler); };
}
window.__trapFocus = trapFocus;

// ---------------------------------------------------------------------------
// Build a single project card element
// ---------------------------------------------------------------------------
function buildProjectCard(project) {
  const card = createElement('article', 'project-card');

  // Image
  const imgWrap = createElement('div', 'project-card__image');
  const img = document.createElement('img');
  img.src = project.image;
  img.alt = dataField(project, 'title');
  img.loading = 'lazy';
  imgWrap.appendChild(img);

  // Body
  const body = createElement('div', 'project-card__body');
  body.appendChild(createElement('h3', 'project-card__title', dataField(project, 'title')));
  body.appendChild(createElement('p', 'project-card__desc', dataField(project, 'description')));

  // Tags
  const tags = createElement('div', 'project-card__tags');
  var tagList = dataField(project, 'tags');
  tagList.forEach((t) => tags.appendChild(createElement('span', 'tag', t)));
  body.appendChild(tags);

  card.appendChild(imgWrap);
  card.appendChild(body);

  // Hover hint
  const hint = createElement('span', 'project-card__hint', siteT('learnMore'));
  card.appendChild(hint);

  return card;
}

// ---------------------------------------------------------------------------
// Render first 3 project cards into #projects-grid + "See all" button
// ---------------------------------------------------------------------------
function renderProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  // Clear previous content for re-render
  grid.innerHTML = '';
  var existingActions = grid.parentElement.querySelector('.projects__actions');
  if (existingActions) existingActions.remove();

  const preview = PROJECTS.slice(0, 3);
  preview.forEach((project, i) => {
    const card = buildProjectCard(project);
    card.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProjectDetail(i);
    });
    grid.appendChild(card);
  });

  // "Voir tous les projets" button
  if (PROJECTS.length > 3) {
    const wrapper = grid.parentElement;
    const actions = createElement('div', 'projects__actions');
    const btn = createElement('button', 'btn btn--outline', siteT('viewAllProjects'));
    btn.addEventListener('click', openProjectsModal);
    actions.appendChild(btn);
    wrapper.appendChild(actions);
  }
}

// ---------------------------------------------------------------------------
// Projects modal
// ---------------------------------------------------------------------------
function createProjectsModal() {
  // Remove existing modal if re-creating
  var old = document.getElementById('projects-modal');
  if (old) old.remove();

  const overlay = createElement('div', 'modal-overlay');
  overlay.id = 'projects-modal';

  const modal = createElement('div', 'modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', siteT('allProjectsTitle'));

  // Mobile-only sticky close button (direct child of scroll container)
  const stickyClose = createElement('button', 'modal__close modal__close--sticky', '\u00D7');
  stickyClose.setAttribute('aria-label', siteT('closeLbl'));
  stickyClose.addEventListener('click', closeProjectsModal);
  modal.appendChild(stickyClose);

  // Header
  const header = createElement('div', 'modal__header');
  header.appendChild(createElement('h2', 'modal__title', siteT('allProjectsTitle')));
  const closeBtn = createElement('button', 'modal__close', '\u00D7');
  closeBtn.setAttribute('aria-label', siteT('closeLbl'));
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Grid with all projects (clickable to open detail)
  const grid = createElement('div', 'modal__grid');
  PROJECTS.forEach((project, i) => {
    const card = buildProjectCard(project);
    card.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProjectDetail(i);
    });
    grid.appendChild(card);
  });
  modal.appendChild(grid);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close handlers
  closeBtn.addEventListener('click', closeProjectsModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeProjectsModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProjectsModal();
  });
}

function createScrollHint(modalEl, storageKey) {
  if (localStorage.getItem(storageKey)) return;
  if (modalEl.querySelector('.modal-scroll-hint')) return;
  var hint = document.createElement('div');
  hint.className = 'modal-scroll-hint';
  hint.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
  modalEl.appendChild(hint);
  var onScroll = function () {
    hint.classList.add('modal-scroll-hint--hidden');
    localStorage.setItem(storageKey, '1');
    modalEl.removeEventListener('scroll', onScroll);
  };
  modalEl.addEventListener('scroll', onScroll, { passive: true });
}

var _projectsModalTrapCleanup = null;

function openProjectsModal() {
  // Always recreate to pick up language changes
  createProjectsModal();
  let overlay = document.getElementById('projects-modal');
  // Force reflow for transition
  void overlay.offsetWidth;
  overlay.classList.add('modal-overlay--open');
  document.body.style.overflow = 'hidden';
  _projectsModalTrapCleanup = trapFocus(overlay);
  // Scroll hint (first visit only)
  var modal = overlay.querySelector('.modal');
  if (modal) createScrollHint(modal, 'modal_projects_hint_seen');
  // Focus the close button
  var closeBtn = overlay.querySelector('.modal__close');
  if (closeBtn) closeBtn.focus();
}

function closeProjectsModal() {
  if (_projectsModalTrapCleanup) { _projectsModalTrapCleanup(); _projectsModalTrapCleanup = null; }
  const overlay = document.getElementById('projects-modal');
  if (!overlay) return;
  overlay.classList.remove('modal-overlay--open');
  document.body.style.overflow = '';
}

// ---------------------------------------------------------------------------
// Project detail modal
// ---------------------------------------------------------------------------
function openProjectDetail(index) {
  const project = PROJECTS[index];
  if (!project) return;

  // Remove any existing detail modal
  const existing = document.getElementById('project-detail-modal');
  if (existing) existing.remove();

  const overlay = createElement('div', 'modal-overlay detail-overlay');
  overlay.id = 'project-detail-modal';

  const modal = createElement('div', 'modal detail-modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', dataField(project, 'title'));

  // Close button
  const closeBtn = createElement('button', 'modal__close detail-modal__close', '\u00D7');
  closeBtn.setAttribute('aria-label', siteT('closeLbl'));
  modal.appendChild(closeBtn);

  // Hero image
  const imgWrap = createElement('div', 'detail-modal__image');
  const img = document.createElement('img');
  img.src = project.image;
  img.alt = dataField(project, 'title');
  imgWrap.appendChild(img);
  modal.appendChild(imgWrap);

  // Content
  const content = createElement('div', 'detail-modal__content');

  // Title + tags
  content.appendChild(createElement('h2', 'detail-modal__title', dataField(project, 'title')));
  const tags = createElement('div', 'project-card__tags');
  var tagList = dataField(project, 'tags');
  tagList.forEach((t) => tags.appendChild(createElement('span', 'tag', t)));
  content.appendChild(tags);

  // Overview / Description
  var overview = dataDetailField(project, 'overview');
  if (overview) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', siteT('detailDescription')));
    const descP = createElement('p', 'detail-modal__text');
    descP.innerHTML = overview;
    content.appendChild(descP);
  }

  // Competences (nested lists)
  var competences = dataDetailField(project, 'competences');
  if (competences) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', siteT('detailCompetences')));
    competences.forEach((comp) => {
      content.appendChild(createElement('h4', 'detail-modal__comp-title', comp.title));
      const ul = createElement('ul', 'detail-modal__list');
      comp.items.forEach((item) => ul.appendChild(createElement('li', null, item)));
      content.appendChild(ul);
    });
  }

  // Objectifs
  var objectifs = dataDetailField(project, 'objectifs');
  if (objectifs) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', siteT('detailObjectives')));
    const objP = createElement('p', 'detail-modal__text');
    objP.innerHTML = objectifs;
    content.appendChild(objP);
  }

  // Equipe
  var equipe = dataDetailField(project, 'equipe');
  if (equipe) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', siteT('detailTeamwork')));
    const eqP = createElement('p', 'detail-modal__text');
    eqP.innerHTML = equipe.replace(/\n/g, '<br>');
    content.appendChild(eqP);
  }

  // Travail individuel
  var travailIndividuel = dataDetailField(project, 'travailIndividuel');
  if (travailIndividuel) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', siteT('detailIndividual')));
    const tiP = createElement('p', 'detail-modal__text');
    tiP.innerHTML = travailIndividuel;
    content.appendChild(tiP);
  }

  // Tech details / Savoir-faire (array → list, string → paragraph)
  var techDetails = dataDetailField(project, 'techDetails');
  if (techDetails) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', siteT('detailTech')));
    if (Array.isArray(techDetails)) {
      const ul = createElement('ul', 'detail-modal__list');
      techDetails.forEach((t) => ul.appendChild(createElement('li', null, t)));
      content.appendChild(ul);
    } else {
      content.appendChild(createElement('p', 'detail-modal__text', techDetails));
    }
  }

  // Challenges
  var challenges = dataDetailField(project, 'challenges');
  if (challenges) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', siteT('detailChallenges')));
    const chP = createElement('p', 'detail-modal__text');
    chP.innerHTML = challenges;
    content.appendChild(chP);
  }

  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Open with transition
  void overlay.offsetWidth;
  overlay.classList.add('modal-overlay--open');
  document.body.style.overflow = 'hidden';
  var _detailTrapCleanup = trapFocus(overlay);
  closeBtn.focus();

  // Scroll hint (first visit only)
  createScrollHint(modal, 'modal_detail_hint_seen');

  // Close handlers
  closeBtn.addEventListener('click', () => closeProjectDetail(_detailTrapCleanup));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeProjectDetail(_detailTrapCleanup);
  });

  // Escape key — close detail first, then projects modal
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeProjectDetail(_detailTrapCleanup);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

function closeProjectDetail(trapCleanup) {
  if (trapCleanup) trapCleanup();
  const overlay = document.getElementById('project-detail-modal');
  if (!overlay) return;
  overlay.classList.remove('modal-overlay--open');
  // Remove from DOM after transition
  setTimeout(() => overlay.remove(), 350);
  // Restore scroll only if no other modal is open
  const projectsModal = document.getElementById('projects-modal');
  if (!projectsModal || !projectsModal.classList.contains('modal-overlay--open')) {
    document.body.style.overflow = '';
  }
}

// ---------------------------------------------------------------------------
// Render skill items into #skills-grid (grouped)
// ---------------------------------------------------------------------------
var skillsExpanded = false;
var skillsCollapsing = false; // guards scroll-reveal during collapse

function renderSkills() {
  const grid = document.getElementById('skills-grid');
  if (!grid) return;

  // Clear previous render
  grid.innerHTML = '';
  var oldActions = grid.parentElement.querySelector('.skills__actions');
  if (oldActions) oldActions.remove();

  var VISIBLE_COUNT = 2;

  SKILL_GROUPS.forEach(function (group, index) {
    var section = createElement('div', 'skills-group');
    if (index >= VISIBLE_COUNT && !skillsExpanded) {
      section.classList.add('skills-group--hidden');
    }

    section.appendChild(createElement('h3', 'skills-group__label', dataField(group, 'label')));

    var row = createElement('div', 'skills-group__items');
    group.skills.forEach(function (skill, sIdx) {
      var item = createElement('div', 'skill-item');
      item.style.cursor = 'pointer';

      var iconEl = document.createElement('img');
      iconEl.src = skill.icon;
      iconEl.alt = skill.name;
      iconEl.className = 'skill-item__icon';
      iconEl.loading = 'lazy';
      iconEl.onerror = function () {
        var fb = createElement('span', 'skill-item__icon skill-item__icon--fallback', skill.name.charAt(0).toUpperCase());
        this.replaceWith(fb);
      };
      item.appendChild(iconEl);

      item.appendChild(createElement('div', 'skill-item__name', skill.name));

      item.addEventListener('click', function () {
        openSkillPopup(skill, group, sIdx);
      });

      row.appendChild(item);
    });

    section.appendChild(row);
    grid.appendChild(section);
  });

  // Toggle button
  if (SKILL_GROUPS.length > VISIBLE_COUNT) {
    var wrapper = grid.parentElement;
    var actions = createElement('div', 'skills__actions');
    var btn = createElement('button', 'btn btn--outline', skillsExpanded ? siteT('viewLess') : siteT('viewAllSkills'));

    btn.addEventListener('click', function () {
      var hiddenGroups = grid.querySelectorAll('.skills-group--hidden');
      var allGroups = grid.querySelectorAll('.skills-group');

      if (!skillsExpanded) {
        // ── Expand ── same animation as scroll reveal
        hiddenGroups.forEach(function (g, gi) {
          g.classList.remove('skills-group--hidden');
          g.classList.add('skills-group--revealing');
          void g.offsetWidth;
          g.classList.add('skills-group--visible');

          // Start with group hidden (no transition = instant)
          g.style.opacity = '0';
          g.style.transform = 'translateY(30px)';
          g.style.transition = 'none';
          var items = g.querySelectorAll('.skill-item');
          items.forEach(function (item) {
            item.style.opacity = '0';
            item.style.transition = 'none';
          });

          setTimeout(function () {
            // Slide group in
            g.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            g.style.opacity = '1';
            g.style.transform = 'translateY(0)';

            // Then stagger items
            setTimeout(function () {
              items.forEach(function (item, ii) {
                item.style.transition = 'opacity 0.35s ease';
                item.style.transitionDelay = (ii * 0.04) + 's';
                item.style.opacity = '1';
                setTimeout(function () {
                  item.style.opacity = '';
                  item.style.transition = '';
                  item.style.transitionDelay = '';
                }, 400 + ii * 40);
              });
            }, 300);

            setTimeout(function () {
              g.style.opacity = '';
              g.style.transform = '';
              g.style.transition = '';
            }, 600);
          }, gi * 120);
        });
        btn.textContent = siteT('viewLess');
        skillsExpanded = true;
      } else {
        // ── Collapse ── remember the button's viewport-relative position
        // so we can restore it after the groups disappear.
        skillsCollapsing = true; // prevent scroll-reveal from re-triggering
        var btnRect = btn.getBoundingClientRect();
        var btnViewportOffset = btnRect.top; // distance from viewport top

        var toCollapse = [];
        allGroups.forEach(function (g, i) {
          if (i >= VISIBLE_COUNT) toCollapse.push(g);
        });
        var pending = toCollapse.length;
        function afterAllCollapsed() {
          // Where the button ended up after layout shift
          var newBtnRect = btn.getBoundingClientRect();
          var drift = newBtnRect.top - btnViewportOffset;
          if (Math.abs(drift) < 2) { skillsCollapsing = false; return; } // negligible

          var targetScroll = window.scrollY + drift;
          if (targetScroll < 0) targetScroll = 0;

          // rAF-based smooth scroll, aborts on any user scroll intent
          var start = null;
          var from = window.scrollY;
          var distance = targetScroll - from;
          var duration = Math.min(500, Math.abs(distance) * 1.2);
          var cancelled = false;
          var lastSetY = from;

          function cancel() { cancelled = true; }

          // Detect user-initiated scroll: if scroll position diverges
          // from what we last set, the user is scrolling
          function onScroll() {
            if (Math.abs(window.scrollY - lastSetY) > 2) cancel();
          }

          window.addEventListener('scroll', onScroll, { passive: true });
          window.addEventListener('wheel', cancel, { passive: true });
          window.addEventListener('touchstart', cancel, { passive: true });
          window.addEventListener('pointerdown', cancel, { passive: true });

          function step(ts) {
            if (cancelled) { cleanup(); return; }
            if (!start) start = ts;
            var t = Math.min((ts - start) / duration, 1);
            var ease = 1 - Math.pow(1 - t, 3);
            lastSetY = Math.round(from + distance * ease);
            window.scrollTo(0, lastSetY);
            if (t < 1) requestAnimationFrame(step);
            else cleanup();
          }
          function cleanup() {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('wheel', cancel);
            window.removeEventListener('touchstart', cancel);
            window.removeEventListener('pointerdown', cancel);
            skillsCollapsing = false;
          }
          requestAnimationFrame(step);
        }
        toCollapse.forEach(function (g) {
          g.classList.remove('skills-group--visible');
          g.classList.remove('skills-group--revealing');
          g.classList.add('skills-group--collapsing');
          var done = false;
          function onEnd() {
            if (done) return;
            done = true;
            g.removeEventListener('transitionend', onEnd);
            g.classList.remove('skills-group--collapsing');
            g.classList.add('skills-group--hidden');
            pending--;
            if (pending === 0) afterAllCollapsed();
          }
          g.addEventListener('transitionend', onEnd);
          setTimeout(onEnd, 500);
        });
        btn.textContent = siteT('viewAllSkills');
        skillsExpanded = false;
      }
    });

    actions.appendChild(btn);
    wrapper.appendChild(actions);
  }
}

// ---------------------------------------------------------------------------
// Skill popup
// ---------------------------------------------------------------------------
function openSkillPopup(skill, group, skillIndex) {
  // Remove any existing popup
  var existing = document.getElementById('skill-popup');
  if (existing) existing.remove();

  var overlay = createElement('div', 'modal-overlay skill-overlay');
  overlay.id = 'skill-popup';

  var popup = createElement('div', 'skill-popup');
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-label', skill.name);

  // Close button
  var closeBtn = createElement('button', 'modal__close skill-popup__close', '\u00D7');
  closeBtn.setAttribute('aria-label', siteT('closeLbl'));
  popup.appendChild(closeBtn);

  // Icon
  var iconWrap = createElement('div', 'skill-popup__icon-wrap');
  var icon = document.createElement('img');
  icon.src = skill.icon;
  icon.alt = skill.name;
  icon.className = 'skill-popup__icon';
  icon.onerror = function () {
    var fb = createElement('span', 'skill-popup__icon skill-popup__icon--fallback', skill.name.charAt(0).toUpperCase());
    this.replaceWith(fb);
  };
  iconWrap.appendChild(icon);
  popup.appendChild(iconWrap);

  // Name
  popup.appendChild(createElement('h3', 'skill-popup__name', skill.name));

  // Description
  var desc = (group && skillIndex !== undefined) ? skillDesc(group, skillIndex) : skill.description;
  if (desc) {
    popup.appendChild(createElement('p', 'skill-popup__desc', desc));
  }

  // Level bar
  if (skill.level) {
    var levelWrap = createElement('div', 'skill-popup__level');
    var labelRow = createElement('div', 'skill-popup__level-header');
    labelRow.appendChild(createElement('span', 'skill-popup__level-label', siteT('levelLabel')));
    var levelKey = 'level' + skill.level;
    labelRow.appendChild(createElement('span', 'skill-popup__level-text', siteT(levelKey)));
    levelWrap.appendChild(labelRow);

    var track = createElement('div', 'skill-popup__bar-track');
    var fill = createElement('div', 'skill-popup__bar-fill');
    fill.style.width = '0%';
    track.appendChild(fill);
    levelWrap.appendChild(track);

    // Dots
    var dots = createElement('div', 'skill-popup__dots');
    for (var i = 1; i <= 5; i++) {
      var dot = createElement('span', 'skill-popup__dot');
      if (i <= skill.level) dot.classList.add('skill-popup__dot--active');
      dots.appendChild(dot);
    }
    levelWrap.appendChild(dots);

    popup.appendChild(levelWrap);

    // Animate the bar after render
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fill.style.width = (skill.level / 5 * 100) + '%';
      });
    });
  }

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Open with transition
  void overlay.offsetWidth;
  overlay.classList.add('modal-overlay--open');
  var _skillTrapCleanup = trapFocus(overlay);
  closeBtn.focus();

  // Close handlers
  function doCloseSkillPopup() {
    if (_skillTrapCleanup) { _skillTrapCleanup(); _skillTrapCleanup = null; }
    closeSkillPopup();
  }
  closeBtn.addEventListener('click', doCloseSkillPopup);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) doCloseSkillPopup();
  });
  var escHandler = function (e) {
    if (e.key === 'Escape') {
      doCloseSkillPopup();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

function closeSkillPopup() {
  var overlay = document.getElementById('skill-popup');
  if (!overlay) return;
  overlay.classList.remove('modal-overlay--open');
  setTimeout(function () { overlay.remove(); }, 350);
}

// ---------------------------------------------------------------------------
// Mobile navigation toggle
// ---------------------------------------------------------------------------
function initNavToggle() {
  const toggle = document.getElementById('nav-toggle');
  const navList = document.querySelector('.nav__list');
  if (!toggle || !navList) return;

  toggle.addEventListener('click', () => {
    navList.classList.toggle('nav__list--open');
    toggle.classList.toggle('nav__toggle--active');
  });

  // Close menu when a link is clicked, and smooth-scroll to target
  navList.querySelectorAll('.nav__link').forEach((link) => {
    link.addEventListener('click', (e) => {
      navList.classList.remove('nav__list--open');
      toggle.classList.remove('nav__toggle--active');
      var href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // Smooth-scroll for the scroll-hint anchor
  var scrollHint = document.getElementById('scroll-hint');
  if (scrollHint) {
    scrollHint.addEventListener('click', function(e) {
      var href = scrollHint.getAttribute('href');
      if (href && href.startsWith('#')) {
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }

}

// ---------------------------------------------------------------------------
// Active nav link highlighting on scroll
// ---------------------------------------------------------------------------
function initScrollSpy() {
  const sections = document.querySelectorAll('.section[id]');
  const navLinks = document.querySelectorAll('.nav__link');
  const indicator = document.getElementById('nav-indicator');

  function moveIndicator(activeLink) {
    if (!activeLink || !indicator) return;
    var rect = activeLink.getBoundingClientRect();
    var parentRect = indicator.parentElement.getBoundingClientRect();
    indicator.style.left = (rect.left - parentRect.left) + 'px';
    indicator.style.width = rect.width + 'px';
    indicator.classList.add('nav__indicator--visible');
  }

  function onScroll() {
    var viewportH = window.innerHeight;
    var bestSection = null;
    var bestVisible = -1;

    sections.forEach(function (section) {
      var rect = section.getBoundingClientRect();
      // Visible height = intersection of section with viewport
      var visibleTop = Math.max(rect.top, 0);
      var visibleBottom = Math.min(rect.bottom, viewportH);
      var visiblePx = Math.max(0, visibleBottom - visibleTop);
      if (visiblePx > bestVisible) {
        bestVisible = visiblePx;
        bestSection = section;
      }
    });

    var activeLink = null;
    sections.forEach(function (section) {
      var id = section.getAttribute('id');
      var link = document.querySelector('.nav__link[href="#' + id + '"]');
      if (link) {
        var isActive = section === bestSection && bestVisible > 0;
        link.classList.toggle('nav__link--active', isActive);
        if (isActive) activeLink = link;
      }
    });

    if (activeLink) {
      moveIndicator(activeLink);
    } else if (indicator) {
      indicator.classList.remove('nav__indicator--visible');
    }
  }

  var ticking = false;
  function onScrollThrottled() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        onScroll();
        ticking = false;
      });
    }
  }

  window.addEventListener('scroll', onScrollThrottled, { passive: true });
  window.addEventListener('resize', onScrollThrottled, { passive: true });
  // Initial call
  onScroll();
}

// ---------------------------------------------------------------------------
// Contact form handler — sends via Formspree
// Security: honeypot, cooldown (60s), timing check, input trimming
// ---------------------------------------------------------------------------
let _formCooldownUntil = 0;
let _formLoadedAt = Date.now();

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  _formLoadedAt = Date.now();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    if (btn.disabled) return;
    const statusEl = document.getElementById('form-status');

    // Hide previous status
    statusEl.style.display = 'none';
    statusEl.className = 'form__status';

    // --- Honeypot check (bot filled the hidden field) ---
    const honeypot = form.querySelector('[name="_gotcha"]');
    if (honeypot && honeypot.value) {
      statusEl.textContent = siteT('msgSuccess');
      statusEl.classList.add('form__status--success');
      statusEl.style.display = 'block';
      form.reset();
      return;
    }

    // --- Timing check (submitted too fast = likely bot) ---
    if (Date.now() - _formLoadedAt < 3000) {
      statusEl.textContent = siteT('msgTimingError');
      statusEl.classList.add('form__status--error');
      statusEl.style.display = 'block';
      return;
    }

    // --- Cooldown check (60 seconds between sends) ---
    const now = Date.now();
    if (now < _formCooldownUntil) {
      const secsLeft = Math.ceil((_formCooldownUntil - now) / 1000);
      statusEl.textContent = siteT('msgCooldown').replace('{s}', secsLeft);
      statusEl.classList.add('form__status--error');
      statusEl.style.display = 'block';
      return;
    }

    // --- Trim inputs ---
    form.querySelector('#name').value = form.querySelector('#name').value.trim();
    form.querySelector('#email').value = form.querySelector('#email').value.trim();
    form.querySelector('#message').value = form.querySelector('#message').value.trim();

    // --- Re-validate after trim ---
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const originalText = btn.textContent;
    btn.textContent = siteT('msgSending');
    btn.disabled = true;

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        statusEl.textContent = siteT('msgSuccess');
        statusEl.classList.add('form__status--success');
        statusEl.style.display = 'block';
        form.reset();
        _formCooldownUntil = Date.now() + 60000;
        startCooldownTimer(btn);
        return;
      } else {
        statusEl.textContent = siteT('msgServerError');
        statusEl.classList.add('form__status--error');
        statusEl.style.display = 'block';
      }
    } catch {
      statusEl.textContent = siteT('msgNetworkError');
      statusEl.classList.add('form__status--error');
      statusEl.style.display = 'block';
    } finally {
      if (!btn.dataset.cooldown) {
        btn.textContent = siteT('submitBtn');
        btn.disabled = false;
      }
    }
  });
}

function startCooldownTimer(btn) {
  btn.dataset.cooldown = '1';
  const tick = () => {
    const secsLeft = Math.ceil((_formCooldownUntil - Date.now()) / 1000);
    if (secsLeft <= 0) {
      btn.textContent = siteT('submitBtn');
      btn.disabled = false;
      delete btn.dataset.cooldown;
      return;
    }
    btn.textContent = siteT('msgCooldownBtn').replace('{s}', secsLeft);
    btn.disabled = true;
    setTimeout(tick, 500);
  };
  tick();
}

// ---------------------------------------------------------------------------
// Language toggle
// ---------------------------------------------------------------------------
function updateStaticTexts() {
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = siteT(el.getAttribute('data-i18n'));
  });
}

function updateSiteLanguage() {
  var scrollY = window.pageYOffset;

  updateStaticTexts();
  renderProjects();
  renderSkills();
  setFooterYear();

  // Close any open modals / popups
  var detailOverlay = document.querySelector('.detail-modal-overlay');
  if (detailOverlay) detailOverlay.remove();
  var projectsModal = document.getElementById('projects-modal');
  if (projectsModal) projectsModal.remove();
  var skillPopup = document.getElementById('skill-popup');
  if (skillPopup) skillPopup.remove();

  // Tell the typing game (and others) about the language change
  document.dispatchEvent(new CustomEvent('sitelangchange', { detail: { lang: siteLang } }));

  // Refresh nav indicator position (link text width may have changed)
  requestAnimationFrame(function () {
    window.dispatchEvent(new Event('resize'));
  });

  // Restore scroll position (DOM re-render may shift it)
  window.scrollTo(0, scrollY);
}

function initLangToggle() {
  var btn = document.getElementById('lang-toggle');
  var label = document.getElementById('lang-label');
  if (!btn || !label) return;

  // Set initial label
  label.textContent = siteLang === 'fr' ? 'FR' : 'EN';

  // Custom tooltip
  var tipEl = document.createElement('div');
  tipEl.className = 'lang-toggle__tooltip';
  btn.appendChild(tipEl);
  var tipTimer = null;

  btn.addEventListener('mouseenter', function () {
    clearTimeout(tipTimer);
    tipEl.textContent = siteT('langTooltip');
    void tipEl.offsetWidth;
    tipEl.classList.add('lang-toggle__tooltip--visible');
  });
  btn.addEventListener('mouseleave', function () {
    tipEl.classList.remove('lang-toggle__tooltip--visible');
    tipTimer = setTimeout(function () {}, 200);
  });

  btn.addEventListener('click', function () {
    tipEl.classList.remove('lang-toggle__tooltip--visible');

    // Toggle
    siteLang = siteLang === 'fr' ? 'en' : 'fr';
    localStorage.setItem(SITE_LANG_KEY, siteLang);
    document.documentElement.lang = siteLang;

    // Animate label swap
    label.classList.add('lang-toggle__label--swapping');
    setTimeout(function () {
      label.textContent = siteLang === 'fr' ? 'FR' : 'EN';
      label.classList.remove('lang-toggle__label--swapping');
    }, 200);

    updateSiteLanguage();
  });
}

// ---------------------------------------------------------------------------
// Footer year
// ---------------------------------------------------------------------------
function setFooterYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}

// ---------------------------------------------------------------------------
// Scroll Progress Bar
// ---------------------------------------------------------------------------
function initScrollProgress() {
  var bar = createElement('div', 'scroll-progress');
  var fill = createElement('div', 'scroll-progress__fill');
  bar.appendChild(fill);
  document.body.appendChild(bar);

  var ticking = false;
  function update() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        var scrollTop = window.scrollY;
        var docH = document.documentElement.scrollHeight - window.innerHeight;
        var pct = docH > 0 ? (scrollTop / docH) * 100 : 0;
        fill.style.width = pct + '%';
        ticking = false;
      });
    }
  }
  window.addEventListener('scroll', update, { passive: true });
  // Also update when page height changes (e.g. skills expand/collapse)
  if ('ResizeObserver' in window) {
    new ResizeObserver(update).observe(document.documentElement);
  }
}

// ---------------------------------------------------------------------------
// Scroll Reveal (IntersectionObserver)
// ---------------------------------------------------------------------------
function initScrollReveal() {
  // Tag .container inside sections (not sections themselves) so the
  // translucent section background is never hidden by opacity:0.
  var sections = document.querySelectorAll('.section');
  sections.forEach(function (sec) {
    if (sec.id === 'hero') return;
    var cont = sec.querySelector('.container');
    if (cont) {
      cont.classList.add('reveal');
    }

    // Tag direct grid children for staggered reveal
    // .skills-group excluded — handled separately to avoid conflicting
    // with expand/collapse transitions (--hidden, --collapsing, --visible)
    var children = sec.querySelectorAll('.project-card, .cv-section__card, .contact__form, .form__group');
    children.forEach(function (child) {
      child.classList.add('reveal-child');
    });
  });

  if (!('IntersectionObserver' in window)) {
    // Fallback: just show everything
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('reveal--visible'); });
    document.querySelectorAll('.reveal-child').forEach(function (el) { el.classList.add('reveal-child--visible'); });
    return;
  }

  // ── Scroll direction tracking ──
  var lastScrollY = window.scrollY || window.pageYOffset;
  var scrollingDown = true;
  window.addEventListener('scroll', function () {
    var currentY = window.scrollY || window.pageYOffset;
    scrollingDown = currentY > lastScrollY;
    lastScrollY = currentY;
  }, { passive: true });

  // ── Instant reveal (scroll-up or already visible on load) ──
  function revealInstant(target) {
    target.style.transition = 'none';
    target.classList.add('reveal--visible');
    target.classList.add('reveal--settled');

    var children = target.querySelectorAll('.reveal-child');
    children.forEach(function (child) {
      child.style.transition = 'none';
      child.classList.add('reveal-child--visible');
    });

    // Remove inline overrides after the style has been committed
    requestAnimationFrame(function () {
      target.style.transition = '';
      children.forEach(function (child) {
        child.style.transition = '';
      });
    });
  }

  // ── Animated reveal (scroll-down) ──
  function revealAnimated(target) {
    target.classList.add('reveal--visible');

    // Mark as settled once the reveal transition finishes
    // so rain surfaces use final coordinates, not mid-animation ones
    function onSettled(e) {
      if (e.propertyName !== 'transform') return;
      target.removeEventListener('transitionend', onSettled);
      target.classList.add('reveal--settled');
    }
    target.addEventListener('transitionend', onSettled);

    var children = target.querySelectorAll('.reveal-child');
    children.forEach(function (child, i) {
      child.style.transitionDelay = (i * 0.07) + 's';
      requestAnimationFrame(function () {
        child.classList.add('reveal-child--visible');
      });
    });

    // Skills-groups: stagger with ephemeral inline styles so
    // expand/collapse classes are never interfered with.
    // Skip when animations are disabled — inline styles would override
    // the CSS [data-animations="off"] rules and cause unwanted reveals.
    if (document.documentElement.getAttribute('data-animations') === 'off') return;
    var groups = target.querySelectorAll('.skills-group:not(.skills-group--hidden)');
    var baseDelay = children.length * 70;
    groups.forEach(function (g, gi) {
      g.style.opacity = '0';
      g.style.transform = 'translateY(30px)';
      g.style.transition = 'none';
      var items = g.querySelectorAll('.skill-item');
      items.forEach(function (item) {
        item.style.opacity = '0';
        item.style.transition = 'none';
      });

      var groupDelay = baseDelay + gi * 120;
      setTimeout(function () {
        g.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        g.style.opacity = '1';
        g.style.transform = 'translateY(0)';

        setTimeout(function () {
          items.forEach(function (item, ii) {
            item.style.transition = 'opacity 0.35s ease';
            item.style.transitionDelay = (ii * 0.04) + 's';
            item.style.opacity = '1';
            setTimeout(function () {
              item.style.opacity = '';
              item.style.transition = '';
              item.style.transitionDelay = '';
            }, 400 + ii * 40);
          });
        }, 300);

        setTimeout(function () {
          g.style.opacity = '';
          g.style.transform = '';
          g.style.transition = '';
        }, 600);
      }, groupDelay);
    });
  }

  // Sections reveal once and stay visible (never un-reveal).
  // Scroll-down → animated, scroll-up → instant (already there).
  var sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (skillsCollapsing && entry.target.querySelector('.skills-group')) return;
      if (entry.target.classList.contains('reveal--visible')) return;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.12) {
        var animsOff = document.documentElement.getAttribute('data-animations') === 'off';
        if (!animsOff && scrollingDown) {
          revealAnimated(entry.target);
        } else {
          revealInstant(entry.target);
        }
        sectionObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

  document.querySelectorAll('.reveal').forEach(function (el) {
    sectionObserver.observe(el);
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initLangToggle();
  updateStaticTexts();
  renderProjects();
  renderSkills();
  initNavToggle();
  initScrollSpy();
  initContactForm();
  setFooterYear();
  initScrollHint();
  initThemeToggle();
  initAnimationControls();
  initCursorHalo();
  initScrollProgress();
  initScrollReveal();
});

// ---------------------------------------------------------------------------
// Cursor Halo (follower) — smooth lerp follow
// ---------------------------------------------------------------------------
function initCursorHalo() {
  // Skip on touch devices
  if (window.matchMedia('(pointer: coarse)').matches) return;

  // Build DOM
  var halo = createElement('div', 'cursor-halo');
  var ring = createElement('div', 'cursor-halo__ring');
  var dot  = createElement('div', 'cursor-halo__dot');
  halo.appendChild(ring);
  halo.appendChild(dot);
  document.body.appendChild(halo);

  // ---- state ----
  var mouseX = -200, mouseY = -200;
  var ringX = -200, ringY = -200;
  var dotX = -200, dotY = -200;
  var started = false;
  var raf = null;

  // Opacity driven per-frame
  var currentOpacity = 0;
  var targetOpacity  = 0;
  var opacitySpeed   = 0.07;

  // Lerp speeds
  var lerpRing = 0.15;
  var lerpDot  = 0.30;

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---- animation loop ----
  function tick() {
    ringX = lerp(ringX, mouseX, lerpRing);
    ringY = lerp(ringY, mouseY, lerpRing);

    dotX = lerp(dotX, mouseX, lerpDot);
    dotY = lerp(dotY, mouseY, lerpDot);

    // Clamp dot inside ring
    var offX = dotX - ringX;
    var offY = dotY - ringY;
    var dist = Math.sqrt(offX * offX + offY * offY);
    var maxR = 14;
    if (dist > maxR) {
      var s = maxR / dist;
      dotX = ringX + offX * s;
      dotY = ringY + offY * s;
    }

    ring.style.transform = 'translate(-50%,-50%) translate3d(' + ringX + 'px,' + ringY + 'px,0)';
    dot.style.transform  = 'translate(-50%,-50%) translate3d(' + dotX  + 'px,' + dotY  + 'px,0)';

    // Smooth opacity
    if (currentOpacity !== targetOpacity) {
      if (currentOpacity < targetOpacity) {
        currentOpacity = Math.min(currentOpacity + opacitySpeed, targetOpacity);
      } else {
        currentOpacity = Math.max(currentOpacity - opacitySpeed, targetOpacity);
      }
      halo.style.opacity = String(Math.round(currentOpacity * 1000) / 1000);
    }

    // Pause RAF when fully hidden
    if (currentOpacity <= 0 && targetOpacity <= 0) {
      halo.style.opacity = '0';
      cancelAnimationFrame(raf);
      raf = null;
      return;
    }

    raf = requestAnimationFrame(tick);
  }

  function ensureRunning() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  // ---- first move: snap, start ----
  document.addEventListener('mousemove', function onFirstMove(e) {
    mouseX = e.clientX; mouseY = e.clientY;
    ringX = mouseX; ringY = mouseY;
    dotX  = mouseX; dotY  = mouseY;
    started = true;
    targetOpacity = 1;
    ensureRunning();
    document.removeEventListener('mousemove', onFirstMove);
  });

  // ---- track cursor ----
  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  // ---- hover on interactive elements ----
  var interactiveSelector = 'a, button, input, textarea, select, [role="button"], .project-card, .skill-item, .nav__link, .btn, .typing-game__text, .music-player__playlist-item, .music-player__volume-icon, .typing-game__ai-opt, .typing-game__settings-option, .zen-popup-overlay, .modal-overlay, .music-popup-overlay, .weak-popup-overlay, .anim-toggle__track, .anim-toggle';
  var modalAllowedSelector = 'button, .modal__close, a, .btn';

  document.addEventListener('mouseover', function (e) {
    var inDetailModal = e.target.closest('.detail-modal');
    if (inDetailModal) {
      if (e.target.closest(modalAllowedSelector)) {
        halo.classList.add('cursor-halo--hover');
      }
      return;
    }
    if (e.target.closest('.cv-section__viewer')) {
      targetOpacity = 0;
      ensureRunning();
      return;
    }
    if (e.target.closest(interactiveSelector)) {
      // Don't show hover on typing text when game is focused, intro is playing, or AI inline is active
      if (e.target.closest('.typing-game__text')) {
        var game = document.getElementById('typing-game');
        var gameFocused = game && game.dataset.focused === '1';
        var isIntro = e.target.closest('.typing-game__text--intro');
        var aiInlineVisible = e.target.closest('.typing-game__text') &&
            e.target.closest('.typing-game__text').querySelector('.typing-game__ai-inline--visible');
        if (gameFocused || isIntro || aiInlineVisible) return;
      }
      // Don't show hover on popup overlay content — only on the backdrop itself,
      // but allow interactive children (buttons, inputs, labels) inside the popup
      if (e.target.closest('.zen-popup-overlay') && e.target.closest('.zen-popup') &&
          !e.target.closest('button, input, label, a, .typing-game__ai-opt, .typing-game__settings-option')) return;
      // While AI is generating (popup still open, can't be closed), don't show
      // hover on the backdrop — clicking it does nothing during that phase
      if (e.target.closest('.zen-popup-overlay') && !e.target.closest('.zen-popup') &&
          document.body.dataset.aiLoading === '1') return;
      // Don't show hover on modal overlay content — only on the backdrop itself
      // Exceptions: project cards and interactive controls remain hoverable
      if (e.target.closest('.modal-overlay') && e.target.closest('.modal, .detail-modal, .skill-popup') && !e.target.closest('.project-card') && !e.target.closest('button, .modal__close, a, .btn')) return;
      // Music popup: backdrop clickable (closes), inside popup content is not hoverable unless interactive
      if (e.target.closest('.music-popup-overlay') && e.target.closest('.music-popup') &&
          !e.target.closest('button, input, label, a, .music-player__volume-icon, .music-popup__playlist-item')) return;
      // Weak device warning popup: same pattern
      if (e.target.closest('.weak-popup-overlay') && e.target.closest('.weak-popup') &&
          !e.target.closest('button, a')) return;
      halo.classList.add('cursor-halo--hover');
    }
  }, { passive: true });

  document.addEventListener('mouseout', function (e) {
    if (e.target.closest(interactiveSelector) || e.target.closest(modalAllowedSelector)) {
      halo.classList.remove('cursor-halo--hover');
    }
    if (e.target.closest('.cv-section__viewer')) {
      targetOpacity = 1;
      ensureRunning();
    }
  }, { passive: true });

  // ---- click feedback ----
  document.addEventListener('mousedown', function (e) {
    halo.classList.add('cursor-halo--click');
    // Instantly remove hover when clicking the typing game (gains focus)
    if (e.target.closest('#typing-game')) {
      halo.classList.remove('cursor-halo--hover');
    }
  });
  document.addEventListener('mouseup', function () {
    halo.classList.remove('cursor-halo--click');
  });

  // ---- remove hover when a popup/modal overlay closes ----
  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      // Case 1: zen/AI/settings popups are removed from DOM entirely
      m.removedNodes.forEach(function (node) {
        if (node.nodeType === 1 &&
            (node.classList.contains('zen-popup-overlay') ||
             node.classList.contains('modal-overlay') ||
             node.classList.contains('skill-overlay') ||
             node.classList.contains('music-popup-overlay') ||
             node.classList.contains('weak-popup-overlay'))) {
          halo.classList.remove('cursor-halo--hover');
        }
      });
      // Case 2: projects/detail modals stay in DOM but lose modal-overlay--open class
      if (m.type === 'attributes' &&
          m.target.classList.contains('modal-overlay') &&
          !m.target.classList.contains('modal-overlay--open')) {
        halo.classList.remove('cursor-halo--hover');
      }
    });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  // ---- hide/show on leave/enter ----
  document.documentElement.addEventListener('mouseleave', function () {
    if (!started) return;
    targetOpacity = 0;
    ensureRunning();
  });

  document.documentElement.addEventListener('mouseenter', function (e) {
    if (!started) return;
    mouseX = e.clientX; mouseY = e.clientY;
    ringX = mouseX; ringY = mouseY;
    dotX  = mouseX; dotY  = mouseY;
    targetOpacity = 1;
    ensureRunning();
  });

  window.addEventListener('blur', function () {
    if (!started) return;
    targetOpacity = 0;
    ensureRunning();
  });

  // ---- hide while typing in the typing game ----
  var typingContainer = document.getElementById('typing-game');
  if (typingContainer) {
    typingContainer.addEventListener('keydown', function (e) {
      // Ignore modifier-only keys
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      if (!started) return;
      targetOpacity = 0;
      opacitySpeed = 0.12; // faster fade-out
      document.body.classList.add('cursor-hidden');
      ensureRunning();
    });

    document.addEventListener('mousemove', function () {
      if (document.body.classList.contains('cursor-hidden')) {
        document.body.classList.remove('cursor-hidden');
        opacitySpeed = 0.07; // normal fade-in
        targetOpacity = 1;
        ensureRunning();
      }
    }, { passive: true });
  }
}

// ---------------------------------------------------------------------------
// Scroll-hint chevron — hide after user scrolls
// ---------------------------------------------------------------------------
function initScrollHint() {
  const hint = document.querySelector('.scroll-hint');
  if (!hint) return;
  const game = document.getElementById('typing-game');
  const hero = document.querySelector('section.hero');
  const mqShortViewport = window.matchMedia('(max-height: 725px)');

  // When the scroll-hint is shifted to the side (short viewport + intro btn visible),
  // align it vertically with the center of the intro button.
  function alignWithBtn() {
    var btn = hero && hero.querySelector('.typing-game__intro-btn--visible');
    if (mqShortViewport.matches && btn) {
      var btnRect = btn.getBoundingClientRect();
      var heroRect = hero.getBoundingClientRect();
      var btnCenterY = btnRect.top + btnRect.height / 2 - heroRect.top;
      hint.style.top = (btnCenterY - hint.offsetHeight / 2) + 'px';
      hint.style.bottom = 'auto';
    } else {
      hint.style.top = '';
      hint.style.bottom = '';
    }
  }

  function update() {
    var playing  = game && game.dataset.playing  === '1';
    var focused  = game && game.dataset.focused  === '1';
    var scrolledDown = window.scrollY > 80;
    // Hide: scrolled down OR (typing active AND game has focus)
    // Show: at the top AND (not typing OR game lost focus)
    if (scrolledDown || (playing && focused)) {
      hint.classList.add('scroll-hint--hidden');
    } else {
      hint.classList.remove('scroll-hint--hidden');
    }
    alignWithBtn();
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', alignWithBtn, { passive: true });
  mqShortViewport.addEventListener('change', alignWithBtn);

  if (game) {
    // Re-evaluate visibility on game state changes
    new MutationObserver(update).observe(game, { attributes: true, attributeFilter: ['data-playing', 'data-focused'] });
    // Re-align when intro button gets/loses --visible class
    new MutationObserver(alignWithBtn).observe(game, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }
}

// ---------------------------------------------------------------------------
// Theme Toggle — sun ↔ moon ↔ leaf with animation (light → dark → nature)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Weak device detection
// ---------------------------------------------------------------------------
function detectWeakDevice() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Weak device warning popup
// ---------------------------------------------------------------------------
function showWeakDevicePopup(checkbox, enableAnimations, TOGGLE_KEY) {
  var t = function (key) { return window.__siteT ? window.__siteT(key) : key; };

  var overlay = createElement('div', 'weak-popup-overlay');
  var popup = createElement('div', 'weak-popup');
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-label', t('weakWarningTitle'));

  // Warning icon
  var iconSvg = '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
    '<line x1="12" y1="9" x2="12" y2="13"/>' +
    '<line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

  var icon = createElement('div', 'weak-popup__icon');
  icon.innerHTML = iconSvg;

  var title = createElement('h3', 'weak-popup__title', t('weakWarningTitle'));
  var msg = createElement('p', 'weak-popup__msg', t('weakWarningMsg'));
  var lag = createElement('p', 'weak-popup__lag', t('weakWarningLag'));

  var actions = createElement('div', 'weak-popup__actions');

  var enableBtn = createElement('button', 'weak-popup__btn weak-popup__btn--enable', t('weakWarningCta'));
  var dismissBtn = createElement('button', 'weak-popup__btn weak-popup__btn--dismiss', t('weakWarningDismiss'));

  actions.appendChild(enableBtn);
  actions.appendChild(dismissBtn);

  // Lang toggle — top-right of popup, mirrors the navbar button
  var popupLangBtn = document.createElement('button');
  popupLangBtn.className = 'weak-popup__lang-toggle';
  popupLangBtn.setAttribute('aria-label', 'Switch language');
  popupLangBtn.innerHTML =
    '<svg class="lang-toggle__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<ellipse cx="12" cy="12" rx="4" ry="10"/>' +
      '<line x1="2" y1="12" x2="22" y2="12"/>' +
    '</svg>';
  var popupLangLabel = document.createElement('span');
  popupLangLabel.className = 'lang-toggle__label';
  popupLangLabel.textContent = siteLang === 'fr' ? 'FR' : 'EN';
  popupLangBtn.appendChild(popupLangLabel);

  popupLangBtn.addEventListener('click', function () {
    // Toggle language — same logic as the navbar button
    siteLang = siteLang === 'fr' ? 'en' : 'fr';
    localStorage.setItem(SITE_LANG_KEY, siteLang);
    document.documentElement.lang = siteLang;

    // Animate both labels (navbar + popup) in sync
    var navLabel = document.getElementById('lang-label');
    [navLabel, popupLangLabel].forEach(function (lbl) {
      if (!lbl) return;
      lbl.classList.add('lang-toggle__label--swapping');
      setTimeout(function () {
        lbl.textContent = siteLang === 'fr' ? 'FR' : 'EN';
        lbl.classList.remove('lang-toggle__label--swapping');
      }, 200);
    });

    // Refresh popup text to new language
    title.textContent = t('weakWarningTitle');
    msg.textContent = t('weakWarningMsg');
    lag.textContent = t('weakWarningLag');
    enableBtn.textContent = t('weakWarningCta');
    dismissBtn.textContent = t('weakWarningDismiss');

    // Update the rest of the site (nav, projects, skills…)
    updateSiteLanguage();
  });

  popup.appendChild(icon);
  popup.appendChild(title);
  popup.appendChild(msg);
  popup.appendChild(lag);
  popup.appendChild(actions);
  popup.appendChild(popupLangBtn);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Force reflow then animate in
  overlay.offsetHeight;
  overlay.classList.add('weak-popup-overlay--visible');
  var _weakTrapCleanup = trapFocus(overlay);
  dismissBtn.focus();

  function close() {
    if (_weakTrapCleanup) { _weakTrapCleanup(); _weakTrapCleanup = null; }
    overlay.classList.remove('weak-popup-overlay--visible');
    overlay.addEventListener('transitionend', function () { overlay.remove(); }, { once: true });
  }

  // Helper: finish flow and tell typing-game it can proceed
  function finishFlow() {
    window.__weakDeviceAnimFlowActive = false;
    document.dispatchEvent(new CustomEvent('weakDeviceAnimDone'));
  }

  dismissBtn.addEventListener('click', function () {
    close();
    // User chose not to enable → intro can start immediately
    finishFlow();
  });

  enableBtn.addEventListener('click', function () {
    close();
    // Scroll to footer first — user will watch the toggle flip
    var toggle = document.querySelector('.anim-toggle');
    if (toggle) {
      setTimeout(function () {
        toggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // After scroll lands: flip toggle visually + enable animations + highlight simultaneously
        setTimeout(function () {
          checkbox.checked = true;
          enableAnimations();
          localStorage.setItem(TOGGLE_KEY, 'on');
          if (window.__showAnimWarning) window.__showAnimWarning();
          // After highlight animation finishes (4.7s), auto-scroll back to top then finish flow
          setTimeout(function () {
            var hero = document.getElementById('hero');
            if (hero) {
              hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            // Wait for scroll to land then finish flow
            setTimeout(finishFlow, 1000);
          }, 4700);
        }, 1000);
      }, 350);
    } else {
      // Fallback: no toggle found, enable immediately
      checkbox.checked = true;
      enableAnimations();
      localStorage.setItem(TOGGLE_KEY, 'on');
      finishFlow();
    }
  });

  // Close on overlay click (outside popup) = same as dismiss
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      close();
      finishFlow();
    }
  });
}

// ---------------------------------------------------------------------------
// Animation Controls (footer bar: speed slider + on/off toggle)
// ---------------------------------------------------------------------------
var isMobileWidth = function () { return window.innerWidth <= 768; };

function initAnimationControls() {
  var SPEED_KEY  = 'portfolio_anim_speed';
  var TOGGLE_KEY = 'portfolio_animations';

  var footerContainer = document.querySelector('.footer > .container');
  var heroTitle = document.querySelector('.hero .section__title');
  if (!footerContainer || !heroTitle) return;

  // ── Create time-warp overlay (fullscreen tint layer) ──
  var twOverlay = createElement('div', 'time-warp-overlay');
  twOverlay.setAttribute('aria-hidden', 'true');
  var tintEl = document.querySelector('.bg-tint-overlay');
  if (tintEl) tintEl.after(twOverlay);
  else document.body.insertBefore(twOverlay, document.body.firstChild);

  // ── Speed section (replaces hero title underline) ──
  var speedWrap = createElement('div', 'hero__anim-speed');

  // Inner wrapper — tooltip + hover target scoped to this narrow area
  var speedInner = createElement('div', 'anim-speed__inner');

  // Custom tooltip (same style as typing-game / rain tooltips)
  var speedTip = createElement('div', 'anim-speed__tooltip');
  speedTip.textContent = siteT('animSpeedTooltip');
  speedInner.appendChild(speedTip);
  var speedTipTimer = null;
  speedInner.addEventListener('mouseenter', function () {
    clearTimeout(speedTipTimer);
    void speedTip.offsetWidth;
    speedTip.classList.add('anim-speed__tooltip--visible');
  });
  speedInner.addEventListener('mouseleave', function () {
    speedTip.classList.remove('anim-speed__tooltip--visible');
  });

  var clockBtn = createElement('button', 'anim-speed__icon');
  clockBtn.setAttribute('aria-label', siteT('animSpeed'));
  clockBtn.setAttribute('tabindex', '-1');
  clockBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<line class="anim-clock-hand" x1="12" y1="12" x2="12" y2="7"/>' +
      '<line class="anim-clock-hand--min" x1="12" y1="12" x2="15.5" y2="12"/>' +
    '</svg>';

  var slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'anim-speed__slider';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.05';
  slider.value = '1';
  slider.setAttribute('tabindex', '-1');

  var speedLabel = createElement('span', 'anim-speed__label', '1.00x');

  speedInner.appendChild(clockBtn);
  speedInner.appendChild(slider);
  speedInner.appendChild(speedLabel);
  speedWrap.appendChild(speedInner);

  // Insert speed slider right after hero title (or after .hero__title-row if rain wrapped it)
  var titleRow = heroTitle.closest('.hero__title-row');
  var insertAfter = titleRow || heroTitle;
  insertAfter.parentNode.insertBefore(speedWrap, insertAfter.nextSibling);

  // ── Footer controls (settings zone left + right zone) ──
  var controls = createElement('div', 'footer__anim-controls');

  // ── Left: Settings zone ──
  var settingsZone = createElement('div', 'footer__settings');

  // Title row: label + spinning gear icon
  var titleRow = createElement('div', 'footer__settings-title-row');
  var settingsTitle = createElement('span', 'footer__settings-title', siteT('settingsTitle'));
  var settingsGear = document.createElement('span');
  settingsGear.className = 'footer__settings-gear';
  settingsGear.setAttribute('aria-hidden', 'true');
  settingsGear.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
    '<\/svg>';
  titleRow.appendChild(settingsTitle);
  titleRow.appendChild(settingsGear);

  // Animation toggle — outer <label> makes entire row clickable (no nested <label>)
  var toggleWrap = document.createElement('label');
  toggleWrap.className = 'anim-toggle';

  var toggleLabel = createElement('span', 'anim-toggle__label', 'Animations');
  toggleLabel.setAttribute('data-i18n-title', 'animEnable');

  var switchSlot = createElement('span', 'anim-toggle__switch');
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = true;
  var track = createElement('span', 'anim-toggle__track');
  switchSlot.appendChild(checkbox);
  switchSlot.appendChild(track);

  toggleWrap.appendChild(toggleLabel);
  toggleWrap.appendChild(switchSlot);

  // Yolo mode toggle (placeholder — disabled for now, stays a div so it's not clickable)
  var yoloWrap = createElement('div', 'anim-toggle footer__yolo-toggle');

  var yoloLabel = createElement('span', 'anim-toggle__label', siteT('yoloMode'));

  var yoloSlot = createElement('span', 'anim-toggle__switch');
  var yoloCheckbox = document.createElement('input');
  yoloCheckbox.type = 'checkbox';
  yoloCheckbox.checked = false;
  yoloCheckbox.disabled = true;
  var yoloTrack = createElement('span', 'anim-toggle__track');
  yoloSlot.appendChild(yoloCheckbox);
  yoloSlot.appendChild(yoloTrack);

  yoloWrap.appendChild(yoloLabel);
  yoloWrap.appendChild(yoloSlot);

  // Row container for both toggles side-by-side
  var togglesRow = createElement('div', 'footer__settings-toggles');
  togglesRow.appendChild(toggleWrap);
  togglesRow.appendChild(yoloWrap);

  settingsZone.appendChild(titleRow);
  settingsZone.appendChild(togglesRow);
  controls.appendChild(settingsZone);

  // ── Center zone (move footer text + socials into the 3-column layout) ──
  var centerZone = createElement('div', 'footer__center');
  var footerPara = footerContainer.querySelector('p');
  var footerSocials = footerContainer.querySelector('.footer__socials');
  if (footerPara) centerZone.appendChild(footerPara);
  if (footerSocials) centerZone.appendChild(footerSocials);
  controls.appendChild(centerZone);

  // ── Right zone ──
  var rightZone = createElement('div', 'footer__right');
  controls.appendChild(rightZone);

  // Append controls — footer text + socials now live inside controls > center zone
  footerContainer.appendChild(controls);

  // Back-to-top button
  var backTop = document.createElement('a');
  backTop.href = '#hero';
  backTop.className = 'footer__back-top';
  backTop.title = siteT('backToTop');
  backTop.setAttribute('aria-label', siteT('backToTop'));
  backTop.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="18 15 12 9 6 15"/>' +
    '</svg>' +
    '<span>' + siteT('backToTop') + '</span>';
  backTop.addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('hero').scrollIntoView({ behavior: 'smooth' });
  });
  rightZone.appendChild(backTop);

  // "Mon Copilot" link — points to friend's portfolio
  var copilotLink = document.createElement('a');
  copilotLink.href = 'https://moksi.studio/';
  copilotLink.className = 'footer__copilot';
  copilotLink.target = '_blank';
  copilotLink.rel = 'noopener';
  copilotLink.setAttribute('aria-label', siteT('copilotLink'));
  copilotLink.innerHTML =
    '<img class="footer__copilot-favicon" src="assets/images/faviconMoksi.svg" alt="" width="18" height="18">' +
    '<span>' + siteT('copilotLink') + '</span>' +
    '<span class="footer__copilot-tooltip"></span>';
  copilotLink.querySelector('.footer__copilot-tooltip').textContent = siteT('copilotTooltip');
  // Hover events for custom tooltip
  copilotLink.addEventListener('mouseenter', function () {
    copilotLink.querySelector('.footer__copilot-tooltip').classList.add('footer__copilot-tooltip--visible');
  });
  copilotLink.addEventListener('mouseleave', function () {
    copilotLink.querySelector('.footer__copilot-tooltip').classList.remove('footer__copilot-tooltip--visible');
  });
  rightZone.appendChild(copilotLink);

  // ── Curve split ──
  // Non-linear (rain, grayscale/time-warp, clock): curved = raw^CURVE_EXP
  // Linear (music, visualizer particles, video backgrounds, label): linear = raw
  var CURVE_EXP = 2.5;
  function rawToCurved(raw) { return Math.pow(raw, CURVE_EXP); }

  // ── Music rate: offset so browser never hits its floor (min 0.15) ──
  function musicRate(linear) { return linear === 0 ? 0 : 0.15 + linear * 0.85; }

  // ── Speed slider fill ──
  function updateSliderFill() {
    var val = parseFloat(slider.value);
    var min = parseFloat(slider.min);
    var max = parseFloat(slider.max);
    var pct = ((val - min) / (max - min)) * 100;
    slider.style.background = 'linear-gradient(to right, var(--clr-primary) 0%, var(--clr-accent) ' + pct + '%, var(--clr-border) ' + pct + '%)';
  }

  // ── Music freeze: silently pause audio without changing player UI state ──
  var timeFrozen = false;

  // ── Apply speed to all systems ──
  function applySpeed(raw) {
    var linear = raw;          // music, particles, videos, label, clock
    var curved = rawToCurved(raw); // rain, time-warp (grayscale)

    speedLabel.textContent = linear.toFixed(2) + 'x';

    // Clock animation: linear + frozen visual
    if (raw === 0) {
      speedWrap.style.setProperty('--clock-speed', '0s');
      clockBtn.classList.add('anim-speed__icon--frozen');
    } else {
      speedWrap.style.setProperty('--clock-speed', (4 / linear) + 's');
      clockBtn.classList.remove('anim-speed__icon--frozen');
    }

    // Music freeze logic
    var audio = window.__musicPlayerAudio;
    if (raw === 0) {
      if (!timeFrozen) {
        timeFrozen = true;
        if (window.__musicPlayerSetFrozen) window.__musicPlayerSetFrozen(true);
        if (audio && !audio.paused) audio.pause();
      }
    } else {
      if (timeFrozen) {
        timeFrozen = false;
        if (window.__musicPlayerSetFrozen) window.__musicPlayerSetFrozen(false);
        var wantsPlay = window.__musicPlayerIsPlaying && window.__musicPlayerIsPlaying();
        if (wantsPlay) {
          // Use the full play() path so ensureAudioCtx() is called (creates the AudioContext
          // that the visualizer needs to connect to via tryConnect()).
          if (window.__musicPlayerPlay) window.__musicPlayerPlay();
          else if (audio && audio.paused) audio.play().catch(function(){});
        }
      }
      // Music rate: linear
      var rate = musicRate(linear);
      if (window.__setMusicPlaybackRate) window.__setMusicPlaybackRate(rate);
    }

    // Visualizer: freeze at 0, speed follows linear
    if (raw === 0) {
      if (window.__setVisualizerFrozen) window.__setVisualizerFrozen(true);
    } else {
      if (window.__setVisualizerFrozen) window.__setVisualizerFrozen(false);
    }
    if (window.__setVisualizerSpeed) window.__setVisualizerSpeed(linear);

    // Particles: linear
    if (window.__setParticlesSpeed) window.__setParticlesSpeed(linear);

    // Rain: non-linear
    if (window.__rainSetSpeed) window.__rainSetSpeed(curved);

    // Video backgrounds: linear
    var darkVid = document.getElementById('bg-video-dark');
    var natureVid = document.getElementById('bg-video-nature');
    if (raw === 0) {
      if (darkVid && !darkVid.paused) darkVid.pause();
      if (natureVid && !natureVid.paused) natureVid.pause();
    } else if (!isMobileWidth()) {
      if (darkVid) { darkVid.playbackRate = linear; if (darkVid.paused && document.documentElement.getAttribute('data-theme') === 'dark') darkVid.play().catch(function(){}); }
      if (natureVid) { natureVid.playbackRate = linear; if (natureVid.paused && document.documentElement.getAttribute('data-theme') === 'nature') natureVid.play().catch(function(){}); }
    }
  }

  // ── Global time-warp visual effect (uses curved value for non-linear grayscale) ──
  function applyTimeWarp(raw) {
    var curved = rawToCurved(raw);
    var root = document.documentElement;
    if (raw >= 1) {
      root.removeAttribute('data-time-warp');
      root.style.removeProperty('--tw-intensity');
      return;
    }
    // intensity: 0 at raw=1, 1 at raw=0 — uses curved for non-linear feel
    var intensity = (1 - curved).toFixed(3);
    root.style.setProperty('--tw-intensity', intensity);
    if (raw === 0) {
      root.setAttribute('data-time-warp', 'frozen');
    } else if (curved <= 0.3) {
      root.setAttribute('data-time-warp', 'heavy');
    } else {
      root.setAttribute('data-time-warp', 'slow');
    }
  }

  // Clock icon click: toggle time freeze (like volume mute toggle)
  var prevSpeed = 1;
  clockBtn.addEventListener('click', function () {
    var current = parseFloat(slider.value);
    if (current > 0) {
      // Freeze: store current speed, set to 0
      prevSpeed = current;
      slider.value = '0';
    } else {
      // Restore previous speed (default 1 if none stored)
      slider.value = String(prevSpeed || 1);
    }
    var raw = parseFloat(slider.value);
    applySpeed(raw);
    applyTimeWarp(raw);
    updateSliderFill();
    localStorage.setItem(SPEED_KEY, raw);
  });

  slider.addEventListener('input', function () {
    var raw = parseFloat(slider.value);
    applySpeed(raw);
    applyTimeWarp(raw);
    updateSliderFill();
    localStorage.setItem(SPEED_KEY, raw);
  });

  // ── Rain state before disable ──
  var rainWasActive = false;

  // ── Toggle animations on/off ──
  function disableAnimations() {
    // Remember rain state before killing it
    rainWasActive = !!(window.__rainIsEnabled && window.__rainIsEnabled());
    document.documentElement.setAttribute('data-animations', 'off');
    if (window.__setVisualizerFrozen) window.__setVisualizerFrozen(false);
    if (window.__rainSetEnabled) window.__rainSetEnabled(false);
    if (window.__setVisualizerEnabled) window.__setVisualizerEnabled(false);
    if (window.__setParticlesSpeed) window.__setParticlesSpeed(0);
    // Reset music to normal speed and clear freeze
    timeFrozen = false;
    if (window.__musicPlayerSetFrozen) window.__musicPlayerSetFrozen(false);
    if (window.__setMusicPlaybackRate) window.__setMusicPlaybackRate(1);
    // Resume audio if player thinks it's playing (unfreezing may have left it paused)
    var audio = window.__musicPlayerAudio;
    if (audio && audio.paused && window.__musicPlayerIsPlaying && window.__musicPlayerIsPlaying()) {
      audio.play().catch(function(){});
    }
    // Pause current theme video
    var darkVid = document.getElementById('bg-video-dark');
    var natureVid = document.getElementById('bg-video-nature');
    if (darkVid) darkVid.pause();
    if (natureVid) natureVid.pause();
    // Gray out speed slider
    slider.disabled = true;
    speedWrap.classList.add('anim-speed--disabled');
    // Remove time-warp effect
    document.documentElement.removeAttribute('data-time-warp');
    document.documentElement.style.removeProperty('--tw-intensity');
  }

  function enableAnimations() {
    document.documentElement.removeAttribute('data-animations');
    // Restore rain if it was active before disabling
    if (rainWasActive) {
      if (window.__rainSetEnabled) window.__rainSetEnabled(true);
      var rainBtn = document.querySelector('.rain-toggle');
      if (rainBtn && !rainBtn.classList.contains('rain-toggle--active')) {
        rainBtn.click();
      }
    } else {
      if (window.__rainSetEnabled) window.__rainSetEnabled(true);
    }
    if (window.__setVisualizerEnabled) window.__setVisualizerEnabled(true);
    // Resume video for current theme
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    var darkVid = document.getElementById('bg-video-dark');
    var natureVid = document.getElementById('bg-video-nature');
    if (!isMobileWidth()) {
      if (darkVid && theme === 'dark') darkVid.play().catch(function(){});
      if (natureVid && theme === 'nature') natureVid.play().catch(function(){});
    }
    // Re-enable speed slider and re-apply stored speed (handles freeze if 0)
    slider.disabled = false;
    speedWrap.classList.remove('anim-speed--disabled');
    var storedSpeed = parseFloat(localStorage.getItem(SPEED_KEY));
    if (!isNaN(storedSpeed) && storedSpeed >= 0 && storedSpeed <= 1) {
      var rawVal = storedSpeed;
      slider.value = rawVal;
      applySpeed(rawVal);
      updateSliderFill();
      applyTimeWarp(rawVal);
    }
  }

  // ── Track first-time enable on weak device for lag toast ──
  var weakLagToastShown = false;

  function showLagToast() {
    if (weakLagToastShown) return;
    weakLagToastShown = true;
    var toast = createElement('div', 'lag-toast', siteT('weakLagToast'));
    document.body.appendChild(toast);
    toast.offsetHeight;
    toast.classList.add('lag-toast--visible');
    setTimeout(function () {
      toast.classList.remove('lag-toast--visible');
      setTimeout(function () { toast.remove(); }, 400);
    }, 3500);
  }

  function highlightToggle() {
    var toggleEl = document.querySelector('.anim-toggle');
    if (!toggleEl) return;
    toggleEl.classList.remove('anim-toggle--highlight');
    // Force reflow so re-triggering restarts animation
    void toggleEl.offsetWidth;
    toggleEl.classList.add('anim-toggle--highlight');
    setTimeout(function () { toggleEl.classList.remove('anim-toggle--highlight'); }, 4700);
  }

  // Combined: highlight toggle + show lag toast (used from popup and from checkbox change)
  function showAnimWarning() {
    highlightToggle();
    showLagToast();
  }
  // Expose so showWeakDevicePopup (defined outside initAnimationControls) can call it
  window.__showAnimWarning = showAnimWarning;

  checkbox.addEventListener('change', function () {
    if (checkbox.checked) {
      enableAnimations();
      localStorage.setItem(TOGGLE_KEY, 'on');
      // Show lag toast on first enable if weak device (no highlight in this case)
      if (window.__weakDeviceDetected) showLagToast();
    } else {
      disableAnimations();
      localStorage.setItem(TOGGLE_KEY, 'off');
    }
    updateToggleTooltip();
  });

  // ── Tooltip on toggle label ──
  function updateToggleTooltip() {
    toggleLabel.title = checkbox.checked ? siteT('animDisable') : siteT('animEnable');
  }

  // ── i18n update helper (called on language change) ──
  function updateAnimI18n() {
    clockBtn.setAttribute('aria-label', siteT('animSpeed'));
    speedTip.textContent = siteT('animSpeedTooltip');
    backTop.title = siteT('backToTop');
    backTop.setAttribute('aria-label', siteT('backToTop'));
    backTop.querySelector('span').textContent = siteT('backToTop');
    settingsTitle.textContent = siteT('settingsTitle');
    yoloLabel.textContent = siteT('yoloMode');
    copilotLink.setAttribute('aria-label', siteT('copilotLink'));
    copilotLink.querySelector('span').textContent = siteT('copilotLink');
    copilotLink.querySelector('.footer__copilot-tooltip').textContent = siteT('copilotTooltip');
    updateToggleTooltip();
  }
  document.addEventListener('sitelangchange', updateAnimI18n);

  // ── Restore state on load ──
  var savedToggle = localStorage.getItem(TOGGLE_KEY);
  var savedSpeed  = localStorage.getItem(SPEED_KEY);

  // Speed
  if (savedSpeed) {
    var spd = parseFloat(savedSpeed);
    if (!isNaN(spd) && spd >= 0 && spd <= 1) {
      slider.value = spd;
      applySpeed(spd);
      applyTimeWarp(spd);
    }
  }
  updateSliderFill();

  // Toggle: if user never toggled, auto-detect weak device
  if (savedToggle === 'off') {
    checkbox.checked = false;
    disableAnimations();
  } else if (savedToggle === 'on') {
    // User explicitly enabled — keep on
  } else if (detectWeakDevice()) {
    window.__weakDeviceDetected = true;
    window.__weakDeviceAnimFlowActive = true;
    checkbox.checked = false;
    disableAnimations();
    // Show warning popup after a short delay so DOM is ready
    setTimeout(function () { showWeakDevicePopup(checkbox, enableAnimations, TOGGLE_KEY); }, 600);
  }
  updateToggleTooltip();
}

function initThemeToggle() {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  var root = document.documentElement;
  var STORAGE_KEY = 'portfolio_theme';
  var svgBody = btn.querySelector('.theme-toggle__body');
  var svgCutout = btn.querySelector('.theme-toggle__cutout');

  // Cycle order: light → dark → nature → light
  var THEMES = ['light', 'dark', 'nature'];
  var THEME_TIP_KEYS = { light: 'themeToDark', dark: 'themeToNature', nature: 'themeToLight' };
  // Preview image for the *next* theme (what clicking will reveal)
  var THEME_PREVIEWS = {
    light:  'assets/images/backgroundKatanaPoster.jpg',
    dark:   'assets/images/hollowbackgroundPoster.jpg',
    nature: 'assets/images/background.jpg'
  };

  // Custom tooltip (positioned below, same style as lang toggle)
  var themeTip = document.createElement('div');
  themeTip.className = 'theme-toggle__tooltip';
  var tipLabelEl = document.createElement('span');
  tipLabelEl.className = 'theme-toggle__tooltip-label';
  var tipPreviewEl = document.createElement('img');
  tipPreviewEl.className = 'theme-toggle__tooltip-preview';
  tipPreviewEl.setAttribute('alt', '');
  tipPreviewEl.setAttribute('aria-hidden', 'true');
  themeTip.appendChild(tipLabelEl);
  themeTip.appendChild(tipPreviewEl);
  btn.appendChild(themeTip);
  var themeTipTimer = null;

  function getThemeTipText() {
    var cur = root.getAttribute('data-theme') || 'light';
    return siteT(THEME_TIP_KEYS[cur] || 'themeToDark');
  }

  btn.addEventListener('mouseenter', function () {
    clearTimeout(themeTipTimer);
    var cur = root.getAttribute('data-theme') || 'light';
    tipLabelEl.textContent = getThemeTipText();
    tipPreviewEl.src = THEME_PREVIEWS[cur] || THEME_PREVIEWS.light;
    void themeTip.offsetWidth;
    themeTip.classList.add('theme-toggle__tooltip--visible');
  });
  btn.addEventListener('mouseleave', function () {
    themeTip.classList.remove('theme-toggle__tooltip--visible');
    themeTipTimer = setTimeout(function () {}, 200);
  });

  // Directly set SVG attributes as fallback for browsers that don't
  // support CSS geometry properties (r, cx, cy) on SVG elements.
  function setIconAttrs(theme) {
    if (!svgBody || !svgCutout) return;
    if (theme === 'dark') {
      svgBody.setAttribute('r', '8');
      svgCutout.setAttribute('r', '7');
      svgCutout.setAttribute('cx', '17');
      svgCutout.setAttribute('cy', '7');
    } else if (theme === 'nature') {
      svgBody.setAttribute('r', '0');
      svgCutout.setAttribute('r', '0');
      svgCutout.setAttribute('cx', '18');
      svgCutout.setAttribute('cy', '6');
    } else {
      // light
      svgBody.setAttribute('r', '5');
      svgCutout.setAttribute('r', '0');
      svgCutout.setAttribute('cx', '18');
      svgCutout.setAttribute('cy', '6');
    }
  }

  // Update favicon based on theme
  var FAVICONS = { light: 'assets/images/favicon.svg', dark: 'assets/images/favicon-dark.svg', nature: 'assets/images/favicon-nature.svg' };
  function updateFavicon(theme) {
    var link = document.querySelector('link[rel="icon"]');
    if (link) link.href = FAVICONS[theme] || FAVICONS.light;
  }

  // Manage video playback based on theme
  // On mobile (<=768px), skip video entirely — CSS shows poster via body::before
  function manageVideos(theme) {
    var darkVideo = document.getElementById('bg-video-dark');
    var natureVideo = document.getElementById('bg-video-nature');
    if (isMobileWidth()) {
      if (darkVideo) darkVideo.pause();
      if (natureVideo) natureVideo.pause();
      return;
    }
    if (darkVideo) {
      if (theme === 'dark') { darkVideo.play().catch(function(){}); }
      else { darkVideo.pause(); }
    }
    if (natureVideo) {
      if (theme === 'nature') { natureVideo.play().catch(function(){}); }
      else { natureVideo.pause(); }
    }
  }

  /* ---- Background credit badge ---- */
  var BG_CREDITS = {
    dark:   { label: 'Wallpaper', title: 'Katana Zero',               author: 'Devolver Digital' },
    nature: { label: 'Wallpaper', title: 'Hollow Knight: Endless Dream', author: 'DOR & Team Cherry' }
  };

  var creditEl = document.createElement('div');
  creditEl.className = 'bg-credit';
  creditEl.innerHTML =
    '<span class="bg-credit__label"></span>' +
    '<span class="bg-credit__title"></span>' +
    '<span class="bg-credit__author"></span>';
  document.body.appendChild(creditEl);

  var creditHideTimer = null;

  function showCredit(theme) {
    clearTimeout(creditHideTimer);
    var data = BG_CREDITS[theme];
    if (!data) { hideCredit(true); return; }

    // Update content
    creditEl.querySelector('.bg-credit__label').textContent  = data.label;
    creditEl.querySelector('.bg-credit__title').textContent  = data.title;
    creditEl.querySelector('.bg-credit__author').textContent = data.author;

    // Force reset so transition replays when switching between themes
    creditEl.classList.remove('bg-credit--visible', 'bg-credit--hiding');
    void creditEl.offsetWidth; // reflow
    creditEl.classList.add('bg-credit--visible');

    // Auto-dismiss after 3 s
    creditHideTimer = setTimeout(function () { hideCredit(false); }, 3000);
  }

  function hideCredit(immediate) {
    clearTimeout(creditHideTimer);
    if (immediate) {
      creditEl.classList.remove('bg-credit--visible', 'bg-credit--hiding');
      return;
    }
    creditEl.classList.remove('bg-credit--visible');
    creditEl.classList.add('bg-credit--hiding');
    var t = setTimeout(function () { creditEl.classList.remove('bg-credit--hiding'); }, 500);
    creditHideTimer = t;
  }

  // Restore saved theme
  var saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark' || saved === 'nature') {
    root.setAttribute('data-theme', saved);
    setIconAttrs(saved);
    manageVideos(saved);
    updateFavicon(saved);
  } else {
    manageVideos('light');
  }

  btn.addEventListener('click', function () {
    themeTip.classList.remove('theme-toggle__tooltip--visible');
    var current = root.getAttribute('data-theme') || 'light';
    var idx = THEMES.indexOf(current);
    var next = THEMES[(idx + 1) % THEMES.length];

    if (next === 'light') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', next);
    }
    localStorage.setItem(STORAGE_KEY, next);
    manageVideos(next);
    updateFavicon(next);

    // If animations are disabled, pause the newly activated video immediately
    if (document.documentElement.getAttribute('data-animations') === 'off') {
      var darkVid = document.getElementById('bg-video-dark');
      var natureVid = document.getElementById('bg-video-nature');
      if (darkVid) darkVid.pause();
      if (natureVid) natureVid.pause();
    } else {
      // Apply stored speed to the new video
      var storedSpeed = parseFloat(localStorage.getItem('portfolio_anim_speed'));
      if (!isNaN(storedSpeed) && storedSpeed > 0 && storedSpeed <= 1) {
        var darkVid2 = document.getElementById('bg-video-dark');
        var natureVid2 = document.getElementById('bg-video-nature');
        if (darkVid2) darkVid2.playbackRate = storedSpeed;
        if (natureVid2) natureVid2.playbackRate = storedSpeed;
      } else if (storedSpeed === 0) {
        // Time frozen — keep new videos paused
        var darkVid3 = document.getElementById('bg-video-dark');
        var natureVid3 = document.getElementById('bg-video-nature');
        if (darkVid3) darkVid3.pause();
        if (natureVid3) natureVid3.pause();
      }
    }

    // Show / hide credit badge
    if (next === 'dark' || next === 'nature') {
      showCredit(next);
    } else {
      hideCredit(false);
    }

    // Set attrs after CSS transition completes (backup)
    setTimeout(function () { setIconAttrs(next); }, 550);
  });
}


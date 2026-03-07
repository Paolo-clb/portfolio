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

function openProjectsModal() {
  // Always recreate to pick up language changes
  createProjectsModal();
  let overlay = document.getElementById('projects-modal');
  // Force reflow for transition
  void overlay.offsetWidth;
  overlay.classList.add('modal-overlay--open');
  document.body.style.overflow = 'hidden';
  // Scroll hint (first visit only)
  var modal = overlay.querySelector('.modal');
  if (modal) createScrollHint(modal, 'modal_projects_hint_seen');
}

function closeProjectsModal() {
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

  // Scroll hint (first visit only)
  createScrollHint(modal, 'modal_detail_hint_seen');

  // Close handlers
  closeBtn.addEventListener('click', () => closeProjectDetail());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeProjectDetail();
  });

  // Escape key — close detail first, then projects modal
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeProjectDetail();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

function closeProjectDetail() {
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
    if (index >= VISIBLE_COUNT) {
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
    var btn = createElement('button', 'btn btn--outline', siteT('viewAllSkills'));
    var expanded = false;

    btn.addEventListener('click', function () {
      var hiddenGroups = grid.querySelectorAll('.skills-group--hidden');
      var allGroups = grid.querySelectorAll('.skills-group');

      if (!expanded) {
        // Expand
        hiddenGroups.forEach(function (g) {
          g.classList.remove('skills-group--hidden');
          g.classList.add('skills-group--revealing');
          // Trigger reflow for animation
          void g.offsetWidth;
          g.classList.add('skills-group--visible');
        });
        btn.textContent = siteT('viewLess');
        expanded = true;
      } else {
        // Collapse
        var toCollapse = [];
        allGroups.forEach(function (g, i) {
          if (i >= VISIBLE_COUNT) toCollapse.push(g);
        });
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
          }
          g.addEventListener('transitionend', onEnd);
          setTimeout(onEnd, 500);
        });
        btn.textContent = siteT('viewAllSkills');
        expanded = false;
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

  // Close handlers
  closeBtn.addEventListener('click', closeSkillPopup);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeSkillPopup();
  });
  var escHandler = function (e) {
    if (e.key === 'Escape') {
      closeSkillPopup();
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

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
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
}

function initLangToggle() {
  var btn = document.getElementById('lang-toggle');
  var label = document.getElementById('lang-label');
  if (!btn || !label) return;

  // Set initial label
  label.textContent = siteLang === 'fr' ? 'FR' : 'EN';

  btn.addEventListener('click', function () {
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
  initCursorHalo();
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
  var interactiveSelector = 'a, button, input, textarea, select, [role="button"], .project-card, .skill-item, .nav__link, .btn, .typing-game__text, .music-player__playlist-item, .music-player__volume-icon, .typing-game__ai-opt, .typing-game__settings-option, .zen-popup-overlay, .modal-overlay';
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
             node.classList.contains('skill-overlay'))) {
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
  }

  window.addEventListener('scroll', update, { passive: true });
  // Re-evaluate when typing game focus/play state changes
  if (game) {
    new MutationObserver(update).observe(game, { attributes: true, attributeFilter: ['data-playing', 'data-focused'] });
  }
}

// ---------------------------------------------------------------------------
// Theme Toggle — sun ↔ moon ↔ leaf with animation (light → dark → nature)
// ---------------------------------------------------------------------------
function initThemeToggle() {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  var root = document.documentElement;
  var STORAGE_KEY = 'portfolio_theme';
  var svgBody = btn.querySelector('.theme-toggle__body');
  var svgCutout = btn.querySelector('.theme-toggle__cutout');

  // Cycle order: light → dark → nature → light
  var THEMES = ['light', 'dark', 'nature'];

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
  function manageVideos(theme) {
    var darkVideo = document.getElementById('bg-video-dark');
    var natureVideo = document.getElementById('bg-video-nature');
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


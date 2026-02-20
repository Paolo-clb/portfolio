/**
 * main.js — DOM interactions and dynamic rendering.
 *
 * Depends on js/data.js being loaded first (PROJECTS, SKILLS globals).
 * No external libraries — vanilla JS only.
 */

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
  img.alt = project.title;
  img.loading = 'lazy';
  imgWrap.appendChild(img);

  // Body
  const body = createElement('div', 'project-card__body');
  body.appendChild(createElement('h3', 'project-card__title', project.title));
  body.appendChild(createElement('p', 'project-card__desc', project.description));

  // Tags
  const tags = createElement('div', 'project-card__tags');
  project.tags.forEach((t) => tags.appendChild(createElement('span', 'tag', t)));
  body.appendChild(tags);

  // Links
  const links = createElement('div', 'project-card__links');
  const demo = createElement('a', null, 'Live Demo');
  demo.href = project.demo;
  demo.target = '_blank';
  demo.rel = 'noopener';
  const repo = createElement('a', null, 'Source');
  repo.href = project.repo;
  repo.target = '_blank';
  repo.rel = 'noopener';
  links.appendChild(demo);
  links.appendChild(repo);
  body.appendChild(links);

  card.appendChild(imgWrap);
  card.appendChild(body);

  // "En savoir plus" hover hint
  const hint = createElement('span', 'project-card__hint', 'En savoir plus');
  card.appendChild(hint);

  return card;
}

// ---------------------------------------------------------------------------
// Render first 3 project cards into #projects-grid + "See all" button
// ---------------------------------------------------------------------------
function renderProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

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
    const btn = createElement('button', 'btn btn--outline', 'Voir tous les projets');
    btn.addEventListener('click', openProjectsModal);
    actions.appendChild(btn);
    wrapper.appendChild(actions);
  }
}

// ---------------------------------------------------------------------------
// Projects modal
// ---------------------------------------------------------------------------
function createProjectsModal() {
  const overlay = createElement('div', 'modal-overlay');
  overlay.id = 'projects-modal';

  const modal = createElement('div', 'modal');

  // Mobile-only sticky close button (direct child of scroll container)
  const stickyClose = createElement('button', 'modal__close modal__close--sticky', '\u00D7');
  stickyClose.setAttribute('aria-label', 'Fermer');
  stickyClose.addEventListener('click', closeProjectsModal);
  modal.appendChild(stickyClose);

  // Header
  const header = createElement('div', 'modal__header');
  header.appendChild(createElement('h2', 'modal__title', 'Tous les projets'));
  const closeBtn = createElement('button', 'modal__close', '\u00D7');
  closeBtn.setAttribute('aria-label', 'Fermer');
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

function openProjectsModal() {
  let overlay = document.getElementById('projects-modal');
  if (!overlay) {
    createProjectsModal();
    overlay = document.getElementById('projects-modal');
  }
  // Force reflow for transition
  void overlay.offsetWidth;
  overlay.classList.add('modal-overlay--open');
  document.body.style.overflow = 'hidden';
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
  closeBtn.setAttribute('aria-label', 'Fermer');
  modal.appendChild(closeBtn);

  // Hero image
  const imgWrap = createElement('div', 'detail-modal__image');
  const img = document.createElement('img');
  img.src = project.image;
  img.alt = project.title;
  imgWrap.appendChild(img);
  modal.appendChild(imgWrap);

  // Content
  const content = createElement('div', 'detail-modal__content');

  // Title + tags
  content.appendChild(createElement('h2', 'detail-modal__title', project.title));
  const tags = createElement('div', 'project-card__tags');
  project.tags.forEach((t) => tags.appendChild(createElement('span', 'tag', t)));
  content.appendChild(tags);

  // Overview / Description
  if (project.details && project.details.overview) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', 'Description'));
    const descP = createElement('p', 'detail-modal__text');
    descP.innerHTML = project.details.overview;
    content.appendChild(descP);
  }

  // Competences (nested lists)
  if (project.details && project.details.competences) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', 'Compétences mobilisées'));
    project.details.competences.forEach((comp) => {
      content.appendChild(createElement('h4', 'detail-modal__comp-title', comp.title));
      const ul = createElement('ul', 'detail-modal__list');
      comp.items.forEach((item) => ul.appendChild(createElement('li', null, item)));
      content.appendChild(ul);
    });
  }

  // Objectifs
  if (project.details && project.details.objectifs) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', 'Objectifs'));
    const objP = createElement('p', 'detail-modal__text');
    objP.innerHTML = project.details.objectifs;
    content.appendChild(objP);
  }

  // Equipe
  if (project.details && project.details.equipe) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', 'Travail en groupe'));
    const eqP = createElement('p', 'detail-modal__text');
    eqP.innerHTML = project.details.equipe.replace(/\n/g, '<br>');
    content.appendChild(eqP);
  }

  // Travail individuel
  if (project.details && project.details.travailIndividuel) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', 'Travail individuel'));
    const tiP = createElement('p', 'detail-modal__text');
    tiP.innerHTML = project.details.travailIndividuel;
    content.appendChild(tiP);
  }

  // Tech details / Savoir-faire (array → list, string → paragraph)
  if (project.details && project.details.techDetails) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', 'Techniques et savoir-faire acquis'));
    if (Array.isArray(project.details.techDetails)) {
      const ul = createElement('ul', 'detail-modal__list');
      project.details.techDetails.forEach((t) => ul.appendChild(createElement('li', null, t)));
      content.appendChild(ul);
    } else {
      content.appendChild(createElement('p', 'detail-modal__text', project.details.techDetails));
    }
  }

  // Challenges
  if (project.details && project.details.challenges) {
    content.appendChild(createElement('h3', 'detail-modal__subtitle', 'Défis rencontrés'));
    const chP = createElement('p', 'detail-modal__text');
    chP.innerHTML = project.details.challenges;
    content.appendChild(chP);
  }

  // Links
  const links = createElement('div', 'detail-modal__links');
  if (project.demo && project.demo !== '#') {
    const demo = createElement('a', 'btn btn--primary', 'Live Demo');
    demo.href = project.demo;
    demo.target = '_blank';
    demo.rel = 'noopener';
    links.appendChild(demo);
  }
  if (project.repo && project.repo !== '#') {
    const repo = createElement('a', 'btn btn--outline', 'Code source');
    repo.href = project.repo;
    repo.target = '_blank';
    repo.rel = 'noopener';
    links.appendChild(repo);
  }
  if (links.children.length) content.appendChild(links);

  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Open with transition
  void overlay.offsetWidth;
  overlay.classList.add('modal-overlay--open');
  document.body.style.overflow = 'hidden';

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

  var VISIBLE_COUNT = 2;

  SKILL_GROUPS.forEach(function (group, index) {
    var section = createElement('div', 'skills-group');
    if (index >= VISIBLE_COUNT) {
      section.classList.add('skills-group--hidden');
    }

    section.appendChild(createElement('h3', 'skills-group__label', group.label));

    var row = createElement('div', 'skills-group__items');
    group.skills.forEach(function (skill) {
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
        openSkillPopup(skill);
      });

      row.appendChild(item);
    });

    section.appendChild(row);
    grid.appendChild(section);
  });

  // Toggle button (same style as "Voir tous les projets")
  if (SKILL_GROUPS.length > VISIBLE_COUNT) {
    var wrapper = grid.parentElement;
    var actions = createElement('div', 'skills__actions');
    var btn = createElement('button', 'btn btn--outline', 'Voir toutes les compétences');
    var expanded = false;

    btn.addEventListener('click', function () {
      var hiddenGroups = grid.querySelectorAll('.skills-group--hidden');
      var allGroups = grid.querySelectorAll('.skills-group');

      if (!expanded) {
        // Expand
        hiddenGroups.forEach(function (g) {
          g.classList.add('skills-group--revealing');
          g.classList.remove('skills-group--hidden');
          // Trigger reflow for animation
          void g.offsetWidth;
          g.classList.add('skills-group--visible');
        });
        btn.textContent = 'Voir moins';
        expanded = true;
      } else {
        // Collapse
        allGroups.forEach(function (g, i) {
          if (i >= VISIBLE_COUNT) {
            g.classList.remove('skills-group--visible');
            g.classList.remove('skills-group--revealing');
            g.classList.add('skills-group--hidden');
          }
        });
        btn.textContent = 'Voir toutes les compétences';
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
function openSkillPopup(skill) {
  // Remove any existing popup
  var existing = document.getElementById('skill-popup');
  if (existing) existing.remove();

  var overlay = createElement('div', 'modal-overlay skill-overlay');
  overlay.id = 'skill-popup';

  var popup = createElement('div', 'skill-popup');

  // Close button
  var closeBtn = createElement('button', 'modal__close skill-popup__close', '\u00D7');
  closeBtn.setAttribute('aria-label', 'Fermer');
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
  if (skill.description) {
    popup.appendChild(createElement('p', 'skill-popup__desc', skill.description));
  }

  // Level bar
  if (skill.level) {
    var levelWrap = createElement('div', 'skill-popup__level');
    var labelRow = createElement('div', 'skill-popup__level-header');
    labelRow.appendChild(createElement('span', 'skill-popup__level-label', 'Niveau'));
    var levelLabels = ['', 'D\u00e9butant', 'Junior', 'Interm\u00e9diaire', 'Avanc\u00e9', 'Expert'];
    labelRow.appendChild(createElement('span', 'skill-popup__level-text', levelLabels[skill.level] || ''));
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

  // Close menu when a link is clicked
  navList.querySelectorAll('.nav__link').forEach((link) => {
    link.addEventListener('click', () => {
      navList.classList.remove('nav__list--open');
      toggle.classList.remove('nav__toggle--active');
    });
  });
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
    var scrollY = window.scrollY + 100;
    var activeLink = null;
    sections.forEach(function (section) {
      var top = section.offsetTop;
      var height = section.offsetHeight;
      var id = section.getAttribute('id');
      var link = document.querySelector('.nav__link[href="#' + id + '"]');
      if (link) {
        var isActive = scrollY >= top && scrollY < top + height;
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
      statusEl.textContent = 'Message envoyé avec succès !';
      statusEl.classList.add('form__status--success');
      statusEl.style.display = 'block';
      form.reset();
      return;
    }

    // --- Timing check (submitted too fast = likely bot) ---
    if (Date.now() - _formLoadedAt < 3000) {
      statusEl.textContent = 'Veuillez patienter avant d\'envoyer.';
      statusEl.classList.add('form__status--error');
      statusEl.style.display = 'block';
      return;
    }

    // --- Cooldown check (60 seconds between sends) ---
    const now = Date.now();
    if (now < _formCooldownUntil) {
      const secsLeft = Math.ceil((_formCooldownUntil - now) / 1000);
      statusEl.textContent = `Veuillez attendre ${secsLeft}s avant de renvoyer.`;
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
    btn.textContent = 'Envoi en cours...';
    btn.disabled = true;

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        statusEl.textContent = 'Message envoyé avec succès !';
        statusEl.classList.add('form__status--success');
        statusEl.style.display = 'block';
        form.reset();
        _formCooldownUntil = Date.now() + 60000;
        startCooldownTimer(btn, originalText);
        return;
      } else {
        statusEl.textContent = "Erreur lors de l'envoi. Réessayez plus tard.";
        statusEl.classList.add('form__status--error');
        statusEl.style.display = 'block';
      }
    } catch {
      statusEl.textContent = 'Erreur réseau. Vérifiez votre connexion.';
      statusEl.classList.add('form__status--error');
      statusEl.style.display = 'block';
    } finally {
      if (!btn.dataset.cooldown) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }
  });
}

function startCooldownTimer(btn, originalText) {
  btn.dataset.cooldown = '1';
  const tick = () => {
    const secsLeft = Math.ceil((_formCooldownUntil - Date.now()) / 1000);
    if (secsLeft <= 0) {
      btn.textContent = originalText;
      btn.disabled = false;
      delete btn.dataset.cooldown;
      return;
    }
    btn.textContent = `Patienter ${secsLeft}s`;
    btn.disabled = true;
    setTimeout(tick, 500);
  };
  tick();
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
  renderProjects();
  renderSkills();
  initNavToggle();
  initScrollSpy();
  initContactForm();
  setFooterYear();
  initScrollHint();
  initCvModal();
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
  var interactiveSelector = 'a, button, input, textarea, select, [role="button"], .project-card, .skill-item, .nav__link, .btn, .typing-game__text, .music-player__playlist-item, .music-player__volume-icon';
  var modalAllowedSelector = 'button, .modal__close, a, .btn';

  document.addEventListener('mouseover', function (e) {
    var inDetailModal = e.target.closest('.detail-modal');
    if (inDetailModal) {
      if (e.target.closest(modalAllowedSelector)) {
        halo.classList.add('cursor-halo--hover');
      }
      return;
    }
    if (e.target.closest('.cv-modal__viewer')) {
      targetOpacity = 0;
      ensureRunning();
      return;
    }
    if (e.target.closest(interactiveSelector)) {
      halo.classList.add('cursor-halo--hover');
    }
  }, { passive: true });

  document.addEventListener('mouseout', function (e) {
    if (e.target.closest(interactiveSelector) || e.target.closest(modalAllowedSelector)) {
      halo.classList.remove('cursor-halo--hover');
    }
    if (e.target.closest('.cv-modal__viewer')) {
      targetOpacity = 1;
      ensureRunning();
    }
  }, { passive: true });

  // ---- click feedback ----
  document.addEventListener('mousedown', function () {
    halo.classList.add('cursor-halo--click');
  });
  document.addEventListener('mouseup', function () {
    halo.classList.remove('cursor-halo--click');
  });

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
  let hidden = false;
  window.addEventListener('scroll', () => {
    if (!hidden && window.scrollY > 80) {
      hint.classList.add('scroll-hint--hidden');
      hidden = true;
    } else if (hidden && window.scrollY <= 80) {
      // Don't re-show scroll-hint if the typing game is focused
      const game = document.getElementById('typing-game');
      if (game && game.classList.contains('typing-game--focused')) return;
      hint.classList.remove('scroll-hint--hidden');
      hidden = false;
    }
  }, { passive: true });
}

// ---------------------------------------------------------------------------
// CV Modal
// ---------------------------------------------------------------------------
function createCvModal() {
  var overlay = createElement('div', 'modal-overlay');
  overlay.id = 'cv-modal';

  var modal = createElement('div', 'modal cv-modal');

  // Header
  var header = createElement('div', 'cv-modal__header');
  header.appendChild(createElement('h2', 'cv-modal__title', 'Curriculum Vitae'));
  var closeBtn = createElement('button', 'modal__close', '\u00D7');
  closeBtn.setAttribute('aria-label', 'Fermer');
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // PDF viewer
  var viewer = createElement('div', 'cv-modal__viewer');
  var iframe = document.createElement('iframe');
  iframe.src = 'assets/doc/CV_Paolo.pdf';
  iframe.title = 'CV Paolo';
  viewer.appendChild(iframe);
  modal.appendChild(viewer);

  // Footer with download button
  var footer = createElement('div', 'cv-modal__footer');
  var dlBtn = document.createElement('a');
  dlBtn.href = 'assets/doc/CV_Paolo.pdf';
  dlBtn.download = 'CV_Paolo.pdf';
  dlBtn.className = 'btn btn--primary';
  dlBtn.textContent = 'T\u00e9l\u00e9charger le CV';
  footer.appendChild(dlBtn);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  closeBtn.addEventListener('click', closeCvModal);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeCvModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeCvModal();
  });
}

function openCvModal() {
  var overlay = document.getElementById('cv-modal');
  if (!overlay) {
    createCvModal();
    overlay = document.getElementById('cv-modal');
  }
  void overlay.offsetWidth;
  overlay.classList.add('modal-overlay--open');
  document.body.style.overflow = 'hidden';
}

function closeCvModal() {
  var overlay = document.getElementById('cv-modal');
  if (!overlay) return;
  overlay.classList.remove('modal-overlay--open');
  document.body.style.overflow = '';
}

function initCvModal() {
  var link = document.getElementById('cv-link');
  if (!link) return;
  link.addEventListener('click', function (e) {
    e.preventDefault();
    openCvModal();
  });
}

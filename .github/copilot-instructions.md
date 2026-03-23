# Copilot Instructions — Portfolio

## Architecture

Static single-page portfolio — no build tools, no frameworks, no bundler. Hosted on GitHub Pages.

```
index.html              ← Single entry point; all sections live here
css/styles.css          ← Core styles (~1300 lines) — variables, reset, layout, header, nav, buttons, hero, contact, footer, CV, cursor halo, theme toggle, animation controls, time-warp, weak device popup, scroll progress, scroll reveal, hover particles canvas, dark/nature core overrides, responsive
css/modals.css          ← Projects, Modal & Detail Modal styles (~400 lines) — cards, grid, overlays, detail sections, dark/nature overrides
css/skills.css          ← Skills & Skill Popup styles (~300 lines) — groups, items, popup overlay, level bar, dark/nature overrides
css/typing-game.css     ← Typing game core styles (~800 lines) — base, navbar, text, cursor, stats, zen, hardcore, dark/nature core overrides, tooltip
css/typing-game-ai.css  ← Typing game AI styles (~200 lines) — AI toggle, popup, inline loader, dark/nature AI overrides
css/typing-game-intro.css ← Typing game intro styles (~200 lines) — typewriter, loading, reveal animation, dark/nature intro overrides
css/music-player.css    ← Music player styles (~300 lines, navbar mini-player)
css/visualizer.css      ← Background canvas visualizer (~100 lines, full-screen + time-warp desaturation)
css/rain.css            ← Rain effect styles (~100 lines, umbrella button + canvas)
js/i18n.js              ← Site-wide translations FR/EN (~200 lines) — exposes SITE_I18N on window
js/data.js              ← Content data (PROJECTS, SKILL_GROUPS, MUSIC) with EN translations — loaded after i18n.js
js/typing-texts.js      ← Typing practice texts by lang/mode — exposes TYPING_TEXTS on window
js/typing-game-i18n.js  ← Typing game i18n translations (~150 lines) — exposes TYPING_GAME_I18N on window
js/typing-game-ai.js    ← Typing game AI module factory (~300 lines) — exposes createTypingGameAI on window
js/typing-game-intro.js ← Typing game intro module factory (~250 lines) — exposes createTypingGameIntro on window
js/typing-game.js       ← Typing game core IIFE (~2000 lines) — rendering, input, game lifecycle, navbar
js/music-player.js      ← Self-contained IIFE (~500 lines) — navbar mini music player + speed/freeze API
js/visualizer.js        ← Self-contained IIFE (~500 lines) — background frequency bars + particles + speed/freeze API
js/rain-engine.js       ← Shared rain physics + rendering engine (~400 lines) — used by both worker and fallback, speed-aware
js/rain.js              ← Self-contained IIFE (~400 lines) — rain effect controller (OffscreenCanvas + Worker) + speed/enable API
js/rain-worker.js       ← Web Worker (~70 lines) — thin wrapper delegating to rain-engine.js
js/particles.js         ← Self-contained IIFE (~240 lines) — hover micro-particles (lift + aura variants), theme-aware
js/main.js              ← DOM rendering, i18n, interactions, animation controls (~1600 lines) — depends on i18n.js + data.js globals
assets/images/          ← Static images (backgrounds, project covers, music covers, favicons per theme) + video backgrounds (.mp4) + poster images
assets/music/           ← Audio files for the music player (.mp3)
assets/doc/             ← CV PDF (CV_Paolo.pdf)
worker/gemini-proxy.js  ← Cloudflare Worker source — Gemini API proxy (server-side prompt, key rotation)
```

`index.html` loads scripts in order: `i18n.js` → `data.js` → `typing-texts.js` → `typing-game-i18n.js` → `typing-game-ai.js` → `typing-game-intro.js` → `typing-game.js` → `music-player.js` → `visualizer.js` → `rain-engine.js` → `rain.js` → `particles.js` → `main.js`. Each IIFE boots on `DOMContentLoaded`. `main.js` initializes all non-game features in its own `DOMContentLoaded` handler. A pre-`<body>` inline `<script>` restores saved theme, language, animations state, and detects weak devices from `localStorage` to prevent flash.

## Key Conventions

### Data/View Separation

Content lives in dedicated data files as plain arrays/objects:
- `js/i18n.js` — `window.SITE_I18N` object with ~80 FR/EN translation keys for all site UI text (nav, sections, forms, tooltips, animation controls, weak device popup, etc.)
- `js/data.js` — `PROJECTS` (4 project objects with `title`, `description`, `image`, `tags[]`, `en` translation object, and rich `details`: overview, competences, objectifs, equipe, travailIndividuel, techDetails, challenges), `SKILL_GROUPS` (10 groups: Langages, Outils de dev, Web, Conception, Tests, Mobile, Bases de données, Serveur & Réseau, Virtualisation & Conteneurs, Jeux vidéo — each with `{ label, en: { label, skills: [{description}] }, skills: [{ name, icon, description, level }] }`, level is 1–5), `MUSIC` (8 tracks with `{ title, artist, cover, src }`)
- `js/typing-texts.js` — `window.TYPING_TEXTS` object structured as `{ fr: { '10': [[base, full], ...], '25': [...], '50': [...], '100': [...] }, en: { ... } }` — each text is a `[base, full]` pair where `base` is lowercase no-punctuation and `full` includes uppercase + punctuation. League of Legends themed.

Rendering logic lives in `js/main.js`. To add a project, skill, or track, only edit `data.js` (include `en` translations). To add typing texts, edit `typing-texts.js`. To add site UI strings, edit `i18n.js`.

### Site-wide i18n

Full FR/EN bilingual support. Language state in `siteLang` variable (`main.js`), persisted in `localStorage('portfolio_lang')`.
- `siteT(key)` — translation helper, falls back to FR if key missing in current lang
- `dataField(obj, field)` / `dataDetailField(project, field)` / `skillDesc(group, i)` — data translation helpers for projects/skills with `en` objects
- `updateStaticTexts()` — scans `[data-i18n]` elements and sets `textContent` from `siteT()`
- `updateSiteLanguage()` — full re-render (projects, skills, footer, close modals) + dispatches `sitelangchange` custom event
- `initLangToggle()` — globe button in navbar, animated label swap, custom tooltip
- Typing game listens to `sitelangchange` event for its own translation updates
- `window.__siteT` exposed for cross-module access (e.g. weak device popup)

### CSS Naming — BEM-like

Classes follow `block__element--modifier` (e.g., `nav__link--active`, `project-card__body`, `typing-game__char--correct`). All design tokens are CSS custom properties in `:root` — change colors/sizing there, not in individual rules.

### Vanilla JS Only

No libraries, no frameworks, no npm. Use the `createElement(tag, className, textContent)` helper in `main.js` for DOM creation. Each feature has its own `init*()` function called from the `DOMContentLoaded` handler. Game, player, and visualizer are self-contained IIFEs.

### Self-Contained IIFEs with Window API

`typing-game.js`, `music-player.js`, `visualizer.js`, and `rain.js` are each wrapped in an IIFE. They build their own DOM, manage their own state, and depend only on a container element in `index.html`. Cross-IIFE communication is done via `window` globals:

**Music player exposes:**
- `__musicPlayerAudioCtx`, `__musicPlayerSource`, `__musicPlayerGain` — audio graph for visualizer
- `__musicPlayerAudio` — raw `<audio>` element for speed control
- `__musicPlayerPlay`, `__musicPlayerPause` — play/pause functions
- `__musicPlayerSetFrozen(on)` — freeze state (prevents UI-triggered play/pause during time-warp)
- `__musicPlayerIsPlaying()` — returns logical playing state
- `__setMusicPlaybackRate(rate)` — set audio playback speed

**Visualizer exposes:**
- `__setVisualizerSpeed(factor)` — particle/animation speed multiplier
- `__setVisualizerEnabled(on)` — show/hide + stop drawing
- `__setVisualizerFrozen(on)` — freeze particles in place

**Rain exposes:**
- `__rainSetSpeed(factor)` — physics speed factor (curved)
- `__rainSetEnabled(on)` — enable/disable rain system
- `__rainIsEnabled()` — current enabled state

**Typing game exposes:**
- `__typingGameFocused()` — returns whether the typing game text area is focused
- `__typingGameWPM()` — returns current WPM (via `calcWPM()`, 0 if unavailable)

**Particles exposes:**
- `__setParticlesSpeed(factor)` — speed multiplier for all particle velocities, decay, spawn rates, and stacking accumulation

### Typing Game Modular Architecture

The typing game is split into 4 files using a **factory pattern with dependency injection**:
- `typing-game-i18n.js` — Pure data (FR/EN translations). Exposes `window.TYPING_GAME_I18N`.
- `typing-game-ai.js` — AI text generation factory. Exposes `window.createTypingGameAI(deps)`. Returns `{ showPopup, isInlineActive }`.
- `typing-game-intro.js` — Intro typewriter factory. Exposes `window.createTypingGameIntro(deps)`. Returns `{ showIntro, buildSmartphoneStaticDOM }`.
- `typing-game.js` — Core IIFE. Creates module instances in `init()` via dependency injection.

**Shared state:** AI-related state is grouped into an `aiState` object (`{ mode, texts, theme, uppercase, punctuation, strictWordCount, inlineActive }`) passed by reference to the AI module — both core IIFE and module read/write the same object.

**DOM ref getters:** Since DOM elements (`container`, `navbarEl`, `textEl`, etc.) are set at different init stages, modules receive getter functions (e.g., `getContainer()`, `getTextEl()`) instead of direct references.

**Adding to modules:** To add AI functionality, edit `typing-game-ai.js`. To modify the intro sequence, edit `typing-game-intro.js`. To add/change translations, edit `typing-game-i18n.js`. Core game logic (rendering, input, lifecycle) stays in `typing-game.js`.

### Persistence

- **Cookies** (typing game, 365-day expiry):
  - Settings: `typing_lang`, `typing_mode`, `typing_show_errors`
  - Text options: `typing_opt_uppercase`, `typing_opt_punctuation`, `typing_opt_numbers`, `typing_opt_special`
  - AI options: `typing_ai_uppercase`, `typing_ai_punctuation`, `typing_ai_strict_wc`
  - State: `typing_game_activated`, `typing_best_10`, `typing_best_25`, `typing_best_50`, `typing_best_100`
- **localStorage**:
  - `portfolio_theme` — `'light'`, `'dark'`, or `'nature'`
  - `portfolio_lang` — `'fr'` or `'en'`
  - `portfolio_animations` — `'on'` or `'off'`
  - `portfolio_anim_speed` — float `0`–`1`
  - `portfolio_rain` — `'on'` or `'off'`
  - `modal_projects_hint_seen`, `modal_detail_hint_seen` — boolean flags
- Cookie helper functions (`setCookie`, `getCookie`) are defined inside the typing game IIFE

## Theme System

Three themes controlled by `data-theme` attribute on `<html>` — cycles: light → dark → nature → light.

**Light theme (default):** Warm palette
- `--clr-bg: #100f18`, `--clr-surface: #1b1a27`, `--clr-primary: #F2A285` (coral), `--clr-primary-hover: #F28080`, `--clr-accent: #BF99A0`
- Background: `assets/images/background.jpg` (static image via `body::before`)

**Dark theme:** Purple neon palette
- `--clr-bg: #0a0a20`, `--clr-surface: #1a0033`, `--clr-primary: #9c27b0` (purple), `--clr-primary-hover: #6a0dad`, `--clr-accent: #ff4ecb`
- Background: `assets/images/backgroundKatana.mp4` (video via `<video class="bg-video--dark">`)

**Nature theme:** Green forest palette
- `--clr-bg: #0a1208`, `--clr-surface: #152210`, `--clr-primary: #5eb83a` (green), `--clr-primary-hover: #7bda4e`, `--clr-accent: #4ab5d6`
- Background: `assets/images/hollowbackground.mp4` (video via `<video class="bg-video--nature">`)

Theme toggle: `initThemeToggle()` in `main.js`, persisted in `localStorage('portfolio_theme')`. SVG icon morphs between sun (light) → moon (dark) → leaf (nature) with animated transitions. Inline `<script>` in `<head>` restores theme before paint. A second inline `<script>` after the toggle button sets SVG attributes immediately for correct initial icon state. Custom tooltip with label text + preview thumbnail of the next theme's background.

**Video backgrounds:** Two `<video>` elements in `<body>` (before `<header>`), auto/muted/loop/playsinline, `preload="none"`, with poster images. `manageVideos(theme)` in `initThemeToggle()` plays/pauses the correct video on toggle.

**Background credit badge:** CSS `.bg-credit` element created by `initThemeToggle()`. Shows game/artwork credit (Katana Zero for dark, Hollow Knight for nature) for 3 seconds on theme switch. Auto-dismisses.

Dark & nature theme CSS overrides are split across each CSS file under `[data-theme="dark"]` and `[data-theme="nature"]` selectors. Core overrides (layout, header, nav, contact, footer, CV, cursor halo, theme toggle) live in `styles.css`. Each component CSS file (`modals.css`, `skills.css`, `typing-game.css`, `typing-game-ai.css`, `typing-game-intro.css`, `music-player.css`, `visualizer.css`, `rain.css`) has its own co-located dark + nature override blocks. All components read `document.documentElement.dataset.theme` or `getAttribute('data-theme')` for theme-aware colors.

## Features

### Typing Game (`js/typing-game.js` + `js/typing-game-i18n.js` + `js/typing-game-ai.js` + `js/typing-game-intro.js` + `css/typing-game.css` + `css/typing-game-ai.css` + `css/typing-game-intro.css`)

The largest and most complex feature. Split into 4 JS files (see "Typing Game Modular Architecture" above).

**Core IIFE** (`typing-game.js`) structure (in order):

1. **I18N data** — `var I18N = window.TYPING_GAME_I18N` (from typing-game-i18n.js)
2. **Cookie helpers** — `setCookie`, `getCookie`, `getBestWPM`, `saveBestWPM`, `saveSettings`, `loadSettings`, `isGameUnlocked`, `unlockGame`
3. **Text data** — `var TEXTS = window.TYPING_TEXTS` (from typing-texts.js)
4. **Text settings** — `SETTING_KEYS` array: uppercase, punctuation, numbers, specials — each togglable via navbar
5. **State variables** — ~30 `let` variables managing core game state + `aiState` shared object + `ai`/`intro` module refs
6. **DOM refs** — `container`, `navbarEl`, `textEl`, `innerEl`, etc.
7. **Helpers** — restart text, text picker (`pickText(avoidIndex)`), active texts getter (`getActiveTexts()`), `applySettings(text)` applies uppercase/punctuation/numbers/specials transforms
8. **Word locking** — `tryLockWord()` scans from `lockedIndex` forward, locks correct words, increments `correctWords`
9. **Calculations** — `calcWPM()`, `calcAccuracy()`, `updateTrailSpeed()`
10. **DOM span builder** — `buildCharSpans()` creates one `<span>` per character with `_cls`, `_sty`, `_err`, `_wc` change-detection properties
11. **Zen rendering** — `renderZen()` uses `innerHTML` (dynamic text length)
12. **Main rendering** — `render()` DOM-reuse via `charSpans[]` array, updates only changed span class/style/content. Trail, combo, cursor, hardcore hiding all handled here
13. **Scroll to cursor** — `scrollToCursor()` with `cachedLH` (cached line-height), keeps cursor on middle visible line via `translateY`
14. **Stats** — `updateStats()` with trail decay, `updateTextBackground(wpm)` (dynamic glow/border/background based on WPM 0-200 scale, theme-aware RGB values)
15. **Game lifecycle** — `startGame(forceNewText)`, `finishGame()`
16. **Input handling** — `handleKey(e)` — all keyboard logic, Ctrl+ArrowUp/Down debug WPM boost
17. **Popups** — `showZenPopup()`, `showHardcorePopup()`, `showInfoPopup()` (shared overlay popup builder)
18. **Navbar builder** — `buildNavbar()` creates lang selector, mode selector, 4 text-setting toggles (uppercase, punctuation, numbers, specials), eye toggle, hardcore toggle, AI toggle + theme button, 3 AI option toggles. Full tooltip system in fr/en
19. **Game DOM builder** — `buildGameDOM()` creates text area, stats, focus hint, hardcore countdown, focus/blur handlers with pause/resume
20. **Init** — `init()` — creates AI + intro modules via factory functions with dependency injection, detects unlock state → intro/smartphone/desktop flow

**I18N module** (`typing-game-i18n.js`): Pure `window.TYPING_GAME_I18N = { fr: {...}, en: {...} }` with ~55 translation keys per language (intro text, tooltips, stats labels, popup messages, etc.)

**AI module** (`typing-game-ai.js`): Factory `window.createTypingGameAI(deps)` containing `WORKER_URL`, `postProcessAiTexts`, `fetchAiTexts`, `showAiInlineLoader`/`finishAiInlineLoader`/`dismissAiInlineLoader`, `showAiPopup`. Returns `{ showPopup, isInlineActive }`. Deps: `t` (translation fn), `aiState` (shared ref), DOM getters, `clearBlurHint`, `saveAiOptions`.

**Intro module** (`typing-game-intro.js`): Factory `window.createTypingGameIntro(deps)` containing `showIntro`, `buildIntroDOM` (typewriter animation with trail + combo), `showIntroPopup`, `transitionToGame`, `buildSmartphoneStaticDOM`. Returns `{ showIntro, buildSmartphoneStaticDOM }`. Deps: `t`, `getContainer`, hero title getter/setter, `showInfoPopup`, `unlockGame`, `buildGameDOM`, `startGame`.

#### Game Modes
- **10, 25, 50, 100** — Fixed word count from `TYPING_TEXTS` or AI-generated texts
- **Zen** — Freeform typing, no fixed text, `Shift+Space` to finish, word count on space
- **Hardcore** — 3-second memorize phase → text hidden, no backspace, any error = immediate fail. Only compatible with mode `10`

#### Text Settings (NEW)
- **Uppercase** — applies natural capitalization from `full` variant of typing texts
- **Punctuation** — adds punctuation marks from `full` variant
- **Numbers** — inserts random digit sequences into text
- **Specials** — injects special characters
- Texts stored as `[base, full]` pairs — `base` is lowercase/no-punct, `full` is the rich version. `applySettings()` selectively applies transforms
- Settings persisted via cookies: `typing_uppercase`, `typing_punctuation`, `typing_numbers`, `typing_specials`

#### AI Mode
- Toggle generates themed texts via Gemini 2.5 Flash through Cloudflare Worker proxy
- Worker URL: `https://gemini-proxy.colombatpaolo.workers.dev`
- Generated texts stored in `aiTexts` object `{ fr: { '10': [...], '25': [...], '50': [...], '100': [...] }, en: { ... } }`
- **Prompt built server-side** — client sends only `{ theme }`, worker contains `SYSTEM_INSTRUCTION` + `responseSchema`
- **AI options** (3 toggles visible when AI active): uppercase, punctuation, strict word count
- Theme input popup with generation status and error handling (ORIGIN_BLOCKED, RATE_LIMIT, TRUNCATED, TIMEOUT)
- "Change theme" pencil button visible only when AI is active
- **Inline loader overlay** — appears on text area after 3s of waiting for AI response

#### i18n (Internationalization)
- Full French/English support for navbar tooltips via `TOOLTIPS` object
- Tooltip language follows the selected typing language (`fr`/`en`)
- All navbar buttons have `title` attributes updated dynamically on language change

#### Performance Optimizations
- **DOM reuse** via `charSpans[]` — span elements created once per game start (`buildCharSpans()`), updated in-place with change detection (`span._cls`, `span._sty`, `span._err`, `span._wc`)
- **Cached line-height** — `cachedLH` computed once after spans are in DOM
- Direct span access instead of `querySelector` for cursor element
- No `requestAnimationFrame` wrapping for render calls (already fast enough with DOM reuse)
- Zen mode still uses `innerHTML` because text length is dynamic

#### Combo System
- Streak at 10/30/60 adds glow tiers (`--combo-1/2/3`) to cursor
- Color shift at 50–100 streak: primary → hover color (theme-aware RGB interpolation)
- Trail effect behind cursor: length scaled by combo + typing speed, opacity based on `trailSpeed` (0–1)

#### Intro Sequence
1. First visit: `isGameUnlocked()` returns false → `showIntro()`
2. Typewriter animation plays `INTRO_TEXT` character by character with trail + combo effects
3. On completion: "Jouer au Typing Game" button appears (desktop) or auto-unlocks (mobile)
4. Button click → info popup → `unlockGame()` (sets `typing_game_unlocked` cookie) → `transitionToGame()` (fade out intro, build game DOM, reveal animation)
5. Subsequent visits: game loads directly

#### Mobile
- Smartphones (`max-width: 600px` + `pointer: coarse`) get static intro text display only — no interactive game
- Navbar disabled on smartphone

#### Focus/Blur
- Timer pauses on blur, resumes on focus (accumulated `totalPaused` ms)
- Focus hint with SVG chevron appears after 120ms blur debounce
- Text background dims to low alpha on blur
- `typing-game--focused`/`typing-game--blurred` classes toggle blur/focus CSS states

### Rain Effect (`js/rain-engine.js` + `js/rain.js` + `js/rain-worker.js` + `css/rain.css`)

Toggleable rain effect using **OffscreenCanvas + Web Worker** architecture for zero main-thread rendering cost, with a **shared physics engine** (`rain-engine.js`) used by both the Worker and the main-thread fallback.

**Shared engine (`rain-engine.js`):**
- Factory function `createRainEngine()` exposed on `self`/`window` — works in both Worker and main-thread contexts
- 160 drops (60 on mobile), varying widths (1.2–2.4px), speed 7–14px/frame
- 350 splash particles (5 per impact) with gravity
- 60 ripple rings — expanding ellipses on surface hits
- **Cursor bounce** — drops deflect off 22px radius around cursor position, spawning splashes + ripples
- **Swept collision** — `hitSurface()` checks previous frame position to never miss fast drops
- **Batched rendering** — drops sorted into 2 width groups × 3 alpha buckets for minimal draw calls
- Resolution scaling: renders at 0.65× for performance
- Theme-aware rain colors: light = lavender `220,220,240`, dark = purple `200,140,255`, nature = cyan `120,210,240`
- **Drain mode** — `drain()` stops spawning new drops; `draw()` returns `'drained'` when all drops/splashes/ripples are gone
- Engine API: `init(canvas, w, h, dc)`, `start(scrollY)`, `stop()`, `drain()`, `resize(w, h, dc)`, `setScroll(sy)`, `setCursor(x, y)`, `setSurfaces(s)`, `setTheme(theme)`, `isRunning()`, `draw()` → returns `'ok'`|`'drained'`|`'stopped'`

**Main thread (`rain.js`):**
- IIFE creates `<canvas class="rain-canvas">` (fixed, fullscreen, pointer-events none)
- Umbrella SVG button placed inline next to hero title via `.hero__title-row` wrapper
- SVG dome path morphs between closed (furled) ↔ open (full dome) via CSS `d` property transition
- Transfers canvas to Worker via `transferControlToOffscreen()`, falls back to main-thread `createRainEngine()` instance if unavailable
- Sends scroll, resize, cursor position, theme, surface rects to Worker via `postMessage` (or directly to fallback engine)
- Surface queries: `querySurfaces()` reads bounding rects of `.project-card`, `.skills-group`, `.contact__form`, `.cv-section__card`, `.footer`, `.typing-game__text` — rain splashes on these elements
- **Drain mode** — disabling sends `drain` message (Worker) or calls `fbEngine.drain()` (fallback); drops finish falling gracefully before canvas hides
- Persisted in `localStorage('portfolio_rain')` — `'on'`/`'off'`

**Worker (`rain-worker.js`):**
- Thin message-passing wrapper: `importScripts('rain-engine.js')`, creates engine instance
- `loop()` calls `engine.draw()`, posts `'drained'` message when engine reports drain complete
- Message API: `init`, `start`, `stop`, `drain`, `scroll`, `resize`, `surfaces`, `cursor`, `theme`

**Fallback (main-thread):** Uses `createRainEngine()` directly — identical full-quality physics + rendering as the Worker path (same engine code). Cursor bounce, ripple rings, swept collision, batched draw all available in fallback.

### Music Player (`js/music-player.js` + `css/music-player.css`)
- Mini player in navbar header with play/pause, prev/next, volume slider, mute toggle
- Playlist dropdown with cover art, auto-scroll to active track on open
- Shuffled on init (Fisher-Yates)
- Web Audio API: lazy `AudioContext` → `MediaElementSource` → `GainNode`. Skips Web Audio on `file:` protocol
- `crossOrigin = 'anonymous'` for AudioContext analyser support (HTTP only)
- Exposes audio graph on `window` for visualizer: `__musicPlayerAudioCtx`, `__musicPlayerSource`, `__musicPlayerGain`
- Exposes control API: `__musicPlayerAudio`, `__musicPlayerPlay`, `__musicPlayerPause`, `__musicPlayerSetFrozen`, `__musicPlayerIsPlaying`, `__setMusicPlaybackRate`
- SVG icons for play/pause/prev/next/volume defined as string constants
- Prev restarts current track if >3s in, otherwise goes to previous

### Visualizer (`js/visualizer.js` + `css/visualizer.css`)
- Full-screen fixed `<canvas>` inserted as first child of `<body>`, `bg-tint-overlay` div after it
- **64 frequency bars** with gradient fill (primary→accent→hover), rising from bottom, rounded top corners
- **60 particles** reacting to per-bin frequency data, connected by proximity lines when active
- **Impulse system:** click = repel from cursor position, keypress = glow burst (no movement)
- Connects to music player audio graph via `window.__musicPlayerAudioCtx` each frame until successful
- Theme-aware: reads `getThemeColors()` each frame for particle colors and bar gradients
- Particles dim when overlapping frequency bars (depth-based alpha reduction)
- Exposes speed/freeze API: `__setVisualizerSpeed`, `__setVisualizerEnabled`, `__setVisualizerFrozen`

### Main Features (`js/main.js`)

Structure (in order):
1. **Site language state** — `siteLang`, `siteT(key)`, `dataField()`, `dataDetailField()`, `skillDesc()` — translation helpers
2. `createElement(tag, className, textContent)` — utility helper
3. `buildProjectCard(project)` — single project card with image, body, tags, "En savoir plus" hint
4. `renderProjects()` — grid of first 3 cards + "Voir tous les projets" button
5. `createProjectsModal()` / `openProjectsModal()` / `closeProjectsModal()` — all-projects modal with grid of all cards
6. `createScrollHint(modalEl, storageKey)` — animated scroll hint inside modals, stored in `localStorage` per key, **dedup guard** (`querySelector('.modal-scroll-hint')` check)
7. `openProjectDetail(index)` — dynamic detail modal with overview, competences expandables, objectifs, equipe, travailIndividuel, techDetails, challenges sections
8. `renderSkills()` — grouped grid (2 columns), first 2 groups visible, "Voir toutes les compétences" toggle
9. `openSkillPopup(skill)` — overlay with icon, description, animated level bar (1–5 dots)
10. `initNavToggle()` — mobile hamburger with X animation, slide-in drawer
11. `initScrollSpy()` — active nav link highlighting + sliding `#nav-indicator` bar
12. `initContactForm()` — Formspree POST with honeypot, 3s timing check, 60s cooldown, i18n status messages
13. `updateStaticTexts()` / `updateSiteLanguage()` — i18n rendering + language change orchestration
14. `initLangToggle()` — navbar language toggle with animated label swap + custom tooltip
15. `setFooterYear()` — dynamic copyright year
16. `DOMContentLoaded` handler — calls: `initLangToggle`, `updateStaticTexts`, `renderProjects`, `renderSkills`, `initNavToggle`, `initScrollSpy`, `initContactForm`, `setFooterYear`, `initScrollHint`, `initThemeToggle`, `initAnimationControls`, `initCursorHalo`, `initScrollProgress`, `initScrollReveal`
17. `initCursorHalo()` — custom cursor ring + dot with lerp animation, hover/click states, hidden on touch devices (`pointer: coarse`), hides during typing game input, fades in CV iframe area
18. `initScrollHint()` — bouncing chevron, hidden after scroll > 80px or when typing game is focused
19. `detectWeakDevice()` — checks `prefers-reduced-motion`, `hardwareConcurrency ≤ 2`, `deviceMemory ≤ 2`
20. `showWeakDevicePopup()` — modal with "Enable anyway" / "OK, got it" actions, built-in lang toggle, scrolls to footer toggle on enable
21. `initAnimationControls()` — footer settings panel with speed slider, animation on/off toggle, yolo mode placeholder, back-to-top button, copilot link, time-warp visual effect
22. `initThemeToggle()` — theme toggle with animated sun↔moon↔leaf SVG, video management, background credit badge, preview tooltips
23. `initScrollProgress()` — horizontal progress bar fixed at top, gradient fill with shimmer animation
24. `initScrollReveal()` — IntersectionObserver-based reveal for sections + staggered children (`.reveal` / `.reveal-child` classes). Re-triggers on every scroll: sections un-reveal when scrolled out and re-animate when scrolling back. **Direction-aware:** tracks scroll direction via `scroll` event listener; sections slide up (`reveal--from-below`) when scrolling down, slide down (`reveal--from-above`) when scrolling up. **Hysteresis:** uses dual thresholds `[0, 0.12]` — reveals at 12% visibility, un-reveals only when fully out of viewport (ratio 0) to prevent blinking at edges. `.skills-group` excluded from `.reveal-child` to avoid conflicting with expand/collapse transitions

### Animation Controls (`initAnimationControls()`)

Global speed/animation control system in the footer:

**Speed slider** (0–1 range, in hero section below title):
- **Non-linear (curved):** Rain speed, time-warp grayscale, clock icon animation — uses `raw^2.5` curve
- **Linear:** Music rate (0.15–1), visualizer particles, video `playbackRate`, label display
- **Time-warp effect:** Applies grayscale + desaturation overlay (`--tw-intensity` CSS var, `data-time-warp` attribute: `slow`/`heavy`/`frozen`)
- **Freeze (speed=0):** Music pauses (freeze state), videos pause, rain stops, time fully frozen

**Footer settings zone** (3-column layout):
- Left: "Réglages" title with gear icon + animation toggle + yolo mode toggle (disabled placeholder)
- Center: Footer text + social links (repositioned from original footer)
- Right: Back-to-top button + "Mon Copilot" link (friend's portfolio at moksi.studio)

**Animation toggle:**
- Off: sets `data-animations="off"` on `<html>`, hides rain/visualizer/videos/speed slider, resets music to normal speed
- On: restores rain if previously active, re-enables visualizer, resumes videos at stored speed
- CSS `[data-animations="off"]` rules hide visual elements globally

**Weak device detection:**
- Auto-detect on first visit if no `portfolio_animations` in localStorage
- Shows popup with explanation + "Enable anyway" button
- Enable flow: scrolls to footer toggle → flips it → shows lag toast → scrolls back to hero
- `weakDeviceAnimDone` custom event signals typing game intro can proceed

**i18n integration:** All labels listen to `sitelangchange` event via `updateAnimI18n()`

### Hover Particles (`js/particles.js`)

Self-contained IIFE creating micro-particles on interactive elements. Full-screen fixed `<canvas>` overlay (`pointer-events: none`, z-index 50).

**Two systems:**
- **Butterfly** — used on `.project-card` and `.skill-item`. Per-type config via `BFLY_CFG`: projects get more frequent (0.12/s), more (max 5), and bigger (8–14px) butterflies; skills are rarer (0.04/s), fewer (max 2), and smaller (4–7px). Butterflies rest on the element's surface with gentle wing flapping. On `pointerenter`, all resting butterflies flutter away delicately with wobbling upward flight. Butterflies never spawn on invisible elements (`getBoundingClientRect().height === 0` — handles `display:none` parents like `.skills-group--hidden`, overflow-hidden collapse, and off-screen elements). Drawn with bezier-curve wings (upper + lower pairs), thin body line, and curved antennae.
- **Aura** — used on `.typing-game__text`. Snowflakes spawn along all four edges. **Conditional logic:** when the typing game is unfocused, particles appear on hover (1–2 per frame). When focused and WPM > 60, particles appear **always** (no hover needed) — intensity starts weaker (0.5/frame at 60 WPM) and scales linearly to slightly beyond unfocused hover (2.5/frame at 150+ WPM). **Hover is disabled while focused** — no snowflakes on hover during focus, only the WPM auto-aura. Uses `window.__typingGameFocused()` and `window.__typingGameWPM()`.

**Speed scaling:** All particle velocities, decay, spawn rates, butterfly flapping, and accumulation scale with the global animation speed slider via `window.__setParticlesSpeed(factor)` (called from `applySpeed()` in `main.js`). At speed 0, everything freezes.

**Theme-aware colors:** Reads `data-theme` each frame to select palette:
- Light: coral `242,162,133` / accent `191,153,160` / glow `242,128,128`
- Dark: purple `200,140,255` / pink `255,78,203` / glow `156,39,176`
- Nature: green `94,184,58` / cyan `74,181,214` / glow `123,218,78`

**Rendering:** Butterflies use bezier-curve filled wings with glow shadow, body line, and antennae. Wing spread oscillates via `sin(flapPhase)`. Snowflakes use 6-branch crystalline shapes with barbs. Both have fade-in, spin, and wobble.

**Accumulation:** `bflyMap` Map stores `{ resting: [], fracAccum, type }` per tracked element. A `setInterval` (500ms) grows resting butterflies at the type-specific rate × `speedFactor`, skipping invisible elements. `MutationObserver` on `document.body` auto-tracks dynamically created elements (e.g. modal project cards). `totalResting` counter tracks total visible butterflies across all elements.

**Performance:** Canvas boots lazily on first interaction/stacking. `requestAnimationFrame` loop stops when no flying particles, no aura zone, and no resting butterflies remain. Skips on touch devices (`pointer: coarse`). Disabled via `[data-animations="off"]`.

**Delegated events:** Uses `pointerenter`/`pointerleave` with `event.target.closest(selector)` on `document` — works for dynamically created elements.

## Development

Open `index.html` directly in a browser, or use any static server:

```sh
# Python
python -m http.server 8000

# Node (npx)
npx serve .

# VS Code Live Server extension
```

No install step. No build step. No environment variables. Web Audio features (music player audio graph, visualizer) require HTTP (not `file://`).

## Adding Content

**New project:** Add an object to `PROJECTS` in `js/data.js`:
```js
{
  title: '...', description: '...', image: 'assets/images/cover.jpg',
  tags: ['HTML','CSS'], demo: 'https://...', repo: 'https://...',
  en: { title: '...', description: '...', tags: ['HTML','CSS'],
        details: { overview: '...', /* mirror FR structure */ } },
  details: { overview: '...', competences: [{ title: '...', items: ['...'] }],
             objectifs: '...', equipe: '...', travailIndividuel: '...',
             techDetails: ['...'], challenges: '...' }
}
```

**New skill:** Add `{ name: '...', icon: '...', description: '...', level: 3 }` to the appropriate group in `SKILL_GROUPS` in `js/data.js`.

**New track:** Add `{ title: '...', artist: '...', cover: 'assets/images/cover.jpg', src: 'assets/music/file.mp3' }` to `MUSIC` in `js/data.js`.

**New typing texts:** Add `[base, full]` pairs to the appropriate `lang.mode` array in `js/typing-texts.js`. `base` = lowercase no-punctuation, `full` = with capitalization + punctuation.

**New section:** Add semantic HTML in `index.html` with class `section` and an `id`, add corresponding CSS block in `styles.css`, add render/init function in `main.js`.

## Styling Rules

- Mobile-first responsive: base styles → `@media (max-width: 768px)` overrides
- Light theme uses `background.jpg` (static via `body::before`), dark/nature themes use `.mp4` video backgrounds
- Colors, fonts, spacing all via CSS custom properties in `:root`:
  - Colors: `--clr-bg` (#100f18), `--clr-surface` (#1b1a27), `--clr-primary` (#F2A285), `--clr-primary-hover` (#F28080), `--clr-accent` (#BF99A0), `--clr-text` (#e8e3e4), `--clr-text-muted` (#A1A1A6), `--clr-border` (#2c2a3a)
  - Typography: `--ff-body` (Segoe UI / system-ui), `--fs-base/lg/xl/2xl`
  - Spacing: `--section-padding`, `--container-width` (1100px), `--gap` (2rem)
  - Effects: `--radius` (0.5rem), `--shadow`, `--transition` (0.3s ease)
- Glass-morphism pattern: `rgba()` background + `backdrop-filter: blur()` (light theme only, disabled in dark + nature with `backdrop-filter: none`)
- Dark theme: overrides under `[data-theme="dark"]` selectors in each CSS file
- Nature theme: overrides under `[data-theme="nature"]` selectors in each CSS file
- `styles.css` organized blocks: Variables & Reset, Layout, Header & Navigation, Buttons, Hero, Contact Form, Scroll Hint, Footer, Background Credit Badge, CV Modal, CV Section, Cursor Halo, Theme Toggle, Animation Controls, Time-warp overlay, Weak device popup, Dark Theme (core overrides), Nature Theme (core overrides), Responsive, `[data-animations="off"]` rules
- `modals.css` organized blocks: Projects (grid, cards, tags, actions), Modal (overlay, header, close, grid, scroll hint hook), Detail Modal (overlay, content, image, sections, scrollbar, expandable), Dark Theme (projects + modal + detail overrides), Nature Theme (projects + modal + detail overrides)
- `skills.css` organized blocks: Skills (grid, groups, labels, items, visibility, actions), Skill Popup (overlay, popup, icon, description, level bar, dots), Dark Theme (skills + popup overrides), Nature Theme (skills + popup overrides)
- `typing-game.css` organized blocks: Base, Blur/Focus states, Navbar, Eye toggle, Settings gear/popup, Text display, Character states, Cursor (blink/combo/trail), Stats, Best score, Hints, Responsive, Zen mode/popup, Hardcore, Dark Theme (core overrides), Nature Theme (core overrides), Navbar tooltip
- `typing-game-ai.css` organized blocks: AI toggle, Floating mini-stars, AI theme button, AI popup input/options, Strict tooltip, AI loading indicator, AI Inline Loader (navbar disabled, responsive, overlay, content, result, dark overrides), Dark Theme (AI overrides), Nature Theme (AI overrides)
- `typing-game-intro.css` organized blocks: Intro text container, Loading screen, Intro button, Reveal animation, Dark Theme (intro overrides), Nature Theme (intro overrides)
- `music-player.css` organized blocks: Container, Cover, Track info, Controls, Volume, Playlist dropdown, Responsive, Dark Theme, Nature Theme
- `rain.css` organized blocks: Canvas, Hero title row, Umbrella button, SVG dome animation, Active state, Dark Theme, Nature Theme, Responsive
- `visualizer.css` organized blocks: Canvas, Tint overlay, Dark Theme, Nature Theme
- Modal scroll hints centered with `width: 100%; display: flex; justify-content: center`

## Contact Form

Form submits to Formspree (`https://formspree.io/f/mkovoawq`) with anti-spam measures: honeypot field (`_gotcha`, hidden via `display:none`), 3-second minimum timing check, 60-second cooldown between submissions. Status messages are i18n-aware via `siteT()`. Update `initContactForm()` in `main.js` to change the backend.

## AI Integration (Cloudflare Worker)

The typing game's AI mode uses a Cloudflare Worker as a proxy to the Google Gemini API (model: `gemini-2.5-flash`). The worker hides the API key and restricts requests to allowed origins. Client-side AI logic lives in `js/typing-game-ai.js` (factory module).

- **Worker URL:** `https://gemini-proxy.colombatpaolo.workers.dev`
- **Architecture:** Prompt is built **entirely server-side** — client sends only `{ theme }`, worker contains `SYSTEM_INSTRUCTION` with detailed generation rules
- **Structured output:** `responseMimeType: 'application/json'` + `responseSchema` forces Gemini to output exactly `{ fr: { '10': [...], ... }, en: { ... } }` — no client-side markdown stripping needed
- **Key rotation:** Supports up to 3 API keys (`GEMINI_API_KEY`, `_2`, `_3`). On HTTP 429, rotates to next key
- **Config:** `temperature: 0.9`, `maxOutputTokens: 16384`, `thinkingConfig: { thinkingBudget: 0 }`, 45s timeout
- **Sanitization:** Server-side emoji removal, control char stripping, whitespace normalization on returned texts
- **Error handling:** HTTP 403 = ORIGIN_BLOCKED, HTTP 429 = RATE_LIMIT, finishReason MAX_TOKENS = TRUNCATED, AbortError = TIMEOUT, JSON parse errors = INVALID_JSON
- **Defense in depth:** Structure validation (fr/en keys, mode arrays) even with schema enforcement

## Persistence

- **Cookies** (typing game): `typing_lang`, `typing_mode`, `typing_show_errors`, `typing_game_activated`, `typing_best_{mode}`, `typing_zen_seen`, `typing_hardcore_seen`, `typing_opt_uppercase`, `typing_opt_punctuation`, `typing_opt_numbers`, `typing_opt_special`, `typing_ai_uppercase`, `typing_ai_punctuation`, `typing_ai_strict_wc`
- **localStorage** (theme): `portfolio_theme` — values `'light'`, `'dark'`, or `'nature'`
- **localStorage** (lang): `portfolio_lang` — values `'fr'` or `'en'`
- **localStorage** (animations): `portfolio_animations` — `'on'` or `'off'`, `portfolio_anim_speed` — float `0`–`1`
- **localStorage** (rain): `portfolio_rain` — values `'on'` or `'off'`
- **localStorage** (scroll hints): `modal_projects_hint_seen`, `modal_detail_hint_seen`
- Cookie helper functions (`setCookie`, `getCookie`) are defined inside the typing game IIFE

## Important Implementation Details

- The `tryLockWord()` function scans forward from `lockedIndex`, locks everything up to the furthest correct word found. Wrong words before a correct word get locked too but don't count for WPM.
- `render()` uses direct span property comparisons (`span._cls !== cls`) to skip unnecessary DOM updates — this is the core performance optimization.
- The visualizer's `tryConnect()` is called every frame until it successfully connects to the music player's audio graph. It creates an `AnalyserNode` and inserts it in parallel with the destination.
- Popups (zen, hardcore, info, AI, settings, weak device) all share the same overlay pattern: create overlay + popup div, force reflow, add `--visible` class, animate in. Close removes class, waits for `transitionend`, then removes from DOM. All popups/modals have `role="dialog"` + `aria-modal="true"` + `aria-label` on the inner dialog element.
- **Focus trap:** `trapFocus(overlayEl)` utility in `main.js` (exposed as `window.__trapFocus`) traps Tab/Shift+Tab cycling within the overlay. Returns a cleanup function. Every modal/popup activates it on open and cleans up on close.
- **CDN icon fallback:** Skill icon `<img>` elements have `onerror` handlers that replace the broken image with a styled `<span>` showing the skill's first letter (`.skill-item__icon--fallback` / `.skill-popup__icon--fallback`).
- `MutationObserver` on `<html>` attribute changes re-renders the typing game on theme toggle (for trail/combo color updates).
- Cursor halo uses `requestAnimationFrame` with `lerp` for smooth ring/dot following, opacity transitions, and auto-pause when mouse isn't moving.
- Rain uses a **shared engine** (`rain-engine.js`) for both Worker and fallback paths — eliminates code duplication. Worker uses `importScripts`, main thread uses `<script>` tag.
- Rain engine uses **swept collision** (`hitSurface`) checking previous frame position to never miss fast drops passing through thin surfaces.
- Typing game uses **factory pattern + shared state object** for modular architecture: `createTypingGameAI(deps)` and `createTypingGameIntro(deps)` receive dependencies (translation fn, DOM getters, shared `aiState` object) and return public API objects. The `aiState` object is passed by reference so both the core IIFE and the AI module read/write the same state.

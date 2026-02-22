# Copilot Instructions — Portfolio

## Architecture

Static single-page portfolio — no build tools, no frameworks, no bundler. Hosted on GitHub Pages.

```
index.html              ← Single entry point; all sections live here
css/styles.css          ← Main styles (~1714 lines), organized by component blocks
css/typing-game.css     ← Typing game styles (~1400+ lines)
css/music-player.css    ← Music player styles (navbar mini-player)
css/visualizer.css      ← Background canvas visualizer (full-screen)
js/data.js              ← Content data (PROJECTS, SKILL_GROUPS, MUSIC) — loaded first
js/typing-texts.js      ← Typing practice texts by lang/mode — exposes TYPING_TEXTS on window
js/typing-game.js       ← Self-contained IIFE (~1689 lines) — hero typing speed game
js/music-player.js      ← Self-contained IIFE (~373 lines) — navbar mini music player
js/visualizer.js        ← Self-contained IIFE (~342 lines) — background frequency bars + particles
js/main.js              ← DOM rendering & interactions (~940 lines) — depends on data.js globals
assets/images/          ← Static images (backgrounds, project covers, music covers, favicon)
assets/music/           ← Audio files for the music player (.mp3)
assets/doc/             ← CV PDF (CV_Paolo.pdf)
```

`index.html` loads scripts in order: `data.js` → `typing-texts.js` → `typing-game.js` → `music-player.js` → `visualizer.js` → `main.js`. Each IIFE boots on `DOMContentLoaded`. `main.js` initializes all non-game features in its own `DOMContentLoaded` handler. A pre-`<body>` inline `<script>` restores dark theme from `localStorage` to prevent flash.

## Key Conventions

### Data/View Separation

Content lives in dedicated data files as plain arrays/objects:
- `js/data.js` — `PROJECTS` (4 project objects with `title`, `description`, `image`, `tags[]`, and rich `details`: overview, competences, objectifs, equipe, travailIndividuel, techDetails, challenges), `SKILL_GROUPS` (6 groups: Langages, Outils de dev, Web, Mobile, Bases de données, Serveur/Admin, each with `{ label, skills: [{ name, icon, description, level }] }`, level is 1–5), `MUSIC` (8 tracks with `{ title, artist, cover, src }`)
- `js/typing-texts.js` — `window.TYPING_TEXTS` object `{ fr: { '10': [...], '25': [...], '50': [...], '100': [...] }, en: { ... } }` with League of Legends themed typing texts

Rendering logic lives in `js/main.js`. To add a project, skill, or track, only edit `data.js`. To add typing texts, edit `typing-texts.js`.

### CSS Naming — BEM-like

Classes follow `block__element--modifier` (e.g., `nav__link--active`, `project-card__body`, `typing-game__char--correct`). All design tokens are CSS custom properties in `:root` — change colors/sizing there, not in individual rules.

### Vanilla JS Only

No libraries, no frameworks, no npm. Use the `createElement(tag, className, textContent)` helper in `main.js` for DOM creation. Each feature has its own `init*()` function called from the `DOMContentLoaded` handler. Game, player, and visualizer are self-contained IIFEs with no exports.

### Self-Contained IIFEs

`typing-game.js`, `music-player.js`, and `visualizer.js` are each wrapped in an IIFE. They build their own DOM, manage their own state, and depend only on a container element in `index.html` (`#typing-game`, `#music-player`). Cross-IIFE communication is done via `window` globals: the music player exposes its audio graph on `window` (`__musicPlayerAudioCtx`, `__musicPlayerSource`, `__musicPlayerGain`) for the visualizer to consume.

### Persistence

- **Cookies** (typing game): `typing_lang`, `typing_mode`, `typing_show_errors`, `typing_game_unlocked`, `typing_best_{mode}`, `typing_zen_seen`, `typing_hardcore_seen`
- **localStorage** (theme): `portfolio_theme` — values `'light'` or `'dark'`
- Cookie helper functions (`setCookie`, `getCookie`) are defined inside the typing game IIFE

## Theme System

Two themes controlled by `data-theme="dark"` attribute on `<html>`:

**Light theme (default):** Warm palette
- `--clr-bg: #100f18`, `--clr-surface: #1b1a27`, `--clr-primary: #F2A285` (coral), `--clr-primary-hover: #F28080`, `--clr-accent: #BF99A0`
- Background: `assets/images/background.jpg`

**Dark theme:** Purple neon palette
- `--clr-bg: #0a0a20`, `--clr-surface: #1a0033`, `--clr-primary: #9c27b0` (purple), `--clr-primary-hover: #6a0dad`, `--clr-accent: #ff4ecb`
- Background: `assets/images/background2.gif`

Theme toggle: `initThemeToggle()` in `main.js`, persisted in `localStorage('portfolio_theme')`. SVG sun↔moon icon with animated morphing (body radius, cutout, rays). Inline `<script>` in `<head>` restores dark before paint. All components read `document.documentElement.dataset.theme` for theme-aware colors (typing game trail/combo colors, visualizer particles/bars, text background glow).

Dark theme CSS overrides in `styles.css` are all under `[data-theme="dark"]` selectors. `typing-game.css` has its own `[data-theme="dark"]` block.

## Features

### Typing Game (`js/typing-game.js` + `css/typing-game.css`)

The largest and most complex feature. IIFE structure (in order):

1. **Cookie helpers** — `setCookie`, `getCookie`, `getBestWPM`, `saveBestWPM`, `saveSettings`, `loadSettings`, `isGameUnlocked`, `unlockGame`
2. **Text data** — `const TEXTS = window.TYPING_TEXTS` (from typing-texts.js)
3. **AI config** — `WORKER_URL` (Cloudflare Worker proxy URL)
4. **Intro text** — `const INTRO_TEXT` (welcome message)
5. **State variables** — ~30 `let` variables managing all game state
6. **DOM refs** — `container`, `navbarEl`, `textEl`, `innerEl`, etc.
7. **Helpers** — restart text, text picker (`pickText(avoidIndex)`), active texts getter (`getActiveTexts()`)
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
18. **AI generation** — `buildAiPrompt(theme)`, `fetchAiTexts(theme, onSuccess, onError)`, `showAiPopup(onConfirm)`
19. **Navbar builder** — `buildNavbar()` creates lang selector, mode selector, eye toggle, hardcore toggle, AI toggle + theme button
20. **Intro typewriter** — `showIntro(isSmartphone)`, `showIntroPopup()`, `transitionToGame()`
21. **Game DOM builder** — `buildGameDOM()` creates text area, stats, focus hint, hardcore countdown, focus/blur handlers with pause/resume
22. **Init** — `init()` — detects unlock state → intro/smartphone/desktop flow

#### Game Modes
- **10, 25, 50, 100** — Fixed word count from `TYPING_TEXTS` or AI-generated texts
- **Zen** — Freeform typing, no fixed text, `Shift+Space` to finish, word count on space
- **Hardcore** — 3-second memorize phase → text hidden, no backspace, any error = immediate fail. Only compatible with mode `10`

#### AI Mode
- Toggle generates themed texts via Gemini 2.0 Flash through Cloudflare Worker proxy
- Worker URL: `https://gemini-proxy.colombatpaolo.workers.dev`
- Generated texts stored in `aiTexts` object `{ fr: { '10': [...], '25': [...], '50': [...], '100': [...] }, en: { ... } }`
- Prompt requests JSON output with specific word counts, lowercase, French accents allowed
- Theme input popup with generation status and error handling (ORIGIN_BLOCKED, RATE_LIMIT, TRUNCATED)
- "Change theme" pencil button visible only when AI is active

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

### Music Player (`js/music-player.js` + `css/music-player.css`)
- Mini player in navbar header with play/pause, prev/next, volume slider, mute toggle
- Playlist dropdown with cover art, auto-scroll to active track on open
- Shuffled on init (Fisher-Yates)
- Web Audio API: lazy `AudioContext` → `MediaElementSource` → `GainNode`. Skips Web Audio on `file:` protocol
- `crossOrigin = 'anonymous'` for AudioContext analyser support (HTTP only)
- Exposes audio graph on `window` for visualizer: `__musicPlayerAudioCtx`, `__musicPlayerSource`, `__musicPlayerGain`
- SVG icons for play/pause/prev/next/volume defined as string constants
- Prev restarts current track if >3s in, otherwise goes to previous

### Visualizer (`js/visualizer.js` + `css/visualizer.css`)
- Full-screen fixed `<canvas>` inserted as first child of `<body>`, `bg-tint-overlay` div after it
- **64 frequency bars** with gradient fill (primary→accent→hover), rising from bottom, rounded top corners
- **60 particles** reacting to per-bin frequency data, connected by proximity lines when active
- **Impulse system:** click = repel from cursor position, keypress = glow burst (no movement)
- Connects to music player audio graph via `window.__musicPlayerAudioCtx` each frame until successful
- **Idle optimization:** Counts idle frames (no audio + no impulse), pauses RAF after 120 frames (~2s). `wake()` function resumes on click/keydown. `setInterval` every 2s checks if audio context became available.
- Theme-aware: reads `getThemeColors()` each frame for particle colors and bar gradients
- Particles dim when overlapping frequency bars (depth-based alpha reduction)
- Bar opacity: `isDarkTheme ? 0.3 : 0.4`

### Main Features (`js/main.js`)

Structure (in order):
1. `createElement(tag, className, textContent)` — utility helper
2. `buildProjectCard(project)` — single project card with image, body, tags, "En savoir plus" hint
3. `renderProjects()` — grid of first 3 cards + "Voir tous les projets" button
4. `createProjectsModal()` / `openProjectsModal()` / `closeProjectsModal()` — all-projects modal with grid of all cards
5. `createScrollHint(modalEl, storageKey)` — animated scroll hint inside modals, stored in `localStorage` per key, **dedup guard** (`querySelector('.modal-scroll-hint')` check)
6. `openProjectDetail(index)` — dynamic detail modal with overview, competences expandables, objectifs, equipe, travailIndividuel, techDetails, challenges sections
7. `renderSkills()` — grouped grid (2 columns), first 2 groups visible, "Voir toutes les compétences" toggle
8. `openSkillPopup(skill)` — overlay with icon, description, animated level bar (1–5 dots)
9. `initNavToggle()` — mobile hamburger with X animation, slide-in drawer
10. `initScrollSpy()` — active nav link highlighting + sliding `#nav-indicator` bar
11. `initContactForm()` — Formspree POST with honeypot, 3s timing check, 60s cooldown, French status messages
12. `DOMContentLoaded` handler — calls all init functions + `document.getElementById('year').textContent = new Date().getFullYear()`
13. `initCursorHalo()` — custom cursor ring + dot with lerp animation, hover/click states, hidden on touch devices (`pointer: coarse`), hides during typing game input, fades in CV iframe area
14. `initScrollHint()` — bouncing chevron, hidden after scroll > 80px or when typing game is focused
15. `initThemeToggle()` — theme toggle button with animated sun↔moon SVG

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
  details: { overview: '...', competences: [{ title: '...', items: ['...'] }],
             objectifs: '...', equipe: '...', travailIndividuel: '...',
             techDetails: ['...'], challenges: '...' }
}
```

**New skill:** Add `{ name: '...', icon: '...', description: '...', level: 3 }` to the appropriate group in `SKILL_GROUPS` in `js/data.js`.

**New track:** Add `{ title: '...', artist: '...', cover: 'assets/images/cover.jpg', src: 'assets/music/file.mp3' }` to `MUSIC` in `js/data.js`.

**New typing texts:** Add strings to the appropriate `lang.mode` array in `js/typing-texts.js`.

**New section:** Add semantic HTML in `index.html` with class `section` and an `id`, add corresponding CSS block in `styles.css`, add render/init function in `main.js`.

## Styling Rules

- Mobile-first responsive: base styles → `@media (max-width: 768px)` overrides
- `background-attachment: scroll` on body (mobile-friendly), light theme uses `background.jpg`, dark theme uses `background2.gif`
- Colors, fonts, spacing all via CSS custom properties in `:root`:
  - Colors: `--clr-bg` (#100f18), `--clr-surface` (#1b1a27), `--clr-primary` (#F2A285), `--clr-primary-hover` (#F28080), `--clr-accent` (#BF99A0), `--clr-text` (#e8e3e4), `--clr-text-muted` (#A1A1A6), `--clr-border` (#2c2a3a)
  - Typography: `--ff-body` (Segoe UI / system-ui), `--fs-base/lg/xl/2xl`
  - Spacing: `--section-padding`, `--container-width` (1100px), `--gap` (2rem)
  - Effects: `--radius` (0.5rem), `--shadow`, `--transition` (0.3s ease)
- Glass-morphism pattern: `rgba()` background + `backdrop-filter: blur()` (light theme only, disabled in dark theme with `backdrop-filter: none`)
- Dark theme: all overrides under `[data-theme="dark"]` selectors in each CSS file
- `styles.css` organized blocks: Variables & Reset, Layout, Header & Navigation, Buttons, Hero, Projects, Modal, Detail Modal, Skills, Skill Popup, Contact Form, Scroll Hint, Footer, CV Modal, Cursor Halo, Dark Theme, Responsive
- `typing-game.css` organized blocks: Base, Blur/Focus states, Navbar, Eye toggle, Hardcore, AI toggle/theme button/popup, Intro typewriter, Text display, Character states, Cursor (blink/combo/trail), Stats, Hints, Dark Theme, Responsive, Smartphone, Zen mode/popup
- `music-player.css` organized blocks: Container, Cover, Track info, Controls, Volume, Playlist dropdown, Responsive
- Modal scroll hints centered with `width: 100%; display: flex; justify-content: center`

## Contact Form

Form submits to Formspree (`https://formspree.io/f/mkovoawq`) with anti-spam measures: honeypot field (`_gotcha`, hidden via `display:none`), 3-second minimum timing check, 60-second cooldown between submissions. Status messages in French. Update `initContactForm()` in `main.js` to change the backend.

## AI Integration (Cloudflare Worker)

The typing game's AI mode uses a Cloudflare Worker as a proxy to the Google Gemini API (model: `gemini-2.0-flash`). The worker hides the API key and restricts requests to allowed origins.

- **Worker URL:** `https://gemini-proxy.colombatpaolo.workers.dev`
- **Request:** POST with `{ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 8192 } }`
- **Response parsing:** Extract `candidates[0].content.parts[0].text`, strip markdown code fences, parse JSON
- **Error handling:** HTTP 403 = origin blocked, HTTP 429 = rate limit, truncation detection (response not ending with `}`), JSON parse errors
- **Validation:** Checks for `fr`/`en` keys and all mode arrays (`10`, `25`, `50`, `100`)

## Important Implementation Details

- The `tryLockWord()` function scans forward from `lockedIndex`, locks everything up to the furthest correct word found. Wrong words before a correct word get locked too but don't count for WPM.
- `render()` uses direct span property comparisons (`span._cls !== cls`) to skip unnecessary DOM updates — this is the core performance optimization.
- The visualizer's `tryConnect()` is called every frame until it successfully connects to the music player's audio graph. It creates an `AnalyserNode` and inserts it in parallel with the destination.
- Popups (zen, hardcore, info, AI) all share the same overlay pattern: create overlay + popup div, force reflow, add `--visible` class, animate in. Close removes class, waits for `transitionend`, then removes from DOM.
- `MutationObserver` on `<html>` attribute changes re-renders the typing game on theme toggle (for trail/combo color updates).
- Cursor halo uses `requestAnimationFrame` with `lerp` for smooth ring/dot following, opacity transitions, and auto-pause when mouse isn't moving.

# Copilot Instructions — Portfolio

## Architecture

Static single-page portfolio — no build tools, no frameworks, no bundler.

```
index.html              ← Single entry point; all sections live here
css/styles.css          ← Main styles, organized by component blocks
css/typing-game.css     ← Typing game styles (hero mini-game)
css/music-player.css    ← Music player styles (navbar mini-player)
css/visualizer.css      ← Background canvas visualizer (full-screen)
js/data.js              ← Content data (PROJECTS, SKILL_GROUPS, MUSIC) — loaded first
js/typing-game.js       ← Self-contained IIFE — hero typing speed game
js/music-player.js      ← Self-contained IIFE — navbar mini music player
js/visualizer.js        ← Self-contained IIFE — background frequency bars + particles
js/main.js              ← DOM rendering & interactions — depends on data.js globals
assets/images/          ← Static images (background, project covers, music covers)
assets/music/           ← Audio files for the music player
assets/doc/             ← CV PDF
```

`index.html` loads scripts in order: `data.js` → `typing-game.js` → `music-player.js` → `visualizer.js` → `main.js`. Each IIFE boots on `DOMContentLoaded`. `main.js` initializes all non-game features in its own `DOMContentLoaded` handler.

## Key Conventions

### Data/View Separation

Content lives in `js/data.js` as plain arrays/objects:
- `PROJECTS` — array of project objects with `title`, `description`, `image`, `tags[]`, `demo`, `repo`, and rich `details` (overview, competences, objectifs, equipe, travailIndividuel, techDetails, challenges)
- `SKILL_GROUPS` — array of groups `{ label, skills: [{ name, icon, description, level }] }`, level is 1–5
- `MUSIC` — array of tracks `{ title, artist, cover, src }`

Rendering logic lives in `js/main.js`. To add a project, skill, or track, only edit `data.js`.

### CSS Naming — BEM-like

Classes follow `block__element--modifier` (e.g., `nav__link--active`, `project-card__body`, `typing-game__char--correct`). All design tokens are CSS custom properties in `:root` — change colors/sizing there, not in individual rules.

### Vanilla JS Only

No libraries. Use the `createElement(tag, className, textContent)` helper in `main.js` for DOM creation. Each feature has its own `init*()` function called from the `DOMContentLoaded` handler. Game, player, and visualizer are self-contained IIFEs with no exports.

### Self-Contained IIFEs

`typing-game.js`, `music-player.js`, and `visualizer.js` are each wrapped in an IIFE. They build their own DOM, manage their own state, and depend only on a container element in `index.html` (e.g., `#typing-game`, `#music-player`). The music player exposes its audio graph on `window` (`__musicPlayerAudioCtx`, `__musicPlayerSource`, `__musicPlayerGain`) for the visualizer to consume.

## Features

### Typing Game (`js/typing-game.js` + `css/typing-game.css`)
- **Modes:** `presentation` (hub), `10`, `25`, `50`, `100` (word count), `zen` (freeform)
- **Languages:** FR / EN — texts in `TEXTS` constant (League of Legends themed)
- **Combo system:** Streak at 10/30/60 adds glow tiers to cursor, color shifts at 50–100
- **Trail effect:** Behind-cursor trail scaled by combo + typing speed
- **Text background glow:** Dynamic opacity/border/shadow based on WPM (0–200 scale)
- **Hardcore mode:** 3s memorize → hidden text, no backspace, any error = fail. Only on `presentation` and `10` modes
- **Zen mode:** No fixed text, Shift+Space to finish. Words counted on space
- **First-visit:** White text on hub (`--first-visit` class) until first keypress sets `typing_played` cookie. Returns to white if navigating back to hub before typing
- **Cookies:** `typing_lang`, `typing_mode`, `typing_show_errors`, `typing_played`, `typing_best_{mode}`, `typing_zen_seen`, `typing_hardcore_seen`
- **Mobile:** Smartphones (`max-width: 600px` + `pointer: coarse`) get static text display, disabled navbar
- **Pause on blur:** Timer pauses when container loses focus, resumes on refocus

### Music Player (`js/music-player.js` + `css/music-player.css`)
- Mini player in the navbar with play/pause, prev/next, volume slider, mute toggle
- Playlist dropdown with cover art, auto-scroll to active track
- Shuffled on init (Fisher-Yates)
- Web Audio API: lazy `AudioContext` → `MediaElementSource` → `GainNode`. Skips Web Audio on `file:` protocol
- Exposes audio graph on `window` for visualizer

### Visualizer (`js/visualizer.js` + `css/visualizer.css`)
- Full-screen fixed `<canvas>` behind all content
- 64 frequency bars with gradient fill, rising from bottom
- 60 particles reacting to frequency data, connected by proximity lines
- Impulse system: click = repel, keypress = glow burst
- Connects to music player audio graph each frame

### Main Features (`js/main.js`)
- **Projects:** Grid of 3 cards + "Voir tous les projets" button → all-projects modal → detail modal with rich content sections
- **Skills:** Grouped grid (2 columns), first 2 groups visible, toggle to reveal all. Click a skill → popup with icon, description, animated level bar (1–5 dots)
- **Contact form:** Formspree POST with honeypot anti-spam, 3s timing check, 60s cooldown, status messages
- **CV modal:** PDF viewer (iframe) + download button (`assets/doc/CV_Paolo.pdf`)
- **Cursor halo:** Custom cursor ring + dot with lerp animation, hover/click states, hidden on touch devices
- **Scroll spy:** Active nav link highlighting + sliding indicator bar
- **Scroll hint:** Bouncing chevron, hidden after scroll or when typing game is focused
- **Mobile nav:** Hamburger toggle with X animation, slide-in drawer

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

**New section:** Add semantic HTML in `index.html` with class `section` and an `id`, add corresponding CSS block in `styles.css`, add render/init function in `main.js`.

## Styling Rules

- Mobile-first responsive: base styles → `@media (max-width: 768px)` overrides
- Colors, fonts, spacing all via CSS custom properties in `:root`:
  - Colors: `--clr-bg` (#100f18), `--clr-surface` (#1b1a27), `--clr-primary` (#F2A285), `--clr-primary-hover` (#F28080), `--clr-accent` (#BF99A0), `--clr-text` (#e8e3e4), `--clr-text-muted` (#A1A1A6), `--clr-border` (#2c2a3a)
  - Typography: `--ff-body`, `--fs-base/lg/xl/2xl`
  - Spacing: `--section-padding`, `--container-width`, `--gap`
  - Effects: `--radius`, `--shadow`, `--transition`
- Dark theme by default with fixed background image (`assets/images/background.jpg`)
- Glass-morphism pattern: `rgba()` background + `backdrop-filter: blur()`
- `styles.css` organized blocks: Variables & Reset, Layout, Header & Navigation, Buttons, Hero, Projects, Modal, Detail Modal, Skills, Skill Popup, Contact Form, Scroll Hint, Footer, CV Modal, Cursor Halo, Responsive
- `typing-game.css` organized blocks: Base, Blur/Focus states, Navbar, Eye toggle, Text display, Character states, Cursor (blink/combo/trail), Stats, Hints, Responsive, Smartphone, Zen mode, Zen popup, Hardcore mode
- `music-player.css` organized blocks: Container, Cover, Track info, Controls, Volume, Playlist dropdown, Responsive

## Contact Form

Form submits to Formspree (`https://formspree.io/f/mkovoawq`) with anti-spam measures: honeypot field, 3-second minimum timing check, 60-second cooldown between submissions. Status messages in French. Update `initContactForm()` in `main.js` to change the backend.

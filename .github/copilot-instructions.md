# Copilot Instructions — Portfolio

## Architecture

Static single-page portfolio — no build tools, no frameworks, no bundler.

```
index.html          ← Single entry point; all sections live here
css/styles.css      ← All styles in one file, organized by component blocks
js/data.js          ← Content data (PROJECTS, SKILLS arrays) — loaded first
js/main.js          ← DOM rendering & interactions — depends on data.js globals
assets/images/      ← Static images (profile photo, project screenshots)
```

`index.html` loads scripts in order: `data.js` then `main.js`. Everything initializes on `DOMContentLoaded`.

## Key Conventions

### Data/View Separation

Content lives in `js/data.js` as plain arrays (`PROJECTS`, `SKILLS`). Rendering logic lives in `js/main.js`. To add a project or skill, only edit `data.js` — never hardcode content in HTML.

### CSS Naming — BEM-like

Classes follow `block__element--modifier` (e.g., `nav__link--active`, `project-card__body`). All design tokens are CSS custom properties in `:root` — change colors/sizing there, not in individual rules.

### Vanilla JS Only

No libraries. Use the `createElement(tag, className, textContent)` helper in `main.js` for DOM creation. Each feature has its own `init*()` function called from the `DOMContentLoaded` handler.

## Development

Open `index.html` directly in a browser, or use any static server:

```sh
# Python
python -m http.server 8000

# Node (npx)
npx serve .

# VS Code Live Server extension
```

No install step. No build step. No environment variables.

## Adding Content

**New project:** Add an object to `PROJECTS` in `js/data.js`:
```js
{ title: '...', description: '...', image: 'assets/images/project-N.jpg', tags: ['HTML','CSS'], demo: 'https://...', repo: 'https://...' }
```

**New skill:** Add `{ name: '...', icon: '...' }` to `SKILLS` in `js/data.js`.

**New section:** Add semantic HTML in `index.html` with class `section` and an `id`, add corresponding CSS block in `styles.css`, add render/init function in `main.js`.

## Styling Rules

- Mobile-first responsive: base styles → `@media (max-width: 768px)` overrides
- Colors, fonts, spacing all via `--clr-*`, `--ff-*`, `--fs-*`, `--gap`, `--radius` custom properties in `:root`
- Dark theme by default (`--clr-bg: #0f172a`)
- CSS file is organized in labeled comment blocks: Variables, Layout, Header, Buttons, Hero, About, Projects, Skills, Contact, Footer, Responsive

## Contact Form

Form submission is a placeholder (`alert` + `reset`). When connecting a real service, update `initContactForm()` in `main.js`. No backend exists in this project.

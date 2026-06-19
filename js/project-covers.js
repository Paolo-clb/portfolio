/**
 * project-covers.js — Inline, theme-aware SVG cover art for projects.
 *
 * These covers are inlined into the DOM (NOT loaded through <img>) so they
 * inherit the site's theme CSS variables (--clr-primary, --clr-accent,
 * --clr-surface, …) and recolor automatically when the user switches theme.
 *
 * Referenced from js/data.js via a project's `cover` key and rendered inline
 * by js/main.js (with a graceful fallback to `project.image` if missing).
 * Each SVG uses a 16:9 viewBox to match the card image frame.
 */
window.PROJECT_COVERS = {
  // Concevoir une base de données — entity/relationship schema (linked tables)
  'db-design': `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Schéma entité-association">
  <defs>
    <linearGradient id="cvd-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--clr-surface)"/>
      <stop offset="1" style="stop-color:var(--clr-bg)"/>
    </linearGradient>
    <radialGradient id="cvd-gl" cx="0.5" cy="0.3" r="0.75">
      <stop offset="0" style="stop-color:var(--clr-primary)" stop-opacity="0.22"/>
      <stop offset="1" style="stop-color:var(--clr-primary)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#cvd-bg)"/>
  <rect width="640" height="360" fill="url(#cvd-gl)"/>
  <g fill="none" style="stroke:var(--clr-accent)" stroke-width="2.5" stroke-opacity="0.8">
    <path d="M220 144 H320 V208 H410"/>
    <path d="M490 266 V300 H225 V262"/>
  </g>
  <g style="fill:var(--clr-accent)">
    <circle cx="220" cy="144" r="5"/><circle cx="410" cy="208" r="5"/>
    <circle cx="490" cy="266" r="5"/><circle cx="225" cy="262" r="5"/>
  </g>
  <rect x="70" y="92" width="150" height="104" rx="10" style="fill:var(--clr-surface);stroke:var(--clr-primary)" stroke-width="2"/>
  <path d="M70 102 a10 10 0 0 1 10 -10 h130 a10 10 0 0 1 10 10 v18 h-150 z" style="fill:var(--clr-primary)"/>
  <g style="stroke:var(--clr-text-muted)" stroke-width="6" stroke-opacity="0.4" stroke-linecap="round">
    <line x1="86" y1="142" x2="182" y2="142"/><line x1="86" y1="162" x2="158" y2="162"/><line x1="86" y1="182" x2="172" y2="182"/>
  </g>
  <rect x="410" y="150" width="160" height="116" rx="10" style="fill:var(--clr-surface);stroke:var(--clr-primary)" stroke-width="2"/>
  <path d="M410 160 a10 10 0 0 1 10 -10 h140 a10 10 0 0 1 10 10 v18 h-160 z" style="fill:var(--clr-primary)"/>
  <g style="stroke:var(--clr-text-muted)" stroke-width="6" stroke-opacity="0.4" stroke-linecap="round">
    <line x1="426" y1="200" x2="540" y2="200"/><line x1="426" y1="220" x2="512" y2="220"/><line x1="426" y1="240" x2="548" y2="240"/>
  </g>
  <rect x="150" y="262" width="150" height="76" rx="10" style="fill:var(--clr-surface);stroke:var(--clr-primary)" stroke-width="2"/>
  <path d="M150 272 a10 10 0 0 1 10 -10 h130 a10 10 0 0 1 10 10 v16 h-150 z" style="fill:var(--clr-primary)"/>
  <g style="stroke:var(--clr-text-muted)" stroke-width="6" stroke-opacity="0.4" stroke-linecap="round">
    <line x1="166" y1="310" x2="262" y2="310"/><line x1="166" y1="326" x2="236" y2="326"/>
  </g>
</svg>`,

  // Exploiter une base de données — data-viz analytics (bars + trend curve)
  'db-explore': `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Graphique d'analyse de données">
  <defs>
    <linearGradient id="cve-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--clr-surface)"/>
      <stop offset="1" style="stop-color:var(--clr-bg)"/>
    </linearGradient>
    <radialGradient id="cve-gl" cx="0.5" cy="0.25" r="0.8">
      <stop offset="0" style="stop-color:var(--clr-accent)" stop-opacity="0.2"/>
      <stop offset="1" style="stop-color:var(--clr-accent)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#cve-bg)"/>
  <rect width="640" height="360" fill="url(#cve-gl)"/>
  <g style="stroke:var(--clr-text-muted)" stroke-opacity="0.16" stroke-width="2">
    <line x1="96" y1="110" x2="560" y2="110"/><line x1="96" y1="160" x2="560" y2="160"/>
    <line x1="96" y1="210" x2="560" y2="210"/><line x1="96" y1="260" x2="560" y2="260"/>
  </g>
  <g style="fill:var(--clr-primary)" fill-opacity="0.85">
    <rect x="120" y="206" width="48" height="84" rx="5"/>
    <rect x="200" y="156" width="48" height="134" rx="5"/>
    <rect x="280" y="232" width="48" height="58" rx="5"/>
    <rect x="360" y="128" width="48" height="162" rx="5"/>
    <rect x="440" y="184" width="48" height="106" rx="5"/>
  </g>
  <line x1="96" y1="290" x2="560" y2="290" style="stroke:var(--clr-text-muted)" stroke-width="3" stroke-opacity="0.5"/>
  <polyline points="144,206 224,156 304,200 384,118 464,150" fill="none" style="stroke:var(--clr-accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <g style="fill:var(--clr-accent)">
    <circle cx="144" cy="206" r="6.5"/><circle cx="224" cy="156" r="6.5"/><circle cx="304" cy="200" r="6.5"/><circle cx="384" cy="118" r="6.5"/><circle cx="464" cy="150" r="6.5"/>
  </g>
</svg>`,

  // Comparer des approches algorithmiques — K-NN classification cluster graph
  'algorithms': `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Graphe de classification K-NN">
  <defs>
    <linearGradient id="cva-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--clr-surface)"/>
      <stop offset="1" style="stop-color:var(--clr-bg)"/>
    </linearGradient>
    <radialGradient id="cva-gl" cx="0.5" cy="0.5" r="0.6">
      <stop offset="0" style="stop-color:var(--clr-primary)" stop-opacity="0.18"/>
      <stop offset="1" style="stop-color:var(--clr-primary)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#cva-bg)"/>
  <rect width="640" height="360" fill="url(#cva-gl)"/>
  <g style="stroke:var(--clr-text-muted)" stroke-width="2" stroke-opacity="0.55" stroke-dasharray="2 7" stroke-linecap="round">
    <line x1="320" y1="180" x2="168" y2="104"/>
    <line x1="320" y1="180" x2="196" y2="250"/>
    <line x1="320" y1="180" x2="250" y2="92"/>
    <line x1="320" y1="180" x2="470" y2="124"/>
    <line x1="320" y1="180" x2="492" y2="244"/>
  </g>
  <g style="fill:var(--clr-primary)">
    <circle cx="168" cy="104" r="17"/><circle cx="120" cy="158" r="11"/>
    <circle cx="250" cy="92" r="10"/><circle cx="196" cy="250" r="15"/>
    <circle cx="128" cy="232" r="9"/>
  </g>
  <g style="fill:var(--clr-accent)">
    <circle cx="470" cy="124" r="17"/><circle cx="514" cy="178" r="11"/>
    <circle cx="492" cy="244" r="15"/><circle cx="436" cy="214" r="9"/>
    <circle cx="540" cy="110" r="9"/>
  </g>
  <circle cx="320" cy="180" r="23" style="fill:var(--clr-surface);stroke:var(--clr-text)" stroke-width="3"/>
  <circle cx="320" cy="180" r="7" style="fill:var(--clr-text)"/>
</svg>`,
};

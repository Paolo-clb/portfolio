// === effectsV3.js - Version optimisée ===
const CURSOR_CONFIG = {
  particleSize: 6,
  particleCount: 12,
  colors: ['#9c27b0', '#6a0dad', '#3f51b5'],
  trailLength: 20,
  baseSpeed: 0.2
};

const createElement = (tag, className, styles) => {
  const el = document.createElement(tag);
  el.className = className;
  Object.assign(el.style, styles);
  return el;
};

// Curseur principal
const cursor = createElement('div', 'cyber-cursor', {
  position: 'fixed',
  width: `${CURSOR_CONFIG.particleSize * 2}px`,
  height: `${CURSOR_CONFIG.particleSize * 2}px`,
  border: `2px solid ${CURSOR_CONFIG.colors[0]}`,
  borderRadius: '50%',
  pointerEvents: 'none',
  zIndex: '9999',
  transform: 'translate(-50%, -50%)',
  mixBlendMode: 'screen',
  transition: 'transform 0.1s ease'
});
document.body.appendChild(cursor);


// Particules
const particles = Array.from({ length: CURSOR_CONFIG.particleCount }, (_, i) => {
  const p = createElement('div', 'pixel-particle', {
    position: 'fixed',
    width: `${CURSOR_CONFIG.particleSize}px`,
    height: `${CURSOR_CONFIG.particleSize}px`,
    background: CURSOR_CONFIG.colors[i % CURSOR_CONFIG.colors.length],
    borderRadius: '1px',
    pointerEvents: 'none',
    zIndex: '9998',
    transform: 'translate(-50%, -50%)',
    opacity: '0'
  });
  document.body.appendChild(p);
  return p;
});

let mousePos = { x: 0, y: 0 };
let trailPositions = Array(CURSOR_CONFIG.trailLength).fill(mousePos);

const updateParticles = () => {
  particles.forEach((p, i) => {
    const targetPos = trailPositions[
      Math.floor(i * (CURSOR_CONFIG.trailLength / CURSOR_CONFIG.particleCount))
    ] || trailPositions[0];
    
    const currentPos = {
      x: parseFloat(p.style.left) || targetPos.x,
      y: parseFloat(p.style.top) || targetPos.y
    };

    const newPos = {
      x: currentPos.x + (targetPos.x - currentPos.x) * CURSOR_CONFIG.baseSpeed,
      y: currentPos.y + (targetPos.y - currentPos.y) * CURSOR_CONFIG.baseSpeed
    };

    const fade = 1 - (i / CURSOR_CONFIG.particleCount);
    
    Object.assign(p.style, {
      left: `${newPos.x}px`,
      top: `${newPos.y}px`,
      opacity: 0.7 * fade,
      transform: `translate(-50%, -50%) scale(${0.5 + fade * 0.5})`
    });
  });
  requestAnimationFrame(updateParticles);
};

// Écouteurs d'événements
document.addEventListener('mousemove', ({ clientX, clientY }) => {
  mousePos = { x: clientX, y: clientY };
  Object.assign(cursor.style, {
    left: `${mousePos.x}px`,
    top: `${mousePos.y}px`
  });
  trailPositions = [mousePos, ...trailPositions.slice(0, -1)];
});

// Accessibilité
const handleReducedMotion = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.toggle('reduced-motion', reduceMotion);
  if (reduceMotion) {
    cursor.style.display = 'none';
    particles.forEach(p => p.style.display = 'none');
  }
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  handleReducedMotion();
  window.matchMedia('(prefers-reduced-motion: reduce)')
    .addEventListener('change', handleReducedMotion);
  
  updateParticles();
});

// Scroll progress
window.addEventListener('scroll', () => {
  const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
  document.querySelector('.scroll-progress')?.style.setProperty('--progress', `${scrollPercent}%`);
});
// === effects.js - Curseur animé et particules ===

const config = {
    particleSize: 6,
    particleCount: 12,
    colors: ['#9c27b0', '#6a0dad', '#3f51b5'],
    trailLength: 20,
    baseSpeed: 0.2
};

// Curseur principal
const cursor = Object.assign(document.createElement('div'), {
    className: 'cyber-cursor',
    style: `
        position: fixed;
        width: ${config.particleSize * 2}px;
        height: ${config.particleSize * 2}px;
        border: 2px solid ${config.colors[0]};
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%);
        mix-blend-mode: screen;
        transition: transform 0.1s ease;
    `
});
document.body.appendChild(cursor);

// Particules
const particles = Array.from({ length: config.particleCount }, () => {
    const p = document.createElement('div');
    p.className = 'pixel-particle';
    p.style.cssText = `
        position: fixed;
        width: ${config.particleSize}px;
        height: ${config.particleSize}px;
        background: ${config.colors[Math.floor(Math.random() * config.colors.length)]};
        border-radius: 1px;
        pointer-events: none;
        z-index: 9998;
        transform: translate(-50%, -50%);
        opacity: 0;
    `;
    document.body.appendChild(p);
    return p;
});

let mousePos = { x: 0, y: 0 };
let lastPositions = Array(config.trailLength).fill({ x: 0, y: 0 });

document.addEventListener('mousemove', ({ clientX, clientY }) => {
    mousePos = { x: clientX, y: clientY };
    cursor.style.left = `${mousePos.x}px`;
    cursor.style.top = `${mousePos.y}px`;
    lastPositions.pop();
    lastPositions.unshift({ x: clientX, y: clientY });
});

function animate() {
    requestAnimationFrame(animate);
    particles.forEach((p, i) => {
        const posIndex = Math.floor(i * (config.trailLength / config.particleCount));
        const target = lastPositions[posIndex] || lastPositions[0];
        const current = {
            x: parseFloat(p.style.left) || target.x,
            y: parseFloat(p.style.top) || target.y
        };
        const newX = current.x + (target.x - current.x) * config.baseSpeed;
        const newY = current.y + (target.y - current.y) * config.baseSpeed;
        const fade = 1 - (i / config.particleCount);
        p.style.left = `${newX}px`;
        p.style.top = `${newY}px`;
        p.style.opacity = `${0.7 * fade}`;
        p.style.transform = `translate(-50%, -50%) scale(${0.5 + fade * 0.5})`;
    });
}
animate();

// Accessibilité : désactive l'animation sur préférence utilisateur
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.cv-button').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.animation = 'none';
        });
    });
}
window.addEventListener('scroll', () => {
    const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    document.querySelector('.scroll-progress').style.height = `${scrollPercent}%`;
});

document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggle-animations');
  const controlText = toggleBtn.querySelector('.control-text');
  
  // Initialisation plus sûre
  function initAnimations() {
    const reduced = localStorage.getItem('animationsReduced') === 'true';
    document.body.classList.toggle('animations-reduced', reduced);
    toggleBtn.setAttribute('aria-pressed', reduced);
    controlText.textContent = reduced ? 'Animations_ OFF' : 'Animations_ ON';
    
    // Force le reflow pour éviter les bugs visuels
    document.body.clientHeight;
  }

  toggleBtn.addEventListener('click', function() {
    const isPressed = this.getAttribute('aria-pressed') === 'true';
    localStorage.setItem('animationsReduced', String(!isPressed));
    initAnimations();
  });

  initAnimations();

  // Burger menu logic
  const burger = document.querySelector('.burger-menu');
  const navList = document.querySelector('.header-right ul');
  if (burger && navList) {
      burger.addEventListener('click', function() {
          const isOpen = navList.classList.toggle('open');
          burger.setAttribute('aria-expanded', isOpen);
          burger.classList.toggle('open', isOpen); // Ajoute/retire la classe open sur le bouton
      });
  }
});

window.addEventListener('scroll', function() {
    const header = document.querySelector('header');
    if (window.scrollY > 10) {
        header.classList.add('header-scrolled');
    } else {
        header.classList.remove('header-scrolled');
    }
});

function showCopied(btn, text) {
        navigator.clipboard.writeText(text);
        let msg = document.createElement('span');
        msg.textContent = 'Copié !';
        msg.className = 'copied-msg';
        btn.parentNode.style.position = 'relative';
        msg.style.position = 'absolute';
        msg.style.left = '50%';
        msg.style.transform = 'translateX(-50%)';
        msg.style.bottom = '120%';
        msg.style.background = '#3f51b5';
        msg.style.color = '#fff';
        msg.style.padding = '2px 10px';
        msg.style.borderRadius = '6px';
        msg.style.fontSize = '0.9em';
        msg.style.boxShadow = '0 2px 8px #6a0dad44';
        msg.style.opacity = '1';
        msg.style.transition = 'opacity 0.4s';
        btn.parentNode.appendChild(msg);
        setTimeout(() => { msg.style.opacity = '0'; }, 1600);
        setTimeout(() => { if(msg.parentNode) msg.parentNode.removeChild(msg); }, 2000);
    }

// Animation console cyberpunk dans le hero
document.addEventListener("DOMContentLoaded", function() {
  const prompt = "portfolio@paolo:~$ ";
  const lines = [
    "echo 'Bienvenue sur mon portfolio !'",
    "Bienvenue sur le terminal interactif.",
    "Tapez 'help' pour voir les commandes disponibles."
  ];
  const consoleElem = document.getElementById("bash-console");
  if (!consoleElem) return;

  let lineIdx = 0;
  let charIdx = 0;
  let displayText = prompt; // Premier prompt affiché dès le chargement
  let cursorVisible = true;
  let typing = false;
  let cursorInterval;

  renderConsole();

  function renderConsole() {
    consoleElem.textContent = displayText + (typing || cursorVisible ? "_" : " ");
  }

  function startCursorBlink() {
    if (cursorInterval) clearInterval(cursorInterval);
    cursorInterval = setInterval(() => {
      cursorVisible = !cursorVisible;
      renderConsole();
    }, 500);
  }

  function stopCursorBlink() {
    if (cursorInterval) clearInterval(cursorInterval);
    cursorVisible = true;
    renderConsole();
  }

  function typeLine() {
    typing = true;
    const currentLine = lines[lineIdx];
    if (charIdx < currentLine.length) {
      displayText += currentLine[charIdx];
      charIdx++;
      renderConsole();
      setTimeout(typeLine, 60);
    } else {
      typing = false;
      displayText += "\n";
      renderConsole();
      lineIdx++;
      charIdx = 0;
      if (lineIdx < lines.length) {
        // Ajoute le prompt d'un coup puis attend avant d'écrire la suite
        displayText += prompt;
        renderConsole();
        setTimeout(typeLine, 300); // délai avant d'écrire la prochaine ligne
      } else {
        // Après la dernière ligne, affiche un prompt sur la ligne suivante immédiatement
        displayText += prompt;
        renderConsole();
        startCursorBlink();
      }
    }
  }

  startCursorBlink();
  setTimeout(() => {
    stopCursorBlink();
    setTimeout(typeLine, 600); // délai avant d'écrire la première ligne
  }, 700);

  setInterval(() => {
    if (!typing) renderConsole();
  }, 500);
});
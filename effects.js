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



document.addEventListener('mousemove', ({ clientX, clientY }) => {
    mousePos = { x: clientX, y: clientY };
    cursor.style.left = `${mousePos.x}px`;
    cursor.style.top = `${mousePos.y}px`;
    lastPositions.pop();
    lastPositions.unshift({ x: clientX, y: clientY });
});



document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add('loaded');

    // Burger menu logic
    const burger = document.querySelector('.burger-menu');
    const navList = document.querySelector('.header-right ul');
    if (burger && navList) {
        burger.addEventListener('click', function() {
            const isOpen = navList.classList.toggle('open');
            burger.setAttribute('aria-expanded', isOpen);
            burger.classList.toggle('open', isOpen);
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

// Barre de progression de scroll cyberpunk
window.addEventListener('scroll', function() {
    const progressBar = document.querySelector('.scroll-progress');
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) : 0;
    if (progressBar) {
        progressBar.style.height = `${scrollPercent * 100}%`;
    }
});

// Animation console cyberpunk dans le hero
document.addEventListener("DOMContentLoaded", function() {
    const prompt = "portfolio@paolo:~$ ";
    const lines = [
        "Bienvenue, pour me présenter succintement :",
        "Je suis titulaire d'un Bac NSI/math mention bien,",
        "Actuellement en BUT INFO à l'IUT2 de Grenoble.",
        "J'aspire à devenir développeur d'applications !",
    ];
    const consoleElem = document.getElementById("bash-console");
    if (!consoleElem) return;

    // Vérifie si l'animation a déjà été jouée
    const alreadyPlayed = localStorage.getItem('consoleAnimationPlayed') === 'true';

    let lineIdx = 0;
    let charIdx = 0;
    let displayText = prompt;   
    let cursorVisible = true;
    let typing = false;
    let cursorInterval;

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
                displayText += prompt;
                renderConsole();
                setTimeout(typeLine, 300);
            } else {
                displayText += prompt;
                renderConsole();
                startCursorBlink();
                // Marque l'animation comme jouée
                localStorage.setItem('consoleAnimationPlayed', 'true');
            }
        }
    }

    if (alreadyPlayed) {
        // Affiche tout le texte directement
        displayText = prompt;
        for (let i = 0; i < lines.length; i++) {
            displayText += lines[i] + "\n" + prompt;
        }
        renderConsole();
        startCursorBlink();
    } else {
        startCursorBlink();
        setTimeout(() => {
            stopCursorBlink();
            setTimeout(typeLine, 600);
        }, 700);

        setInterval(() => {
            if (!typing) renderConsole();
        }, 500);
    }
});

// Mail popup modal logic
document.addEventListener('DOMContentLoaded', function() {
    const openBtn = document.getElementById('openMailPopup');
    const closeBtn = document.getElementById('closeMailPopup');
    const modal = document.getElementById('mailModal');
    if (openBtn && closeBtn && modal) {
        openBtn.addEventListener('click', () => {
            modal.classList.add('open');
            setTimeout(() => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }, 100); // 100ms pour laisser le temps à la modale de s'afficher
        });
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('open');
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('open');
        });
    }
    // Désactive l'envoi réel du formulaire
    const mailForm = document.querySelector('.mail-form');
    if (mailForm) {
        mailForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert("L'envoi de mail n'est pas disponible sur ce site.");
        });
    }
});
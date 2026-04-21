/* ==========================================================================
   Site-wide Translations (FR / EN)
   Loaded before main.js. Exposed as window.SITE_I18N.
   Does NOT include typing-game UI text (see typing-game-i18n.js).
   ========================================================================== */

window.SITE_I18N = {
  fr: {
    // Nav
    navHome: 'Accueil',
    navProjects: 'Projets',
    navSkills: 'Compétences',
    navCv: 'CV',
    navContact: 'Contact',

    // Section titles
    sectionProjects: 'Projets',
    sectionSkills: 'Compétences',
    sectionCv: 'Curriculum Vitae',
    sectionContact: 'Contact',

    // Projects
    viewAllProjects: 'Voir tous les projets',
    allProjectsTitle: 'Tous les projets',
    learnMore: 'En savoir plus',

    // Project detail headings
    detailDescription: 'Description',
    detailCompetences: 'Compétences mobilisées',
    detailObjectives: 'Objectifs',
    detailTeamwork: 'Travail en groupe',
    detailIndividual: 'Travail individuel',
    detailTech: 'Techniques et savoir-faire acquis',
    detailChallenges: 'Défis rencontrés',

    // Skills
    viewAllSkills: 'Voir toutes les compétences',
    viewLess: 'Voir moins',

    // Skill popup
    levelLabel: 'Expérience',
    level1: 'Débutant',
    level2: 'Junior',
    level3: 'Intermédiaire',
    level4: 'Avancé',
    level5: 'Expert',

    // Contact form
    labelName: 'Nom',
    labelEmail: 'Email',
    labelMessage: 'Message',
    submitBtn: 'Envoyer le message',
    msgSending: 'Envoi en cours...',
    msgSuccess: 'Message envoyé avec succès !',
    msgTimingError: 'Veuillez patienter avant d\'envoyer.',
    msgCooldown: 'Veuillez attendre {s}s avant de renvoyer.',
    msgServerError: 'Erreur lors de l\'envoi. Réessayez plus tard.',
    msgNetworkError: 'Erreur réseau. Vérifiez votre connexion.',
    msgCooldownBtn: 'Patienter {s}s',

    // CV
    cvDownload: 'Télécharger le CV',

    // Footer
    footerText: 'Paolo Colombat. Cherche une alternance',

    // Rain
    rainEnable: 'Activer la pluie',
    rainDisable: 'Désactiver la pluie',

    // Animation controls
    animSpeed: 'Vitesse',
    animDisable: 'Désactiver les animations',
    animEnable: 'Activer les animations',
    animSlowMotion: 'Ralenti',
    animNormal: 'Normal',
    animSpeedTooltip: 'Za Warudo ! (pluie et musique recommandées)',
    backToTop: 'Retour en haut',
    settingsTitle: 'Réglages',
    yoloMode: 'Mode Yolo',
    copilotLink: 'Mon Copilot',
    copilotTooltip: 'Portfolio d\'Enzo — collègue de projets et de pair programming',

    // Lang toggle
    langTooltip: 'Switch to English',

    // Theme toggle
    themeToDark: 'Passer au thème nuit',
    themeToNature: 'Passer au thème nature',
    themeToLight: 'Passer au thème jour',

    // Weak device warning
    weakWarningTitle: 'Animations désactivées',
    weakWarningMsg: 'Les animations du site semblent trop lourdes pour votre appareil et ont été désactivées automatiquement pour éviter les ralentissements.',
    weakWarningCta: 'Activer quand même',
    weakWarningLag: 'Vous pouvez tout de même les activer, mais cela risque de provoquer des lags.',
    weakWarningDismiss: 'OK, compris',
    weakLagToast: 'Animations activées (performances réduites possibles)',

    // Light Again
    lightAgainPlay: 'Jouer à Light Again',
    lightAgainTagline: 'Jeu Canvas 2D · En développement',
    lightAgainHelp:      'Aide',
    lightAgainPause:     'Mettre en pause',
    lightAgainResume:    'Reprendre',
    lightAgainHelpTitle: 'Comment jouer',
    lightAgainHelpMove:   'Se déplacer',
    lightAgainHelpDash:   'Dash',
    lightAgainHelpAttack: 'Attaque Torpille',
    lightAgainHelpDashAtk: 'Dash-Attaque',
    lightAgainHelpParry:   'Parade (X2 points !)',
    lightAgainHelpNuke:    'Détonation',
    // Game Over screen
    laGoScore:      'Score',
    laGoBestCombo:  'Meilleur combo',
    laGoKills:      'Ennemis éliminés',
    laGoRecord:     'Record personnel',
    laGoReplay:     'Rejouer',
    laGoEnterHint:  'ou appuie sur Entrée',
    laGoWorldRecord:'Top 10 mondial',
    laGoLoading:    'Chargement…',
    laGoRestarting: 'Relance…',
    laGoError:      'Hors-ligne',
    laGoSubmit:     'Soumettre',
    laGoSubmitted:  'Envoyé !',
    laGoNewRecord:  'Nouveau record !',
    laGoNamePlc:    'Ton pseudo',

    // Upgrade system (roguelite draft)
    laUpTitle:           'Choisis une amélioration',
    laUpDashAtkName:     'Dash-Attaque',
    laUpDashAtkDesc1:    'Attaque plus longue et plus rapide.',
    laUpDashAtkDesc2:    'Le dash attaque renvoi les projectiles à distance.',
    laUpDetonationName:  'Détonation',
    laUpDetonationDesc1: 'Les marques sur les ennemis durent 2 fois plus longtemps.',
    laUpDetonationDesc2: 'Le rayon de la détonation est 1.5× plus grand.',
    laUpDashName:        'Dash',
    laUpDashDesc1:       'Dash plus rapide et plus long, récupération plus courte.',
    laUpDashDesc2:       '1 Dash sur 3 laisse une tornade qui aspire les ennemis proches.',
    laUpBaseAtkName:     'Attaque Torpille',
    laUpBaseAtkDesc1:    'L\'attaque Torpille a une chance de laisser une explosion à retardement à l\'impact.',
    laUpBaseAtkDesc2:    'Augmente la taille et double la probabilité des explosions à retardement.',
    laUpAvailable:       'Amélioration disponible…',
    laUpShield:          'Shield',
    laUpShieldName:      'Shield',
    laUpShieldDesc1:     '+1 emplacement de shield supplémentaire.',
    laUpShieldDesc2:     '+1 emplacement de shield supplémentaire.',
    laUpTheWorldName:    'The World',
    laUpTheWorldDesc1:   'Le clic molette arrête le temps et rend invincible pendant 4 secondes. (Cooldown : 30s)',
    laDelayExp:          'Explosion Retardée',

    // Misc
    closeLbl: 'Fermer',
    switchLang: 'English',
  },
  en: {
    // Nav
    navHome: 'Home',
    navProjects: 'Projects',
    navSkills: 'Skills',
    navCv: 'Resume',
    navContact: 'Contact',

    // Section titles
    sectionProjects: 'Projects',
    sectionSkills: 'Skills',
    sectionCv: 'Resume',
    sectionContact: 'Contact',

    // Projects
    viewAllProjects: 'View all projects',
    allProjectsTitle: 'All projects',
    learnMore: 'Learn more',

    // Project detail headings
    detailDescription: 'Description',
    detailCompetences: 'Skills applied',
    detailObjectives: 'Objectives',
    detailTeamwork: 'Teamwork',
    detailIndividual: 'Individual contribution',
    detailTech: 'Technical skills acquired',
    detailChallenges: 'Challenges encountered',

    // Skills
    viewAllSkills: 'View all skills',
    viewLess: 'View less',

    // Skill popup
    levelLabel: 'Experience',
    level1: 'Beginner',
    level2: 'Junior',
    level3: 'Intermediate',
    level4: 'Advanced',
    level5: 'Expert',

    // Contact form
    labelName: 'Name',
    labelEmail: 'Email',
    labelMessage: 'Message',
    submitBtn: 'Send message',
    msgSending: 'Sending...',
    msgSuccess: 'Message sent successfully!',
    msgTimingError: 'Please wait before sending.',
    msgCooldown: 'Please wait {s}s before resending.',
    msgServerError: 'Error sending. Please try again later.',
    msgNetworkError: 'Network error. Check your connection.',
    msgCooldownBtn: 'Wait {s}s',

    // CV
    cvDownload: 'Download resume',

    // Footer
    footerText: 'Paolo Colombat. Looking for an apprenticeship',

    // Rain
    rainEnable: 'Enable rain',
    rainDisable: 'Disable rain',

    // Animation controls
    animSpeed: 'Speed',
    animDisable: 'Disable animations',
    animEnable: 'Enable animations',
    animSlowMotion: 'Slow motion',
    animNormal: 'Normal',
    animSpeedTooltip: 'Za Warudo ! (rain and music recommended)',
    backToTop: 'Back to top',
    settingsTitle: 'Settings',
    yoloMode: 'Yolo Mode',
    copilotLink: 'My Copilot',
    copilotTooltip: 'Enzo\'s portfolio — project colleague and pair programming partner',

    // Lang toggle
    langTooltip: 'Passer en Français',

    // Theme toggle
    themeToDark: 'Switch to dark theme',
    themeToNature: 'Switch to nature theme',
    themeToLight: 'Switch to light theme',

    // Weak device warning
    weakWarningTitle: 'Animations disabled',
    weakWarningMsg: 'The site\'s animations appear too resource-intensive for your device and have been automatically disabled to prevent lag.',
    weakWarningCta: 'Enable anyway',
    weakWarningLag: 'You can still enable them, but this may cause lag.',
    weakWarningDismiss: 'OK, got it',
    weakLagToast: 'Animations enabled (reduced performance possible)',

    // Light Again
    lightAgainPlay: 'Play Light Again',
    lightAgainTagline: 'Canvas 2D game · In development',
    lightAgainHelp:      'Help',
    lightAgainPause:     'Pause',
    lightAgainResume:    'Resume',
    lightAgainHelpTitle: 'How to play',
    lightAgainHelpMove:   'Move',
    lightAgainHelpDash:   'Dash',
    lightAgainHelpAttack: 'Torpedo Attack',
    lightAgainHelpDashAtk: 'Dash-Attack',
    lightAgainHelpParry:   'Parry (X2 points !)',
    lightAgainHelpNuke:    'Detonation',
    // Game Over screen
    laGoScore:      'Score',
    laGoBestCombo:  'Best combo',
    laGoKills:      'Enemies eliminated',
    laGoRecord:     'Personal best',
    laGoReplay:     'Play again',
    laGoEnterHint:  'or press Enter',
    laGoWorldRecord:'World Top 10',
    laGoLoading:    'Loading…',
    laGoRestarting: 'Restarting…',
    laGoError:      'Offline',
    laGoSubmit:     'Submit',
    laGoSubmitted:  'Submitted!',
    laGoNewRecord:  'New record!',
    laGoNamePlc:    'Your name',

    // Upgrade system (roguelite draft)
    laUpTitle:           'Choose an upgrade',
    laUpDashAtkName:     'Dash-Attack',
    laUpDashAtkDesc1:    'Dash-Attack is longer and faster.',
    laUpDashAtkDesc2:    'Dash-Attack repels projectiles in an area around you.',
    laUpDetonationName:  'Detonation',
    laUpDetonationDesc1: 'Enemy marks last twice as long.',
    laUpDetonationDesc2: 'Detonation radius is 1.5× larger — and far more spectacular.',
    laUpDashName:        'Dash',
    laUpDashDesc1:       'Faster and longer dash, shorter cooldown.',
    laUpDashDesc2:    '1 Dash out of 3 leaves a tornado that pulls nearby enemies.',
    laUpBaseAtkName:     'Torpedo Attack',
    laUpBaseAtkDesc1:    'Torpedo Attack has a chance to leave a delayed explosion on impact.',
    laUpBaseAtkDesc2:    'Increases size and double chance to trigger a delayed explosion.',
    laUpAvailable:       'Upgrade available…',
    laUpShield:          'Shield',
    laUpShieldName:      'Shield',
    laUpShieldDesc1:     '+1 additional shield slot.',
    laUpShieldDesc2:     '+1 additional shield slot.',
    laUpTheWorldName:    'The World',
    laUpTheWorldDesc1:   'Middle-click stops time and makes you invincible for 4 seconds. (Cooldown: 30s)',
    laDelayExp:          'Delayed Explosion',

    // Misc
    closeLbl: 'Close',
    switchLang: 'Français',
  }
};

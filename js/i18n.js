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

    // Misc
    closeLbl: 'Close',
    switchLang: 'Français',
  }
};

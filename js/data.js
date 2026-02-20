/**
 * data.js — Central data store for portfolio content.
 *
 * All projects and skills are defined here so that index.html stays
 * content-free and js/main.js stays logic-only.
 *
 * To add a project: push a new object into PROJECTS.
 * To add a skill:   push a new object into SKILLS.
 */

const PROJECTS = [
  {
    title: 'MEGA SAE',
    description: 'Application JavaFX d\'organisation de banquets — gestion d\'événements, invités, menus et plans de table.',
    image: 'assets/images/background.jpg',
    tags: ['JavaFX', 'MVC', 'UML', 'Gestion de projet'],
    demo: '#',
    repo: '#',
    details: {
      overview: 'Le projet consiste à concevoir et développer une <em>application JavaFX</em> permettant à tout organisateur de gérer un événement. L\'application fonctionne <em>hors-ligne</em> (architecture lourde) et s\'appuie sur un <em>modèle MVC complet</em>. Projet réalisé en équipe de six, avec gestion de jalons, dépôt <em>GitLab</em> institutionnel et soutenance finale.',
      competences: [
        {
          title: 'Réaliser un développement d\'application',
          items: [
            'AC 1 : Implémenter des conceptions simples',
            'AC 2 : Élaborer des conceptions simples',
            'AC 3 : Faire des essais et évaluer leurs résultats',
            'AC 4 : Développer des interfaces utilisateurs',
          ],
        },
        {
          title: 'Optimiser des applications',
          items: [
            'AC 1 : Analyser un problème avec méthode',
            'AC 3 : Formaliser / mettre en œuvre des outils mathématiques',
          ],
        },
        {
          title: 'Conduire un projet',
          items: [
            'AC 1 : Appréhender les besoins du client et de l\'utilisateur',
            'AC 2 : Mettre en place les outils de gestion de projet',
            'AC 3 : Identifier les acteurs et les différentes phases d\'un cycle de développement',
          ],
        },
        {
          title: 'Collaborer au sein d\'une équipe informatique',
          items: [
            'AC 1 : Appréhender l\'écosystème numérique',
            'AC 3 : Identifier les statuts, les fonctions et les rôles de chaque membre d\'une équipe pluridisciplinaire',
            'AC 4 : Acquérir les compétences interpersonnelles pour travailler en équipe',
          ],
        },
      ],
      objectifs: 'Simplifier la logistique complexe de l\'organisation de <em>banquets</em> : permettre à tout organisateur de gérer efficacement chaque événement et de <em>réutiliser les informations clés</em> (invités, menus, plans de table) pour de futurs banquets. L\'application garantit une organisation fluide, personnalisée et optimisée.',
      equipe: 'Équipe projet 18 (6 membres) :\n<em>Chef de projet</em> : Macéo Guicherd-Callin\n<em>Responsables IHM</em> : Noam Bruchet-Johanon & Enzo Morello\n<em>Responsables techniques</em> : Jérémie Fauvet-Messat & Simon Krumb\n<em>Responsable communication</em> : Paolo Colombat\nLivrables de mars à juin : dossier de cadrage, modèle UML, prototype IHM, itérations fonctionnelles, démonstration finale le 20 juin.',
      travailIndividuel: 'J\'ai participé à la rédaction du <em>dossier IHM</em>, <em>dossier modélisation</em>, <em>dossier gestion de projet</em> et <em>dossier graphes</em>. Responsable communication : je me suis chargé de la collecte des <em>retours clients</em> ainsi que du <em>suivi des rendus</em>.',
      techDetails: [
        'Maîtrise du modèle MVC en JavaFX',
        'Gestion de projet en équipe (jalons, livrables, GitLab)',
        'Conception et développement d\'applications avec modélisation UML',
      ],
      challenges: '',
    },
  },
  {
    title: 'SAE 2.04',
    description: 'Exploitation d\'une base de données open data sur les accidents de la route — démarche Data Science.',
    image: 'assets/images/background.jpg',
    tags: ['PostgreSQL', 'SQL', 'Data Science', 'Visualisation'],
    demo: '#',
    repo: '#',
    details: {
      overview: 'Dans ce projet, réalisé en <em>binôme</em>, nous avons été placés dans la peau de membres d\'une association souhaitant sensibiliser le public aux <em>accidents de la route</em> en France. L\'objectif principal était de mener une première démarche de type <em>Data Science</em> à partir d\'une base de données publique fournie par l\'observatoire national interministériel de la sécurité routière. Cette base, très volumineuse et brute, couvre les accidents corporels survenus entre <em>2005 et 2023</em>.<br>Notre travail s\'est organisé en deux grandes phases : une première, orientée bases de données, consistait à explorer, nettoyer et transformer les données à l\'aide d\'outils comme <em>PostgreSQL</em> ; la seconde, plus statistique, visait à produire des <em>visualisations pertinentes</em> (graphiques, tableaux) pour répondre à une problématique précise que nous avons définie. En parallèle, nous avons également rédigé un <em>document de cadrage</em> du projet pour identifier les contraintes, les ressources nécessaires et les risques potentiels.',
      competences: [
        {
          title: 'Gérer des données de l\'information',
          items: [
            'AC 1 : Mettre à jour et interroger une base de données relationnelle (en requêtes directes ou à travers une application)',
            'AC 2 : Visualiser des données',
          ],
        },
        {
          title: 'Conduire un projet',
          items: [
            'AC 2 : Mettre en place les outils de gestion de projet',
            'AC 3 : Identifier les acteurs et les différentes phases d\'un cycle de développement',
          ],
        },
        {
          title: 'Collaborer au sein d\'une équipe informatique',
          items: [
            'AC 4 : Acquérir les compétences interpersonnelles pour travailler en équipe',
          ],
        },
      ],
      equipe: 'Nous avons travaillé ensemble pour <em>définir la problématique</em>, organiser le planning et rédiger le document de cadrage. Cette coopération nous a permis de partager nos idées, de valider nos <em>choix méthodologiques</em> et de maintenir une cohérence dans l\'ensemble des livrables.',
      travailIndividuel: 'De mon côté, je me suis principalement occupé de la phase de <em>préparation des données</em> : nettoyage, transformation et élaboration des <em>requêtes SQL</em> nécessaires à l\'analyse. J\'ai également pris en charge la <em>contextualisation des graphiques</em> produits, en veillant à leur pertinence vis-à-vis de la problématique choisie.',
      techDetails: [
        'Manipulation de bases de données volumineuses (open data)',
        'Exploration, nettoyage et transformation de données avec PostgreSQL',
        'Création de requêtes SQL pour extraire des informations pertinentes',
        'Production de visualisations statistiques à partir de données brutes',
        'Utilisation d\'outils de représentation graphique (tableaux, graphiques)',
        'Définition d\'une problématique de type Data Science',
        'Rédaction d\'un document de cadrage de projet (analyse des contraintes, risques)',
      ],
      challenges: '',
    },
  },
  {
    title: 'SAE 1.04',
    description: 'Conception et mise en place d\'une base de données complète pour le club de bowling SuperBall.',
    image: 'assets/images/background.jpg',
    tags: ['PostgreSQL', 'SQL', 'Merise', 'Conception BD'],
    demo: '#',
    repo: '#',
    details: {
      overview: 'La SAE 1.04 avait pour but de concevoir et de mettre en place, en <em>binôme</em>, une <em>base de données complète</em> pour le club de bowling <em>SuperBall</em>. À partir d\'un cahier des charges et d\'un SEA fournis, nous avons :<br><br>• Dérivé le <em>schéma relationnel</em> (SLR) en appliquant les règles de traduction vues en cours<br>• Écrit un script <em>create.sql</em> créant les tables, clés primaires / étrangères, CHECK, NOT NULL, contraintes d\'unicité<br>• Rédigé un script <em>test.sql</em> peuplant la base puis vérifiant l\'intégrité via des insertions invalides<br>• Développé des <em>requêtes SQL</em> répondant à six besoins métier (planning des pistes, stock de chaussures, disponibilité, etc.)<br>• Fait évoluer la base lors de l\'étape 3 : gestion du <em>remplacement d\'une piste</em>, extension du nombre maximum de parties et bilan critique du projet.',
      competences: [
        {
          title: 'Gérer des données de l\'information',
          items: [
            'AC 1 : Mettre à jour et interroger une base de données relationnelle (en requêtes directes ou via une application)',
            'AC 2 : Visualiser des données',
            'AC 3 : Concevoir une base de données relationnelle à partir d\'un cahier des charges',
          ],
        },
      ],
      objectifs: 'Mettre en pratique la méthodologie de conception BD vue en cours (<em>SEA → SLR → SQL</em>). Maîtriser les <em>contraintes d\'intégrité</em> côté SGBD plutôt que dans le code applicatif. Savoir peupler et interroger une base afin de répondre à des <em>besoins concrets</em>. Apprendre à faire <em>évoluer un schéma existant</em> sans casser les données.',
      equipe: 'Répartition des tâches : mon binôme s\'est concentré sur le <em>SLR</em>, les <em>requêtes métier</em> et le bilan. Moi sur <em>create.sql</em> / <em>drop.sql</em>.',
      travailIndividuel: '<em>Création des tables</em>, <em>peuplement de la BD</em>, ajout de <em>contraintes</em> respectant le cahier des charges.',
      techDetails: [
        'Conception EA / Merise avec DB-Diagram.io puis export PDF',
        'PostgreSQL 15, psql, pgAdmin 4, DBeaver',
        'Contraintes : CHECK, clés composites, FK, index',
        'Requêtes avancées : window functions, INTERVAL, vues matérialisées',
      ],
      challenges: '',
    },
  },
  {
    title: 'SAE 1.01/2',
    description: 'Classification automatique de dépêches — génération de lexiques par apprentissage et comparaison K-NN.',
    image: 'assets/images/project-4.jpg',
    tags: ['Java', 'Algorithmes', 'IA', 'IntelliJ'],
    demo: '#',
    repo: '#',
    details: {
      overview: 'Ce projet, intitulé « <em>Classification automatique</em> », visait à améliorer un système de tri de <em>dépêches d\'actualité</em> en développant une méthode de <em>génération automatique de lexiques</em>. Contrairement à la première partie où les lexiques étaient manuels, nous avons ici expérimenté l\' <em>apprentissage automatique</em> afin de générer des lexiques plus pertinents et d\'améliorer la précision du système de classification.<br><br><em>Binôme</em> : Paolo Colombat, Enzo Morello',
      competences: [
        {
          title: 'Réaliser un développement d\'application',
          items: [
            'AC 1 : Implémenter des conceptions simples',
            'AC 2 : Élaborer des conceptions simples',
            'AC 3 : Faire des essais et évaluer leurs résultats en regard des spécifications',
          ],
        },
        {
          title: 'Optimiser des applications',
          items: [
            'AC 1 : Analyser un problème avec méthode (découpage en éléments algorithmiques simples, structure de données…)',
            'AC 2 : Comparer des algorithmes pour des problèmes classiques (tris simples, recherche…)',
            'AC 3 : Formaliser et mettre en œuvre des outils mathématiques pour l\'informatique',
          ],
        },
        {
          title: 'Conduire un projet',
          items: [
            'AC 3 : Identifier les acteurs et les différentes phases d\'un cycle de développement',
          ],
        },
        {
          title: 'Collaborer au sein d\'une équipe informatique',
          items: [
            'AC 4 : Acquérir les compétences interpersonnelles pour travailler en équipe',
          ],
        },
      ],
      objectifs: '• Automatiser la <em>génération de lexiques</em> à partir de dépêches catégorisées<br>• Calculer un <em>score</em> pour chaque mot en fonction de sa fréquence et spécificité<br>• Attribuer des <em>poids</em> aux mots selon leur pertinence<br>• Évaluer les <em>performances</em> du système avec ces lexiques sur des données de test<br>• Comparer avec la méthode des <em>K plus proches voisins</em>',
      equipe: 'Le projet a été mené en <em>binôme</em> avec une répartition claire des tâches : l\'un s\'est concentré sur les <em>algorithmes de traitement de texte</em> et le calcul des scores, tandis que l\'autre s\'est chargé de la <em>structuration du code</em>, des tests et de la comparaison des méthodes. À chaque étape clé, nous avons procédé à une <em>relecture croisée</em> pour garantir la qualité du travail.',
      travailIndividuel: 'J\'ai participé à l\'implémentation de la <em>majorité des méthodes</em> et mis en place un <em>système de calcul de temps</em> pour comparer des approches algorithmiques différentes.',
      techDetails: [
        'Utilisation de Java pour la classification textuelle',
        'Maîtrise d\'IntelliJ comme IDE',
        'Application d\'heuristiques pour pondérer les lexiques',
        'Optimisation par tri et recherche dichotomique',
        'Comparaison expérimentale de méthodes d\'IA (K-NN)',
      ],
      challenges: '',
    },
  },
];

const SKILL_GROUPS = [
  {
    label: 'Langages',
    skills: [
      { name: 'C',          icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/c/c-original.svg', description: 'Programmation système, pointeurs, gestion mémoire. Utilisé en cours et projets bas niveau.', level: 2 },
      { name: 'C++',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-original.svg', description: 'Programmation orientée objet, STL et gestion de ressources. Utilisé pour des projets algorithmiques.', level: 2 },
      { name: 'Java',       icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg', description: 'Langage principal en BUT : JavaFX, MVC, classification de texte, applications Android.', level: 4 },
      { name: 'Python',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg', description: 'Scripts, automatisation et prototypage rapide. Utilisé pour le traitement de données.', level: 3 },
      { name: 'JavaScript', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg', description: 'Développement web front-end, DOM, événements. Ce portfolio est entièrement en vanilla JS.', level: 4 },
      { name: 'PHP',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg', description: 'Développement back-end, formulaires, sessions et intégration avec bases de données.', level: 3 },
      { name: 'SQL',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/azuresqldatabase/azuresqldatabase-original.svg', description: 'Requêtes complexes, jointures, sous-requêtes, window functions. Utilisé dans plusieurs SAE.', level: 4 },
    ],
  },
    {
    label: 'Outils de dev',
    skills: [
      { name: 'Git',               icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg', description: 'Versionning, branches, merge, rebase. Utilisé au quotidien sur tous les projets.', level: 4 },
      { name: 'GitLab & GitHub',   icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/gitlab/gitlab-original.svg', description: 'Hébergement de dépôts, issues, CI/CD. GitLab institutionnel + GitHub pour projets personnels.', level: 4 },
      { name: 'VS Code',           icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vscode/vscode-original.svg', description: 'Éditeur principal pour le développement web, extensions, debugging intégré.', level: 5 },
      { name: 'JetBrains',         icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/jetbrains/jetbrains-original.svg', description: 'IntelliJ IDEA pour Java, PyCharm pour Python. IDE complets utilisés en SAE.', level: 3 },
      { name: 'Bash',              icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/bash/bash-original.svg', description: 'Scripts shell, automatisation de tâches, navigation système Linux.', level: 3 },
    ],
  },
  {
    label: 'Web',
    skills: [
      { name: 'HTML / CSS', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg', description: 'Structure sémantique, Flexbox, Grid, animations CSS, responsive design mobile-first.', level: 4 },
      { name: 'React',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg', description: 'Composants, hooks, state management. Initiation au développement d\'interfaces modernes.', level: 2 },
    ],
  },
  {
    label: 'Mobile',
    skills: [
      { name: 'Android',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/android/android-original.svg', description: 'Développement d\'applications natives Android en Java, activités, fragments, intents.', level: 3 },
      { name: 'Android Studio', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/androidstudio/androidstudio-original.svg', description: 'IDE officiel Android : émulateur, layout editor, Gradle, debugging.', level: 3 },
    ],
  },
  {
    label: 'Bases de données',
    skills: [
      { name: 'PostgreSQL', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg', description: 'SGBD principal utilisé en SAE : conception, requêtes avancées, contraintes d\'intégrité.', level: 4 },
      { name: 'SQLite',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sqlite/sqlite-original.svg', description: 'Base embarquée pour applications mobiles et projets légers.', level: 3 },
      { name: 'MySQL',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg', description: 'Utilisé pour des projets web avec PHP, administration via phpMyAdmin.', level: 3 },
    ],
  },
  {
    label: 'Serveur / Admin',
    skills: [
      { name: 'Apache',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apache/apache-original.svg', description: 'Configuration de serveur HTTP, virtual hosts, modules. Déploiement de sites PHP.', level: 2 },
      { name: 'phpPgAdmin', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg', description: 'Interface web d\'administration PostgreSQL, gestion des schémas et requêtes.', level: 3 },
    ],
  },
];

/**
 * MUSIC — Playlist for the mini player.
 * Each entry: { title, artist, cover, src }
 *   - cover: path to album art image
 *   - src:   path to the audio file (.mp3)
 *
 * To add a track: push a new object into MUSIC.
 */
const MUSIC = [
  {
    title: 'BloomChill',
    artist: 'Artist Unknown',
    cover: 'assets/images/chillblom.png',
    src: 'assets/music/paulyudin-chill-silent-bloom-chill-481864.mp3',
  },
  {
    title: 'La Nuit',
    artist: 'Ziak',
    cover: 'assets/images/lanuit.jpg',
    src: 'assets/music/lanuit.mp3',
  },
  {
    title: 'ambatukam',
    artist: 'DreamyBull',
    cover: 'assets/images/dreamy.jpg',
    src: 'assets/music/ambatukam choir extended.mp3',
  },
    {
    title: 'COUSINS',
    artist: 'Kanye West',
    cover: 'assets/images/kaynie.jpg',
    src: 'assets/music/Kanye West - COUSINS (Lyrics).mp3',
  },
];

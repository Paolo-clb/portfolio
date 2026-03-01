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
    title: 'Satablé : Application d\'organisation de banquets',
    description: 'Développement d\'une Application lourde JavaFX d\'organisation de banquets — gestion d\'événements, invités, menus et plans de table.',
    image: 'assets/images/background.jpg',
    tags: ['JavaFX', 'MVC', 'UML', 'Gestion de projet'],
    details: {
      overview: 'Le projet consiste à concevoir et développer une <em>application JavaFX</em> permettant à tout organisateur de gérer un événement. L\'application fonctionne <em>hors-ligne</em> (architecture lourde) et s\'appuie sur un <em>modèle MVC complet</em>. Projet réalisé en équipe de six, avec gestion de jalons, dépôt <em>GitLab</em> institutionnel et soutenance finale.',
      competences: [
        {
          title: 'Réaliser un développement d\'application',
          items: [
            'Implémenter des conceptions simples',
            'Élaborer des conceptions simples',
            'Faire des essais et évaluer leurs résultats',
            'Développer des interfaces utilisateurs',
          ],
        },
        {
          title: 'Optimiser des applications',
          items: [
            'Analyser un problème avec méthode',
            'Formaliser / mettre en œuvre des outils mathématiques',
          ],
        },
        {
          title: 'Conduire un projet',
          items: [
            'Appréhender les besoins du client et de l\'utilisateur',
            'Mettre en place les outils de gestion de projet',
            'Identifier les acteurs et les différentes phases d\'un cycle de développement',
          ],
        },
        {
          title: 'Collaborer au sein d\'une équipe informatique',
          items: [
            'Appréhender l\'écosystème numérique',
            'Identifier les statuts, les fonctions et les rôles de chaque membre d\'une équipe pluridisciplinaire',
            'Acquérir les compétences interpersonnelles pour travailler en équipe',
          ],
        },
      ],
      objectifs: 'Simplifier la logistique complexe de l\'organisation de <em>banquets</em> : permettre à tout organisateur de gérer efficacement chaque événement et de <em>réutiliser les informations clés</em> (invités, menus, plans de table) pour de futurs banquets. L\'application Satablé garantit une organisation fluide, personnalisée et optimisée.',
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
    title: 'Exploitation d\'une base de données',
    description: 'Exploitation d\'une base de données open data sur les accidents de la route — démarche Data Science.',
    image: 'assets/images/background.jpg',
    tags: ['PostgreSQL', 'SQL', 'Data Science', 'Visualisation'],
    details: {
      overview: 'Dans ce projet, réalisé en <em>binôme</em>, nous avons été placés dans la peau de membres d\'une association souhaitant sensibiliser le public aux <em>accidents de la route</em> en France. L\'objectif principal était de mener une première démarche de type <em>Data Science</em> à partir d\'une base de données publique fournie par l\'observatoire national interministériel de la sécurité routière. Cette base, très volumineuse et brute, couvre les accidents corporels survenus entre <em>2005 et 2023</em>.<br>Notre travail s\'est organisé en deux grandes phases : une première, orientée bases de données, consistait à explorer, nettoyer et transformer les données à l\'aide d\'outils comme <em>PostgreSQL</em> ; la seconde, plus statistique, visait à produire des <em>visualisations pertinentes</em> (graphiques, tableaux) pour répondre à une problématique précise que nous avons définie. En parallèle, nous avons également rédigé un <em>document de cadrage</em> du projet pour identifier les contraintes, les ressources nécessaires et les risques potentiels.',
      competences: [
        {
          title: 'Gérer des données de l\'information',
          items: [
            'Mettre à jour et interroger une base de données relationnelle (en requêtes directes ou à travers une application)',
            'Visualiser des données',
          ],
        },
        {
          title: 'Conduire un projet',
          items: [
            'Mettre en place les outils de gestion de projet',
            'Identifier les acteurs et les différentes phases d\'un cycle de développement',
          ],
        },
        {
          title: 'Collaborer au sein d\'une équipe informatique',
          items: [
            'Acquérir les compétences interpersonnelles pour travailler en équipe',
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
    title: 'Conception d\'une base de données',
    description: 'Conception et mise en place d\'une base de données complète pour le club de bowling SuperBall.',
    image: 'assets/images/background.jpg',
    tags: ['PostgreSQL', 'SQL', 'Merise', 'Conception BD'],
    details: {
      overview: 'Le Projet avait pour but de concevoir et de mettre en place, en <em>binôme</em>, une <em>base de données complète</em> pour le club de bowling <em>SuperBall</em>. À partir d\'un cahier des charges et d\'un SEA fournis, nous avons :<br><br>• Dérivé le <em>schéma relationnel</em> (SLR) en appliquant les règles de traduction vues en cours<br>• Écrit un script <em>create.sql</em> créant les tables, clés primaires / étrangères, CHECK, NOT NULL, contraintes d\'unicité<br>• Rédigé un script <em>test.sql</em> peuplant la base puis vérifiant l\'intégrité via des insertions invalides<br>• Développé des <em>requêtes SQL</em> répondant à six besoins métier (planning des pistes, stock de chaussures, disponibilité, etc.)<br>• Fait évoluer la base lors de l\'étape 3 : gestion du <em>remplacement d\'une piste</em>, extension du nombre maximum de parties et bilan critique du projet.',
      competences: [
        {
          title: 'Gérer des données de l\'information',
          items: [
            'Mettre à jour et interroger une base de données relationnelle (en requêtes directes ou via une application)',
            'Visualiser des données',
            'Concevoir une base de données relationnelle à partir d\'un cahier des charges',
          ],
        },
      ],
      objectifs: 'Mettre en pratique la méthodologie de conception BD vue en cours (<em>SEA → SLR → SQL</em>). Maîtriser les <em>contraintes d\'intégrité</em> côté SGBD plutôt que dans le code applicatif. Savoir peupler et interroger une base afin de répondre à des <em>besoins concrets</em>. Apprendre à faire <em>évoluer un schéma existant</em> sans casser les données.',
      equipe: 'Répartition des tâches : mon binôme s\'est concentré sur le <em>SLR</em>, les <em>requêtes métier</em> et le bilan. Moi sur <em>create.sql</em> / <em>drop.sql</em>.',
      travailIndividuel: '<em>Création des tables</em>, <em>peuplement de la BD</em>, ajout de <em>contraintes</em> respectant le cahier des charges.',
      techDetails: [
        'Conception EA / Merise avec DB-Diagram.io puis export PDF',
        'PostgreSQL 15, psql, pgAdmin 4',
        'Contraintes : CHECK, clés composites, FK, index',
        'Requêtes avancées : window functions, INTERVAL, vues matérialisées',
      ],
      challenges: '',
    },
  },
  {
    title: 'Comparaison d\'approches algorithmiques',
    description: 'Développement de méthodes de classification automatique de dépêches — génération de lexiques par apprentissage et comparaison K-NN.',
    image: 'assets/images/project-4.jpg',
    tags: ['Java', 'Algorithmes', 'IA', 'IntelliJ'],
    details: {
      overview: 'Ce projet, intitulé « <em>Classification automatique</em> », visait à améliorer un système de tri de <em>dépêches d\'actualité</em> en développant une méthode de <em>génération automatique de lexiques</em>. Contrairement à la première partie où les lexiques étaient manuels, nous avons ici expérimenté l\' <em>apprentissage automatique</em> afin de générer des lexiques plus pertinents et d\'améliorer la précision du système de classification.<br><br><em>Binôme</em> : Paolo Colombat, Enzo Morello',
      competences: [
        {
          title: 'Réaliser un développement d\'application',
          items: [
            'Implémenter des conceptions simples',
            'Élaborer des conceptions simples',
            'Faire des essais et évaluer leurs résultats en regard des spécifications',
          ],
        },
        {
          title: 'Optimiser des applications',
          items: [
            'Analyser un problème avec méthode (découpage en éléments algorithmiques simples, structure de données…)',
            'Comparer des algorithmes pour des problèmes classiques (tris simples, recherche…)',
            'Formaliser et mettre en œuvre des outils mathématiques pour l\'informatique',
          ],
        },
        {
          title: 'Conduire un projet',
          items: [
            'Identifier les acteurs et les différentes phases d\'un cycle de développement',
          ],
        },
        {
          title: 'Collaborer au sein d\'une équipe informatique',
          items: [
            'Acquérir les compétences interpersonnelles pour travailler en équipe',
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
        'Comparaison expérimentale et empirique de méthodes d\'IA (K-NN)',
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
      { name: 'Java',       icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg', description: 'Programmation orientée objet, héritage, interfaces, collections, JavaFX.', level: 4 },
      { name: 'Python',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg', description: 'Vu en au lycée en spécialité NSI : POO, arbres, recursivité.', level: 2 },
      { name: 'JavaScript', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg', description: 'Développement web front-end, DOM, événements. Ce portfolio est entièrement en vanilla JS.', level: 4 },
      { name: 'PHP',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg', description: 'Développement back-end, formulaires, sessions et intégration avec bases de données.', level: 3 },
      { name: 'SQL',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/azuresqldatabase/azuresqldatabase-original.svg', description: 'Requêtes complexes, jointures, sous-requêtes, trigger, forme normale. Utilisé dans plusieurs Projets.', level: 3 },
    ],
  },
    {
    label: 'Outils de dev',
    skills: [
      { name: 'Git',               icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg', description: 'Versionning, branches, merge, rebase. Utilisé sur tous les projets de codes à plusieurs.', level: 3 },
      { name: 'GitLab & GitHub',   icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/gitlab/gitlab-original.svg', description: 'Hébergement de dépôts, issues, CI/CD. GitLab institutionnel + GitHub pour projets personnels.', level: 3 },
      { name: 'VS Code',           icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vscode/vscode-original.svg', description: 'Éditeur principal pour le développement web, extensions, debugging intégré.', level: 5 },
      { name: 'JetBrains',         icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/jetbrains/jetbrains-original.svg', description: 'IntelliJ IDEA pour Java, PhpStorm pour PHP, CLion pour C/C++. IDE complets utilisés en TP/Projets.', level: 4 },
      { name: 'Bash',              icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/bash/bash-original.svg', description: 'Scripts shell, automatisation de tâches, navigation système Linux.', level: 3 },
      { name: 'Mocha',              icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mocha/mocha-original.svg', description: 'Framework de test pour JavaScript et Node.js, utilisé pour les tests unitaires et d\'intégration.', level: 2 },
    ],
  },
  {
    label: 'Web',
    skills: [
      { name: 'HTML / CSS', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg', description: 'Structure sémantique, Flexbox, Grid, animations CSS, responsive design mobile-first.', level: 4 },
      { name: 'React',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg', description: 'Composants, hooks, state management. Développement d\'interfaces modernes. Utilisé pour l\'Application web Aidémé.', level: 2 },
      { name: 'Symfony',      icon: 'https://img.icons8.com/color/48/symfony.png', description: 'Framework PHP pour le développement d\'applications web robustes et maintenables.', level: 2 },
    ],
  },
  {
    label: 'Mobile',
    skills: [
      { name: 'Android',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/android/android-original.svg', description: 'Reprise et développement d\'applications natives Android en Java, activités, fragments, intents.', level: 2 },
      { name: 'Android Studio', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/androidstudio/androidstudio-original.svg', description: 'IDE officiel Android : émulateur, layout editor, Gradle, debugging.', level: 3 },
    ],
  },
  {
    label: 'Bases de données',
    skills: [
      { name: 'PostgreSQL', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg', description: 'SGBD principal utilisé en Projet : optimisation des requêtes, contraintes d\'intégrité.', level: 4 },
      { name: 'SQLite',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sqlite/sqlite-original.svg', description: 'Base embarquée pour applications mobiles et projets légers.', level: 2 },
      { name: 'MySQL',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg', description: 'Utilisé pour des projets web avec PHP, administration via phpMyAdmin.', level: 1 },
    ],
  },
  {
    label: 'Serveur / Réseau / Virtualisation',
    skills: [
      { name: 'Linux',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg', description: 'Administration système, gestion des utilisateurs et processus, permissions, système de fichiers ext4.', level: 2 },
      { name: 'Apache',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apache/apache-original.svg', description: 'Configuration de serveur HTTP, virtual hosts, modules. Déploiement de sites PHP.', level: 3 },
      { name: 'phpPgAdmin', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg', description: 'Interface web d\'administration PostgreSQL, gestion des schémas et requêtes.', level: 2 },
      { name: 'Qemu',       icon: 'https://gitlab.com/qemu-project/qemu/-/raw/864ab314f1d924129d06ac7b571f105a2b76a4b2/ui/icons/qemu.svg', description: 'Virtualisation légère pour tester des systèmes d\'exploitation et des configurations serveur.', level: 3 },
      { name: 'Proxmox',    icon: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/proxmox-light.svg', description: 'Plateforme de virtualisation pour gérer des machines virtuelles et des conteneurs à grande échelle.', level: 2 },
      { name: 'Docker',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg', description: 'Conteneurisation d\'applications, gestion d\'images et de volumes, orchestration avec Docker Compose.', level: 1 },
      { name: 'Wireshark',  icon: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/wireshark.png', description: 'Analyseur de paquets réseau pour le dépannage et la sécurité.', level: 1 },
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
    title: 'Sunflower',
    artist: 'Post Malone, Swae Lee',
    cover: 'assets/images/Sunflower.jpg',
    src: 'assets/music/Sunflower.mp3',
  },
  {
    title: 'On Melancholy Hill',
    artist: 'Gorillaz',
    cover: 'assets/images/Melancholy.jpg',
    src: 'assets/music/Melancholy.mp3',
  },
    {
    title: 'The Line',
    artist: 'Twenty One Pilots',
    cover: 'assets/images/TheLine.jpg',
    src: 'assets/music/TheLine.mp3',
  },
    {
    title: 'Let You Down',
    artist: 'Dawid Podsiadło',
    cover: 'assets/images/LetYouDown.jpg',
    src: 'assets/music/LetYouDown.mp3',
  },
      {
    title: 'Sneaky Driver',
    artist: 'Bill Kiley',
    cover: 'assets/images/SneakyDriver.jpg',
    src: 'assets/music/SneakyDriver.mp3',
  },
        {
    title: 'Iris',
    artist: 'Forhill',
    cover: 'assets/images/Iris.jpg',
    src: 'assets/music/Iris.mp3',
  },
    {
    title: 'Fleur Solitaire',
    artist: 'LÜNE, Veyko',
    cover: 'assets/images/FleurSolitaire.jpg',
    src: 'assets/music/FleurSolitaire.mp3',
  },
      {
    title: 'Pyxis',
    artist: 'HOME',
    cover: 'assets/images/Pyxis.jpg',
    src: 'assets/music/Pyxis.mp3',
  },
];

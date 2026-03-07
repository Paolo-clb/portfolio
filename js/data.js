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
    image: 'assets/images/satable.jpg',
    tags: ['JavaFX', 'MVC', 'UML', 'Gestion de projet'],
    en: {
      title: 'Satablé: Banquet Planning Application',
      description: 'Development of a JavaFX desktop application for banquet planning — event, guest, menu and seating management.',
      tags: ['JavaFX', 'MVC', 'UML', 'Project Management'],
      details: {
        overview: 'The project consists of designing and developing a <em>JavaFX application</em> allowing any organizer to manage an event. The application works <em>offline</em> (desktop architecture) and relies on a <em>complete MVC model</em>. Carried out by a team of six, with milestone management, an institutional <em>GitLab</em> repository, and a final presentation.',
        competences: [
          {
            title: 'Developing applications',
            items: [
              'Implement simple designs',
              'Elaborate simple designs',
              'Conduct tests and evaluate results',
              'Develop user interfaces',
            ],
          },
          {
            title: 'Optimizing applications',
            items: [
              'Analyze a problem methodically',
              'Formalize and implement mathematical tools',
            ],
          },
          {
            title: 'Leading a project',
            items: [
              'Understand client and user needs',
              'Set up project management tools',
              'Identify stakeholders and development cycle phases',
            ],
          },
          {
            title: 'Collaborating within an IT team',
            items: [
              'Understand the digital ecosystem',
              'Identify the roles and responsibilities of each multidisciplinary team member',
              'Acquire interpersonal skills for teamwork',
            ],
          },
        ],
        objectifs: 'Simplify the complex logistics of <em>banquet</em> planning: enable any organizer to efficiently manage each event and <em>reuse key information</em> (guests, menus, seating plans) for future banquets. The Satablé application ensures smooth, personalized and optimized organization.',
        equipe: 'Project team 18 (6 members):\n<em>Project manager</em>: Macéo Guicherd-Callin\n<em>UI/UX leads</em>: Noam Bruchet-Johanon & Enzo Morello\n<em>Technical leads</em>: Jérémie Fauvet-Messat & Simon Krumb\n<em>Communication lead</em>: Paolo Colombat\nDeliverables from March to June: scoping document, UML model, UI prototype, functional iterations, final demo on June 20.',
        travailIndividuel: 'I contributed to writing the <em>UI/UX document</em>, <em>modeling document</em>, <em>project management document</em>, and <em>graph theory document</em>. As communication lead, I was responsible for collecting <em>client feedback</em> and <em>tracking deliverables</em>.',
        techDetails: [
          'Mastery of the MVC pattern in JavaFX',
          'Team project management (milestones, deliverables, GitLab)',
          'Application design and development with UML modeling',
        ],
        challenges: '',
      },
    },
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
    en: {
      title: 'Database Exploitation',
      description: 'Exploitation of an open data database on road accidents — Data Science approach.',
      tags: ['PostgreSQL', 'SQL', 'Data Science', 'Visualization'],
      details: {
        overview: 'In this project, carried out in <em>pairs</em>, we took on the role of members of an association aiming to raise public awareness about <em>road accidents</em> in France. The main objective was to conduct a first <em>Data Science</em> approach from a public database provided by the national road safety observatory. This large and raw database covers bodily injury accidents between <em>2005 and 2023</em>.<br>Our work was organized in two main phases: the first, database-oriented, consisted of exploring, cleaning and transforming data using tools like <em>PostgreSQL</em>; the second, more statistical, aimed at producing <em>relevant visualizations</em> (graphs, tables) to answer a specific research question we defined. In parallel, we also wrote a <em>project scoping document</em> to identify constraints, required resources and potential risks.',
        competences: [
          {
            title: 'Managing information data',
            items: [
              'Update and query a relational database (via direct queries or through an application)',
              'Visualize data',
            ],
          },
          {
            title: 'Leading a project',
            items: [
              'Set up project management tools',
              'Identify stakeholders and development cycle phases',
            ],
          },
          {
            title: 'Collaborating within an IT team',
            items: [
              'Acquire interpersonal skills for teamwork',
            ],
          },
        ],
        equipe: 'We worked together to <em>define the research question</em>, organize the schedule and write the scoping document. This cooperation allowed us to share ideas, validate our <em>methodological choices</em> and maintain consistency across all deliverables.',
        travailIndividuel: 'On my side, I mainly handled the <em>data preparation</em> phase: cleaning, transformation and development of <em>SQL queries</em> needed for analysis. I also took charge of the <em>contextualization of the graphs</em> produced, ensuring their relevance to the chosen research question.',
        techDetails: [
          'Handling large databases (open data)',
          'Data exploration, cleaning and transformation with PostgreSQL',
          'Creating SQL queries to extract relevant information',
          'Producing statistical visualizations from raw data',
          'Using graphical representation tools (tables, charts)',
          'Defining a Data Science research question',
          'Writing a project scoping document (constraint and risk analysis)',
        ],
        challenges: '',
      },
    },
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
    en: {
      title: 'Database Design',
      description: 'Design and implementation of a complete database for the SuperBall bowling club.',
      tags: ['PostgreSQL', 'SQL', 'Merise', 'DB Design'],
      details: {
        overview: 'The project aimed to design and implement, in <em>pairs</em>, a <em>complete database</em> for the <em>SuperBall</em> bowling club. From a provided specification and ER diagram, we:<br><br>• Derived the <em>relational schema</em> (RS) by applying translation rules covered in class<br>• Wrote a <em>create.sql</em> script creating tables, primary/foreign keys, CHECK, NOT NULL, and uniqueness constraints<br>• Wrote a <em>test.sql</em> script populating the database then verifying integrity via invalid insertions<br>• Developed <em>SQL queries</em> addressing six business needs (lane scheduling, shoe stock, availability, etc.)<br>• Evolved the database in step 3: handling <em>lane replacement</em>, extending the maximum number of games and critical project review.',
        competences: [
          {
            title: 'Managing information data',
            items: [
              'Update and query a relational database (via direct queries or through an application)',
              'Visualize data',
              'Design a relational database from specifications',
            ],
          },
        ],
        objectifs: 'Apply the database design methodology covered in class (<em>ER → RS → SQL</em>). Master <em>integrity constraints</em> on the DBMS side rather than in application code. Know how to populate and query a database to answer <em>concrete needs</em>. Learn to <em>evolve an existing schema</em> without breaking data.',
        equipe: 'Task distribution: my partner focused on the <em>RS</em>, <em>business queries</em> and the review. I worked on <em>create.sql</em> / <em>drop.sql</em>.',
        travailIndividuel: '<em>Table creation</em>, <em>database population</em>, addition of <em>constraints</em> respecting the specifications.',
        techDetails: [
          'ER / Merise design with DB-Diagram.io then PDF export',
          'PostgreSQL 15, psql, pgAdmin 4',
          'Constraints: CHECK, composite keys, FK, indexes',
          'Advanced queries: window functions, INTERVAL, materialized views',
        ],
        challenges: '',
      },
    },
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
    image: 'assets/images/background.jpg',
    tags: ['Java', 'Algorithmes', 'IA', 'IntelliJ'],
    en: {
      title: 'Algorithmic Approach Comparison',
      description: 'Development of automatic news dispatch classification methods — lexicon generation through machine learning and K-NN comparison.',
      tags: ['Java', 'Algorithms', 'AI', 'IntelliJ'],
      details: {
        overview: 'This project, titled "<em>Automatic Classification</em>", aimed to improve a <em>news dispatch</em> sorting system by developing a method for <em>automatic lexicon generation</em>. Unlike the first part where lexicons were manual, we experimented with <em>machine learning</em> to generate more relevant lexicons and improve the classification system\'s accuracy.<br><br><em>Pair</em>: Paolo Colombat, Enzo Morello',
        competences: [
          {
            title: 'Developing applications',
            items: [
              'Implement simple designs',
              'Elaborate simple designs',
              'Conduct tests and evaluate results against specifications',
            ],
          },
          {
            title: 'Optimizing applications',
            items: [
              'Analyze a problem methodically (decomposition into simple algorithmic elements, data structures…)',
              'Compare algorithms for classic problems (simple sorts, search…)',
              'Formalize and implement mathematical tools for computing',
            ],
          },
          {
            title: 'Leading a project',
            items: [
              'Identify stakeholders and development cycle phases',
            ],
          },
          {
            title: 'Collaborating within an IT team',
            items: [
              'Acquire interpersonal skills for teamwork',
            ],
          },
        ],
        objectifs: '• Automate <em>lexicon generation</em> from categorized dispatches<br>• Calculate a <em>score</em> for each word based on its frequency and specificity<br>• Assign <em>weights</em> to words according to their relevance<br>• Evaluate the system\'s <em>performance</em> with these lexicons on test data<br>• Compare with the <em>K nearest neighbors</em> method',
        equipe: 'The project was carried out in <em>pairs</em> with a clear task distribution: one focused on <em>text processing algorithms</em> and score calculation, while the other handled <em>code structuring</em>, testing and method comparison. At each key stage, we conducted <em>cross-reviews</em> to ensure work quality.',
        travailIndividuel: 'I participated in implementing the <em>majority of methods</em> and set up a <em>timing system</em> to compare different algorithmic approaches.',
        techDetails: [
          'Using Java for textual classification',
          'Mastery of IntelliJ as an IDE',
          'Applying heuristics to weight lexicons',
          'Optimization through sorting and binary search',
          'Experimental and empirical comparison of AI methods (K-NN)',
        ],
        challenges: '',
      },
    },
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
    en: {
      label: 'Languages',
      skills: [
        { description: 'System programming, pointers, memory management. Used in courses and low-level projects.' },
        { description: 'Object-oriented programming, STL and resource management. Used for algorithmic projects.' },
        { description: 'Object-oriented programming, inheritance, interfaces, collections, JavaFX.' },
        { description: 'Learned in high school (NSI specialization): OOP, trees, recursion.' },
        { description: 'Front-end web development, DOM, events. This portfolio is entirely vanilla JS.' },
        { description: 'Back-end development, forms, sessions and database integration.' },
        { description: 'Complex queries, joins, subqueries, triggers, normal forms. Used in multiple projects.' },
      ],
    },
    skills: [
      { name: 'C',          icon: 'assets/images/c-icon.png', description: 'Programmation système, pointeurs, gestion mémoire. Utilisé en cours et projets bas niveau.', level: 2 },
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
    en: {
      label: 'Dev Tools',
      skills: [
        { description: 'Versioning, branches, merge, rebase. Used on all multi-developer code projects.' },
        { description: 'Repository hosting, issues, CI/CD. Institutional GitLab + GitHub for personal projects.' },
        { description: 'Main editor for web development, extensions, integrated debugging.' },
        { description: 'IntelliJ IDEA for Java, PhpStorm for PHP, CLion for C/C++. Full IDEs used in labs/projects.' },
        { description: 'Shell scripts, task automation, Linux system navigation.' },
        { description: 'Testing framework for JavaScript and Node.js, used for unit and integration testing.' },
      ],
    },
    skills: [
      { name: 'Git',               icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg', description: 'Versionning, branches, merge, rebase. Utilisé sur tous les projets de codes à plusieurs.', level: 3 },
      { name: 'GitLab/GitHub',   icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/gitlab/gitlab-original.svg', description: 'Hébergement de dépôts, issues, CI/CD. GitLab institutionnel + GitHub pour projets personnels.', level: 3 },
      { name: 'VS Code',           icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vscode/vscode-original.svg', description: 'Éditeur principal pour le développement web, extensions, debugging intégré.', level: 5 },
      { name: 'JetBrains',         icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/jetbrains/jetbrains-original.svg', description: 'IntelliJ IDEA pour Java, PhpStorm pour PHP, CLion pour C/C++. IDE complets utilisés en TP/Projets.', level: 4 },
      { name: 'Bash',              icon: 'assets/images/bash.webp', description: 'Scripts shell, automatisation de tâches, navigation système Linux.', level: 3 },
      { name: 'Mocha',              icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mocha/mocha-original.svg', description: 'Framework de test pour JavaScript et Node.js, utilisé pour les tests unitaires et d\'intégration.', level: 2 },
    ],
  },
  {
    label: 'Web',
    en: {
      label: 'Web',
      skills: [
        { description: 'Semantic structure, Flexbox, Grid, CSS animations, mobile-first responsive design.' },
        { description: 'Components, hooks, state management. Modern interface development. Used for the Aidémé web app.' },
        { description: 'PHP framework for developing robust and maintainable web applications.' },
      ],
    },
    skills: [
      { name: 'HTML / CSS', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg', description: 'Structure sémantique, Flexbox, Grid, animations CSS, responsive design mobile-first.', level: 4 },
      { name: 'React',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg', description: 'Composants, hooks, state management. Développement d\'interfaces modernes. Utilisé pour l\'Application web Aidémé.', level: 2 },
      { name: 'Symfony',      icon: 'assets/images/symfony.png', description: 'Framework PHP pour le développement d\'applications web robustes et maintenables.', level: 2 },
    ],
  },
  {
    label: 'Mobile',
    en: {
      label: 'Mobile',
      skills: [
        { description: 'Native Android development in Java: activities, fragments, intents.' },
        { description: 'Official Android IDE: emulator, layout editor, Gradle, debugging.' },
      ],
    },
    skills: [
      { name: 'Android',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/android/android-original.svg', description: 'Reprise et développement d\'applications natives Android en Java, activités, fragments, intents.', level: 2 },
      { name: 'Android Studio', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/androidstudio/androidstudio-original.svg', description: 'IDE officiel Android : émulateur, layout editor, Gradle, debugging.', level: 3 },
    ],
  },
  {
    label: 'Bases de données',
    en: {
      label: 'Databases',
      skills: [
        { description: 'Main DBMS used in projects: query optimization, integrity constraints.' },
        { description: 'Embedded database for mobile applications and lightweight projects.' },
        { description: 'Used for web projects with PHP, administration via phpMyAdmin.' },
      ],
    },
    skills: [
      { name: 'PostgreSQL', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg', description: 'SGBD principal utilisé en Projet : optimisation des requêtes, contraintes d\'intégrité.', level: 4 },
      { name: 'SQLite',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sqlite/sqlite-original.svg', description: 'Base embarquée pour applications mobiles et projets légers.', level: 2 },
      { name: 'MySQL',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg', description: 'Utilisé pour des projets web avec PHP, administration via phpMyAdmin.', level: 1 },
    ],
  },
  {
    label: 'Serveur / Réseau / Virtualisation',
    en: {
      label: 'Server / Network / Virtualization',
      skills: [
        { description: 'System administration, user and process management, permissions, ext4 filesystem.' },
        { description: 'HTTP server configuration, virtual hosts, modules. PHP site deployment.' },
        { description: 'PostgreSQL web administration interface, schema and query management.' },
        { description: 'Lightweight virtualization for testing operating systems and server configurations.' },
        { description: 'Virtualization platform for managing virtual machines and containers at scale.' },
        { description: 'Application containerization, image and volume management, orchestration with Docker Compose.' },
        { description: 'Network packet analyzer for troubleshooting and security.' },
      ],
    },
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

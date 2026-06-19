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
    title: 'Mini-Golf de Crolles : Refondre et enrichir une application (stage)',
    description: 'Stage de 8 semaines : reprise et refonte d\'une application web (React/TypeScript) pour un mini-golf immersif — migration du back-end vers Supabase, sécurité, performances et nombreuses nouvelles fonctionnalités. Déployée en production.',
    image: 'assets/images/home-stage.png',
    tags: ['React', 'TypeScript', 'Supabase', 'PWA'],
    links: [
      { url: 'https://app.minigolfcrolles.fr/', type: 'live' },
    ],
    en: {
      title: 'Mini-Golf de Crolles: Rebuild and Extend a Web App (internship)',
      description: 'An 8-week internship: taking over and rebuilding an existing web app (React/TypeScript) for an immersive mini-golf — back-end migrated to Supabase, security, performance and many new features. Deployed in production.',
      tags: ['React', 'TypeScript', 'Supabase', 'PWA'],
      details: {
        overview: 'An <em>8-week internship</em> (April–June 2026) carried out in a <em>team of three</em> at the <em>Mini-Golf de Crolles</em>, an immersive indoor mini-golf venue (BUT2 Computer Science, IUT2 Grenoble). The venue already had a <em>React / TypeScript</em> web app — but it only recorded scores and suffered from serious quality, security and performance issues. Our mission was to <em>take over this existing app and rebuild it</em>: we migrated the back-end from <em>Firebase to Supabase</em> (PostgreSQL), starting from a blank database at the owner\'s request, then delivered the full feature set he wanted — game flow, statistics, gamification, a social layer, customer reviews and a complete administration area — while drastically improving security, performance and code quality. The app ships as an installable <em>PWA</em>, deployed in production. (I use "we" for the team\'s collective work and "I" for my personal contribution.)',
        competences: [
          {
            title: 'Developing applications',
            items: [
              'Reverse-engineer an existing React / TypeScript codebase',
              'Build a layered front-end architecture (contexts, a shared game engine, route guards)',
              'Develop a broad set of features and accessible user interfaces',
            ],
          },
          {
            title: 'Optimizing applications',
            items: [
              'Rebuild the back-end (Firebase → Supabase) and move sensitive logic server-side',
              'Improve performance (server-side aggregation, pagination, dedicated indexes, targeted realtime)',
              'Set up a unit-test campaign (Vitest, 382 tests)',
            ],
          },
          {
            title: 'Managing information data',
            items: [
              'Design a relational schema and its security model (row-level security, RLS)',
              'Model registered vs guest identities with capability-based authorization',
            ],
          },
          {
            title: 'Collaborating within an IT team',
            items: [
              'Work in a three-person team, versioned with Git (432 commits) and organized on Trello',
              'Hold weekly meetings with the client to align the app with his vision',
            ],
          },
        ],
        objectifs: '• <em>Take over</em> an imperfect existing app, analyze it and rebuild it reliably<br>• <em>Migrate the back-end</em> to Supabase (PostgreSQL) for a sustainable cost model, better security and server-side tasks<br>• <em>Secure</em> the app (row-level security, sensitive logic moved server-side)<br>• Deliver the <em>full feature set</em> the owner wanted (gamification, social layer, reviews, complete back-office)<br>• <em>Ship</em> an installable, accessible PWA, deployed in production',
        equipe: 'An 8-week internship (April–June 2026) carried out in a <em>team of three</em>: <em>Paolo Colombat</em>, Mathis and Thomas.\nClient: Kévin Cros (owner of the Mini-Golf de Crolles, JKL Events). IUT tutor: Laurent Bonnaud.\nThe work was collaborative and versioned with <em>Git</em> (432 commits), organized on Trello, split roughly 50% on-site / 50% remote, with a <em>weekly meeting</em> with the owner to align the app with his vision and test it in real conditions.',
        travailIndividuel: 'Within the three-person team, my contribution was broad and cross-cutting. On the <em>foundations</em>, I led the reverse-engineering of the existing code and <em>factored the logic of the 18 holes</em> into a single game engine (<em>useGameLogic</em>), removing roughly <em>14,000 lines</em> of duplicated code.<br>On <em>game flow</em>, I implemented the fair playing order (Fisher-Yates shuffle, then frozen), the <em>staff validation</em> circuit for games (server-side decision, robust against reloads) and, above all, <em>fully anonymous play</em>: a visitor can play without an account, their writes being authorized "by capability" through a team secret checked by row-level security (<em>RLS</em>).<br>I also built much of the <em>experience</em>: immersive styling of the 3 worlds and the "course" page with its ranking animation (Mario-Kart style), a <em>levels, titles and animated "aura"</em> system (SVG), per-course records, the <em>social</em> layer (recovering guest games via a "claim" link, friends, customer reviews), real-time notifications, back-office moderation, light/dark theme and accessibility.<br>Finally, I set up the <em>unit-test campaign</em> (<em>Vitest</em>, 382 tests on the business logic) and a continuous <em>preview deployment</em> on Vercel.',
        techDetails: [
          'Back-end migration from Firebase/Firestore to Supabase (PostgreSQL), rebuilt on a blank database',
          'Row-level security (RLS); sensitive logic moved server-side (RPC functions, triggers, Edge Functions)',
          'Layered front-end architecture (React + TypeScript, Vite, Tailwind): 8 contexts, a useGameLogic engine, route guards',
          'Registered / guest identity model (capability-based authorization via team secret / share token)',
          'Back-office performance: server-side aggregation, pagination/sorting/search, dedicated indexes, targeted realtime',
          'Unit testing with Vitest (382 tests), error monitoring (Sentry), installable PWA with offline mode',
          'Deployment: Vercel (preview) then Hostinger (production); Deno Edge Functions (Resend emails, Web Push/VAPID)',
        ],
        challenges: 'The main difficulty was taking over an <em>imperfect existing codebase</em>: understanding it, then improving it without breaking anything. Our analysis led to a <em>structuring decision</em> — changing the technical foundation (Firebase → Supabase) mid-internship — which re-planned the whole project. Securing <em>anonymous play</em> was another challenge: letting guests write to the database without any session pushed us to a "capability-based" model, and a real flaw (the team secret was briefly readable by everyone) had to be closed by removing its read access and comparing it only inside a privileged server function. Finally, the <em>weekly dialogue with the owner</em> taught me to reformulate a client\'s needs and to explain technical options — and their limits — in plain language.',
        apercu: {
          image: 'assets/images/backoffice-stage.png',
          caption: 'Administration back-office — dashboard, statistics and moderation',
        },
      },
    },
    details: {
      overview: '<em>Stage de 8 semaines</em> (avril–juin 2026) réalisé en <em>équipe de trois</em> au <em>Mini-Golf de Crolles</em>, un mini-golf immersif en intérieur (BUT2 Informatique, IUT2 Grenoble). L\'établissement disposait déjà d\'une application web <em>React / TypeScript</em>, mais celle-ci se limitait à enregistrer les scores et présentait d\'importantes faiblesses de qualité, de sécurité et de performance. Notre mission a consisté à <em>reprendre cette application existante et à la refondre</em> : nous avons migré le back-end de <em>Firebase vers Supabase</em> (PostgreSQL), en repartant d\'une base vierge à la demande du gérant, puis livré l\'ensemble des fonctionnalités qu\'il souhaitait — déroulé de partie, statistiques, gamification, dimension sociale, avis clients et espace d\'administration complet — tout en améliorant nettement la sécurité, les performances et la qualité du code. L\'application est distribuée en <em>PWA</em> installable et déployée en production. (J\'emploie « nous » pour le travail collectif et « je » pour ma contribution personnelle.)',
      competences: [
        {
          title: 'Réaliser un développement d\'application',
          items: [
            'Rétro-concevoir un code existant en React / TypeScript',
            'Bâtir une architecture front en couches (contextes, moteur de jeu commun, gardes de routes)',
            'Développer un large périmètre de fonctionnalités et des interfaces accessibles',
          ],
        },
        {
          title: 'Optimiser des applications',
          items: [
            'Reconstruire le back-end (Firebase → Supabase) et déporter la logique sensible côté serveur',
            'Améliorer les performances (agrégation côté base, pagination, index dédiés, temps réel ciblé)',
            'Mettre en place une campagne de tests unitaires (Vitest, 382 tests)',
          ],
        },
        {
          title: 'Gérer des données de l\'information',
          items: [
            'Concevoir un schéma relationnel et son modèle de sécurité (sécurité au niveau ligne, RLS)',
            'Modéliser les identités inscrits / invités avec une autorisation « par capacité »',
          ],
        },
        {
          title: 'Collaborer au sein d\'une équipe informatique',
          items: [
            'Travailler en équipe de trois, versionnée sous Git (432 commits) et organisée sur Trello',
            'Tenir un point hebdomadaire avec le client pour aligner l\'application sur sa vision',
          ],
        },
      ],
      objectifs: '• <em>Reprendre</em> une application existante imparfaite, l\'analyser et la refondre de manière fiable<br>• <em>Migrer le back-end</em> vers Supabase (PostgreSQL) pour un coût soutenable, une meilleure sécurité et des tâches serveur<br>• <em>Sécuriser</em> l\'application (sécurité au niveau ligne, logique sensible déportée côté serveur)<br>• Livrer l\'<em>ensemble des fonctionnalités</em> voulues par le gérant (gamification, social, avis, back-office complet)<br>• <em>Déployer</em> une PWA installable et accessible, mise en production',
      equipe: 'Stage de 8 semaines (avril–juin 2026) mené en <em>équipe de trois</em> : <em>Paolo Colombat</em>, Mathis et Thomas.\nClient : Kévin Cros (gérant du Mini-Golf de Crolles, JKL Events). Tuteur IUT : Laurent Bonnaud.\nTravail collaboratif et versionné sous <em>Git</em> (432 commits), organisé sur Trello, réparti à environ 50 % en présentiel et 50 % en télétravail, avec un <em>point hebdomadaire</em> avec le gérant pour aligner l\'application sur sa vision et la tester en conditions réelles.',
      travailIndividuel: 'Au sein de l\'équipe de trois, ma contribution a été large et transverse. Côté <em>fondations</em>, j\'ai mené la rétro-conception du code existant et <em>factorisé la logique des 18 trous</em> dans un moteur de jeu unique (<em>useGameLogic</em>), supprimant environ <em>14 000 lignes</em> de code dupliqué.<br>Sur le <em>déroulé d\'une partie</em>, j\'ai implémenté l\'ordre de passage équitable (mélange de Fisher-Yates, puis figé), le circuit de <em>validation des parties par le staff</em> (décision côté serveur, robuste au rechargement) et surtout le <em>jeu 100 % anonyme</em> : un visiteur peut jouer sans compte, ses écritures étant autorisées « par capacité » via un secret d\'équipe vérifié par la sécurité au niveau ligne (<em>RLS</em>).<br>J\'ai aussi réalisé une grande partie de l\'<em>expérience</em> : habillage immersif des 3 univers et page « parcours » avec son animation de classement (façon Mario Kart), système de <em>niveaux, titres et « aura »</em> animée (SVG), records par parcours, dimension <em>sociale</em> (récupération des parties d\'invité par lien « claim », amis, avis clients), notifications en temps réel, modération du back-office, thème clair/sombre et accessibilité.<br>Enfin, j\'ai mis en place la <em>campagne de tests unitaires</em> (<em>Vitest</em>, 382 tests sur la logique métier) et un <em>déploiement de test</em> continu sur Vercel.',
      techDetails: [
        'Migration du back-end de Firebase/Firestore vers Supabase (PostgreSQL), reconstruction sur base vierge',
        'Sécurité au niveau ligne (RLS) ; logique sensible déportée côté serveur (fonctions RPC, triggers, Edge Functions)',
        'Architecture front en couches (React + TypeScript, Vite, Tailwind) : 8 contextes, moteur useGameLogic, gardes de routes',
        'Modèle d\'identité inscrits / invités (autorisation « par capacité » via secret d\'équipe / jeton de partage)',
        'Performances du back-office : agrégation côté base, pagination/tri/recherche serveur, index dédiés, temps réel ciblé',
        'Tests unitaires avec Vitest (382 tests), surveillance des erreurs (Sentry), PWA installable avec mode hors-ligne',
        'Déploiement : Vercel (test) puis Hostinger (production) ; Edge Functions Deno (emails Resend, push Web Push/VAPID)',
      ],
      challenges: 'La principale difficulté était de reprendre un <em>code existant imparfait</em> : le comprendre, puis l\'améliorer sans rien casser. Notre analyse a mené à une <em>décision structurante</em> — changer le socle technique (Firebase → Supabase) en cours de stage — qui a redéfini tout le planning. Sécuriser le <em>jeu anonyme</em> fut un autre défi : autoriser des invités à écrire en base sans aucune session nous a conduits à un modèle « par capacité », et une vraie faille (le secret d\'équipe était un temps lisible par tous) a dû être corrigée en retirant son droit de lecture et en ne le comparant que dans une fonction serveur habilitée. Enfin, le <em>dialogue hebdomadaire avec le gérant</em> m\'a appris à reformuler les besoins d\'un client et à lui exposer, en langage clair, les options techniques et leurs limites.',
      apercu: {
        image: 'assets/images/backoffice-stage.png',
        caption: 'Back-office d\'administration — tableau de bord, statistiques et modération',
      },
    },
  },
  {
    title: 'Mon carnet de stage : Améliorer et optimiser une application existante',
    description: 'Maintenance évolutive d\'une application existante (mobile Android + back-office Symfony + PostgreSQL) : qualité logicielle, refonte du back-end, tests automatisés et conteneurisation.',
    image: 'assets/images/carnet de stage.png',
    tags: ['Symfony', 'PHPUnit', 'Qualité logicielle', 'Docker'],
    en: {
      title: 'My Internship Logbook: Improve and Optimize an Existing App',
      description: 'Evolutionary maintenance of an existing application (Android mobile + Symfony back-office + PostgreSQL): software quality, back-end overhaul, automated testing and containerization.',
      tags: ['Symfony', 'PHPUnit', 'Software Quality', 'Docker'],
      details: {
        overview: 'Carried out by a <em>team of six</em> as part of <em>SAÉ S4</em> ("Developing a complex application", BUT2 Computer Science, IUT2 Grenoble), this project was an exercise in <em>evolutionary maintenance</em>: rather than building from scratch, the goal was to <em>evaluate and improve an existing application</em> — its design, ergonomics, performance and software quality — without adding new features. The application forms a complete ecosystem: an <em>Android</em> mobile app (Java / Retrofit), a <em>Symfony</em> web back-office (PHP / Twig / API Platform) and a <em>PostgreSQL</em> database. After a <em>reverse-engineering</em> phase, the work was organized around three axes: restructuring the data model (towards <em>3rd normal form</em>), optimizing the code (Symfony architecture, repositories, queries) and guaranteeing software quality (automated <em>tests</em> and an <em>ISO 25000</em> quality approach), with deployment hardened through <em>Docker</em> containerization.',
        competences: [
          {
            title: 'Developing applications',
            items: [
              'Reverse-engineer and take ownership of an existing codebase (Symfony + Android)',
              'Refactor a Symfony back-end to comply with the framework standards',
              'Develop functional and unit tests (PHPUnit)',
              'Improve accessible user interfaces (ergonomics, screen readers)',
            ],
          },
          {
            title: 'Optimizing applications',
            items: [
              'Analyze software quality methodically using the ISO 25000 (SQuaRE) standard',
              'Restructure code: architecture, repositories and database queries',
            ],
          },
          {
            title: 'Managing information data',
            items: [
              'Redesign a data model to comply with 3rd normal form (3NF)',
              'Reinforce data integrity (validation and uniqueness constraints)',
            ],
          },
          {
            title: 'Collaborating within an IT team',
            items: [
              'Work within a six-person team split into two sub-teams (web / mobile)',
              'Coordinate through regular syncs and Git versioning',
            ],
          },
        ],
        objectifs: '• <em>Improve</em> an existing application without rebuilding it (evolutionary maintenance)<br>• <em>Evaluate</em> its quality — design, ergonomics, performance, software quality<br>• <em>Harden reliability</em> through automated tests and data-integrity constraints<br>• Improve <em>ergonomics and accessibility</em> (Bastien & Scapin criteria, ISO 25000)<br>• Ensure <em>portability</em> through Docker containerization',
        equipe: 'Project team of <em>six</em> (Group 6), SAÉ S4 (4.REAL.01):\nYann Herbrecht, Elouan Clerger, <em>Paolo Colombat</em>, Mathieu Daniel, Quentin Lang, Octave Lejeune.\nThe team was split into <em>two sub-teams of three</em> — one on the <em>Symfony web back-office</em>, the other on the <em>Android mobile app</em> — with regular syncs to keep the solutions consistent. I worked on the <em>server / back-office</em> side and on the cross-cutting <em>quality</em> analysis.',
        travailIndividuel: 'I led the <em>learnability</em> quality analysis (<em>ISO 25010</em>) of the mobile app: choosing and justifying the criterion, targeting the relevant <em>Bastien & Scapin</em> criteria (guidance, consistency, meaningful codes, error handling) and designing a dedicated <em>SUS</em> questionnaire.<br>On the <em>Symfony server</em> side, I carried out a code overhaul: adding <em>validation</em> (Asserts) and <em>uniqueness</em> constraints on the entities, cleaning up the <em>repositories</em> (removing <em>findAll()</em> overrides, migrating implicit DQL to the <em>QueryBuilder</em>) and improving the <em>forms</em> (explicit field typing, manual <em>required</em> control, accessible labels).<br>Finally, I built a <em>PHPUnit</em> test suite in strict isolation (mocks): <em>security</em> tests (LoginFormAuthenticator, CSRF, redirections — 100% coverage), behavioral tests of the offer controller, and tests of the import service (regex robustness), where I found and fixed a <em>date-parsing bug</em> (PHP read the day as a month) by forcing strict French parsing via <em>createFromFormat</em>.',
        techDetails: [
          'Reverse-engineering an existing app (Symfony / API Platform + Android / Retrofit + PostgreSQL)',
          'Symfony entity overhaul: validation (Asserts) and uniqueness (UniqueEntity) constraints',
          'Repository cleanup: removing findAll() overrides, migrating DQL to QueryBuilder',
          'Form improvements: explicit typing, required control, accessible labels (screen readers)',
          'PHPUnit tests in isolation (mocks): security, controller, import service; coverage report (PHPDBG)',
          'ISO 25000 / SQuaRE quality approach: learnability, Bastien & Scapin criteria, SUS, Think Aloud',
          'Project scope: 3NF data-model redesign and Docker containerization',
        ],
        challenges: 'Working on an <em>existing codebase</em> meant first understanding it, then improving it without breaking anything — the original back-end had business logic too tightly coupled to the controllers and a structure that did not follow Symfony standards. On the testing side, <em>instability in the test environment</em> (network mapping between the host and the Docker PostgreSQL containers) led us to a strict <em>isolation / mocks</em> strategy rather than end-to-end coverage. That choice paid off: a test on the import service surfaced a <em>date-parsing bug</em> — PHP read "15/04/2025" as a US-format date and tried to read a fifteenth month — fixed by forcing strict French parsing.',
      },
    },
    details: {
      overview: 'Réalisé en <em>équipe de six</em> dans le cadre de la <em>SAÉ S4</em> (« Développement d\'une application complexe », BUT2 Informatique, IUT2 Grenoble), ce projet relevait de la <em>maintenance évolutive</em> : plutôt que de repartir de zéro, il s\'agissait d\'<em>évaluer et d\'améliorer une application existante</em> — sa conception, son ergonomie, ses performances et sa qualité logicielle — sans ajouter de nouvelles fonctionnalités. L\'application forme un écosystème complet : une application mobile <em>Android</em> (Java / Retrofit), un back-office web <em>Symfony</em> (PHP / Twig / API Platform) et une base de données <em>PostgreSQL</em>. Après une phase de <em>rétroconception</em>, le travail s\'est organisé autour de trois axes : la restructuration du modèle de données (vers la <em>troisième forme normale</em>), l\'optimisation du code (architecture Symfony, repositories, requêtes) et la garantie de la qualité logicielle (<em>tests</em> automatisés et démarche qualité <em>ISO 25000</em>), avec une mise en fonctionnement fiabilisée par la <em>conteneurisation Docker</em>.',
      competences: [
        {
          title: 'Réaliser un développement d\'application',
          items: [
            'Rétroconcevoir et s\'approprier un code existant (Symfony + Android)',
            'Refondre un back-end Symfony pour le rendre conforme aux standards du framework',
            'Développer des tests fonctionnels et unitaires (PHPUnit)',
            'Améliorer des interfaces utilisateurs accessibles (ergonomie, lecteurs d\'écran)',
          ],
        },
        {
          title: 'Optimiser des applications',
          items: [
            'Analyser la qualité logicielle avec méthode via la norme ISO 25000 (SQuaRE)',
            'Restructurer le code : architecture, repositories et requêtes de base de données',
          ],
        },
        {
          title: 'Gérer des données de l\'information',
          items: [
            'Re-concevoir un modèle de données conforme à la troisième forme normale (3FN)',
            'Renforcer l\'intégrité des données (contraintes de validation et d\'unicité)',
          ],
        },
        {
          title: 'Collaborer au sein d\'une équipe informatique',
          items: [
            'Travailler dans une équipe de six répartie en deux sous-groupes (web / mobile)',
            'Se coordonner par des points réguliers et le versioning Git',
          ],
        },
      ],
      objectifs: '• <em>Améliorer</em> une application existante sans tout refaire (maintenance évolutive)<br>• <em>Évaluer</em> sa qualité — conception, ergonomie, performance, qualité logicielle<br>• <em>Fiabiliser</em> l\'application par des tests automatisés et des contraintes d\'intégrité<br>• Améliorer l\'<em>ergonomie</em> et l\'<em>accessibilité</em> (critères de Bastien & Scapin, ISO 25000)<br>• Garantir la <em>portabilité</em> grâce à la conteneurisation Docker',
      equipe: 'Équipe projet de <em>six</em> (Groupe 6), SAÉ S4 (4.REAL.01) :\nYann Herbrecht, Elouan Clerger, <em>Paolo Colombat</em>, Mathieu Daniel, Quentin Lang, Octave Lejeune.\nL\'équipe était répartie en <em>deux sous-groupes de trois</em> — l\'un sur le <em>back-office web Symfony</em>, l\'autre sur l\'<em>application mobile Android</em> — avec des points réguliers pour garder des solutions cohérentes. Je suis intervenu côté <em>serveur / back-office</em> et sur l\'analyse <em>qualité</em> transverse.',
      travailIndividuel: 'J\'ai mené l\'analyse qualité de la <em>facilité d\'apprentissage</em> (<em>ISO 25010</em>) de l\'application mobile : choix et justification du critère, ciblage des critères de <em>Bastien & Scapin</em> pertinents (guidage, homogénéité/cohérence, signifiance des codes, gestion des erreurs) et conception d\'un questionnaire <em>SUS</em> dédié.<br>Côté <em>serveur Symfony</em>, j\'ai réalisé une refonte du code : ajout de contraintes de <em>validation</em> (Asserts) et d\'<em>unicité</em> sur les entités, nettoyage des <em>repositories</em> (suppression des surcharges de <em>findAll()</em>, passage du DQL implicite au <em>QueryBuilder</em>) et amélioration des <em>formulaires</em> (typage explicite, contrôle du <em>required</em>, labels accessibles).<br>Enfin, j\'ai mis en place une suite de tests <em>PHPUnit</em> en isolation (mocks) : tests de <em>sécurité</em> (LoginFormAuthenticator, CSRF, redirections — 100 % de couverture), tests comportementaux du contrôleur d\'offres et tests du service d\'import (robustesse des regex), où j\'ai découvert et corrigé un <em>bug d\'interprétation des dates</em> (PHP lisait le jour comme un mois) en forçant le format français via <em>createFromFormat</em>.',
      techDetails: [
        'Rétroconception d\'une application existante (Symfony / API Platform + Android / Retrofit + PostgreSQL)',
        'Refonte des entités Symfony : contraintes de validation (Asserts) et d\'unicité (UniqueEntity)',
        'Nettoyage des repositories : suppression des surcharges de findAll(), migration DQL → QueryBuilder',
        'Amélioration des formulaires : typage explicite, contrôle du required, labels accessibles (lecteurs d\'écran)',
        'Tests PHPUnit en isolation (mocks) : sécurité, contrôleur, service d\'import ; rapport de couverture (PHPDBG)',
        'Démarche qualité ISO 25000 / SQuaRE : facilité d\'apprentissage, critères de Bastien & Scapin, SUS, Think Aloud',
        'Périmètre projet : refonte du modèle de données en 3FN et conteneurisation Docker',
      ],
      challenges: 'Travailler sur un <em>code existant</em> impliquait d\'abord de le comprendre, puis de l\'améliorer sans rien casser — le back-end d\'origine présentait une logique métier trop liée aux contrôleurs et une arborescence non conforme aux standards Symfony. Côté tests, l\'<em>instabilité de l\'environnement</em> (mapping réseau entre la machine hôte et les conteneurs Docker PostgreSQL) nous a conduits à une stratégie d\'<em>isolation stricte</em> par mocks plutôt qu\'à des tests de bout en bout. Ce choix a payé : un test du service d\'import a révélé un <em>bug de traitement des dates</em> — PHP interprétait « 15/04/2025 » au format américain et tentait de lire un quinzième mois — corrigé en forçant l\'interprétation stricte au format français.',
    },
  },
  {
    title: 'SpeedSteamDle : Développer une interface web pour des API publiques',
    description: 'Interface web monopage (Vanilla JS) au-dessus des API Steam et Speedrun.com : recherche d\'un jeu, joueurs connectés en temps réel, record du monde Any%, favoris et mini-jeu de duel.',
    image: 'assets/images/speedsteamdle.png',
    tags: ['Vanilla JS', 'API REST', 'MVC', 'Accessibilité'],
    links: [
      { url: 'https://malevolentmoksi.github.io/r4a10-tp-api-2026-colombpa-morelloe/', type: 'live' },
    ],
    en: {
      title: 'SpeedSteamDle: Build a Web Interface for Public APIs',
      description: 'A single-page Vanilla-JS interface over the Steam and Speedrun.com APIs: search a game, live player count, Any% world record, favorites and a duel mini-game.',
      tags: ['Vanilla JS', 'REST API', 'MVC', 'Accessibility'],
      details: {
        overview: 'Built in a <em>pair</em> with Enzo Morello as part of the <em>TP-API</em> (module <em>R4.A.10</em> — client-side Web JavaScript, 2nd-year BUT in Computer Science, IUT2 Grenoble), <em>SpeedSteamDle</em> is a <em>single-page</em> web app acting as an interface to two public APIs: the <em>Steam API</em> (game search and live connected-player count) and the <em>Speedrun.com API</em> (Any% category world record). The user types a game name and the app cross-references both sources into a single result: banner, live players and the standing Any% record. Searches can be saved as <em>favorites</em> (LocalStorage), and a <em>"Steam Duel"</em> higher-or-lower mini-game reuses both APIs. The teaching constraint required <em>100% "Vanilla"</em> development (no framework, no PHP), hosted statically on <em>GitHub Pages</em>.',
        competences: [
          {
            title: 'Developing applications',
            items: [
              'Design a communicating app consuming third-party REST APIs in AJAX (fetch)',
              'Handle and process JSON data',
              'Structure the code with the MVC pattern and split it into JavaScript modules',
              'Develop an accessible user interface (ARIA, keyboard navigation)',
            ],
          },
          {
            title: 'Optimizing applications',
            items: [
              'Set up a serverless proxy (Cloudflare Worker) to solve CORS and quota issues',
              'Optimize network calls (Promise.all parallelization, debounce, cache, timeout, fallback strategies)',
            ],
          },
          {
            title: 'Collaborating within an IT team',
            items: [
              'Work as a pair with Git / GitHub versioning',
              'Continuously deploy via GitHub Pages',
            ],
          },
        ],
        objectifs: '• Provide a <em>simple, readable</em> interface over two heterogeneous APIs, <em>cross-referencing their data</em> (Steam game ↔ Speedrun.com record)<br>• Show only a <em>relevant subset</em> of information rather than the full API response<br>• Guarantee a <em>smooth experience</em> despite slow third-party APIs (visible loading, fallback, timeout)<br>• Polish <em>ergonomics</em> and <em>accessibility</em> (explicitly graded criteria)<br>• Persist <em>favorites</em> client-side, with no business back-end',
        equipe: 'A <em>pair</em> project: Paolo Colombat & Enzo Morello.\nOrganized with <em>Git / GitHub</em> and a <em>Markdown to-do list</em>, prioritizing the <em>core features</em> of the brief and <em>accessibility</em> first, then a <em>bonus mini-game</em> once time allowed.\nWork was split <em>by feature</em> rather than by layer to limit integration friction, with continuous deployment via GitHub Pages.',
        travailIndividuel: 'I set up the project\'s <em>modular architecture</em> (MVC in ES modules), and the <em>API-call system</em> was built together. Then, while Enzo focused on <em>accessibility</em>, ergonomics and <em>favorites</em>, I handled the <em>search bar</em>, <em>LocalStorage</em> persistence and the <em>"Steam Duel" bonus mini-game</em>.<br>I notably <em>reworked that mini-game in depth after the lab</em>: originally the duels did not chain, games could repeat and there was no streak system. I turned it into a real <em>game loop</em> — <em>automatic chaining</em> of duels, a <em>streak</em> with live win-rate, and <em>more reliable draws</em> (re-draw if a game has no active players, no Any% record, or in case of a tie). I also handled a <em>race condition</em>: a draw counter ignores the result of a stale request if the user switches mode during loading.',
        techDetails: [
          'MVC architecture in native JavaScript, split into ES modules (import/export), no framework',
          'Consuming and orchestrating multiple REST APIs (Steam then Speedrun.com chained), JSON, JSDoc documentation',
          'Working around CORS: public proxies with cascading fallback, then a self-hosted Cloudflare Worker (Wrangler)',
          'Network optimizations: Promise.all, debounce + cache for autocomplete, 8 s timeout',
          'String processing with regular expressions: result matching/scoring, category normalization, ISO 8601 duration conversion',
          'LocalStorage persistence: favorites stored as a single JSON entry, deduplicated and normalized',
          'Accessibility: ARIA (aria-live, aria-expanded), visually-hidden labels, focus trap in the modal, full keyboard support',
        ],
        challenges: 'The direct <em>Speedrun.com search</em> often failed: we used the <em>official title returned by Steam</em> as the source of truth, which made the two requests sequential. Repeated <em>CORS errors</em> on the Steam API were solved through an escalation — several public proxies with automatic fallback, then ultimately our <em>own Cloudflare Worker</em> to escape rate limits and flaky third-party proxies. <em>Inconsistent Speedrun.com categories</em> caused a subtle bug (HTTP 400 on Cuphead), fixed with a <em>per-game</em> filter when fetching categories. Finally, for lack of time, the mini-game relies on a <em>curated catalog of well-known games</em> rather than a fully random draw — an improvement already identified.',
        apercu: {
          image: 'assets/images/speedsteamdle-duel.png',
          caption: '"Steam Duel" mini-game — chained duels and streak tracking',
        },
      },
    },
    details: {
      overview: 'Réalisée en <em>binôme</em> avec Enzo Morello dans le cadre du <em>TP-API</em> (ressource <em>R4.A.10</em> — Compléments Web JavaScript, BUT2 Informatique, IUT2 Grenoble), <em>SpeedSteamDle</em> est une application web <em>monopage</em> qui sert d\'interface à deux API publiques : l\'<em>API Steam</em> (recherche de jeux et nombre de joueurs connectés en temps réel) et l\'<em>API Speedrun.com</em> (record du monde de la catégorie Any%). L\'utilisateur saisit le nom d\'un jeu et l\'application croise les deux sources dans un même résultat : bannière, joueurs actifs à l\'instant T et record Any% en vigueur. Les recherches peuvent être enregistrées en <em>favoris</em> (LocalStorage), et un mini-jeu <em>« Steam Duel »</em> de type higher-or-lower réutilise les deux API. La contrainte pédagogique imposait un développement <em>100 % « Vanilla »</em> (pas de framework, pas de PHP), hébergé en statique sur <em>GitHub Pages</em>.',
      competences: [
        {
          title: 'Réaliser un développement d\'application',
          items: [
            'Concevoir une application communicante consommant des API REST tierces en AJAX (fetch)',
            'Manipuler et traiter des données au format JSON',
            'Structurer le code selon le patron MVC et le découper en modules JavaScript',
            'Développer une interface utilisateur accessible (ARIA, navigation clavier)',
          ],
        },
        {
          title: 'Optimiser des applications',
          items: [
            'Mettre en place un proxy serverless (Cloudflare Worker) pour résoudre les problèmes de CORS et de quotas',
            'Optimiser les appels réseau (parallélisation Promise.all, debounce, cache, timeout, stratégies de repli)',
          ],
        },
        {
          title: 'Collaborer au sein d\'une équipe informatique',
          items: [
            'Travailler en binôme avec versioning Git / GitHub',
            'Déployer en continu via GitHub Pages',
          ],
        },
      ],
      objectifs: '• Offrir une interface <em>simple et lisible</em> au-dessus de deux API hétérogènes, en <em>croisant leurs données</em> (jeu Steam ↔ record Speedrun.com)<br>• N\'afficher qu\'un <em>sous-ensemble pertinent</em> d\'informations plutôt que toute la réponse de l\'API<br>• Garantir une <em>expérience fluide</em> malgré la lenteur des API tierces (chargement visible, repli, timeout)<br>• Soigner l\'<em>ergonomie</em> et l\'<em>accessibilité</em> (critères explicitement évalués)<br>• Persister les <em>favoris</em> côté client, sans aucun back-end métier',
      equipe: 'Projet réalisé en <em>binôme</em> : Paolo Colombat & Enzo Morello.\nOrganisation sous <em>Git / GitHub</em> avec une <em>todo-list en Markdown</em>, en priorisant d\'abord les <em>fonctionnalités de base</em> du sujet et l\'<em>accessibilité</em>, puis un <em>mini-jeu bonus</em> une fois le temps disponible.\nRépartition <em>par fonctionnalité</em> plutôt que par couche, pour limiter les frictions à l\'assemblage, et déploiement continu via GitHub Pages.',
      travailIndividuel: 'J\'ai mis en place l\'<em>architecture modulaire</em> du projet (MVC en modules ES), et le <em>système d\'appels aux API</em> a été développé à deux. Ensuite, pendant qu\'Enzo se concentrait sur l\'<em>accessibilité</em>, l\'ergonomie et les <em>favoris</em>, je me suis chargé de la <em>barre de recherche</em>, de la persistance <em>LocalStorage</em> et du <em>mini-jeu bonus « Steam Duel »</em>.<br>J\'ai surtout <em>retravaillé ce mini-jeu en profondeur après le TP</em> : à l\'origine, les duels ne s\'enchaînaient pas, les jeux pouvaient se répéter et il n\'existait pas de système de série. J\'en ai fait une véritable <em>boucle de jeu</em> — <em>enchaînement automatique</em> des duels, suivi d\'une <em>série</em> avec winrate en direct, et <em>fiabilisation du tirage</em> (re-tirage si un jeu n\'a pas de joueurs actifs, pas de record Any% ou en cas d\'égalité). J\'ai aussi géré une <em>condition de course</em> : un compteur de tirage ignore le résultat d\'une requête obsolète si l\'utilisateur change de mode pendant un chargement.',
      techDetails: [
        'Architecture MVC en JavaScript natif, découpée en modules ES (import/export), sans framework',
        'Consommation et orchestration de plusieurs API REST (Steam puis Speedrun.com chaînés), JSON, documentation JSDoc',
        'Contournement des restrictions CORS : proxies publics avec repli en cascade, puis Cloudflare Worker auto-hébergé (Wrangler)',
        'Optimisations réseau : Promise.all, debounce + cache de l\'autocomplétion, timeout de 8 s',
        'Traitement de chaînes par expressions régulières : matching / scoring des résultats, normalisation des catégories, conversion des durées ISO 8601',
        'Persistance LocalStorage : favoris stockés en une seule entrée JSON, dédoublonnée et normalisée',
        'Accessibilité : ARIA (aria-live, aria-expanded), labels masqués, focus trap dans la modale, support clavier complet',
      ],
      challenges: 'La <em>recherche Speedrun.com</em> directe échouait souvent : nous avons utilisé le <em>titre officiel renvoyé par Steam</em> comme source de vérité, rendant les deux requêtes séquentielles. Les <em>erreurs CORS</em> répétées sur l\'API Steam ont été résolues par une escalade de solutions — plusieurs proxies publics avec repli automatique, puis finalement notre <em>propre Cloudflare Worker</em> pour s\'affranchir des rate limits et des aléas des proxies tiers. Des <em>catégories Speedrun.com incohérentes</em> provoquaient un bug subtil (erreur HTTP 400 sur Cuphead), corrigé par un filtre <em>per-game</em> dès la récupération des catégories. Enfin, faute de temps, le mini-jeu s\'appuie sur un <em>catalogue curé de jeux connus</em> plutôt que sur un tirage 100 % aléatoire — une piste d\'amélioration déjà identifiée.',
      apercu: {
        image: 'assets/images/speedsteamdle-duel.png',
        caption: 'Mini-jeu « Steam Duel » — duels enchaînés et suivi de la série',
      },
    },
  },
  {
    title: 'Aidémé : Développer une application web pour les aidants familiaux',
    description: 'Application web collaborative permettant à plusieurs aidants de coordonner le suivi d\'une même personne âgée dépendante — agenda, photos, documents et contacts centralisés.',
    image: 'assets/images/aideme-logo.png',
    imageFit: 'contain',
    tags: ['React', 'PHP', 'SQL', 'Gestion de projet'],
    en: {
      title: 'Aidémé: Build a Web App for Family Caregivers',
      description: 'A collaborative web app letting several caregivers coordinate the care of the same dependent elderly person — centralized calendar, photos, documents and contacts.',
      tags: ['React', 'PHP', 'SQL', 'Project Management'],
      details: {
        overview: 'Built by a <em>team of six</em> (Team 08 "Aimédia"), <em>Aidémé</em> — a blend of the French "<em>Aider</em>" (to help) and "<em>Aimer</em>" (to love) — is a web app born from a simple observation: in France, <em>9.3 million people</em> care for a dependent relative and face a heavy, often invisible, mental load. Designed for family caregivers and professionals (nurses, home helpers) supporting elderly people losing autonomy (<em>GIR 3–4</em>, AGGIR scale), it centralizes the <em>calendar</em>, <em>photo album</em>, <em>documents</em> and <em>contacts</em> tied to the cared-for person.<br>Carried out as part of <em>SAÉ S3.01</em> (2nd-year BUT in Computer Science, IUT2 Grenoble), it relies on an <em>MVC client/server</em> architecture: a <em>React</em> (Vite) front-end talking to a <em>PHP</em> back-end (<em>DAO</em> pattern) backed by a relational database.',
        competences: [
          {
            title: 'Developing applications',
            items: [
              'Design and build a communicating application (React client / PHP server)',
              'Develop accessible user interfaces',
              'Conduct tests and evaluate results (usability testing)',
            ],
          },
          {
            title: 'Managing information data',
            items: [
              'Design a relational database from a class diagram',
              'Update and query the database via SQL (DAO / PDO layer)',
            ],
          },
          {
            title: 'Leading a project',
            items: [
              'Understand client and user needs (personas)',
              'Set up project management tools and risk tracking',
              'Identify stakeholders and development cycle phases',
            ],
          },
          {
            title: 'Collaborating within an IT team',
            items: [
              'Coordinate a six-person multidisciplinary team',
              'Acquire interpersonal skills for teamwork',
            ],
          },
        ],
        objectifs: '• Make the caregivers\' "invisible work" <em>visible</em> and ease their <em>mental load</em><br>• <em>Centralize</em> and <em>coordinate</em> the care of one person across relatives and professionals<br>• Guarantee <em>accessibility</em> for users not always comfortable with technology (dark theme, dyslexia mode, high contrast, large text)<br>• Comply with <em>GDPR</em> for sensitive health data (<em>Article 9</em>: Privacy by Design, role-based access control)',
        equipe: 'Project team 8 — "Aimédia" (6 members):\n<em>Project manager</em>: Paolo Colombat\n<em>Quality lead</em>: Jérémie Fauvet-Messat\n<em>Technical lead (back-end)</em>: Simon Krumb\n<em>UI/UX & accessibility lead</em>: Enzo Morello\n<em>Communication & documentation</em>: Macéo Guicherd-Callin\n<em>Network & systems</em>: Noam Bruchet-Joannon\nThe project ran in <em>three phases</em> (scoping and needs, design and architecture, development and testing), each validated by a written report and an oral defense before the teaching staff.',
        travailIndividuel: 'As <em>project manager</em>, I handled team <em>coordination</em>, work <em>organization</em> and the <em>writing of the reports</em> delivered to the teaching staff at each phase. After a first deliverable judged too long and unprofessional, I <em>drove the switch from Google Docs to LaTeX</em>, which markedly improved the quality and consistency of our documents (a direct response to the "unprofessional deliverable" risk).<br>On the design side, I contributed to the <em>modeling</em> and the technical <em>organization</em> of the project. On the development side, I wrote several <em>DAO queries</em> and built the <em>Contacts page</em> used to assemble the team of caregivers and professionals around a cared-for person.<br>Finally, I ran <em>many "Think Aloud" tests</em> with a deliberately varied panel from my circle (relatives comfortable or not with computers, parents…), complemented by the <em>SUS</em> method, to validate usability for the widest possible audience.',
        techDetails: [
          'MVC client/server architecture: React (Vite) + PHP API, DAO pattern via PDO',
          'Relational database design (class diagram → schema → SQL)',
          'SQL queries and DAO layer development (CRUD operations)',
          'Project management: milestones, risk tracking, Trello, Git / GitLab versioning',
          'Professional report writing in LaTeX',
          'Usability testing: "Think Aloud" method and SUS questionnaire on varied profiles',
          'GDPR compliance: sensitive data (Art. 9), Privacy by Design, role-based access control',
        ],
        challenges: 'The <em>first deliverable</em>, too long and unprofessional, forced a change of method: a move to <em>LaTeX</em> and a new way of working. <em>Front/back integration</em> first suffered from a strict "Front" / "Back" split that caused friction when wiring the two together; the team then <em>pivoted to feature-based development</em>, which sped up production and strengthened cohesion. Setting up the <em>server</em> proved more complex than expected (an underestimated technical risk), and <em>inconsistent naming conventions</em> created technical debt we would have avoided by agreeing on those rules from the start.',
        apercu: {
          image: 'assets/images/aideme-home.png',
          caption: 'Aidémé home page — desktop view, light theme',
        },
      },
    },
    details: {
      overview: 'Réalisée en <em>équipe de six</em> (Team 08 « Aimédia »), <em>Aidémé</em> — contraction d\'« <em>Aider</em> » et d\'« <em>Aimer</em> » — est une application web née d\'un constat : en France, <em>9,3 millions de personnes</em> aident un proche dépendant et font face à une lourde charge mentale, souvent invisible. Pensée pour les aidants familiaux et les intervenants (infirmiers, aides à domicile) autour de personnes âgées en perte d\'autonomie (<em>GIR 3–4</em>, grille AGGIR), elle centralise au même endroit l\'<em>agenda</em>, le <em>catalogue photo</em>, les <em>documents</em> et les <em>contacts</em> liés à la personne aidée.<br>Menée dans le cadre de la <em>SAÉ S3.01</em> (BUT2 Informatique, IUT2 Grenoble), elle s\'appuie sur une architecture <em>client/serveur MVC</em> : un front-end <em>React</em> (Vite) communiquant via une API avec un back-end <em>PHP</em> (pattern <em>DAO</em>) adossé à une base de données relationnelle.',
      competences: [
        {
          title: 'Réaliser un développement d\'application',
          items: [
            'Concevoir et développer une application communicante (client React / serveur PHP)',
            'Développer des interfaces utilisateurs accessibles',
            'Faire des essais et évaluer leurs résultats (tests d\'ergonomie)',
          ],
        },
        {
          title: 'Gérer des données de l\'information',
          items: [
            'Concevoir une base de données relationnelle à partir d\'un diagramme de classe',
            'Mettre à jour et interroger la base via des requêtes SQL (couche DAO / PDO)',
          ],
        },
        {
          title: 'Conduire un projet',
          items: [
            'Appréhender les besoins du client et des utilisateurs (personas)',
            'Mettre en place les outils de gestion de projet et le suivi des risques',
            'Identifier les acteurs et les différentes phases d\'un cycle de développement',
          ],
        },
        {
          title: 'Collaborer au sein d\'une équipe informatique',
          items: [
            'Coordonner une équipe pluridisciplinaire de six personnes',
            'Acquérir les compétences interpersonnelles pour travailler en équipe',
          ],
        },
      ],
      objectifs: '• Rendre <em>visible</em> le « travail invisible » des aidants et alléger leur <em>charge mentale</em><br>• <em>Centraliser</em> et <em>coordonner</em> le suivi d\'une personne aidée entre proches et intervenants<br>• Garantir l\'<em>accessibilité</em> à un public parfois peu à l\'aise avec le numérique (thème sombre, mode dyslexie, contraste élevé, gros texte)<br>• Respecter le <em>RGPD</em> pour des données de santé sensibles (<em>Article 9</em> : Privacy by Design, contrôle d\'accès par rôles)',
      equipe: 'Équipe projet 8 — « Aimédia » (6 membres) :\n<em>Chef de projet</em> : Paolo Colombat\n<em>Responsable qualité</em> : Jérémie Fauvet-Messat\n<em>Référent technique (back-end)</em> : Simon Krumb\n<em>Responsable IHM & accessibilité</em> : Enzo Morello\n<em>Communication & documentation</em> : Macéo Guicherd-Callin\n<em>Réseau & système</em> : Noam Bruchet-Joannon\nProjet structuré en <em>trois phases</em> (cadrage et besoins, conception et architecture, développement et tests), chacune validée par un dossier et une soutenance devant les enseignants.',
      travailIndividuel: '<em>Chef de projet</em>, je me suis chargé de la <em>coordination</em> de l\'équipe, de l\'<em>organisation</em> du travail et de la <em>rédaction des dossiers</em> rendus aux enseignants à chaque phase. À la suite d\'un premier rendu jugé trop long et peu professionnel, j\'ai <em>piloté la bascule de Google Docs vers LaTeX</em>, ce qui a nettement amélioré la qualité et l\'homogénéité de nos livrables (réponse directe au risque « rendu non professionnel »).<br>Côté conception, j\'ai contribué à la <em>modélisation</em> et à l\'<em>organisation technique</em> du projet. Côté développement, j\'ai réalisé plusieurs <em>requêtes DAO</em> et développé la <em>page Contacts</em> permettant de constituer l\'équipe d\'aidants et d\'intervenants autour d\'une personne aidée.<br>Enfin, j\'ai mené de <em>nombreux tests « Think Aloud »</em> auprès d\'un panel volontairement varié de mon entourage (proches initiés ou non à l\'informatique, parents…), complétés par la méthode <em>SUS</em>, afin de valider l\'ergonomie auprès du plus grand nombre.',
      techDetails: [
        'Architecture client/serveur MVC : React (Vite) + API PHP, pattern DAO via PDO',
        'Conception d\'une base de données relationnelle (diagramme de classe → schéma → SQL)',
        'Développement de requêtes SQL et de la couche DAO (opérations CRUD)',
        'Gestion de projet : jalons, suivi des risques, Trello, versioning Git / GitLab',
        'Rédaction de dossiers professionnels en LaTeX',
        'Tests d\'ergonomie : méthode « Think Aloud » et questionnaire SUS sur profils variés',
        'Conformité RGPD : données sensibles (Art. 9), Privacy by Design, contrôle d\'accès par rôles',
      ],
      challenges: 'Le <em>premier rendu</em>, trop long et peu professionnel, a imposé un changement de méthode : passage à <em>LaTeX</em> et nouvelle organisation de travail. L\'<em>intégration front/back</em> a d\'abord souffert d\'une séparation stricte « Front » / « Back » générant des frictions à l\'assemblage ; l\'équipe a alors <em>pivoté vers un développement par fonctionnalité</em> (feature-based), qui a accéléré la production et renforcé la cohésion. La <em>mise en place du serveur</em> s\'est révélée plus complexe que prévu (risque technique sous-estimé), et l\'<em>hétérogénéité des conventions de nommage</em> a engendré une dette technique que nous aurions évitée en fixant ces règles dès le départ.',
      apercu: {
        image: 'assets/images/aideme-home.png',
        caption: 'Page d\'accueil d\'Aidémé — vue bureau, thème clair',
      },
    },
  },
  {
    title: 'Satablé : Concevoir une application de gestion de banquets',
    description: 'Développer une application JavaFX d\'organisation de banquets — gérer des événements, des invités, des menus et des plans de table.',
    image: 'assets/images/satable.jpg',
    tags: ['JavaFX', 'MVC', 'UML', 'Gestion de projet'],
    en: {
      title: 'Satablé: Design a Banquet Planning Application',
      description: 'Develop a JavaFX desktop application for banquet planning — manage events, guests, menus and seating arrangements.',
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
    title: 'Exploiter une base de données',
    description: 'Exploiter une base de données open data sur les accidents de la route — mener une démarche Data Science.',
    image: 'assets/images/background.jpg',
    cover: 'db-explore',
    tags: ['PostgreSQL', 'SQL', 'Data Science', 'Visualisation'],
    en: {
      title: 'Exploit a Database',
      description: 'Exploit an open data database on road accidents — conduct a Data Science approach.',
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
    title: 'Concevoir une base de données',
    description: 'Concevoir et mettre en place une base de données complète pour le club de bowling SuperBall.',
    image: 'assets/images/background.jpg',
    cover: 'db-design',
    tags: ['PostgreSQL', 'SQL', 'Merise', 'Conception BD'],
    en: {
      title: 'Design a Database',
      description: 'Design and implement a complete database for the SuperBall bowling club.',
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
    title: 'Comparer des approches algorithmiques',
    description: 'Développer des méthodes de classification automatique de dépêches — générer des lexiques par apprentissage et comparer avec K-NN.',
    image: 'assets/images/background.jpg',
    cover: 'algorithms',
    tags: ['Java', 'Algorithmes', 'IA', 'IntelliJ'],
    en: {
      title: 'Compare Algorithmic Approaches',
      description: 'Develop automatic news dispatch classification methods — generate lexicons through machine learning and compare with K-NN.',
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
        { description: 'Standard modeling language for software architecture: class diagrams, sequence diagrams, use case diagrams.' },
        { description: 'Statistical programming language used for data analysis, visualization, and R Studio integration.' },
      ],
    },
    skills: [
      { name: 'C',          icon: 'assets/images/c-icon.png', description: 'Programmation système, pointeurs, gestion mémoire. Utilisé en cours et projets bas niveau.', level: 2 },
      { name: 'C++',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-original.svg', description: 'Programmation orientée objet, STL et gestion de ressources. Utilisé pour des projets algorithmiques.', level: 2 },
      { name: 'Java',       icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg', description: 'Programmation orientée objet, héritage, interfaces, collections, JavaFX.', level: 4 },
      { name: 'Python',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg', description: 'Vu au lycée en spécialité NSI : POO, arbres, récursivité.', level: 2 },
      { name: 'JavaScript', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg', description: 'Développement web front-end, DOM, événements. Ce portfolio est entièrement en vanilla JS.', level: 4 },
      { name: 'PHP',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg', description: 'Développement back-end, formulaires, sessions et intégration avec bases de données.', level: 3 },
      { name: 'SQL',        icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/azuresqldatabase/azuresqldatabase-original.svg', description: 'Requêtes complexes, jointures, sous-requêtes, trigger, forme normale. Utilisé dans plusieurs Projets.', level: 3 },
      { name: 'UML',        icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/UML_logo.svg', description: 'Langage de modélisation standard pour l\'architecture logicielle : diagrammes de classes, de séquences, de cas d\'utilisation.', level: 3 },
      { name: 'R',          icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/r/r-original.svg', description: 'Langage de programmation statistique utilisé pour l\'analyse de données, la visualisation et l\'intégration avec R Studio.', level: 2 },
    ],
  },
    {
    label: 'Outils de dev',
    en: {
      label: 'Dev Tools',
      skills: [
        { description: 'Versioning, branches, merge, rebase. Used on all multi-developer code projects.' },
        { description: 'Repository hosting, issues, CI/CD. Institutional repository hosting platform.' },
        { description: 'Repository hosting, issues, CI/CD. Personal projects and open-source collaboration.' },
        { description: 'Main editor for web development, extensions, integrated debugging.' },
        { description: 'IntelliJ IDEA for Java, PhpStorm for PHP, CLion for C/C++. Full IDEs used in labs/projects.' },
        { description: 'Shell scripts, task automation, Linux system navigation.' },
        { description: 'Document preparation system for professional scoping reports and technical documentation.' },
      ],
    },
    skills: [
      { name: 'Git',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg', description: 'Versionning, branches, merge, rebase. Utilisé sur tous les projets de codes à plusieurs.', level: 3 },
      { name: 'GitLab',   icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/gitlab/gitlab-original.svg', description: 'Hébergement de dépôts, issues, CI/CD. Plateforme de dépôt institutionnelle.', level: 3 },
      { name: 'GitHub',   icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg', description: 'Hébergement de dépôts, issues, CI/CD. Projets personnels et collaboration open-source.', level: 3 },
      { name: 'VS Code',           icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vscode/vscode-original.svg', description: 'Éditeur principal pour le développement web, extensions, debugging intégré.', level: 5 },
      { name: 'JetBrains',         icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/jetbrains/jetbrains-original.svg', description: 'IntelliJ IDEA pour Java, PhpStorm pour PHP, CLion pour C/C++. IDE complets utilisés en TP/Projets.', level: 4 },
      { name: 'Bash',              icon: 'assets/images/bash.webp', description: 'Scripts shell, automatisation de tâches, navigation système Linux.', level: 3 },
      { name: 'LaTeX',             icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/latex/latex-original.svg', description: 'Système de préparation de documents pour les dossiers de cadrage professionnel et la documentation technique.', level: 3 },
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
    label: 'Conception',
    en: {
      label: 'Design & Modeling',
      skills: [
        { description: 'UML CASE tool used for modeling and generating diagrams during projects.' },
        { description: 'Online diagram editor for flowcharts, UML and architecture schemas.' },
        { description: 'UI/UX design tool for prototyping and collaborative interface design.' },
        { description: 'Visual collaboration tool for wireframes, flowcharts and brainstorming.' },
      ],
    },
    skills: [
      { name: 'Visual Paradigm', icon: 'https://www.visual-paradigm.com/favicon.ico',                                                                                         description: 'Outil CASE UML utilisé pour modéliser et générer des diagrammes lors de projets.',                                           level: 3 },
      { name: 'Draw.io',         icon: 'https://www.drawio.com/favicon.ico',                                                                                                   description: 'Éditeur de diagrammes en ligne pour flowcharts, UML et schémas d\'architecture.',                                           level: 4 },
      { name: 'Figma',           icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/figma/figma-original.svg',                                                   description: 'Outil de design UI/UX pour le prototypage et la conception collaborative d\'interfaces.',                                    level: 3 },
      { name: 'Whimsical',       icon: 'https://whimsical.com/favicon.ico',                                                                                                    description: 'Outil de collaboration visuelle pour wireframes, flowcharts et brainstorming.',                                              level: 3 },
    ],
  },
  {
    label: 'Tests',
    en: {
      label: 'Testing',
      skills: [
        { description: 'Testing framework for JavaScript and Node.js, used for unit and integration testing.' },
        { description: 'End-to-end testing framework for web applications: assertions, mocking, CI integration.' },
        { description: 'Unit testing framework for PHP, used to test back-end logic and services.' },
        { description: 'Unit testing framework for Java, used for back-end and business logic validation.' },
      ],
    },
    skills: [
      { name: 'Mocha',   icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mocha/mocha-original.svg',   description: 'Framework de test pour JavaScript et Node.js, utilisé pour les tests unitaires et d\'intégration.', level: 2 },
      { name: 'Cypress', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cypressio/cypressio-original.svg', description: 'Framework de tests end-to-end pour applications web : assertions, mocking, intégration CI.', level: 2 },
      { name: 'PHPUnit', icon: 'https://phpunit.de/img/phpunit.svg',                                                   description: 'Framework de tests unitaires pour PHP, utilisé pour tester la logique back-end et les services.', level: 2 },
      { name: 'JUnit',   icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/junit/junit-original.svg',   description: 'Framework de tests unitaires pour Java, utilisé pour la validation de la logique métier.',        level: 2 },
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
        { description: 'PostgreSQL web administration interface, schema and query management.' },
        { description: 'Data analytics and ETL tool for visual data processing, workflow automation, and data science.' },
        { description: 'Statistical IDE for data analysis, visualization, and statistical modeling.' },
      ],
    },
    skills: [
      { name: 'PostgreSQL', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg', description: 'SGBD principal utilisé en Projet : optimisation des requêtes, contraintes d\'intégrité.', level: 4 },
      { name: 'SQLite',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sqlite/sqlite-original.svg', description: 'Base embarquée pour applications mobiles et projets légers.', level: 2 },
      { name: 'MySQL',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg', description: 'Utilisé pour des projets web avec PHP, administration via phpMyAdmin.', level: 1 },
      { name: 'phpPgAdmin', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg', description: 'Interface web d\'administration PostgreSQL, gestion des schémas et requêtes.', level: 2 },
      { name: 'KNIME',      icon: 'https://www.knime.com/sites/default/files/favicon.ico', description: 'Outil d\'analyse de données et d\'ETL pour le traitement visuel des données, l\'automatisation de workflows et la science des données.', level: 2 },
      { name: 'R Studio',   icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rstudio/rstudio-original.svg', description: 'IDE statistique intégré pour l\'analyse de données, la visualisation et la modélisation statistique.', level: 2 },
    ],
  },
  {
    label: 'Serveur & Réseau',
    en: {
      label: 'Server & Network',
      skills: [
        { description: 'System administration, user and process management, permissions, ext4 filesystem.' },
        { description: 'HTTP server configuration, virtual hosts, modules. PHP site deployment.' },
        { description: 'Network packet analyzer for troubleshooting and security.' },
      ],
    },
    skills: [
      { name: 'Linux',      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg', description: 'Administration système, gestion des utilisateurs et processus, permissions, système de fichiers ext4.', level: 2 },
      { name: 'Apache',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apache/apache-original.svg', description: 'Configuration de serveur HTTP, virtual hosts, modules. Déploiement de sites PHP.', level: 3 },
      { name: 'Wireshark',  icon: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/wireshark.png', description: 'Analyseur de paquets réseau pour le dépannage et la sécurité.', level: 1 },
    ],
  },
  {
    label: 'Virtualisation & Conteneurs',
    en: {
      label: 'Virtualization & Containers',
      skills: [
        { description: 'Lightweight virtualization for testing operating systems and server configurations.' },
        { description: 'Virtualization platform for managing virtual machines and containers at scale.' },
        { description: 'Application containerization, image and volume management, orchestration with Docker Compose.' },
      ],
    },
    skills: [
      { name: 'Qemu',       icon: 'https://gitlab.com/qemu-project/qemu/-/raw/864ab314f1d924129d06ac7b571f105a2b76a4b2/ui/icons/qemu.svg', description: 'Virtualisation légère pour tester des systèmes d\'exploitation et des configurations serveur.', level: 3 },
      { name: 'Proxmox',    icon: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/proxmox-light.svg', description: 'Plateforme de virtualisation pour gérer des machines virtuelles et des conteneurs à grande échelle.', level: 2 },
      { name: 'Docker',     icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg', description: 'Conteneurisation d\'applications, gestion d\'images et de volumes, orchestration avec Docker Compose.', level: 1 },
    ],
  },
  {
    label: 'Jeux vidéo',
    en: {
      label: 'Game Development',
      skills: [
        { description: 'Open-source game engine: 2D/3D development, scripting with GDScript.' },
        { description: 'GameMaker scripting language for 2D game development and game logic.' },
        { description: 'Game development with libraries like Pygame for 2D games and simulations.' },
        { description: 'Visual block-based programming platform for creative learning and game development.' },
      ],
    },
    skills: [
      { name: 'Godot',   icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/godot/godot-original.svg', description: 'Moteur de jeu open-source : développement 2D/3D, scripting avec GDScript.', level: 2 },
      { name: 'GML',     icon: 'https://www.yoyogames.com/favicon.ico', description: 'Langage de script GameMaker pour le développement de jeux 2D et la logique de jeu.', level: 2 },
      { name: 'Pygame',  icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/pygame/pygame-original.svg', description: 'Librairie Python pour le développement de jeux 2D et les simulations interactives.', level: 2 },
      { name: 'Scratch',  icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/scratch/scratch-original.svg', description: 'Plateforme visuelle de programmation par blocs pour l\'apprentissage créatif et le développement de jeux.', level: 3 },
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

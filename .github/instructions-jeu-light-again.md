# Light Again — Instruction & Architecture Reference

> Ce document fournit toutes les informations nécessaires pour comprendre, modifier et déboguer le jeu « Light Again », un mini-jeu d'action Phaser 3 intégré au portfolio.

---

## 1. Vue d'ensemble

**Light Again** est un jeu d'arène top-down où le joueur contrôle une flèche lumineuse dans un espace neon/cyberpunk. Le joueur esquive des ennemis, attaque au corps à corps par mise en rotation, et enchaîne des combos pour grimper dans le leaderboard.

Le jeu tourne entièrement côté client. Le seul appel réseau est vers l'API LootLocker (leaderboard guest sessions). Pas de bundler : chaque fichier JS est chargé via `<script>` dans `index.html`.

---

## 2. Architecture des fichiers

Tous les fichiers sont dans `js/light-again/`. Ordre de chargement (obligatoire) :

| # | Fichier | Rôle |
|---|---------|------|
| 1 | `constants.js` | Namespace `window.LightAgain` (alias `LA`), objet `LA.C` (constantes de jeu), palette dynamique `LA.getColors()`, `LA.resetColorCache()`, `LA.sceneMethods = {}` |
| 2 | `textures.js` | Générateurs canvas : `LA.buildArrowTex`, `LA.buildEnemyTex`, `LA.buildShooterTex`, `LA.buildProjTex`, `LA.buildPCBTex`, `LA.buildBruiserTex`, `LA.buildPixelTex` |
| 3 | `lootlocker.js` | Intégration API LootLocker (guest session), i18n helper `LA.laGoT`, sanitization `LA.escHtml`, restart loader `LA.injectLaRestartLoader` |
| 4 | `game-over-ui.js` | Méthode scène `_showGameOverScreen` : overlay DOM game-over, record local, leaderboard, formulaire de soumission |
| 5 | `spawning.js` | Méthodes scène `_spawnRusher`, `_spawnWave`, `_debugSpawnTestTier`, `_spawnRusherAt`, `_spawnShooterAt`, `_spawnBruiserAt` |
| 6 | `player.js` | Méthodes scène `_inputVec`, `_tryDash`, `_tryAttack`, `_triggerDashAtk`, `_damagePlayer`, `_triggerGameOver` |
| 7 | `combat.js` | Méthodes scène `_triggerHitstop`, `_beginBatch`/`_endBatch`, `_floatLabel`/`_floatScore`/`_floatScoreBig`, `_breakCombo`, `_killEnemy`, `_breakShield`, `_triggerDetonation`, `_triggerLandingBurst` |
| 8 | `enemies.js` | Méthode scène `_updateEnemies` : IA par tier, séparation optimisée O(n·k), rebond bordure |
| 9 | `projectiles.js` | Méthodes scène `_spawnProjectile`, `_destroyProjectile`, `_updateProjectiles` : pool global de trails, déflection dash-attack, smash AoE |
| 10 | `collisions.js` | Méthode scène `_checkCollisions` : marquage dash, attaque normale (détone / bouclier / kill), dash-attaque (brise bouclier / enchaîne), dégâts joueur |
| 11 | `effects.js` | Méthodes scène `_explode`, `_addGhost`, `_decayGhosts`, `_spawnWaveRing`, `_hiveSpawnBeam`, `_updateHiveBeams`, `_updateWaveRings`, `_updateComboFX`, `_renderShieldOrbs` |
| 12 | `rendering.js` | Méthodes scène `_genTextures`, `_checkTheme`, `_pTexKey`, `_renderPlayer`, `_renderEnemies`, `_renderProjectiles`, `_renderHUD` |
| 13 | `scene.js` | Assemblage `GameScene` via `Phaser.Class` + mixins `LA.sceneMethods`, méthodes `create()` et `update()`, factory `window.createLightGame` |
| 14 | `shell.js` | IIFE indépendante : bouton hero, modal fullscreen, kill switch performances, help popup, focus trap |

### Pattern d'architecture

- **Namespace** : `window.LightAgain` (alias `LA`). Pas d'ES modules ni de bundler.
- **Mixins de scène** : chaque fichier 4-12 ajoute des fonctions à `LA.sceneMethods.methodName = function() { ... }`. Le `this` réfère à la scène Phaser. `scene.js` fusionne tous les mixins dans la définition de classe via `Phaser.Class`.
- **Constantes** : accédées via `var C = LA.C;` en début d'IIFE.
- **Palette dynamique** : `LA.getColors()` retourne un objet couleurs dépendant du thème CSS actif (`data-theme`). Mise en cache, invalidée par `LA.resetColorCache()`.

---

## 3. Gameplay détaillé

### 3.1 Joueur

- **Déplacement** : WASD / ZQSD / flèches. Accélération `ACCEL` + friction exponentielle `FRICTION`.
- **Dash** : clic droit / Espace / Shift. Se déplace rapidement dans la direction du mouvement (pas du curseur). Invincibilité pendant le dash + 220 ms après. Cooldown `DASH_CD` (800 ms).
- **Attaque (torpille)** : clic gauche en état MOVING. Le joueur fonce vers le curseur en rotation. Touche un seul ennemi, puis retourne à MOVING. Si aucun ennemi touché → whiff recovery (`ATK_WHIFF_DUR`).
- **Dash-attaque** : clic gauche pendant un DASH. Plus rapide, zone plus large, traverse les ennemis. Peut enchaîner (chain extension `DASHATK_EXTEND`).
- **Parade** : une dash-attaque sur un projectile le renvoie au tireur (`isReflected = true`). L'attaque torpille simple ne renvoie pas.
- **Marquage + Détonation** : toucher un ennemi en dash le marque (sparkle). Ensuite une attaque torpille sur cet ennemi déclenche la nuke (dégâts AoE + shockwave). La dash-attaque ne déclenche PAS la nuke.

### 3.2 Boucliers

- Le joueur commence avec 1 bouclier orbitant.
- Gagner des combos à 10× et 50× octroie un bouclier supplémentaire (max 3).
- Un bouclier absorbe un hit et offre 300 ms d'invincibilité.
- Perdre le dernier bouclier → game over.

### 3.3 Ennemis (Tiers)

| Tier | Nom interne | Taille | Comportement |
|------|-------------|--------|--------------|
| T1 | Rusher | `RUSHER_SIZE` (14) | Fonce vers le joueur. Accélère avec le temps de jeu. |
| T2 | Shooter | `T2_SIZE` (16) | Garde ses distances, tire des projectiles. Phase de charge (gradient) puis recul. |
| T3 | Bruiser / Hive | `T3_SIZE` (22) | Dérive sur waypoints, invoque des T1 en rafale (6-9 par spawn), bouclier circulaire qu'il faut briser par dash-attaque. |

### 3.4 Projectiles

- Tirés par les T2 (shooters).
- Pool global de trail sprites (`_projTrailPool`) : chaque projectile réserve `_PROJ_TRAIL_PER` (12) slots via `trailSlots`.
- Un projectile reflété par parade home vers son tireur (`shooterRef`).
- Un projectile smashé (détruit par attaque) fait des dégâts AoE autour de lui + batch PARADE.

### 3.5 Scoring & Combos

- Chaque kill rapporte `score + (10 * combo)`.
- Le combo timer (`COMBO_DUR` = 3000 ms) se remet à zéro à chaque kill.
- Le combo se casse si le timer expire → `_breakCombo()`.
- Le `bestCombo` est tracké pour le leaderboard.
- Système de batch : `_beginBatch` / `_endBatch` agrège les labels et scores d'un groupe de kills simultanés.

### 3.6 Effets visuels par palier de combo

| Palier | Effet |
|--------|-------|
| x10+ | Trail de particules derrière le joueur |
| x25+ | Barrel distortion (ChromaticAberration PostFX) |
| x50+ | Aura géométrique rotative + sparks explosifs |

---

## 4. Systèmes techniques importants

### 4.1 Hitstop

`_triggerHitstop(ms)` : gèle le `timeScale` à 0 pendant `ms` millisecondes. Tous les mouvements sont multipliés par `timeScale`. Crée un impact de type fighting-game.

### 4.2 Trail pool global

Les trails de projectiles ne sont PAS des sprites par projectile. Un pool global `_projTrailPool` de `MAX_PROJECTILES × 12` slots est partagé. Chaque projectile stocke les indices de ses slots dans `trailSlots`. À la destruction, les slots sont libérés (alpha décroît naturellement).

### 4.3 Séparation ennemis

Optimisé en O(n·k) via tri sur l'axe X + fenêtre glissante (au lieu de O(n²) brut). Les ennemis proches se repoussent pour éviter les empilements.

### 4.4 Thèmes

Le jeu détecte le thème CSS (`data-theme` sur `<html>`) toutes les frames via `_checkTheme`. Si le thème change, `LA.resetColorCache()` force la régénération de la palette + retexture via `_genTextures`.

### 4.5 Kill switch performances

Quand le jeu s'ouvre, `shell.js` désactive : pluie (rain), visualizer, particules de hover, musique, vidéos de fond. À la fermeture, tout est restauré à l'état précédent.

### 4.6 LootLocker

- API REST via `fetch`. Guest session (pas de login).
- Le token est persisté dans `_llToken` (closure).
- Leaderboard key configurable via `LL_LB_KEY`.
- Score soumis : `score` principal. Le `bestCombo` est affiché mais non envoyé au serveur.

---

## 5. États du joueur (machine à états)

```
MOVING ──── tryDash() ───► DASHING ──── timer ───► MOVING
  │                           │
  │ tryAttack()               │ tryAttack() (pendant dash)
  ▼                           ▼
ATTACKING                 DASH_ATTACKING
  │                           │
  │ hit enemy → MOVING        │ timer expire
  │ whiff → RECOVERY          │   hit? → landingBurst → MOVING
  │                           │   miss? → RECOVERY (whiff)
  ▼                           ▼
RECOVERY ──── timer ──► MOVING

DEAD ──── (fin de partie, overlay game-over)
```

---

## 6. Constantes clés

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `WORLD_HALF` | 1400 | Demi-taille du monde (zone de jeu ±1400) |
| `SIZE` | 18 | Taille du joueur (flèche) |
| `ACCEL` | 1.3 | Accélération du mouvement |
| `FRICTION` | 0.88 | Friction exponentielle (par frame à 60fps) |
| `DASH_SPEED` | 19 | Vitesse du dash |
| `DASH_DUR` | 160 | Durée du dash (ms) |
| `DASH_CD` | 800 | Cooldown du dash (ms) |
| `ATK_SPEED` | 16 | Vitesse de l'attaque torpille |
| `ATK_DUR` | 250 | Durée de l'attaque (ms) |
| `ATK_REACH` | 28 | Portée de l'attaque |
| `DASHATK_SPEED` | 22 | Vitesse de la dash-attaque |
| `DASHATK_DUR` | 400 | Durée de la dash-attaque (ms) |
| `DASHATK_REACH` | 36 | Portée de la dash-attaque |
| `COMBO_DUR` | 3000 | Durée du timer combo (ms) |
| `MAX_PROJECTILES` | 64 | Nombre max de projectiles simultanés |
| `SEPARATION_RADIUS` | 32 | Rayon de séparation entre ennemis |

---

## 7. Dépendances

- **Phaser 3.80.1** (CDN) : moteur de jeu WebGL.
- **LootLocker API** : leaderboard guest sessions (optionnel — le jeu fonctionne sans).
- **CSS** : `css/light-again.css` pour le bouton hero, la modal, le help popup, le game-over overlay.
- **i18n** : utilise `LA.laGoT(key)` avec fallback `FB_FR` / `FB_EN` hardcodés, et `window.__siteT()` du site.
- **Portfolio globals** : `window.__trapFocus`, `window.__rainSetEnabled`, `window.__setVisualizerFrozen`, `window.__setParticlesSpeed`, `window.__musicPlayerSetFrozen`, etc.

---

## 8. Debug / Test

- **Touches de debug** (dans `scene.js` create) :
  - `I` : spawn 20 T1 (rushers)
  - `O` : spawn 10 T2 (shooters)
  - `P` : spawn 5 T3 (bruisers/hive)
- **`window.__lightGameAtkReady()`** : retourne `true` si le joueur peut attaquer (exposé pour tests externes).
- **FPS** : affiché en haut à gauche, throttled toutes les 15 frames (vert ≥55, jaune ≥30, rouge <30).

---

## 9. Notes pour modification future

- Pour ajouter un nouveau type d'ennemi : créer les fonctions de spawn dans `spawning.js`, ajouter l'IA dans `enemies.js` (`_updateEnemies`), la texture dans `textures.js`, le rendu dans `rendering.js` (`_renderEnemies`), et la collision dans `collisions.js`.
- Pour ajouter un power-up : logique dans `combat.js` ou un nouveau fichier, rendu dans `rendering.js`.
- Pour changer l'équilibrage : modifier les constantes dans `constants.js` (`LA.C`).
- Le jeu n'a pas de niveaux — la difficulté monte naturellement via `_spawnWave` qui utilise `gameTime` pour augmenter les quotas et rangs des ennemis.

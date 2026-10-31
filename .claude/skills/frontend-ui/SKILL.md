---
name: frontend-ui
description: À suivre avant toute intervention front-end dans une application (apps/**) — créer ou modifier un écran, un composant Angular, un gabarit HTML, une mise en page, une feuille de style, une feuille (dialogue), un formulaire, un affichage responsive, le thème Jour ou Nuit, un texte d'interface, ou corriger un bug visuel. Explique le système visuel d'Apex (Geist et Instrument Serif, cartes arrondies, panneaux d'encre, boutons en pilule), son kit de composants (apps/apex-client/src/ui : ax-field, ax-select, ax-sheet, ax-menu, ax-path, ax-matrix, ax-conversation, ax-rings…), ses classes globales (styles.css), où écrire le style d'un écran et comment écrire dans la voix d'Apex. Use for any UI, frontend, styling, CSS, layout, component, template, theme, accessibility or UI copy work.
---

# Construire une interface Apex

Apex a son propre système visuel (refonte du 31 octobre 2026). Des anciennes couleurs d'Empreinte, il garde les tokens Jour et Nuit et les quatre lumières ; tout le reste lui appartient. Empreinte (`@empreinte-studio/*`) et PrimeNG sont retirés : ne les réintroduis jamais.

## 1. Lire avant de coder

1. **La maquette** : canvas « Apex · refonte des écrans », https://claude.ai/artifact/MPiN1pv2uhvjiRtmifTBfV (outil Artifact, `read`). Artboards : `Main` (Objectifs), `Arete` (un objectif), `Akari`, `Matrice`, `Connexion`, `Bienvenue` (premier lancement), `Mobile` (Nuit, 390px). Elles donnent l'intention, pas le code.
2. **Le kit** : `apps/apex-client/src/ui/` (barrel `index.ts`). Lis le composant que tu poses : ses entrées et sorties sont documentées en tête de fichier.
3. **Les classes globales** : `apps/apex-client/src/styles.css` (tokens, typographie, surfaces, boutons, puces, case, champ, mouvement).
4. **L'écran le plus proche** (§ 4), pour reprendre sa structure.
5. **Le périmètre et le vocabulaire** : `docs/features/migration-empreinte.md` (§ 3 à 7 : routes, objectif / étape / pas / laisser filer, règles de données, Akari comme geste, `AnnoncesStore`). Ses règles visuelles propres à Empreinte (sceau, corne, `e-*`) ne valent plus.

## 2. L'échelle de décision

| # | Question | Réponse |
| --- | --- | --- |
| 1 | Un composant du kit fait-il ça ? | Le poser et le régler par ses entrées : `ax-field` + `input[axControl]`, `ax-select`, `ax-sheet` (ouvert par `Feuilles.ouvrir`), `ax-menu`, `ax-filters`, `ax-steps`, `ax-rings`, `ax-path`, `ax-matrix`, `ax-conversation`, `ax-icon`. |
| 2 | Une classe globale le fait-elle ? | `.card` / `.card--nuit` (+ `.stage .glow .grain .glass` pour un panneau d'encre), `.btn` + variante, `.chip`, `.dot`, `.tile.l-*`, `.check`, `.input`, `.steps`, `.sr-only`, `.rise`. |
| 3 | C'est du texte ? | La typographie : `.display` (titre d'écran), `.t1 .t2 .t3`, `.body`, `.small`, `.label` (mono, capitales), `.serif` (une phrase sensible par écran), `.soft` (encre douce), `.accent` (vermillon). |
| 4 | C'est la mise en page d'un écran ? | Dans la feuille du composant (`<nom>.css`, `styleUrl`), avec les tokens. Les utilitaires `.ds-*` de `styles/layout.css` restent disponibles. |
| 5 | Le besoin servirait à plusieurs écrans ? | L'ajouter au kit (`src/ui/`) ou à `styles.css`, avec un test si le comportement le demande. |

## 3. Les règles

- **Couleurs** : toujours en tokens (`--fond`, `--panneau`, `--creux`, `--trame`, `--encre`, `--encre-douce`, `--sceau`, `--nocturne`, `--sur-nocturne`, `--nocturne-douce`, `--*-voile` / `--*-vif` des lumières) : la Nuit suit seule. Une lumière dit l'objectif (`lumiereDe(id)`), jamais un état.
- **Le vermillon** (`.btn--accent`, `--sceau`) marque l'action principale de l'écran et ce qui est en cours ; on ne le multiplie pas.
- **Thème** : `Theme` (`ui/theme.ts`) pose `data-theme` sur `<html>` ; aucune règle `prefers-color-scheme` dans les feuilles.
- **Accessibilité** : tout cliquable est un `button`, un `a` ou un contrôle natif ; une icône seule a un nom (`aria-label`, ou `label` sur `ax-icon`) ; un statut qui change est dans un `role="status"` ; focus visible partout (anneau vermillon global) ; cibles de 44px (36px en `--sm`) ; la matrice offre « Déplacer vers… » au clavier ; `prefers-reduced-motion` coupe les animations.
- **Responsive** : 760px, 900px, 1100px ; tout écran se lit à 375px sans défilement horizontal de la page.
- **Rien ne surgit** : pas de toast. `AnnoncesStore.annoncer(texte)` pour une réussite (lecteurs d'écran), `signaler(texte)` pour un souci (la coque affiche la note d'Akari). Les phrases sont dans `chore/constants/messages.constante.ts`.
- **Formulaires** : Signal Forms + `[formField]` ; l'erreur s'écrit seule dans `ax-field` une fois le champ touché, en encre avec un losange, jamais en rouge ; `facultatif` plutôt qu'un astérisque.
- **Feuilles** : `Feuilles.ouvrir(Composant, { donnees, cdk: { injector: inject(Injector) } })` ; dans le composant, `ax-sheet[title]` > `form` + `div[axSheetActions]` (action en `btn--accent`, sortie en `btn--ghost`).
- **Budget** : 4 Ko conseillés, 8 Ko au plus par feuille de composant.

## 4. Où sont les modèles

| Besoin | Écran | Fichiers |
| --- | --- | --- |
| Coque, navigation, note d'Akari | `app/shell/` | rail d'encre, liste « En marche », réglages en `ax-menu`, `fits-window` pour Akari |
| Panneau d'encre, anneaux, cartes | `app/objectives/` | accueil, premier lancement (composer + idées) |
| Chemin, étape, liste de pas, feuilles | `app/objective/` | `ax-path`, `ax-rings`, `.check`, `sheets/*` |
| Conversation | `app/objective/akari/` | `ax-conversation`, `ax-path vertical` |
| Matrice | `app/matrix/` | `ax-matrix` + `ax-menu` « Déplacer vers… », `ax-filters` |
| Formulaire plein écran | `app/auth/`, `app/objectives/new-objective/` | panneau d'encre + `ax-field` |

## 5. La voix

- **Tutoiement, phrases courtes**, nombres en chiffres, casse de phrase (seul `.label` est en capitales). Pas de point d'exclamation, pas d'emoji.
- **Jamais** : « échec », « erreur », « raté », « manqué », « en retard », « perdu », « supprimer », « il te reste », de pourcentage. On « laisse filer », on ne supprime pas. La progression se dit par ce qui est fait (`legendeProgression`, `compter`).
- **Akari** constate et propose, il ne pousse pas ; il signe « AKARI ».
- **Les erreurs du domaine** : jamais `error.message` ; une phrase par code d'erreur, avec la solution.
- `app/voice.spec.ts` passe tous les textes de `src/app` et `src/ui` (gabarits, attributs lisibles, chaînes, gabarits en ligne du kit, titres des routes) dans `motsAEviter()` et `voiceIssues()`.

## 6. Vérifier avant de rendre la main

1. `npx nx typecheck apex-client`, `npx nx lint apex-client` (les erreurs `enforce-module-boundaries` sur `@org/*` existaient avant la refonte), `npx nx vite:test apex-client`, `npx nx build apex-client`.
2. Contrôle visuel de chaque écran touché (`npx nx run apex-client:serve --excludeTaskDependencies`) : en Jour et en Nuit (réglages de la coque), à 375px, au clavier.
3. Dans le compte rendu : les composants du kit utilisés, les classes ajoutées, et ce qui mériterait d'entrer dans le kit.

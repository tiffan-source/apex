# Migration d'Apex vers Empreinte

Ce document est le cahier de la migration du client Apex de PrimeNG vers le design system **Empreinte** (`@empreinte-studio/angular` et `@empreinte-studio/tokens`), en suivant les maquettes « Apex » et le périmètre V1 décidé le 19 octobre 2026. Il fait autorité pour tous ceux qui travaillent sur la branche `feat/rebrand-empreinte`.

## 1. Le contrat

- **Seul le client change.** On ne touche ni au domaine ni à l'infrastructure : `libs/objective`, `libs/chat`, `libs/ai`, `libs/gemini`, `libs/supabase`, `libs/firebase`, `libs/chore`, `libs/auth`, `worklfows/`, `apex-library/`, `supabase/` restent intacts. On peut modifier : `apps/apex-client/**`, `libs/design-tokens/**`, `tools/design-system/**`, `.claude/**`, `CLAUDE.md`, `docs/**`, `package.json` et `package-lock.json` (dépendances front uniquement).
- **PrimeNG part entièrement** : `primeng`, `@primeuix/themes`, `primeicons`, le preset, les toasts, les `pi pi-*`.
- **Aucun CSS dans l'application**, comme avant : l'apparence vient des composants Empreinte, la mise en page des classes `.ds-*` de `libs/design-tokens/src/layout.css`, désormais construites sur les tokens d'Empreinte.
- Si une fonctionnalité des maquettes exige le back-end, elle attend : on ne la simule pas avec des données inventées.

## 2. Les sources

| Source | Où |
| --- | --- |
| Maquettes (canvas « Apex ») | `project/*.dc.html` du canvas https://claude.ai/artifact/E59CU8bjiq7EhNft2hZHCy. Page V1 : `Objectifs`, `Arete`, `Matrice`, `Akari`. Page « Hors V1 » : `Main` (Aujourd'hui), `Carnet`, `Palier`. |
| Brand book Empreinte | design system « Empreinte » https://claude.ai/artifact/QBkmtgtj9oKk8xdJPb2QNe (`project/README.md`, `project/components/*/README.md`) |
| Périmètre V1 | doc « Apex — périmètre V1 » https://claude.ai/artifact/3mEAfVqPMbkSquRS6Ge3tg |
| Librairie | `node_modules/@empreinte-studio/angular` (types dans `types/`), `node_modules/@empreinte-studio/tokens/dist` ; dépôt https://github.com/empreinte-studio/empreinte (sources, `docs/MIGRATION-APEX.md`, vitrine `apps/vitrine`) |
| Catalogue des composants | `.claude/skills/frontend-ui/references/catalogue-empreinte.md` |

## 3. Le périmètre V1

Apex V1 fait une seule chose : mener un objectif jusqu'au sommet, pas après pas. Quatre écrans, deux entrées de menu. Akari n'est plus un lieu mais un geste.

| Écran | Route | Remplace | Maquette |
| --- | --- | --- | --- |
| Objectifs (accueil) | `/` | Tableau de bord (`board`) | `Objectifs` |
| Nouvel objectif | `/objectifs/nouveau` | modale `create-objective` | `Akari` (phase brouillon) |
| Objectif · l'arête | `/objectifs/:id` | `objective-overview` | `Arete` |
| Akari pour un objectif | `/objectifs/:id/akari` | tiroir `chat` | `Akari` (conversation) |
| La matrice | `/matrice` | `matrix` | `Matrice` |
| Connexion | `/auth` | page d'authentification | aucune : même langue que les autres écrans |

Redirections : `/objective/:id` → `/objectifs/:id`, `/matrix` → `/matrice`, `/focus` → `/matrice`.

**Ce qui sort de l'interface**, par décision du périmètre V1 : l'écran Focus du jour (le quadrant « Maintenant » joue ce rôle), les cartes de statistiques du tableau de bord, les toasts.

**Ce qui attend le back-end** (aucun cas d'usage n'existe) : laisser filer ou supprimer un objectif, une étape ou un pas ; la pause et la reprise ; la déconnexion ; les domaines de vie ; les échéances des pas ; les empreintes et les paliers. Les maquettes qui les montrent sont suivies sans ces éléments.

## 4. Le vocabulaire et les données

Cinq mots : **objectif, étape, pas, arête, laisser filer**. L'interface s'arrête à trois niveaux ; le modèle, lui, ne change pas.

| Interface | Modèle | Règle |
| --- | --- | --- |
| Objectif | objectif racine (`parentId === null`) | |
| Étape | sous-objectif **direct** d'un objectif | Dans l'ordre de chargement. Les sous-objectifs plus profonds ne sont pas montrés : leurs pas comptent dans leur étape de premier niveau. |
| Pas | tâche | Un pas posé directement sur l'objectif (sans étape) apparaît dans un groupe « Pas sans étape », avec l'invitation à le ranger dans une étape. Tout nouveau pas appartient à une étape. |
| Horizon | `dueDate` | « Jusqu'en mai », ou « Jusqu'en mai 2027 » si l'année n'est pas l'année en cours. |
| Pourquoi | `why` | Écrit en `voix`, entre « ». |

**État d'une étape** : *faite* si elle a au moins un pas et que tous ses pas sont faits ; *en cours* pour la première étape non faite (une seule par objectif) ; *à venir* pour les suivantes.

**Prochain pas d'un objectif** : le premier pas non fait de l'étape en cours, sinon le premier pas non fait de l'objectif.

**Objectif accompli** : au moins un pas, et tous faits. Les objectifs accomplis passent dans une liste repliée « Accomplis ».

**Quadrants** (la règle `ApexLibsMetier.getEisenhowerCategory` reste la source) :

| `EisenhowerCategory` | Quadrant Empreinte | Titre |
| --- | --- | --- |
| `DO` | `maintenant` | Maintenant |
| `SCHEDULE` | `planifier` | À planifier |
| `DELEGATE` | `confier` | À confier |
| `DELETE` | `laisser-filer` | À laisser filer |

Déplacer un pas vers un quadrant ne change que ce qui doit changer : côté « important » ou « urgent », une valeur sous 3 passe à 3 ; côté « secondaire » ou « pas urgent », une valeur de 3 ou plus passe à 2. La persistance passe par le cas d'usage d'édition de tâche existant, avec mise à jour optimiste et retour en arrière.

## 5. Akari, un geste

- **Nouvel objectif** (`/objectifs/nouveau`) : la mise en page de la maquette `Akari`. À gauche, Akari pose ses questions en `voix` (« Qu'est-ce que tu veux construire ? », « Pourquoi est-ce que ça compte pour toi ? », « Pour quand ? ») et la personne répond dans des champs. À droite, le **brouillon** se met à jour en direct : « Brouillon · pas encore enregistré ». **Rien n'est enregistré** avant « Je m'y engage » (le bouton sceau de l'écran), qui crée l'objectif puis ouvre Akari sur cet objectif.
- **Akari pour un objectif** (`/objectifs/:id/akari`) : la vraie conversation (le workflow existant, inchangé). À gauche, les répliques : Akari en `voix` signé `AKARI`, la personne en `corps` ; la saisie `textarea[eSaisie]` et un bouton d'envoi. Quand Akari veut créer une étape ou un pas, il le demande dans la conversation (« Akari propose d'ajouter l'étape « Portfolio ». On l'ajoute ? » : « Ajouter » / « Pas maintenant »). À droite, l'arête de l'objectif se remplit au fil des ajouts. On y arrive depuis le nouvel objectif et depuis « Proposer des pas avec Akari » sur une étape (la requête `?etape=<id>` prépare la demande).
- Le rendu Markdown assaini, le chargement de l'historique, la reprise du workflow et l'interrogation toutes les secondes restent tels quels.

## 6. La voix

Empreinte tutoie, en phrases courtes. Jamais : « échec », « erreur », « raté », « en retard », « supprimer », de pourcentage, de point d'exclamation, d'emoji. Les erreurs s'écrivent en `encre`, avec la solution : « Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie. » La progression se lit par ce qui est fait : `legendeProgression`, `formaterAttente`, `formaterSerie` de `@empreinte-studio/angular`. Un test passe tous les textes de l'application dans `motsAEviter()`.

## 7. Ce qui remplace les toasts

`AnnoncesStore` (`apps/apex-client/src/chore/stores/annonces.store.ts`, fourni à la racine) :

- `annoncer(texte)` : une réussite, dite aux lecteurs d'écran par le `LiveAnnouncer` du CDK, sans rien afficher. Rien ne surgit.
- `signaler(texte)` : quelque chose n'a pas marché ; la coque l'affiche dans la page, dans un `aside[eNote]` signé Akari, avec un bouton « Compris », et l'annonce aussi.

## 8. Le thème

`provideEmpreinte({ theme: 'jour' })` dans `app.config.ts` ; le script d'`index.html` applique le thème retenu avant le démarrage, comme la vitrine. Les réglages de la coque proposent Jour, Nuit et « Comme l'appareil ».

## 9. L'ordre du travail

1. **Fondations** : le catalogue des composants, la couche de mise en page (`libs/design-tokens`), le contrôle `tools/design-system/check.mjs` réécrit pour Empreinte, la plomberie (`provideEmpreinte`, thème, `AnnoncesStore`, modèles de vue), les skills et `CLAUDE.md`.
2. **Écrans**, en parallèle : coque et routes, Objectifs, Nouvel objectif, Arête et ses feuilles, Akari, Matrice, Connexion.
3. **Intégration** : départ de PrimeNG, lint, typecheck, tests, build, revue contradictoire écran par écran, vérification dans le navigateur.

## 10. La liste de vérification d'un écran

- [ ] Un seul sceau (bouton `sceau`, grand sceau ou tête d'arête).
- [ ] Une corne par groupe, toujours avec `aria-current`, jamais en décoration.
- [ ] Les lumières en petites touches, jamais pour un état.
- [ ] Aucune erreur en rouge, aucun pourcentage, aucun point d'exclamation, aucun « en retard ».
- [ ] Cibles de 44px (36px en petit) ; focus visible ; Jour et Nuit vérifiés ; lisible à 375px.
- [ ] Plus de `p-*`, `pButton`, `pi pi-*`, `::ng-deep`, `[dt]`.
- [ ] `npx nx lint design-tokens`, `npx nx typecheck apex-client`, `npx nx vite:test apex-client` et `npx nx build apex-client` passent.

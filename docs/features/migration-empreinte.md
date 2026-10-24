# Migration d'Apex vers Empreinte

Ce document est le cahier de la migration du client Apex de PrimeNG vers le design system **Empreinte** (`@empreinte-studio/angular` et `@empreinte-studio/tokens`), en suivant les maquettes « Apex » et le périmètre V1 décidé le 19 octobre 2026. Il fait autorité pour tous ceux qui travaillent sur la branche `feat/rebrand-empreinte`.

## 1. Le contrat

- **Seul le client change.** On ne touche ni au domaine ni à l'infrastructure : `libs/objective`, `libs/chat`, `libs/ai`, `libs/gemini`, `libs/supabase`, `libs/firebase`, `libs/chore`, `libs/auth`, `worklfows/`, `apex-library/`, `supabase/` restent intacts. On peut modifier : `apps/apex-client/**`, `.claude/**`, `CLAUDE.md`, `docs/**`, `package.json` et `package-lock.json` (dépendances front uniquement).
- **PrimeNG part entièrement** : `primeng`, `@primeuix/themes`, `primeicons`, le preset, les toasts, les `pi pi-*`.
- **L'identité vient d'Empreinte, la mise en page est celle d'Apex.** Les composants Empreinte et ses 8 styles typographiques donnent l'apparence ; la mise en page d'Apex vit dans Apex, dans la feuille de chaque composant (`styleUrl`) et dans les utilitaires partagés `.ds-*` (`apps/apex-client/src/styles/layout.css`). Pendant la migration, Apex n'avait aucun CSS propre et tout passait par la couche `libs/design-tokens` ; elle a été répartie dans les composants le 25 octobre 2026.
- Si une fonctionnalité des maquettes exige le back-end, elle attend : on ne la simule pas avec des données inventées.

## 2. Les sources

| Source | Où |
| --- | --- |
| Maquettes (canvas « Apex ») | `project/*.dc.html` du canvas https://claude.ai/artifact/E59CU8bjiq7EhNft2hZHCy. Page V1 : `Objectifs`, `Arete`, `Matrice`, `Akari`. Page « Hors V1 » : `Main` (Aujourd'hui), `Carnet`, `Palier`. |
| Brand book Empreinte | design system « Empreinte » https://claude.ai/artifact/QBkmtgtj9oKk8xdJPb2QNe (`project/README.md`, `project/components/*/README.md`) |
| Périmètre V1 | doc « Apex — périmètre V1 » https://claude.ai/artifact/3mEAfVqPMbkSquRS6Ge3tg |
| Librairie | `node_modules/@empreinte-studio/angular` (types dans `types/`), `node_modules/@empreinte-studio/tokens/dist` ; dépôt https://github.com/empreinte-studio/empreinte (sources, vitrine `apps/vitrine`) |
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
| Étape | sous-objectif **direct** d'un objectif | Dans l'ordre de chargement, qui n'est stable qu'une fois le chargement trié (§ 11, Back-end). Les sous-objectifs plus profonds ne sont pas montrés : leurs pas comptent dans leur étape de premier niveau. |
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

**Un nouveau pas naît « À planifier »** : importance 3, urgence 2 (`NEW_TASK_LEVELS`, `apps/apex-client/src/chore/constants/task.constante.ts`), les valeurs par défaut de la feuille « Ajouter un pas ». Le brand book d'Empreinte fait de ce quadrant « le cœur de la progression : on y place les pas des objectifs ». Avant, un nouveau pas valait 1 / 1 et tombait sous « À laisser filer » tant qu'on ne changeait pas ses niveaux. La personne les règle dans la feuille, ou plus tard en déplaçant le pas dans la matrice.

## 5. Akari, un geste

- **Nouvel objectif** (`/objectifs/nouveau`) : la mise en page de la maquette `Akari`. À gauche, Akari pose ses questions en `voix` (« Qu'est-ce que tu veux construire ? », « Pourquoi est-ce que ça compte pour toi ? », « Pour quand ? ») et la personne répond dans des champs. À droite, le **brouillon** se met à jour en direct : « Brouillon · pas encore enregistré ». **Rien n'est enregistré** avant « Je m'y engage » (le bouton sceau de l'écran), qui crée l'objectif puis ouvre Akari sur cet objectif.
- **Akari pour un objectif** (`/objectifs/:id/akari`) : la vraie conversation (le workflow existant, inchangé). À gauche, les répliques : Akari en `voix` signé `AKARI`, la personne en `corps` ; la saisie `textarea[eSaisie]` et un bouton d'envoi. Quand Akari veut créer une étape ou un pas, il le demande dans la conversation (« Akari propose d'ajouter l'étape « Portfolio ». On l'ajoute ? » : « Ajouter » / « Pas maintenant »). À droite, l'arête de l'objectif se remplit au fil des ajouts. On y arrive depuis le nouvel objectif et depuis « Proposer des pas avec Akari » sur une étape (la requête `?etape=<id>` prépare la demande).
- Le rendu Markdown assaini, le chargement de l'historique, la reprise du workflow et l'interrogation toutes les secondes restent tels quels.

## 6. La voix

Empreinte tutoie, en phrases courtes. Jamais : « échec », « erreur », « raté », « en retard », « supprimer », de pourcentage, de point d'exclamation, d'emoji. Les erreurs s'écrivent en `encre`, avec la solution : « Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie. » La progression se lit par ce qui est fait : `legendeProgression`, `formaterAttente`, `formaterSerie` de `@empreinte-studio/angular`. Le test de voix transverse (`apps/apex-client/src/app/voice.spec.ts`) passe tous les textes de `src/app` (gabarits, attributs lisibles, chaînes des composants, titres des routes) dans `motsAEviter()` d'Empreinte et dans `voiceIssues()` d'Apex, qui voit aussi les mots accentués, « erreur » et les emoji.

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
- [ ] `npx nx lint apex-client`, `npx nx typecheck apex-client`, `npx nx vite:test apex-client` et `npx nx build apex-client` passent.

## 11. Suivi

Ce que la migration laisse ouvert. Rien de ceci n'est compensé ni simulé côté client : chaque point attend une décision, un cas d'usage ou une version d'Empreinte. La même liste, en bref, est dans `TODO.md`.

### Back-end, à décider plus tard

- **`findObjectiveWithASpecificTaskId`** (dépôt Supabase) relit l'objectif qui porte un pas sans `setDone`, `setDescription` ni `setDueDate` sur ses pas : modifier ou déplacer un pas (feuille « Modifier le pas », glisser-déposer et « Déplacer vers… » de la matrice, rangement d'un pas sans étape) remet en base le pas modifié et ses pas voisins à « non faits », et perd leur description et leur échéance. C'est vrai aussi pour un pas fait déplacé ou renommé, par exemple dans la matrice (qui montre les pas faits, avec « Déplacer vers… ») : l'écran le montre fait, la base non. Décision de l'utilisateur : le défaut reste tel quel, sans compensation côté client ; il se voit au rechargement.
- **Le chargement n'a pas d'`ORDER BY`** : `SupabaseGetAllObjectiveAndTaskQuery` lit `objectives` et `tasks` sans tri (et la fonction `get_objective_subtree` non plus), et PostgREST n'en ajoute pas. Or chaque `upsert` d'une étape (ajouter, modifier ou déplacer un pas, modifier l'étape : `save()` réécrit la ligne de l'étape) et chaque pas coché (`UPDATE`) écrivent une nouvelle version de la ligne, que PostgreSQL relit ensuite en fin de table. Au rechargement suivant (ouverture de l'application, ajout accepté par Akari), l'ordre des étapes et des pas change, et avec lui « Étape N », l'étape en cours, le prochain pas, la carte et l'ordre des pas d'une étape. Le client ne peut pas compenser : les ids sont aléatoires et `created_at` n'est pas dans `ObjectiveOutput` ni `TaskOutput`. À décider : `.order('created_at')` suivi d'un départage stable (deux lignes écrites dans la même transaction peuvent avoir le même `created_at`), sur les deux requêtes, ou un champ d'ordre exposé dans `ObjectiveOutput` et `TaskOutput`.
- **Cas d'usage manquants** : laisser filer ou supprimer un objectif, une étape ou un pas ; la déconnexion ; retirer une échéance (`EditObjectiveInput` : une date absente veut dire « inchangée », l'écran refuse donc de retirer un horizon au lieu de le simuler) ; la pause et la reprise, les domaines de vie, les échéances des pas, les empreintes et les paliers (§ 3).
- **`SessionStore` ne garde pas le code d'erreur**, seulement `error.message` ; l'adaptateur Supabase lève des `Error` préfixées (« Erreur lors de la connexion: … ») qui deviennent `UNKNOWN_ERROR`. `translateAuthError` (`app/auth/auth.form.ts`) reconnaît donc les cas par des morceaux des messages anglais de Supabase : fragile si Supabase change ses textes. À corriger en gardant le code dans le store et en typant les erreurs de l'adaptateur (`libs/supabase`). Le cas « compte créé, adresse à confirmer » n'est pas vérifiable en local (`enable_confirmations = false`).
- **`worklfows/ai-assistant`** : `SendMessageToAIWorkflow.startWorkFlow` appelle `createBrowserInspector()` de `@statelyai/inspect` pour chaque nouveau workflow (peut ouvrir l'inspecteur Stately à chaque conversation, en développement) ; si une étape invoquée de la machine échoue sans `onError` (par exemple l'envoi à l'IA), le tour reste bloqué : « Akari réfléchit… » sans fin, zone de réponse désactivée (comme l'ancien tiroir).

### Empreinte, en amont (à proposer dans le dépôt `empreinte-studio/empreinte`)

- **Voix** : `motsAEviter` rate les mots qui commencent ou finissent par une lettre accentuée (« échec », « raté », « manqué », « supprimé » : son `\b` ne voit pas la frontière) et ne connaît ni « erreur » ni les emoji (Apex complète avec `voiceIssues`) ; `formaterAttente` ne sait pas dire une date future (elle donne « Pour aujourd'hui »).
- **Akari** : pas de composant « réplique ». Une `aside[eNote]` par réplique crée autant de régions « complementary » de même nom pour les lecteurs d'écran, et la règle « une note par écran » ne tient pas (la coque peut aussi afficher un signalement).
- **Navigation** : `ELienNav` ne pose la corne que pour `aria-current="page"` (pas pour `"true"`, la section courante) ; `e-menu` ne marque pas l'entrée choisie (ni `menuitemradio` ni `aria-checked` : Apex écrit « · choisi ») ; pas de composant d'initiale (Apex : `.initial`, `shell.css`).
- **`e-matrice`** : sous 640px, les axes restent au-dessus d'une grille passée sur une colonne et deviennent faux ; le compte d'un quadrant n'est pas personnalisable et ses titres sont figés en `h3` ; au toucher, le glisser bloque le défilement (Apex règle un délai par `CDK_DRAG_CONFIG` ; à porter dans le composant).
- **`e-arete`** : pas de variante brouillon (la tête est toujours un sceau), pas de légende (Apex compose avec des cases d'`e-pas`, dont la case « En cours » porte une corne, `clip-path` à `--corne-s`, que la borne en cours de l'arête n'a pas : dans la légende, cette corne est décorative et sans `aria-current`, contraire au § 10 ; aucune primitive d'Empreinte ne dessine la borne sans corne), noms tronqués (18 / 22 / 2 × 15 caractères), pas d'identifiant dans `choisir` pour l'arête repliée « Faites », l'étape choisie n'est pas marquée, bornes carrées au lieu d'empreintes.
- **`e-filtres`** : pas de nom accessible par option (`OptionFiltre` n'a que `valeur`, `libelle`, `lumiere`) ; le libellé, coupé pour tenir sur un téléphone, est le seul nom du bouton. Apex garde des libellés différents (`distinctShortTitles`, « Préparer le… 2027 ») ; un `libelleComplet` (ou `aria-label`) par option rendrait le titre entier aux lecteurs d'écran.
- **Contenu** : pas de style « prose » pour le Markdown rendu (Apex : `.ds-prose`), pas de repli générique `details` (Apex : `details.accomplished`, `objectives.css`).

### Client, à reprendre

- Contrôle dans le navigateur fait le 21 octobre 2026 sur le Supabase local, avec un compte de test : connexion et inscription, Objectifs, Nouvel objectif jusqu'à « Je m'y engage », l'arête (ajout d'étape et de pas par les feuilles, case cochée), la matrice (« Déplacer vers… »), le thème Nuit retenu, captures à 1440 et 375px en Jour et en Nuit, sans erreur de console ni débordement horizontal. Trois défauts trouvés et corrigés : la zone du `LiveAnnouncer` s'affichait en bas de page (le CDK ne charge pas `.cdk-visually-hidden` pour lui : `chore/providers/a11y.provider.ts` lui donne une zone `e-masque`), les répliques étaient signées de l'adresse e-mail (`firstName`), l'arête d'Akari défilait jusqu'à sa fin et coupait le nom des étapes. Non vérifié : une vraie réponse d'Akari (voir ci-dessous).
- **Tester Akari en local** : l'IA passe par la fonction Edge `httpGeminiInteractiveAiProvider` ; sans `supabase functions serve` (et la clé Gemini dans ses secrets), elle répond 503 et la conversation reste sur « Akari réfléchit… » (le blocage `worklfows` ci-dessus).
- **Juste après une inscription**, le premier chargement peut être refusé par PostgREST (`JWT issued at future` : le jeton est émis dans la même seconde) ; la coque affiche alors « Je n'ai pas pu charger tes objectifs… », un rechargement suffit. Propre au Supabase local, à surveiller ailleurs.
- `ObjectiveStore` n'a pas d'état de réussite ou d'échec propre à chaque action : `requestStatus` est partagé (le nouvel objectif reconnaît son échec à sa phrase). `objectivesLoaded` règle le cas du chargement.
- `editObjective` appliqué à une étape met son « pourquoi » à vide dans l'état optimiste (il reste en base ; invisible aujourd'hui). Une feuille ouverte sur un id temporaire remplacé pendant qu'elle est ouverte ignore la modification sans rien dire.
- `ChatStore` n'a pas d'état « injoignable » : si le workflow ne démarre pas, la zone de réponse reste désactivée et seule la note de la coque l'explique.
- La note de signalement est en haut du contenu : après défilement, seuls les lecteurs d'écran l'entendent tout de suite.
- Le brouillon du nouvel objectif pose `[eSurface]` dans `.ds-panels` : son filet se double de celui de la trame (`.cards`, dans `objectives.css`, ne vaut que pour une trame faite de surfaces ; à régler dans une feuille du nouvel objectif).
- `apps/apex-client/src/styles/layout.css` garde 18 utilitaires `.ds-*` qu'aucun écran n'utilise (écarts, alignements, `.ds-grid-auto`, `.ds-cols-3`, `.ds-span-*`, `.ds-text-*`) : à garder ou à retirer.
- **La coque** est de la mise en page d'Apex : elle quitte `eCoque`, `eNav`, `eNavBas`, `eCoquePrincipal` et `eCoqueContenu` d'Empreinte pour `shell.css`. Trois défauts relevés dans la feuille de navigation d'Empreinte s'y corrigent : `.e-nav { height: 100% }` empêche la navigation de s'étirer, son filet s'arrête et le bas de la navigation vient sous les liens au lieu du pied de l'écran ; sous 760px, la coque (`flex-wrap`) partage la hauteur libre et le bandeau du haut grandit sur une page courte ; entre 761 et 791px (jusqu'à environ 806px avec une barre de défilement classique ; un iPad mini en portrait, 768px, est dedans), la coque passe déjà à la ligne (`flex: 1 1 232px` pour la navigation, `flex: 999 1 560px` pour la page : 792px) alors que la navigation ne passe en rangée que sous 760px, et devient un bandeau de toute la largeur, en colonne, d'environ 330px de haut.


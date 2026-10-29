## Technical Pool
- [] Ameliorer le store de loading
- [] Gross type de repetion pour les optimistiques update dans mes stores
- [] Gros pb d'affichage avec les select sur la modal d'edition de tache

## Features Pool
- [] Racourcis clavier pour creer un objectif
- [x] Validation pour la creation d'un objectif
- [] Checker une tache avec systeme de delay
- [] System d'onboarding pour les nouveaux utilisateurs
- [] Use primeng dock
- [x] List task et sub objectives fix padding
- [x] Checker les task
- [] Ajouter des icons pour les objectifs
- [] Ajouter une vue en arborescence pour les sous-objectifs (un graph de preference)
- [] donner la possibilite a mon ia de creer elle meme des sous-objectifs et des taches
- [x] Editer objectif et tache
- [x] Focus du jour et petite card sur la home page pour les stats

## Suivi de la migration Empreinte
Le détail est dans `docs/features/migration-empreinte.md`, § 11.

### Back-end (Apex Brain)
- [x] Le client appelle l'API d'Apex Brain : plus de librairie métier ni d'accès direct à Supabase, Firebase ou Gemini
- [x] `findObjectiveWithASpecificTaskId`, ordre du chargement, codes d'erreur de l'authentification, tour d'Akari bloqué : corrigés dans le serveur
- [x] Les longueurs de l'API (200 caractères pour un nom, 5 000 pour une description ou un pourquoi) arrêtent la saisie dans les formulaires
- [] Déconnexion : `POST /v1/auth/logout` existe, il manque le geste dans l'interface
- [] Retirer une échéance : l'API accepte `dueDate: null`, les feuilles « Modifier » l'interdisent encore
- [] Cas d'usage manquants : laisser filer ou supprimer (objectif, étape, pas)
- [] Règles encore dans le client, à exposer par l'API : quadrant d'un pas et déplacement vers un quadrant (`matrix.mapper.ts`), progression des étapes et objectif accompli (`objective-view.mapper.ts`)
- [] Akari : remplacer l'interrogation chaque seconde par un flux (SSE) côté API

### Empreinte, en amont (dépôt `empreinte-studio/empreinte`)
- [] `motsAEviter` rate les mots accentués (`\b`) et ne connaît ni « erreur » ni les emoji
- [] `formaterAttente` pour une date future
- [x] Un composant « réplique » pour Akari : `e-conversation`, `ol[eFil]`, `li[eReplique]` (0.3.0)
- [] `ELienNav` ne pose la corne que pour `aria-current="page"`
- [] `e-menu` sans état choisi
- [] `e-matrice` : axes faux sous 640px, compte non personnalisable, titres figés, glisser qui bloque le défilement tactile
- [] `e-arete` : pas de brouillon, pas de légende (Apex compose avec des cases d'`e-pas`, dont la case « En cours » porte une corne absente de la borne), noms tronqués, pas d'id dans `choisir`, étape choisie non marquée
- [] `e-filtres` : pas de nom accessible par option (le libellé coupé est le seul nom du bouton)
- [x] Un style « prose » pour le Markdown, dans les répliques (0.3.0)
- [] `e-conversation` : dire aux lecteurs d'écran les répliques d'Akari qui arrivent (le fil n'est pas une région annoncée : seuls la ligne d'état et, dans Apex, la demande d'accord sont dites)
- [] Un repli générique (`details`), une initiale de la personne

### Client
- [] Contrôle visuel de chaque écran dans le navigateur (Jour, Nuit, 375px, clavier, `GardienSceau`), avec une session sur Apex Brain (local ou hébergé)
- [] Un état de réussite ou d'échec propre à chaque action d'`ObjectiveStore` (`requestStatus` est partagé)
- [x] Un état « injoignable » dans `ChatStore` : l'interrogation continue pendant une panne, la note de la coque le dit puis s'en va
- [] Akari : remettre dans la zone de réponse un message refusé ou qui n'est pas parvenu (`[(brouillon)]` d'`e-conversation`)
- [] Décider du sort des 18 utilitaires `.ds-*` inutilisés (`apps/apex-client/src/styles/layout.css`)

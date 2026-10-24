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

### Back-end, à décider plus tard
- [] `findObjectiveWithASpecificTaskId` sans `setDone` / `setDescription` / `setDueDate` : modifier ou déplacer un pas remet en base le pas modifié et ses pas voisins à « non faits » (un pas fait déplacé ou renommé dans la matrice aussi : l'écran le montre fait, la base non), sans description ni échéance (laissé tel quel, sans compensation côté client)
- [] Le chargement (`SupabaseGetAllObjectiveAndTaskQuery`, `get_objective_subtree`) n'a pas d'`ORDER BY` : chaque upsert d'une étape et chaque pas coché déplacent la ligne en fin de lecture, et au rechargement « Étape N », l'étape en cours, le prochain pas et l'ordre des pas changent (`.order('created_at')` + départage stable, ou un champ d'ordre dans `ObjectiveOutput` / `TaskOutput`)
- [] Cas d'usage manquants : laisser filer ou supprimer (objectif, étape, pas), déconnexion, retirer une échéance (`EditObjectiveInput`)
- [] `SessionStore` ne garde pas le code d'erreur : la traduction des messages Supabase (`translateAuthError`) repose sur leurs textes anglais
- [] worklfows : `createBrowserInspector` de `@statelyai/inspect` appelé pour chaque workflow ; un tour reste bloqué si une étape invoquée échoue sans `onError`

### Empreinte, en amont (dépôt `empreinte-studio/empreinte`)
- [] `motsAEviter` rate les mots accentués (`\b`) et ne connaît ni « erreur » ni les emoji
- [] `formaterAttente` pour une date future
- [] Un composant « réplique » pour Akari (une `aside[eNote]` par réplique crée des régions en double)
- [] `ELienNav` ne pose la corne que pour `aria-current="page"`
- [] `e-menu` sans état choisi
- [] `e-matrice` : axes faux sous 640px, compte non personnalisable, titres figés, glisser qui bloque le défilement tactile
- [] `e-arete` : pas de brouillon, pas de légende (Apex compose avec des cases d'`e-pas`, dont la case « En cours » porte une corne absente de la borne), noms tronqués, pas d'id dans `choisir`, étape choisie non marquée
- [] `e-filtres` : pas de nom accessible par option (le libellé coupé est le seul nom du bouton)
- [] Un style « prose » pour le Markdown, un repli générique (`details`), une initiale de la personne

### Client
- [] Contrôle visuel de chaque écran dans le navigateur (Jour, Nuit, 375px, clavier, `GardienSceau`), avec une session sur le Supabase local
- [] Un état de réussite ou d'échec propre à chaque action d'`ObjectiveStore` (`requestStatus` est partagé)
- [] Un état « injoignable » dans `ChatStore`
- [] Décider du sort des 18 utilitaires `.ds-*` inutilisés (`apps/apex-client/src/styles/layout.css`)
- [] La coque dans `shell.css`, sans `eCoque`, `eNav`, `eNavBas`, `eCoquePrincipal` ni `eCoqueContenu` d'Empreinte, en corrigeant ses trois défauts : navigation qui ne s'étire pas jusqu'au pied de l'écran, bandeau mobile qui grandit sur une page courte, enroulement entre 761 et 791px (bandeau de 330px de haut, en colonne)

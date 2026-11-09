# Apex — client web

Le client web d'Apex montre à la personne ses objectifs tels que l'API d'Apex Brain les connaît, et envoie à l'API les gestes qu'elle fait. Le vocabulaire de l'interface (objectif, étape, pas, arête, laisser filer) est défini dans le cahier de migration, `docs/features/migration-empreinte.md`.

## Langage

### Gestes

**Geste** :
Ce que la personne fait pour changer ses objectifs, ses étapes ou ses pas. Il y en a trois sortes : créer, changer, effacer.
_Avoid_ : action, opération, requête

**Créer** :
Le geste qui ajoute un élément : un objectif, une étape ou un pas.
_Avoid_ : insérer

**Changer** :
Le geste qui donne de nouvelles valeurs à un élément qui existe déjà : modifier un objectif ou une étape, cocher, décocher, modifier ou déplacer un pas.
_Avoid_ : mettre à jour, éditer

**Effacer** :
Le geste qui retire un élément avec tout ce qui en dépend : un pas, une étape avec ses pas, un objectif avec ses étapes et leurs pas.
_Avoid_ : supprimer, détruire

**Commande** :
Ce que le client envoie à l'API pour un geste, avec un nom qui dit l'intention (renommer, cocher, déplacer…). Un geste peut en donner plusieurs ; chacune est acceptée ou refusée seule.
_Avoid_ : opération, requête, appel

### Écriture optimiste

**Écriture optimiste** :
La façon dont un geste prend effet : l'écran le montre tout de suite, puis l'API l'enregistre. Si elle l'accepte, l'écran le garde et prend ce qu'elle lui rend ; si elle le refuse, l'écran fait un retour en arrière. Un seul module la tient pour tous les gestes : `OptimisticWrites` (`chore/stores/utils/optimistic-writes.ts`). Il rend l'issue du geste au store, jamais à l'écran.
_Avoid_ : mise à jour optimiste

**Retour en arrière** :
Ce que fait l'écran quand l'API refuse un geste : il remet ce qui était là avant, à sa place.
_Avoid_ : annulation, rollback ; « remettre », qui est le geste de la personne depuis la trace d'un pas effacé

**Id temporaire** :
L'identité que porte un élément créé tant que l'API ne lui a pas donné la sienne. Elle ne sort jamais de l'écran : jamais dans une adresse. Aucun geste ne vise un élément qui la porte : il est visible, mais inactif, jusqu'à ce que l'API l'enregistre (ADR 0002).
_Avoid_ : id optimiste

**Relecture** :
Relire tous les objectifs, étapes et pas depuis l'API, pour remplacer ce que l'écran montre. Elle a lieu au chargement, quand on ne sait pas si l'API a fait un geste, et après ce qu'Akari écrit ; jamais après un geste accepté.
_Avoid_ : rechargement, reload, rafraîchissement

### Ce que dit le serveur

**Fait** :
L'état d'un pas, d'une étape ou d'un objectif tel que l'API le rend. L'écran le montre tel quel et n'en déduit rien : une étape dont tous les pas sont faits n'est pas faite tant que l'API ne le dit pas.
_Avoid_ : terminé, accompli (pour l'état ; « accompli » reste un mot de l'interface)

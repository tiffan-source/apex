# ADR 0001 — Pas de relecture après un geste accepté

- Statut : accepté
- Date : 2026-11-07

Le client parle à la v2 d'Apex Brain (ADR 0006 d'apex-brain) : une lecture, `GET /v2/bff/objective-tree`, et
des commandes nommées qui rendent l'objectif ou le pas créé ou changé, sans ses enfants. Un geste prend effet
à l'écran tout de suite, puis chacune de ses commandes part ; quand l'API l'accepte, ce qu'elle rend
remplace l'élément dans le store, **sans relire l'arbre**. Un refus net (4xx) fait un retour en arrière, sans
relecture non plus. L'arbre n'est relu qu'au chargement, quand l'issue d'une commande est inconnue (pas de
réponse, 5xx : le serveur a pu faire le travail) et après ce qu'Akari écrit (le client ne voit pas ce que
l'outil a créé).

## Options écartées

- **Relire après chaque geste** (ce que faisait le client en v1, pour que le « fait » d'une étape suive ses
  pas) : une requête de plus par geste, et un écran qui se réécrit sous les doigts de la personne.
- **Déduire le « fait » d'une étape de ses pas** : c'est une règle métier, elle est au serveur. Le client
  montre ce que l'API rend, rien d'autre.

## Conséquences

- Tant qu'Apex Brain ne tient pas `done` des objectifs et des étapes à jour **et** ne le rend pas après une
  commande sur un pas, une étape ou un objectif n'apparaît jamais fait, même quand tous ses pas le sont. C'est
  assumé ; la suite est au backlog d'apex-brain (`docs/plan.md`).
- Un geste qui touche plusieurs champs donne plusieurs commandes (renommer, reprioriser, déplacer un pas ;
  renommer, préciser, donner une échéance à un objectif), qui partent l'une après l'autre. Chacune est
  acceptée ou revient en arrière seule : il n'y a pas de transaction, et une seule note dit le refus.
- Une commande n'est jamais renvoyée automatiquement : une issue inconnue mène à une relecture.

# ADR 0002 — Aucun geste sur un élément pas encore enregistré

- Statut : accepté
- Date : 2026-11-08

Un élément créé (un objectif, une étape, un pas) s'affiche tout de suite avec un id temporaire, puis l'API
l'enregistre et lui donne le sien (écriture optimiste). **Tant qu'il porte son id temporaire, aucun geste ne le
vise** : ni le cocher, le modifier, l'effacer ; ni lui ajouter une étape ou un pas ; ni y déplacer un pas ; ni
ouvrir l'objectif ou parler de lui à Akari. Effacer une étape ou un objectif attend aussi que tout ce qu'il porte
soit enregistré. L'écran le montre, inactif, avec « J'enregistre… » ; `OptimisticWrites` laisse de côté (`skipped`)
un geste qui le viserait quand même.

## Options écartées

- **Mettre le geste en file derrière la création, et le faire partir avec l'id définitif** (ce que faisait le
  client jusqu'ici, avec `WriteQueue.link()` et `resolve()`) : chaque geste devait retrouver l'id définitif, et
  décider quoi faire si la création n'aboutissait pas. Quatre gestes le faisaient de quatre façons, et
  l'effacement devait remettre en place des éléments dont l'id avait changé entre-temps. La règle tenait dans
  trente appels à `resolve()` répartis dans huit fichiers.

## Conséquences

- Plus aucune écriture ne part avec un id temporaire : `WriteQueue` ne garde que l'ordre des écritures et la
  personne du geste. `ObjectiveStore.currentId()` donne l'id définitif reçu, pour un écran qui garde un élément
  choisi (l'étape ouverte).
- La personne attend que l'API ait répondu avant de toucher à ce qu'elle vient de créer. Avec l'instance gratuite
  de Render endormie, la première réponse peut prendre une minute : l'élément reste visible, inactif, pendant ce
  temps.
- Une future revue d'architecture ne doit pas proposer de remettre des gestes en file derrière une création.

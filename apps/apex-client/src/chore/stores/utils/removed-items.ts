/*
 * Ce qu'un effacement optimiste retire de l'état, et comment le remettre à sa place s'il n'aboutit pas.
 * Chaque élément garde sa place dans la liste : revenu, il ne saute pas en bas de l'écran.
 */

/** Un élément retiré d'une liste, avec la place qu'il y occupait. */
export type RemovedItem<T> = {
  readonly index: number;
  readonly item: T;
};

/** Sépare d'une liste les éléments à retirer, en notant leur place. */
export function removeWhere<T>(list: readonly T[], shouldRemove: (item: T) => boolean): {
  kept: T[];
  removed: RemovedItem<T>[];
} {
  const kept: T[] = [];
  const removed: RemovedItem<T>[] = [];
  list.forEach((item, index) => (shouldRemove(item) ? removed.push({ index, item }) : kept.push(item)));
  return { kept, removed };
}

/**
 * Remet les éléments retirés à leur place, sauf ceux qui sont déjà revenus (un rechargement a pu les rendre).
 * `normalize` les met à jour avant leur retour (un id temporaire devenu définitif entre-temps).
 */
export function restoreRemoved<T extends { id: string }>(
  list: readonly T[],
  removed: readonly RemovedItem<T>[],
  normalize: (item: T) => T = (item) => item,
): T[] {
  const restored = [...list];
  for (const { index, item } of [...removed].sort((a, b) => a.index - b.index)) {
    const back = normalize(item);
    if (restored.some((current) => current.id === back.id)) continue;
    restored.splice(Math.min(index, restored.length), 0, back);
  }
  return restored;
}

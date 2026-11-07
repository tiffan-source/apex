/*
 * Ce qu'une commande change sur un élément de l'état (un objectif, une étape, un pas).
 *
 * Un geste pose ses champs à l'écran tout de suite, puis sa commande part dans la file d'écritures. Pendant
 * qu'elle attend, la personne a pu faire un autre geste sur le même élément : il part après elle et aura sa
 * propre réponse. Quand la réponse arrive, les champs de la commande ne sont donc touchés que s'ils montrent
 * encore tous ce que ce geste-ci y a mis : l'API accepte, ils prennent les valeurs qu'elle rend ; l'API refuse,
 * ils reprennent leurs valeurs d'avant. Un seul champ changé depuis, et rien n'est touché : comparer champ par
 * champ défairait un geste plus récent qui a remis une même valeur.
 */

/** Compare deux valeurs d'un champ ; un id temporaire et l'id définitif qu'il a reçu sont le même. */
export type SameValue = (field: string, a: unknown, b: unknown) => boolean;

const strictlyEqual: SameValue = (_field, a, b) => a === b;

/**
 * Remplace, dans l'élément `id`, les champs de `shown` par ceux de `next`, si l'élément montre encore toutes les
 * valeurs de `shown` (ce que le geste y a mis) ; sinon un geste plus récent l'a changé, et il reste tel quel.
 */
export function replaceFieldsIfShown<T extends { id: string }>(
  list: readonly T[],
  id: string,
  shown: Partial<T>,
  next: Partial<T>,
  same: SameValue = strictlyEqual,
): T[] {
  const fields = Object.keys(shown) as (keyof T & string)[];
  return list.map((item) => {
    if (item.id !== id || !fields.every((field) => same(field, item[field], shown[field]))) return item;
    const patch: Partial<T> = {};
    for (const field of fields) if (field in next) patch[field] = next[field];
    return { ...item, ...patch };
  });
}

/** Les champs `fields` de `source` (ce que rend l'API, ou l'élément avant le geste). */
export function pickFields<T, K extends keyof T>(source: T, fields: readonly K[]): Pick<T, K> {
  const picked = {} as Pick<T, K>;
  for (const field of fields) picked[field] = source[field];
  return picked;
}

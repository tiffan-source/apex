/** Le titre d'un objectif dans un fil d'Ariane (l'arête, Akari) : au-delà, il est coupé. */
export const CRUMB_TITLE_MAX = 32;

/**
 * Le titre d'un objectif dans la rangée de filtres de la matrice : un bouton d'Empreinte ne passe pas à la
 * ligne, un titre plus long déborderait sur un téléphone.
 */
export const FILTER_TITLE_MAX = 24;

/** La ponctuation et les espaces qui ne finissent pas un titre coupé (« Licence, »). */
const TRAILING = /[\s,;:·.\-–—]+$/u;

/** Les espaces resserrés. */
const normalize = (title: string) => title.trim().replace(/\s+/g, ' ');

/**
 * Le titre court d'un objectif, quand la place manque : les espaces resserrés, puis, au-delà de `max`
 * caractères, coupé au dernier mot entier qui tient (au milieu d'un mot trop long pour qu'il en reste au
 * moins la moitié), sans ponctuation finale, et suivi de « … ». « … » compris, il ne dépasse jamais `max`.
 * Dans un fil d'Ariane, le titre entier reste écrit sur l'écran (titre de la page). Dans les filtres de la
 * matrice, le titre court est le seul nom du bouton, visible et accessible : passer par distinctShortTitles.
 */
export function shortTitle(title: string, max: number): string {
  const text = normalize(title);
  if (text.length <= max) return text;
  const room = max - 1; // la place laissée au texte, à côté de « … »
  const cut = text.slice(0, room);
  const endsOnWord = text.charAt(room) === ' ';
  const lastSpace = cut.lastIndexOf(' ');
  const head = endsOnWord || lastSpace < max / 2 ? cut : cut.slice(0, lastSpace);
  return `${head.replace(TRAILING, '') || cut}…`;
}

/**
 * Le début d'un titre et ses `count` derniers mots, pour départager deux titres courts : « Préparer le… 2027 ».
 * null quand la fin ne laisse plus assez de place au début (moins de la moitié de `max`) pour qu'on le reconnaisse.
 */
function withEnd(words: readonly string[], count: number, max: number): string | null {
  if (count >= words.length) return null;
  const end = words.slice(-count).join(' ');
  const room = max - end.length - 1; // la place du début, « … » compris, à côté de l'espace et de la fin
  if (room < Math.ceil(max / 2)) return null;
  return `${shortTitle(words.slice(0, -count).join(' '), room)} ${end}`;
}

/**
 * Les titres courts d'une liste où chacun doit se distinguer des autres (les filtres de la matrice : e-filtres
 * n'a pas de nom accessible par option, le titre court est le seul nom du bouton). Deux titres coupés au même
 * endroit (« Préparer le concours… ») gardent leur début et prennent leurs derniers mots, autant qu'il en faut
 * pour qu'ils diffèrent (« Préparer le… 2027 », « Préparer le… 2028 »), sans dépasser `max`. Deux titres
 * identiques, ou qui ne diffèrent qu'au milieu, restent tels que shortTitle les coupe.
 */
export function distinctShortTitles(titles: readonly string[], max: number): string[] {
  const result = titles.map((title) => shortTitle(title, max));
  const groups = new Map<string, number[]>();
  result.forEach((short, index) => groups.set(short, [...(groups.get(short) ?? []), index]));

  for (const indexes of groups.values()) {
    if (indexes.length < 2) continue;
    const words = indexes.map((index) => normalize(titles[index]).split(' '));
    for (let count = 1; ; count++) {
      const attempt = words.map((list) => withEnd(list, count, max));
      if (attempt.some((label) => label === null)) break;
      if (new Set(attempt).size === attempt.length) {
        indexes.forEach((index, position) => (result[index] = attempt[position] as string));
        break;
      }
    }
  }
  return result;
}

/** Le titre d'un objectif dans un fil d'Ariane (l'arête, Akari) : au-delà, il est coupé. */
export const CRUMB_TITLE_MAX = 32;

/** La ponctuation et les espaces qui ne finissent pas un titre coupé (« Licence, »). */
const TRAILING = /[\s,;:·.\-–—]+$/u;

/** Les espaces resserrés. */
const normalize = (title: string) => title.trim().replace(/\s+/g, ' ');

/**
 * Le titre court d'un objectif, quand la place manque : les espaces resserrés, puis, au-delà de `max`
 * caractères, coupé au dernier mot entier qui tient (au milieu d'un mot trop long pour qu'il en reste au
 * moins la moitié), sans ponctuation finale, et suivi de « … ». « … » compris, il ne dépasse jamais `max`.
 * Dans un fil d'Ariane, le titre entier reste écrit sur l'écran (titre de la page).
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

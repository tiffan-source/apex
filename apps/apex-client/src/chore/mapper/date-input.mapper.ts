/*
 * Les dates des champs <input eSaisie type="date"> (« 2026-06-01 ») ↔ les échéances du store (ISO).
 *
 * new Date('2026-06-01') donne minuit UTC : à l'ouest de Greenwich (Québec…), c'est encore le 31 mai,
 * et l'horizon, écrit en heure locale (formatHorizon), devient « Jusqu'en mai ». À l'inverse, couper un
 * ISO à 10 caractères pour préremplir un champ peut reculer d'un jour à l'est (« 2026-05-31T22:00:00.000Z »
 * pour le 1er juin à Paris). Ces deux fonctions restent en heure locale, dans les deux sens.
 */

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * La valeur d'un champ date (« AAAA-MM-JJ ») ou mois (« AAAA-MM », le 1er du mois) en Date locale, à minuit.
 * undefined pour une valeur vide ou impossible (« 2026-02-31 »).
 */
export function fromDateInputValue(value: string | null | undefined): Date | undefined {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value?.trim() ?? '');
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = match[3] ? Number(match[3]) : 1;
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, month, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return undefined;
  return date;
}

/** Une échéance (ISO ou Date) en valeur de champ date « AAAA-MM-JJ », en heure locale ; vide sans échéance. */
export function toDateInputValue(dueDate: string | Date | null | undefined): string {
  if (!dueDate) return '';
  const date = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

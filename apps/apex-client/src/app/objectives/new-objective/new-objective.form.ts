import { minDateError, required, requiredError, schema, validate } from '@angular/forms/signals';
import { fromDateInputValue, toDateInputValue } from '../../../chore/mapper/date-input.mapper';

/*
 * Le brouillon d'un nouvel objectif (Signal Forms). Rien n'est enregistré tant que la personne ne
 * s'engage pas : ce modèle vit dans l'écran, le store ne le reçoit qu'à « Je m'y engage ».
 *
 * Les champs restent des chaînes : l'horizon est la valeur d'un <input type="date"> (« AAAA-MM-JJ »),
 * convertie en Date locale par fromDateInputValue au moment de l'engagement (jamais new Date(valeur)).
 */

/** Le brouillon, tel que la personne l'écrit. */
export type NewObjectiveDraft = {
  title: string;
  why: string;
  dueDate: string;
  description: string;
};

/** Un brouillon vide. */
export const EMPTY_DRAFT: NewObjectiveDraft = { title: '', why: '', dueDate: '', description: '' };

/** Ce que les champs disent quand il manque quelque chose, avec la solution. */
export const DRAFT_MESSAGES = {
  titleRequired: 'Donne un nom à ton objectif pour continuer.',
  dueDateInPast: "Choisis aujourd'hui ou une date à venir.",
} as const;

/** Minuit, aujourd'hui, en heure locale. */
export function startOfToday(now: Date = new Date()): Date {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today;
}

/** La valeur « AAAA-MM-JJ » d'aujourd'hui, pour l'attribut min du champ date. */
export function todayInputValue(now: Date = new Date()): string {
  return toDateInputValue(now);
}

/** Vrai si la date du champ est avant aujourd'hui (une valeur vide ou illisible ne l'est pas). */
export function isBeforeToday(value: string, now: Date = new Date()): boolean {
  const date = fromDateInputValue(value);
  return date !== undefined && date.getTime() < startOfToday(now).getTime();
}

/**
 * Les règles du brouillon : le titre est obligatoire (des espaces seuls ne comptent pas), l'horizon
 * est facultatif mais jamais avant aujourd'hui ; le pourquoi et la description sont libres.
 */
export const newObjectiveSchema = schema<NewObjectiveDraft>((path) => {
  required(path.title, { message: DRAFT_MESSAGES.titleRequired });
  validate(path.title, ({ value }) =>
    value().length > 0 && value().trim() === '' ? requiredError({ message: DRAFT_MESSAGES.titleRequired }) : undefined,
  );
  validate(path.dueDate, ({ value }) =>
    isBeforeToday(value()) ? minDateError(startOfToday(), { message: DRAFT_MESSAGES.dueDateInPast }) : undefined,
  );
});

/** Ce que reçoit ObjectiveStore.createObjective. */
export type CreateObjectiveInput = { title: string; why?: string; description?: string; dueDate?: Date };

/**
 * Le brouillon prêt à enregistrer : textes coupés de leurs espaces, champs vides omis, horizon en Date
 * locale. null tant que le titre est vide.
 */
export function toCreateObjectiveInput(draft: NewObjectiveDraft): CreateObjectiveInput | null {
  const title = draft.title.trim();
  if (!title) return null;
  const why = draft.why.trim();
  const description = draft.description.trim();
  const dueDate = fromDateInputValue(draft.dueDate);
  return {
    title,
    ...(why ? { why } : {}),
    ...(description ? { description } : {}),
    ...(dueDate ? { dueDate } : {}),
  };
}

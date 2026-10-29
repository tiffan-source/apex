import {
  maxLength,
  requiredError,
  validate,
  type FieldTree,
  type PathKind,
  type SchemaPath,
  type SchemaPathRules,
} from '@angular/forms/signals';
import { TEXT_MAX_LENGTH } from '../../../chore/api/api.models';

/*
 * La validation commune aux feuilles de l'arête (Signal Forms). Une erreur s'écrit en encre, avec ce
 * qu'il faut faire : e-champ l'affiche sous le contrôle, sans jamais de rouge.
 */

/** Un texte obligatoire, qui ne compte pas s'il n'a que des espaces. Le message dit quoi faire. */
export function requireText<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  message: string,
): void {
  validate(path, (context) => (context.value().trim() ? undefined : requiredError({ message })));
}

/**
 * Un texte que l'API borne (TEXT_MAX_LENGTH) : un nom, une description, un pourquoi. [formField] pose la
 * longueur sur le contrôle natif (maxlength) ; un texte déjà plus long (écrit avant que l'API le borne)
 * arrête l'enregistrement, et e-champ dit « C'est un peu long : … caractères au plus. ». Sans cela, la
 * feuille se fermerait sur un texte que l'API refuse ensuite.
 */
export function limitText<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  kind: 'title' | 'longText',
): void {
  maxLength(path, TEXT_MAX_LENGTH[kind]);
}

/**
 * Le message d'un contrôle qui ne l'écrit pas lui-même (e-selection), à passer à e-champ [erreur] :
 * seulement une fois le contrôle touché (ou la feuille soumise), comme pour une saisie.
 */
export function visibleError(field: FieldTree<unknown>): string | null {
  const state = field();
  if (!state.touched() || !state.invalid()) return null;
  return state.errors()[0]?.message ?? null;
}

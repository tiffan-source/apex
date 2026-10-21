import {
  requiredError,
  validate,
  type FieldTree,
  type PathKind,
  type SchemaPath,
  type SchemaPathRules,
} from '@angular/forms/signals';

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
 * Le message d'un contrôle qui ne l'écrit pas lui-même (e-selection), à passer à e-champ [erreur] :
 * seulement une fois le contrôle touché (ou la feuille soumise), comme pour une saisie.
 */
export function visibleError(field: FieldTree<unknown>): string | null {
  const state = field();
  if (!state.touched() || !state.invalid()) return null;
  return state.errors()[0]?.message ?? null;
}

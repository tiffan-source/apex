import {
  requiredError,
  validate,
  type PathKind,
  type SchemaPath,
  type SchemaPathRules,
} from '@angular/forms/signals';

/*
 * La validation commune aux feuilles de l'écran d'un objectif (Signal Forms). Une erreur s'écrit en encre, avec ce
 * qu'il faut faire : ax-field l'affiche sous le contrôle (ax-select compris), sans jamais de rouge.
 */

/** Un texte obligatoire, qui ne compte pas s'il n'a que des espaces. Le message dit quoi faire. */
export function requireText<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  message: string,
): void {
  validate(path, (context) => (context.value().trim() ? undefined : requiredError({ message })));
}


import { map, OperatorFunction, pipe } from "rxjs";
import type { ObjectiveViewModel, TaskViewModel } from "../../models/objective.viewmodel";

/** Le préfixe des identifiants optimistes. */
export const TEMPORARY_ID_PREFIX = 'temp-id-';

/** Vrai pour un identifiant optimiste, pas encore enregistré : à ne jamais mettre dans une URL. */
export function isTemporaryId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(TEMPORARY_ID_PREFIX);
}

/** Un nouvel id temporaire, pour l'élément qu'un geste crée. */
export function temporaryId(): string {
  return TEMPORARY_ID_PREFIX + crypto.randomUUID();
}

/** Remplace l'élément optimiste `tempId` par l'élément enregistré, à la même place. */
export function replaceTemporary<T extends { id: string }>(list: readonly T[], tempId: string, saved: T): T[] {
  return list.map((item) => (item.id === tempId ? saved : item));
}

/** Donne à chaque geste un identifiant temporaire pour l'élément qu'il crée. */
export function withOptimistiqueId<T>() : OperatorFunction<T, T & {tempId: string}> {
  return pipe(
    map((data)=>({...data, tempId: TEMPORARY_ID_PREFIX + crypto.randomUUID()}))
  )
}

/**
 * Le résultat d'un chargement, plus les éléments encore optimistes de l'état (objectifs, étapes et pas à
 * l'id temporaire) : leur création est en cours, ils ne sont pas encore en base. Ils viennent après les
 * éléments chargés, comme un élément ajouté vient après les autres.
 */
export function keepOptimistic(
  loaded: { objectives: ObjectiveViewModel[]; tasks: TaskViewModel[] },
  current: { objectives: ObjectiveViewModel[]; tasks: TaskViewModel[] },
): { objectives: ObjectiveViewModel[]; tasks: TaskViewModel[] } {
  return {
    objectives: [...loaded.objectives, ...current.objectives.filter((objective) => isTemporaryId(objective.id))],
    tasks: [...loaded.tasks, ...current.tasks.filter((task) => isTemporaryId(task.id))],
  };
}

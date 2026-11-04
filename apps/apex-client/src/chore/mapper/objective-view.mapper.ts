import { legendeProgression } from '@empreinte-studio/angular/core';
import type { EtapeArete } from '@empreinte-studio/angular/arete';
import type { OptionSelection } from '@empreinte-studio/angular/selection';
import type { ObjectiveViewModel, TaskViewModel } from '../models/objective.viewmodel';
import type { ObjectiveCardViewModel, TaskCountViewModel } from '../models/objective-card.viewmodel';
import type {
  AreteStageViewModel,
  ObjectiveDetailViewModel,
  StageTaskProgressViewModel,
  StageTaskViewModel,
  StageViewModel,
} from '../models/objective-detail.viewmodel';

/*
 * Les vues des écrans Objectifs, Arête et Akari, dérivées de l'état du store (cahier de migration, § 4).
 * Fonctions pures : l'heure courante se passe en paramètre (par défaut, maintenant).
 *
 * Vocabulaire : objectif = objectif racine (parentId null) ; étape = sous-objectif DIRECT ; pas = tâche. Les
 * pas des sous-objectifs plus profonds comptent dans leur étape.
 *
 * Étapes et pas sont indépendants : ils n'ont aucun ordre, et l'ordre de chargement ne veut rien dire. Fait ou
 * non fait, c'est l'API qui le dit (`done`) : ces vues l'affichent et comptent, elles ne décident de rien. Le
 * quadrant d'un pas relève aussi d'Apex Brain : tant que l'API ne le rend pas, les écrans ne le montrent pas
 * (docs/technical/data-flow.md).
 */

/** Le texte d'une étape sans pas. */
export const EMPTY_STAGE_DETAIL = "Aucun pas pour l'instant";

/**
 * Le nom d'une étape qui n'en a pas (données d'avant la migration : l'ancien écran affichait
 * « Sous-objectif sans titre ») : elle reste lisible sur l'arête, dans les listes et dans les choix.
 */
export const UNTITLED_STAGE = 'Étape sans nom';

/** Le nom affiché d'une étape : son titre, ou « Étape sans nom » s'il est vide (ou fait d'espaces). */
export function stageName(title: string): string {
  return title.trim() || UNTITLED_STAGE;
}

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long' });

/**
 * L'horizon d'un objectif : « Jusqu'en mai », ou « Jusqu'en mai 2027 » si l'année n'est pas l'année en cours.
 * Vide sans échéance (ou avec une date illisible).
 */
export function formatHorizon(dueDate: string | Date | null | undefined, now: Date = new Date()): string {
  if (!dueDate) return '';
  const date = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(date.getTime())) return '';
  const month = MONTH.format(date);
  return date.getFullYear() === now.getFullYear() ? `Jusqu'en ${month}` : `Jusqu'en ${month} ${date.getFullYear()}`;
}

/** Les objectifs racines. */
export function rootObjectives(objectives: readonly ObjectiveViewModel[]): ObjectiveViewModel[] {
  return objectives.filter((objective) => objective.parentId === null);
}

/** Les étapes d'un objectif : ses sous-objectifs directs. */
export function stagesOf(objectiveId: string, objectives: readonly ObjectiveViewModel[]): ObjectiveViewModel[] {
  return objectives.filter((objective) => objective.parentId === objectiveId);
}

/** L'objectif et tous ses descendants, quelle que soit la profondeur. */
export function subtreeIds(objectiveId: string, objectives: readonly ObjectiveViewModel[]): Set<string> {
  const ids = new Set<string>([objectiveId]);
  const queue = [objectiveId];
  while (queue.length > 0) {
    const parentId = queue.shift() as string;
    for (const objective of objectives) {
      if (objective.parentId === parentId && !ids.has(objective.id)) {
        ids.add(objective.id);
        queue.push(objective.id);
      }
    }
  }
  return ids;
}

/** Les pas d'un objectif et de tous ses descendants. */
export function tasksInSubtree(
  objectiveId: string,
  objectives: readonly ObjectiveViewModel[],
  tasks: readonly TaskViewModel[],
): TaskViewModel[] {
  const ids = subtreeIds(objectiveId, objectives);
  return tasks.filter((task) => ids.has(task.objectiveId));
}

/** Ce qu'une liste de pas compte : faits, à faire. */
function taskProgress(tasks: readonly TaskViewModel[]): StageTaskProgressViewModel {
  const done = tasks.filter((task) => task.done).length;
  return { done, toDo: tasks.length - done };
}

/** « 4 pas faits · 3 à faire » (legendeProgression d'Empreinte), ou le texte d'une étape vide. */
export function stageDetail(progress: StageTaskProgressViewModel): string {
  return legendeProgression({ faits: progress.done, aFaire: progress.toDo }) || EMPTY_STAGE_DETAIL;
}

function countTasks(tasks: readonly TaskViewModel[]): TaskCountViewModel {
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}

/** La carte d'un objectif. */
export function toObjectiveCard(
  objective: ObjectiveViewModel,
  objectives: readonly ObjectiveViewModel[],
  tasks: readonly TaskViewModel[],
  now: Date = new Date(),
): ObjectiveCardViewModel {
  const stages = stagesOf(objective.id, objectives);
  const done = stages.filter((stage) => stage.done).length;
  return {
    id: objective.id,
    title: objective.title,
    why: objective.why,
    horizon: formatHorizon(objective.dueDate, now),
    stageProgress: { done, toDo: stages.length - done },
    stageCount: stages.length,
    taskCount: countTasks(tasksInSubtree(objective.id, objectives, tasks)),
    accomplished: objective.done,
  };
}

/** Les cartes de tous les objectifs racines. */
export function toObjectiveCards(
  objectives: readonly ObjectiveViewModel[],
  tasks: readonly TaskViewModel[],
  now: Date = new Date(),
): ObjectiveCardViewModel[] {
  return rootObjectives(objectives).map((objective) => toObjectiveCard(objective, objectives, tasks, now));
}

function toStageTasks(tasks: readonly TaskViewModel[]): StageTaskViewModel[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    done: task.done,
    importance: task.importance,
    urgency: task.urgency,
    objectiveId: task.objectiveId,
  }));
}

/** La vue détaillée d'un objectif pour l'arête ; undefined s'il n'est pas chargé. */
export function toObjectiveDetail(
  objectiveId: string,
  objectives: readonly ObjectiveViewModel[],
  tasks: readonly TaskViewModel[],
  now: Date = new Date(),
): ObjectiveDetailViewModel | undefined {
  const objective = objectives.find((item) => item.id === objectiveId);
  if (!objective) return undefined;

  const stages: StageViewModel[] = stagesOf(objectiveId, objectives).map((stage) => {
    const stageTasks = tasksInSubtree(stage.id, objectives, tasks);
    const progress = taskProgress(stageTasks);
    return {
      id: stage.id,
      title: stage.title,
      description: stage.description,
      dueDate: stage.dueDate,
      horizon: formatHorizon(stage.dueDate, now),
      done: stage.done,
      tasks: toStageTasks(stageTasks),
      progress,
      detail: stageDetail(progress),
    };
  });

  return {
    objective: {
      id: objective.id,
      title: objective.title,
      why: objective.why,
      description: objective.description,
      dueDate: objective.dueDate,
      horizon: formatHorizon(objective.dueDate, now),
    },
    stages,
    tasksWithoutStage: toStageTasks(tasks.filter((task) => task.objectiveId === objectiveId)),
    // Le nom affiché (« Étape sans nom ») : stages[].title garde le vrai titre, que la feuille « Modifier l'étape » préremplit.
    aretes: stages.map((stage) => ({ id: stage.id, nom: stageName(stage.title), faite: stage.done })),
    taskCount: countTasks(tasksInSubtree(objectiveId, objectives, tasks)),
  };
}

/** Les étapes d'un objectif pour e-selection : { valeur: id, libelle: titre }. */
export function stageOptions(objectiveId: string, objectives: readonly ObjectiveViewModel[]): OptionSelection<string>[] {
  return stagesOf(objectiveId, objectives).map((stage) => ({ valeur: stage.id, libelle: stage.title }));
}

/** Les objectifs racines pour e-selection : { valeur: id, libelle: titre }. */
export function rootObjectiveOptions(objectives: readonly ObjectiveViewModel[]): OptionSelection<string>[] {
  return rootObjectives(objectives).map((objective) => ({ valeur: objective.id, libelle: objective.title }));
}

/**
 * L'id de l'étape choisie sur <e-arete (choisir)>. Null pour l'arête « Faites » qu'Empreinte forme
 * au-delà de 8 étapes en repliant les étapes faites (elle ne correspond à aucune étape).
 */
export function stageIdFromArete(etape: EtapeArete): string | null {
  const id = (etape as Partial<AreteStageViewModel>).id;
  return typeof id === 'string' ? id : null;
}

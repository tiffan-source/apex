import { compter } from '@empreinte-studio/angular/core';
import type { EtapeArete, EtatEtape } from '@empreinte-studio/angular/arete';
import type { OptionSelection } from '@empreinte-studio/angular/selection';
import type { ObjectiveViewModel, TaskViewModel } from '../models/objective.viewmodel';
import type { ObjectiveCardViewModel } from '../models/objective-card.viewmodel';
import type {
  AreteStageViewModel,
  ObjectiveDetailViewModel,
  StageTaskViewModel,
  StageViewModel,
} from '../models/objective-detail.viewmodel';

/*
 * Les vues des écrans Objectifs, Arête et Akari, dérivées de l'état du store (cahier de migration, § 4).
 * Fonctions pures : l'heure courante se passe en paramètre (par défaut, maintenant).
 *
 * Elles rangent et mettent en forme ce que l'API rend, sans règle métier : la progression (une étape faite,
 * l'étape en cours, le prochain pas, un objectif accompli) et le quadrant d'un pas relèvent d'Apex Brain.
 * Tant que l'API ne les rend pas, les écrans ne les montrent pas (docs/technical/data-flow.md).
 *
 * Vocabulaire : objectif = objectif racine (parentId null) ; étape = sous-objectif DIRECT, dans l'ordre
 * de chargement ; pas = tâche. Les pas des sous-objectifs plus profonds sont rangés dans leur étape.
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

/** Les objectifs racines, dans l'ordre de chargement. */
export function rootObjectives(objectives: readonly ObjectiveViewModel[]): ObjectiveViewModel[] {
  return objectives.filter((objective) => objective.parentId === null);
}

/** Les étapes d'un objectif : ses sous-objectifs directs, dans l'ordre de chargement. */
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

/** Les pas d'un objectif et de tous ses descendants, dans l'ordre de chargement des pas. */
export function tasksInSubtree(
  objectiveId: string,
  objectives: readonly ObjectiveViewModel[],
  tasks: readonly TaskViewModel[],
): TaskViewModel[] {
  const ids = subtreeIds(objectiveId, objectives);
  return tasks.filter((task) => ids.has(task.objectiveId));
}

/** Le texte court d'une étape sans pas, sur l'arête (Empreinte coupe le détail à 22 caractères). */
export const NO_TASK = 'Aucun pas';

/** Ce qu'une étape porte, sous son nom : « 3 pas », ou « Aucun pas pour l'instant ». */
export function stageDetail(taskCount: number): string {
  return taskCount > 0 ? compter(taskCount, 'pas', 'pas') : EMPTY_STAGE_DETAIL;
}

/**
 * L'état qu'Empreinte exige pour chaque étape de l'arête. L'API ne rend pas la progression : toutes les
 * étapes sont dessinées de la même façon, et leur détail dit seulement combien de pas elles portent (le
 * texte « À venir » d'Empreinte n'est jamais écrit).
 */
export const ARETE_STAGE_STATE: EtatEtape = 'a-venir';

/** Une étape pour <e-arete> : son nom, l'état neutre, et « 3 pas » (ou « Aucun pas ») sous son nom. */
function toAreteStage(stage: StageViewModel): AreteStageViewModel {
  // Le nom affiché (« Étape sans nom ») : stages[].title garde le vrai titre, que la feuille « Modifier l'étape » préremplit.
  return {
    id: stage.id,
    nom: stageName(stage.title),
    etat: ARETE_STAGE_STATE,
    detail: stage.tasks.length > 0 ? compter(stage.tasks.length, 'pas', 'pas') : NO_TASK,
  };
}

function toStageTask(task: TaskViewModel): StageTaskViewModel {
  return {
    id: task.id,
    title: task.title,
    done: task.done,
    importance: task.importance,
    urgency: task.urgency,
    objectiveId: task.objectiveId,
  };
}

/** La carte d'un objectif : ce que l'API en rend, et ce qu'il porte. */
export function toObjectiveCard(
  objective: ObjectiveViewModel,
  objectives: readonly ObjectiveViewModel[],
  tasks: readonly TaskViewModel[],
  now: Date = new Date(),
): ObjectiveCardViewModel {
  return {
    id: objective.id,
    title: objective.title,
    why: objective.why,
    horizon: formatHorizon(objective.dueDate, now),
    stageCount: stagesOf(objective.id, objectives).length,
    taskCount: tasksInSubtree(objective.id, objectives, tasks).length,
  };
}

/** Les cartes de tous les objectifs racines, dans l'ordre de chargement. */
export function toObjectiveCards(
  objectives: readonly ObjectiveViewModel[],
  tasks: readonly TaskViewModel[],
  now: Date = new Date(),
): ObjectiveCardViewModel[] {
  return rootObjectives(objectives).map((objective) => toObjectiveCard(objective, objectives, tasks, now));
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

  const stages: StageViewModel[] = stagesOf(objectiveId, objectives).map((stage, index) => {
    const stageTasks = tasksInSubtree(stage.id, objectives, tasks);
    return {
      id: stage.id,
      title: stage.title,
      description: stage.description,
      dueDate: stage.dueDate,
      horizon: formatHorizon(stage.dueDate, now),
      index: index + 1,
      tasks: stageTasks.map(toStageTask),
      detail: stageDetail(stageTasks.length),
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
    tasksWithoutStage: tasks.filter((task) => task.objectiveId === objectiveId).map(toStageTask),
    aretes: stages.map(toAreteStage),
    defaultStageId: stages[0]?.id ?? null,
    taskCount: tasksInSubtree(objectiveId, objectives, tasks).length,
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
 * L'id de l'étape choisie sur <e-arete (choisir)>. Null pour une arête qu'Empreinte aurait formée lui-même
 * (« Faites », au-delà de 8 étapes, quand des étapes sont faites : jamais sans état d'étape).
 */
export function stageIdFromArete(etape: EtapeArete): string | null {
  const id = (etape as Partial<AreteStageViewModel>).id;
  return typeof id === 'string' ? id : null;
}

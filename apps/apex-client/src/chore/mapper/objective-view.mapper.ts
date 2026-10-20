import { legendeProgression, type EtatPas } from '@empreinte-studio/angular/core';
import type { EtapeArete, EtatEtape } from '@empreinte-studio/angular/arete';
import type { OptionSelection } from '@empreinte-studio/angular/selection';
import type { ObjectiveViewModel, TaskViewModel } from '../models/objective.viewmodel';
import type {
  NextTaskViewModel,
  ObjectiveCardViewModel,
  TaskCountViewModel,
} from '../models/objective-card.viewmodel';
import type {
  AreteStageViewModel,
  ObjectiveDetailViewModel,
  StageTaskProgressViewModel,
  StageTaskViewModel,
  StageViewModel,
} from '../models/objective-detail.viewmodel';
import { quadrantOf } from './matrix.mapper';

/*
 * Les vues des écrans Objectifs et Arête, dérivées de l'état du store (cahier de migration, § 4).
 * Fonctions pures : l'heure courante se passe en paramètre (par défaut, maintenant).
 *
 * Vocabulaire : objectif = objectif racine (parentId null) ; étape = sous-objectif DIRECT, dans l'ordre
 * de chargement ; pas = tâche. Les pas des sous-objectifs plus profonds comptent dans leur étape.
 */

/** Le texte d'une étape sans pas. */
export const EMPTY_STAGE_DETAIL = "Aucun pas pour l'instant";

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

function allDone(tasks: readonly TaskViewModel[]): boolean {
  return tasks.length > 0 && tasks.every((task) => task.done);
}

/** Une étape est faite quand elle a au moins un pas et que tous ses pas sont faits. */
export function isStageDone(tasks: readonly TaskViewModel[]): boolean {
  return allDone(tasks);
}

/** Un objectif est accompli quand il a au moins un pas et que tous ses pas sont faits. */
export function isAccomplished(tasks: readonly TaskViewModel[]): boolean {
  return allDone(tasks);
}

/**
 * L'état de chaque étape, à partir de ses pas : « faite » (au moins un pas, tous faits),
 * « en-cours » pour la première étape non faite (une seule), « a-venir » pour les suivantes.
 */
export function stageStates(tasksByStage: readonly (readonly TaskViewModel[])[]): EtatEtape[] {
  let currentGiven = false;
  return tasksByStage.map((tasks) => {
    if (isStageDone(tasks)) return 'faite';
    if (!currentGiven) {
      currentGiven = true;
      return 'en-cours';
    }
    return 'a-venir';
  });
}

/**
 * L'état de chaque pas d'une étape : « fait », puis, dans l'étape en cours seulement, le premier pas
 * non fait est « en-cours » ; les autres pas non faits sont « a-venir ».
 */
export function taskStates(tasks: readonly TaskViewModel[], stageState: EtatEtape): EtatPas[] {
  let currentGiven = stageState !== 'en-cours';
  return tasks.map((task) => {
    if (task.done) return 'fait';
    if (!currentGiven) {
      currentGiven = true;
      return 'en-cours';
    }
    return 'a-venir';
  });
}

/** Ce qu'on compte à partir des états des pas : faits, un en cours, à venir. */
export function progressFromStates(states: readonly EtatPas[]): StageTaskProgressViewModel {
  return {
    done: states.filter((state) => state === 'fait').length,
    inProgress: states.includes('en-cours'),
    upcoming: states.filter((state) => state === 'a-venir').length,
  };
}

/** « 4 pas faits · 3 à venir » (legendeProgression d'Empreinte), ou le texte d'une étape vide. */
export function stageDetail(progress: StageTaskProgressViewModel): string {
  const legend = legendeProgression({
    faits: progress.done,
    enCours: progress.inProgress ? 1 : 0,
    aVenir: progress.upcoming,
  });
  return legend || EMPTY_STAGE_DETAIL;
}

/**
 * Le texte court sous le nom d'une étape, sur l'arête (Empreinte le coupe à 22 caractères) :
 * « 4 pas faits » pour l'étape en cours qui a avancé ; sinon l'état en toutes lettres
 * (« Faite », « En cours », « À venir »), laissé au composant.
 */
export function areteDetail(state: EtatEtape, progress: StageTaskProgressViewModel): string | undefined {
  if (state === 'en-cours' && progress.done > 0) return `${progress.done} pas ${progress.done >= 2 ? 'faits' : 'fait'}`;
  return undefined;
}

/** Le premier pas non fait de l'étape en cours, sinon le premier pas non fait de l'objectif. */
export function nextTaskOf(
  currentStageTasks: readonly TaskViewModel[] | null,
  objectiveTasks: readonly TaskViewModel[],
): NextTaskViewModel | null {
  const next = currentStageTasks?.find((task) => !task.done) ?? objectiveTasks.find((task) => !task.done);
  return next ? { id: next.id, title: next.title, done: next.done } : null;
}

function countTasks(tasks: readonly TaskViewModel[]): TaskCountViewModel {
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}

type StageWithTasks = {
  stage: ObjectiveViewModel;
  tasks: TaskViewModel[];
  state: EtatEtape;
};

/** Les étapes d'un objectif avec leurs pas (sous-objectifs profonds compris) et leur état. */
function stagesWithTasks(
  objectiveId: string,
  objectives: readonly ObjectiveViewModel[],
  tasks: readonly TaskViewModel[],
): StageWithTasks[] {
  const stages = stagesOf(objectiveId, objectives);
  const tasksByStage = stages.map((stage) => tasksInSubtree(stage.id, objectives, tasks));
  const states = stageStates(tasksByStage);
  return stages.map((stage, index) => ({ stage, tasks: tasksByStage[index], state: states[index] }));
}

/** La carte d'un objectif. */
export function toObjectiveCard(
  objective: ObjectiveViewModel,
  objectives: readonly ObjectiveViewModel[],
  tasks: readonly TaskViewModel[],
  now: Date = new Date(),
): ObjectiveCardViewModel {
  const stages = stagesWithTasks(objective.id, objectives, tasks);
  const objectiveTasks = tasksInSubtree(objective.id, objectives, tasks);
  const current = stages.find((item) => item.state === 'en-cours') ?? null;
  return {
    id: objective.id,
    title: objective.title,
    why: objective.why,
    horizon: formatHorizon(objective.dueDate, now),
    stageProgress: {
      done: stages.filter((item) => item.state === 'faite').length,
      inProgress: current !== null,
      upcoming: stages.filter((item) => item.state === 'a-venir').length,
      ...(current ? { inProgressName: current.stage.title } : {}),
    },
    stageCount: stages.length,
    taskCount: countTasks(objectiveTasks),
    nextTask: nextTaskOf(current?.tasks ?? null, objectiveTasks),
    accomplished: isAccomplished(objectiveTasks),
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

function toStageTasks(tasks: readonly TaskViewModel[], states: readonly EtatPas[]): StageTaskViewModel[] {
  return tasks.map((task, index) => ({
    id: task.id,
    title: task.title,
    done: task.done,
    state: states[index],
    importance: task.importance,
    urgency: task.urgency,
    objectiveId: task.objectiveId,
    quadrant: quadrantOf(task),
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

  const withTasks = stagesWithTasks(objectiveId, objectives, tasks);
  const stages: StageViewModel[] = withTasks.map(({ stage, tasks: stageTasks, state }, index) => {
    const states = taskStates(stageTasks, state);
    const progress = progressFromStates(states);
    return {
      id: stage.id,
      title: stage.title,
      description: stage.description,
      dueDate: stage.dueDate,
      horizon: formatHorizon(stage.dueDate, now),
      state,
      index: index + 1,
      tasks: toStageTasks(stageTasks, states),
      progress,
      detail: stageDetail(progress),
    };
  });

  const looseTasks = tasks.filter((task) => task.objectiveId === objectiveId);
  const objectiveTasks = tasksInSubtree(objectiveId, objectives, tasks);
  const current = withTasks.find((item) => item.state === 'en-cours') ?? null;

  const aretes: AreteStageViewModel[] = stages.map((stage) => {
    const detail = areteDetail(stage.state, stage.progress);
    return { id: stage.id, nom: stage.title, etat: stage.state, ...(detail ? { detail } : {}) };
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
    tasksWithoutStage: toStageTasks(looseTasks, looseTasks.map((task) => (task.done ? 'fait' : 'a-venir'))),
    aretes,
    defaultStageId: current?.stage.id ?? (stages.length > 0 ? stages[stages.length - 1].id : null),
    taskCount: countTasks(objectiveTasks),
    nextTask: nextTaskOf(current?.tasks ?? null, objectiveTasks),
    accomplished: isAccomplished(objectiveTasks),
  };
}

/** Les étapes d'un objectif pour e-selection : { valeur: id, libelle: titre }. */
export function stageOptions(objectiveId: string, objectives: readonly ObjectiveViewModel[]): OptionSelection<string>[] {
  return stagesOf(objectiveId, objectives).map((stage) => ({ valeur: stage.id, libelle: stage.title }));
}

/** Les objectifs racines pour e-filtres ou e-selection : { valeur: id, libelle: titre }. */
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

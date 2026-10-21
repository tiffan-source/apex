import type { ObjectiveViewModel, TaskViewModel } from '../models/objective.viewmodel';
import {
  EMPTY_STAGE_DETAIL,
  UNTITLED_STAGE,
  areteDetail,
  formatHorizon,
  isAccomplished,
  nextTaskOf,
  rootObjectiveOptions,
  stageDetail,
  stageIdFromArete,
  stageOptions,
  stageName,
  stageStates,
  taskStates,
  toObjectiveCard,
  toObjectiveCards,
  toObjectiveDetail,
} from './objective-view.mapper';

const NOW = new Date(2026, 9, 19); // lundi 19 octobre 2026

const objective = (id: string, title: string, parentId: string | null = null, dueDate = ''): ObjectiveViewModel => ({
  id,
  title,
  why: parentId ? '' : 'Pour me prouver que je peux tenir six mois.',
  description: '',
  dueDate,
  parentId,
});

let taskCounter = 0;
const task = (objectiveId: string, done: boolean, title?: string): TaskViewModel => {
  taskCounter += 1;
  return { id: `t${taskCounter}`, title: title ?? `Pas ${taskCounter}`, importance: 3, urgency: 3, done, objectiveId };
};

describe('formatHorizon', () => {
  it('écrit le mois seul pour l’année en cours', () => {
    expect(formatHorizon(new Date(2026, 4, 31).toISOString(), NOW)).toBe("Jusqu'en mai");
    expect(formatHorizon(new Date(2026, 7, 15), NOW)).toBe("Jusqu'en août");
  });

  it('ajoute l’année quand ce n’est pas l’année en cours', () => {
    expect(formatHorizon(new Date(2027, 4, 1).toISOString(), NOW)).toBe("Jusqu'en mai 2027");
    expect(formatHorizon(new Date(2025, 11, 1).toISOString(), NOW)).toBe("Jusqu'en décembre 2025");
  });

  it('reste vide sans échéance ou avec une date illisible', () => {
    expect(formatHorizon('', NOW)).toBe('');
    expect(formatHorizon(null, NOW)).toBe('');
    expect(formatHorizon(undefined, NOW)).toBe('');
    expect(formatHorizon('pas une date', NOW)).toBe('');
  });
});

describe('états des étapes', () => {
  it('faite (au moins un pas, tous faits), puis une seule en cours, puis à venir', () => {
    expect(
      stageStates([
        [task('a', true), task('a', true)],
        [task('b', true), task('b', false)],
        [task('c', false)],
        [],
      ]),
    ).toEqual(['faite', 'en-cours', 'a-venir', 'a-venir']);
  });

  it('une étape sans pas n’est pas faite : elle peut être en cours', () => {
    expect(stageStates([[], [task('b', false)]])).toEqual(['en-cours', 'a-venir']);
  });

  it('une étape faite reste faite même après l’étape en cours', () => {
    expect(stageStates([[task('a', false)], [task('b', true)]])).toEqual(['en-cours', 'faite']);
  });

  it('toutes faites : aucune en cours', () => {
    expect(stageStates([[task('a', true)], [task('b', true)]])).toEqual(['faite', 'faite']);
  });
});

describe('états des pas', () => {
  it('dans l’étape en cours, le premier pas non fait est en cours', () => {
    const tasks = [task('s', true), task('s', false), task('s', false)];
    expect(taskStates(tasks, 'en-cours')).toEqual(['fait', 'en-cours', 'a-venir']);
  });

  it('ailleurs, aucun pas n’est en cours', () => {
    const tasks = [task('s', false), task('s', true)];
    expect(taskStates(tasks, 'a-venir')).toEqual(['a-venir', 'fait']);
  });
});

describe('détails lisibles', () => {
  it('compte ce qui est fait d’abord (legendeProgression d’Empreinte)', () => {
    expect(stageDetail({ done: 4, inProgress: true, upcoming: 2 })).toBe('4 pas faits · 3 à venir');
    expect(stageDetail({ done: 4, inProgress: false, upcoming: 0 })).toBe('4 pas faits · étape accomplie');
    expect(stageDetail({ done: 0, inProgress: false, upcoming: 0 })).toBe(EMPTY_STAGE_DETAIL);
  });

  it('écrit sur l’arête un texte court, ou laisse l’état en toutes lettres au composant', () => {
    expect(areteDetail('en-cours', { done: 4, inProgress: true, upcoming: 3 })).toBe('4 pas faits');
    expect(areteDetail('en-cours', { done: 1, inProgress: true, upcoming: 0 })).toBe('1 pas fait');
    expect(areteDetail('en-cours', { done: 0, inProgress: true, upcoming: 3 })).toBeUndefined();
    expect(areteDetail('faite', { done: 4, inProgress: false, upcoming: 0 })).toBeUndefined();
    expect(areteDetail('a-venir', { done: 0, inProgress: false, upcoming: 2 })).toBeUndefined();
  });
});

describe('prochain pas et objectif accompli', () => {
  it('prend le premier pas non fait de l’étape en cours', () => {
    const stage = [task('s', true), task('s', false, 'Courir 8 km')];
    const all = [task('o', false, 'Acheter des chaussures'), ...stage];
    expect(nextTaskOf(stage, all)).toEqual({ id: stage[1].id, title: 'Courir 8 km', done: false });
  });

  it('sinon le premier pas non fait de l’objectif', () => {
    const all = [task('o', true), task('o', false, 'Acheter des chaussures')];
    expect(nextTaskOf(null, all)?.title).toBe('Acheter des chaussures');
    expect(nextTaskOf([], all)?.title).toBe('Acheter des chaussures');
  });

  it('null quand tout est fait', () => {
    expect(nextTaskOf(null, [task('o', true)])).toBeNull();
  });

  it('accompli : au moins un pas, et tous faits', () => {
    expect(isAccomplished([])).toBe(false);
    expect(isAccomplished([task('o', true), task('o', false)])).toBe(false);
    expect(isAccomplished([task('o', true), task('o', true)])).toBe(true);
  });
});

describe('cartes et vue détaillée', () => {
  const objectives = [
    objective('semi', 'Courir un semi-marathon en mai', null, new Date(2026, 4, 31).toISOString()),
    objective('programme', 'Programme', 'semi'),
    objective('endurance', 'Endurance', 'semi', new Date(2026, 10, 1).toISOString()),
    objective('sorties', 'Sorties longues', 'endurance'),
    objective('mental', 'Mental', 'semi'),
    objective('guitare', 'Jouer trois morceaux'),
  ];
  const programme = [task('programme', true), task('programme', true)];
  const endurance = [task('endurance', true), task('sorties', true), task('endurance', false, 'Sortie de 30 minutes')];
  const deep = [task('sorties', false, 'Courir 8 km')];
  const loose = [task('semi', false, 'Comparer des montres GPS')];
  const guitare = [task('guitare', true)];
  const tasks = [...loose, ...programme, ...endurance, ...deep, ...guitare];

  it('la carte compte les étapes, les pas, et nomme l’étape en cours', () => {
    const card = toObjectiveCard(objectives[0], objectives, tasks, NOW);
    expect(card).toEqual({
      id: 'semi',
      title: 'Courir un semi-marathon en mai',
      why: 'Pour me prouver que je peux tenir six mois.',
      horizon: "Jusqu'en mai",
      stageProgress: { done: 1, inProgress: true, upcoming: 1, inProgressName: 'Endurance' },
      stageCount: 3,
      taskCount: { done: 4, total: 7 },
      nextTask: { id: endurance[2].id, title: 'Sortie de 30 minutes', done: false },
      accomplished: false,
    });
  });

  it('sans étape en cours, la carte n’a pas de nom en cours', () => {
    const card = toObjectiveCard(objectives[5], objectives, tasks, NOW);
    expect(card.stageProgress).toEqual({ done: 0, inProgress: false, upcoming: 0 });
    expect(card.accomplished).toBe(true);
    expect(card.nextTask).toBeNull();
    expect(card.horizon).toBe('');
  });

  it('une carte par objectif racine, dans l’ordre de chargement', () => {
    expect(toObjectiveCards(objectives, tasks, NOW).map((card) => card.id)).toEqual(['semi', 'guitare']);
  });

  it('la vue détaillée donne les étapes directes, leurs pas (profonds compris) et leur état', () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(detail).toBeDefined();
    if (!detail) return;
    expect(detail.objective).toMatchObject({ id: 'semi', horizon: "Jusqu'en mai" });
    expect(detail.stages.map((stage) => [stage.id, stage.index, stage.state])).toEqual([
      ['programme', 1, 'faite'],
      ['endurance', 2, 'en-cours'],
      ['mental', 3, 'a-venir'],
    ]);

    const current = detail.stages[1];
    expect(current.horizon).toBe("Jusqu'en novembre");
    expect(current.tasks.map((item) => [item.title, item.state, item.objectiveId])).toEqual([
      [endurance[0].title, 'fait', 'endurance'],
      [endurance[1].title, 'fait', 'sorties'],
      ['Sortie de 30 minutes', 'en-cours', 'endurance'],
      ['Courir 8 km', 'a-venir', 'sorties'],
    ]);
    expect(current.progress).toEqual({ done: 2, inProgress: true, upcoming: 1 });
    expect(current.detail).toBe('2 pas faits · 2 à venir');
    expect(current.tasks[0].quadrant).toBe('maintenant');

    expect(detail.stages[0].detail).toBe('2 pas faits · étape accomplie');
    expect(detail.stages[2].detail).toBe(EMPTY_STAGE_DETAIL);
  });

  it('la vue détaillée isole les pas sans étape', () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(detail?.tasksWithoutStage.map((item) => [item.title, item.state])).toEqual([
      ['Comparer des montres GPS', 'a-venir'],
    ]);
  });

  it('prépare les étapes de <e-arete>, avec leur id, et l’étape ouverte par défaut', () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(detail?.aretes).toEqual([
      { id: 'programme', nom: 'Programme', etat: 'faite' },
      { id: 'endurance', nom: 'Endurance', etat: 'en-cours', detail: '2 pas faits' },
      { id: 'mental', nom: 'Mental', etat: 'a-venir' },
    ]);
    expect(detail?.defaultStageId).toBe('endurance');
    expect(detail?.taskCount).toEqual({ done: 4, total: 7 });
  });

  it('nomme sur l’arête une étape sans nom, sans toucher à son titre (la feuille « Modifier l’étape » le préremplit)', () => {
    const list = [objective('o', 'Objectif'), objective('e1', 'Une', 'o'), objective('e2', '', 'o'), objective('e3', '   ', 'o')];
    const detail = toObjectiveDetail('o', list, [], NOW);
    expect(detail?.aretes.map((arete) => arete.nom)).toEqual(['Une', UNTITLED_STAGE, UNTITLED_STAGE]);
    expect(detail?.stages.map((stage) => stage.title)).toEqual(['Une', '', '   ']);
    expect(stageName('  ')).toBe('Étape sans nom');
    expect(stageName(' Portfolio ')).toBe('Portfolio');
  });

  it('toutes les étapes faites : la dernière est ouverte ; aucune étape : null', () => {
    const done = [objective('o', 'Objectif'), objective('e1', 'Une', 'o'), objective('e2', 'Deux', 'o')];
    const doneTasks = [task('e1', true), task('e2', true)];
    expect(toObjectiveDetail('o', done, doneTasks, NOW)?.defaultStageId).toBe('e2');
    expect(toObjectiveDetail('o', done, doneTasks, NOW)?.stages.map((stage) => stage.state)).toEqual(['faite', 'faite']);
    expect(toObjectiveDetail('guitare', objectives, tasks, NOW)?.defaultStageId).toBeNull();
  });

  it('undefined pour un objectif inconnu', () => {
    expect(toObjectiveDetail('inconnu', objectives, tasks, NOW)).toBeUndefined();
  });

  it('les options des champs sont en { valeur, libelle }', () => {
    expect(stageOptions('semi', objectives)).toEqual([
      { valeur: 'programme', libelle: 'Programme' },
      { valeur: 'endurance', libelle: 'Endurance' },
      { valeur: 'mental', libelle: 'Mental' },
    ]);
    expect(rootObjectiveOptions(objectives)).toEqual([
      { valeur: 'semi', libelle: 'Courir un semi-marathon en mai' },
      { valeur: 'guitare', libelle: 'Jouer trois morceaux' },
    ]);
  });
});

describe('stageIdFromArete', () => {
  it('retrouve l’étape choisie sur l’arête, et rien pour l’arête repliée « Faites »', () => {
    expect(stageIdFromArete({ id: 'endurance', nom: 'Endurance', etat: 'en-cours' } as never)).toBe('endurance');
    expect(stageIdFromArete({ nom: 'Faites', etat: 'faite', detail: '9 étapes' })).toBeNull();
  });
});

describe('cas limites du cahier (§ 4)', () => {
  const pas = (id: string, objectiveId: string, done: boolean, importance = 3, urgency = 3): TaskViewModel => ({
    id, title: `Pas ${id}`, importance, urgency, done, objectiveId,
  });

  it('objectif sans étape : progression par étapes à zéro, ses pas comptent, le prochain pas est le premier non fait', () => {
    const objectives = [objective('o', 'Lire 12 livres')];
    const tasks = [pas('a', 'o', true), pas('b', 'o', false), pas('c', 'o', false)];
    const card = toObjectiveCard(objectives[0], objectives, tasks, NOW);
    expect(card).toMatchObject({
      stageProgress: { done: 0, inProgress: false, upcoming: 0 },
      stageCount: 0,
      taskCount: { done: 1, total: 3 },
      nextTask: { id: 'b' },
      accomplished: false,
    });
    expect(card.stageProgress.inProgressName).toBeUndefined();
    const detail = toObjectiveDetail('o', objectives, tasks, NOW);
    expect(detail).toMatchObject({ stages: [], aretes: [], defaultStageId: null });
    expect(detail?.tasksWithoutStage.map((item) => item.state)).toEqual(['fait', 'a-venir', 'a-venir']);
  });

  it('objectif sans étape ni pas : rien à faire, pas accompli', () => {
    const objectives = [objective('o', 'Vide')];
    expect(toObjectiveCard(objectives[0], objectives, [], NOW)).toMatchObject({
      taskCount: { done: 0, total: 0 }, nextTask: null, accomplished: false, horizon: '',
    });
  });

  it('étapes sans pas : la première est en cours, aucun prochain pas, pas accompli', () => {
    const objectives = [objective('o', 'Objectif'), objective('e1', 'Une', 'o'), objective('e2', 'Deux', 'o')];
    const card = toObjectiveCard(objectives[0], objectives, [], NOW);
    expect(card.stageProgress).toEqual({ done: 0, inProgress: true, upcoming: 1, inProgressName: 'Une' });
    expect(card.nextTask).toBeNull();
    expect(card.accomplished).toBe(false);
    const detail = toObjectiveDetail('o', objectives, [], NOW);
    expect(detail?.stages.map((stage) => [stage.state, stage.detail])).toEqual([
      ['en-cours', EMPTY_STAGE_DETAIL],
      ['a-venir', EMPTY_STAGE_DETAIL],
    ]);
    expect(detail?.aretes).toEqual([
      { id: 'e1', nom: 'Une', etat: 'en-cours' },
      { id: 'e2', nom: 'Deux', etat: 'a-venir' },
    ]);
    expect(detail?.defaultStageId).toBe('e1');
  });

  it('une étape vide en cours : le prochain pas est le premier non fait de l’objectif', () => {
    const objectives = [objective('o', 'O'), objective('e1', 'Une', 'o'), objective('e2', 'Vide', 'o'), objective('e3', 'Trois', 'o')];
    const tasks = [pas('a', 'e1', true), pas('b', 'e3', false), pas('c', 'o', false)];
    const card = toObjectiveCard(objectives[0], objectives, tasks, NOW);
    expect(card.stageProgress).toEqual({ done: 1, inProgress: true, upcoming: 1, inProgressName: 'Vide' });
    expect(card.nextTask?.id).toBe('b');
  });

  it('toutes les étapes faites mais un pas sans étape à faire : aucune en cours, pas accompli', () => {
    const objectives = [objective('o', 'O'), objective('e1', 'Une', 'o'), objective('e2', 'Deux', 'o')];
    const tasks = [pas('a', 'e1', true), pas('b', 'e2', true), pas('c', 'o', false)];
    const card = toObjectiveCard(objectives[0], objectives, tasks, NOW);
    expect(card.stageProgress).toEqual({ done: 2, inProgress: false, upcoming: 0 });
    expect(card.nextTask?.id).toBe('c');
    expect(card.accomplished).toBe(false);
    const detail = toObjectiveDetail('o', objectives, tasks, NOW);
    expect(detail?.defaultStageId).toBe('e2');
    expect(detail?.aretes.map((arete) => arete.etat)).toEqual(['faite', 'faite']);
  });

  it('tout fait, étapes et pas sans étape : accompli, sans prochain pas', () => {
    const objectives = [objective('o', 'O'), objective('e1', 'Une', 'o')];
    const tasks = [pas('a', 'e1', true), pas('c', 'o', true)];
    expect(toObjectiveCard(objectives[0], objectives, tasks, NOW)).toMatchObject({
      stageProgress: { done: 1, inProgress: false, upcoming: 0 }, nextTask: null, accomplished: true,
    });
  });

  it('sous-objectifs sur trois niveaux sous une étape : leurs pas comptent dans l’étape de premier niveau', () => {
    const objectives = [
      objective('o', 'O'),
      objective('e1', 'Étape', 'o'),
      objective('s1', 'Sous', 'e1'),
      objective('ss1', 'Sous-sous', 's1'),
      objective('sss1', 'Sous-sous-sous', 'ss1'),
      objective('e2', 'Suivante', 'o'),
    ];
    const tasks = [pas('a', 'sss1', true), pas('b', 'ss1', false), pas('c', 's1', true), pas('d', 'e1', false), pas('e', 'e2', false)];
    const detail = toObjectiveDetail('o', objectives, tasks, NOW);
    expect(detail?.stages.map((stage) => stage.id)).toEqual(['e1', 'e2']);
    expect(detail?.stages[0].tasks.map((item) => [item.id, item.objectiveId, item.state])).toEqual([
      ['a', 'sss1', 'fait'],
      ['b', 'ss1', 'en-cours'],
      ['c', 's1', 'fait'],
      ['d', 'e1', 'a-venir'],
    ]);
    expect(detail?.stages[0].progress).toEqual({ done: 2, inProgress: true, upcoming: 1 });
    expect(detail?.tasksWithoutStage).toEqual([]);
    expect(detail?.taskCount).toEqual({ done: 2, total: 5 });
    expect(toObjectiveCard(objectives[0], objectives, tasks, NOW).nextTask?.id).toBe('b');
    expect(stageOptions('o', objectives).map((option) => option.valeur)).toEqual(['e1', 'e2']);
    expect(toObjectiveCards(objectives, tasks, NOW).map((card) => card.id)).toEqual(['o']);
  });

  it('les pas posés sur l’objectif ne comptent dans aucune étape', () => {
    const objectives = [objective('o', 'O'), objective('e1', 'Une', 'o')];
    const tasks = [pas('loose', 'o', false), pas('a', 'e1', true)];
    const detail = toObjectiveDetail('o', objectives, tasks, NOW);
    expect(detail?.stages[0].tasks.map((item) => item.id)).toEqual(['a']);
    expect(detail?.stages[0].state).toBe('faite');
    expect(detail?.tasksWithoutStage.map((item) => item.id)).toEqual(['loose']);
    expect(detail?.taskCount).toEqual({ done: 1, total: 2 });
  });

  it('horizon : sans date, année en cours, autre année (avant ou après)', () => {
    const at = (iso: string) => toObjectiveCard(objective('o', 'O', null, iso), [objective('o', 'O', null, iso)], [], NOW).horizon;
    expect(at('')).toBe('');
    expect(at(new Date(2026, 11, 31).toISOString())).toBe("Jusqu'en décembre");
    expect(at(new Date(2027, 0, 1).toISOString())).toBe("Jusqu'en janvier 2027");
    expect(at(new Date(2025, 0, 15).toISOString())).toBe("Jusqu'en janvier 2025");
  });

  it('ids temporaires : un objectif, une étape et un pas optimistes sont montrés comme les autres', () => {
    const objectives = [objective('temp-id-o', 'Nouvel objectif'), objective('temp-id-e', 'Nouvelle étape', 'temp-id-o')];
    const tasks = [pas('temp-id-p', 'temp-id-e', false, 4, 1)];
    expect(toObjectiveCards(objectives, tasks, NOW)[0]).toMatchObject({
      id: 'temp-id-o',
      stageProgress: { done: 0, inProgress: true, upcoming: 0, inProgressName: 'Nouvelle étape' },
      nextTask: { id: 'temp-id-p' },
    });
    const detail = toObjectiveDetail('temp-id-o', objectives, tasks, NOW);
    expect(detail?.defaultStageId).toBe('temp-id-e');
    expect(detail?.stages[0].tasks[0]).toMatchObject({ id: 'temp-id-p', quadrant: 'planifier', state: 'en-cours' });
  });
});

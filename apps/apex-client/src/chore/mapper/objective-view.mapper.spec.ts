import type { ObjectiveViewModel, TaskViewModel } from '../models/objective.viewmodel';
import {
  ARETE_STAGE_STATE,
  EMPTY_STAGE_DETAIL,
  NO_TASK,
  UNTITLED_STAGE,
  formatHorizon,
  rootObjectiveOptions,
  stageDetail,
  stageIdFromArete,
  stageOptions,
  stageName,
  toObjectiveCard,
  toObjectiveCards,
  toObjectiveDetail,
} from './objective-view.mapper';

/*
 * Les vues des écrans rangent et mettent en forme ce que l'API rend. Elles ne calculent aucune règle
 * métier : ni étape faite ou en cours, ni prochain pas, ni objectif accompli, ni quadrant.
 */

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

describe('stageDetail', () => {
  it('dit ce qu’une étape porte, sans rien en déduire', () => {
    expect(stageDetail(3)).toBe('3 pas');
    expect(stageDetail(1)).toBe('1 pas');
    expect(stageDetail(0)).toBe(EMPTY_STAGE_DETAIL);
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

  it('la carte dit l’objectif et ce qu’il porte, sans progression', () => {
    expect(toObjectiveCard(objectives[0], objectives, tasks, NOW)).toEqual({
      id: 'semi',
      title: 'Courir un semi-marathon en mai',
      why: 'Pour me prouver que je peux tenir six mois.',
      horizon: "Jusqu'en mai",
      stageCount: 3,
      taskCount: 7,
    });
  });

  it('un objectif dont tous les pas sont faits reste une carte comme les autres', () => {
    expect(toObjectiveCard(objectives[5], objectives, tasks, NOW)).toEqual({
      id: 'guitare',
      title: 'Jouer trois morceaux',
      why: 'Pour me prouver que je peux tenir six mois.',
      horizon: '',
      stageCount: 0,
      taskCount: 1,
    });
  });

  it('une carte par objectif racine, dans l’ordre de chargement', () => {
    expect(toObjectiveCards(objectives, tasks, NOW).map((card) => card.id)).toEqual(['semi', 'guitare']);
  });

  it('la vue détaillée donne les étapes directes et leurs pas (profonds compris), sans état', () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(detail).toBeDefined();
    if (!detail) return;
    expect(detail.objective).toMatchObject({ id: 'semi', horizon: "Jusqu'en mai" });
    expect(detail.stages.map((stage) => [stage.id, stage.index, stage.detail])).toEqual([
      ['programme', 1, '2 pas'],
      ['endurance', 2, '4 pas'],
      ['mental', 3, EMPTY_STAGE_DETAIL],
    ]);

    const second = detail.stages[1];
    expect(second.horizon).toBe("Jusqu'en novembre");
    expect(second.tasks).toEqual([
      { id: endurance[0].id, title: endurance[0].title, done: true, importance: 3, urgency: 3, objectiveId: 'endurance' },
      { id: endurance[1].id, title: endurance[1].title, done: true, importance: 3, urgency: 3, objectiveId: 'sorties' },
      { id: endurance[2].id, title: 'Sortie de 30 minutes', done: false, importance: 3, urgency: 3, objectiveId: 'endurance' },
      { id: deep[0].id, title: 'Courir 8 km', done: false, importance: 3, urgency: 3, objectiveId: 'sorties' },
    ]);
    expect(detail.taskCount).toBe(7);
  });

  it('la vue détaillée isole les pas sans étape', () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(detail?.tasksWithoutStage.map((item) => [item.title, item.done])).toEqual([['Comparer des montres GPS', false]]);
  });

  it('prépare l’arête sans état : toutes les étapes pareilles, et ce qu’elles portent sous leur nom', () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(detail?.aretes).toEqual([
      { id: 'programme', nom: 'Programme', etat: ARETE_STAGE_STATE, detail: '2 pas' },
      { id: 'endurance', nom: 'Endurance', etat: ARETE_STAGE_STATE, detail: '4 pas' },
      { id: 'mental', nom: 'Mental', etat: ARETE_STAGE_STATE, detail: NO_TASK },
    ]);
  });

  it('ouvre la première étape par défaut ; aucune étape : null', () => {
    expect(toObjectiveDetail('semi', objectives, tasks, NOW)?.defaultStageId).toBe('programme');
    expect(toObjectiveDetail('guitare', objectives, tasks, NOW)?.defaultStageId).toBeNull();
  });

  it('nomme sur l’arête une étape sans nom, sans toucher à son titre (la feuille « Modifier l’étape » le préremplit)', () => {
    const list = [objective('o', 'Objectif'), objective('e1', 'Une', 'o'), objective('e2', '', 'o'), objective('e3', '   ', 'o')];
    const detail = toObjectiveDetail('o', list, [], NOW);
    expect(detail?.aretes.map((arete) => arete.nom)).toEqual(['Une', UNTITLED_STAGE, UNTITLED_STAGE]);
    expect(detail?.stages.map((stage) => stage.title)).toEqual(['Une', '', '   ']);
    expect(stageName('  ')).toBe('Étape sans nom');
    expect(stageName(' Portfolio ')).toBe('Portfolio');
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
  it('retrouve l’étape choisie sur l’arête, et rien pour une arête formée par Empreinte', () => {
    expect(stageIdFromArete({ id: 'endurance', nom: 'Endurance', etat: 'a-venir' } as never)).toBe('endurance');
    expect(stageIdFromArete({ nom: 'Faites', etat: 'faite', detail: '9 étapes' })).toBeNull();
  });
});

describe('cas limites du cahier (§ 4)', () => {
  const pas = (id: string, objectiveId: string, done: boolean, importance = 3, urgency = 3): TaskViewModel => ({
    id, title: `Pas ${id}`, importance, urgency, done, objectiveId,
  });

  it('objectif sans étape : ses pas sont tous « sans étape »', () => {
    const objectives = [objective('o', 'Lire 12 livres')];
    const tasks = [pas('a', 'o', true), pas('b', 'o', false), pas('c', 'o', false)];
    expect(toObjectiveCard(objectives[0], objectives, tasks, NOW)).toMatchObject({ stageCount: 0, taskCount: 3 });
    const detail = toObjectiveDetail('o', objectives, tasks, NOW);
    expect(detail).toMatchObject({ stages: [], aretes: [], defaultStageId: null, taskCount: 3 });
    expect(detail?.tasksWithoutStage.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('objectif sans étape ni pas', () => {
    const objectives = [objective('o', 'Vide')];
    expect(toObjectiveCard(objectives[0], objectives, [], NOW)).toMatchObject({ stageCount: 0, taskCount: 0, horizon: '' });
  });

  it('des étapes dont tous les pas sont faits ne sont ni « faites » ni repliées : l’API ne le dit pas encore', () => {
    const objectives = [objective('o', 'O'), objective('e1', 'Une', 'o'), objective('e2', 'Deux', 'o')];
    const tasks = [pas('a', 'e1', true), pas('b', 'e2', true)];
    const detail = toObjectiveDetail('o', objectives, tasks, NOW);
    expect(detail?.aretes.map((arete) => arete.etat)).toEqual([ARETE_STAGE_STATE, ARETE_STAGE_STATE]);
    expect(detail?.defaultStageId).toBe('e1');
  });

  it('sous-objectifs sur trois niveaux sous une étape : leurs pas sont rangés dans l’étape de premier niveau', () => {
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
    expect(detail?.stages[0].tasks.map((item) => [item.id, item.objectiveId])).toEqual([
      ['a', 'sss1'],
      ['b', 'ss1'],
      ['c', 's1'],
      ['d', 'e1'],
    ]);
    expect(detail?.tasksWithoutStage).toEqual([]);
    expect(detail?.taskCount).toBe(5);
    expect(stageOptions('o', objectives).map((option) => option.valeur)).toEqual(['e1', 'e2']);
    expect(toObjectiveCards(objectives, tasks, NOW).map((card) => card.id)).toEqual(['o']);
  });

  it('les pas posés sur l’objectif ne sont dans aucune étape', () => {
    const objectives = [objective('o', 'O'), objective('e1', 'Une', 'o')];
    const tasks = [pas('loose', 'o', false), pas('a', 'e1', true)];
    const detail = toObjectiveDetail('o', objectives, tasks, NOW);
    expect(detail?.stages[0].tasks.map((item) => item.id)).toEqual(['a']);
    expect(detail?.tasksWithoutStage.map((item) => item.id)).toEqual(['loose']);
    expect(detail?.taskCount).toBe(2);
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
    expect(toObjectiveCards(objectives, tasks, NOW)[0]).toMatchObject({ id: 'temp-id-o', stageCount: 1, taskCount: 1 });
    const detail = toObjectiveDetail('temp-id-o', objectives, tasks, NOW);
    expect(detail?.defaultStageId).toBe('temp-id-e');
    expect(detail?.stages[0].tasks[0]).toMatchObject({ id: 'temp-id-p', importance: 4, urgency: 1 });
  });
});

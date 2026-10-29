import { QUADRANTS, type Quadrant } from '@empreinte-studio/angular/matrice';
import type { ObjectiveViewModel, TaskViewModel } from '../models/objective.viewmodel';
import { filterMatrixByObjective, levelsForQuadrant, quadrantOf, toMatrix } from './matrix.mapper';

const objective = (id: string, title: string, parentId: string | null = null): ObjectiveViewModel => ({
  id,
  title,
  why: '',
  description: '',
  dueDate: '',
  parentId,
});

const task = (id: string, objectiveId: string, importance: number, urgency: number, done = false): TaskViewModel => ({
  id,
  title: `Pas ${id}`,
  importance,
  urgency,
  done,
  objectiveId,
});

describe('matrix.mapper', () => {
  describe('quadrantOf (seuil 3)', () => {
    it.each([
      [3, 3, 'maintenant'],
      [5, 4, 'maintenant'],
      [3, 2, 'planifier'],
      [4, 1, 'planifier'],
      [2, 3, 'confier'],
      [1, 5, 'confier'],
      [2, 2, 'laisser-filer'],
      [1, 1, 'laisser-filer'],
    ] as const)('importance %i, urgence %i → %s', (importance, urgency, quadrant) => {
      expect(quadrantOf({ importance, urgency })).toBe(quadrant);
    });
  });

  describe('levelsForQuadrant', () => {
    it('vers « maintenant » : une valeur sous 3 passe à 3, le reste ne bouge pas', () => {
      expect(levelsForQuadrant({ importance: 1, urgency: 2 }, 'maintenant')).toEqual({ importance: 3, urgency: 3 });
      expect(levelsForQuadrant({ importance: 5, urgency: 1 }, 'maintenant')).toEqual({ importance: 5, urgency: 3 });
      expect(levelsForQuadrant({ importance: 4, urgency: 5 }, 'maintenant')).toEqual({ importance: 4, urgency: 5 });
    });

    it('vers « planifier » : important (≥ 3), pas urgent (≥ 3 passe à 2)', () => {
      expect(levelsForQuadrant({ importance: 5, urgency: 5 }, 'planifier')).toEqual({ importance: 5, urgency: 2 });
      expect(levelsForQuadrant({ importance: 2, urgency: 1 }, 'planifier')).toEqual({ importance: 3, urgency: 1 });
    });

    it('vers « confier » : secondaire, urgent', () => {
      expect(levelsForQuadrant({ importance: 4, urgency: 2 }, 'confier')).toEqual({ importance: 2, urgency: 3 });
      expect(levelsForQuadrant({ importance: 1, urgency: 4 }, 'confier')).toEqual({ importance: 1, urgency: 4 });
    });

    it('vers « laisser filer » : une valeur de 3 ou plus passe à 2, une valeur plus basse reste', () => {
      expect(levelsForQuadrant({ importance: 3, urgency: 5 }, 'laisser-filer')).toEqual({ importance: 2, urgency: 2 });
      expect(levelsForQuadrant({ importance: 1, urgency: 2 }, 'laisser-filer')).toEqual({ importance: 1, urgency: 2 });
    });

    it('un pas déjà dans le quadrant ne change pas', () => {
      expect(levelsForQuadrant({ importance: 4, urgency: 1 }, 'planifier')).toEqual({ importance: 4, urgency: 1 });
    });

    it('le pas déplacé arrive toujours dans le quadrant demandé (tous niveaux de 1 à 5)', () => {
      for (const quadrant of QUADRANTS)
        for (let importance = 1; importance <= 5; importance++)
          for (let urgency = 1; urgency <= 5; urgency++)
            expect(quadrantOf(levelsForQuadrant({ importance, urgency }, quadrant))).toBe(quadrant);
    });
  });

  describe('toMatrix', () => {
    const objectives = [
      objective('semi', 'Courir un semi-marathon'),
      objective('endurance', 'Endurance', 'semi'),
      objective('sorties', 'Sorties longues', 'endurance'),
      objective('licence', 'Valider ma licence'),
    ];
    const tasks = [
      task('t1', 'semi', 4, 4),
      task('t2', 'endurance', 4, 1, true),
      task('t3', 'sorties', 1, 4),
      task('t4', 'licence', 1, 1),
    ];

    it('range chaque pas dans son quadrant, dans l’ordre de chargement', () => {
      const matrix = toMatrix(objectives, tasks);
      const ids = (quadrant: Quadrant) => matrix[quadrant].map((item) => item.id);
      expect(ids('maintenant')).toEqual(['t1']);
      expect(ids('planifier')).toEqual(['t2']);
      expect(ids('confier')).toEqual(['t3']);
      expect(ids('laisser-filer')).toEqual(['t4']);
    });

    it('donne à chaque pas son objectif racine et son étape (sous-objectif direct de la racine)', () => {
      const matrix = toMatrix(objectives, tasks);
      expect(matrix.maintenant[0]).toMatchObject({
        rootObjectiveId: 'semi',
        rootObjectiveTitle: 'Courir un semi-marathon',
        stageId: null,
        stageTitle: null,
        quadrant: 'maintenant',
      });
      expect(matrix.planifier[0]).toMatchObject({ rootObjectiveId: 'semi', stageId: 'endurance', stageTitle: 'Endurance', done: true });
      // Un pas d'un sous-objectif plus profond compte dans son étape de premier niveau
      expect(matrix.confier[0]).toMatchObject({ rootObjectiveId: 'semi', stageId: 'endurance', stageTitle: 'Endurance' });
    });

    it('un pas d’un sous-sous-sous-objectif garde l’étape de premier niveau ; les ids temporaires suivent', () => {
      const deep = [
        objective('temp-id-o', 'Nouvel objectif'),
        objective('e1', 'Étape', 'temp-id-o'),
        objective('s1', 'Sous', 'e1'),
        objective('ss1', 'Sous-sous', 's1'),
        objective('sss1', 'Sous-sous-sous', 'ss1'),
      ];
      const matrix = toMatrix(deep, [task('temp-id-p', 'sss1', 5, 5), task('loose', 'temp-id-o', 1, 1)]);
      expect(matrix.maintenant[0]).toMatchObject({
        id: 'temp-id-p', rootObjectiveId: 'temp-id-o', rootObjectiveTitle: 'Nouvel objectif', stageId: 'e1', stageTitle: 'Étape',
      });
      expect(matrix['laisser-filer'][0]).toMatchObject({ id: 'loose', rootObjectiveId: 'temp-id-o', stageId: null, stageTitle: null });
      expect(filterMatrixByObjective(matrix, 'temp-id-o').maintenant).toHaveLength(1);
    });

    it('filtre par objectif racine, ou garde tout avec null', () => {
      const matrix = toMatrix(objectives, tasks);
      const semi = filterMatrixByObjective(matrix, 'semi');
      expect(semi.maintenant).toHaveLength(1);
      expect(semi['laisser-filer']).toHaveLength(0);
      expect(filterMatrixByObjective(matrix, null)).toBe(matrix);
    });
  });
});

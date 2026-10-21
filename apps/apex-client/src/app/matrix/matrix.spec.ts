import { LOCALE_ID, computed, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { motsAEviter } from '@empreinte-studio/angular/core';
import { EMatrice, QUADRANTS, TITRES_QUADRANTS, type Quadrant } from '@empreinte-studio/angular/matrice';
import { EMenu } from '@empreinte-studio/angular/menu';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { filterMatrixByObjective, levelsForQuadrant, toMatrix } from '../../chore/mapper/matrix.mapper';
import { rootObjectiveOptions } from '../../chore/mapper/objective-view.mapper';
import { voiceIssues } from '../../chore/constants/messages.constante';
import type { ObjectiveViewModel, TaskViewModel } from '../../chore/models/objective.viewmodel';
import type { MatrixTaskViewModel } from '../../chore/models/matrix.viewmodel';
import { MATRIX_DRAG_CONFIG, Matrix, SHORT_TITLE_MAX, shortTitle } from './matrix';

registerLocaleData(localeFr);

const objective = (id: string, title: string, parentId: string | null = null): ObjectiveViewModel => ({
  id,
  title,
  why: '',
  description: '',
  dueDate: '',
  parentId,
});

const task = (
  id: string,
  title: string,
  objectiveId: string,
  importance: number,
  urgency: number,
  done = false,
): TaskViewModel => ({ id, title, objectiveId, importance, urgency, done });

/** Trois objectifs racines, deux étapes, cinq pas (un fait), un dans chaque quadrant au moins. */
const OBJECTIVES: ObjectiveViewModel[] = [
  objective('o1', 'Courir un semi-marathon en mai'),
  objective('s1', 'Endurance', 'o1'),
  objective('o2', 'Licence'),
  objective('s2', 'Statistiques', 'o2'),
  objective('o3', 'Guitare'),
];

const TASKS: TaskViewModel[] = [
  task('t1', 'Sortie de 30 minutes en endurance', 's1', 4, 4),
  task('t2', 'Réviser le chapitre 4', 's2', 3, 3, true),
  task('t3', 'Courir 8 km', 's1', 4, 1),
  task('t4', 'Enchaîner le couplet du deuxième morceau', 'o3', 1, 4),
  task('t5', 'Recopier mes fiches au propre', 's2', 1, 1),
];

/** Un ObjectiveStore simulé : les vues viennent des vrais mappers, les actions sont espionnées. */
function createFakeStore(objectives: ObjectiveViewModel[] = OBJECTIVES, tasks: TaskViewModel[] = TASKS) {
  const state = signal({ objectives, tasks });
  const matrix = computed(() => toMatrix(state().objectives, state().tasks));
  return {
    state,
    objectiveOptions: computed(() => rootObjectiveOptions(state().objectives)),
    matrix,
    matrixFor: vi.fn((rootObjectiveId: string | null) => filterMatrixByObjective(matrix(), rootObjectiveId)),
    isFulfilled: signal(true),
    updateTaskDone: vi.fn(),
    moveTaskToQuadrant: vi.fn(),
  };
}

type FakeStore = ReturnType<typeof createFakeStore>;

describe('Matrix', () => {
  let store: FakeStore;
  let fixture: ComponentFixture<Matrix>;
  let element: HTMLElement;

  async function render(fake: FakeStore = createFakeStore()): Promise<void> {
    store = fake;
    await TestBed.configureTestingModule({
      imports: [Matrix],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'fr' },
        { provide: ObjectiveStore, useValue: store },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Matrix);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const text = (node: Element | null | undefined) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const all = (selector: string) => Array.from(element.querySelectorAll<HTMLElement>(selector));
  const repere = () => text(element.querySelector('header p.repere'));
  const quadrantSection = (quadrant: Quadrant) =>
    all('section.e-quadrant').find((section) => text(section.querySelector('h3')) === TITRES_QUADRANTS[quadrant]);
  const taskLabels = (quadrant: Quadrant) => Array.from(quadrantSection(quadrant)?.querySelectorAll('label') ?? []).map(text);
  const checkbox = (taskId: string) => element.querySelector<HTMLInputElement>(`#matrix-task-${taskId}`);
  const label = (taskId: string) => element.querySelector<HTMLLabelElement>(`label[for="matrix-task-${taskId}"]`);
  const filterButtons = () => all('e-filtres button');
  const matriceInstance = () => fixture.debugElement.query(By.directive(EMatrice)).componentInstance as EMatrice<MatrixTaskViewModel>;
  const taskOf = (taskId: string): MatrixTaskViewModel => {
    const found = QUADRANTS.flatMap((quadrant) => store.matrix()[quadrant]).find((item) => item.id === taskId);
    if (!found) throw new Error(`Pas introuvable : ${taskId}`);
    return found;
  };

  beforeEach(() => {
    // Lundi 19 octobre 2026, seule l'horloge de Date est simulée.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 19, 9, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('.cdk-overlay-container').forEach((overlay) => overlay.remove());
  });

  describe('en-tête', () => {
    beforeEach(() => render());

    it('donne la date du jour et le nombre de pas, puis le manifeste « La matrice »', () => {
      expect(repere()).toBe('Lundi 19 octobre · 5 pas');
      expect(text(element.querySelector('h1.manifeste'))).toBe('La matrice');
    });

    it('propose « Tous les objectifs » puis un filtre par objectif racine, au titre court', () => {
      expect(filterButtons().map(text)).toEqual([
        'Tous les objectifs',
        shortTitle('Courir un semi-marathon en mai'),
        'Licence',
        'Guitare',
      ]);
      expect(filterButtons()[0].getAttribute('aria-pressed')).toBe('true');
      expect(element.querySelector('e-filtres [aria-label="Filtrer par objectif"]')).not.toBeNull();
    });
  });

  describe('la matrice', () => {
    beforeEach(() => render());

    it('pose les titres et les axes d’Empreinte, et compte les pas de chaque quadrant', () => {
      expect(all('h3.e-quadrant__titre').map(text)).toEqual(['Maintenant', 'À planifier', 'À confier', 'À laisser filer']);
      expect(all('.e-matrice__axe').map(text)).toEqual(['Urgent', 'Pas urgent', 'Important', 'Secondaire']);
      expect(all('.e-quadrant__compte').map(text)).toEqual(['2 pas', '1 pas', '1 pas', '1 pas']);
    });

    it('met la corne et aria-current sur le seul quadrant « Maintenant »', () => {
      const current = all('section.e-quadrant[aria-current="true"]');
      expect(current).toHaveLength(1);
      expect(text(current[0].querySelector('h3'))).toBe('Maintenant');
      expect(current[0].classList.contains('e-corne')).toBe(true);
    });

    it('range chaque pas avec sa case, son titre en label, et « objectif · étape » en détail', () => {
      expect(taskLabels('maintenant')).toEqual(['Sortie de 30 minutes en endurance', 'Réviser le chapitre 4']);
      expect(taskLabels('planifier')).toEqual(['Courir 8 km']);
      expect(taskLabels('confier')).toEqual(['Enchaîner le couplet du deuxième morceau']);
      expect(taskLabels('laisser-filer')).toEqual(['Recopier mes fiches au propre']);

      const detailOf = (taskId: string) => text(label(taskId)?.parentElement?.querySelector('span.detail'));
      expect(detailOf('t1')).toBe('Courir un semi-marathon en mai · Endurance');
      expect(detailOf('t5')).toBe('Licence · Statistiques');
      // Un pas posé sur l'objectif, sans étape : l'objectif seul.
      expect(detailOf('t4')).toBe('Guitare');
    });

    it('garde les pas faits visibles, cochés, le titre en encre douce', () => {
      expect(checkbox('t2')?.checked).toBe(true);
      expect(label('t2')?.classList.contains('ds-muted')).toBe(true);
      expect(checkbox('t1')?.checked).toBe(false);
      expect(label('t1')?.classList.contains('ds-muted')).toBe(false);
    });

    it('relie chaque case à son titre, qui offre la cible', () => {
      for (const id of ['t1', 't2', 't3', 't4', 't5']) {
        expect(checkbox(id)?.type).toBe('checkbox');
        expect(label(id)).not.toBeNull();
      }
    });

    it('cocher ou décocher un pas passe par la mise à jour optimiste du store', () => {
      checkbox('t1')?.click();
      expect(store.updateTaskDone).toHaveBeenCalledWith({ taskId: 't1', done: true });

      checkbox('t2')?.click();
      expect(store.updateTaskDone).toHaveBeenCalledWith({ taskId: 't2', done: false });
    });

    it('un pas glissé vers un autre quadrant est déplacé par le store ; remis dans le même, rien ne part', () => {
      matriceInstance().deplacement.emit({ element: taskOf('t1'), de: 'maintenant', vers: 'planifier', index: 0 });
      expect(store.moveTaskToQuadrant).toHaveBeenCalledWith('t1', 'planifier');

      store.moveTaskToQuadrant.mockClear();
      matriceInstance().deplacement.emit({ element: taskOf('t1'), de: 'maintenant', vers: 'maintenant', index: 1 });
      expect(store.moveTaskToQuadrant).not.toHaveBeenCalled();
    });

    it('chaque pas a un menu « Déplacer vers… » nommé, avec les trois autres quadrants', () => {
      const menus = fixture.debugElement.queryAll(By.directive(EMenu));
      expect(menus).toHaveLength(5);

      const trigger = label('t1')?.closest('li')?.querySelector<HTMLButtonElement>('e-menu button');
      expect(trigger?.getAttribute('aria-label')).toBe('Déplacer « Sortie de 30 minutes en endurance » vers…');

      const entries = (taskId: string) => {
        const host = label(taskId)?.closest('li')?.querySelector('e-menu');
        const menu = menus.find((debug) => debug.nativeElement === host)?.componentInstance as EMenu<Quadrant>;
        return menu.entrees().map((entry) => ('libelle' in entry ? entry.libelle : '—'));
      };
      expect(entries('t1')).toEqual(['À planifier', 'À confier', 'À laisser filer']);
      expect(entries('t3')).toEqual(['Maintenant', 'À confier', 'À laisser filer']);
      expect(entries('t4')).toEqual(['Maintenant', 'À planifier', 'À laisser filer']);
      expect(entries('t5')).toEqual(['Maintenant', 'À planifier', 'À confier']);
    });

    it('choisir un quadrant dans le menu y déplace le pas', async () => {
      const trigger = label('t1')?.closest('li')?.querySelector<HTMLButtonElement>('e-menu button');
      trigger?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const items = Array.from(document.querySelectorAll<HTMLElement>('.e-menu__element'));
      expect(items.map(text)).toEqual(['À planifier', 'À confier', 'À laisser filer']);

      items[1].click();
      fixture.detectChanges();
      expect(store.moveTaskToQuadrant).toHaveBeenCalledWith('t1', 'confier');
    });

    it('au toucher, un pas ne se saisit qu’après un appui (le doigt fait défiler la page) ; à la souris, tout de suite', () => {
      const drags = fixture.debugElement.queryAll(By.directive(CdkDrag)).map((debug) => debug.injector.get(CdkDrag));
      expect(drags).toHaveLength(5);
      for (const drag of drags) expect(drag.dragStartDelay).toEqual({ touch: 300, mouse: 0 });
      expect(MATRIX_DRAG_CONFIG.dragStartDelay).toEqual({ touch: 300, mouse: 0 });
    });
  });

  describe('déplacer au clavier', () => {
    /** Un store dont le déplacement range vraiment le pas ailleurs, comme la mise à jour optimiste. */
    function movingStore(): FakeStore {
      const fake = createFakeStore();
      fake.moveTaskToQuadrant.mockImplementation((taskId: string, quadrant: Quadrant) =>
        fake.state.update(({ objectives, tasks }) => ({
          objectives,
          tasks: tasks.map((item) => (item.id === taskId ? { ...item, ...levelsForQuadrant(item, quadrant) } : item)),
        })),
      );
      return fake;
    }

    it('après « Déplacer vers… », le focus revient sur la case du pas, dans son nouveau quadrant', async () => {
      await render(movingStore());
      const trigger = label('t1')?.closest('li')?.querySelector<HTMLButtonElement>('e-menu button');
      trigger?.focus();
      trigger?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const items = Array.from(document.querySelectorAll<HTMLElement>('.e-menu__element'));
      items[1].click(); // À confier
      fixture.detectChanges();
      await fixture.whenStable();

      expect(store.moveTaskToQuadrant).toHaveBeenCalledWith('t1', 'confier');
      expect(taskLabels('maintenant')).toEqual(['Réviser le chapitre 4']);
      expect(taskLabels('confier')).toEqual(['Sortie de 30 minutes en endurance', 'Enchaîner le couplet du deuxième morceau']);
      // La ligne a été recréée ailleurs : le focus n'est pas resté sur un bouton disparu.
      expect(trigger?.isConnected).toBe(false);
      expect(document.activeElement).toBe(checkbox('t1'));
      expect(quadrantSection('confier')?.contains(document.activeElement)).toBe(true);
    });
  });

  describe('le filtre par objectif', () => {
    beforeEach(() => render());

    it('ne montre que les pas de l’objectif choisi, et les recompte', () => {
      filterButtons()[2].click(); // Licence
      fixture.detectChanges();

      expect(store.matrixFor).toHaveBeenLastCalledWith('o2');
      expect(filterButtons()[2].getAttribute('aria-pressed')).toBe('true');
      expect(taskLabels('maintenant')).toEqual(['Réviser le chapitre 4']);
      expect(taskLabels('planifier')).toEqual([]);
      expect(taskLabels('laisser-filer')).toEqual(['Recopier mes fiches au propre']);
      expect(repere()).toBe('Lundi 19 octobre · 2 pas');
      expect(all('.e-quadrant__compte').map(text)).toEqual(['1 pas', '0 pas', '0 pas', '1 pas']);
    });

    it('revient à tous les pas avec « Tous les objectifs »', () => {
      filterButtons()[3].click(); // Guitare
      fixture.detectChanges();
      expect(repere()).toBe('Lundi 19 octobre · 1 pas');

      filterButtons()[0].click();
      fixture.detectChanges();
      expect(store.matrixFor).toHaveBeenLastCalledWith(null);
      expect(repere()).toBe('Lundi 19 octobre · 5 pas');
    });

    it('retombe sur tous les objectifs quand l’objectif choisi n’existe plus', () => {
      filterButtons()[3].click(); // Guitare
      fixture.detectChanges();

      store.state.update(({ objectives, tasks }) => ({
        objectives: objectives.filter((item) => item.id !== 'o3'),
        tasks: tasks.filter((item) => item.objectiveId !== 'o3'),
      }));
      fixture.detectChanges();

      expect(store.matrixFor).toHaveBeenLastCalledWith(null);
      expect(repere()).toBe('Lundi 19 octobre · 4 pas');
      expect(filterButtons()[0].getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('états vides', () => {
    it('sans aucun pas : quatre quadrants à « 0 pas » et une invitation vers les objectifs', async () => {
      await render(createFakeStore([objective('o1', 'Licence')], []));

      expect(repere()).toBe('Lundi 19 octobre · 0 pas');
      expect(all('.e-quadrant__compte').map(text)).toEqual(['0 pas', '0 pas', '0 pas', '0 pas']);
      expect(all('.e-quadrant__element')).toHaveLength(0);
      expect(text(element.querySelector('p.corps'))).toBe(
        "Aucun pas pour l'instant. Ajoute des pas à tes objectifs : ils viendront se ranger ici.",
      );
      const link = element.querySelector<HTMLAnchorElement>('a[href="/"]');
      expect(text(link)).toBe('Voir mes objectifs');
    });

    it('un seul objectif : pas de rangée de filtres, filtrer ne changerait rien', async () => {
      await render(createFakeStore([objective('o1', 'Licence')], [task('t1', 'Réviser', 'o1', 4, 4)]));
      expect(element.querySelector('e-filtres')).toBeNull();
      expect(element.querySelector('p.corps')).toBeNull();
    });

    it('tant que les objectifs ne sont pas chargés : ni invitation, ni « 0 pas » dans le repère', async () => {
      const fake = createFakeStore([], []);
      fake.isFulfilled.set(false);
      await render(fake);
      expect(element.querySelector('p.corps')).toBeNull();
      expect(element.querySelector('e-filtres')).toBeNull();
      expect(repere()).toBe('Lundi 19 octobre');

      // Le chargement aboutit, sans aucun pas : le compte et l'invitation arrivent.
      fake.isFulfilled.set(true);
      fixture.detectChanges();
      expect(repere()).toBe('Lundi 19 octobre · 0 pas');
      expect(element.querySelector('p.corps')).not.toBeNull();
    });

    it('des pas déjà là comptent, même pendant qu’une autre écriture occupe le store', async () => {
      const fake = createFakeStore();
      fake.isFulfilled.set(false);
      await render(fake);
      expect(repere()).toBe('Lundi 19 octobre · 5 pas');
    });
  });

  describe('la voix', () => {
    it('aucun texte de l’écran ne sort de la voix d’Empreinte', async () => {
      await render();
      const texts = [
        text(element),
        ...all('[aria-label]').map((node) => node.getAttribute('aria-label') ?? ''),
        ...QUADRANTS.map((quadrant) => TITRES_QUADRANTS[quadrant]),
      ];
      // L'état vide a ses propres phrases.
      TestBed.resetTestingModule();
      await render(createFakeStore([], []));
      texts.push(text(element));

      for (const sentence of texts) {
        expect(motsAEviter(sentence), sentence).toEqual([]);
        expect(voiceIssues(sentence), sentence).toEqual([]);
      }
      expect(texts.join(' ')).not.toMatch(/Éliminer|Supprimer/i);
    });
  });
});

describe('shortTitle', () => {
  it('garde un titre court tel quel, sans espaces superflus', () => {
    expect(shortTitle('  Licence  ')).toBe('Licence');
    expect(shortTitle('Semi-marathon')).toBe('Semi-marathon');
  });

  it('coupe un titre long au dernier mot entier, avec « … »', () => {
    const short = shortTitle('Courir un semi-marathon en mai');
    expect(short).toBe('Courir un semi-marathon…');
    expect(short.length).toBeLessThanOrEqual(SHORT_TITLE_MAX);
  });

  it('coupe un mot trop long au milieu plutôt que de déborder', () => {
    const short = shortTitle('Anticonstitutionnellementissime et la suite');
    expect(short.length).toBeLessThanOrEqual(SHORT_TITLE_MAX);
    expect(short.endsWith('…')).toBe(true);
  });
});

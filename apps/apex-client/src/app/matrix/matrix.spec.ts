import { LOCALE_ID, computed, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { motsAEviter } from '@empreinte-studio/angular/core';
import { QUADRANTS, TITRES_QUADRANTS, type Quadrant } from '@empreinte-studio/angular/matrice';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { filterMatrixByObjective, toMatrix } from '../../chore/mapper/matrix.mapper';
import { rootObjectiveOptions } from '../../chore/mapper/objective-view.mapper';
import { voiceIssues } from '../../chore/constants/messages.constante';
import type { ObjectiveViewModel, TaskViewModel } from '../../chore/models/objective.viewmodel';
import { Matrix } from './matrix';

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
    objectivesLoaded: signal(true),
    error: signal<string | null>(null),
    updateTaskDone: vi.fn(),
  };
}

type FakeStore = ReturnType<typeof createFakeStore>;

/** AnnoncesStore simulé : les annonces sont espionnées, le signalement de la coque se règle. */
function createAnnonces() {
  return { annoncer: vi.fn(), aUnSignalement: signal(false) };
}

describe('Matrix', () => {
  let store: FakeStore;
  let annonces: ReturnType<typeof createAnnonces>;
  let fixture: ComponentFixture<Matrix>;
  let element: HTMLElement;

  async function render(fake: FakeStore = createFakeStore()): Promise<void> {
    store = fake;
    annonces = createAnnonces();
    await TestBed.configureTestingModule({
      imports: [Matrix],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'fr' },
        { provide: ObjectiveStore, useValue: store },
        { provide: AnnoncesStore, useValue: annonces },
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

  beforeEach(() => {
    // Lundi 19 octobre 2026, seule l'horloge de Date est simulée.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 19, 9, 0));
  });

  afterEach(() => vi.useRealTimers());

  describe('en-tête', () => {
    beforeEach(() => render());

    it('donne la date du jour et le nombre de pas, puis le manifeste « La matrice »', () => {
      expect(repere()).toBe('Lundi 19 octobre · 5 pas');
      expect(element.querySelector('header p.repere time')?.getAttribute('datetime')).toBe('2026-10-19');
      expect(text(element.querySelector('h1.manifeste'))).toBe('La matrice');
    });

    it('propose « Tous les objectifs » puis un filtre par objectif racine, au titre court', () => {
      expect(filterButtons().map(text)).toEqual([
        'Tous les objectifs',
        'Courir un semi-marathon…',
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
      expect(detailOf('t1')).toBe('Courir un semi-marathon en mai · étape Endurance');
      expect(detailOf('t5')).toBe('Licence · étape Statistiques');
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

    it('ne laisse déplacer aucun pas depuis la matrice : ni glisser-déposer, ni menu', () => {
      expect(element.querySelector('.cdk-drag, .cdk-drop-list')).toBeNull();
      expect(element.querySelector('e-menu')).toBeNull();
      expect(all('[aria-label*="Déplacer"]')).toEqual([]);
    });

    it('un pas change de quadrant quand son importance ou son urgence change, modifiées sur son objectif', () => {
      store.state.update(({ objectives, tasks }) => ({
        objectives,
        tasks: tasks.map((item) => (item.id === 't1' ? { ...item, importance: 2 } : item)),
      }));
      fixture.detectChanges();

      expect(taskLabels('maintenant')).toEqual(['Réviser le chapitre 4']);
      expect(taskLabels('confier')).toEqual(['Sortie de 30 minutes en endurance', 'Enchaîner le couplet du deuxième morceau']);
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

    it('annonce aux lecteurs d’écran l’objectif choisi, en entier, et ce qui reste dans la matrice', () => {
      filterButtons()[1].click(); // Courir un semi-marathon…
      fixture.detectChanges();
      expect(annonces.annoncer).toHaveBeenLastCalledWith('Courir un semi-marathon en mai · 2 pas');

      filterButtons()[0].click();
      fixture.detectChanges();
      expect(annonces.annoncer).toHaveBeenLastCalledWith('Tous les objectifs · 5 pas');
      expect(annonces.annoncer).toHaveBeenCalledTimes(2);
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

  describe('deux objectifs au début identique', () => {
    it('gardent des filtres aux noms différents : le nom du bouton est son seul nom', async () => {
      await render(
        createFakeStore(
          [objective('c1', "Préparer le concours d'entrée 2027"), objective('c2', "Préparer le concours d'entrée 2028")],
          [task('t1', 'Réviser', 'c1', 4, 4), task('t2', 'Réviser', 'c2', 4, 4)],
        ),
      );
      expect(filterButtons().map(text)).toEqual(['Tous les objectifs', 'Préparer le… 2027', 'Préparer le… 2028']);
    });
  });

  describe('états vides', () => {
    it('sans aucun pas : quatre quadrants à « 0 pas » et une invitation vers les objectifs', async () => {
      await render(createFakeStore([objective('o1', 'Licence')], []));

      expect(repere()).toBe('Lundi 19 octobre · 0 pas');
      expect(all('.e-quadrant__compte').map(text)).toEqual(['0 pas', '0 pas', '0 pas', '0 pas']);
      expect(all('.e-quadrant__element')).toHaveLength(0);
      expect(text(element.querySelector('p.corps'))).toBe(
        "Aucun pas pour l'instant. Ajoute des pas à tes objectifs : ils viennent se ranger ici.",
      );
      const link = element.querySelector<HTMLAnchorElement>('a[href="/"]');
      expect(text(link)).toBe('Voir mes objectifs');
    });

    it('un seul objectif : pas de rangée de filtres, filtrer ne changerait rien', async () => {
      await render(createFakeStore([objective('o1', 'Licence')], [task('t1', 'Réviser', 'o1', 4, 4)]));
      expect(element.querySelector('e-filtres')).toBeNull();
      expect(element.querySelector('p.corps')).toBeNull();
    });

    it('tant que les objectifs ne sont pas chargés : une ligne d’état, ni invitation, ni « 0 pas » nulle part', async () => {
      const fake = createFakeStore([], []);
      fake.objectivesLoaded.set(false);
      await render(fake);
      expect(element.querySelector('p.corps')).toBeNull();
      expect(element.querySelector('e-filtres')).toBeNull();
      expect(repere()).toBe('Lundi 19 octobre');
      expect(element.querySelector('e-matrice')).toBeNull();
      expect(text(element.querySelector('[role="status"]'))).toBe('Chargement de tes pas…');

      // Le chargement aboutit, sans aucun pas : le compte, les quadrants et l'invitation arrivent.
      fake.objectivesLoaded.set(true);
      fixture.detectChanges();
      expect(repere()).toBe('Lundi 19 octobre · 0 pas');
      expect(element.querySelector('p.corps')).not.toBeNull();
      expect(all('.e-quadrant__compte').map(text)).toEqual(['0 pas', '0 pas', '0 pas', '0 pas']);
      expect(element.querySelector('[role="status"]')).toBeNull();
    });

    it('après un chargement qui n’aboutit pas : rien tant que la note de la coque est là, puis quoi faire', async () => {
      const fake = createFakeStore([], []);
      fake.objectivesLoaded.set(false);
      fake.error.set("Je n'ai pas pu charger tes objectifs.");
      await render(fake);
      annonces.aUnSignalement.set(true);
      fixture.detectChanges();
      expect(element.querySelector('[role="status"]')).toBeNull();
      expect(element.querySelector('e-matrice')).toBeNull();
      expect(element.querySelector('p.corps')).toBeNull();

      annonces.aUnSignalement.set(false); // « Compris »
      fixture.detectChanges();
      expect(text(element.querySelector('p.corps'))).toBe('Tes pas ne sont pas chargés. Vérifie ta connexion, puis recharge la page.');
    });

    it('des pas déjà là comptent, même avant la fin du chargement', async () => {
      const fake = createFakeStore();
      fake.objectivesLoaded.set(false);
      await render(fake);
      expect(repere()).toBe('Lundi 19 octobre · 5 pas');
    });
  });

  describe('la voix', () => {
    it('aucun texte de l’écran ne sort de la voix d’Empreinte', async () => {
      await render();
      filterButtons()[2].click(); // l'annonce d'un filtre choisi
      fixture.detectChanges();
      const texts = [
        text(element),
        ...all('[aria-label]').map((node) => node.getAttribute('aria-label') ?? ''),
        ...QUADRANTS.map((quadrant) => TITRES_QUADRANTS[quadrant]),
        ...annonces.annoncer.mock.calls.map(([phrase]) => phrase as string),
      ];
      // L'état vide, le chargement et le chargement non abouti ont leurs propres phrases.
      TestBed.resetTestingModule();
      await render(createFakeStore([], []));
      texts.push(text(element));
      store.objectivesLoaded.set(false);
      fixture.detectChanges();
      texts.push(text(element));
      store.error.set('chargement non abouti');
      fixture.detectChanges();
      texts.push(text(element));

      for (const sentence of texts) {
        expect(motsAEviter(sentence), sentence).toEqual([]);
        expect(voiceIssues(sentence), sentence).toEqual([]);
      }
      expect(texts.join(' ')).not.toMatch(/Éliminer|Supprimer/i);
    });
  });
});

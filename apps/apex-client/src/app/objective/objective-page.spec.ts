import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { EFeuilleConfirmation } from '@empreinte-studio/angular/confirmation';
import { Feuilles } from '@empreinte-studio/angular/feuille';
import { motsAEviter } from '@empreinte-studio/angular/core';
import { ETrace } from '@empreinte-studio/angular/trace';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { WriteQueue } from '../../chore/stores/utils/write-queue';
import { rootObjectiveOptions, toObjectiveDetail } from '../../chore/mapper/objective-view.mapper';
import { voiceIssues } from '../../chore/constants/messages.constante';
import type { ObjectiveViewModel, TaskViewModel } from '../../chore/models/objective.viewmodel';
import { ObjectivePage } from './objective-page';
import { AddStageSheet } from './sheets/add-stage-sheet';
import { AddTaskSheet } from './sheets/add-task-sheet';
import { EditObjectiveSheet } from './sheets/edit-objective-sheet';
import { EditStageSheet } from './sheets/edit-stage-sheet';
import { EditTaskSheet } from './sheets/edit-task-sheet';

const objective = (id: string, title: string, parentId: string | null, extra: Partial<ObjectiveViewModel> = {}): ObjectiveViewModel => ({
  id,
  title,
  why: '',
  description: '',
  dueDate: '',
  parentId,
  done: false,
  ...extra,
});

const task = (id: string, title: string, objectiveId: string, done = false, importance = 1, urgency = 1): TaskViewModel => ({
  id,
  title,
  objectiveId,
  done,
  importance,
  urgency,
});

const OBJECTIVES: ObjectiveViewModel[] = [
  objective('obj-1', 'Courir un semi-marathon en mai', null, {
    why: 'Pour me prouver que je peux tenir quelque chose sur six mois.',
    description: 'Trois sorties par semaine.',
    dueDate: new Date(2027, 4, 15).toISOString(),
  }),
  objective('stage-1', 'Programme', 'obj-1', { done: true }),
  objective('stage-2', 'Endurance', 'obj-1', { description: 'Tenir 30 minutes sans marcher.' }),
  objective('stage-3', 'Équipement', 'obj-1'),
  objective('obj-2', 'Apprendre le japonais', null),
];

const TASKS: TaskViewModel[] = [
  task('t1', 'Choisir un plan', 'stage-1', true, 3, 3),
  task('t2', 'Courir 3 km', 'stage-2', true, 3, 3),
  task('t3', 'Courir 5 km', 'stage-2', false, 4, 4),
  task('t4', 'Sortie longue de 7 km', 'stage-2', false, 3, 1),
  task('t5', 'Acheter des chaussures', 'obj-1', false, 2, 4),
];

function createStore() {
  const objectives = signal(OBJECTIVES);
  const tasks = signal(TASKS);
  return {
    objectives,
    tasks,
    objectivesLoaded: signal(true),
    error: signal<string | null>(null),
    objectiveOptions: computed(() => rootObjectiveOptions(objectives())),
    objectiveDetail: (id: string) => toObjectiveDetail(id, objectives(), tasks()),
    // Comme le store : la mise à jour optimiste change le pas tout de suite.
    updateTaskDone: vi.fn(({ taskId, done }: { taskId: string; done: boolean }) =>
      tasks.update((list) => list.map((item) => (item.id === taskId ? { ...item, done } : item))),
    ),
    // Comme le store : ce qui est effacé quitte l'état tout de suite.
    deleteTask: vi.fn((taskId: string) => tasks.update((list) => list.filter((item) => item.id !== taskId))),
    deleteObjective: vi.fn((objectiveId: string) => {
      objectives.update((list) => list.filter((item) => item.id !== objectiveId && item.parentId !== objectiveId));
      tasks.update((list) => list.filter((item) => objectives().some((objective) => objective.id === item.objectiveId)));
    }),
  };
}

describe('ObjectivePage', () => {
  let fixture: ComponentFixture<ObjectivePage>;
  let element: HTMLElement;
  let store: ReturnType<typeof createStore>;
  let feuilles: { ouvrir: ReturnType<typeof vi.fn> };
  let annonces: { annoncer: ReturnType<typeof vi.fn>; aUnSignalement: ReturnType<typeof signal<boolean>> };
  /** Les ids définitifs que la file d'écritures connaît. */
  let realIds: Map<string, string>;
  /** La fermeture de la dernière feuille ouverte (ref.closed). */
  let closed: Subject<unknown>;

  async function render(id: string) {
    fixture = TestBed.createComponent(ObjectivePage);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

  const text = (selector: string) => element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const buttonNamed = (name: string) =>
    [...element.querySelectorAll<HTMLElement>('button, a')].find(
      (el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim() === name,
    );
  const openedWith = () => feuilles.ouvrir.mock.calls.at(-1) as [unknown, { donnees: unknown; cdk: { injector: unknown } }];
  /** Choisir une arête : la personne ouvre elle-même une étape. */
  const chooseStage = (index: number) => {
    element.querySelectorAll<SVGGElement>('e-arete .etape')[index].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    store = createStore();
    feuilles = {
      ouvrir: vi.fn(() => {
        closed = new Subject<unknown>();
        return { closed };
      }),
    };
    annonces = { annoncer: vi.fn(), aUnSignalement: signal(false) };
    realIds = new Map();
    TestBed.configureTestingModule({
      imports: [ObjectivePage],
      providers: [
        provideRouter([]),
        { provide: ObjectiveStore, useValue: store },
        { provide: AnnoncesStore, useValue: annonces },
        { provide: Feuilles, useValue: feuilles },
        { provide: WriteQueue, useValue: { resolve: (id: string) => realIds.get(id) ?? id } },
      ],
    });
  });

  describe('un objectif avec des étapes', () => {
    beforeEach(() => render('obj-1'));

    it("écrit l'en-tête : fil d'Ariane, horizon, titre, pourquoi et description", () => {
      const crumbs = [...element.querySelectorAll('nav li')].map((li) => li.textContent?.trim());
      expect(crumbs).toEqual(['Objectifs', 'Courir un semi-marathon en mai']);
      expect(element.querySelector('nav a')?.getAttribute('href')).toBe('/');
      expect(element.querySelector('nav li[aria-current="page"]')).not.toBeNull();
      expect(text('h1.manifeste')).toBe('Courir un semi-marathon en mai');
      expect(text('header p.voix')).toBe('« Pour me prouver que je peux tenir quelque chose sur six mois. »');
      expect(element.textContent).toContain('Trois sorties par semaine.');
      expect(element.textContent).toContain("Jusqu'en mai 2027");
    });

    it("dessine l'arête de ses étapes, avec sa légende", () => {
      expect(text('#titre-arete')).toBe("L'arête · 3 étapes");
      const legend = [...element.querySelectorAll('ul[aria-label="Légende de l\'arête"] li')].map((li) => li.textContent?.trim());
      expect(legend).toEqual(['Faite', 'À faire']);
      expect(element.querySelectorAll('e-arete .etape')).toHaveLength(3);
    });

    it("n'ouvre aucune étape de lui-même : aucune ne vient avant une autre", () => {
      expect(element.querySelector('#titre-etape')).toBeNull();
      expect(element.textContent).toContain("Choisis une étape sur l'arête pour voir ses pas.");
      expect(buttonNamed('Ajouter un pas')).toBeUndefined();
    });

    it('écrit chaque étape sans numéro, faite ou à faire', () => {
      const states = [...element.querySelectorAll('e-arete .etape .etat')].map((state) => state.textContent?.trim());
      expect(states).toEqual(['Faite', 'À faire', 'À faire']);
      chooseStage(1);
      expect(text('p.repere')).toBe('Étape · à faire');
      expect(element.textContent).not.toMatch(/Étape \d/);
    });

    it("l'étape choisie montre ses pas", () => {
      chooseStage(1);
      expect(text('#titre-etape')).toBe('Endurance');
      expect(element.textContent).toContain('Tenir 30 minutes sans marcher.');
      const titles = [...element.querySelectorAll('ul[aria-labelledby="titre-etape"] li .e-tache__titre')].map((label) =>
        label.textContent?.trim(),
      );
      expect(titles).toEqual(['Courir 3 km', 'Courir 5 km', 'Sortie longue de 7 km']);
      // Le quadrant d'un pas relève de l'API, qui ne le rend pas encore.
      expect(element.textContent).not.toMatch(/Maintenant|À planifier|À confier|laisser filer/);
    });

    it("nomme une étape sans titre, pour qu'on puisse la corriger", () => {
      chooseStage(1);
      store.objectives.update((list) => list.map((item) => (item.id === 'stage-2' ? { ...item, title: '' } : item)));
      fixture.detectChanges();
      expect(text('#titre-etape')).toBe('Étape sans nom');
      expect(buttonNamed("Modifier l'étape")).toBeDefined();
    });

    it('coche un pas par la mise à jour optimiste du store', () => {
      chooseStage(1);
      const items = element.querySelectorAll<HTMLLIElement>('ul[aria-labelledby="titre-etape"] li');
      const checkbox = items[1].querySelector<HTMLInputElement>('input[type="checkbox"]');
      checkbox?.click();
      expect(store.updateTaskDone).toHaveBeenCalledWith({ taskId: 't3', done: true });
    });

    it("choisir une arête ouvre son étape, et le dit aux lecteurs d'écran", () => {
      chooseStage(0);
      expect(text('#titre-etape')).toBe('Programme');
      expect(element.textContent).toContain('Étape · faite');
      expect(annonces.annoncer).toHaveBeenCalledWith('Programme · faite');
    });

    it("garde l'étape ouverte quand son dernier pas est coché, avec le focus sur la case", async () => {
      chooseStage(1);
      const boxes = () =>
        [...element.querySelectorAll<HTMLInputElement>('ul[aria-labelledby="titre-etape"] input[type="checkbox"]')];
      boxes()[1].click(); // « Courir 5 km »
      fixture.detectChanges();
      const last = boxes()[2]; // « Sortie longue de 7 km », le dernier pas d'« Endurance »
      last.focus();
      last.click();
      fixture.detectChanges();
      await fixture.whenStable();
      // L'écran ne décide rien : l'étape reste « à faire » tant que l'API ne la dit pas faite.
      expect(text('#titre-etape')).toBe('Endurance');
      expect(text('p.repere')).toBe('Étape · à faire');

      store.objectives.update((list) => list.map((item) => (item.id === 'stage-2' ? { ...item, done: true } : item)));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(text('#titre-etape')).toBe('Endurance');
      expect(text('p.repere')).toBe('Étape · faite');
      expect(last.isConnected).toBe(true);
      expect(document.activeElement).toBe(last);
    });

    it("garde l'étape ouverte quand son id temporaire devient définitif", () => {
      store.objectives.update((list) => [...list, objective('temp-id-1', 'Mental', 'obj-1')]);
      fixture.detectChanges();
      chooseStage(3);
      expect(text('#titre-etape')).toBe('Mental');

      realIds.set('temp-id-1', 'stage-4');
      store.objectives.update((list) => list.map((item) => (item.id === 'temp-id-1' ? { ...item, id: 'stage-4' } : item)));
      fixture.detectChanges();
      expect(text('#titre-etape')).toBe('Mental');
    });

    it("n'ouvre plus rien sur un autre objectif", async () => {
      chooseStage(0);
      store.objectives.update((list) => [...list, objective('stage-j1', 'Hiragana', 'obj-2')]);
      fixture.componentRef.setInput('id', 'obj-2');
      fixture.detectChanges();
      expect(element.querySelector('#titre-etape')).toBeNull();
    });

    it("nomme une étape sans titre sur l'arête", () => {
      store.objectives.update((list) => list.map((item) => (item.id === 'stage-3' ? { ...item, title: ' ' } : item)));
      fixture.detectChanges();
      const names = [...element.querySelectorAll('e-arete .etape .nom')].map((name) => name.textContent?.trim());
      expect(names).toEqual(['Programme', 'Endurance', 'Étape sans nom']);
    });

    it('rend le focus au titre de l’étape quand le bouton qui a ouvert la feuille a disparu', async () => {
      chooseStage(1);
      const edit = buttonNamed('Modifier « Courir 5 km »') as HTMLElement;
      edit.click();
      // La feuille range le pas dans une autre étape : son bouton « Modifier » quitte la liste
      store.tasks.update((list) => list.map((item) => (item.id === 't3' ? { ...item, objectiveId: 'stage-1' } : item)));
      edit.blur();
      closed.next(undefined);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(edit.isConnected).toBe(false);
      expect(document.activeElement).toBe(element.querySelector('#titre-etape'));
    });

    it('laisse le focus où le CDK l’a rendu quand le bouton est toujours là', async () => {
      chooseStage(1);
      const edit = buttonNamed("Modifier l'étape") as HTMLElement;
      edit.click();
      edit.focus();
      closed.next(undefined);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(edit);
    });

    it("« Ajouter un pas » ouvre la feuille sur l'étape choisie, avec l'injecteur de l'écran", () => {
      chooseStage(1);
      buttonNamed('Ajouter un pas')?.click();
      const [component, options] = openedWith();
      expect(component).toBe(AddTaskSheet);
      expect(options.donnees).toEqual({ objectiveId: 'obj-1', stageId: 'stage-2' });
      expect(options.cdk.injector).toBeTruthy();
    });

    it('« Modifier » sur un pas ouvre sa feuille', () => {
      chooseStage(1);
      buttonNamed('Modifier « Courir 5 km »')?.click();
      const [component, options] = openedWith();
      expect(component).toBe(EditTaskSheet);
      expect(options.donnees).toEqual({
        objectiveId: 'obj-1',
        stageId: 'stage-2',
        task: expect.objectContaining({ id: 't3', title: 'Courir 5 km', objectiveId: 'stage-2' }),
      });
    });

    it("« Modifier l'étape » ouvre la feuille de l'étape choisie", () => {
      chooseStage(1);
      buttonNamed("Modifier l'étape")?.click();
      const [component, options] = openedWith();
      expect(component).toBe(EditStageSheet);
      expect(options.donnees).toEqual({
        stage: { id: 'stage-2', title: 'Endurance', description: 'Tenir 30 minutes sans marcher.', dueDate: '' },
      });
    });

    it("« Ajouter une étape » et « Modifier l'objectif » ouvrent leurs feuilles", () => {
      buttonNamed('Ajouter une étape')?.click();
      expect(openedWith()[0]).toBe(AddStageSheet);
      expect(openedWith()[1].donnees).toEqual({ objectiveId: 'obj-1' });

      buttonNamed("Modifier l'objectif")?.click();
      expect(openedWith()[0]).toBe(EditObjectiveSheet);
      expect(openedWith()[1].donnees).toEqual({
        objective: expect.objectContaining({ id: 'obj-1', title: 'Courir un semi-marathon en mai' }),
      });
    });

    it("propose des pas avec Akari pour l'étape ouverte", () => {
      chooseStage(1);
      expect(buttonNamed('Proposer des pas avec Akari')?.getAttribute('href')).toBe('/objectifs/obj-1/akari?etape=stage-2');
    });

    it('range à part les pas sans étape, avec une invitation à les ranger', () => {
      expect(text('#titre-sans-etape')).toBe('Pas sans étape');
      expect(element.textContent).toContain('Ces pas ne sont dans aucune étape. Range-les avec « Modifier ».');
      buttonNamed('Modifier « Acheter des chaussures »')?.click();
      const [component, options] = openedWith();
      expect(component).toBe(EditTaskSheet);
      expect(options.donnees).toEqual(expect.objectContaining({ stageId: null, task: expect.objectContaining({ id: 't5' }) }));
    });

    it('coupe un intitulé sans espace (une adresse) au lieu d’élargir la page', () => {
      chooseStage(1);
      expect(element.querySelector('ul[aria-labelledby="titre-etape"]')?.classList).toContain('ds-break');
      expect(element.querySelector('ul[aria-labelledby="titre-sans-etape"]')?.classList).toContain('ds-break');
    });

    it("n'a qu'un sceau : la tête de l'arête, aucun bouton sceau", () => {
      expect(element.querySelectorAll('e-arete')).toHaveLength(1);
      expect(element.querySelectorAll('.e-btn--sceau')).toHaveLength(0);
    });
  });

  describe('effacer', () => {
    beforeEach(() => render('obj-1'));

    const stageTaskTitles = () =>
      [...element.querySelectorAll('ul[aria-labelledby="titre-etape"] li .e-tache__titre')].map((label) =>
        label.textContent?.trim(),
      );
    const trace = () => element.querySelector<HTMLElement>('ul[aria-labelledby="titre-etape"] li.e-trace');
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const arete = () => [...element.querySelectorAll('e-arete .etape .etat')].map((state) => state.textContent?.trim());
    const legend = () =>
      [...element.querySelectorAll('ul[aria-label="Légende de l\'arête"] li')].map((li) => li.textContent?.trim());

    describe('un pas : il part tout de suite, et sa trace le laisse revenir', () => {
      it('le × efface le pas : sa trace prend sa place, et il ne compte plus', async () => {
        chooseStage(1);
        expect(text('ul[aria-labelledby="titre-etape"] + *')).not.toContain('est effacé');
        buttonNamed('Effacer « Courir 5 km »')?.click();
        await settle();

        expect(trace()?.textContent?.replace(/\s+/g, ' ').trim()).toBe('« Courir 5 km » est effacé. Remettre');
        expect(stageTaskTitles()).toEqual(['Courir 3 km', 'Sortie longue de 7 km']);
        expect(text('section.panel-flush .e-pas__legende')).toBe('1 pas fait · 1 à faire');
        // Le pas n'est effacé pour de bon qu'à la fin de sa trace.
        expect(store.deleteTask).not.toHaveBeenCalled();
      });

      it('« Remettre » rend le pas à sa place, avec le focus sur sa case', async () => {
        chooseStage(1);
        buttonNamed('Effacer « Courir 5 km »')?.click();
        await settle();
        buttonNamed('Remettre')?.click();
        await settle();

        expect(trace()).toBeNull();
        expect(stageTaskTitles()).toEqual(['Courir 3 km', 'Courir 5 km', 'Sortie longue de 7 km']);
        const back = element.querySelectorAll<HTMLInputElement>('ul[aria-labelledby="titre-etape"] input[type="checkbox"]')[1];
        expect(document.activeElement).toBe(back);
        expect(store.deleteTask).not.toHaveBeenCalled();
      });

      it('la trace qui s’en va efface le pas pour de bon', async () => {
        chooseStage(1);
        buttonNamed('Effacer « Courir 5 km »')?.click();
        await settle();
        (fixture.debugElement.query(By.directive(ETrace)).componentInstance as ETrace).expiree.emit();
        await settle();

        expect(store.deleteTask).toHaveBeenCalledWith('t3');
        expect(trace()).toBeNull();
        expect(stageTaskTitles()).toEqual(['Courir 3 km', 'Sortie longue de 7 km']);
      });

      it('une trace à la fois : un autre pas effacé fait partir pour de bon celui qui attendait', async () => {
        chooseStage(1);
        buttonNamed('Effacer « Courir 5 km »')?.click();
        await settle();
        buttonNamed('Effacer « Courir 3 km »')?.click();
        await settle();

        expect(store.deleteTask).toHaveBeenCalledWith('t3');
        expect(element.querySelectorAll('ul[aria-labelledby="titre-etape"] li.e-trace')).toHaveLength(1);
        expect(trace()?.textContent?.replace(/\s+/g, ' ').trim()).toBe('« Courir 3 km » est effacé. Remettre');
        expect(stageTaskTitles()).toEqual(['Sortie longue de 7 km']);
      });

      it('ouvrir une autre étape efface pour de bon le pas dont la trace était là', async () => {
        chooseStage(1);
        buttonNamed('Effacer « Courir 5 km »')?.click();
        await settle();
        chooseStage(0);
        await settle();
        expect(store.deleteTask).toHaveBeenCalledWith('t3');
      });

      it('un pas qui n’est pas encore enregistré n’a pas de × : sa trace ne survivrait pas à son id définitif', () => {
        store.tasks.update((list) => [...list, task('temp-id-9', 'Fractionné', 'stage-2')]);
        chooseStage(1);
        expect(buttonNamed('Effacer « Fractionné »')).toBeUndefined();
        expect(buttonNamed('Effacer « Courir 5 km »')).toBeDefined();
      });

      it('effacer l’étape fait d’abord partir pour de bon le pas dont la trace attendait', async () => {
        chooseStage(1);
        buttonNamed('Effacer « Courir 5 km »')?.click();
        await settle();
        buttonNamed("Effacer l'étape")?.click();
        await settle();
        buttonNamed("Effacer l'étape")?.click();
        await settle();

        expect(store.deleteTask).toHaveBeenCalledWith('t3');
        expect(store.deleteTask.mock.invocationCallOrder[0]).toBeLessThan(
          store.deleteObjective.mock.invocationCallOrder[0],
        );
        // Sa trace, partie avec l'étape, ne renvoie rien.
        expect(store.deleteTask).toHaveBeenCalledTimes(1);
      });

      it('un pas sans étape s’efface aussi, avec sa trace', async () => {
        buttonNamed('Effacer « Acheter des chaussures »')?.click();
        await settle();
        const looseTrace = element.querySelector('ul[aria-labelledby="titre-sans-etape"] li.e-trace');
        expect(looseTrace?.textContent?.replace(/\s+/g, ' ').trim()).toBe('« Acheter des chaussures » est effacé. Remettre');
      });
    });

    describe('une étape : une validation, sur place', () => {
      it('« Effacer l’étape » est discret, au pied de l’étape ouverte', () => {
        chooseStage(1);
        const exit = element.querySelector<HTMLElement>('.stage-exit button');
        expect(exit?.textContent?.trim()).toBe("Effacer l'étape");
        expect(exit?.classList).toContain('e-btn--nu');
        expect(exit?.classList).toContain('e-btn--doux');
      });

      it('déplie une validation qui dit ce qui part ; l’arête et sa légende le montrent', async () => {
        chooseStage(1);
        buttonNamed("Effacer l'étape")?.click();
        await settle();

        const confirmation = element.querySelector<HTMLElement>('e-confirmation');
        expect(confirmation?.querySelector('.e-confirmation__titre')?.textContent?.trim()).toBe(
          'Effacer cette étape de ton plan ?',
        );
        expect(confirmation?.querySelector('.e-confirmation__texte')?.textContent?.trim()).toBe(
          'Elle emporte ses 3 pas, dont 1 fait. Ton arête passe de 3 à 2 étapes. Ça ne se récupère pas.',
        );
        expect(document.activeElement).toBe(confirmation?.querySelector('.e-confirmation__titre'));
        expect(arete()).toEqual(['Faite', 'Sort du plan', 'À faire']);
        expect(legend()).toEqual(['Faite', 'À faire', 'Sort du plan']);
        expect(element.querySelector('.stage-exit')).toBeNull();
        expect(store.deleteObjective).not.toHaveBeenCalled();
      });

      it('« Garder l’étape » replie la validation, et rien ne part', async () => {
        chooseStage(1);
        buttonNamed("Effacer l'étape")?.click();
        await settle();
        buttonNamed("Garder l'étape")?.click();
        await settle();

        expect(element.querySelector('e-confirmation')).toBeNull();
        expect(arete()).toEqual(['Faite', 'À faire', 'À faire']);
        expect(legend()).toEqual(['Faite', 'À faire']);
        expect(store.deleteObjective).not.toHaveBeenCalled();
        // La validation avait pris la place du geste : il revient, et le focus avec lui.
        expect(document.activeElement).toBe(element.querySelector('.stage-exit button'));
      });

      it('Échap replie la validation, et le focus revient à « Effacer l’étape »', async () => {
        chooseStage(1);
        buttonNamed("Effacer l'étape")?.click();
        await settle();
        element
          .querySelector('e-confirmation .e-confirmation__titre')
          ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settle();

        expect(element.querySelector('e-confirmation')).toBeNull();
        expect(document.activeElement).toBe(element.querySelector('.stage-exit button'));
      });

      it('la validation reste dépliée quand l’étape reçoit son id définitif', async () => {
        store.objectives.update((list) => [...list, objective('temp-id-1', 'Mental', 'obj-1')]);
        fixture.detectChanges();
        chooseStage(3);
        buttonNamed("Effacer l'étape")?.click();
        await settle();
        expect(element.querySelector('e-confirmation')).not.toBeNull();

        realIds.set('temp-id-1', 'stage-4');
        store.objectives.update((list) => list.map((item) => (item.id === 'temp-id-1' ? { ...item, id: 'stage-4' } : item)));
        await settle();

        expect(element.querySelector('e-confirmation')).not.toBeNull();
        buttonNamed("Effacer l'étape")?.click();
        await settle();
        expect(store.deleteObjective).toHaveBeenCalledWith('stage-4');
      });

      it('ouvrir une autre étape replie la validation', async () => {
        chooseStage(1);
        buttonNamed("Effacer l'étape")?.click();
        await settle();
        chooseStage(2);
        await settle();
        expect(element.querySelector('e-confirmation')).toBeNull();
        expect(arete()).toEqual(['Faite', 'À faire', 'À faire']);
      });

      it('confirmée, l’étape part, et le focus va au titre de l’arête', async () => {
        chooseStage(1);
        buttonNamed("Effacer l'étape")?.click();
        await settle();
        buttonNamed("Effacer l'étape")?.click();
        await settle();

        expect(store.deleteObjective).toHaveBeenCalledWith('stage-2');
        expect(element.querySelector('#titre-etape')).toBeNull();
        expect(element.textContent).toContain("Choisis une étape sur l'arête pour voir ses pas.");
        expect(text('#titre-arete')).toBe("L'arête · 2 étapes");
        expect(document.activeElement).toBe(element.querySelector('#titre-arete'));
      });

      it('sa dernière étape partie, le focus va au titre de l’objectif', async () => {
        store.objectives.update((list) => list.filter((item) => item.id !== 'stage-1' && item.id !== 'stage-3'));
        fixture.detectChanges();
        chooseStage(0);
        buttonNamed("Effacer l'étape")?.click();
        await settle();
        expect(text('e-confirmation .e-confirmation__texte')).toContain("Ton arête n'aura plus d'étape.");
        buttonNamed("Effacer l'étape")?.click();
        await settle();
        expect(document.activeElement).toBe(element.querySelector('h1'));
      });
    });

    describe('un objectif : au pied de sa feuille, et son nom à réécrire', () => {
      /** Ouvre « Modifier l'objectif », puis choisit sa sortie discrète. */
      const askErasure = () => {
        buttonNamed("Modifier l'objectif")?.click();
        closed.next('erase');
      };

      it('la sortie de la feuille « Modifier l’objectif » ouvre la confirmation, sans autre issue', () => {
        askErasure();
        const [component, options] = feuilles.ouvrir.mock.calls.at(-1) as [unknown, { donnees: unknown; alerte: boolean }];
        expect(component).toBe(EFeuilleConfirmation);
        expect(options.alerte).toBe(true);
        expect(options.donnees).toEqual({
          titre: 'Effacer cet objectif ?',
          texte: 'Ses 3 étapes, ses 5 pas dont 2 faits et ta conversation avec Akari partent avec lui. Ça ne se récupère pas.',
          libelleConfirmer: "Effacer l'objectif",
          libelleAnnuler: "Garder l'objectif",
          aReecrire: 'Courir un semi-marathon en mai',
        });
      });

      it('confirmé, l’objectif part une fois la liste des objectifs ouverte', async () => {
        let open: (navigated: boolean) => void = () => undefined;
        const navigate = vi
          .spyOn(TestBed.inject(Router), 'navigateByUrl')
          .mockReturnValue(new Promise<boolean>((resolve) => (open = resolve)));
        askErasure();
        closed.next('confirmer');
        expect(navigate).toHaveBeenCalledWith('/');
        await settle();
        // Tant que la liste n'est pas ouverte, l'arête ne dit jamais « introuvable » : rien ne part.
        expect(store.deleteObjective).not.toHaveBeenCalled();

        open(true);
        await settle();
        expect(store.deleteObjective).toHaveBeenCalledWith('obj-1');
      });

      it('si la liste ne s’ouvre pas, l’objectif part quand même : le geste est confirmé', async () => {
        vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockRejectedValue(new Error('chunk introuvable'));
        askErasure();
        closed.next('confirmer');
        await settle();
        expect(store.deleteObjective).toHaveBeenCalledWith('obj-1');
      });

      it('gardé (ou la feuille repliée), rien ne part', async () => {
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        askErasure();
        closed.next(undefined);
        await settle();
        expect(navigate).not.toHaveBeenCalled();
        expect(store.deleteObjective).not.toHaveBeenCalled();
      });

      it('une feuille fermée autrement ne demande rien', () => {
        buttonNamed("Modifier l'objectif")?.click();
        const opened = feuilles.ouvrir.mock.calls.length;
        closed.next(undefined);
        expect(feuilles.ouvrir.mock.calls.length).toBe(opened);
      });
    });

    it('parle dans la voix d’Empreinte, à chaque poids', async () => {
      const texts: string[] = [];
      const collect = () => {
        texts.push(element.textContent ?? '');
        element.querySelectorAll('[aria-label]').forEach((el) => texts.push(el.getAttribute('aria-label') ?? ''));
      };
      chooseStage(1);
      collect();
      buttonNamed('Effacer « Courir 5 km »')?.click();
      await settle();
      collect();
      buttonNamed("Effacer l'étape")?.click();
      await settle();
      collect();
      buttonNamed("Modifier l'objectif")?.click();
      closed.next('erase');
      const [, options] = feuilles.ouvrir.mock.calls.at(-1) as [unknown, { donnees: Record<string, string> }];
      texts.push(...Object.values(options.donnees));
      for (const value of texts) {
        expect(motsAEviter(value)).toEqual([]);
        expect(voiceIssues(value)).toEqual([]);
      }
    });
  });

  describe('plus de 8 étapes', () => {
    beforeEach(() => {
      // Trois étapes faites, sept à faire
      const stages = Array.from({ length: 10 }, (_, index) =>
        objective(`s${index + 1}`, `Étape ${index + 1}`, 'obj-1', { done: index < 3 }),
      );
      store.objectives.set([OBJECTIVES[0], ...stages]);
      store.tasks.set(stages.map((stage, index) => task(`p${index + 1}`, `Pas ${index + 1}`, stage.id, index < 3)));
      return render('obj-1');
    });

    it("l'arête « Faites » ouvre chaque étape faite, à tour de rôle", () => {
      const folded = () => element.querySelector<SVGGElement>('e-arete .etape') as SVGGElement;
      expect(folded().querySelector('.nom')?.textContent?.trim()).toBe('Faites');
      const opened: string[] = [];
      for (let i = 0; i < 4; i++) {
        folded().dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        opened.push(text('#titre-etape'));
      }
      expect(opened).toEqual(['Étape 3', 'Étape 2', 'Étape 1', 'Étape 3']);
    });
  });

  describe('un objectif sans étape', () => {
    beforeEach(() => render('obj-2'));

    it("Akari invite à poser des étapes, ou à lui en demander", () => {
      const note = element.querySelector('aside.e-note');
      expect(note?.textContent).toContain(
        "Une arête se construit avec des étapes. Ajoute-en une, ou demande-moi de t'en proposer.",
      );
      expect(element.querySelector('e-arete')).toBeNull();
      expect(buttonNamed('Proposer des étapes')?.getAttribute('href')).toBe('/objectifs/obj-2/akari');
    });

    it("rend le focus au titre de l'objectif quand la note d'Akari disparaît : aucune étape ne s'ouvre seule", async () => {
      const add = buttonNamed('Ajouter une étape') as HTMLElement;
      add.click();
      add.focus();
      store.objectives.update((list) => [...list, objective('temp-id-1', 'Hiragana', 'obj-2')]);
      closed.next(undefined);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element.querySelector('aside.e-note')).toBeNull();
      expect(element.querySelector('#titre-etape')).toBeNull();
      expect(document.activeElement).toBe(element.querySelector('h1'));
    });

    it('quand la coque affiche un signalement, garde une seule note : la sienne, et les mêmes actions', () => {
      // Par exemple : une étape, ajoutée depuis la note, n'a pas été enregistrée.
      annonces.aUnSignalement.set(true);
      fixture.detectChanges();
      expect(element.querySelector('aside.e-note')).toBeNull();
      expect(text('p.corps')).toBe('Une arête se construit avec des étapes.');
      expect(buttonNamed('Ajouter une étape')).toBeDefined();
      expect(buttonNamed('Proposer des étapes')?.getAttribute('href')).toBe('/objectifs/obj-2/akari');

      annonces.aUnSignalement.set(false); // « Compris »
      fixture.detectChanges();
      expect(element.querySelectorAll('aside.e-note')).toHaveLength(1);
    });

    it('« Ajouter une étape » ouvre la feuille, sans doublon dans l’en-tête', () => {
      const addButtons = [...element.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Ajouter une étape');
      expect(addButtons).toHaveLength(1);
      addButtons[0].click();
      expect(openedWith()[0]).toBe(AddStageSheet);
      expect(openedWith()[1].donnees).toEqual({ objectiveId: 'obj-2' });
    });
  });

  describe('un objectif introuvable', () => {
    it('le dit une fois le chargement fini, avec un lien vers les objectifs', async () => {
      await render('inconnu');
      expect(text('h1')).toBe('Cet objectif est introuvable');
      expect(buttonNamed('Voir mes objectifs')?.getAttribute('href')).toBe('/');
    });

    it("ne prend pas une étape pour un objectif", async () => {
      await render('stage-2');
      expect(text('h1')).toBe('Cet objectif est introuvable');
    });

    it('ne dit rien de faux pendant le chargement', async () => {
      store.objectivesLoaded.set(false);
      store.objectives.set([]);
      await render('obj-1');
      expect(element.textContent).not.toContain('introuvable');
      expect(text('[role="status"]')).toBe('Chargement de ton objectif…');

      store.objectives.set(OBJECTIVES);
      store.objectivesLoaded.set(true);
      fixture.detectChanges();
      expect(text('h1')).toBe('Courir un semi-marathon en mai');
    });

    it('le dit dès que le chargement est fini, sans cet objectif', async () => {
      store.objectivesLoaded.set(false);
      store.objectives.set([]);
      await render('inconnu');
      expect(element.textContent).not.toContain('introuvable');

      store.objectivesLoaded.set(true);
      fixture.detectChanges();
      expect(text('h1')).toBe('Cet objectif est introuvable');
    });

    it("ne le dit pas quand le chargement n'a pas abouti : la coque le signale déjà", async () => {
      store.objectivesLoaded.set(false);
      store.error.set("Je n'ai pas pu charger tes objectifs.");
      store.objectives.set([]);
      annonces.aUnSignalement.set(true);
      await render('obj-1');
      expect(element.textContent).not.toContain('introuvable');
      expect(element.querySelector('[role="status"]')).toBeNull();
      // La page garde un titre et un chemin ; la note de la coque explique.
      expect(text('h1')).toBe('Tes objectifs ne sont pas chargés');
      expect(element.querySelector('p.corps')).toBeNull();
      expect(buttonNamed('Voir mes objectifs')?.getAttribute('href')).toBe('/');

      annonces.aUnSignalement.set(false); // « Compris » : l'écran dit quoi faire
      fixture.detectChanges();
      expect(text('p.corps')).toBe('Vérifie ta connexion, puis recharge la page.');
    });
  });

  it('parle dans la voix d’Empreinte, dans tous ses états', async () => {
    const texts: string[] = [];
    const collect = () => {
      texts.push(element.textContent ?? '');
      element.querySelectorAll('[aria-label]').forEach((el) => texts.push(el.getAttribute('aria-label') ?? ''));
    };
    await render('obj-1');
    collect();
    // Ce que les lecteurs d'écran entendent quand une arête est choisie
    element.querySelectorAll<SVGGElement>('e-arete .etape').forEach((arete) => {
      arete.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
    });
    texts.push(...annonces.annoncer.mock.calls.map(([phrase]) => phrase as string));
    await render('obj-2');
    collect();
    await render('inconnu');
    collect();
    store.objectivesLoaded.set(false);
    store.objectives.set([]);
    await render('autre');
    collect();
    store.error.set('chargement non abouti');
    await render('autre');
    collect();
    store.error.set(null);
    store.objectivesLoaded.set(true);
    store.objectives.set(OBJECTIVES);
    annonces.aUnSignalement.set(true);
    await render('obj-2');
    collect();

    for (const value of texts) {
      expect(motsAEviter(value)).toEqual([]);
      expect(voiceIssues(value)).toEqual([]);
    }
  });
});

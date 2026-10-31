import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { Feuilles, motsAEviter } from '../../ui';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { ObjectiveStore } from '../../chore/stores/objective.store';
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
  objective('stage-1', 'Programme', 'obj-1'),
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
  };
}

describe('ObjectivePage', () => {
  let fixture: ComponentFixture<ObjectivePage>;
  let element: HTMLElement;
  let store: ReturnType<typeof createStore>;
  let feuilles: { ouvrir: ReturnType<typeof vi.fn> };
  let annonces: { annoncer: ReturnType<typeof vi.fn>; aUnSignalement: ReturnType<typeof signal<boolean>> };
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
  /** Les étapes du chemin, dans l'ordre (le sommet n'est pas cliquable). */
  const pathButtons = () => [...element.querySelectorAll<HTMLButtonElement>('ax-path .step button')];
  const openedWith = () => feuilles.ouvrir.mock.calls.at(-1) as [unknown, { donnees: unknown; cdk: { injector: unknown } }];

  beforeEach(() => {
    store = createStore();
    feuilles = {
      ouvrir: vi.fn(() => {
        closed = new Subject<unknown>();
        return { closed };
      }),
    };
    annonces = { annoncer: vi.fn(), aUnSignalement: signal(false) };
    TestBed.configureTestingModule({
      imports: [ObjectivePage],
      providers: [
        provideRouter([]),
        { provide: ObjectiveStore, useValue: store },
        { provide: AnnoncesStore, useValue: annonces },
        { provide: Feuilles, useValue: feuilles },
      ],
    });
  });

  describe('un objectif avec des étapes', () => {
    beforeEach(() => render('obj-1'));

    it("écrit l'en-tête : retour aux objectifs, horizon, titre, pourquoi et description", () => {
      const crumbs = [...element.querySelectorAll('nav[aria-label="Fil d\'Ariane"] li')].map((li) => li.textContent?.trim());
      expect(crumbs).toEqual(['Objectifs', 'Courir un semi-marathon en mai']);
      expect(element.querySelector('nav a')?.getAttribute('href')).toBe('/');
      expect(element.querySelector('nav li[aria-current="page"]')).not.toBeNull();
      expect(text('h1')).toBe('Courir un semi-marathon en mai');
      expect(element.querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
      expect(text('header p.serif')).toBe('Pour me prouver que je peux tenir quelque chose sur six mois.');
      expect(element.textContent).toContain('Trois sorties par semaine.');
      expect(text('header p.label')).toBe("Objectif · Jusqu'en mai 2027");
    });

    it("porte la couleur de l'objectif et l'anneau de ses pas faits", () => {
      expect(element.querySelector('header .tile')?.className).toMatch(/l-(ciel|fjord|soleil|aube)/);
      const rings = element.querySelector('ax-rings');
      // Les pas des étapes et ceux sans étape : 2 faits sur 5
      expect(rings?.getAttribute('aria-label')).toBe('2 pas faits sur 5');
      expect(rings?.textContent?.replace(/\s+/g, '')).toBe('2/5pasfaits');
    });

    it('dessine le chemin de ses étapes jusqu’au sommet', () => {
      expect(text('#titre-chemin')).toBe('Le chemin');
      expect(element.textContent).toContain("3 étapes jusqu'au sommet");
      expect(pathButtons()).toHaveLength(3);
      expect(text('ax-path .step--summit .name')).toBe('Courir un semi-marathon en mai');
      expect(text('ax-path .step--summit .state')).toBe("Jusqu'en mai 2027");
      // L'étape ouverte est marquée sur le chemin
      expect(pathButtons().map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
      // Sur mobile, le chemin défile dans son conteneur au lieu d'écraser ses colonnes
      expect(element.querySelector('ax-path')?.parentElement?.classList).toContain('ds-scroll-x');
    });

    it('résume l’horizon, les étapes et les pas, sans rien inventer', () => {
      const facts = [...element.querySelectorAll('[aria-labelledby="titre-en-bref"] dl > div')].map(
        (row) => `${row.querySelector('dt')?.textContent?.trim()} ${row.querySelector('dd')?.textContent?.trim()}`,
      );
      expect(facts).toEqual(["Horizon Jusqu'en mai 2027", 'Étapes 1 étape faite · 2 à venir', 'Pas 2 pas faits · 3 à venir']);
    });

    it("ouvre l'étape en cours par défaut, avec ses pas", () => {
      expect(text('#titre-etape')).toBe('Endurance');
      expect(element.textContent).toContain('Étape 2 · en cours');
      expect(element.textContent).toContain('Tenir 30 minutes sans marcher.');
      const titles = [...element.querySelectorAll('ul[aria-labelledby="titre-etape"] li label')].map((label) =>
        label.textContent?.trim(),
      );
      expect(titles).toEqual(['Courir 3 km', 'Courir 5 km', 'Sortie longue de 7 km']);
      // Chaque case est nommée par l'intitulé de son pas
      const box = element.querySelector<HTMLInputElement>('ul[aria-labelledby="titre-etape"] input.check');
      expect(element.querySelector(`label[for="${box?.id}"]`)?.textContent?.trim()).toBe('Courir 3 km');
      // Le quadrant d'un pas à faire ; « Maintenant » en vermillon
      const chips = [...element.querySelectorAll('ul[aria-labelledby="titre-etape"] .chip')];
      expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Fait', 'Maintenant', 'À planifier']);
      expect(chips.map((chip) => chip.classList.contains('chip--sceau'))).toEqual([false, true, false]);
    });

    it("nomme une étape sans titre, pour qu'on puisse la corriger", () => {
      store.objectives.update((list) => list.map((item) => (item.id === 'stage-2' ? { ...item, title: '' } : item)));
      fixture.detectChanges();
      expect(text('#titre-etape')).toBe('Étape sans nom');
      expect(buttonNamed("Modifier l'étape")).toBeDefined();
    });

    it('coche un pas par la mise à jour optimiste du store', () => {
      const items = element.querySelectorAll<HTMLLIElement>('ul[aria-labelledby="titre-etape"] li');
      const checkbox = items[1].querySelector<HTMLInputElement>('input[type="checkbox"]');
      checkbox?.click();
      expect(store.updateTaskDone).toHaveBeenCalledWith({ taskId: 't3', done: true });
    });

    it("choisir une étape sur le chemin l'ouvre, et le dit aux lecteurs d'écran", () => {
      pathButtons()[0].click();
      fixture.detectChanges();
      expect(pathButtons()[0].getAttribute('aria-pressed')).toBe('true');
      expect(text('#titre-etape')).toBe('Programme');
      expect(element.textContent).toContain('Étape 1 · faite');
      expect(annonces.annoncer).toHaveBeenCalledWith('Étape 1 · faite : Programme');
    });

    it("garde l'étape ouverte quand son dernier pas est coché, avec le focus sur la case", async () => {
      const boxes = () =>
        [...element.querySelectorAll<HTMLInputElement>('ul[aria-labelledby="titre-etape"] input[type="checkbox"]')];
      boxes()[1].click(); // « Courir 5 km »
      fixture.detectChanges();
      const last = boxes()[2]; // « Sortie longue de 7 km », le dernier pas d'« Endurance »
      last.focus();
      last.click();
      fixture.detectChanges();
      await fixture.whenStable();
      // « Équipement » passe en cours sur le chemin, mais le panneau reste sur l'étape qu'on vient d'achever
      expect(text('#titre-etape')).toBe('Endurance');
      expect(element.textContent).toContain('Étape 2 · faite');
      expect(last.isConnected).toBe(true);
      expect(document.activeElement).toBe(last);
    });

    it("reprend l'étape en cours sur un autre objectif", async () => {
      pathButtons()[0].click();
      fixture.detectChanges();
      store.objectives.update((list) => [...list, objective('stage-j1', 'Hiragana', 'obj-2')]);
      fixture.componentRef.setInput('id', 'obj-2');
      fixture.detectChanges();
      expect(text('#titre-etape')).toBe('Hiragana');
    });

    it('nomme une étape sans titre sur le chemin', () => {
      store.objectives.update((list) => list.map((item) => (item.id === 'stage-3' ? { ...item, title: ' ' } : item)));
      fixture.detectChanges();
      const names = [...element.querySelectorAll('ax-path .step:not(.step--summit) .name')].map((name) => name.textContent?.trim());
      expect(names).toEqual(['Programme', 'Endurance', 'Étape sans nom']);
    });

    it('rend le focus au titre de l’étape quand le bouton qui a ouvert la feuille a disparu', async () => {
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
      const edit = buttonNamed("Modifier l'étape") as HTMLElement;
      edit.click();
      edit.focus();
      closed.next(undefined);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(edit);
    });

    it("« Ajouter un pas » ouvre la feuille sur l'étape choisie, avec l'injecteur de l'écran", () => {
      buttonNamed('Ajouter un pas')?.click();
      const [component, options] = openedWith();
      expect(component).toBe(AddTaskSheet);
      expect(options.donnees).toEqual({ objectiveId: 'obj-1', stageId: 'stage-2' });
      expect(options.cdk.injector).toBeTruthy();
    });

    it('« Modifier » sur un pas ouvre sa feuille', () => {
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
      expect(text('#titre-akari')).toBe('Des pas pour Endurance');
      expect(buttonNamed('Proposer des pas avec Akari')?.getAttribute('href')).toBe('/objectifs/obj-1/akari?etape=stage-2');
      pathButtons()[0].click();
      fixture.detectChanges();
      expect(buttonNamed('Proposer des pas avec Akari')?.getAttribute('href')).toBe('/objectifs/obj-1/akari?etape=stage-1');
    });

    it("n'envoie jamais un id temporaire à Akari", () => {
      store.objectives.update((list) => list.map((item) => (item.id === 'stage-2' ? { ...item, id: 'temp-id-9' } : item)));
      store.tasks.update((list) => list.map((item) => (item.objectiveId === 'stage-2' ? { ...item, objectiveId: 'temp-id-9' } : item)));
      fixture.detectChanges();
      expect(buttonNamed('Proposer des pas avec Akari')?.getAttribute('href')).toBe('/objectifs/obj-1/akari');
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
      expect(element.querySelector('ul[aria-labelledby="titre-etape"]')?.classList).toContain('ds-break');
      expect(element.querySelector('ul[aria-labelledby="titre-sans-etape"]')?.classList).toContain('ds-break');
    });

    it('n’a qu’une action vermillon : « Ajouter une étape »', () => {
      const accents = [...element.querySelectorAll('.btn--accent')].map((el) => el.textContent?.trim());
      expect(accents).toEqual(['Ajouter une étape']);
    });
  });

  describe('un long chemin', () => {
    beforeEach(() => {
      const stages = Array.from({ length: 10 }, (_, index) => objective(`s${index + 1}`, `Étape ${index + 1}`, 'obj-1'));
      store.objectives.set([OBJECTIVES[0], ...stages]);
      // Les trois premières sont faites ; la quatrième est en cours
      store.tasks.set(stages.map((stage, index) => task(`p${index + 1}`, `Pas ${index + 1}`, stage.id, index < 3)));
      return render('obj-1');
    });

    it('garde chaque étape atteignable, faites comprises', () => {
      expect(pathButtons()).toHaveLength(10);
      expect(text('#titre-etape')).toBe('Étape 4');
      pathButtons()[1].click();
      fixture.detectChanges();
      expect(text('#titre-etape')).toBe('Étape 2');
      expect(element.textContent).toContain('Étape 2 · faite');
    });
  });

  describe('un objectif sans étape', () => {
    beforeEach(() => render('obj-2'));

    it("Akari invite à poser la première étape, ou à lui en demander", () => {
      const note = element.querySelector('aside.invite');
      expect(note?.textContent).toContain(
        "Un chemin commence par une étape. Ajoute la première, ou demande-moi de t'en proposer.",
      );
      expect(element.querySelector('ax-path')).toBeNull();
      expect(element.querySelector('ax-rings')).toBeNull();
      expect(buttonNamed('Proposer des étapes')?.getAttribute('href')).toBe('/objectifs/obj-2/akari');
    });

    it("pose le focus sur la première étape ajoutée, puisque la note d'Akari disparaît", async () => {
      const add = buttonNamed('Ajouter une étape') as HTMLElement;
      add.click();
      add.focus();
      store.objectives.update((list) => [...list, objective('temp-id-1', 'Hiragana', 'obj-2')]);
      closed.next(undefined);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element.querySelector('aside.invite')).toBeNull();
      expect(document.activeElement).toBe(element.querySelector('#titre-etape'));
      expect(text('#titre-etape')).toBe('Hiragana');
    });

    it('quand la coque affiche un signalement, garde une seule note : la sienne, et les mêmes actions', () => {
      // Par exemple : la première étape, ajoutée depuis la note, n'a pas été enregistrée.
      annonces.aUnSignalement.set(true);
      fixture.detectChanges();
      expect(element.querySelector('aside.invite')).toBeNull();
      expect(text('.invite-plain p')).toBe('Un chemin commence par une étape.');
      expect(buttonNamed('Ajouter une étape')).toBeDefined();
      expect(buttonNamed('Proposer des étapes')?.getAttribute('href')).toBe('/objectifs/obj-2/akari');

      annonces.aUnSignalement.set(false); // « Compris »
      fixture.detectChanges();
      expect(element.querySelectorAll('aside.invite')).toHaveLength(1);
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
      expect(element.textContent).not.toContain('Vérifie ta connexion');
      expect(buttonNamed('Voir mes objectifs')?.getAttribute('href')).toBe('/');

      annonces.aUnSignalement.set(false); // « Compris » : l'écran dit quoi faire
      fixture.detectChanges();
      expect(text('section p')).toBe('Vérifie ta connexion, puis recharge la page.');
    });
  });

  it('parle dans la voix d’Apex, dans tous ses états', async () => {
    const texts: string[] = [];
    const collect = () => {
      texts.push(element.textContent ?? '');
      element.querySelectorAll('[aria-label]').forEach((el) => texts.push(el.getAttribute('aria-label') ?? ''));
    };
    await render('obj-1');
    collect();
    // Ce que les lecteurs d'écran entendent quand une étape est choisie
    pathButtons().forEach((button) => {
      button.click();
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

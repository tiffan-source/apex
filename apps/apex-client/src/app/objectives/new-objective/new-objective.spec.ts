import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { motsAEviter } from '@empreinte-studio/angular/core';
import type { OptionSelection } from '@empreinte-studio/angular/selection';
import { NEW_OBJECTIVE_TEXTS, NewObjective } from './new-objective';
import { DRAFT_MESSAGES, isBeforeToday, toCreateObjectiveInput, todayInputValue } from './new-objective.form';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { SessionStore, type UserViewModel } from '../../../chore/stores/session.store';
import { FAILURE_REPORTS, voiceIssues } from '../../../chore/constants/messages.constante';
import { fromDateInputValue, toDateInputValue } from '../../../chore/mapper/date-input.mapper';
import { formatHorizon } from '../../../chore/mapper/objective-view.mapper';
import { isTemporaryId } from '../../../chore/stores/utils/map-optimistique-id';
import { present } from '../../../testing/present';

type RequestStatus = 'idle' | 'pending' | 'fulfilled' | { error: string };

/**
 * Un ObjectiveStore simulé : seul ce que l'écran lit et appelle, avec le comportement du vrai store.
 * createObjective ajoute tout de suite l'objectif optimiste (id temporaire) et remet lastCreatedObjectiveId
 * à null ; la réponse, dans l'ordre de la file d'écritures, remplace l'id temporaire par l'id définitif
 * (lastCreatedObjectiveId, 'fulfilled') ou retire l'objectif optimiste et signale (requestStatus en erreur).
 */
function createStoreMock(options: { withSession?: boolean } = {}) {
  const lastCreatedObjectiveId = signal<string | null>(null);
  const requestStatus = signal<RequestStatus>('idle');
  const objectiveOptions = signal<OptionSelection<string>[]>([{ valeur: 'objectif-1', libelle: 'Lire 12 livres' }]);
  let sequence = 0;

  /** Les créations encore en attente, de la plus ancienne à la plus récente. */
  const pending = () => objectiveOptions().filter((option) => isTemporaryId(option.valeur));
  const oldestPending = () => pending()[0]?.valeur ?? '';

  /** Une création part : l'objectif optimiste arrive tout de suite, l'id définitif plus tard. */
  const start = (title: string) => {
    const temporaryId = `temp-id-${++sequence}`;
    objectiveOptions.update((list) => [...list, { valeur: temporaryId, libelle: title }]);
    requestStatus.set('pending');
    lastCreatedObjectiveId.set(null);
    return temporaryId;
  };

  const createObjective = vi.fn((input: { title: string }) => {
    // Sans session, le vrai store ignore le geste (withOwnerId) : rien ne change.
    if (options.withSession ?? true) start(input.title);
  });

  return {
    lastCreatedObjectiveId,
    requestStatus,
    objectiveOptions,
    isPending: computed(() => requestStatus() === 'pending'),
    error: computed(() => {
      const status = requestStatus();
      return typeof status === 'object' ? status.error : null;
    }),
    createObjective,
    /** Une création lancée ailleurs (avant d'ouvrir cet écran), encore en attente. */
    startElsewhere: (title: string) => start(title),
    /** La plus ancienne création en attente aboutit avec cet id. */
    succeed(id: string, temporaryId = oldestPending()) {
      objectiveOptions.update((list) => list.map((option) => (option.valeur === temporaryId ? { ...option, valeur: id } : option)));
      lastCreatedObjectiveId.set(id);
      requestStatus.set('fulfilled');
    },
    /** La plus ancienne création en attente n'aboutit pas. */
    fail(temporaryId = oldestPending()) {
      objectiveOptions.update((list) => list.filter((option) => option.valeur !== temporaryId));
      requestStatus.set({ error: FAILURE_REPORTS.createObjective });
    },
    /** Une autre écriture (un pas coché juste avant…) n'aboutit pas : requestStatus est partagé. */
    otherWriteFails(report: string) {
      requestStatus.set({ error: report });
    },
  };
}

type StoreMock = ReturnType<typeof createStoreMock>;

/** Le texte visible, espaces insécables compris, ramené à des espaces simples. */
const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

describe('NewObjective', () => {
  let fixture: ComponentFixture<NewObjective>;
  let element: HTMLElement;
  let store: StoreMock;
  let currentUser: ReturnType<typeof signal<UserViewModel | null>>;
  let navigate: ReturnType<typeof vi.fn>;

  async function setup(storeMock: StoreMock = createStoreMock()) {
    store = storeMock;
    currentUser = signal<UserViewModel | null>({ id: 'u1', name: 'Léa Martin', email: 'lea@example.com' });
    await TestBed.configureTestingModule({
      imports: [NewObjective],
      providers: [
        provideRouter([]),
        { provide: ObjectiveStore, useValue: store },
        { provide: SessionStore, useValue: { currentUser } },
      ],
    }).compileComponents();

    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as unknown as ReturnType<typeof vi.fn>;
    fixture = TestBed.createComponent(NewObjective);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const titleInput = () => present(element.querySelector<HTMLInputElement>('input[aria-labelledby^="question-title"]'), 'le champ du titre');
  const whyInput = () => present(element.querySelector<HTMLTextAreaElement>('textarea[aria-labelledby^="question-why"]'), 'le champ du pourquoi');
  const dueDateInput = () => present(element.querySelector<HTMLInputElement>('input[type="date"]'), 'le champ de la date');
  const descriptionInput = () =>
    present(element.querySelector<HTMLTextAreaElement>('textarea[aria-labelledby^="question-description"]'), 'le champ de la description');
  const engageButton = () => present(element.querySelector<HTMLButtonElement>('button[type="submit"]'), "« Je m'y engage »");
  const draftTitle = () => present(element.querySelector<HTMLElement>('#draft-title'), 'le titre du brouillon');
  const status = () => present(element.querySelector<HTMLElement>('[role="status"]'), "la ligne d'état");

  /** Écrit dans un champ comme au clavier. */
  function write(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
    control.value = value;
    control.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Quitte un champ (il devient « touché » et peut afficher son message). */
  function leave(control: HTMLElement) {
    control.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  async function engage() {
    engageButton().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Une date à quelques jours d'aujourd'hui, au format du champ. */
  function inDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return toDateInputValue(date);
  }

  afterEach(() => TestBed.resetTestingModule());

  describe('à l’ouverture', () => {
    beforeEach(() => setup());

    it("présente l'écran dans l'en-tête de la maquette", () => {
      const header = present(element.querySelector('header'), "l'en-tête");
      expect(clean(header.querySelector('.repere')?.textContent)).toBe('Akari');
      expect(clean(header.querySelector('h1.manifeste')?.textContent)).toBe('Nouvel objectif');
      expect(clean(header.querySelector('p.detail')?.textContent)).toBe(
        "On le construit ensemble. Rien n'est enregistré tant que tu ne t'engages pas.",
      );
    });

    it("pose les questions d'Akari dans le fil, chacune signée de son losange", () => {
      const notes = Array.from(element.querySelectorAll('ol.e-fil > li.e-replique--assistant'));
      expect(notes.map((note) => clean(note.querySelector('.e-replique__texte')?.textContent))).toEqual([
        "Qu'est-ce que tu veux construire ?",
        'Pourquoi est-ce que ça compte pour toi ?',
        'Pour quand ?',
        'Tu veux en dire plus ?',
      ]);
      for (const note of notes) expect(clean(note.querySelector('.e-replique__qui')?.textContent)).toBe('Akari');
    });

    it('donne la parole à la personne, par son prénom, dans des champs Empreinte', () => {
      const authors = Array.from(element.querySelectorAll('.e-replique--personne > .e-replique__qui')).map((p) =>
        clean(p.textContent),
      );
      expect(authors).toEqual(['Léa', 'Léa', 'Léa', 'Léa']);
      expect(element.querySelectorAll('e-champ')).toHaveLength(4);
      expect(titleInput().classList).toContain('e-saisie');
      expect(dueDateInput().classList).toContain('e-saisie');
      expect(whyInput().classList).toContain('e-saisie--taille-auto');
      expect(descriptionInput().classList).toContain('e-saisie--taille-auto');
      const optional = Array.from(element.querySelectorAll('e-champ')).map((champ) =>
        champ.querySelector('.e-champ__facultatif') !== null,
      );
      expect(optional).toEqual([false, true, true, true]);
    });

    it("relie chaque champ à la question d'Akari et à son libellé", () => {
      const controls = [titleInput(), whyInput(), dueDateInput(), descriptionInput()];
      const questions = ['question-title', 'question-why', 'question-due-date', 'question-description'];
      controls.forEach((control, index) => {
        const [questionId, labelId] = (control.getAttribute('aria-labelledby') ?? '').split(' ');
        expect(questionId).toBe(questions[index]);
        expect(element.querySelector(`#${questionId}`)?.closest('li.e-replique--assistant')).not.toBeNull();
        const label = element.querySelector(`#${labelId}`);
        expect(label?.tagName).toBe('LABEL');
        expect(label?.getAttribute('for')).toBe(control.id);
      });
    });

    it("ne permet pas d'aller avant aujourd'hui dans le champ date", () => {
      expect(dueDateInput().getAttribute('min')).toBe(todayInputValue());
    });

    it("montre un brouillon vide, pas encore enregistré, avec un seul sceau et sans arête", () => {
      const draft = present(element.querySelector('section[aria-labelledby="draft-title"]'), 'le brouillon');
      expect(clean(draft.querySelector('.repere')?.textContent)).toBe('Brouillon · pas encore enregistré');
      expect(clean(draftTitle().textContent)).toBe(NEW_OBJECTIVE_TEXTS.untitled);
      expect(draftTitle().classList).toContain('ds-muted');
      expect(draft.textContent).toContain(NEW_OBJECTIVE_TEXTS.noHorizon);
      expect(draft.getAttribute('aria-current')).toBe('true');
      expect(clean(draft.lastElementChild?.textContent)).toBe(
        "En t'engageant, l'objectif rejoint tes objectifs, puis Akari te propose des étapes.",
      );
      expect(element.querySelectorAll('.e-btn--sceau')).toHaveLength(1);
      expect(element.querySelector('e-arete')).toBeNull();
    });

    it("désactive « Je m'y engage » tant que le titre est vide, et propose « Plus tard » vers l'accueil", () => {
      expect(clean(engageButton().textContent)).toBe("Je m'y engage");
      expect(engageButton().classList).toContain('e-btn--sceau');
      expect(engageButton().disabled).toBe(true);
      const later = present(Array.from(element.querySelectorAll('a')).find((a) => clean(a.textContent) === 'Plus tard'), '« Plus tard »');
      expect(later.classList).toContain('e-btn--nu');
      expect(later.getAttribute('href')).toBe('/');
      expect(clean(status().textContent)).toBe('');
    });

    it("n'appelle pas le store tant que la personne ne s'engage pas", () => {
      write(titleInput(), 'Courir un semi-marathon');
      expect(store.createObjective).not.toHaveBeenCalled();
    });
  });

  describe('le brouillon', () => {
    beforeEach(() => setup());

    it('suit les réponses en direct', () => {
      const due = inDays(40);
      write(titleInput(), '  Décrocher un stage cet été  ');
      write(whyInput(), 'Savoir si ce métier me plaît.');
      write(descriptionInput(), 'Un stage de développement web.');
      write(dueDateInput(), due);

      expect(clean(draftTitle().textContent)).toBe('Décrocher un stage cet été');
      expect(draftTitle().classList).not.toContain('ds-muted');
      const draft = present(element.querySelector('section[aria-labelledby="draft-title"]'), 'le brouillon');
      expect(clean(draft.querySelector('p.voix')?.textContent)).toBe('« Savoir si ce métier me plaît. »');
      expect(clean(draft.querySelector('p.corps')?.textContent)).toBe('Un stage de développement web.');
      expect(draft.textContent).toContain(formatHorizon(fromDateInputValue(due)));
      expect(draft.textContent).not.toContain(NEW_OBJECTIVE_TEXTS.noHorizon);
      expect(engageButton().disabled).toBe(false);
    });

    it("ajoute une dernière réplique d'Akari une fois le titre écrit", () => {
      expect(element.querySelectorAll('li.e-replique--assistant')).toHaveLength(4);
      write(titleInput(), 'Lire 12 livres');
      const notes = element.querySelectorAll('li.e-replique--assistant');
      expect(notes).toHaveLength(5);
      expect(clean(notes[4].textContent)).toContain("Relis ton brouillon. Change ce que tu veux avant de t'engager.");
    });

    it("ne compte pas un titre fait d'espaces", () => {
      write(titleInput(), '    ');
      expect(engageButton().disabled).toBe(true);
      leave(titleInput());
      expect(element.textContent).toContain(DRAFT_MESSAGES.titleRequired);
    });

    it("dit qu'un titre manque quand la personne quitte le champ vide", () => {
      leave(titleInput());
      expect(element.textContent).toContain(DRAFT_MESSAGES.titleRequired);
      expect(titleInput().getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe("« Je m'y engage »", () => {
    /** Le sceau attend : il garde le focus du clavier (aria-disabled), sans repartir. */
    const expectWaiting = () => {
      expect(engageButton().getAttribute('aria-disabled')).toBe('true');
      expect(engageButton().disabled).toBe(false);
      expect(clean(status().textContent)).toBe(NEW_OBJECTIVE_TEXTS.saving);
    };
    /** Le sceau répond de nouveau. */
    const expectReleased = () => {
      expect(engageButton().hasAttribute('aria-disabled')).toBe(false);
      expect(engageButton().disabled).toBe(false);
      expect(clean(status().textContent)).toBe('');
    };

    it("crée l'objectif à partir du brouillon puis ouvre Akari sur l'id définitif", async () => {
      await setup();
      const due = inDays(10);
      write(titleInput(), '  Courir un semi-marathon  ');
      write(whyInput(), '  Pour mes 30 ans. ');
      write(dueDateInput(), due);

      await engage();

      expect(store.createObjective).toHaveBeenCalledTimes(1);
      expect(store.createObjective).toHaveBeenCalledWith({
        title: 'Courir un semi-marathon',
        why: 'Pour mes 30 ans.',
        dueDate: fromDateInputValue(due),
      });
      // Pendant l'enregistrement : le sceau attend, le statut le dit.
      expectWaiting();
      expect(navigate).not.toHaveBeenCalled();

      store.succeed('objectif-42');
      await settle();

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/objectifs', 'objectif-42', 'akari']);
    });

    it('envoie la description quand elle est écrite', async () => {
      await setup();
      write(titleInput(), 'Apprendre le japonais');
      write(descriptionInput(), 'Niveau N4 avant le voyage.');
      await engage();
      expect(store.createObjective).toHaveBeenCalledWith({
        title: 'Apprendre le japonais',
        description: 'Niveau N4 avant le voyage.',
      });
    });

    it("n'ouvre pas Akari sur une création précédente qui aboutit pendant que celle-ci attend", async () => {
      await setup();
      // Une création lancée avant d'ouvrir l'écran (« Plus tard » pendant l'enregistrement, puis retour).
      store.startElsewhere('Lire 24 livres');
      write(titleInput(), 'Nouveau départ');
      await engage();

      store.succeed('objectif-precedent');
      await settle();
      expect(navigate).not.toHaveBeenCalled();
      expectWaiting();

      store.succeed('objectif-nouveau');
      await settle();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/objectifs', 'objectif-nouveau', 'akari']);
    });

    it("n'ouvre jamais Akari sur un id temporaire", async () => {
      await setup();
      write(titleInput(), 'Nouveau départ');
      await engage();
      store.lastCreatedObjectiveId.set('temp-id-123');
      await settle();
      expect(navigate).not.toHaveBeenCalled();
    });

    it("garde le brouillon et rend la main si l'enregistrement n'aboutit pas", async () => {
      await setup();
      write(titleInput(), 'Courir un semi-marathon');
      write(whyInput(), 'Pour mes 30 ans.');
      await engage();
      expectWaiting();

      store.fail();
      await settle();

      expect(navigate).not.toHaveBeenCalled();
      expectReleased();
      expect(titleInput().value).toBe('Courir un semi-marathon');
      expect(whyInput().value).toBe('Pour mes 30 ans.');
      expect(clean(draftTitle().textContent)).toBe('Courir un semi-marathon');

      // La personne peut réessayer.
      await engage();
      expect(store.createObjective).toHaveBeenCalledTimes(2);
      expectWaiting();
    });

    it("garde la main si une autre écriture n'aboutit pas pendant l'enregistrement", async () => {
      await setup();
      write(titleInput(), 'Courir un semi-marathon');
      await engage();

      // requestStatus est partagé : un pas coché, modifié ou introuvable, juste avant, ne rend pas la main.
      for (const report of [FAILURE_REPORTS.toggleTask, FAILURE_REPORTS.objectiveNotFound, FAILURE_REPORTS.taskNotFound]) {
        store.otherWriteFails(report);
        await settle();
        expectWaiting();
      }
      await engage();
      expect(store.createObjective).toHaveBeenCalledTimes(1);

      store.succeed('objectif-42');
      await settle();
      expect(navigate).toHaveBeenCalledWith(['/objectifs', 'objectif-42', 'akari']);
    });

    it("garde la main si une création précédente n'aboutit pas pendant que celle-ci attend", async () => {
      await setup();
      store.startElsewhere('Lire 24 livres');
      write(titleInput(), 'Nouveau départ');
      await engage();

      // Même phrase que pour cet objectif, mais pas pour lui : son objectif optimiste attend encore.
      store.fail();
      await settle();
      expectWaiting();
      await engage();
      expect(store.createObjective).toHaveBeenCalledTimes(1);

      store.succeed('objectif-nouveau');
      await settle();
      expect(navigate).toHaveBeenCalledWith(['/objectifs', 'objectif-nouveau', 'akari']);
    });

    it("rend la main sans ouvrir une création précédente quand celle-ci n'aboutit pas", async () => {
      await setup();
      store.startElsewhere('Lire 24 livres');
      write(titleInput(), 'Nouveau départ');
      await engage();

      store.succeed('objectif-precedent');
      await settle();
      store.fail();
      await settle();

      expect(navigate).not.toHaveBeenCalled();
      expectReleased();
    });

    it("ne part qu'une fois, même si on clique deux fois", async () => {
      await setup();
      write(titleInput(), 'Courir un semi-marathon');
      await engage();
      await engage();
      expect(store.createObjective).toHaveBeenCalledTimes(1);
    });

    it("sans session, le store ignore le geste : rien ne reste en attente", async () => {
      await setup(createStoreMock({ withSession: false }));
      write(titleInput(), 'Courir un semi-marathon');
      await engage();
      expect(store.createObjective).toHaveBeenCalledTimes(1);
      expectReleased();
    });

    it("refuse une date passée, avec la solution, et n'enregistre rien", async () => {
      await setup();
      write(titleInput(), 'Courir un semi-marathon');
      write(dueDateInput(), inDays(-1));

      await engage();

      expect(store.createObjective).not.toHaveBeenCalled();
      expect(element.textContent).toContain(DRAFT_MESSAGES.dueDateInPast);
      expect(dueDateInput().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(dueDateInput());
      expect(element.textContent).toContain(NEW_OBJECTIVE_TEXTS.noHorizon);
    });

    it("accepte aujourd'hui comme horizon", async () => {
      await setup();
      write(titleInput(), 'Ranger le grenier');
      write(dueDateInput(), inDays(0));
      await engage();
      expect(store.createObjective).toHaveBeenCalledWith({
        title: 'Ranger le grenier',
        dueDate: fromDateInputValue(inDays(0)),
      });
    });
  });

  it("appelle la personne « Toi » quand on ne connaît pas son prénom", async () => {
    await setup();
    currentUser.set({ id: 'u1', name: '', email: 'lea@example.com' });
    fixture.detectChanges();
    const authors = Array.from(element.querySelectorAll('.e-replique--personne > .e-replique__qui')).map((p) =>
      clean(p.textContent),
    );
    expect(authors).toEqual(['Toi', 'Toi', 'Toi', 'Toi']);
  });

  it("parle dans la voix d'Empreinte, dans tous ses états", async () => {
    await setup();
    const texts: string[] = [];
    const collect = () => {
      texts.push(clean(element.textContent));
      element.querySelectorAll('[placeholder], [aria-label]').forEach((el) => {
        texts.push(el.getAttribute('placeholder') ?? '', el.getAttribute('aria-label') ?? '');
      });
    };

    collect(); // vide
    leave(titleInput());
    collect(); // titre manquant
    write(titleInput(), 'Courir un semi-marathon');
    write(whyInput(), 'Pour mes 30 ans.');
    write(dueDateInput(), inDays(-3));
    leave(dueDateInput());
    collect(); // date passée
    write(dueDateInput(), inDays(30));
    await engage();
    collect(); // enregistrement en cours
    store.fail();
    await settle();
    collect(); // rendu la main

    texts.push(...Object.values(NEW_OBJECTIVE_TEXTS), ...Object.values(DRAFT_MESSAGES));
    for (const text of texts.filter(Boolean)) {
      expect(motsAEviter(text), text).toEqual([]);
      expect(voiceIssues(text), text).toEqual([]);
    }
  });
});

describe('new-objective.form', () => {
  it('prépare le brouillon pour le store : textes coupés, champs vides omis, date locale', () => {
    expect(toCreateObjectiveInput({ title: '  Lire  ', why: ' ', description: '', dueDate: '' })).toEqual({ title: 'Lire' });
    const input = toCreateObjectiveInput({ title: 'Lire', why: 'Pour moi', description: 'Douze livres', dueDate: '2027-05-01' });
    expect(input).toEqual({ title: 'Lire', why: 'Pour moi', description: 'Douze livres', dueDate: new Date(2027, 4, 1) });
    expect(input?.dueDate?.getDate()).toBe(1);
    expect(input?.dueDate?.getMonth()).toBe(4);
  });

  it("ne prépare rien sans titre", () => {
    expect(toCreateObjectiveInput({ title: '   ', why: 'Pour moi', description: '', dueDate: '' })).toBeNull();
  });

  it("compare l'horizon au jour calendaire, en heure locale", () => {
    const now = new Date(2026, 9, 21, 18, 30);
    expect(isBeforeToday('2026-10-20', now)).toBe(true);
    expect(isBeforeToday('2026-10-21', now)).toBe(false);
    expect(isBeforeToday('2026-10-22', now)).toBe(false);
    expect(isBeforeToday('', now)).toBe(false);
    expect(todayInputValue(now)).toBe('2026-10-21');
  });
});

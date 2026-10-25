import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { EIcone, motsAEviter } from '@empreinte-studio/angular';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { voiceIssues } from '../../chore/constants/messages.constante';
import type { ObjectiveCardViewModel } from '../../chore/models/objective-card.viewmodel';
import { TODAY_CHECK_INTERVAL, formatToday } from '../../chore/clock/today';
import { Objectives, cardProgress } from './objectives';

/** Une carte d'objectif, à compléter selon le cas. */
function card(overrides: Partial<ObjectiveCardViewModel> = {}): ObjectiveCardViewModel {
  return {
    id: 'semi',
    title: 'Courir un semi-marathon en mai',
    why: 'Pour me prouver que je peux tenir quelque chose sur six mois.',
    horizon: "Jusqu'en mai",
    stageProgress: { done: 2, inProgress: true, upcoming: 3, inProgressName: 'Endurance' },
    stageCount: 6,
    taskCount: { done: 9, total: 20 },
    nextTask: { id: 't1', title: 'Sortie de 30 minutes en endurance', done: false },
    accomplished: false,
    ...overrides,
  };
}

const ACCOMPLISHED = card({
  id: 'studio',
  title: "M'installer dans mon studio",
  why: '',
  horizon: '',
  stageProgress: { done: 2, inProgress: false, upcoming: 0 },
  stageCount: 2,
  taskCount: { done: 5, total: 5 },
  nextTask: null,
  accomplished: true,
});

/** Un ObjectiveStore simulé : seulement ce que l'écran lit et appelle. */
function createStore() {
  return {
    objectiveCards: signal<ObjectiveCardViewModel[]>([]),
    accomplishedObjectives: signal<ObjectiveCardViewModel[]>([]),
    objectivesLoaded: signal(false),
    error: signal<string | null>(null),
    updateTaskDone: vi.fn(),
  };
}

type StoreMock = ReturnType<typeof createStore>;

/** AnnoncesStore simulé : l'écran lit seulement s'il y a un signalement affiché par la coque. */
function createAnnonces() {
  return { aUnSignalement: signal(false) };
}

describe('Objectives', () => {
  let store: StoreMock;
  let annonces: ReturnType<typeof createAnnonces>;
  let fixture: ComponentFixture<Objectives>;
  let element: HTMLElement;

  const render = () => {
    fixture.detectChanges();
    return element;
  };
  const text = (selector: string) => element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const texts = (selector: string) =>
    [...element.querySelectorAll(selector)].map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');

  beforeEach(async () => {
    store = createStore();
    annonces = createAnnonces();
    await TestBed.configureTestingModule({
      imports: [Objectives],
      providers: [
        provideRouter([]),
        { provide: ObjectiveStore, useValue: store },
        { provide: AnnoncesStore, useValue: annonces },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Objectives);
    element = fixture.nativeElement as HTMLElement;
  });

  describe('en-tête', () => {
    it('dit la date du jour, le manifeste et ce qui est en marche et accompli', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card(), card({ id: 'licence', title: 'Valider ma première année' })]);
      store.accomplishedObjectives.set([ACCOMPLISHED]);
      render();

      expect(text('header .repere')).toBe(formatToday(new Date()));
      expect(text('h1.manifeste')).toBe('Mes objectifs');
      expect(text('header .detail')).toBe('2 en marche · 1 accompli');
    });

    it('passe au jour suivant à minuit, même si l’écran reste ouvert, et arrête de vérifier en partant', () => {
      fixture.destroy(); // un seul écran à la fois (et un seul sceau)
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      try {
        vi.setSystemTime(new Date(2026, 9, 19, 23, 59, 30));
        const late = TestBed.createComponent(Objectives);
        late.detectChanges();
        const repere = () => (late.nativeElement as HTMLElement).querySelector('header .repere time') as HTMLTimeElement;
        expect(repere().textContent?.trim()).toBe('Lundi 19 octobre');
        expect(vi.getTimerCount()).toBe(1);

        vi.advanceTimersByTime(TODAY_CHECK_INTERVAL);
        late.detectChanges();
        expect(repere().textContent?.trim()).toBe('Mardi 20 octobre');
        expect(repere().getAttribute('datetime')).toBe('2026-10-20');

        late.destroy();
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('écrit la date en français, avec une majuscule', () => {
      expect(formatToday(new Date(2026, 9, 19))).toBe('Lundi 19 octobre');
      expect(formatToday(new Date(2026, 9, 21))).toBe('Mercredi 21 octobre');
    });

    it('accorde le compte des accomplis et omet ce qui vaut zéro', () => {
      store.objectivesLoaded.set(true);
      store.accomplishedObjectives.set([ACCOMPLISHED, { ...ACCOMPLISHED, id: 'permis' }]);
      render();
      expect(text('header .detail')).toBe('2 accomplis');
    });

    it('porte un seul sceau, « Nouvel objectif », qui mène au nouvel objectif', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      store.accomplishedObjectives.set([ACCOMPLISHED]);
      render();

      const seals = element.querySelectorAll('.e-btn--sceau');
      expect(seals).toHaveLength(1);
      expect(seals[0].textContent?.trim()).toBe('Nouvel objectif');
      expect(seals[0].getAttribute('href')).toBe('/objectifs/nouveau');
    });
  });

  describe('cartes des objectifs en marche', () => {
    it('montre l’horizon, le nom lié à la carte, le pourquoi entre « » et la progression par étapes', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();

      const article = element.querySelector('article.e-carte') as HTMLElement;
      expect(article).toBeTruthy();
      // Un seul filet entre deux cartes : la trame sait que ses enfants dessinent déjà le leur.
      expect(article.parentElement?.classList).toContain('cards');
      expect(article.parentElement?.classList).toContain('ds-panels');
      expect(article.classList.contains('e-carte--marquee')).toBe(false);
      const title = article.querySelector('h2.objectif') as HTMLElement;
      expect(title.textContent?.trim()).toBe('Courir un semi-marathon en mai');
      expect(article.getAttribute('aria-labelledby')).toBe(title.id);
      expect(article.textContent).toContain("Jusqu'en mai");
      expect(text('article .voix')).toBe('« Pour me prouver que je peux tenir quelque chose sur six mois. »');
      expect(text('article .e-pas__legende')).toBe('2 étapes faites · Endurance en cours');
    });

    it('offre le prochain pas avec sa case, et « Ouvrir » vers l’arête', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();

      const box = element.querySelector('input[type=checkbox]') as HTMLInputElement;
      expect(box.classList.contains('e-case')).toBe(true);
      expect(text(`label[for="${box.id}"]`)).toBe('Sortie de 30 minutes en endurance');
      expect(text(`#${box.getAttribute('aria-describedby')}`)).toBe('Prochain pas');
      const open = [...element.querySelectorAll('article a')].find((a) => a.textContent?.trim() === 'Ouvrir');
      expect(open?.getAttribute('href')).toBe('/objectifs/semi');
      // « Ouvrir » dit quel objectif il ouvre.
      expect(text(`#${open?.getAttribute('aria-describedby')}`)).toBe('Courir un semi-marathon en mai');
    });

    it('cocher le prochain pas passe par la mise à jour optimiste du store', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();

      (element.querySelector('input[type=checkbox]') as HTMLInputElement).click();
      expect(store.updateTaskDone).toHaveBeenCalledWith({ taskId: 't1', done: true });
    });

    it('le pas suivant arrive avec une case vide, pas avec celle qu’on vient de cocher', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      store.updateTaskDone.mockImplementation(() =>
        store.objectiveCards.set([card({ nextTask: { id: 't2', title: 'Courir 8 km', done: false } })]),
      );
      render();

      (element.querySelector('input[type=checkbox]') as HTMLInputElement).click();
      render();

      const box = element.querySelector('input[type=checkbox]') as HTMLInputElement;
      expect(box.id).toBe('prochain-pas-t2');
      expect(box.checked).toBe(false);
      expect(text(`label[for="${box.id}"]`)).toBe('Courir 8 km');
    });

    it('au clavier, le focus passe à la case du nouveau prochain pas', async () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      store.updateTaskDone.mockImplementation(() =>
        store.objectiveCards.set([card({ nextTask: { id: 't2', title: 'Courir 8 km', done: false } })]),
      );
      render();

      const checked = element.querySelector('#prochain-pas-t1') as HTMLInputElement;
      checked.focus();
      checked.click();
      render();
      await fixture.whenStable();

      // La case cochée a disparu : le focus n'est pas tombé sur la page.
      expect(checked.isConnected).toBe(false);
      expect(document.activeElement).toBe(element.querySelector('#prochain-pas-t2'));
    });

    it('sans prochain pas, le focus va au lien « Ouvrir » de la carte', async () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      store.updateTaskDone.mockImplementation(() => store.objectiveCards.set([card({ nextTask: null })]));
      render();

      const checked = element.querySelector('#prochain-pas-t1') as HTMLInputElement;
      checked.focus();
      checked.click();
      render();
      await fixture.whenStable();

      expect(document.activeElement).toBe(element.querySelector('#ouvrir-semi'));
      expect(document.activeElement?.textContent?.trim()).toBe('Ouvrir');
    });

    it('le dernier pas coché range la carte dans « Accomplis » : le focus va au résumé de la liste', async () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      store.updateTaskDone.mockImplementation(() => {
        store.objectiveCards.set([]);
        store.accomplishedObjectives.set([card({ nextTask: null, accomplished: true })]);
      });
      render();

      const checked = element.querySelector('#prochain-pas-t1') as HTMLInputElement;
      checked.focus();
      checked.click();
      render();
      await fixture.whenStable();

      expect(document.activeElement).toBe(element.querySelector('details > summary'));
    });

    it('laisse le focus où il est quand la personne est ailleurs', async () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      store.updateTaskDone.mockImplementation(() =>
        store.objectiveCards.set([card({ nextTask: { id: 't2', title: 'Courir 8 km', done: false } })]),
      );
      render();

      const seal = element.querySelector('.e-btn--sceau') as HTMLElement;
      (element.querySelector('#prochain-pas-t1') as HTMLInputElement).click();
      seal.focus();
      render();
      await fixture.whenStable();

      expect(document.activeElement).toBe(seal);
    });

    it('sans étape, la progression se lit par pas', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([
        card({ stageCount: 0, stageProgress: { done: 0, inProgress: false, upcoming: 0 }, taskCount: { done: 1, total: 3 } }),
      ]);
      render();
      expect(text('article .e-pas__legende')).toBe('1 pas fait · 2 à venir');
    });

    it('au-delà de 12 étapes, la légende se lit seule, sans barre', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([
        card({ stageCount: 14, stageProgress: { done: 3, inProgress: true, upcoming: 10, inProgressName: 'Endurance' } }),
      ]);
      render();
      expect(element.querySelector('e-pas')).toBeNull();
      expect(text('article > p.detail')).toBe('3 étapes faites · Endurance en cours');
    });

    it('sans étape ni pas, invite à poser la première étape', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([
        card({
          stageCount: 0,
          stageProgress: { done: 0, inProgress: false, upcoming: 0 },
          taskCount: { done: 0, total: 0 },
          nextTask: null,
        }),
      ]);
      render();

      expect(element.querySelector('e-pas')).toBeNull();
      expect(element.querySelector('article')?.textContent).toContain(
        "Aucune étape pour l'instant. Pose la première quand tu veux.",
      );
      expect(element.querySelector('input[type=checkbox]')).toBeNull();
    });

    it('un objectif pas encore enregistré ne met pas son id temporaire dans une adresse', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card({ id: 'temp-id-123', nextTask: null })]);
      render();

      expect(element.querySelector('article a')).toBeNull();
      const open = element.querySelector('article button') as HTMLButtonElement;
      expect(open.textContent?.trim()).toBe('Ouvrir');
      expect(open.disabled).toBe(true);
    });
  });

  describe('état vide et chargement', () => {
    it('tant que les objectifs ne sont pas chargés (chargement en cours, ou qui n’a pas abouti), rien ne dit « vide »', () => {
      render();
      expect(element.querySelector('aside.e-note')).toBeNull();
      expect(element.querySelector('article')).toBeNull();
      expect(element.querySelector('header .detail')).toBeNull();
      expect(text('h1')).toBe('Mes objectifs');
    });

    it('une fois chargé, sans objectif en marche, Akari demande ce que tu veux construire', () => {
      store.objectivesLoaded.set(true);
      render();

      const note = element.querySelector('aside.e-note') as HTMLElement;
      expect(note).toBeTruthy();
      expect(note.querySelector('.e-note__qui')?.textContent).toContain('Akari');
      expect(note.textContent).toContain("Qu'est-ce que tu veux construire ?");
      const start = note.querySelector('a') as HTMLAnchorElement;
      expect(start.getAttribute('href')).toBe('/objectifs/nouveau');
      expect(start.classList.contains('e-btn--trait')).toBe(true);
      expect(element.querySelectorAll('.e-btn--sceau')).toHaveLength(1);
    });

    it('né après le chargement, l’écran le sait tout de suite', () => {
      // La personne revient à l'accueil : les objectifs sont chargés depuis longtemps, quoi qu'aient dit les
      // écritures depuis (requestStatus est partagé ; objectivesLoaded, lui, ne bouge pas avec elles).
      store.objectivesLoaded.set(true);
      render();
      expect(element.querySelector('aside.e-note')?.textContent).toContain("Qu'est-ce que tu veux construire ?");
    });

    it('tant que la coque affiche un signalement, Akari ne pose pas sa question : une note à la fois', () => {
      store.objectivesLoaded.set(true);
      annonces.aUnSignalement.set(true);
      render();
      expect(element.querySelector('aside.e-note')).toBeNull();

      annonces.aUnSignalement.set(false); // « Compris »
      render();
      expect(element.querySelector('aside.e-note')).toBeTruthy();
    });

    it('pendant le premier chargement, l’écran le dit dans une ligne d’état', () => {
      render();
      expect(text('[role="status"]')).toBe('Chargement de tes objectifs…');

      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();
      expect(element.querySelector('[role="status"]')).toBeNull();
    });

    it('après un chargement qui n’aboutit pas, l’écran attend la lecture de la note, puis dit quoi faire', () => {
      store.error.set("Je n'ai pas pu charger tes objectifs. Vérifie ta connexion, puis recharge la page.");
      annonces.aUnSignalement.set(true);
      render();
      // La note de la coque explique : ni « Chargement… », ni une seconde phrase.
      expect(element.querySelector('[role="status"]')).toBeNull();
      expect(element.querySelector('p.corps')).toBeNull();
      expect(text('h1')).toBe('Mes objectifs');

      annonces.aUnSignalement.set(false); // « Compris »
      render();
      expect(text('p.corps')).toBe('Tes objectifs ne sont pas chargés. Vérifie ta connexion, puis recharge la page.');
      expect(element.querySelector('aside.e-note')).toBeNull();
    });

    it('des objectifs arrivés avant la fin du chargement s’affichent quand même', () => {
      store.objectiveCards.set([card()]);
      render();
      expect(element.querySelectorAll('article')).toHaveLength(1);
      expect(element.querySelector('aside.e-note')).toBeNull();
    });
  });

  describe('Accomplis', () => {
    beforeEach(() => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      store.accomplishedObjectives.set([ACCOMPLISHED]);
    });

    it('est replié sous la grille, avec le compte', () => {
      render();
      const details = element.querySelector('details') as HTMLDetailsElement;
      expect(details.open).toBe(false);
      expect(details.compareDocumentPosition(element.querySelector('.ds-panels') as Node) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
      expect(texts('summary span')).toEqual(['Accomplis', '1']);
    });

    it('chaque ligne porte la petite empreinte, « Accompli » et un lien vers l’objectif', () => {
      render();
      const row = element.querySelector('details li') as HTMLElement;
      expect(row.querySelector('e-empreinte')).toBeTruthy();
      expect(row.textContent).toContain("M'installer dans mon studio");
      expect(row.textContent).toContain('Accompli');
      expect(row.querySelector('a')?.getAttribute('href')).toBe('/objectifs/studio');
      expect(element.textContent).not.toMatch(/laiss[ée] filer/i);
    });

    it('se déplie et change de chevron', () => {
      render();
      const chevron = () => fixture.debugElement.query(By.css('summary')).query(By.directive(EIcone)).componentInstance as EIcone;
      expect(chevron().nom()).toBe('chevron-droite');

      const details = element.querySelector('details') as HTMLDetailsElement;
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
      render();

      expect(chevron().nom()).toBe('chevron-bas');
    });

    it('n’apparaît pas sans objectif accompli', () => {
      store.accomplishedObjectives.set([]);
      render();
      expect(element.querySelector('details')).toBeNull();
    });
  });

  describe('voix', () => {
    it('tous les textes de l’écran parlent comme Empreinte', () => {
      const seen: string[] = [];
      const collect = () => {
        render();
        seen.push(element.textContent ?? '');
        for (const node of element.querySelectorAll('[aria-label]')) seen.push(node.getAttribute('aria-label') ?? '');
      };

      collect(); // premier chargement
      store.error.set('chargement non abouti');
      collect(); // chargement qui n'a pas abouti, note lue
      store.error.set(null);
      store.objectivesLoaded.set(true);
      collect(); // vide
      store.objectiveCards.set([
        card(),
        card({ id: 'b', stageCount: 0, stageProgress: { done: 0, inProgress: false, upcoming: 0 }, taskCount: { done: 2, total: 5 } }),
        card({ id: 'c', stageCount: 0, stageProgress: { done: 0, inProgress: false, upcoming: 0 }, taskCount: { done: 0, total: 0 }, nextTask: null }),
        card({ id: 'd', stageCount: 2, stageProgress: { done: 2, inProgress: false, upcoming: 0 }, taskCount: { done: 6, total: 8 } }),
        card({ id: 'e', stageCount: 14, stageProgress: { done: 3, inProgress: true, upcoming: 10, inProgressName: 'Endurance' } }),
        card({ id: 'temp-id-9', nextTask: null }),
      ]);
      store.accomplishedObjectives.set([ACCOMPLISHED]);
      collect(); // plein

      for (const value of seen) {
        expect(motsAEviter(value)).toEqual([]);
        expect(voiceIssues(value)).toEqual([]);
      }
    });
  });
});

describe('cardProgress', () => {
  it('suit les étapes quand l’objectif en a', () => {
    expect(cardProgress(card())).toEqual({
      kind: 'cases',
      unit: 'etape',
      done: 2,
      inProgress: true,
      upcoming: 3,
      currentName: 'Endurance',
      legend: undefined,
    });
  });

  it('ne dit pas « accompli » quand toutes les étapes sont faites mais que des pas sans étape attendent', () => {
    const progress = cardProgress(
      card({ stageCount: 3, stageProgress: { done: 3, inProgress: false, upcoming: 0 }, taskCount: { done: 7, total: 9 } }),
    );
    expect(progress).toMatchObject({ kind: 'cases', legend: '3 étapes faites · 2 pas sans étape à venir' });
  });

  it('compte les pas quand il n’y a pas d’étape : le prochain est en cours', () => {
    expect(
      cardProgress(card({ stageCount: 0, stageProgress: { done: 0, inProgress: false, upcoming: 0 }, taskCount: { done: 4, total: 7 } })),
    ).toEqual({ kind: 'cases', unit: 'pas', done: 4, inProgress: true, upcoming: 2 });
  });

  it('au-delà de 12 cases, ne garde que la légende', () => {
    expect(
      cardProgress(card({ stageCount: 0, stageProgress: { done: 0, inProgress: false, upcoming: 0 }, taskCount: { done: 4, total: 20 } })),
    ).toEqual({ kind: 'legend', text: '4 pas faits · 16 à venir' });
  });

  it('sans étape ni pas, invite à commencer', () => {
    expect(
      cardProgress(card({ stageCount: 0, stageProgress: { done: 0, inProgress: false, upcoming: 0 }, taskCount: { done: 0, total: 0 } })),
    ).toEqual({ kind: 'invite' });
  });
});

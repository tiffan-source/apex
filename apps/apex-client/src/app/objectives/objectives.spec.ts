import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { motsAEviter } from '@empreinte-studio/angular';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { voiceIssues } from '../../chore/constants/messages.constante';
import type { ObjectiveCardViewModel } from '../../chore/models/objective-card.viewmodel';
import { TODAY_CHECK_INTERVAL, formatToday } from '../../chore/clock/today';
import { Objectives, cardContents } from './objectives';

/** Une carte d'objectif, à compléter selon le cas. */
function card(overrides: Partial<ObjectiveCardViewModel> = {}): ObjectiveCardViewModel {
  return {
    id: 'semi',
    title: 'Courir un semi-marathon en mai',
    why: 'Pour me prouver que je peux tenir quelque chose sur six mois.',
    horizon: "Jusqu'en mai",
    stageCount: 6,
    taskCount: 20,
    ...overrides,
  };
}

/** Un ObjectiveStore simulé : seulement ce que l'écran lit. */
function createStore() {
  return {
    objectiveCards: signal<ObjectiveCardViewModel[]>([]),
    objectivesLoaded: signal(false),
    error: signal<string | null>(null),
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
    it('dit la date du jour, le manifeste et le nombre d’objectifs', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card(), card({ id: 'licence', title: 'Valider ma première année' })]);
      render();

      expect(text('header .repere')).toBe(formatToday(new Date()));
      expect(text('h1.manifeste')).toBe('Mes objectifs');
      expect(text('header .detail')).toBe('2 objectifs');
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

    it('accorde le compte au singulier', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();
      expect(text('header .detail')).toBe('1 objectif');
    });

    it('porte un seul sceau, « Nouvel objectif », qui mène au nouvel objectif', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();

      const seals = element.querySelectorAll('.e-btn--sceau');
      expect(seals).toHaveLength(1);
      expect(seals[0].textContent?.trim()).toBe('Nouvel objectif');
      expect(seals[0].getAttribute('href')).toBe('/objectifs/nouveau');
    });
  });

  describe('cartes des objectifs', () => {
    it('montre l’horizon, le nom lié à la carte, le pourquoi entre « » et ce que l’objectif porte', () => {
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
      expect(article.textContent).toContain('6 étapes · 20 pas');
    });

    it('ne dit rien de la progression : ni cases, ni prochain pas, ni « Accomplis »', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();

      expect(element.querySelector('e-pas')).toBeNull();
      expect(element.querySelector('input[type=checkbox]')).toBeNull();
      expect(element.querySelector('details')).toBeNull();
      expect(element.textContent).not.toMatch(/prochain pas|accompli|en cours|à venir/i);
    });

    it('« Ouvrir » mène à l’arête et dit quel objectif il ouvre', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();

      const open = [...element.querySelectorAll('article a')].find((a) => a.textContent?.trim() === 'Ouvrir');
      expect(open?.getAttribute('href')).toBe('/objectifs/semi');
      expect(text(`#${open?.getAttribute('aria-describedby')}`)).toBe('Courir un semi-marathon en mai');
    });

    it('sans étape, la carte compte ses pas', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card({ stageCount: 0, taskCount: 3 })]);
      render();
      expect(element.querySelector('article')?.textContent).toContain('3 pas');
      expect(element.querySelector('article')?.textContent).not.toContain("Aucune étape pour l'instant");
    });

    it('sans étape ni pas, invite à poser la première étape', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card({ stageCount: 0, taskCount: 0 })]);
      render();

      expect(element.querySelector('article')?.textContent).toContain(
        "Aucune étape pour l'instant. Pose la première quand tu veux.",
      );
    });

    it('un objectif pas encore enregistré ne met pas son id temporaire dans une adresse', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card({ id: 'temp-id-123' })]);
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

    it('une fois chargé, sans objectif, Akari demande ce que tu veux construire', () => {
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
        card({ id: 'b', stageCount: 0, taskCount: 5 }),
        card({ id: 'c', stageCount: 0, taskCount: 0 }),
        card({ id: 'd', stageCount: 1, taskCount: 1 }),
        card({ id: 'temp-id-9' }),
      ]);
      collect(); // plein

      for (const value of seen) {
        expect(motsAEviter(value)).toEqual([]);
        expect(voiceIssues(value)).toEqual([]);
      }
    });
  });
});

describe('cardContents', () => {
  it('dit ce que l’objectif porte : étapes et pas, au singulier comme au pluriel', () => {
    expect(cardContents(card())).toBe('6 étapes · 20 pas');
    expect(cardContents(card({ stageCount: 1, taskCount: 1 }))).toBe('1 étape · 1 pas');
  });

  it('omet ce qui vaut zéro, et reste vide quand l’objectif ne porte rien encore', () => {
    expect(cardContents(card({ stageCount: 2, taskCount: 0 }))).toBe('2 étapes');
    expect(cardContents(card({ stageCount: 0, taskCount: 4 }))).toBe('4 pas');
    expect(cardContents(card({ stageCount: 0, taskCount: 0 }))).toBe('');
  });
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { AxIcon, motsAEviter } from '../../ui';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { SessionStore } from '../../chore/stores/session.store';
import { voiceIssues } from '../../chore/constants/messages.constante';
import type { ObjectiveCardViewModel } from '../../chore/models/objective-card.viewmodel';
import { TODAY_CHECK_INTERVAL, formatToday } from '../../chore/clock/today';
import { Objectives, cardProgress, greetingWord } from './objectives';

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
  let navigate: ReturnType<typeof vi.fn>;

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
        { provide: SessionStore, useValue: { currentUser: signal({ id: 'u-1', name: 'Léa Martin', email: 'lea@exemple.fr' }) } },
      ],
    }).compileComponents();

    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(Objectives);
    element = fixture.nativeElement as HTMLElement;
  });

  describe('le panneau d’encre', () => {
    it('dit la date du jour, salue la personne par son prénom et dit ce qui avance', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card(), card({ id: 'licence', title: 'Valider ma première année' })]);
      store.accomplishedObjectives.set([ACCOMPLISHED]);
      render();

      expect(text('.hero time')).toBe(formatToday(new Date()));
      expect(text('.hero h1')).toBe(`${greetingWord(new Date().getHours())}, Léa.`);
      expect(text('.hero-line')).toBe("2 objectifs avancent. Un pas t'attend.");
    });

    it('dit « Bonjour » le jour et « Bonsoir » à partir de 18 h', () => {
      expect(greetingWord(9)).toBe('Bonjour');
      expect(greetingWord(17)).toBe('Bonjour');
      expect(greetingWord(18)).toBe('Bonsoir');
      expect(greetingWord(2)).toBe('Bonsoir');
    });

    it('passe au jour suivant à minuit, même si l’écran reste ouvert, et arrête de vérifier en partant', () => {
      fixture.destroy();
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      try {
        vi.setSystemTime(new Date(2026, 9, 19, 23, 59, 30));
        const late = TestBed.createComponent(Objectives);
        late.detectChanges();
        const time = () => (late.nativeElement as HTMLElement).querySelector('.hero time') as HTMLTimeElement;
        expect(time().textContent?.trim()).toBe('Lundi 19 octobre');
        expect(vi.getTimerCount()).toBe(1);

        vi.advanceTimersByTime(TODAY_CHECK_INTERVAL);
        late.detectChanges();
        expect(time().textContent?.trim()).toBe('Mardi 20 octobre');
        expect(time().getAttribute('datetime')).toBe('2026-10-20');

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

    it('met en avant le premier prochain pas, à cocher, avec son objectif et son étape', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card({ nextTask: null }), card({ id: 'licence', title: 'Valider ma première année', nextTask: { id: 't9', title: 'Relire le chapitre 3', done: false } })]);
      render();

      const box = element.querySelector('.hero input[type=checkbox]') as HTMLInputElement;
      expect(box.id).toBe('focus-t9');
      expect(text(`label[for="${box.id}"]`)).toBe('Relire le chapitre 3');
      expect(text('.next-text .small')).toBe('Valider ma première année · Endurance');
      expect(element.querySelector('.next a')?.getAttribute('href')).toBe('/objectifs/licence');

      box.click();
      expect(store.updateTaskDone).toHaveBeenCalledWith({ taskId: 't9', done: true });
    });

    it('coché depuis le panneau, le focus passe au nouveau prochain pas du panneau', async () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      store.updateTaskDone.mockImplementation(() =>
        store.objectiveCards.set([card({ nextTask: { id: 't2', title: 'Courir 8 km', done: false } })]),
      );
      render();

      const checked = element.querySelector('#focus-t1') as HTMLInputElement;
      checked.focus();
      checked.click();
      render();
      await fixture.whenStable();
      expect(document.activeElement).toBe(element.querySelector('#focus-t2'));
    });

    it('trace un anneau par objectif qui a des pas, nommé par le total', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([
        card(),
        card({ id: 'b', title: 'Lire 12 livres', taskCount: { done: 3, total: 4 } }),
        card({ id: 'c', title: 'Sans pas', taskCount: { done: 0, total: 0 }, nextTask: null }),
      ]);
      render();

      const rings = element.querySelector('ax-rings') as HTMLElement;
      expect(rings.getAttribute('aria-label')).toBe('12 pas faits sur 24');
      expect(rings.querySelectorAll('circle.arc')).toHaveLength(2);
      expect(texts('.legend .legend-name')).toEqual(['Courir un semi-marathon en mai', 'Lire 12 livres']);
    });

    it('mène au nouvel objectif par « Nouvel objectif »', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();
      const link = [...element.querySelectorAll('a')].find((a) => a.textContent?.trim() === 'Nouvel objectif');
      expect(link?.getAttribute('href')).toBe('/objectifs/nouveau');
    });
  });

  describe('cartes des objectifs en marche', () => {
    it('montre l’horizon, le nom lié à la carte, le pourquoi et la progression par étapes', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();

      const article = element.querySelector('article.obj') as HTMLElement;
      expect(article).toBeTruthy();
      expect(article.parentElement?.classList).toContain('cards');
      const title = article.querySelector('h3') as HTMLElement;
      expect(title.textContent?.trim()).toBe('Courir un semi-marathon en mai');
      expect(article.getAttribute('aria-labelledby')).toBe(title.id);
      expect(article.textContent).toContain("Jusqu'en mai");
      expect(text('article .obj-why')).toBe('Pour me prouver que je peux tenir quelque chose sur six mois.');
      expect(text('article .obj-legend .small')).toBe('Étape 3 · Endurance');
      expect(article.querySelector('ax-steps')?.getAttribute('aria-label')).toBe('2 étapes faites, 1 en cours, 3 à venir');
      expect(article.querySelector('.tile')?.className).toMatch(/l-(ciel|fjord|soleil|aube)/);
    });

    it('offre le prochain pas avec sa case, et « Ouvrir » vers l’objectif', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();

      const box = element.querySelector('article input[type=checkbox]') as HTMLInputElement;
      expect(box.classList.contains('check')).toBe(true);
      expect(text(`label[for="${box.id}"]`)).toBe('Sortie de 30 minutes en endurance');
      expect(text(`#${box.getAttribute('aria-describedby')}`)).toBe('Prochain pas');
      const open = [...element.querySelectorAll('article a')].find((a) => a.textContent?.trim() === 'Ouvrir');
      expect(open?.getAttribute('href')).toBe('/objectifs/semi');
      expect(text(`#${open?.getAttribute('aria-describedby')}`)).toBe('Courir un semi-marathon en mai');
    });

    it('cocher le prochain pas passe par la mise à jour optimiste du store', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      render();

      (element.querySelector('#prochain-pas-t1') as HTMLInputElement).click();
      expect(store.updateTaskDone).toHaveBeenCalledWith({ taskId: 't1', done: true });
    });

    it('le pas suivant arrive avec une case vide, pas avec celle qu’on vient de cocher', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      store.updateTaskDone.mockImplementation(() =>
        store.objectiveCards.set([card({ nextTask: { id: 't2', title: 'Courir 8 km', done: false } })]),
      );
      render();

      (element.querySelector('#prochain-pas-t1') as HTMLInputElement).click();
      render();

      const box = element.querySelector('article input[type=checkbox]') as HTMLInputElement;
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

      const elsewhere = [...element.querySelectorAll<HTMLElement>('a')].find((a) => a.textContent?.trim() === 'Nouvel objectif') as HTMLElement;
      (element.querySelector('#prochain-pas-t1') as HTMLInputElement).click();
      elsewhere.focus();
      render();
      await fixture.whenStable();

      expect(document.activeElement).toBe(elsewhere);
    });

    it('sans étape, la progression se lit par pas', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([
        card({ stageCount: 0, stageProgress: { done: 0, inProgress: false, upcoming: 0 }, taskCount: { done: 1, total: 3 } }),
      ]);
      render();
      expect(text('article .obj-legend .small')).toBe('1 pas fait · 2 à venir');
    });

    it('au-delà de 12 étapes, la légende se lit seule, sans barre', () => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([
        card({ stageCount: 14, stageProgress: { done: 3, inProgress: true, upcoming: 10, inProgressName: 'Endurance' } }),
      ]);
      render();
      expect(element.querySelector('article ax-steps')).toBeNull();
      expect(text('article .obj-progress p')).toBe('3 étapes faites · Endurance en cours');
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

      expect(element.querySelector('article ax-steps')).toBeNull();
      expect(element.querySelector('article')?.textContent).toContain("Aucune étape pour l'instant. Pose la première quand tu veux.");
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

  describe('premier lancement et chargement', () => {
    it('tant que les objectifs ne sont pas chargés, rien ne dit « vide »', () => {
      render();
      expect(element.querySelector('.welcome')).toBeNull();
      expect(element.querySelector('article')).toBeNull();
      expect(element.querySelector('.hero-line')).toBeNull();
    });

    it('une fois chargé, sans objectif en marche, Akari demande ce que tu veux construire', () => {
      store.objectivesLoaded.set(true);
      render();

      const welcome = element.querySelector('.welcome') as HTMLElement;
      expect(welcome).toBeTruthy();
      expect(welcome.querySelector('.chip')?.textContent).toContain('Akari');
      expect(text('.welcome h1')).toBe("Qu'est-ce que tu veux construire ?");
      expect(element.querySelector('.hero')).toBeNull();
      expect(texts('.trio h3')).toEqual(['Un objectif', 'Des étapes', 'Des pas']);
    });

    it('le premier objectif s’écrit tout de suite et ouvre le nouvel objectif avec ce titre', () => {
      store.objectivesLoaded.set(true);
      render();

      const input = element.querySelector('#premier-objectif') as HTMLInputElement;
      input.value = '  Apprendre le piano  ';
      (element.querySelector('.composer') as HTMLFormElement).dispatchEvent(new Event('submit'));
      expect(navigate).toHaveBeenCalledWith(['/objectifs/nouveau'], { queryParams: { titre: 'Apprendre le piano' } });

      const idea = [...element.querySelectorAll<HTMLButtonElement>('.idea')].find((b) => b.textContent?.trim() === 'Courir un 10 km');
      idea?.click();
      expect(navigate).toHaveBeenCalledWith(['/objectifs/nouveau'], { queryParams: { titre: 'Courir un 10 km' } });
    });

    it('sans titre, ouvre le nouvel objectif vide', () => {
      store.objectivesLoaded.set(true);
      render();
      (element.querySelector('.composer') as HTMLFormElement).dispatchEvent(new Event('submit'));
      expect(navigate).toHaveBeenCalledWith(['/objectifs/nouveau'], {});
    });

    it('tant que la coque affiche un signalement, Akari ne pose pas sa question : une note à la fois', () => {
      store.objectivesLoaded.set(true);
      annonces.aUnSignalement.set(true);
      render();
      expect(element.querySelector('.welcome')).toBeNull();

      annonces.aUnSignalement.set(false);
      render();
      expect(element.querySelector('.welcome')).toBeTruthy();
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
      expect(element.querySelector('[role="status"]')).toBeNull();
      expect(element.textContent).not.toContain('Tes objectifs ne sont pas chargés');

      annonces.aUnSignalement.set(false);
      render();
      expect(element.textContent).toContain('Tes objectifs ne sont pas chargés. Vérifie ta connexion, puis recharge la page.');
      expect(element.querySelector('.welcome')).toBeNull();
    });

    it('des objectifs arrivés avant la fin du chargement s’affichent quand même', () => {
      store.objectiveCards.set([card()]);
      render();
      expect(element.querySelectorAll('article')).toHaveLength(1);
      expect(element.querySelector('.welcome')).toBeNull();
    });
  });

  describe('Accomplis', () => {
    beforeEach(() => {
      store.objectivesLoaded.set(true);
      store.objectiveCards.set([card()]);
      store.accomplishedObjectives.set([ACCOMPLISHED]);
    });

    it('est replié sous les cartes, avec le compte', () => {
      render();
      const details = element.querySelector('details') as HTMLDetailsElement;
      expect(details.open).toBe(false);
      expect(details.compareDocumentPosition(element.querySelector('.cards') as Node) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
      expect(texts('summary span')).toEqual(['Accomplis', '1']);
    });

    it('chaque ligne porte l’empreinte, « Accompli » et un lien vers l’objectif', () => {
      render();
      const row = element.querySelector('details li') as HTMLElement;
      expect(row.querySelector('.seal')).toBeTruthy();
      expect(row.textContent).toContain("M'installer dans mon studio");
      expect(row.textContent).toContain('Accompli');
      expect(row.querySelector('a')?.getAttribute('href')).toBe('/objectifs/studio');
    });

    it('se déplie et change de chevron', () => {
      render();
      const chevron = () => fixture.debugElement.query(By.css('summary')).query(By.directive(AxIcon)).componentInstance as AxIcon;
      expect(chevron().name()).toBe('chevron-droite');

      const details = element.querySelector('details') as HTMLDetailsElement;
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
      render();

      expect(chevron().name()).toBe('chevron-bas');
    });

    it('reste visible sous le premier lancement quand tout est accompli', () => {
      store.objectiveCards.set([]);
      render();
      expect(element.querySelector('.welcome')).toBeTruthy();
      expect(element.querySelector('details')).toBeTruthy();
    });

    it('n’apparaît pas sans objectif accompli', () => {
      store.accomplishedObjectives.set([]);
      render();
      expect(element.querySelector('details')).toBeNull();
    });
  });

  describe('voix', () => {
    it('tous les textes de l’écran parlent comme Apex', () => {
      const seen: string[] = [];
      const collect = () => {
        render();
        seen.push(element.textContent ?? '');
        for (const node of element.querySelectorAll('[aria-label]')) seen.push(node.getAttribute('aria-label') ?? '');
        for (const node of element.querySelectorAll('[placeholder]')) seen.push(node.getAttribute('placeholder') ?? '');
      };

      collect();
      store.error.set('chargement non abouti');
      collect();
      store.error.set(null);
      store.objectivesLoaded.set(true);
      collect();
      store.objectiveCards.set([
        card(),
        card({ id: 'b', stageCount: 0, stageProgress: { done: 0, inProgress: false, upcoming: 0 }, taskCount: { done: 2, total: 5 } }),
        card({ id: 'c', stageCount: 0, stageProgress: { done: 0, inProgress: false, upcoming: 0 }, taskCount: { done: 0, total: 0 }, nextTask: null }),
        card({ id: 'd', stageCount: 2, stageProgress: { done: 2, inProgress: false, upcoming: 0 }, taskCount: { done: 6, total: 8 } }),
        card({ id: 'e', stageCount: 14, stageProgress: { done: 3, inProgress: true, upcoming: 10, inProgressName: 'Endurance' } }),
        card({ id: 'temp-id-9', nextTask: null }),
      ]);
      store.accomplishedObjectives.set([ACCOMPLISHED]);
      collect();

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

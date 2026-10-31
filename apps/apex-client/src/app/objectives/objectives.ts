import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AxIcon, AxRings, AxSteps, type Anneau, type Lumiere, compter, legendeProgression, lumiereDe } from '../../ui';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { isTemporaryId } from '../../chore/stores/utils/map-optimistique-id';
import { formatToday, injectToday } from '../../chore/clock/today';
import { toDateInputValue } from '../../chore/mapper/date-input.mapper';
import type { NextTaskViewModel, ObjectiveCardViewModel } from '../../chore/models/objective-card.viewmodel';
import { SessionStore } from '../../chore/stores/session.store';
import { firstName } from '../../chore/mapper/person.mapper';

/** Au-delà de 12 étapes, la barre deviendrait illisible : la légende suffit. */
const MAX_CASES = 12;

/** La progression d'une carte : la barre d'étapes (ax-steps), une légende seule, ou l'invitation à poser une étape. */
export type CardProgress =
  | {
      kind: 'cases';
      unit: 'etape' | 'pas';
      done: number;
      inProgress: boolean;
      upcoming: number;
      currentName?: string;
      /** Remplace la légende de la carte (« Étape 2 · Portfolio »). */
      legend?: string;
    }
  | { kind: 'legend'; text: string }
  | { kind: 'invite' };

/** Une carte de l'écran, prête pour le gabarit. */
export type ObjectiveCardView = ObjectiveCardViewModel & {
  progress: CardProgress;
  /**
   * Le prochain pas, dans une liste de 0 ou 1 élément suivie par son id : quand le pas coché laisse
   * place au suivant, la case est recréée au lieu de rester cochée sous un autre intitulé.
   */
  nextTasks: NextTaskViewModel[];
  /** Faux tant que l'objectif n'est pas enregistré : un id temporaire ne va jamais dans une URL. */
  openable: boolean;
  /** La couleur de l'objectif, la même dans la navigation et sur les anneaux. */
  lumiere: Lumiere;
};

/** Le prochain pas mis en avant dans le panneau d'encre. */
export type FocusView = {
  cardId: string;
  objectiveTitle: string;
  stageName?: string;
  task: NextTaskViewModel;
  openable: boolean;
};

/** Des idées pour un premier objectif. */
export const FIRST_IDEAS: readonly { title: string; lumiere: Lumiere }[] = [
  { title: 'Courir un 10 km', lumiere: 'fjord' },
  { title: 'Lancer mon portfolio', lumiere: 'ciel' },
  { title: 'Lire 12 livres cette année', lumiere: 'soleil' },
];

/** Au plus trois anneaux dans le panneau d'encre. */
const MAX_RINGS = 3;

/** « Bonjour » le jour, « Bonsoir » à partir de 18 h. */
export function greetingWord(hour: number): string {
  return hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';
}

/**
 * La progression d'un objectif sur sa carte (cahier de migration, § 4) : par étapes s'il en a,
 * sinon par pas, sinon l'invitation à poser la première étape.
 */
export function cardProgress(card: ObjectiveCardViewModel): CardProgress {
  if (card.stageCount > 0) {
    const { done, inProgress, upcoming, inProgressName } = card.stageProgress;
    const looseTasksLeft = card.taskCount.total - card.taskCount.done;
    // Toutes les étapes sont faites, mais des pas sans étape attendent encore : l'objectif n'est pas
    // accompli, la légende ne doit pas le dire.
    const legend =
      !inProgress && upcoming === 0 && looseTasksLeft > 0
        ? `${compter(done, 'étape faite', 'étapes faites')} · ${compter(looseTasksLeft, 'pas sans étape', 'pas sans étape')} à venir`
        : undefined;
    if (card.stageCount > MAX_CASES) {
      return {
        kind: 'legend',
        text: legend ?? legendeProgression({ faits: done, enCours: inProgress ? 1 : 0, aVenir: upcoming }, { unite: 'etape', nomEnCours: inProgressName }),
      };
    }
    return { kind: 'cases', unit: 'etape', done, inProgress, upcoming, currentName: inProgressName, legend };
  }

  const { done, total } = card.taskCount;
  if (total === 0) return { kind: 'invite' };
  // Sans étape, le prochain pas est le pas en cours.
  const inProgress = done < total;
  const upcoming = Math.max(total - done - 1, 0);
  if (total > MAX_CASES) {
    return { kind: 'legend', text: legendeProgression({ faits: done, enCours: inProgress ? 1 : 0, aVenir: upcoming }) };
  }
  return { kind: 'cases', unit: 'pas', done, inProgress, upcoming };
}

/** L'id du résumé de la liste repliée « Accomplis » (gabarit), où va le focus quand une carte s'y range. */
const ACCOMPLISHED_SUMMARY_ID = 'accomplis-resume';

/**
 * L'écran Objectifs, l'accueil : le panneau d'encre (le bonjour, le prochain pas à cocher, un anneau par
 * objectif), les objectifs en marche en cartes, chacun avec sa progression et son prochain pas, puis les
 * objectifs accomplis dans une liste repliée. Sans objectif, la question d'Akari : l'objectif s'écrit tout de
 * suite et ouvre le nouvel objectif.
 */
@Component({
  selector: 'app-objectives',
  imports: [RouterLink, AxIcon, AxRings, AxSteps],
  templateUrl: './objectives.html',
  styleUrl: './objectives.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Objectives {
  private readonly store = inject(ObjectiveStore);
  private readonly annonces = inject(AnnoncesStore);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** Le jour affiché dans le repère ; il change à minuit, même si l'onglet reste ouvert. */
  private readonly today = injectToday();
  protected readonly todayLabel = computed(() => formatToday(this.today()));
  protected readonly todayIso = computed(() => toDateInputValue(this.today()));

  protected readonly cards = computed<ObjectiveCardView[]>(() =>
    this.store.objectiveCards().map((card) => ({
      ...card,
      progress: cardProgress(card),
      nextTasks: card.nextTask ? [card.nextTask] : [],
      openable: !isTemporaryId(card.id),
      lumiere: lumiereDe(card.id),
    })),
  );

  protected readonly ideas = FIRST_IDEAS;

  /** « Bonsoir, Léa. » (le prénom, s'il est connu). */
  protected readonly greeting = computed(() => {
    this.today();
    const name = firstName(this.session.currentUser()?.name, '');
    const word = greetingWord(new Date().getHours());
    return name ? `${word}, ${name}.` : `${word}.`;
  });

  /** Le premier prochain pas, dans l'ordre des cartes. */
  protected readonly focus = computed<FocusView | null>(() => {
    for (const card of this.cards()) {
      const task = card.nextTask;
      if (task) {
        return {
          cardId: card.id,
          objectiveTitle: card.title,
          stageName: card.stageProgress.inProgressName,
          task,
          openable: card.openable,
        };
      }
    }
    return null;
  });

  /** Les objectifs qui ont des pas, un anneau chacun. */
  protected readonly ringCards = computed(() => this.cards().filter((card) => card.taskCount.total > 0).slice(0, MAX_RINGS));
  protected readonly rings = computed<Anneau[]>(() =>
    this.ringCards().map((card) => ({ done: card.taskCount.done, total: card.taskCount.total, lumiere: card.lumiere })),
  );
  protected readonly taskTotals = computed(() =>
    this.ringCards().reduce((sum, card) => ({ done: sum.done + card.taskCount.done, total: sum.total + card.taskCount.total }), {
      done: 0,
      total: 0,
    }),
  );
  protected readonly ringsLabel = computed(() => {
    const { done, total } = this.taskTotals();
    return `${compter(done, 'pas fait', 'pas faits')} sur ${total}`;
  });

  protected readonly accomplished = this.store.accomplishedObjectives;

  /** « 3 objectifs avancent. Un pas t'attend. » ; vide tant qu'il n'y a rien à dire. */
  protected readonly summary = computed(() => {
    const running = this.cards().length;
    if (running === 0) return '';
    const head = running === 1 ? 'Un objectif avance.' : `${running} objectifs avancent.`;
    return this.focus() ? `${head} Un pas t'attend.` : head;
  });

  /**
   * Aucun objectif en marche, une fois les objectifs chargés (objectivesLoaded : ni pendant le chargement,
   * ni après un chargement qui n'a pas abouti). Tant que la coque affiche un signalement (une note d'Akari),
   * la question attend : une seule note à la fois.
   */
  protected readonly empty = computed(
    () => this.store.objectivesLoaded() && this.cards().length === 0 && !this.annonces.aUnSignalement(),
  );

  /** La coque affiche un signalement (une note d'Akari) : l'écran n'en ajoute pas une seconde. */
  protected readonly hasReport = this.annonces.aUnSignalement;

  /** Le premier chargement est en cours, et aucune carte n'est encore là : l'écran le dit. */
  protected readonly loading = computed(
    () => !this.store.objectivesLoaded() && !this.store.error() && this.cards().length === 0,
  );

  /**
   * Le chargement n'a pas abouti. La coque le signale ; une fois la note lue (« Compris »), l'écran
   * garde une phrase qui dit quoi faire, au lieu de rester vide.
   */
  protected readonly loadFailed = computed(
    () => !this.store.objectivesLoaded() && !!this.store.error() && this.cards().length === 0,
  );

  /** « Étape 2 · Portfolio », ou la légende de la progression par pas. */
  protected stageLine(card: ObjectiveCardView): string {
    const progress = card.progress;
    if (progress.kind !== 'cases') return '';
    if (progress.unit === 'etape') {
      const index = progress.done + 1;
      return progress.inProgress && progress.currentName
        ? `Étape ${index} · ${progress.currentName}`
        : legendeProgression({ faits: progress.done, enCours: progress.inProgress, aVenir: progress.upcoming }, { unite: 'etape' });
    }
    return legendeProgression({ faits: progress.done, enCours: progress.inProgress, aVenir: progress.upcoming });
  }

  /** Le premier objectif : le nouvel objectif s'ouvre avec ce titre. */
  protected start(title: string): void {
    const titre = title.trim();
    void this.router.navigate(['/objectifs/nouveau'], titre ? { queryParams: { titre } } : {});
  }

  /** La liste « Accomplis » est repliée au départ. */
  protected readonly accomplishedOpen = signal(false);

  /**
   * Coche ou décoche le prochain pas : mise à jour optimiste du store, retour en arrière s'il le faut.
   * La case cochée disparaît aussitôt (le prochain pas change, ou la carte passe dans « Accomplis ») : le
   * focus tomberait sur la page, et le clavier repartirait du début. Il va au nouveau prochain pas.
   */
  protected toggleTask(cardId: string, taskId: string, done: boolean, fromFocus = false): void {
    this.store.updateTaskDone({ taskId, done });
    afterNextRender({ write: () => this.recoverFocus(cardId, fromFocus) }, { injector: this.injector });
  }

  /**
   * Si le focus est perdu : le nouveau prochain pas de la carte, sinon son lien « Ouvrir », sinon son titre.
   * La carte est passée dans « Accomplis » : le résumé de la liste repliée.
   */
  private recoverFocus(cardId: string, fromFocus: boolean): void {
    const active = this.document.activeElement;
    if (active && active !== this.document.body && active.isConnected) return;
    const focus = this.focus();
    // Coché depuis le panneau d'encre : le focus va au nouveau prochain pas mis en avant.
    const inHero = fromFocus && focus ? [`focus-${focus.task.id}`] : [];
    const card = this.cards().find((item) => item.id === cardId);
    const targets = card
      ? [
          ...inHero,
          ...card.nextTasks.map((next) => `prochain-pas-${next.id}`),
          ...(card.openable ? [`ouvrir-${card.id}`] : []),
          `objectif-${card.id}`,
        ]
      : [...inHero, ACCOMPLISHED_SUMMARY_ID];
    for (const id of targets) {
      const target = this.document.getElementById(id);
      if (target) {
        target.focus();
        return;
      }
    }
  }
}

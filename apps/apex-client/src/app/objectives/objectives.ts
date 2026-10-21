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
import { RouterLink } from '@angular/router';
import {
  EBouton,
  ECarte,
  ECase,
  EEmpreinte,
  EIcone,
  ENote,
  ENoteActions,
  EPas,
  compter,
  legendeProgression,
} from '@empreinte-studio/angular';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { isTemporaryId } from '../../chore/stores/utils/map-optimistique-id';
import { formatToday, injectToday } from '../../chore/clock/today';
import { toDateInputValue } from '../../chore/mapper/date-input.mapper';
import type { NextTaskViewModel, ObjectiveCardViewModel } from '../../chore/models/objective-card.viewmodel';

/** Au-delà de 12 cases, le brand book demande de ne plus allonger la barre : la légende suffit. */
const MAX_CASES = 12;

/** La progression d'une carte : des cases (e-pas), une légende seule, ou l'invitation à poser une étape. */
export type CardProgress =
  | {
      kind: 'cases';
      unit: 'etape' | 'pas';
      done: number;
      inProgress: boolean;
      upcoming: number;
      currentName?: string;
      /** Remplace la légende calculée par e-pas (et son nom accessible). */
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
};

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
 * L'écran Objectifs, l'accueil (maquette « Objectifs ») : les objectifs en marche en cartes, chacun
 * avec sa progression et son prochain pas à cocher, puis les objectifs accomplis dans une liste repliée.
 */
@Component({
  selector: 'app-objectives',
  imports: [RouterLink, EBouton, ECarte, ECase, EEmpreinte, EIcone, ENote, ENoteActions, EPas],
  templateUrl: './objectives.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Objectives {
  private readonly store = inject(ObjectiveStore);
  private readonly annonces = inject(AnnoncesStore);
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
    })),
  );

  protected readonly accomplished = this.store.accomplishedObjectives;

  /** « 4 en marche · 1 accompli » ; vide tant qu'il n'y a rien à compter. */
  protected readonly summary = computed(() => {
    const parts: string[] = [];
    const running = this.cards().length;
    const accomplished = this.accomplished().length;
    if (running > 0) parts.push(compter(running, 'en marche', 'en marche'));
    if (accomplished > 0) parts.push(compter(accomplished, 'accompli'));
    return parts.join(' · ');
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

  /** La liste « Accomplis » est repliée au départ. */
  protected readonly accomplishedOpen = signal(false);

  /**
   * Coche ou décoche le prochain pas : mise à jour optimiste du store, retour en arrière s'il le faut.
   * La case cochée disparaît aussitôt (le prochain pas change, ou la carte passe dans « Accomplis ») : le
   * focus tomberait sur la page, et le clavier repartirait du début. Il va au nouveau prochain pas.
   */
  protected toggleTask(cardId: string, taskId: string, done: boolean): void {
    this.store.updateTaskDone({ taskId, done });
    afterNextRender({ write: () => this.recoverFocus(cardId) }, { injector: this.injector });
  }

  /**
   * Si le focus est perdu : le nouveau prochain pas de la carte, sinon son lien « Ouvrir », sinon son titre.
   * La carte est passée dans « Accomplis » : le résumé de la liste repliée.
   */
  private recoverFocus(cardId: string): void {
    const active = this.document.activeElement;
    if (active && active !== this.document.body && active.isConnected) return;
    const card = this.cards().find((item) => item.id === cardId);
    const targets = card
      ? [
          ...card.nextTasks.map((next) => `prochain-pas-${next.id}`),
          ...(card.openable ? [`ouvrir-${card.id}`] : []),
          `objectif-${card.id}`,
        ]
      : [ACCOMPLISHED_SUMMARY_ID];
    for (const id of targets) {
      const target = this.document.getElementById(id);
      if (target) {
        target.focus();
        return;
      }
    }
  }
}

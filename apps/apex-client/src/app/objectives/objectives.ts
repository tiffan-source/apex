import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  computed,
  inject,
  linkedSignal,
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
import { FAILURE_REPORTS } from '../../chore/constants/messages.constante';
import { isTemporaryId } from '../../chore/stores/utils/map-optimistique-id';
import type { RequestStatus } from '../../chore/stores/utils/loading-feature';
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

const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** « Lundi 19 octobre ». */
export function formatToday(date: Date): string {
  const text = DAY.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** La date au format AAAA-MM-JJ, en heure locale, pour l'attribut datetime. */
function localIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Toutes les minutes, l'écran vérifie que le repère dit encore la date du jour. */
export const TODAY_CHECK_INTERVAL = 60_000;

/**
 * Vrai quand requestStatus montre que le premier chargement est fini : il a abouti, ou le statut est
 * celui d'une écriture qui n'a pas abouti (on n'écrit qu'une fois ses objectifs affichés). Un
 * chargement qui n'aboutit pas ne compte pas : la coque affiche déjà son signalement, et l'écran ne
 * prétend pas qu'il n'y a aucun objectif.
 */
export function loadIsSettled(status: RequestStatus): boolean {
  if (status === 'fulfilled') return true;
  return typeof status === 'object' && status.error !== FAILURE_REPORTS.loadObjectives;
}

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

  /** Le jour affiché dans le repère ; il change à minuit, même si l'onglet reste ouvert. */
  private readonly today = signal(new Date());
  protected readonly todayLabel = computed(() => formatToday(this.today()));
  protected readonly todayIso = computed(() => localIsoDate(this.today()));

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
   * Vrai dès que le premier chargement est fini (loadIsSettled), et pour de bon : pendant ce chargement,
   * rien ne s'affiche en « vide ». requestStatus est partagé par toutes les écritures, d'où la mémoire :
   * une écriture qui le repasse à 'pending' ou à 'idle' ne refait pas disparaître l'état vide. L'écran
   * peut naître après une écriture qui n'a pas abouti (un objectif qui n'a pas pu être créé, puis retour
   * à l'accueil) : ce statut-là prouve aussi que le chargement est fini.
   */
  private readonly settled = linkedSignal<RequestStatus, boolean>({
    source: this.store.requestStatus,
    computation: (status, previous) => previous?.value === true || loadIsSettled(status),
  });

  /**
   * Aucun objectif en marche, une fois les objectifs chargés. Tant que la coque affiche un signalement
   * (une note d'Akari), la question attend : une seule note à la fois.
   */
  protected readonly empty = computed(() => {
    // Lu en premier, pour que la mémoire suive chaque changement de requestStatus.
    const settled = this.settled();
    return settled && this.cards().length === 0 && !this.annonces.aUnSignalement();
  });

  /** La liste « Accomplis » est repliée au départ. */
  protected readonly accomplishedOpen = signal(false);

  constructor() {
    // Hors de la zone : un minuteur permanent n'empêche pas l'application d'être stable. Le signal
    // ne change qu'au changement de jour, et alors dans la zone.
    const zone = inject(NgZone);
    const timer = zone.runOutsideAngular(() =>
      setInterval(() => {
        const now = new Date();
        if (localIsoDate(now) !== localIsoDate(this.today())) zone.run(() => this.today.set(now));
      }, TODAY_CHECK_INTERVAL),
    );
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /** Coche ou décoche le prochain pas : mise à jour optimiste du store, retour en arrière s'il le faut. */
  protected toggleTask(taskId: string, done: boolean): void {
    this.store.updateTaskDone({ taskId, done });
  }
}

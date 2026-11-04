import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EBouton,
  ECarte,
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
import type { ObjectiveCardViewModel } from '../../chore/models/objective-card.viewmodel';

/** Au-delà de 12 cases, le brand book demande de ne plus allonger la barre : la légende suffit. */
const MAX_CASES = 12;

/** La progression d'une carte : des cases (e-pas), une légende seule, ou l'invitation à poser une étape. */
export type CardProgress =
  | {
      kind: 'cases';
      unit: 'etape' | 'pas';
      done: number;
      toDo: number;
      /** Remplace la légende calculée par e-pas (et son nom accessible). */
      legend?: string;
    }
  | { kind: 'legend'; text: string }
  | { kind: 'invite' };

/** Une carte de l'écran, prête pour le gabarit. */
export type ObjectiveCardView = ObjectiveCardViewModel & {
  progress: CardProgress;
  /** Faux tant que l'objectif n'est pas enregistré : un id temporaire ne va jamais dans une URL. */
  openable: boolean;
};

/**
 * La progression d'un objectif sur sa carte (cahier de migration, § 4) : par étapes s'il en a,
 * sinon par pas, sinon l'invitation à poser des étapes.
 */
export function cardProgress(card: ObjectiveCardViewModel): CardProgress {
  if (card.stageCount > 0) {
    const { done, toDo } = card.stageProgress;
    const looseTasksLeft = card.taskCount.total - card.taskCount.done;
    // Toutes les étapes sont faites, mais des pas sans étape attendent encore : la légende les compte.
    const legend =
      toDo === 0 && looseTasksLeft > 0
        ? `${compter(done, 'étape faite', 'étapes faites')} · ${compter(looseTasksLeft, 'pas sans étape', 'pas sans étape')} à faire`
        : undefined;
    if (card.stageCount > MAX_CASES) {
      return { kind: 'legend', text: legend ?? legendeProgression({ faits: done, aFaire: toDo }, { unite: 'etape' }) };
    }
    return { kind: 'cases', unit: 'etape', done, toDo, legend };
  }

  const { done, total } = card.taskCount;
  if (total === 0) return { kind: 'invite' };
  const toDo = total - done;
  if (total > MAX_CASES) {
    return { kind: 'legend', text: legendeProgression({ faits: done, aFaire: toDo }) };
  }
  return { kind: 'cases', unit: 'pas', done, toDo };
}

/**
 * L'écran Objectifs, l'accueil (maquette « Objectifs ») : les objectifs en marche en cartes, chacun
 * avec sa progression, puis les objectifs accomplis dans une liste repliée.
 */
@Component({
  selector: 'app-objectives',
  imports: [RouterLink, EBouton, ECarte, EEmpreinte, EIcone, ENote, ENoteActions, EPas],
  templateUrl: './objectives.html',
  styleUrl: './objectives.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Objectives {
  private readonly store = inject(ObjectiveStore);
  private readonly annonces = inject(AnnoncesStore);

  /** Le jour affiché dans le repère ; il change à minuit, même si l'onglet reste ouvert. */
  private readonly today = injectToday();
  protected readonly todayLabel = computed(() => formatToday(this.today()));
  protected readonly todayIso = computed(() => toDateInputValue(this.today()));

  protected readonly cards = computed<ObjectiveCardView[]>(() =>
    this.store.objectiveCards().map((card) => ({
      ...card,
      progress: cardProgress(card),
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
}

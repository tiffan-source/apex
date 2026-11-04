import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EBouton, ECarte, EIcone, ENote, ENoteActions, compter } from '@empreinte-studio/angular';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { isTemporaryId } from '../../chore/stores/utils/map-optimistique-id';
import { formatToday, injectToday } from '../../chore/clock/today';
import { toDateInputValue } from '../../chore/mapper/date-input.mapper';
import type { ObjectiveCardViewModel } from '../../chore/models/objective-card.viewmodel';

/** Une carte de l'écran, prête pour le gabarit. */
export type ObjectiveCardView = ObjectiveCardViewModel & {
  /** Ce que l'objectif porte : « 3 étapes · 12 pas », ou vide (la carte invite alors à poser la première étape). */
  contents: string;
  /** Faux tant que l'objectif n'est pas enregistré : un id temporaire ne va jamais dans une URL. */
  openable: boolean;
};

/**
 * Ce qu'un objectif porte, sur sa carte : « 3 étapes · 12 pas », « 4 pas », ou vide. Rien de sa progression
 * (étapes faites, prochain pas, objectif accompli) : elle relève d'Apex Brain, qui ne la rend pas encore.
 */
export function cardContents(card: ObjectiveCardViewModel): string {
  return [card.stageCount > 0 ? compter(card.stageCount, 'étape') : '', card.taskCount > 0 ? compter(card.taskCount, 'pas', 'pas') : '']
    .filter(Boolean)
    .join(' · ');
}

/**
 * L'écran Objectifs, l'accueil (maquette « Objectifs ») : les objectifs en cartes, chacun avec son horizon,
 * son pourquoi et ce qu'il porte. Leur progression, leur prochain pas et la liste « Accomplis » attendent
 * que l'API les rende (docs/technical/data-flow.md).
 */
@Component({
  selector: 'app-objectives',
  imports: [RouterLink, EBouton, ECarte, EIcone, ENote, ENoteActions],
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
      contents: cardContents(card),
      openable: !isTemporaryId(card.id),
    })),
  );

  /** « 4 objectifs » ; vide tant qu'il n'y a rien à compter. */
  protected readonly summary = computed(() => {
    const count = this.cards().length;
    return count > 0 ? compter(count, 'objectif') : '';
  });

  /**
   * Aucun objectif, une fois les objectifs chargés (objectivesLoaded : ni pendant le chargement, ni après
   * un chargement qui n'a pas abouti). Tant que la coque affiche un signalement (une note d'Akari), la
   * question attend : une seule note à la fois.
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
}

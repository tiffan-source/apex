import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { EBouton, EChamp, ECorne, EFil, EIcone, EReplique, ESaisie, ESurface, ETailleAuto } from '@empreinte-studio/angular';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { SessionStore } from '../../../chore/stores/session.store';
import { fromDateInputValue } from '../../../chore/mapper/date-input.mapper';
import { formatHorizon } from '../../../chore/mapper/objective-view.mapper';
import { firstName } from '../../../chore/mapper/person.mapper';
import {
  EMPTY_DRAFT,
  type NewObjectiveDraft,
  isBeforeToday,
  newObjectiveSchema,
  toCreateObjectiveInput,
  todayInputValue,
} from './new-objective.form';

/** Les textes de l'écran qui dépendent de l'état (les autres sont dans le gabarit). */
export const NEW_OBJECTIVE_TEXTS = {
  /** Le titre du brouillon tant que la personne n'a rien écrit. */
  untitled: "Ton objectif s'écrit ici.",
  /** L'horizon du brouillon sans date. */
  noHorizon: "Sans horizon pour l'instant",
  /** Le statut pendant l'enregistrement (Empreinte n'a pas d'indicateur de chargement). */
  saving: "J'enregistre ton objectif…",
  /** Le nom de la personne dans la conversation, quand on ne le connaît pas. */
  personFallback: 'Toi',
} as const;

/**
 * Nouvel objectif (/objectifs/nouveau), la phase « brouillon » d'Akari (cahier de migration, § 5).
 *
 * À gauche, Akari pose ses questions et la personne répond dans des champs (le fil d'Empreinte,
 * ol[eFil]) ; à droite, le brouillon se met à jour en direct. Rien n'est enregistré avant « Je m'y
 * engage » (le seul sceau de l'écran), qui crée l'objectif puis ouvre Akari sur lui
 * (/objectifs/<id définitif>/akari). Si l'enregistrement n'aboutit pas, AnnoncesStore le dit dans la
 * coque et le brouillon garde ce qui a été écrit.
 */
@Component({
  selector: 'app-new-objective',
  imports: [RouterLink, FormField, FormRoot, EBouton, EChamp, ECorne, EFil, EIcone, EReplique, ESaisie, ESurface, ETailleAuto],
  templateUrl: './new-objective.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewObjective {
  private readonly store = inject(ObjectiveStore);
  private readonly session = inject(SessionStore);

  protected readonly texts = NEW_OBJECTIVE_TEXTS;

  /** Le brouillon, tel que la personne l'écrit. */
  protected readonly draftModel = signal<NewObjectiveDraft>({ ...EMPTY_DRAFT });

  /**
   * Le formulaire (Signal Forms) : « Je m'y engage » le soumet, et seul un brouillon valide part. Sinon,
   * chaque champ dit ce qui manque et le focus va au premier concerné.
   */
  protected readonly draft = form(this.draftModel, newObjectiveSchema, {
    submission: {
      action: async () => {
        this.engage();
        return undefined;
      },
      onInvalid: () => {
        // Dans l'ordre de l'écran.
        const firstInvalid = [this.draft.title, this.draft.why, this.draft.dueDate, this.draft.description].find((field) =>
          field().invalid(),
        );
        firstInvalid?.().focusBoundControl();
      },
    },
  });

  /** La date minimale du champ « Pour quand ? » : aujourd'hui. */
  protected readonly today = todayInputValue();

  /** Vrai pendant l'enregistrement : le sceau ne répond plus, le statut le dit. Le store ouvre ensuite Akari. */
  protected readonly saving = this.store.creatingObjective;

  /** « Je m'y engage » n'est possible qu'avec un titre (des espaces seuls ne comptent pas). */
  protected readonly hasTitle = computed(() => this.draftModel().title.trim() !== '');

  /** Le prénom de la personne dans la conversation (« Toi » si on ne le connaît pas). */
  protected readonly personName = computed(() =>
    firstName(this.session.currentUser()?.name, NEW_OBJECTIVE_TEXTS.personFallback),
  );

  /** Le brouillon relu : textes sans espaces autour, horizon écrit « Jusqu'en mai ». */
  protected readonly preview = computed(() => {
    const { title, why, description, dueDate } = this.draftModel();
    const due = isBeforeToday(dueDate) ? undefined : fromDateInputValue(dueDate);
    return {
      title: title.trim(),
      why: why.trim(),
      description: description.trim(),
      horizon: due ? formatHorizon(due) : '',
    };
  });

  /** Crée l'objectif à partir du brouillon : le store le montre, l'enregistre, puis ouvre Akari sur lui. */
  private engage(): void {
    if (this.saving()) return;
    const input = toCreateObjectiveInput(this.draftModel());
    if (!input) return;
    void this.store.createObjective(input);
  }
}

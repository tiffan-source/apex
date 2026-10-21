import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { EBouton, EChamp, ECorne, EIcone, ENote, ESaisie, ESurface, ETailleAuto } from '@empreinte-studio/angular';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { SessionStore } from '../../../chore/stores/session.store';
import { isTemporaryId } from '../../../chore/stores/utils/map-optimistique-id';
import { FAILURE_REPORTS } from '../../../chore/constants/messages.constante';
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
 * À gauche, Akari pose ses questions et la personne répond dans des champs ; à droite, le brouillon se
 * met à jour en direct. Rien n'est enregistré avant « Je m'y engage » (le seul sceau de l'écran), qui
 * crée l'objectif puis ouvre Akari sur lui (/objectifs/<id définitif>/akari). Si l'enregistrement
 * n'aboutit pas, AnnoncesStore le dit dans la coque et le brouillon garde ce qui a été écrit.
 */
@Component({
  selector: 'app-new-objective',
  imports: [RouterLink, FormField, FormRoot, EBouton, EChamp, ECorne, EIcone, ENote, ESaisie, ESurface, ETailleAuto],
  templateUrl: './new-objective.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewObjective {
  private readonly store = inject(ObjectiveStore);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

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
        const firstInvalid = [this.draft.title, this.draft.dueDate].find((field) => field().invalid());
        firstInvalid?.().focusBoundControl();
      },
    },
  });

  /** La date minimale du champ « Pour quand ? » : aujourd'hui. */
  protected readonly today = todayInputValue();

  /**
   * L'engagement en cours, ou null : l'id temporaire de l'objectif que ce geste a ajouté au store.
   * Les écritures partent en file et requestStatus est partagé : seul cet id dit si l'id définitif ou le
   * signalement qui arrive concernent bien ce geste, et pas une création ou une écriture antérieure.
   */
  private readonly engagement = signal<{ temporaryId: string } | null>(null);

  /** Vrai pendant l'enregistrement : le sceau ne répond plus, le statut le dit. */
  protected readonly saving = computed(() => this.engagement() !== null);

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

  constructor() {
    // Après « Je m'y engage » : l'id définitif ouvre Akari ; une création qui n'aboutit pas rend la main.
    effect(() => {
      const engagement = this.engagement();
      if (!engagement) return;
      // Tant que l'objectif optimiste de ce geste est là, son enregistrement n'a pas répondu : un id ou un
      // signalement arrivé entre-temps vient d'une autre écriture (création précédente, pas coché…).
      const waiting = this.store.objectiveOptions().some((option) => option.valeur === engagement.temporaryId);
      if (waiting) return;
      // La réponse de ce geste pose requestStatus en même temps qu'elle retire ou remplace son objectif
      // optimiste : le signalement passe d'abord, car lastCreatedObjectiveId peut encore porter l'id d'une
      // création précédente qui a abouti pendant que celle-ci attendait.
      const createdId = this.store.lastCreatedObjectiveId();
      if (this.store.error() === FAILURE_REPORTS.createObjective) {
        // La coque affiche déjà le signalement (AnnoncesStore) ; le brouillon reste tel quel.
        this.engagement.set(null);
      } else if (createdId && !isTemporaryId(createdId)) {
        this.engagement.set(null);
        void this.router.navigate(['/objectifs', createdId, 'akari']);
      }
    });
  }

  /** Crée l'objectif à partir du brouillon (mise à jour optimiste dans le store, puis enregistrement). */
  private engage(): void {
    if (this.saving()) return;
    const input = toCreateObjectiveInput(this.draftModel());
    if (!input) return;
    const known = new Set(this.store.objectiveOptions().map((option) => option.valeur));
    this.store.createObjective(input);
    // La mise à jour optimiste est immédiate : l'objectif que ce geste vient d'ajouter porte un id
    // temporaire encore inconnu. Sans session, le store ignore le geste et rien n'est en cours.
    const temporaryId = this.store
      .objectiveOptions()
      .map((option) => option.valeur)
      .find((id) => isTemporaryId(id) && !known.has(id));
    if (temporaryId) this.engagement.set({ temporaryId });
  }
}

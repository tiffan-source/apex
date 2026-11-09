import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { EBouton } from '@empreinte-studio/angular/bouton';
import { EChamp, ESaisie, ETailleAuto } from '@empreinte-studio/angular/champ';
import { EFeuille, EFeuilleActions, EFeuillePied } from '@empreinte-studio/angular/feuille';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { fromDateInputValue, toDateInputValue } from '../../../chore/mapper/date-input.mapper';
import { OBJECTIVE_ERASURE } from '../erase-labels';
import { limitText, requireText } from './sheet-validation';

/** Ce que la feuille « Modifier l'objectif » reçoit : l'objectif tel qu'il est affiché. */
export type EditObjectiveSheetData = {
  objective: {
    id: string;
    title: string;
    description: string;
    why: string;
    /** L'échéance au format ISO, ou vide. */
    dueDate: string;
  };
};

/**
 * Ce que la feuille rend en se fermant : « erase » quand la personne choisit d'effacer l'objectif (l'écran demande
 * alors la confirmation) ; rien sinon.
 */
export type EditObjectiveSheetResult = 'erase';

/** Le message d'un nom d'objectif vide. */
export const OBJECTIVE_TITLE_REQUIRED = "Donne un nom à ton objectif pour l'enregistrer.";
/**
 * Le message d'un horizon vidé : la modification d'un objectif ne sait pas encore retirer une échéance
 * (une date absente veut dire « inchangée »). Sans ce message, l'horizon disparaîtrait à l'écran et
 * reviendrait au rechargement.
 */
export const OBJECTIVE_HORIZON_KEPT = "Pour l'instant, un horizon ne se retire pas. Choisis une date.";

/**
 * La feuille « Modifier l'objectif » (l'ancien tiroir d'édition) : son nom, quelques mots, son pourquoi
 * et son horizon. La description et le pourquoi s'effacent en vidant leur champ. L'enregistrement est
 * optimiste : la feuille se ferme tout de suite, sans rien envoyer si rien n'a changé.
 *
 * À son pied, sous un filet, la seule porte vers l'effacement de l'objectif, discrète : l'écran des objectifs ne
 * pousse jamais à effacer. Elle referme la feuille avec « erase », sans rien enregistrer.
 */
@Component({
  selector: 'app-edit-objective-sheet',
  imports: [FormField, FormRoot, EFeuille, EFeuilleActions, EFeuillePied, EChamp, ESaisie, ETailleAuto, EBouton],
  templateUrl: './edit-objective-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditObjectiveSheet {
  private readonly data = inject<EditObjectiveSheetData>(DIALOG_DATA);
  private readonly store = inject(ObjectiveStore);
  protected readonly ref = inject<DialogRef<EditObjectiveSheetResult, EditObjectiveSheet>>(DialogRef);
  protected readonly erasure = OBJECTIVE_ERASURE;
  /**
   * L'effacement attend que tout ce que l'objectif porte soit enregistré : une étape ou un pas encore en création
   * ne part pas avec lui.
   */
  protected readonly erasable = computed(() => this.store.objectiveDetail(this.data.objective.id)?.objective.allSaved ?? false);

  /** « Effacer l'objectif » : la feuille se ferme, l'écran demande la confirmation. */
  protected askErasure(): void {
    if (this.erasable()) this.ref.close('erase');
  }

  // Jamais l'ISO coupé à 10 caractères : il recule d'un jour à l'est de Greenwich
  private readonly initialDueDate = toDateInputValue(this.data.objective.dueDate);
  /** Un horizon déjà posé ne se retire pas encore : le champ n'est facultatif que sans horizon. */
  protected readonly dueDateOptional = !this.initialDueDate;

  protected readonly model = signal({
    title: this.data.objective.title,
    description: this.data.objective.description,
    why: this.data.objective.why,
    dueDate: this.initialDueDate,
  });

  protected readonly fields = form(
    this.model,
    (path) => {
      requireText(path.title, OBJECTIVE_TITLE_REQUIRED);
      limitText(path.title, 'title');
      limitText(path.description, 'longText');
      limitText(path.why, 'longText');
      if (this.initialDueDate) requireText(path.dueDate, OBJECTIVE_HORIZON_KEPT);
    },
    { submission: { action: async () => this.save() } },
  );

  private save(): void {
    const objective = this.data.objective;
    const { dueDate } = this.model();
    const title = this.model().title.trim();
    // Une chaîne vide efface la description ou le pourquoi ; undefined les laisserait tels quels en base.
    const description = this.model().description.trim();
    const why = this.model().why.trim();
    const changed =
      title !== objective.title ||
      description !== objective.description ||
      why !== objective.why ||
      dueDate !== this.initialDueDate;
    if (changed) {
      this.store.editObjective({ id: objective.id, title, description, why, dueDate: fromDateInputValue(dueDate) });
    }
    this.ref.close();
  }
}

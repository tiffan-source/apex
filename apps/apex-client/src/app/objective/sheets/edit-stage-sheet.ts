import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { EBouton } from '@empreinte-studio/angular/bouton';
import { EChamp, ESaisie, ETailleAuto } from '@empreinte-studio/angular/champ';
import { EFeuille, EFeuilleActions } from '@empreinte-studio/angular/feuille';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { fromDateInputValue, toDateInputValue } from '../../../chore/mapper/date-input.mapper';
import { limitText, requireText } from './sheet-validation';

/** Ce que la feuille « Modifier l'étape » reçoit : l'étape telle qu'elle est affichée. */
export type EditStageSheetData = {
  stage: {
    id: string;
    title: string;
    description: string;
    /** L'échéance au format ISO, ou vide. */
    dueDate: string;
  };
};

/** Le message d'un nom d'étape vide. */
export const STAGE_TITLE_TO_SAVE_REQUIRED = "Donne un nom à cette étape pour l'enregistrer.";
/** Le message d'une échéance vidée : la modification ne sait pas encore la retirer (voir OBJECTIVE_HORIZON_KEPT). */
export const STAGE_DUE_DATE_KEPT = "Pour l'instant, une échéance ne se retire pas. Choisis une date.";

/**
 * La feuille « Modifier l'étape » : son nom, quelques mots et son échéance. Une étape est un
 * sous-objectif : l'enregistrement passe par editObjective, de façon optimiste, et seulement si
 * quelque chose a changé. La description s'efface en vidant son champ.
 */
@Component({
  selector: 'app-edit-stage-sheet',
  imports: [FormField, FormRoot, EFeuille, EFeuilleActions, EChamp, ESaisie, ETailleAuto, EBouton],
  templateUrl: './edit-stage-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditStageSheet {
  private readonly data = inject<EditStageSheetData>(DIALOG_DATA);
  private readonly store = inject(ObjectiveStore);
  protected readonly ref = inject<DialogRef<void, EditStageSheet>>(DialogRef);

  private readonly initialDueDate = toDateInputValue(this.data.stage.dueDate);
  /** Une échéance déjà posée ne se retire pas encore : le champ n'est facultatif que sans échéance. */
  protected readonly dueDateOptional = !this.initialDueDate;

  protected readonly model = signal({
    title: this.data.stage.title,
    description: this.data.stage.description,
    dueDate: this.initialDueDate,
  });

  protected readonly fields = form(
    this.model,
    (path) => {
      requireText(path.title, STAGE_TITLE_TO_SAVE_REQUIRED);
      limitText(path.title, 'title');
      limitText(path.description, 'longText');
      if (this.initialDueDate) requireText(path.dueDate, STAGE_DUE_DATE_KEPT);
    },
    { submission: { action: async () => this.save() } },
  );

  private save(): void {
    const stage = this.data.stage;
    const { dueDate } = this.model();
    const title = this.model().title.trim();
    // Une chaîne vide efface la description ; undefined la laisserait telle quelle en base.
    const description = this.model().description.trim();
    const changed = title !== stage.title || description !== stage.description || dueDate !== this.initialDueDate;
    if (changed) {
      this.store.editObjective({ id: stage.id, title, description, dueDate: fromDateInputValue(dueDate) });
    }
    this.ref.close();
  }
}

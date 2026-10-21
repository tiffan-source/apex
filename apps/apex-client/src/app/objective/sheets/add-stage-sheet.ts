import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { EBouton } from '@empreinte-studio/angular/bouton';
import { EChamp, ESaisie } from '@empreinte-studio/angular/champ';
import { EFeuille, EFeuilleActions } from '@empreinte-studio/angular/feuille';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { requireText } from './sheet-validation';

/** Ce que la feuille « Ajouter une étape » reçoit : l'objectif qui reçoit l'étape. */
export type AddStageSheetData = {
  objectiveId: string;
};

/** Le message d'un nom d'étape vide. */
export const STAGE_TITLE_REQUIRED = "Donne un nom à cette étape pour l'ajouter.";

/**
 * La feuille « Ajouter une étape » : un nom, et l'étape rejoint l'arête. L'ajout est optimiste :
 * la feuille se ferme tout de suite, le store annonce la réussite ou signale le souci.
 */
@Component({
  selector: 'app-add-stage-sheet',
  imports: [FormField, FormRoot, EFeuille, EFeuilleActions, EChamp, ESaisie, EBouton],
  templateUrl: './add-stage-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddStageSheet {
  private readonly data = inject<AddStageSheetData>(DIALOG_DATA);
  private readonly store = inject(ObjectiveStore);
  protected readonly ref = inject<DialogRef<void, AddStageSheet>>(DialogRef);

  protected readonly model = signal({ title: '' });

  protected readonly fields = form(this.model, (path) => requireText(path.title, STAGE_TITLE_REQUIRED), {
    submission: { action: async () => this.add() },
  });

  private add(): void {
    this.store.addSubObjective({ objectiveId: this.data.objectiveId, subObjectiveTitle: this.model().title.trim() });
    this.ref.close();
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { EBouton } from '@empreinte-studio/angular/bouton';
import { EChamp, ESaisie } from '@empreinte-studio/angular/champ';
import { EFeuille, EFeuilleActions } from '@empreinte-studio/angular/feuille';
import { ESelection } from '@empreinte-studio/angular/selection';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { IMPORTANCE_OPTIONS, URGENCY_OPTIONS } from '../../../chore/constants/task.constante';
import type { StageTaskViewModel } from '../../../chore/models/objective-detail.viewmodel';
import { namedStageOptions } from '../stage-labels';
import { requireText } from './sheet-validation';

/** Ce que la feuille « Modifier le pas » reçoit. */
export type EditTaskSheetData = {
  /** L'objectif racine : ses étapes remplissent le choix de l'étape. */
  objectiveId: string;
  /** L'étape où le pas est affiché, ou null pour un pas sans étape. */
  stageId: string | null;
  task: StageTaskViewModel;
};

/** Le message d'un pas sans intitulé. */
export const TASK_TITLE_TO_SAVE_REQUIRED = "Écris ce pas en quelques mots pour l'enregistrer.";

/**
 * La feuille « Modifier le pas » : son intitulé, son étape, son importance et son urgence.
 * Un pas sans étape s'y range dans une étape. L'enregistrement est optimiste : la feuille se ferme tout de suite.
 * Rien ne part si rien n'a changé : une modification d'un pas réenregistre aussi ses voisins en base.
 */
@Component({
  selector: 'app-edit-task-sheet',
  imports: [FormField, FormRoot, EFeuille, EFeuilleActions, EChamp, ESaisie, ESelection, EBouton],
  templateUrl: './edit-task-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditTaskSheet {
  private readonly data = inject<EditTaskSheetData>(DIALOG_DATA);
  private readonly store = inject(ObjectiveStore);
  protected readonly ref = inject<DialogRef<void, EditTaskSheet>>(DialogRef);

  protected readonly importanceOptions = IMPORTANCE_OPTIONS;
  protected readonly urgencyOptions = URGENCY_OPTIONS;
  protected readonly stageOptions = computed(() => namedStageOptions(this.store.stageOptions(this.data.objectiveId)));
  /** Un pas sans étape : la feuille invite à le ranger. */
  protected readonly withoutStage = this.data.stageId === null;

  protected readonly model = signal<{ title: string; stageId: string | null; importance: number; urgency: number }>({
    title: this.data.task.title,
    stageId: this.data.stageId,
    importance: this.data.task.importance,
    urgency: this.data.task.urgency,
  });

  protected readonly fields = form(this.model, (path) => requireText(path.title, TASK_TITLE_TO_SAVE_REQUIRED), {
    submission: { action: async () => this.save() },
  });

  private save(): void {
    const { title, stageId, importance, urgency } = this.model();
    // Le porteur réel du pas peut être un sous-objectif plus profond de l'étape : on ne le change
    // que si la personne a choisi une autre étape, sinon le pas déménagerait.
    const task = this.data.task;
    const objectiveId = stageId === null || stageId === this.data.stageId ? task.objectiveId : stageId;
    const changed =
      title.trim() !== task.title ||
      importance !== task.importance ||
      urgency !== task.urgency ||
      objectiveId !== task.objectiveId;
    if (changed) {
      this.store.editTask({ taskId: task.id, input: { title: title.trim(), importance, urgency, objectiveId } });
    }
    this.ref.close();
  }
}

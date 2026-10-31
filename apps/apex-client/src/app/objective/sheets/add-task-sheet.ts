import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormField, FormRoot, form, required } from '@angular/forms/signals';
import { AxSheet, AxSheetActions, AxField, AxControl, AxSelect } from '../../../ui';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { IMPORTANCE_OPTIONS, NEW_TASK_LEVELS, URGENCY_OPTIONS } from '../../../chore/constants/task.constante';
import { namedStageOptions } from '../stage-labels';
import { requireText } from './sheet-validation';

/** Ce que la feuille « Ajouter un pas » reçoit : l'objectif (pour ses étapes) et l'étape choisie. */
export type AddTaskSheetData = {
  /** L'objectif racine : ses étapes remplissent le choix de l'étape. */
  objectiveId: string;
  /** L'étape proposée par défaut : celle qui est ouverte sous le chemin. */
  stageId: string;
};

/** Le message d'un pas sans intitulé. */
export const TASK_TITLE_REQUIRED = "Écris ce pas en quelques mots pour l'ajouter.";
/** Le message d'un pas sans étape : tout nouveau pas appartient à une étape. */
export const TASK_STAGE_REQUIRED = "Choisis l'étape où ranger ce pas.";

/**
 * La feuille « Ajouter un pas » : son intitulé, son étape (jamais l'objectif lui-même), son importance
 * et son urgence, qui le placent dans la matrice (par défaut « À planifier », NEW_TASK_LEVELS). L'ajout
 * est optimiste : la feuille se ferme tout de suite.
 */
@Component({
  selector: 'app-add-task-sheet',
  imports: [FormField, FormRoot, AxSheet, AxSheetActions, AxField, AxControl, AxSelect],
  templateUrl: './add-task-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTaskSheet {
  private readonly data = inject<AddTaskSheetData>(DIALOG_DATA);
  private readonly store = inject(ObjectiveStore);
  protected readonly ref = inject<DialogRef<void, AddTaskSheet>>(DialogRef);

  protected readonly importanceOptions = IMPORTANCE_OPTIONS;
  protected readonly urgencyOptions = URGENCY_OPTIONS;
  /** Les étapes de l'objectif, à jour si l'une d'elles vient d'être enregistrée. */
  protected readonly stageOptions = computed(() => namedStageOptions(this.store.stageOptions(this.data.objectiveId)));

  protected readonly model = signal<{ title: string; stageId: string | null; importance: number; urgency: number }>({
    title: '',
    stageId: this.data.stageId,
    // Un nouveau pas naît « À planifier » (important, pas urgent) : là où vont les pas des objectifs.
    importance: NEW_TASK_LEVELS.importance,
    urgency: NEW_TASK_LEVELS.urgency,
  });

  protected readonly fields = form(
    this.model,
    (path) => {
      requireText(path.title, TASK_TITLE_REQUIRED);
      required(path.stageId, { message: TASK_STAGE_REQUIRED });
    },
    { submission: { action: async () => this.add() } },
  );

  private add(): void {
    const { title, stageId, importance, urgency } = this.model();
    if (!stageId) return;
    this.store.addTaskToObjective({ objectiveId: stageId, task: { title: title.trim(), importance, urgency } });
    this.ref.close();
  }
}

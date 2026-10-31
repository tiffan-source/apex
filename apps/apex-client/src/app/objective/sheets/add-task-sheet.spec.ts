import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import type { WritableSignal } from '@angular/core';
import { motsAEviter } from '../../../ui';
import { quadrantOf } from '../../../chore/mapper/matrix.mapper';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { voiceIssues } from '../../../chore/constants/messages.constante';
import { AddTaskSheet, TASK_STAGE_REQUIRED, TASK_TITLE_REQUIRED, type AddTaskSheetData } from './add-task-sheet';

type Model = { title: string; stageId: string | null; importance: number; urgency: number };

const STAGES = [
  { valeur: 'stage-1', libelle: 'Programme' },
  { valeur: 'stage-2', libelle: 'Endurance' },
];

describe('AddTaskSheet', () => {
  let fixture: ComponentFixture<AddTaskSheet>;
  let element: HTMLElement;
  let store: { stageOptions: ReturnType<typeof vi.fn>; addTaskToObjective: ReturnType<typeof vi.fn> };
  let ref: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = { stageOptions: vi.fn(() => STAGES), addTaskToObjective: vi.fn() };
    ref = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AddTaskSheet],
      providers: [
        { provide: DIALOG_DATA, useValue: { objectiveId: 'obj-1', stageId: 'stage-2' } satisfies AddTaskSheetData },
        { provide: DialogRef, useValue: ref },
        { provide: ObjectiveStore, useValue: store },
      ],
    });
    fixture = TestBed.createComponent(AddTaskSheet);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  const model = () => (fixture.componentInstance as unknown as { model: WritableSignal<Model> }).model;
  const selections = () =>
    [...element.querySelectorAll<HTMLSelectElement>('ax-select select')].map((select) => select.selectedOptions[0]?.textContent?.trim());
  const type = (value: string) => {
    const input = element.querySelector<HTMLInputElement>('input[axControl]') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const submit = async () => {
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it("propose les étapes de l'objectif, l'étape choisie par défaut, et les niveaux", () => {
    expect(element.querySelector('ax-sheet h2')?.textContent?.trim()).toBe('Ajouter un pas');
    expect(store.stageOptions).toHaveBeenCalledWith('obj-1');
    // Un nouveau pas naît « À planifier » : important, pas urgent.
    expect(selections()).toEqual(['Endurance', 'Important', 'Pas urgent']);
    const labels = [...element.querySelectorAll('ax-field label')].map((label) => label.textContent?.trim());
    expect(labels).toEqual(['Le pas', 'Étape', 'Importance', 'Urgence']);
  });

  it("ajoute le pas à l'étape choisie et se ferme tout de suite", async () => {
    type(' Courir 8 km ');
    await submit();
    expect(store.addTaskToObjective).toHaveBeenCalledWith({
      objectiveId: 'stage-2',
      task: { title: 'Courir 8 km', importance: 3, urgency: 2 },
    });
    expect(ref.close).toHaveBeenCalled();
  });

  it('un pas ajouté sans toucher aux niveaux tombe dans « À planifier »', async () => {
    type('Courir 8 km');
    await submit();
    const [{ task }] = store.addTaskToObjective.mock.calls[0];
    expect(quadrantOf(task)).toBe('planifier');
  });

  it("range le pas dans l'étape et aux niveaux choisis", async () => {
    model().update((value) => ({ ...value, stageId: 'stage-1', importance: 4, urgency: 2 }));
    fixture.detectChanges();
    expect(selections()).toEqual(['Programme', 'Très important', 'Pas urgent']);
    type('Choisir un plan');
    await submit();
    expect(store.addTaskToObjective).toHaveBeenCalledWith({
      objectiveId: 'stage-1',
      task: { title: 'Choisir un plan', importance: 4, urgency: 2 },
    });
  });

  it("prend l'étape choisie dans la liste", () => {
    const select = element.querySelector<HTMLSelectElement>('ax-select select') as HTMLSelectElement;
    const index = [...select.options].findIndex((option) => option.textContent?.trim() === 'Programme');
    expect(index).toBeGreaterThanOrEqual(0);
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(model()().stageId).toBe('stage-1');
    expect(selections()[0]).toBe('Programme');
  });

  it('refuse un pas sans intitulé, et dit quoi faire', async () => {
    type('  ');
    await submit();
    expect(store.addTaskToObjective).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
    expect(element.textContent).toContain(TASK_TITLE_REQUIRED);
  });

  it("refuse un pas sans étape : jamais l'objectif lui-même", async () => {
    model().update((value) => ({ ...value, stageId: null }));
    type('Courir 8 km');
    await submit();
    expect(store.addTaskToObjective).not.toHaveBeenCalled();
    expect(element.textContent).toContain(TASK_STAGE_REQUIRED);
  });

  it('« Annuler » ferme sans rien ajouter', () => {
    [...element.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Annuler')?.click();
    expect(ref.close).toHaveBeenCalledWith();
    expect(store.addTaskToObjective).not.toHaveBeenCalled();
  });

  it("parle dans la voix d'Apex", () => {
    for (const value of [element.textContent ?? '', TASK_TITLE_REQUIRED, TASK_STAGE_REQUIRED]) {
      expect(motsAEviter(value)).toEqual([]);
      expect(voiceIssues(value)).toEqual([]);
    }
  });
});

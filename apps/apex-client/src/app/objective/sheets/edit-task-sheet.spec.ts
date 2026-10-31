import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import type { WritableSignal } from '@angular/core';
import { motsAEviter } from '../../../ui';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { voiceIssues } from '../../../chore/constants/messages.constante';
import type { StageTaskViewModel } from '../../../chore/models/objective-detail.viewmodel';
import { EditTaskSheet, TASK_TITLE_TO_SAVE_REQUIRED, type EditTaskSheetData } from './edit-task-sheet';

type Model = { title: string; stageId: string | null; importance: number; urgency: number };

const STAGES = [
  { valeur: 'stage-1', libelle: 'Programme' },
  { valeur: 'stage-2', libelle: 'Endurance' },
];

const task = (objectiveId: string): StageTaskViewModel => ({
  id: 't3',
  title: 'Courir 5 km',
  done: true,
  state: 'fait',
  importance: 4,
  urgency: 2,
  objectiveId,
  quadrant: 'planifier',
});

describe('EditTaskSheet', () => {
  let fixture: ComponentFixture<EditTaskSheet>;
  let element: HTMLElement;
  let store: { stageOptions: ReturnType<typeof vi.fn>; editTask: ReturnType<typeof vi.fn> };
  let ref: { close: ReturnType<typeof vi.fn> };

  async function render(data: EditTaskSheetData, stages = STAGES) {
    store = { stageOptions: vi.fn(() => stages), editTask: vi.fn() };
    ref = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [EditTaskSheet],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: ref },
        { provide: ObjectiveStore, useValue: store },
      ],
    });
    fixture = TestBed.createComponent(EditTaskSheet);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

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

  describe("un pas d'une étape", () => {
    // Le pas est porté par un sous-objectif plus profond de l'étape « Endurance »
    beforeEach(() => render({ objectiveId: 'obj-1', stageId: 'stage-2', task: task('deep-1') }));

    it('préremplit son intitulé, son étape, son importance et son urgence', () => {
      expect(element.querySelector('ax-sheet h2')?.textContent?.trim()).toBe('Modifier le pas');
      expect(element.querySelector<HTMLInputElement>('input[axControl]')?.value).toBe('Courir 5 km');
      expect(selections()).toEqual(['Endurance', 'Très important', 'Pas urgent']);
      expect(store.stageOptions).toHaveBeenCalledWith('obj-1');
    });

    it("garde son porteur réel tant que l'étape ne change pas, et se ferme tout de suite", async () => {
      type('Courir 6 km');
      await submit();
      expect(store.editTask).toHaveBeenCalledWith({
        taskId: 't3',
        input: { title: 'Courir 6 km', importance: 4, urgency: 2, objectiveId: 'deep-1' },
      });
      expect(ref.close).toHaveBeenCalled();
    });

    it("le déplace dans l'étape choisie", async () => {
      model().update((value) => ({ ...value, stageId: 'stage-1', urgency: 5 }));
      fixture.detectChanges();
      expect(selections()).toEqual(['Programme', 'Très important', 'Tout de suite']);
      await submit();
      expect(store.editTask).toHaveBeenCalledWith({
        taskId: 't3',
        input: { title: 'Courir 5 km', importance: 4, urgency: 5, objectiveId: 'stage-1' },
      });
    });

    it("se ferme sans rien envoyer quand rien n'a changé, même en reprenant son étape", async () => {
      // Une modification réenregistre aussi les pas voisins en base : rien ne part pour rien
      type(' Courir 5 km ');
      model().update((value) => ({ ...value, stageId: 'stage-2' }));
      await submit();
      expect(store.editTask).not.toHaveBeenCalled();
      expect(ref.close).toHaveBeenCalled();
    });

    it('refuse un intitulé blanc, et dit quoi faire', async () => {
      type(' ');
      await submit();
      expect(store.editTask).not.toHaveBeenCalled();
      expect(ref.close).not.toHaveBeenCalled();
      expect(element.textContent).toContain(TASK_TITLE_TO_SAVE_REQUIRED);
    });

    it('« Annuler » ferme sans rien enregistrer', () => {
      [...element.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Annuler')?.click();
      expect(ref.close).toHaveBeenCalledWith();
      expect(store.editTask).not.toHaveBeenCalled();
    });
  });

  describe('un pas sans étape', () => {
    beforeEach(() => render({ objectiveId: 'obj-1', stageId: null, task: task('obj-1') }));

    it('invite à le ranger dans une étape', () => {
      expect(element.textContent).toContain("Range ce pas dans une étape de ton chemin.");
      expect(selections()[0]).toBe('Choisis une étape');
    });

    it("reste sur l'objectif tant qu'aucune étape n'est choisie", async () => {
      model().update((value) => ({ ...value, urgency: 3 }));
      await submit();
      expect(store.editTask).toHaveBeenCalledWith({
        taskId: 't3',
        input: { title: 'Courir 5 km', importance: 4, urgency: 3, objectiveId: 'obj-1' },
      });
    });

    it("se range dans l'étape choisie", async () => {
      model().update((value) => ({ ...value, stageId: 'stage-2' }));
      await submit();
      expect(store.editTask).toHaveBeenCalledWith({
        taskId: 't3',
        input: { title: 'Courir 5 km', importance: 4, urgency: 2, objectiveId: 'stage-2' },
      });
    });
  });

  it("nomme une étape sans titre dans le choix de l'étape", async () => {
    await render({ objectiveId: 'obj-1', stageId: 'stage-2', task: task('stage-2') }, [
      { valeur: 'stage-1', libelle: '' },
      { valeur: 'stage-2', libelle: 'Endurance' },
    ]);
    model().update((value) => ({ ...value, stageId: 'stage-1' }));
    fixture.detectChanges();
    expect(selections()[0]).toBe('Étape sans nom');
  });

  it("dit d'ajouter une étape quand l'objectif n'en a pas", async () => {
    await render({ objectiveId: 'obj-2', stageId: null, task: task('obj-2') }, []);
    expect(element.textContent).toContain('Ajoute une étape à ton objectif pour y ranger ce pas.');
    expect(selections()).toEqual(['Très important', 'Pas urgent']);
  });

  it("parle dans la voix d'Apex", async () => {
    await render({ objectiveId: 'obj-1', stageId: null, task: task('obj-1') });
    for (const value of [element.textContent ?? '', TASK_TITLE_TO_SAVE_REQUIRED, 'Ajoute une étape à ton objectif pour y ranger ce pas.']) {
      expect(motsAEviter(value)).toEqual([]);
      expect(voiceIssues(value)).toEqual([]);
    }
  });
});

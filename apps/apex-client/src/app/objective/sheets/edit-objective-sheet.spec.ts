import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { motsAEviter } from '@empreinte-studio/angular/core';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { voiceIssues } from '../../../chore/constants/messages.constante';
import {
  EditObjectiveSheet,
  OBJECTIVE_HORIZON_KEPT,
  OBJECTIVE_TITLE_REQUIRED,
  type EditObjectiveSheetData,
} from './edit-objective-sheet';

const DATA: EditObjectiveSheetData = {
  objective: {
    id: 'obj-1',
    title: 'Courir un semi-marathon en mai',
    description: 'Trois sorties par semaine.',
    why: 'Pour me prouver que je peux tenir.',
    // Le 15 mai 2027 à minuit, heure locale
    dueDate: new Date(2027, 4, 15).toISOString(),
  },
};

describe('EditObjectiveSheet', () => {
  let fixture: ComponentFixture<EditObjectiveSheet>;
  let element: HTMLElement;
  let store: { editObjective: ReturnType<typeof vi.fn> };
  let ref: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = { editObjective: vi.fn() };
    ref = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [EditObjectiveSheet],
      providers: [
        { provide: DIALOG_DATA, useValue: DATA },
        { provide: DialogRef, useValue: ref },
        { provide: ObjectiveStore, useValue: store },
      ],
    });
    fixture = TestBed.createComponent(EditObjectiveSheet);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  const controls = () => [...element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[eSaisie]')];
  const fill = (index: number, value: string) => {
    const control = controls()[index];
    control.value = value;
    control.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const submit = async () => {
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it("préremplit le titre, la description, le pourquoi et l'horizon", () => {
    expect(element.querySelector('.e-feuille__titre')?.textContent?.trim()).toBe("Modifier l'objectif");
    expect(controls().map((control) => control.value)).toEqual([
      'Courir un semi-marathon en mai',
      'Trois sorties par semaine.',
      'Pour me prouver que je peux tenir.',
      '2027-05-15',
    ]);
    const labels = [...element.querySelectorAll('.e-champ__libelle')].map((label) => label.textContent);
    expect(labels[0]).toContain('Ce que tu veux construire');
    expect(labels[2]).toContain('Pourquoi ça compte pour toi');
    expect(labels[3]).toContain('Pour quand');
  });

  it("enregistre par le store, avec une date locale, et se ferme tout de suite", async () => {
    fill(0, ' Semi-marathon de Paris ');
    fill(3, '2027-06-01');
    await submit();
    expect(store.editObjective).toHaveBeenCalledTimes(1);
    const input = store.editObjective.mock.calls[0][0];
    expect(input).toEqual({
      id: 'obj-1',
      title: 'Semi-marathon de Paris',
      description: 'Trois sorties par semaine.',
      why: 'Pour me prouver que je peux tenir.',
      dueDate: expect.any(Date),
    });
    expect([input.dueDate.getFullYear(), input.dueDate.getMonth(), input.dueDate.getDate()]).toEqual([2027, 5, 1]);
    expect(ref.close).toHaveBeenCalled();
  });

  it('efface une description ou un pourquoi laissés vides', async () => {
    fill(1, '  ');
    fill(2, '');
    await submit();
    // Une chaîne vide efface le champ en base ; undefined l'aurait laissé tel quel
    expect(store.editObjective).toHaveBeenCalledWith({
      id: 'obj-1',
      title: 'Courir un semi-marathon en mai',
      description: '',
      why: '',
      dueDate: expect.any(Date),
    });
    expect(ref.close).toHaveBeenCalled();
  });

  it("ne laisse pas retirer l'horizon, que le store ne sait pas encore effacer, et dit quoi faire", async () => {
    expect(element.querySelectorAll('.e-champ__libelle')[3].textContent).not.toContain('facultatif');
    fill(3, '');
    await submit();
    expect(store.editObjective).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
    expect(element.textContent).toContain(OBJECTIVE_HORIZON_KEPT);
  });

  it("se ferme sans rien envoyer quand rien n'a changé", async () => {
    await submit();
    expect(store.editObjective).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalled();
  });

  it('refuse un titre blanc, et dit quoi faire', async () => {
    fill(0, '   ');
    await submit();
    expect(store.editObjective).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
    expect(element.textContent).toContain(OBJECTIVE_TITLE_REQUIRED);
  });

  it('« Annuler » ferme sans rien enregistrer', () => {
    [...element.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Annuler')?.click();
    expect(ref.close).toHaveBeenCalledWith();
    expect(store.editObjective).not.toHaveBeenCalled();
  });

  it("n'a pas de sceau et parle dans la voix d'Empreinte", () => {
    expect(element.querySelectorAll('.e-btn--sceau')).toHaveLength(0);
    for (const value of [element.textContent ?? '', OBJECTIVE_TITLE_REQUIRED, OBJECTIVE_HORIZON_KEPT]) {
      expect(motsAEviter(value)).toEqual([]);
      expect(voiceIssues(value)).toEqual([]);
    }
  });
});

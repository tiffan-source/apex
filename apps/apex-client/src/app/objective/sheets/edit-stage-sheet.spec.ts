import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { motsAEviter } from '@empreinte-studio/angular/core';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { voiceIssues } from '../../../chore/constants/messages.constante';
import {
  EditStageSheet,
  STAGE_DUE_DATE_KEPT,
  STAGE_TITLE_TO_SAVE_REQUIRED,
  type EditStageSheetData,
} from './edit-stage-sheet';

const DATA: EditStageSheetData = {
  stage: { id: 'stage-2', title: 'Endurance', description: '', dueDate: '' },
};

/** Une étape qui a déjà une description et une échéance (le 20 décembre 2026, heure locale). */
const DATED: EditStageSheetData = {
  stage: { id: 'stage-1', title: 'Programme', description: 'Trois sorties.', dueDate: new Date(2026, 11, 20).toISOString() },
};

describe('EditStageSheet', () => {
  let fixture: ComponentFixture<EditStageSheet>;
  let element: HTMLElement;
  let store: { editObjective: ReturnType<typeof vi.fn> };
  let ref: { close: ReturnType<typeof vi.fn> };

  async function render(data: EditStageSheetData) {
    store = { editObjective: vi.fn() };
    ref = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [EditStageSheet],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: ref },
        { provide: ObjectiveStore, useValue: store },
      ],
    });
    fixture = TestBed.createComponent(EditStageSheet);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => render(DATA));

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

  it("préremplit le nom de l'étape, sa description et son échéance", () => {
    expect(element.querySelector('.e-feuille__titre')?.textContent?.trim()).toBe("Modifier l'étape");
    expect(controls().map((control) => control.value)).toEqual(['Endurance', '', '']);
    expect(controls()[2].getAttribute('type')).toBe('date');
  });

  it("enregistre l'étape par editObjective et se ferme tout de suite", async () => {
    fill(0, 'Endurance fondamentale');
    fill(1, 'Tenir 30 minutes.');
    fill(2, '2026-12-20');
    await submit();
    const input = store.editObjective.mock.calls[0][0];
    expect(input).toEqual({
      id: 'stage-2',
      title: 'Endurance fondamentale',
      description: 'Tenir 30 minutes.',
      dueDate: expect.any(Date),
    });
    expect([input.dueDate.getFullYear(), input.dueDate.getMonth(), input.dueDate.getDate()]).toEqual([2026, 11, 20]);
    expect(ref.close).toHaveBeenCalled();
  });

  it("se ferme sans rien envoyer quand rien n'a changé", async () => {
    await submit();
    expect(store.editObjective).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalled();
  });

  describe('une étape qui a une description et une échéance', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();
      return render(DATED);
    });

    it('efface la description laissée vide', async () => {
      expect(controls().map((control) => control.value)).toEqual(['Programme', 'Trois sorties.', '2026-12-20']);
      fill(1, ' ');
      await submit();
      // Une chaîne vide efface la description en base ; undefined l'aurait laissée telle quelle
      expect(store.editObjective).toHaveBeenCalledWith({
        id: 'stage-1',
        title: 'Programme',
        description: '',
        dueDate: expect.any(Date),
      });
    });

    it("ne laisse pas retirer l'échéance, que le store ne sait pas encore effacer, et dit quoi faire", async () => {
      expect(element.querySelectorAll('.e-champ__libelle')[2].textContent).not.toContain('facultatif');
      fill(2, '');
      await submit();
      expect(store.editObjective).not.toHaveBeenCalled();
      expect(ref.close).not.toHaveBeenCalled();
      expect(element.textContent).toContain(STAGE_DUE_DATE_KEPT);
    });
  });

  it('refuse un nom blanc, et dit quoi faire', async () => {
    fill(0, '  ');
    await submit();
    expect(store.editObjective).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
    expect(element.textContent).toContain(STAGE_TITLE_TO_SAVE_REQUIRED);
  });

  it('« Annuler » ferme sans rien enregistrer', () => {
    [...element.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Annuler')?.click();
    expect(ref.close).toHaveBeenCalledWith();
    expect(store.editObjective).not.toHaveBeenCalled();
  });

  it("n'a pas de sceau et parle dans la voix d'Empreinte", () => {
    expect(element.querySelectorAll('.e-btn--sceau')).toHaveLength(0);
    for (const value of [element.textContent ?? '', STAGE_TITLE_TO_SAVE_REQUIRED, STAGE_DUE_DATE_KEPT]) {
      expect(motsAEviter(value)).toEqual([]);
      expect(voiceIssues(value)).toEqual([]);
    }
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { motsAEviter } from '@empreinte-studio/angular/core';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { voiceIssues } from '../../../chore/constants/messages.constante';
import { AddStageSheet, STAGE_TITLE_REQUIRED, type AddStageSheetData } from './add-stage-sheet';

describe('AddStageSheet', () => {
  let fixture: ComponentFixture<AddStageSheet>;
  let element: HTMLElement;
  let store: { addSubObjective: ReturnType<typeof vi.fn> };
  let ref: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = { addSubObjective: vi.fn() };
    ref = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AddStageSheet],
      providers: [
        { provide: DIALOG_DATA, useValue: { objectiveId: 'obj-1' } satisfies AddStageSheetData },
        { provide: DialogRef, useValue: ref },
        { provide: ObjectiveStore, useValue: store },
      ],
    });
    fixture = TestBed.createComponent(AddStageSheet);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  const type = (value: string) => {
    const input = element.querySelector<HTMLInputElement>('input[eSaisie]') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const submit = async () => {
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('a un titre, un champ, et un bouton principal en trait relié au formulaire', () => {
    expect(element.querySelector('.e-feuille__titre')?.textContent?.trim()).toBe('Ajouter une étape');
    expect(element.querySelector('.e-champ__libelle')?.textContent).toContain("Le nom de l'étape");
    const submitButton = element.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitButton?.textContent?.trim()).toBe('Ajouter');
    expect(submitButton?.getAttribute('form')).toBe(element.querySelector('form')?.id);
    expect(submitButton?.classList).toContain('e-btn--trait');
    expect(element.querySelectorAll('.e-btn--sceau')).toHaveLength(0);
  });

  it("ajoute l'étape au store et se ferme tout de suite", async () => {
    type('  Endurance ');
    await submit();
    expect(store.addSubObjective).toHaveBeenCalledWith({ objectiveId: 'obj-1', subObjectiveTitle: 'Endurance' });
    expect(ref.close).toHaveBeenCalled();
  });

  it('refuse un nom vide ou blanc, et dit quoi faire', async () => {
    type('   ');
    await submit();
    expect(store.addSubObjective).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
    expect(element.textContent).toContain(STAGE_TITLE_REQUIRED);
    expect(element.querySelector('input[eSaisie]')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('« Annuler » ferme sans rien ajouter', () => {
    [...element.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Annuler')?.click();
    expect(ref.close).toHaveBeenCalledWith();
    expect(store.addSubObjective).not.toHaveBeenCalled();
  });

  it("parle dans la voix d'Empreinte", () => {
    for (const value of [element.textContent ?? '', STAGE_TITLE_REQUIRED]) {
      expect(motsAEviter(value)).toEqual([]);
      expect(voiceIssues(value)).toEqual([]);
    }
  });
});

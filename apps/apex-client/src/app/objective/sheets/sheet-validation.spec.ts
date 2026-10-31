import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { TEXT_MAX_LENGTH } from '../../../chore/api/api.models';
import { newObjectiveSchema } from '../../objectives/new-objective/new-objective.form';
import { limitText, requireText } from './sheet-validation';

/*
 * Les règles des formulaires, sans écran : un nom est demandé, et aucun texte ne dépasse ce que l'API
 * accepte (TEXT_MAX_LENGTH). La longueur passe au contrôle natif (maxlength) par [formField].
 */

type Sheet = { title: string; description: string };

function sheet(initial: Sheet) {
  return TestBed.runInInjectionContext(() => {
    const model = signal(initial);
    const fields = form(model, (path) => {
      requireText(path.title, 'Donne un nom à cette étape.');
      limitText(path.title, 'title');
      limitText(path.description, 'longText');
    });
    return { model, fields };
  });
}

describe('requireText et limitText', () => {
  it('un nom de 200 caractères passe, un caractère de plus l’arrête', () => {
    const { model, fields } = sheet({ title: 'x'.repeat(TEXT_MAX_LENGTH.title), description: '' });
    expect(fields().valid()).toBe(true);

    model.update((value) => ({ ...value, title: `${value.title}x` }));
    expect(fields().valid()).toBe(false);
    expect(fields.title().errors()).toEqual([expect.objectContaining({ kind: 'maxLength', maxLength: 200 })]);
  });

  it('une description s’arrête à 5 000 caractères, et la longueur est donnée au champ', () => {
    const { fields } = sheet({ title: 'Portfolio', description: 'x'.repeat(TEXT_MAX_LENGTH.longText + 1) });
    expect(fields.description().invalid()).toBe(true);
    expect(fields.description().maxLength?.()).toBe(5000);
    expect(fields.title().maxLength?.()).toBe(200);
  });

  it('un nom fait d’espaces reste demandé', () => {
    const { fields } = sheet({ title: '   ', description: '' });
    expect(fields.title().errors()).toEqual([expect.objectContaining({ kind: 'required', message: 'Donne un nom à cette étape.' })]);
  });
});

describe('le brouillon d’un nouvel objectif', () => {
  const draft = (overrides: Partial<{ title: string; why: string; dueDate: string; description: string }>) =>
    TestBed.runInInjectionContext(() =>
      form(signal({ title: 'Courir un semi', why: '', dueDate: '', description: '', ...overrides }), newObjectiveSchema),
    );

  it('borne le nom, le pourquoi et la description comme l’API', () => {
    expect(draft({})().valid()).toBe(true);
    expect(draft({ title: 'x'.repeat(201) }).title().invalid()).toBe(true);
    expect(draft({ why: 'x'.repeat(5001) }).why().invalid()).toBe(true);
    expect(draft({ description: 'x'.repeat(5001) }).description().invalid()).toBe(true);
    expect(draft({ why: 'x'.repeat(5000), description: 'x'.repeat(5000) })().valid()).toBe(true);
  });
});

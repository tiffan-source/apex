import { formatHorizon } from './objective-view.mapper';
import { fromDateInputValue, toDateInputValue } from './date-input.mapper';

/*
 * Ces tests valent dans tous les fuseaux. Ils ont aussi été lancés avec TZ=America/Montreal et TZ=Asia/Tokyo.
 */
describe('date-input.mapper', () => {
  const NOW = new Date(2026, 9, 19);

  it('lit un champ date en heure locale, à minuit', () => {
    const date = fromDateInputValue('2026-06-01');
    expect(date && [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 5, 1, 0]);
  });

  it('lit un champ mois comme le 1er du mois', () => {
    const date = fromDateInputValue('2027-05');
    expect(date && [date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2027, 4, 1]);
  });

  it('refuse une valeur vide ou impossible', () => {
    expect(fromDateInputValue('')).toBeUndefined();
    expect(fromDateInputValue(null)).toBeUndefined();
    expect(fromDateInputValue('2026-02-31')).toBeUndefined();
    expect(fromDateInputValue('2026-13-01')).toBeUndefined();
    expect(fromDateInputValue('1er juin')).toBeUndefined();
  });

  it('l’horizon garde le mois choisi, dans tous les fuseaux', () => {
    expect(formatHorizon(fromDateInputValue('2026-06-01')?.toISOString(), NOW)).toBe("Jusqu'en juin");
    expect(formatHorizon(fromDateInputValue('2026-05-31')?.toISOString(), NOW)).toBe("Jusqu'en mai");
    expect(formatHorizon(fromDateInputValue('2027-01-01')?.toISOString(), NOW)).toBe("Jusqu'en janvier 2027");
  });

  it('fait l’aller-retour champ → échéance ISO → champ sans perdre de jour', () => {
    for (const value of ['2026-01-01', '2026-03-29', '2026-06-01', '2026-10-25', '2026-12-31', '2028-02-29'])
      expect(toDateInputValue(fromDateInputValue(value)?.toISOString())).toBe(value);
  });

  it('préremplit un champ depuis une échéance, en heure locale', () => {
    expect(toDateInputValue(new Date(2026, 5, 1))).toBe('2026-06-01');
    expect(toDateInputValue(new Date(2026, 5, 1, 23, 30).toISOString())).toBe('2026-06-01');
    expect(toDateInputValue('')).toBe('');
    expect(toDateInputValue(undefined)).toBe('');
    expect(toDateInputValue('pas une date')).toBe('');
  });
});

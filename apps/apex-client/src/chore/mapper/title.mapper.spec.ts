import { CRUMB_TITLE_MAX, shortTitle } from './title.mapper';

/** Une place plus courte que celle d'un fil d'Ariane. */
const SHORT = 24;

describe('shortTitle', () => {
  it('garde un titre court tel quel, sans espaces superflus', () => {
    expect(shortTitle('  Licence  ', SHORT)).toBe('Licence');
    expect(shortTitle('Semi-marathon   en mai', CRUMB_TITLE_MAX)).toBe('Semi-marathon en mai');
    expect(shortTitle('a'.repeat(10), 10)).toBe('a'.repeat(10));
  });

  it('coupe un titre long au dernier mot entier, avec « … »', () => {
    expect(shortTitle('Préparer et courir un semi-marathon avant la fin du mois de mai', CRUMB_TITLE_MAX)).toBe(
      'Préparer et courir un…',
    );
  });

  it('garde le dernier mot quand la coupe tombe juste après lui', () => {
    // « Courir un semi-marathon » fait 23 caractères : avec « … », 24.
    expect(shortTitle('Courir un semi-marathon en mai', SHORT)).toBe('Courir un semi-marathon…');
  });

  it('ne finit pas sur une ponctuation', () => {
    expect(shortTitle('Licence, master et doctorat en trois ans', 12)).toBe('Licence…');
  });

  it('coupe au milieu d’un mot trop long plutôt que de déborder', () => {
    expect(shortTitle('a'.repeat(40), 10)).toBe(`${'a'.repeat(9)}…`);
    expect(shortTitle('Anticonstitutionnellementissime et la suite', SHORT)).toBe('Anticonstitutionnelleme…');
  });

  it('« … » compris, ne dépasse jamais la longueur demandée', () => {
    const titles = [
      'Courir un semi-marathon en mai',
      'Valider ma première année de licence en droit',
      'Apprendre la guitare, puis jouer avec des amis',
      `${'x'.repeat(31)} y`,
    ];
    for (const title of titles)
      for (const max of [SHORT, CRUMB_TITLE_MAX, 12]) expect(shortTitle(title, max).length).toBeLessThanOrEqual(max);
  });
});

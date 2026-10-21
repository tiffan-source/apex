import { CRUMB_TITLE_MAX, FILTER_TITLE_MAX, distinctShortTitles, shortTitle } from './title.mapper';

describe('shortTitle', () => {
  it('garde un titre court tel quel, sans espaces superflus', () => {
    expect(shortTitle('  Licence  ', FILTER_TITLE_MAX)).toBe('Licence');
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
    expect(shortTitle('Courir un semi-marathon en mai', FILTER_TITLE_MAX)).toBe('Courir un semi-marathon…');
  });

  it('ne finit pas sur une ponctuation', () => {
    expect(shortTitle('Licence, master et doctorat en trois ans', 12)).toBe('Licence…');
  });

  it('coupe au milieu d’un mot trop long plutôt que de déborder', () => {
    expect(shortTitle('a'.repeat(40), 10)).toBe(`${'a'.repeat(9)}…`);
    expect(shortTitle('Anticonstitutionnellementissime et la suite', FILTER_TITLE_MAX)).toBe('Anticonstitutionnelleme…');
  });

  it('« … » compris, ne dépasse jamais la longueur demandée', () => {
    const titles = [
      'Courir un semi-marathon en mai',
      'Valider ma première année de licence en droit',
      'Apprendre la guitare, puis jouer avec des amis',
      `${'x'.repeat(31)} y`,
    ];
    for (const title of titles)
      for (const max of [FILTER_TITLE_MAX, CRUMB_TITLE_MAX, 12]) expect(shortTitle(title, max).length).toBeLessThanOrEqual(max);
  });
});

describe('distinctShortTitles', () => {
  it('coupe comme shortTitle quand les titres courts diffèrent déjà', () => {
    const titles = ['Courir un semi-marathon en mai', 'Licence', 'Guitare'];
    expect(distinctShortTitles(titles, FILTER_TITLE_MAX)).toEqual(titles.map((title) => shortTitle(title, FILTER_TITLE_MAX)));
  });

  it('départage deux titres coupés au même endroit par leurs derniers mots, sans dépasser la longueur demandée', () => {
    const labels = distinctShortTitles(
      [
        "Préparer le concours d'entrée 2027",
        "Préparer le concours d'entrée 2028",
        'Licence',
        'Apprendre le japonais : niveau N4',
        'Apprendre le japonais : niveau N3',
      ],
      FILTER_TITLE_MAX,
    );
    expect(labels).toEqual(['Préparer le… 2027', 'Préparer le… 2028', 'Licence', 'Apprendre le… N4', 'Apprendre le… N3']);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label.length).toBeLessThanOrEqual(FILTER_TITLE_MAX);
  });

  it('prend autant de derniers mots qu’il en faut', () => {
    expect(distinctShortTitles(['Un titre assez long, version du 3 mai', 'Un titre assez long, version du 4 mai'], FILTER_TITLE_MAX)).toEqual([
      'Un titre assez… 3 mai',
      'Un titre assez… 4 mai',
    ]);
  });

  it('laisse deux titres identiques tels que shortTitle les coupe', () => {
    const same = 'Même titre assez long pour être coupé';
    expect(distinctShortTitles([same, same], FILTER_TITLE_MAX)).toEqual([shortTitle(same, FILTER_TITLE_MAX), shortTitle(same, FILTER_TITLE_MAX)]);
  });
});

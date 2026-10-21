import { firstName } from './person.mapper';

describe('firstName', () => {
  it('garde le premier mot du nom', () => {
    expect(firstName('Léa Martin', 'Toi')).toBe('Léa');
    expect(firstName('  Léa   Martin ', 'Toi')).toBe('Léa');
  });

  it("écrit « Toi » sans nom", () => {
    expect(firstName('', 'Toi')).toBe('Toi');
    expect(firstName('   ', 'Toi')).toBe('Toi');
    expect(firstName(null, 'Toi')).toBe('Toi');
    expect(firstName(undefined, 'Toi')).toBe('Toi');
  });

  it("n'écrit jamais une adresse e-mail en guise de prénom", () => {
    expect(firstName('lea.martin@example.com', 'Toi')).toBe('Toi');
  });
});

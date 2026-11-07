import { motsAEviter } from '@empreinte-studio/angular/core';
import { voiceIssues } from '../../chore/constants/messages.constante';
import { OBJECTIVE_ERASURE, STAGE_ERASURE, objectiveErasureText, stageErasureText } from './erase-labels';

describe('les mots de l’effacement', () => {
  describe('ce qu’une étape emporte', () => {
    it('ses pas, dont ceux qui sont faits, puis ce que devient l’arête', () => {
      expect(stageErasureText({ done: 4, total: 7 }, 6)).toBe(
        'Elle emporte ses 7 pas, dont 4 faits. Ton arête passe de 6 à 5 étapes. Ça ne se récupère pas.',
      );
    });

    it('accorde chaque nombre', () => {
      expect(stageErasureText({ done: 1, total: 3 }, 2)).toBe(
        'Elle emporte ses 3 pas, dont 1 fait. Ton arête passe de 2 à 1 étape. Ça ne se récupère pas.',
      );
      expect(stageErasureText({ done: 0, total: 2 }, 3)).toBe(
        'Elle emporte ses 2 pas. Ton arête passe de 3 à 2 étapes. Ça ne se récupère pas.',
      );
      expect(stageErasureText({ done: 1, total: 1 }, 4)).toBe(
        'Elle emporte son pas, déjà fait. Ton arête passe de 4 à 3 étapes. Ça ne se récupère pas.',
      );
      expect(stageErasureText({ done: 0, total: 1 }, 4)).toBe(
        'Elle emporte son pas. Ton arête passe de 4 à 3 étapes. Ça ne se récupère pas.',
      );
    });

    it('ne parle pas de pas qu’elle n’a pas, ni d’une arête vide en chiffres', () => {
      expect(stageErasureText({ done: 0, total: 0 }, 1)).toBe("Ton arête n'aura plus d'étape. Ça ne se récupère pas.");
    });
  });

  describe('ce qu’un objectif emporte', () => {
    it('ses étapes, ses pas dont ceux qui sont faits, et la conversation avec Akari', () => {
      expect(objectiveErasureText(6, { done: 9, total: 21 })).toBe(
        'Ses 6 étapes, ses 21 pas dont 9 faits et ta conversation avec Akari partent avec lui. Ça ne se récupère pas.',
      );
    });

    it('accorde chaque nombre, et le verbe', () => {
      expect(objectiveErasureText(1, { done: 0, total: 1 })).toBe(
        'Son étape, son pas et ta conversation avec Akari partent avec lui. Ça ne se récupère pas.',
      );
      expect(objectiveErasureText(2, { done: 0, total: 0 })).toBe(
        'Ses 2 étapes et ta conversation avec Akari partent avec lui. Ça ne se récupère pas.',
      );
      expect(objectiveErasureText(0, { done: 1, total: 3 })).toBe(
        'Ses 3 pas dont 1 fait et ta conversation avec Akari partent avec lui. Ça ne se récupère pas.',
      );
      expect(objectiveErasureText(0, { done: 0, total: 0 })).toBe(
        'Ta conversation avec Akari part avec lui. Ça ne se récupère pas.',
      );
    });
  });

  it('parle comme Empreinte : on efface, on ne supprime pas', () => {
    const texts = [
      ...Object.values(STAGE_ERASURE),
      ...Object.values(OBJECTIVE_ERASURE),
      stageErasureText({ done: 4, total: 7 }, 6),
      stageErasureText({ done: 0, total: 0 }, 1),
      objectiveErasureText(6, { done: 9, total: 21 }),
      objectiveErasureText(0, { done: 0, total: 0 }),
    ];
    for (const text of texts) {
      expect(motsAEviter(text), text).toEqual([]);
      expect(voiceIssues(text), text).toEqual([]);
    }
  });
});

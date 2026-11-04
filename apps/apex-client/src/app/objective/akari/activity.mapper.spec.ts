import type { WorkflowActivity, WorkflowActivityStep } from '../../../chore/api/api.models';
import {
  AKARI_JOURNAL,
  AKARI_JOURNAL_LINES,
  AKARI_LONG_WAIT_MS,
  AKARI_STATUS,
  AKARI_STILL_THINKING,
  AKARI_TAKING_LONGER,
  AKARI_THINKING,
  AKARI_VERY_LONG_WAIT_MS,
  akariJournal,
  akariStatusLine,
} from './activity.mapper';

/** Ce que fait Akari : une étape, par défaut au premier passage par l'IA, sans rien de fait avant. */
const activity = (step: WorkflowActivityStep, overrides: Partial<WorkflowActivity> = {}): WorkflowActivity => ({
  step,
  elapsedMs: 0,
  round: 1,
  done: [],
  ...overrides,
});

describe('akariStatusLine', () => {
  it.each([
    ['saving-message', 'Akari note ton message…'],
    ['thinking', 'Akari réfléchit…'],
    ['checking-permission', "Akari vérifie s'il lui faut ton accord…"],
    ['reading', 'Akari regarde ton objectif…'],
    ['writing', 'Akari ajoute ce que tu as accepté…'],
    ['saving-reply', 'Akari écrit sa réponse…'],
  ] as const)('%s : « %s »', (step, phrase) => {
    expect(akariStatusLine(activity(step))).toBe(phrase);
  });

  it('numérote les tours de boucle', () => {
    expect(akariStatusLine(activity('reviewing', { round: 2 }))).toBe('Akari fait le point, 2e tour…');
    expect(akariStatusLine(activity('reviewing', { round: 3 }))).toBe('Akari fait le point, 3e tour…');
    // Un tour commencé avant le journal ne sait pas où il en est : la phrase ne donne pas de numéro.
    expect(akariStatusLine(activity('reviewing', { round: 0 }))).toBe('Akari fait le point…');
  });

  it('dit qu’Akari réfléchit encore quand un appel à l’IA dure', () => {
    const waited = (step: WorkflowActivityStep, elapsedMs: number) => akariStatusLine(activity(step, { round: 2, elapsedMs }));

    expect(waited('thinking', AKARI_LONG_WAIT_MS - 1)).toBe('Akari réfléchit…');
    expect(waited('thinking', AKARI_LONG_WAIT_MS)).toBe(AKARI_STILL_THINKING);
    expect(waited('reviewing', AKARI_LONG_WAIT_MS)).toBe(AKARI_STILL_THINKING);
    expect(waited('thinking', AKARI_VERY_LONG_WAIT_MS)).toBe(AKARI_TAKING_LONGER);
    expect(waited('reviewing', AKARI_VERY_LONG_WAIT_MS)).toBe(AKARI_TAKING_LONGER);
  });

  it('ne parle pas de réflexion pour une étape qui n’interroge pas l’IA', () => {
    expect(akariStatusLine(activity('writing', { elapsedMs: AKARI_VERY_LONG_WAIT_MS }))).toBe(AKARI_STATUS.writing);
  });

  it('garde une phrase par défaut pour un code que ce client ne connaît pas, ou sans activité', () => {
    expect(akariStatusLine(activity('nouveau-code' as WorkflowActivityStep))).toBe(AKARI_THINKING);
    expect(akariStatusLine(null)).toBe(AKARI_THINKING);
  });
});

describe('akariJournal', () => {
  it('dit dans l’ordre ce qu’Akari a déjà fait', () => {
    expect(akariJournal(activity('reviewing', { done: ['saving-message', 'thinking', 'checking-permission', 'reading'] }))).toEqual([
      "J'ai noté ton message.",
      "J'ai réfléchi à ta demande.",
      "J'ai vérifié s'il me fallait ton accord.",
      "J'ai regardé ton objectif.",
    ]);
  });

  it('a une ligne pour chaque code du contrat', () => {
    expect(Object.keys(AKARI_JOURNAL).sort()).toEqual(Object.keys(AKARI_STATUS).sort());
  });

  it('ne garde que les dernières lignes d’un long tour', () => {
    const done: WorkflowActivityStep[] = ['saving-message', 'thinking', 'checking-permission', 'reading', 'reviewing', 'checking-permission', 'writing'];
    const lines = akariJournal(activity('reviewing', { done }));

    expect(lines).toHaveLength(AKARI_JOURNAL_LINES);
    expect(lines.at(-1)).toBe(AKARI_JOURNAL.writing);
    expect(lines).not.toContain(AKARI_JOURNAL['saving-message']);
  });

  it('passe un code que ce client ne connaît pas, et n’a rien à dire sans activité', () => {
    expect(akariJournal(activity('reviewing', { done: ['nouveau-code' as WorkflowActivityStep, 'reading'] }))).toEqual([AKARI_JOURNAL.reading]);
    expect(akariJournal(null)).toEqual([]);
  });
});

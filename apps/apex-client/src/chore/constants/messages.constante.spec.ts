import { motsAEviter } from '@empreinte-studio/angular/core';
import { QUADRANTS } from '@empreinte-studio/angular/matrice';
import {
  CREATE_OBJECTIVE_FAILURES,
  FAILURE_REPORTS,
  SUCCESS_ANNOUNCEMENTS,
  failureReport,
  taskMovedAnnouncement,
  voiceIssues,
} from './messages.constante';
import { IMPORTANCE_OPTIONS, URGENCY_OPTIONS } from './task.constante';

/** Tous les textes que la plomberie peut dire à la personne. */
const texts = [
  ...Object.values(SUCCESS_ANNOUNCEMENTS),
  ...Object.values(FAILURE_REPORTS),
  ...QUADRANTS.map(taskMovedAnnouncement),
  ...IMPORTANCE_OPTIONS.map((option) => option.libelle),
  ...URGENCY_OPTIONS.map((option) => option.libelle),
];

describe('les textes de la plomberie', () => {
  it.each(texts)('« %s » parle comme Empreinte', (text) => {
    expect(motsAEviter(text)).toEqual([]);
    expect(voiceIssues(text)).toEqual([]);
    expect(text).not.toMatch(/erreur|succès|échec|supprim|!/i);
  });

  it('chaque signalement dit quoi faire ensuite', () => {
    for (const report of Object.values(FAILURE_REPORTS)) expect(report).toMatch(/réessaie|recharge la page/);
  });

  it('nomme le quadrant d’arrivée', () => {
    expect(taskMovedAnnouncement('planifier')).toBe('Ce pas passe dans « À planifier ».');
  });
});

describe('failureReport', () => {
  it('choisit la phrase de l’action par défaut', () => {
    expect(failureReport('addTask')).toBe("Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.");
    expect(failureReport('createObjective', 'FAIL_TO_SAVE_OBJECTIVE')).toBe(FAILURE_REPORTS.createObjective);
    expect(failureReport('moveTask', 'UNKNOWN_ERROR')).toBe(FAILURE_REPORTS.moveTask);
  });

  it('dit ce qui manque quand l’API ne retrouve plus l’objectif ou le pas', () => {
    expect(failureReport('addTask', 'OBJECTIVE_NOT_FOUND')).toBe(FAILURE_REPORTS.objectiveNotFound);
    expect(failureReport('editTask', 'TASK_NOT_FOUND')).toBe(FAILURE_REPORTS.taskNotFound);
  });

  it('dit ce que l’API refuse : un texte trop long, trop de gestes à la suite', () => {
    expect(failureReport('addTask', 'VALIDATION_ERROR')).toBe(FAILURE_REPORTS.textTooLong);
    expect(failureReport('editObjective', 'PAYLOAD_TOO_LARGE')).toBe(FAILURE_REPORTS.textTooLong);
    expect(failureReport('editObjective', 'TOO_MANY_REQUESTS')).toBe(FAILURE_REPORTS.tooManyRequests);
    // Sans réponse de l'API, la phrase de l'action (qui dit de vérifier la connexion).
    expect(failureReport('toggleTask', 'NETWORK_ERROR')).toBe(FAILURE_REPORTS.toggleTask);
  });

  it('dit que la session a pris fin quand l’API refuse le jeton, sans parler de connexion', () => {
    expect(failureReport('addStage', 'UNAUTHENTICATED')).toBe(FAILURE_REPORTS.sessionEnded);
    expect(failureReport('loadObjectives', 'INVALID_SESSION')).toBe(FAILURE_REPORTS.sessionEnded);
    expect(FAILURE_REPORTS.sessionEnded).not.toMatch(/connexion/);
  });

  it('CREATE_OBJECTIVE_FAILURES rassemble les phrases d’une création qui n’aboutit pas', () => {
    const codes = [undefined, 'FAIL_TO_SAVE_OBJECTIVE', 'VALIDATION_ERROR', 'PAYLOAD_TOO_LARGE', 'TOO_MANY_REQUESTS', 'NETWORK_ERROR', 'UNAUTHENTICATED'];
    for (const code of codes)
      expect(CREATE_OBJECTIVE_FAILURES.has(failureReport('createObjective', code)), String(code)).toBe(true);
    expect(CREATE_OBJECTIVE_FAILURES.has(FAILURE_REPORTS.toggleTask)).toBe(false);
  });
});

describe('les niveaux d’importance et d’urgence', () => {
  it.each([
    ['importance', IMPORTANCE_OPTIONS],
    ['urgence', URGENCY_OPTIONS],
  ] as const)('%s : cinq niveaux, de 1 à 5, en { valeur, libelle }', (_, options) => {
    expect(options.map((option) => option.valeur)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(options.map((option) => option.libelle)).size).toBe(5);
  });

  it('le niveau 3 est le premier « important » et le premier « urgent » (seuil de la matrice)', () => {
    expect(IMPORTANCE_OPTIONS.find((option) => option.valeur === 2)?.libelle).toBe('Secondaire');
    expect(IMPORTANCE_OPTIONS.find((option) => option.valeur === 3)?.libelle).toBe('Important');
    expect(URGENCY_OPTIONS.find((option) => option.valeur === 2)?.libelle).toBe('Pas urgent');
    expect(URGENCY_OPTIONS.find((option) => option.valeur === 3)?.libelle).toBe('Urgent');
  });
});

describe('voiceIssues', () => {
  it('voit ce que motsAEviter() laisse passer (mots qui commencent par une lettre accentuée)', () => {
    // Empreinte : \b ne reconnaît pas « é » en début de mot
    expect(motsAEviter('Un échec.')).toEqual([]);
    expect(voiceIssues('Un échec.')).toEqual(['échec']);
    expect(voiceIssues('La connexion a échoué.')).toEqual(['échec']);
    expect(voiceIssues('C’est raté.')).toEqual(['raté']);
    expect(voiceIssues('Pas supprimé.')).toEqual(['supprimer']);
    expect(voiceIssues('Une erreur est survenue')).toEqual(['erreur']);
  });

  it('garde ce que motsAEviter() voit déjà', () => {
    expect(voiceIssues('Bravo !')).toEqual(["point d'exclamation"]);
    expect(voiceIssues('Il te reste 40 %')).toEqual(['il te reste', 'pourcentage']);
    expect(voiceIssues('Tu es en retard')).toEqual(['en retard']);
    expect(voiceIssues('Bravo 🎉')).toEqual(['emoji']);
  });

  it('laisse passer la voix d’Empreinte', () => {
    expect(voiceIssues('4 pas faits · 3 à venir')).toEqual([]);
    expect(voiceIssues('Un pas de plus.')).toEqual([]);
    expect(voiceIssues('Ce pas passe dans « À laisser filer ».')).toEqual([]);
    expect(voiceIssues('Je ne retrouve plus ce pas. Recharge la page, puis réessaie.')).toEqual([]);
  });
});

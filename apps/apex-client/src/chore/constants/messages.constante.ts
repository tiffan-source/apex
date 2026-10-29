import { motsAEviter } from '@empreinte-studio/angular/core';
import { TITRES_QUADRANTS, type Quadrant } from '@empreinte-studio/angular/matrice';

/*
 * Les phrases que les stores disent à la personne, dans la voix d'Empreinte : tutoiement,
 * phrases courtes, jamais « erreur », « échec », « succès », « supprimer » ni point d'exclamation.
 * Les réussites sont annoncées aux lecteurs d'écran (AnnoncesStore.annoncer) ; ce qui n'a pas
 * marché est signalé dans la page (AnnoncesStore.signaler), avec ce qu'il faut faire ensuite.
 *
 * « Pas » ouvre rarement une phrase : « Pas ajouté. » se lirait « non ajouté ».
 */

/** Les annonces discrètes des réussites. */
export const SUCCESS_ANNOUNCEMENTS = {
  objectiveCreated: 'Ton objectif est en marche.',
  objectiveSaved: 'Modifications enregistrées.',
  stageAdded: 'Étape ajoutée.',
  taskAdded: 'Nouveau pas ajouté.',
  taskSaved: 'Ce pas est à jour.',
  taskDone: 'Un pas de plus.',
  taskUndone: 'Ce pas est de nouveau à faire.',
} as const;

/** L'annonce d'un pas déplacé dans la matrice : « Ce pas passe dans « À planifier ». » */
export function taskMovedAnnouncement(quadrant: Quadrant): string {
  return `Ce pas passe dans « ${TITRES_QUADRANTS[quadrant]} ».`;
}

/** Les signalements : ce qui n'a pas marché, et quoi faire. */
export const FAILURE_REPORTS = {
  createObjective: "Je n'ai pas pu enregistrer cet objectif. Vérifie ta connexion, puis réessaie.",
  editObjective: "Je n'ai pas pu enregistrer tes modifications. Vérifie ta connexion, puis réessaie.",
  addStage: "Je n'ai pas pu ajouter cette étape. Vérifie ta connexion, puis réessaie.",
  addTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  editTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  toggleTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  moveTask: "Je n'ai pas pu déplacer ce pas. Vérifie ta connexion, puis réessaie.",
  loadObjectives: "Je n'ai pas pu charger tes objectifs. Vérifie ta connexion, puis recharge la page.",
  objectiveNotFound: 'Je ne retrouve plus cet objectif. Recharge la page, puis réessaie.',
  taskNotFound: 'Je ne retrouve plus ce pas. Recharge la page, puis réessaie.',
  // L'API borne les textes (200 caractères pour un nom, 5 000 pour une description ou un pourquoi).
  textTooLong: 'Ce texte est trop long pour être enregistré. Raccourcis-le, puis réessaie.',
  tooManyRequests: 'Beaucoup de gestes à la suite. Attends une minute, puis réessaie.',
} as const;

/** Les phrases choisies par le code d'erreur de l'API, quelle que soit l'action. */
type CodeReport = 'objectiveNotFound' | 'taskNotFound' | 'textTooLong' | 'tooManyRequests';

/**
 * Les phrases qu'une création d'objectif peut signaler (failureReport) : l'écran « Nouvel objectif » y
 * reconnaît que sa création n'a pas abouti.
 */
export const CREATE_OBJECTIVE_FAILURES: ReadonlySet<string> = new Set([
  FAILURE_REPORTS.createObjective,
  FAILURE_REPORTS.textTooLong,
  FAILURE_REPORTS.tooManyRequests,
]);

/** Les actions qui peuvent ne pas aboutir. */
export type FailedAction = Exclude<keyof typeof FAILURE_REPORTS, CodeReport>;

/**
 * La phrase à signaler quand une action n'aboutit pas, d'après le code d'erreur de l'API (ApiError.code).
 * Le message de l'API (technique, en anglais) n'est jamais montré : seul son code choisit la phrase.
 * Sans code connu (réseau, panne du serveur…), la phrase de l'action.
 */
export function failureReport(action: FailedAction, errorCode?: string): string {
  switch (errorCode) {
    case 'OBJECTIVE_NOT_FOUND':
      return FAILURE_REPORTS.objectiveNotFound;
    case 'TASK_NOT_FOUND':
      return FAILURE_REPORTS.taskNotFound;
    case 'VALIDATION_ERROR':
      return FAILURE_REPORTS.textTooLong;
    case 'TOO_MANY_REQUESTS':
      return FAILURE_REPORTS.tooManyRequests;
    default:
      return FAILURE_REPORTS[action];
  }
}

/*
 * Le contrôle de la voix, pour les tests de l'application. motsAEviter() d'Empreinte ne suffit pas seul :
 * ses motifs commencent par \b, qui ne reconnaît pas une lettre accentuée en début de mot. « échec »,
 * « échoué », « raté », « manqué » ou « supprimé » lui échappent. Ces motifs-ci s'appuient sur les lettres Unicode.
 */
const OUTSIDE_THE_VOICE: readonly { word: string; pattern: RegExp }[] = [
  { word: 'échec', pattern: /(?<!\p{L})(échec|échou)/iu },
  { word: 'erreur', pattern: /(?<!\p{L})erreur/iu },
  { word: 'succès', pattern: /(?<!\p{L})succès/iu },
  { word: 'raté', pattern: /(?<!\p{L})rat(é|ée|és|ées)(?!\p{L})/iu },
  { word: 'manqué', pattern: /(?<!\p{L})manqu(é|ée|és|ées)(?!\p{L})/iu },
  { word: 'perdu', pattern: /(?<!\p{L})perdu(e|s|es)?(?!\p{L})/iu },
  { word: 'supprimer', pattern: /(?<!\p{L})supprim/iu },
  { word: 'en retard', pattern: /(?<!\p{L})en retard(?!\p{L})/iu },
  { word: 'pourcentage', pattern: /\d+\s*%/u },
  { word: "point d'exclamation", pattern: /!/u },
  { word: 'emoji', pattern: /\p{Extended_Pictographic}/u },
];

/** Les mots hors de la voix d'Empreinte dans un texte (vide : le texte parle comme Empreinte). */
export function voiceIssues(text: string): string[] {
  const words = new Set(motsAEviter(text).map(({ mot }) => mot));
  for (const { word, pattern } of OUTSIDE_THE_VOICE) if (pattern.test(text)) words.add(word);
  return [...words];
}

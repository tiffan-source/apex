import { motsAEviter } from '@empreinte-studio/angular/core';

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
  // Un pas effacé ne s'annonce pas ici : sa trace l'a déjà dit, le temps de le remettre.
  stageErased: 'Étape effacée.',
  objectiveErased: 'Objectif effacé.',
} as const;

/** Les signalements : ce qui n'a pas marché, et quoi faire. */
export const FAILURE_REPORTS = {
  createObjective: "Je n'ai pas pu enregistrer cet objectif. Vérifie ta connexion, puis réessaie.",
  editObjective: "Je n'ai pas pu enregistrer tes modifications. Vérifie ta connexion, puis réessaie.",
  addStage: "Je n'ai pas pu ajouter cette étape. Vérifie ta connexion, puis réessaie.",
  addTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  editTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  toggleTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  // L'effacement n'a pas abouti : ce qui était parti revient à sa place.
  eraseTask: "Je n'ai pas pu effacer ce pas : il est revenu à sa place. Vérifie ta connexion, puis réessaie.",
  eraseStage: "Je n'ai pas pu effacer cette étape : elle est revenue à sa place. Vérifie ta connexion, puis réessaie.",
  eraseObjective:
    "Je n'ai pas pu effacer cet objectif : il est revenu parmi tes objectifs. Vérifie ta connexion, puis réessaie.",
  loadObjectives: "Je n'ai pas pu charger tes objectifs. Vérifie ta connexion, puis recharge la page.",
  /** Une relecture reste sans réponse : le store continue d'essayer, la note part dès que le serveur répond. */
  reloadObjectives: "Je n'arrive pas à relire tes objectifs pour l'instant. Vérifie ta connexion, je réessaie en attendant.",
  // Une commande répond 404 : l'élément a été effacé ailleurs (un autre onglet, Akari), l'écran le retire.
  objectiveNotFound: "Je ne retrouve plus cet objectif : il a été effacé ailleurs, je l'ai retiré. Recrée-le si tu en as encore besoin.",
  taskNotFound: "Je ne retrouve plus ce pas : il a été effacé ailleurs, je l'ai retiré. Recrée-le si tu en as encore besoin.",
  // L'API borne les textes (200 caractères pour un nom, 5 000 pour une description ou un pourquoi).
  textTooLong: 'Ce texte est trop long pour être enregistré. Raccourcis-le, puis réessaie.',
  tooManyRequests: 'Beaucoup de gestes à la suite. Attends une minute, puis réessaie.',
  // L'API a refusé de renouveler la session : la personne retourne à la connexion (provideSessionEndRedirect).
  sessionEnded: 'Ta session a pris fin. Reconnecte-toi, puis réessaie.',
} as const;

/** Les phrases choisies par le code d'erreur de l'API, quelle que soit l'action. */
type CodeReport = 'objectiveNotFound' | 'taskNotFound' | 'textTooLong' | 'tooManyRequests' | 'sessionEnded';

/** Les actions qui peuvent ne pas aboutir. */
export type FailedAction = Exclude<keyof typeof FAILURE_REPORTS, CodeReport>;

/** Les effacements : ils n'envoient aucun texte, et un élément déjà effacé n'est pas un souci (l'API répond 404). */
const ERASE_ACTIONS: ReadonlySet<FailedAction> = new Set<FailedAction>(['eraseTask', 'eraseStage', 'eraseObjective']);

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
    // Les formulaires écartent un nom vide : ce que l'API refuse encore, c'est un texte trop long. Un effacement
    // n'envoie aucun texte : il garde sa phrase.
    case 'VALIDATION_ERROR':
    case 'PAYLOAD_TOO_LARGE':
      return ERASE_ACTIONS.has(action) ? FAILURE_REPORTS[action] : FAILURE_REPORTS.textTooLong;
    case 'TOO_MANY_REQUESTS':
      return FAILURE_REPORTS.tooManyRequests;
    // Le jeton est refusé et n'a pas pu être renouvelé (une panne pendant le renouvellement remonte
    // comme une panne : voir authInterceptor).
    case 'UNAUTHENTICATED':
    case 'INVALID_SESSION':
      return FAILURE_REPORTS.sessionEnded;
    default:
      return FAILURE_REPORTS[action];
  }
}

/*
 * Le contrôle de la voix, pour les tests de l'application. motsAEviter() d'Empreinte ne suffit pas seul : il ne
 * connaît ni « erreur », ni « succès », ni les emoji. Ces motifs-ci les ajoutent, et gardent ceux qui commencent
 * par une lettre accentuée (« échec », « raté », « supprimé »), qu'Empreinte voit aussi depuis la 0.6.0. Ils
 * s'appuient sur les lettres Unicode.
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

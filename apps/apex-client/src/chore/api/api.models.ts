/*
 * Le contrat de l'API d'Apex Brain, le serveur d'Apex (dépôt tiffan-source/apex-brain, docs/api.md ; le
 * document OpenAPI complet est servi sur /docs-json). Ces types décrivent ce qui passe sur le réseau :
 * corps envoyés et réponses, dates en ISO 8601. Les stores les traduisent en modèles d'écran (chore/mapper).
 *
 * Toutes les règles métier vivent dans l'API : le client n'envoie que les gestes de la personne et
 * affiche ce que l'API rend. Le propriétaire n'est jamais envoyé : le serveur le tire du jeton.
 */

// #region authentification

/** La personne connectée. `name` : son nom d'affichage, à défaut son adresse e-mail. */
export type ApiUser = {
  id: string;
  name: string;
  email: string;
};

/** Les jetons d'une session ouverte. `expiresAt` : l'expiration du jeton d'accès (ISO 8601). */
export type ApiSessionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type Credentials = {
  email: string;
  password: string;
};

/** POST /v2/auth/login et POST /v2/auth/refresh. */
export type SignedInResponse = {
  user: ApiUser;
  session: ApiSessionTokens;
};

/** POST /v2/auth/register : `session` vaut null tant que l'adresse e-mail doit être confirmée. */
export type RegisteredResponse = {
  user: ApiUser;
  session: ApiSessionTokens | null;
};

// #endregion

// #region longueurs

/**
 * Les longueurs que l'API accepte, espaces autour retirés (apex-brain, apps/api/src/http/schemas.ts) ;
 * au-delà, elle répond VALIDATION_ERROR. Les formulaires s'arrêtent avant. (Un message à Akari s'arrête à
 * 4 000 caractères : la zone de réponse d'e-conversation ne le borne pas, l'API le refuse.)
 */
export const TEXT_MAX_LENGTH = {
  /** Le nom d'un objectif, d'une étape ou d'un pas. */
  title: 200,
  /** Une description, un pourquoi. */
  longText: 5000,
} as const;

// #endregion

// #region objectifs, étapes et pas (v2 : des commandes nommées, une lecture BFF)

/**
 * Un objectif (racine) ou une étape (`parentObjectiveId` : l'objectif ou l'étape qui la porte), tel que le rend
 * une commande : entier, sans ses enfants. Un texte vide vaut `""`, une échéance absente `null`.
 */
export type ObjectiveEntity = {
  id: string;
  title: string;
  description: string;
  why: string;
  dueDate: string | null;
  parentObjectiveId: string | null;
  /** Fait ou non fait : c'est l'API qui le dit, le client l'affiche sans le calculer. */
  done: boolean;
};

/** Un pas, tel que le rend une commande. `importance` et `urgency` vont de 1 à 5. */
export type TaskEntity = {
  id: string;
  title: string;
  importance: number;
  urgency: number;
  done: boolean;
  objectiveId: string;
};

/** Un pas dans l'arbre : il est rangé sous l'objectif ou l'étape qui le porte. */
export type ObjectiveTreeTask = Omit<TaskEntity, 'objectiveId'>;

/** Un objectif ou une étape dans l'arbre, avec ses pas et ses étapes, à toute profondeur. */
export type ObjectiveTreeNode = Omit<ObjectiveEntity, 'parentObjectiveId'> & {
  tasks: ObjectiveTreeTask[];
  subObjectives: ObjectiveTreeNode[];
};

/**
 * GET /v2/bff/objective-tree : tout ce que la personne possède, en arbre ; seuls les objectifs principaux sont
 * à la racine. Étapes et pas n'ont aucun ordre : le tri de l'API (création, puis id) garde seulement
 * l'affichage stable d'un chargement à l'autre.
 */
export type ObjectiveTreeResponse = {
  objectives: ObjectiveTreeNode[];
};

/** POST /v2/objectives (createObjective). `dueDate` : une date (« 2027-04-01 ») ou un instant ISO 8601. */
export type CreateObjectiveBody = {
  title: string;
  description?: string;
  why?: string;
  dueDate?: string;
};

/** POST /v2/objectives/{id}/sub-objectives (addSubObjective). */
export type AddSubObjectiveBody = {
  title: string;
};

/** POST /v2/objectives/{id}/tasks (addTaskToObjective). */
export type AddTaskBody = {
  title: string;
  importance: number;
  urgency: number;
};

/** PATCH /v2/objectives/{id}/rename et /v2/tasks/{id}/rename. */
export type RenameBody = {
  title: string;
};

/** PATCH /v2/objectives/{id}/clarify : un champ absent reste inchangé, `""` le vide ; au moins un champ. */
export type ClarifyObjectiveBody = {
  description?: string;
  why?: string;
};

/** PATCH /v2/objectives/{id}/set-deadline. */
export type SetDeadlineBody = {
  dueDate: string;
};

/** PATCH /v2/tasks/{id}/reprioritize. */
export type ReprioritizeTaskBody = {
  importance: number;
  urgency: number;
};

/** PATCH /v2/tasks/{id}/move : vers une autre étape, un objectif, un ancêtre. */
export type MoveTaskBody = {
  objectiveId: string;
};

// #endregion

// #region conversation et assistant

/** L'expéditeur des messages d'Akari ; ceux de la personne portent son id. */
export const AI_SENDER = 'AI';

export type ConversationMessage = {
  id: string;
  sender: string;
  content: string;
  createdAt: string;
};

/** GET /v2/objectives/{id}/conversation : les messages, dans l'ordre chronologique. */
export type ConversationResponse = {
  id: string;
  messages: ConversationMessage[];
};

/** Où en est le workflow d'Akari : prêt pour un message, en plein tour, ou en attente d'un accord. */
export type WorkflowStatus = 'ready' | 'processing' | 'awaiting-permission';

/** Ce qu'Akari peut être en train de faire pendant un tour. Un code inconnu de ce client garde une phrase par défaut. */
export type WorkflowActivityStep =
  | 'saving-message'
  | 'thinking'
  | 'checking-permission'
  | 'awaiting-permission'
  | 'reading'
  | 'writing'
  | 'reviewing'
  | 'saving-reply';

/** Ce que fait Akari pendant un tour, sans rien de la machine du workflow. */
export type WorkflowActivity = {
  /** Ce qu'il fait maintenant. */
  step: WorkflowActivityStep;
  /** Le temps déjà passé sur cette étape, en millisecondes (mesuré par le serveur). */
  elapsedMs: number;
  /** Ses passages par l'IA depuis le début du tour : à partir de 2, il repart pour un tour de boucle. */
  round: number;
  /** Ce qu'il a déjà fait pendant ce tour, du plus ancien au plus récent. */
  done: WorkflowActivityStep[];
};

/** Ce qu'Akari demande la permission de faire : ajouter une étape (`createSubObjective`), un pas (`createTask`)… */
export type ToolCall = {
  id: string;
  name: string;
  arguments: unknown;
};

/** Le dernier message enregistré par le workflow, de la personne ou d'Akari. */
export type RegisteredMessage = {
  id: string;
  content: string;
  sender: string;
  createdAt: string;
};

/** L'état du workflow d'un objectif (GET …/assistant, et les réponses 202 de POST …/messages et …/permission). */
export type WorkflowState = {
  objectiveId: string;
  status: WorkflowStatus;
  /** Ce que fait Akari ; null au repos. */
  activity: WorkflowActivity | null;
  /** L'outil qui attend l'accord de la personne, quand `status` vaut `awaiting-permission`. */
  pendingToolCall: ToolCall | null;
  lastRegisteredMessage: RegisteredMessage | null;
  /** La panne qui a interrompu le dernier tour ; elle disparaît au message suivant. */
  lastError: { code: string; step: string; at: string } | null;
};

// #endregion

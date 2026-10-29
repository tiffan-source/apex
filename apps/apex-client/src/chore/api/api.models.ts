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

/** POST /v1/auth/login et POST /v1/auth/refresh. */
export type SignedInResponse = {
  user: ApiUser;
  session: ApiSessionTokens;
};

/** POST /v1/auth/register : `session` vaut null tant que l'adresse e-mail doit être confirmée. */
export type RegisteredResponse = {
  user: ApiUser;
  session: ApiSessionTokens | null;
};

// #endregion

// #region objectifs, étapes et pas

/** Un objectif (racine) ou une étape (`parentObjective` : l'objectif ou l'étape qui la porte). */
export type ObjectiveOutput = {
  id: string;
  title: string;
  description: string;
  why: string;
  dueDate: string | null;
  parentObjective: string | null;
};

/** Un pas. `importance` et `urgency` vont de 1 à 5. */
export type TaskOutput = {
  id: string;
  title: string;
  importance: number;
  urgency: number;
  done: boolean;
  objectiveId: string;
};

/** GET /v1/objectives : tout ce que la personne possède, à plat, dans un ordre stable (création, puis id). */
export type ObjectivesResponse = {
  objectives: ObjectiveOutput[];
  tasks: TaskOutput[];
};

/** POST /v1/objectives. `dueDate` : une date (« 2027-04-01 ») ou un instant ISO 8601. */
export type CreateObjectiveBody = {
  title: string;
  description?: string;
  why?: string;
  dueDate?: string;
};

/** PATCH /v1/objectives/{id} (un objectif ou une étape) : un champ absent reste inchangé, `dueDate: null` retire l'échéance. */
export type EditObjectiveBody = {
  title: string;
  description?: string;
  why?: string;
  dueDate?: string | null;
};

/** La réponse de POST /v1/objectives et de PATCH /v1/objectives/{id}. */
export type ObjectiveResponse = {
  id: string;
  title: string;
  description?: string;
  why?: string;
  dueDate?: string;
};

/** POST /v1/objectives/{id}/sub-objectives. */
export type AddSubObjectiveBody = {
  title: string;
};

export type SubObjectiveResponse = {
  id: string;
  title: string;
};

/** POST /v1/objectives/{id}/tasks. */
export type AddTaskBody = {
  title: string;
  importance: number;
  urgency: number;
};

export type CreatedTaskResponse = {
  id: string;
  title: string;
  importance: number;
  urgency: number;
};

/** PATCH /v1/tasks/{id} : changer `objectiveId` déplace le pas (vers une étape, un objectif, un ancêtre). */
export type EditTaskBody = {
  title: string;
  objectiveId: string;
  importance: number;
  urgency: number;
};

export type EditedTaskResponse = CreatedTaskResponse & {
  objectiveId: string;
};

/** PUT /v1/tasks/{id}/done. */
export type TaskDoneResponse = {
  id: string;
  title: string;
  done: boolean;
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

/** GET /v1/objectives/{id}/conversation : les messages, dans l'ordre chronologique. */
export type ConversationResponse = {
  id: string;
  messages: ConversationMessage[];
};

/** Où en est le workflow d'Akari : prêt pour un message, en plein tour, ou en attente d'un accord. */
export type WorkflowStatus = 'ready' | 'processing' | 'awaiting-permission';

/** La position de la machine du workflow : une étape, ou une étape composée (`{ ExecutingAllTool: 'ExecutingTool' }`). */
export type WorkflowStateValue = string | { [step: string]: WorkflowStateValue };

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
  value: WorkflowStateValue;
  status: WorkflowStatus;
  /** L'outil qui attend l'accord de la personne, quand `status` vaut `awaiting-permission`. */
  pendingToolCall: ToolCall | null;
  lastRegisteredMessage: RegisteredMessage | null;
  /** La panne qui a interrompu le dernier tour ; elle disparaît au message suivant. */
  lastError: { code: string; step: string; at: string } | null;
};

// #endregion

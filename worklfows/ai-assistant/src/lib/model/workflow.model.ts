import { AIResponse, CallResult, RegisteredMessage, ToolCall } from "../workflow/actors.protocols";

/**
 * The data carried by a workflow throughout its execution.
 *
 * This is the single source of truth for the workflow shape: it both describes
 * the workflow in memory and models what we persist in the database.
 */
export type WorkflowContext = {
  userId: string;
  prompt: string;
  aiResponse: AIResponse;
  objectiveId: string;
  aiProviderInteractionId: string;
  toolCallResults: CallResult[];
  currentToolCall?: ToolCall;
  /**
   * The last message the workflow persisted in the conversation (user or AI),
   * carried here so the chat UI can display it from the workflow snapshot
   * instead of reloading the whole conversation.
   */
  lastRegisteredMessage?: RegisteredMessage;
};

/**
 * The current position of a workflow.
 *
 * It is either a single step name, or a nested map when the workflow is in a
 * composed step (a step that itself has an active sub-step).
 */
export type WorkflowStateValue = string | { [step: string]: WorkflowStateValue };

/**
 * The state a workflow sits in when it is idle and ready to accept a brand new
 * user message. Exposed as a constant so the machine and the UI gate the chat
 * input on the same value instead of each duplicating the string literal.
 */
export const WORKFLOW_READY_FOR_NEW_MESSAGE = "Ready For New Message";

/**
 * A persisted workflow: its identifier, its current position and its data.
 */
export type WorkflowState = {
  id: string;
  value: WorkflowStateValue;
  context: WorkflowContext;
};

/**
 * Port for persisting and retrieving a workflow's state.
 *
 * Implemented by infrastructure adapters (e.g. Firestore in `@org/firebase`).
 */
export abstract class IWorkflowStateRepository {
  abstract save(state: WorkflowState): Promise<void>;
  abstract findById(id: string): Promise<WorkflowState | null>;
}

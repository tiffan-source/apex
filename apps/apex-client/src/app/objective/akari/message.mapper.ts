import { AI_SENDER, type ConversationResponse, type ToolCall } from "../../../chore/api/api.models";
import { MessageViewModel, PermissionRequestViewModel } from "./chat.models";

/** Les outils d'écriture du workflow : ceux qui ajoutent une étape ou un pas. */
export const CREATE_STAGE_TOOL = "createSubObjective";
export const CREATE_TASK_TOOL = "createTask";

export class MessageMapper {
  /** L'auteur d'un message de l'API : Akari (« AI »), sinon la personne (son id). */
  static senderOf(sender: string): MessageViewModel["sender"] {
    return sender === AI_SENDER ? "assistant" : "user";
  }

  /** La conversation rendue par l'API (GET /v1/objectives/{id}/conversation), prête pour l'écran. */
  static fromConversationToMessages(conversation: ConversationResponse): MessageViewModel[] {
    return conversation.messages.map<MessageViewModel>(message => ({
      id: message.id,
      sender: MessageMapper.senderOf(message.sender),
      content: message.content,
      timestamp: new Date(message.createdAt)
    }));
  }

  /**
   * Ce qu'Akari demande la permission de faire, d'après l'outil en attente : l'écran en tire sa phrase
   * (« Je te propose d'ajouter l'étape « X ». On l'ajoute ? ») sans connaître les outils du workflow.
   */
  static toPermissionRequest(call: ToolCall | null): PermissionRequestViewModel | null {
    if (!call) {
      return null;
    }

    const args = (call.arguments ?? {}) as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

    switch (call.name) {
      case CREATE_STAGE_TOOL:
        return { kind: "stage", title: text(args["title"]), parentId: text(args["parentObjectiveId"]) || null };
      case CREATE_TASK_TOOL:
        return { kind: "task", title: text(args["title"]), objectiveId: text(args["objectiveId"]) || null };
      default:
        return { kind: "other" };
    }
  }
}

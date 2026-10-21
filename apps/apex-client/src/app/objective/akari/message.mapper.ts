import { GetConversationsQueryOutput } from "@org/chat"
import { MessageViewModel, PermissionRequestViewModel } from "./chat.models";
import { MessageOutput, ToolCall } from "@org/ai-assistant";

/** Les outils d'écriture du workflow : ceux qui ajoutent une étape ou un pas. */
export const CREATE_STAGE_TOOL = "createSubObjective";
export const CREATE_TASK_TOOL = "createTask";

export class MessageMapper {
  static fromConversationQueryToMessages(conversation: GetConversationsQueryOutput, owner: string): MessageViewModel[] {
    return conversation.messages.map<MessageViewModel>(message => ({
      id: message.id,
      sender: message.sender === owner ? "user" : "assistant",
      content: message.content,
      timestamp: new Date(message.createdAt)
    }));
  }

  static fromMessageOutputToViewModel(message: MessageOutput): MessageViewModel {
    return {
      content: message.response,
      id: message.id,
      sender: "assistant",
      timestamp: new Date(message.createdAt)
    }
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

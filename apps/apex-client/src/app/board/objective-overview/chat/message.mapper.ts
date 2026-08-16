import { GetAllMessagesQueryOutput} from "@org/chat"
import { MessageViewModel } from "./chat.models";
import { MessageOutput } from "@org/ai-assistant";

export class MessageMapper {
  static fromConversationQueryToMessages(conversation: GetAllMessagesQueryOutput, owner: string): MessageViewModel[] {
    return conversation.conversation.messages.map<MessageViewModel>(message => ({
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
}

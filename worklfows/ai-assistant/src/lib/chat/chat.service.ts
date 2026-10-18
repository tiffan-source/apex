import { IdGenerator } from "@org/chore";
import { IChatActor, RegisterMessageResult } from "../workflow/actors.protocols";
import { AddMessageCommand, GetConversationsQuery } from "@org/chat";

export class ChatService implements IChatActor {
  constructor(
    private readonly conversationQuery: GetConversationsQuery,
    private readonly messageGateway: AddMessageCommand,
    private readonly idGenerator: IdGenerator
  ) {}

  async registerMessage(conversationExternalRef: string, message: string, actorId: string): Promise<RegisterMessageResult> {
    let conversation = await this.conversationQuery.execute(conversationExternalRef);

    let result = await this.messageGateway.execute({
      conversationId: conversation.id,
      userId: actorId,
      message,
      id: this.idGenerator.generateId()
    });

    if (!result) {
      return { success: false, message: null };
    }

    return {
      success: true,
      message: {
        id: result.id,
        content: result.message,
        sender: actorId,
        createdAt: result.createdAt
      }
    };

  }
}

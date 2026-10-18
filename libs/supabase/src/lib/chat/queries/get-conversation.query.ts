import { Conversation, GetConversationsQuery, GetConversationsQueryOutput, Message } from "@org/chat"
import { SupabaseClientDataAccess } from "../../supabase-client";

export class SupabaseGetAllMessagesQuery implements GetConversationsQuery {
  constructor(
    private readonly supabaseClient: SupabaseClientDataAccess,
  ) {}

  public async execute(externalReferenceId: string): Promise<GetConversationsQueryOutput> {
    const {data, error} = await this.supabaseClient.clientInstance
    .from("conversations")
    .select("*, messages(*)")
    .eq("objective_id", externalReferenceId)

    if (error) {
      throw new Error(`Failed to fetch messages for conversation ${externalReferenceId}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`No conversation found with ID ${externalReferenceId}`);
    }


    let conversation = new Conversation(data[0].id);

    for (const messageData of data[0].messages) {
      const message = new Message(
        messageData.id,
        messageData.sender,
        messageData.content,
        new Date(messageData.created_at)
      );
      conversation.addMessage(message);
    }

    return conversation ;
  }
}

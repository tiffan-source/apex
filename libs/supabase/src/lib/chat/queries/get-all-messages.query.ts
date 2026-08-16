import { Conversation, GetAllMessagesQuery, GetAllMessagesQueryInput, GetAllMessagesQueryOutput, Message } from "@org/chat"
import { SupabaseClientDataAccess } from "../../supabase-client";

export class SupabaseGetAllMessagesQuery implements GetAllMessagesQuery {
  constructor(
    private readonly supabaseClient: SupabaseClientDataAccess,
  ) {}

  public async execute(input: GetAllMessagesQueryInput): Promise<GetAllMessagesQueryOutput> {
    const {data, error} = await this.supabaseClient.clientInstance
    .from("conversations")
    .select("*, messages(*)")
    .eq("objective_id", input.externalReferenceId)

    if (error) {
      throw new Error(`Failed to fetch messages for conversation ${input.externalReferenceId}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`No conversation found with ID ${input.externalReferenceId}`);
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

    return { conversation };
  }
}

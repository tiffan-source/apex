import { AddMessageCommand, AddMessageCommandInput, AddMessageCommandOutput } from "@org/chat";
import { SupabaseClientDataAccess } from "../../supabase-client";

export class SupabaseAddMessageCommand implements AddMessageCommand {
  constructor(
    private readonly supabaseClient: SupabaseClientDataAccess,
  ) {}

  public async execute(input: AddMessageCommandInput): Promise<AddMessageCommandOutput> {
    const { id, conversationId, message, userId } = input;

    const { data, error } = await this.supabaseClient.clientInstance
      .from("messages")
      .insert({
        id,
        conversation_id: conversationId,
        content: message,
        sender: userId
      });

    if (error) {
      throw new Error(`Failed to add message to conversation ${conversationId}: ${error.message}`);
    }

    return {
      id,
      message,
      createdAt: new Date() // Assuming the current date as the creation date since Supabase doesn't return it directly
    };
  }
}

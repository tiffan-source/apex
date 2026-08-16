import { Conversation } from "../models/conversation";

/**
 * @param externalReferenceId The ID of the element associated with the conversation (e.g., objective ID).
 * @returns The conversation associated with the given external reference ID, including all messages.
 */

export type GetAllMessagesQueryInput = {
  externalReferenceId: string;
}

export type GetAllMessagesQueryOutput = {
  conversation: Conversation;
}

export abstract class GetAllMessagesQuery {
  abstract execute(input: GetAllMessagesQueryInput): Promise<GetAllMessagesQueryOutput>;
}

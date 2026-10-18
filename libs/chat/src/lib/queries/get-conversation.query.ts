import { Conversation } from "../models/conversation";

export type GetConversationsQueryOutput = {
  id: string;
  messages: {
    id: string;
    sender: string;
    content: string;
    createdAt: Date;
  }[];
}

export abstract class GetConversationsQuery {
  abstract execute(externalReferenceId: string): Promise<GetConversationsQueryOutput>;
}

export type AddMessageCommandInput = {
  id: string;
  message: string;
  userId: string;
  conversationId: string;
}

export type AddMessageCommandOutput = {
  id: string;
  message: string;
  createdAt: Date;
};

export abstract class AddMessageCommand {
  abstract execute(input: AddMessageCommandInput): Promise<AddMessageCommandOutput>;
}

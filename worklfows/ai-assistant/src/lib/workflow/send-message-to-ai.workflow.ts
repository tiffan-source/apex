import { ObjectiveRepository } from "@org/objective"
import { GetAllMessagesQuery, AddMessageCommand } from "@org/chat"
import { AIProvider } from "@org/ai"
import { IdGenerator } from "@org/chore";

export type MessageInput = {
  message: string;
  objectiveId: string;
  ownerId: string;
}

export type MessageOutput = {
  id: string;
  response: string;
  createdAt: Date;
}

export class SendMessageToAIWorkflow {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly objectiveRepository: ObjectiveRepository,
    private readonly messageQuery: GetAllMessagesQuery,
    private readonly messageGateway: AddMessageCommand,
    private readonly aiProvider: AIProvider
  ) {}

  public async execute(input: MessageInput): Promise<MessageOutput> {
    const { message, objectiveId, ownerId } = input;

    try {
      const { conversation } = await this.messageQuery.execute({ externalReferenceId: objectiveId });

      await this.messageGateway.execute({
        id: this.idGenerator.generateId(),
        conversationId: conversation.id,
        message,
        userId: ownerId
      });

      const objective = await this.objectiveRepository.findById(objectiveId);

      let context = JSON.stringify({
        objective,
        conversation
      });

      let response = await this.aiProvider.generateMessage(` Le contexte de la conversation est: ${context}. Le message de l'utilisateur est: ${message}. Veuillez fournir une réponse utile et pertinente.`)

      let resultAi = await this.messageGateway.execute({
        id: this.idGenerator.generateId(),
        conversationId: conversation.id,
        message: response,
        userId: "ai-assistant"
      });

      return {
        id: resultAi.id,
        response: resultAi.message,
        createdAt: resultAi.createdAt
      };
    } catch (error) {
      console.error("Error occurred while sending message to AI:", error);
      throw new Error("Failed to send message to AI. Please try again later.");
    }
  }

}

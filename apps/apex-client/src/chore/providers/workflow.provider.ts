import { Provider } from "@angular/core";
import { AIProvider } from "@org/ai";
import { SendMessageToAIWorkflow } from "@org/ai-assistant"
import { AddMessageCommand, GetAllMessagesQuery } from "@org/chat";
import { IdGenerator } from "@org/chore";
import { ObjectiveRepository } from "@org/objective";

export const WorkflowProvider: Provider[] = [
  {provide: SendMessageToAIWorkflow, useFactory: (idGenerator: IdGenerator, objectiveRepository: ObjectiveRepository, messageQuery: GetAllMessagesQuery, messageGateway: AddMessageCommand, aiProvider: AIProvider) => new SendMessageToAIWorkflow(idGenerator, objectiveRepository, messageQuery, messageGateway, aiProvider), deps: [IdGenerator, ObjectiveRepository, GetAllMessagesQuery, AddMessageCommand, AIProvider]}
]

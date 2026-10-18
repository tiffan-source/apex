import { setup, assign, fromPromise } from "xstate";
import { IAIActor, AIResponse, CallResult, IChatActor, ToolCall, IToolExecutor, IToolExecutionPolicy, TextResponse, ToolCallResponse, ToolExecutionDecision, IToolRegistry, RegisterMessageResult } from "./actors.protocols";
import { WorkflowContext, WORKFLOW_READY_FOR_NEW_MESSAGE } from "../model/workflow.model";

export const getMachine = (
  chatService: IChatActor,
  aiService: IAIActor,
  toolExecutor: IToolExecutor,
  toolPolicy: IToolExecutionPolicy,
  toolRegistry: IToolRegistry
) => {

  return setup({
    types: {
      context: {} as WorkflowContext,
      events: {} as
        | { type: "message.send"; prompt: string; objectiveId: string; userId: string }
        | { type: "user.response"; permission: boolean },
    },
    actors: {
      registerMessage: fromPromise<RegisterMessageResult, { message: string; ownerId: string; conversationExternalReference: string }>(async({input})=>{
        const { conversationExternalReference, message, ownerId } = input
        return chatService.registerMessage(conversationExternalReference, message, ownerId)
      }),
      generateResponse: fromPromise<AIResponse, {prompt: string; objectiveId: string; previousInteractionId?: string; } >(async({input})=>{
        let { prompt, previousInteractionId } = input
        prompt += "\nObjective ID: " + input.objectiveId // is there the right way to pass the objectiveId to the AI provider?

        console.log(prompt)
        return aiService.getAIMessage(prompt, previousInteractionId || undefined, toolRegistry.getAll())
      }),
      executeTool: fromPromise<CallResult, {toolId: string; toolName: string; toolArguments: Record<string, unknown>; objectiveId: string; userId: string}>(async({input})=>{
        const { toolId, toolName, toolArguments, objectiveId, userId } = input
        let call: ToolCall = {
          arguments: toolArguments,
          id: toolId,
          name: toolName
        }
        return toolExecutor.execute(call, {
          objectiveId,
          userId
        })
      }),
      sendToolCallResult: fromPromise<AIResponse, {interactionId: string; toolCallResult: CallResult[]}>(async({input})=>{
        return aiService.sendToolCallResult(input.interactionId, input.toolCallResult)
      }),
      checkToolPolicy: fromPromise<ToolExecutionDecision, ToolCall & {objectiveId: string; userId: string}>(async({input})=>{
        return toolPolicy.decide(input, {
          objectiveId: input.objectiveId,
          userId: input.userId
        }, input.arguments)
      }),
    },
    guards: {
    }
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QGMD2A7AbmATrAhgC4CWGACjqsnLAHQBKYUxshux6UAqrLgLI18MAJLoAwhmx4ipdAGIIGMLQ6ZUAa2UBbQTADiRMAHd8ATwDaABgC6iUAAdUsYiQx2QAD0QBmAJwAOWgBWABZfADZvfwAmAEYgy19LAHYAGhBTRH9vWm8wy2ig6N9vaOiQy28AXyr0tCxcAld0CioaWgBlMHQIDihWrXtCABVUAEFhBSUVLA1lfGJWzGIIXCtbJBBHZ2b3LwQQ6OTacITfZMsgoOTfIPC0jMRYxNjacu9K5LzkkNOauskjRk5Eo1FgdC6PT6AyGowmU3QylUc1oCyWKzWsQ2DicLlke0Qh2Op0SFyuNzuD0yCH8-lelhJ4XC-hC3mSyWi4X+IHqUiaslaYLojGYrHYnAmjFgjnQvFEEga0maCKRs00tB04KEYAMbBMFhs7m2eLcm32MWOQTy5WKdNisUO6Wpvl8rwiEUsKR+z0i3N5QOagvaAFEPGBkABXEgSgA2MdGqBjKtorEMtH9SoFoJDYcj0agYzjCZj6yNuN2Zp8-kstEqUXZ0W+DtiVMQQX8vlo-nuTOi3cSZWqtR5gMzILa4NoofDUb6hfjqETtAoYHs+BwfQAcmAPCNF0nS5tjRXQPtopVAt4rkFnmyGSF-EEnW2CrQQj8CslwoUjo2ucOM35cchSnXNZ1jBclxXNcN04bdd2LORzCxMsdnxSsEHPKJcmvW8LnCB8n0eA5rloeJ6ytVlkgSdk-VHICWmzSdpzzOci33UCZ3zRDFERGY1HVQh93RVYcEPHE0NNU8nlOcI3l+OICKKIJfEbZ8Dn8Y5vGZC1XXPSx3zoxUGKDZiwPzedi041jOEQ3BKBwWh7BjIgADNUBwLRaCExMRLWQ0j3LdDpIQWJZPk78wpCZTVO8dS-CCMi4gfCJrjCD4QiMvlgUYic6BY8CC3YpcxAAC3DdQ+gKwNE2IZBTGTZFBOE2r6vErYgqkzxEHPC433ZbIKgMhkCnU05XmSWI-G8bwWxueJkiygMszy6zCssjiyoqqrzIFVqGt41UBOUHyYzIfbkOxDrJPQAlMIvHCrjw+9H3U88QhOJlkmrSaWWeGIlrHXKQOqtjIJjWgAHUFnzAAxDyeFwMhcC0FhnAwOQI14RycDgGVeHa49gu60KUkSyxNPbCJTk5U51JveluzyWISivMLfEBkymPy3aIKs6G8U4eGcERnBkc8tHZEx7HaFx6UMAJlDApuu7nmo2tKY7Jkim1+Lfi7WIjnS4pGySRaAPonLTJ5riwasjp8GWThRYAEW6YhIHF1HwSlwnOtujCwruCLFOiwpYr1y8g+U+4qKCTmre5zpul6TgxHwOMpQjGM93hQ7+JRNFKGWUS-ZVjCiROM4yWuW57nU84clm8pLkSGIWWiBPAyTyFU6gdPM7gbPc8mfOmvmRZi4xMSlYkk0A5CvwazrTSOSbEIWzG7STjXgi-GihJ-2HdBUFWeBNkAxO8tQ+e7oAWmyE5OVuCkojCOniLvxKXR-g+0u9K8XcVogRFCwNgsFuDYwEFqEQ4hLYnmurfCu0R1J0lyGUVShRJrRRmp3C2xkr4gV7tCSggwR43wQfsO+V4n7hBfrcN+qUQjqXtBvN8bIOQ-kqJcIBwF2igLFBAyUeMFZgHlPA4mRMur7BdDWAIhw6ThE9JpKILC4jHDpBUB0VxWS0l4cDHMts+b7gocTfY7JErRQCNaYoFMbwsJbLkXR7YHR0OuHcfR1s1oWWKhDaC64tw7j3ImUx0ingsk7KESoBEQgHzCMw4iClaBfmrC2dsG82SZXwdlbuq1QbGKXPkqAxZQkLxJlNdsbx2ThDCnSbIKl-DqQfBohRsSGSum+tFTxScikbRKuVZAlVOCg3IPtUpd1Gx5C7MpO4lQ4gRDGgZXIrpmT3HtNNPBAICG5JBrzIq4MoYwz6MLUWXtJZdSkWU80jY3wNJsUkR8sQ9YfXfIcZSG9ziJCyVsnJwDDE2X2fbR2fRXbu09ijc5ZTLmqzvMsq8toSgd1bAgUoOQ7iqTCJyPIUQPHZOWnwsyRjAUcVDILYp+4B4xj6OMjCkyPqPkKLM0oLNwhNKtF2QozJLhswwf+H5+KDGTmIWnDOMYs45zhMIGlIU75yT8CyCooRYkVHZAk6kXwazfk0g+MohQppDhqEAA */
    context: {
      userId: "",
      prompt: "",
      aiResponse: {} as AIResponse,
      objectiveId: "",
      aiProviderInteractionId: "",
      currentToolCall: undefined,
      toolCallResults: [],
      lastRegisteredMessage: undefined
    },
    id: "conversationProcess",
    initial: WORKFLOW_READY_FOR_NEW_MESSAGE,
    states: {

      [WORKFLOW_READY_FOR_NEW_MESSAGE]: {
        on: {
          "message.send": {
            target: "RegisteringUserMessageInConversation",
            description: `The user send a new message with an external reference to the conversation`,
            actions: assign({
              prompt: ({event}) => event.prompt,
              objectiveId: ({event}) => event.objectiveId,
              userId: ({event}) => event.userId
            })
          },
        },
      },

      "RegisteringUserMessageInConversation": {
        invoke: {
          src: "registerMessage",
          id: "messageGateway",
          onDone: {
            target: "SendingPromptToAI",
            actions: assign({
              lastRegisteredMessage: ({event}) => event.output.message ?? undefined
            })
          },
          input: ({context}) => ({
            message: context.prompt,
            ownerId: context.userId,
            conversationExternalReference: context.objectiveId
          })
        }
      },

      "SendingPromptToAI": {
        description: `We are getting the prompt we send to the AI provider`,
        invoke: {
          src: "generateResponse",
          id: "aiProvider",
          input: ({context}) => ({
            prompt: context.prompt,
            objectiveId: context.objectiveId,
            previousInteractionId: context.aiProviderInteractionId || undefined
          }),
          onDone: [
            {
              target: "RegisteringAIResponseInConversation",
              guard: ({event}) => event.output.response.responseType === "text",
              actions: assign({
                aiResponse: ({event}) => event.output,
                aiProviderInteractionId: ({event}) => event.output.id
              })
            },
            {
              target: "ExecutingAllTool",
              guard: ({event}) => event.output.response.responseType === "toolCall",
              actions: assign({
                aiResponse: ({event}) => event.output,
                aiProviderInteractionId: ({event}) => event.output.id
              })
            }
          ]
        }
      },

      "RegisteringAIResponseInConversation": {
        invoke: {
          src: "registerMessage",
          id: "messageGateway",

          input: ({context}) => ({
            message: (context.aiResponse.response as TextResponse).response,
            ownerId: "AI", // This is a placeholder, you might want to replace it with the actual AI actor ID if available
            conversationExternalReference: context.objectiveId
          }),

          onDone: {
            target: WORKFLOW_READY_FOR_NEW_MESSAGE,
            actions: assign({
              aiResponse: ({}) => ({} as AIResponse),
              toolCallResults: ({}) => [],
              lastRegisteredMessage: ({event}) => event.output.message ?? undefined
            })
          },
        }
      },

      "ExecutingAllTool": {
        states: {
          "PreparingNextTool": {
            entry: assign({
              currentToolCall: ({context}) => (context.aiResponse.response as ToolCallResponse).toolCalls.filter(toolCall => context.toolCallResults.every(result => result.id !== toolCall.id))[0]
            }),

            always: [
              {
                target: "CheckingExecutionPolicy",
                guard: ({ context }) =>
                  context.currentToolCall !== undefined,
              },
              {
                target: "ExitingToolCalling",
              }
            ]
          },

          "ExecutingTool": {
            invoke: {
              src: "executeTool",
              id: "toolProvider",
              input: ({context}) => {
                const toolCall = context.currentToolCall as ToolCall; // We are sure that the toolCall exists because we are in the ExecutingTool state, which is only entered if there is a tool to execute

                return {
                  toolId: toolCall.id,
                  toolName: toolCall.name,
                  toolArguments: toolCall.arguments as Record<string, unknown>,
                  objectiveId: context.objectiveId,
                  userId: context.userId
                };
              },
              onDone: {
                target: "PreparingNextTool",
                actions: assign({
                  toolCallResults: ({context, event}) => [
                    ...context.toolCallResults,
                    event.output
                  ]
                })
              },

              onError: {
                target: "PreparingNextTool",
                actions: assign({
                  toolCallResults: ({context, event}) => {
                    let currentToolCall = context.currentToolCall as ToolCall
                    return [
                    ...context.toolCallResults,
                    {
                      id: currentToolCall.id,
                      functionName: currentToolCall.name,
                      result: `Error executing tool: We did not get a valid response from the tool`
                    }
                  ]}
                })
              }
            }
          },

          "CheckingExecutionPolicy": {
            invoke: {
              src: "checkToolPolicy",
              id: "toolPolicy",
              input: ({context}) => ({
                ...(context.currentToolCall as ToolCall),
                ...context
              }),
              onDone: [{
                target: "ExecutingTool",
                guard: ({event}) => event.output.type === "execute"
              }, {
                target: "WaitingForUserPermission",
                guard: ({event}) => event.output.type === "ask-user",
                reenter: true
              }, {
                // La policy refuse l'outil (ex. outil non enregistré, appel halluciné par l'IA).
                // On enregistre un résultat explicite pour ce toolCall afin de ne pas re-sélectionner
                // le même outil en boucle (cf. filtre dans PreparingNextTool), puis on passe au suivant.
                target: "SavingDeniedToolExecution",
                guard: ({event}) => event.output.type === "deny",
                actions: assign({
                  toolCallResults: ({context, event}) => {
                    const currentToolCall = context.currentToolCall as ToolCall;
                    const reason = "reason" in event.output ? event.output.reason : "Tool execution denied";
                    return [
                      ...context.toolCallResults,
                      {
                        id: currentToolCall.id,
                        functionName: currentToolCall.name,
                        result: `Tool execution denied: ${reason}`
                      }
                    ];
                  }
                })
              }],
              // Échec inattendu de la vérification de policy : on trace l'erreur comme résultat
              // d'outil au lieu de laisser l'exception remonter et planter la machine.
              onError: {
                target: "SavingDeniedToolExecution",
                actions: assign({
                  toolCallResults: ({context, event}) => {
                    const currentToolCall = context.currentToolCall as ToolCall;
                    return [
                      ...context.toolCallResults,
                      {
                        id: currentToolCall.id,
                        functionName: currentToolCall.name,
                        result: `Error checking tool policy: ${String(event.error ?? "unknown error")}`
                      }
                    ];
                  }
                })
              }
            }
          },

          "SavingDeniedToolExecution": {
            always: "PreparingNextTool"
          },

          "WaitingForUserPermission": {
            on: {
              "user.response": [{
                target: "ExecutingTool",
                guard: ({event}) => event.permission
              }, {
                target: "SavingUserDeniedPermission",
                reenter: true,
                guard: ({event}) => !event.permission
              }]
            }
          },

          "SavingUserDeniedPermission": {
            entry: assign({
              toolCallResults: ({context, event}) => {
                let currentToolCall = context.currentToolCall as ToolCall
                return [
                ...context.toolCallResults,
                {
                  id: currentToolCall.id,
                  functionName: currentToolCall.name,
                  result: "User denied permission to execute the tool"
                }
              ]}
            }),
            always: "PreparingNextTool"
          },

          "ExitingToolCalling": {
            type: "final"
          }
        },

        initial: "PreparingNextTool",

        onDone: "SendingCallResultToAI"
      },

      "SendingCallResultToAI": {
        invoke: {
          src: "sendToolCallResult",
          id: "aiProvider",
          input: ({context}) => ({
            interactionId: context.aiProviderInteractionId,
            toolCallResult: context.toolCallResults
          }),
          onDone: [{
            target: "RegisteringAIResponseInConversation",
            guard: ({event}) => event.output.response.responseType === "text",
            actions: assign({
              aiResponse: ({event}) => event.output,
              aiProviderInteractionId: ({event}) => event.output.id
            })
          }, {
            target: "ExecutingAllTool",
            guard: ({event}) => event.output.response.responseType === "toolCall",
            actions: assign({
              aiResponse: ({event}) => event.output,
              aiProviderInteractionId: ({event}) => event.output.id
            })
          }],
          exit: assign({
            toolCallResults: ({}) => [],
            currentToolCall: ({}) => undefined
          })
        }
      }
    },
  });
};

import { Provider } from "@angular/core"
import { InteractiveAIProvider } from "@org/ai"
import { GeminiInteractiveAIProvider } from "@org/gemini"

export const AIProvider: Provider[]= [
  {provide: InteractiveAIProvider, useExisting: GeminiInteractiveAIProvider}
]

import { Provider } from "@angular/core"
import { AIProvider as DomainAIProvider } from "@org/ai"
import { GeminiRepository } from "@org/gemini"

export const AIProvider: Provider[]= [
  {provide: DomainAIProvider, useExisting: GeminiRepository},
]

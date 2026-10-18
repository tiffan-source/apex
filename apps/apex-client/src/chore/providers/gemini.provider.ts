import { Provider } from "@angular/core";
import { AIInteractionResponse } from "@org/ai";
import { AIProxyTransport, GeminiInteractiveAIProvider } from "@org/gemini";
import { SupabaseClientDataAccess } from "@org/supabase";

export function provideGemini(): Provider[] {
  return [
    {
      provide: GeminiInteractiveAIProvider,
      useFactory: (supabase: SupabaseClientDataAccess) => {
        const transport: AIProxyTransport = async (body) => {
          const { data, error } = await supabase.clientInstance.functions
            .invoke<AIInteractionResponse>("httpGeminiInteractiveAiProvider", { body });
          if (error) throw error;
          return data!;
        };
        return new GeminiInteractiveAIProvider(transport);
      },
      deps: [SupabaseClientDataAccess],
    },
  ]
}

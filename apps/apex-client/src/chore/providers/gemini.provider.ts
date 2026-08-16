import { InjectionToken, Provider } from "@angular/core";
import { GeminiRepository } from "@org/gemini";

export const GEMINI_APP_CONFIG = new InjectionToken<string>('GEMINI_APP_CONFIG');

export function provideGemini(apiKey: string): Provider[] {
  return [
    { provide: GEMINI_APP_CONFIG, useValue: apiKey },
    {
      provide: GeminiRepository,
      useFactory: (apiKey: string) => new GeminiRepository(apiKey),
      deps: [GEMINI_APP_CONFIG],
    },
  ]
}

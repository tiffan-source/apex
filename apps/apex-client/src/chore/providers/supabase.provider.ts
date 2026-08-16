import { InjectionToken, Provider } from "@angular/core";
import { AppSupabaseConfig, SupabaseClientDataAccess } from "@org/supabase";

export const SUPABASE_APP_CONFIG = new InjectionToken<AppSupabaseConfig>('SUPABASE_APP_CONFIG');

export function provideSupabase(config: AppSupabaseConfig): Provider[] {
  return [
    { provide: SUPABASE_APP_CONFIG, useValue: config },
    {
      provide: SupabaseClientDataAccess,
      useFactory: (supabaseConfig: AppSupabaseConfig) => new SupabaseClientDataAccess(supabaseConfig.url, supabaseConfig.key),
      deps: [SUPABASE_APP_CONFIG],
    },
  ];
}

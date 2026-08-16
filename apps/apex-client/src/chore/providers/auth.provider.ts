import { Provider } from "@angular/core";
import { CreateNewUserUseCase, GetCurrentUserUseCase, LogUserInUseCase, AuthProvider } from "@org/auth"
import { SupabaseAuthServices, SupabaseClientDataAccess } from "@org/supabase"

export const AuthProviders: Provider[] = [
  {provide: AuthProvider, useFactory: (supabaseDataAccess: SupabaseClientDataAccess) => new SupabaseAuthServices(supabaseDataAccess), deps: [SupabaseClientDataAccess]},
  {provide: CreateNewUserUseCase, useFactory: (authProvider: AuthProvider) => new CreateNewUserUseCase(authProvider), deps: [AuthProvider]},
  {provide: GetCurrentUserUseCase, useFactory: (authProvider: AuthProvider) => new GetCurrentUserUseCase(authProvider), deps: [AuthProvider]},
  {provide: LogUserInUseCase, useFactory: (authProvider: AuthProvider) => new LogUserInUseCase(authProvider), deps: [AuthProvider]}
]

import { AuthProvider, User } from "@org/auth"
import { SupabaseClientDataAccess } from "../supabase-client";

export class SupabaseAuthServices implements AuthProvider {
  constructor(
    private readonly supabaseClient: SupabaseClientDataAccess,
  ) {}

  async register(email: string, password: string) {
    const { data, error } = await this.supabaseClient.clientInstance.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(`Erreur lors de l'inscription: ${error.message}`);
    }

    let user = new User(data.user?.id || "", data.user?.email || "");

    return user;
  }

  async login(email: string, password: string) {
    const { data, error } = await this.supabaseClient.clientInstance.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(`Erreur lors de la connexion: ${error.message}`);
    }

    let user = new User(data.user?.id || "", data.user?.email || "");

    return user;
  }

  async logout() {
    const { error } = await this.supabaseClient.clientInstance.auth.signOut();

    if (error) {
      throw new Error(`Erreur lors de la déconnexion: ${error.message}`);
    }
  }

  async whoAmI() {
    const { data, error } = await this.supabaseClient.clientInstance.auth.getUser();

    if (error) {
      throw new Error(`Erreur lors de la récupération de l'utilisateur: ${error.message}`);
    }

    if (!data.user) {
      return null;
    }

    let user = new User(data.user.id, data.user.email || "");

    return user;
  }

}

import { User } from "../models/user";

export abstract class AuthProvider {
  abstract register(email: string, password: string): Promise<User>;
  abstract login(email: string, password: string): Promise<User>;
  abstract logout(): Promise<void>;
  abstract whoAmI(): Promise<User | null>;
}

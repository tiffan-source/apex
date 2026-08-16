import { Result, runWithResult } from "@org/chore";
import { AuthProvider } from "../protocols/auth.provider";
import { User } from "../models/user";
import { UnknownUserError } from "../errors/unknown-user.error";

type LogUserInInput = {
  email: string;
  password: string;
};

export class LogUserInUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  execute(input: LogUserInInput): Promise<Result<User>> {
    return runWithResult<User>(
      async () => {
        // on essaie de connecter l'utilisateur
        let user = await this.authProvider.login(input.email, input.password);

        if (!user) {
          throw new UnknownUserError(input.email);
        }

        return user;
      },
      [UnknownUserError],
      "An unknown error occurred while logging in the user."
    )

  }
}

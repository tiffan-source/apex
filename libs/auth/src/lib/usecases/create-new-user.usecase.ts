import { User } from "../models/user";
import { Result, runWithResult, IdGenerator } from "@org/chore"
import { AuthProvider } from "../protocols/auth.provider";
import { UserAlreadyExistError } from "../errors/user-already-exist.error";
import { UnknownUserError } from "../errors/unknown-user.error";

type CreateNewUserInput = {
  email: string;
  password: string;
};

export class CreateNewUserUseCase {
  constructor(
    private readonly authProvider: AuthProvider
  ) {}

  execute(input: CreateNewUserInput): Promise<Result<User>> {
    return runWithResult<User>(
      async () => {
        // create the new user
        await this.authProvider.register(input.email, input.password);

        // retrieve the newly created user
        const newUser = await this.authProvider.whoAmI();
        if (!newUser) {
          throw new UnknownUserError(input.email);
        }

        return newUser;
      },
      [UserAlreadyExistError, UnknownUserError],
      "An unknown error occurred while creating a new user."
    );
  }
}

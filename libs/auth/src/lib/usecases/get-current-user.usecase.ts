import { Result, runWithResult } from "@org/chore";
import { AuthProvider } from "../protocols/auth.provider";
import { User } from "../models/user";

export type GetCurrentOutput = {
  id: string;
  name: string;
  email: string;
}

export class GetCurrentUserUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  async execute(): Promise<Result<GetCurrentOutput | null>> {
    return runWithResult<GetCurrentOutput | null>(
      async () => {
        let result = await this.authProvider.whoAmI();
        if (result) {
          return {
            id: result.uid,
            name: result.displayName ?? result.email,
            email: result.email
          };
        }
        return null;
      },
      [],
      "An unknown error occurred while fetching the current user."
    );
  }
}

// Ce n'est pas un usecase au sens strict du terme
// Il faut donc le relocaliser
// C'est peut etre une query

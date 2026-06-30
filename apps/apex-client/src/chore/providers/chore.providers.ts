import { Provider } from "@angular/core";
import { IdGenerator, SimpleIdGenerator } from "@org/chore";

export const ChoreProviders: Provider[] = [
  {provide: IdGenerator, useClass: SimpleIdGenerator}
]

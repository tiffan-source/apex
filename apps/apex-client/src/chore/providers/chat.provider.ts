import { Provider } from "@angular/core";
import { GetAllMessagesQuery, AddMessageCommand } from "@org/chat";
import { SupabaseGetAllMessagesQuery, SupabaseClientDataAccess, SupabaseAddMessageCommand } from "@org/supabase";

export const ChatProvider: Provider[] = [
  {provide: GetAllMessagesQuery, useFactory: (dataAccess: SupabaseClientDataAccess) => new SupabaseGetAllMessagesQuery(dataAccess), deps: [SupabaseClientDataAccess]},
  {provide: AddMessageCommand, useFactory: (dataAccess: SupabaseClientDataAccess) => new SupabaseAddMessageCommand(dataAccess), deps: [SupabaseClientDataAccess]}
]

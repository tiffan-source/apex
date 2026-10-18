import { Provider } from "@angular/core";
import { GetConversationsQuery, AddMessageCommand } from "@org/chat";
import { SupabaseGetAllMessagesQuery, SupabaseClientDataAccess, SupabaseAddMessageCommand } from "@org/supabase";

export const ChatProvider: Provider[] = [
  {provide: GetConversationsQuery, useFactory: (dataAccess: SupabaseClientDataAccess) => new SupabaseGetAllMessagesQuery(dataAccess), deps: [SupabaseClientDataAccess]},
  {provide: AddMessageCommand, useFactory: (dataAccess: SupabaseClientDataAccess) => new SupabaseAddMessageCommand(dataAccess), deps: [SupabaseClientDataAccess]}
]

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from './database.types';

export type AppSupabaseConfig = {
  url: string;
  key: string;
};

export class SupabaseClientDataAccess {
  private client: SupabaseClient<Database>;

  constructor(
    private readonly supabaseUrl: string,
    private readonly supabaseKey: string,
  ) {
    this.client = createClient<Database>(this.supabaseUrl, this.supabaseKey);
  }

  get clientInstance(): SupabaseClient<Database> {
    return this.client;
  }
}

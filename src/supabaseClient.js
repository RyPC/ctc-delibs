import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Create the client only when configured. This keeps tests/dev builds from
// crashing when env vars are missing.
export const supabase =
    supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey, {
              auth: {
                  persistSession: false,
              },
          })
        : null;

export function isSupabaseConfigured() {
    return Boolean(supabase);
}


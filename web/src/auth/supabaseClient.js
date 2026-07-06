import { createClient } from '@supabase/supabase-js';

const KEEP_SIGNED_IN_KEY = 'ezyfriday_keep_signed_in';

export const getKeepSignedIn = () => localStorage.getItem(KEEP_SIGNED_IN_KEY) !== 'false';
export const setKeepSignedIn = (v) => localStorage.setItem(KEEP_SIGNED_IN_KEY, v ? 'true' : 'false');

let client = null;
let clientBuiltFor = null;

// Lazily builds a singleton Supabase client, rebuilding it if the "keep me signed
// in" preference has changed since the last build. A Supabase client's storage
// medium (localStorage vs sessionStorage) is fixed at construction time, so the
// preference MUST be written and this rebuilt BEFORE calling signInWithPassword —
// rebuilding afterwards would leave the just-created session sitting in whichever
// storage the previous client instance was already using.
export function getSupabaseClient() {
  const keepSignedIn = getKeepSignedIn();
  if (client && clientBuiltFor === keepSignedIn) return client;

  clientBuiltFor = keepSignedIn;
  client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: keepSignedIn ? window.localStorage : window.sessionStorage,
    },
  });
  return client;
}

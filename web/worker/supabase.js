import { createClient } from '@supabase/supabase-js';

// One client per request (Workers are stateless isolates). The Supabase *secret*
// API key (sb_secret_...) has full access and bypasses RLS, so this must only ever
// run server-side in the Worker. (Replaces the legacy service_role key.)
export function getDb(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error(
      'Missing SUPABASE_URL / SUPABASE_SECRET_KEY — set them in web/.dev.vars (local) ' +
        'or via `wrangler secret put` (production).'
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import { createClient } from '@supabase/supabase-js';

// One client per request (Workers are stateless isolates). The service_role key
// bypasses RLS, so this must only ever run server-side in the Worker.
export function getDb(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — set them in worker/.dev.vars (local) ' +
        'or via `wrangler secret put` (production).'
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

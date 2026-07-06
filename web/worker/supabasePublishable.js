import { createClient } from '@supabase/supabase-js';

// A second, least-privilege client used ONLY to verify a caller's Supabase Auth
// access token (auth.getUser). Never use this for data access — that's getDb()
// in supabase.js, which holds the secret key.
export function getPublishableDb(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      'Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY — set them in web/.dev.vars (local) ' +
        'or via `wrangler secret put` (production).'
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

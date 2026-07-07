import { getPublishableDb } from './supabasePublishable.js';
import { getDb } from './supabase.js';
import * as repo from './repo.js';

// Three tiers of /api/* route, checked in order:
//   1. PUBLIC     — no token required at all.
//   2. BOOTSTRAP  — a verified Supabase user is required, but NOT an existing
//                   membership — this is the ONLY way a membership first gets
//                   made, i.e. signups are invite-only by construction.
//   3. (default)  — a verified user AND an existing membership are required.
const PUBLIC_ROUTES = [
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: /^\/api\/invites\/[^/]+$/ },
  // Public request-intake form — the URL token is the credential.
  { method: 'GET', path: /^\/api\/intake\/[^/]+$/ },
  { method: 'POST', path: /^\/api\/intake\/[^/]+$/ },
];

const BOOTSTRAP_ROUTES = [{ method: 'POST', path: /^\/api\/invites\/[^/]+\/accept$/ }];

function matches(routes, method, path) {
  return routes.some((r) => {
    if (r.method !== method) return false;
    return typeof r.path === 'string' ? r.path === path : r.path.test(path);
  });
}

export async function authMiddleware(c, next) {
  const method = c.req.method;
  const path = c.req.path;

  if (matches(PUBLIC_ROUTES, method, path)) return next();

  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const { data, error } = await getPublishableDb(c.env).auth.getUser(token);
  if (error || !data?.user) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', data.user);

  if (matches(BOOTSTRAP_ROUTES, method, path)) return next();

  const membership = await repo.findMembership(getDb(c.env), data.user.id);
  if (!membership) return c.json({ error: 'no_membership' }, 403);

  c.set('companyId', membership.company_id);
  c.set('role', membership.role);
  return next();
}

-- Migration 1/3: multi-tenant schema, additive only.
-- Safe to run against the LIVE project at any time — adds new tables and one
-- nullable column, doesn't touch existing rows, and the old (pre-auth-rewrite)
-- Worker code never references any of this, so nothing breaks until you deploy
-- the new code.
--
-- Run in the Supabase SQL editor: SQL Editor -> New query -> paste -> Run.

create table if not exists companies (
  id         bigint generated always as identity primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  company_id bigint not null references companies(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table if not exists invites (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references companies(id) on delete cascade,
  email       text not null,
  token       text not null unique,
  invited_by  uuid not null references auth.users(id),
  role        text not null default 'member' check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  accepted_at timestamptz
);

create unique index if not exists uniq_pending_invite
  on invites(company_id, email) where accepted_at is null;

-- Nullable for now — the live `tasks` table has existing rows with no company yet.
-- See 002_backfill_tasks_company.sql and 003_tighten_tasks_company_not_null.sql.
alter table tasks add column if not exists company_id bigint references companies(id);
create index if not exists idx_tasks_company on tasks(company_id);

alter table companies   enable row level security;
alter table memberships enable row level security;
alter table invites     enable row level security;

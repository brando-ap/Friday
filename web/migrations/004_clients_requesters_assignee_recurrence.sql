-- Migration 4: clients ("Companies" in the UI), requesters, task assignment,
-- recurrence, and typed activity-log entries. Additive only — safe to run
-- against the LIVE project at any time: new tables, new nullable columns, and
-- a defaulted column on activity_log. Nothing existing is touched, and the
-- current deployed Worker never references any of this, so nothing breaks
-- until you deploy the new code.
--
-- Run in the Supabase SQL editor: SQL Editor -> New query -> paste -> Run.

-- NOTE on naming: "companies" (existing table) is the tenant workspace.
-- "clients" below is the customer-company layer shown as "Companies" in the
-- UI. Do not confuse the two — every table here is scoped to the tenant via
-- company_id, exactly like tasks.

create table if not exists clients (
  id         bigint generated always as identity primary key,
  company_id bigint not null references companies(id) on delete cascade,
  name       text not null,
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists requesters (
  id         bigint generated always as identity primary key,
  company_id bigint not null references companies(id) on delete cascade,
  name       text not null,
  email      text,
  phone      text,
  created_at timestamptz not null default now()
);

-- A requester can belong to (request work on behalf of) multiple clients.
create table if not exists requester_clients (
  requester_id bigint not null references requesters(id) on delete cascade,
  client_id    bigint not null references clients(id) on delete cascade,
  primary key (requester_id, client_id)
);

-- Structured attribution on tasks. The old free-text `requester` column stays
-- as a fallback for quick unstructured entry. When requester_id is set, the
-- Worker validates client_id is one of that requester's clients.
alter table tasks add column if not exists requester_id bigint references requesters(id) on delete set null;
alter table tasks add column if not exists client_id    bigint references clients(id)    on delete set null;

-- Task assignment to a workspace member.
alter table tasks add column if not exists assignee_id uuid references auth.users(id) on delete set null;

-- Recurring tasks: when a recurring task is marked done, the Worker creates
-- the next occurrence with due_date rolled forward.
alter table tasks add column if not exists recurrence text
  check (recurrence in ('daily', 'weekly', 'monthly'));

-- Activity log grows automatic entries (status/assignee/requester changes,
-- subtask completion) alongside manual notes.
alter table activity_log add column if not exists kind text not null default 'note'
  check (kind in ('note', 'system'));

create index if not exists idx_clients_company           on clients(company_id);
create index if not exists idx_requesters_company        on requesters(company_id);
create index if not exists idx_requester_clients_client  on requester_clients(client_id);
create index if not exists idx_tasks_requester           on tasks(requester_id);
create index if not exists idx_tasks_client              on tasks(client_id);
create index if not exists idx_tasks_assignee            on tasks(assignee_id);

-- Same RLS posture as every other table: enabled with no policies, so only
-- the Worker's secret key can touch them (see schema.sql).
alter table clients           enable row level security;
alter table requesters        enable row level security;
alter table requester_clients enable row level security;

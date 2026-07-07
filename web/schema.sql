-- ezyFriday — Supabase schema.
-- Run this once in your Supabase project: SQL Editor -> New query -> paste -> Run.
-- (If you're migrating an existing live project instead of starting fresh, use the
-- staged files in web/migrations/ — this file is the fresh-install end state.)

create table if not exists companies (
  id             bigint generated always as identity primary key,
  name           text not null,
  -- Public request-intake form: the token in the shareable /request URL.
  -- Null until an owner first enables the form; rotatable.
  intake_token   text unique,
  intake_enabled boolean not null default false,
  created_at     timestamptz not null default now()
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

-- Only one *pending* invite per (company, email) at a time — re-inviting is handled
-- in code by deleting the old pending invite first, not by allowing duplicates here.
create unique index if not exists uniq_pending_invite
  on invites(company_id, email) where accepted_at is null;

-- NOTE on naming: "companies" above is the tenant workspace. "clients" below
-- is the customer-company layer (shown as "Companies" in the UI) — outside
-- companies that work comes in from. Requesters are the specific people at
-- those clients who ask for things; a requester can belong to several clients.
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

create table if not exists requester_clients (
  requester_id bigint not null references requesters(id) on delete cascade,
  client_id    bigint not null references clients(id) on delete cascade,
  primary key (requester_id, client_id)
);

create table if not exists tasks (
  id            bigint generated always as identity primary key,
  company_id    bigint not null references companies(id),
  title         text not null,
  description   text,
  requester     text,           -- free-text fallback; requester_id is the structured version
  requested_for text,
  location      text,
  due_date      date,
  status        text not null default 'not_started',
  waiting_on    text,
  waiting_since date,
  requester_id  bigint references requesters(id) on delete set null,
  client_id     bigint references clients(id) on delete set null,
  assignee_id   uuid references auth.users(id) on delete set null,
  recurrence    text check (recurrence in ('daily', 'weekly', 'monthly')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create table if not exists subtasks (
  id         bigint generated always as identity primary key,
  task_id    bigint not null references tasks(id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- kind: 'note' = manually typed by a user, 'system' = auto-logged event
-- (status/assignee/requester changes, subtask completion).
create table if not exists activity_log (
  id         bigint generated always as identity primary key,
  task_id    bigint not null references tasks(id) on delete cascade,
  note       text not null,
  kind       text not null default 'note' check (kind in ('note', 'system')),
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_company on tasks(company_id);
create index if not exists idx_subtasks_task on subtasks(task_id);
create index if not exists idx_activity_task on activity_log(task_id);
create index if not exists idx_clients_company on clients(company_id);
create index if not exists idx_requesters_company on requesters(company_id);
create index if not exists idx_requester_clients_client on requester_clients(client_id);
create index if not exists idx_tasks_requester on tasks(requester_id);
create index if not exists idx_tasks_client on tasks(client_id);
create index if not exists idx_tasks_assignee on tasks(assignee_id);

-- The Worker talks to these tables with a Supabase secret key (sb_secret_...),
-- which bypasses Row Level Security. We still enable RLS with no policies so the
-- publishable/anon key (the only key the browser ever holds, used solely for Auth)
-- cannot touch any table's data directly — only the server-side Worker can.
alter table companies         enable row level security;
alter table memberships       enable row level security;
alter table invites           enable row level security;
alter table tasks             enable row level security;
alter table subtasks          enable row level security;
alter table activity_log      enable row level security;
alter table clients           enable row level security;
alter table requesters        enable row level security;
alter table requester_clients enable row level security;

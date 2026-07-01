-- Friday — Supabase schema.
-- Run this once in your Supabase project: SQL Editor -> New query -> paste -> Run.

create table if not exists tasks (
  id            bigint generated always as identity primary key,
  title         text not null,
  description   text,
  requester     text,
  requested_for text,
  location      text,
  due_date      date,
  status        text not null default 'not_started',
  waiting_on    text,
  waiting_since date,
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

create table if not exists activity_log (
  id         bigint generated always as identity primary key,
  task_id    bigint not null references tasks(id) on delete cascade,
  note       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_subtasks_task on subtasks(task_id);
create index if not exists idx_activity_task on activity_log(task_id);

-- The Worker talks to these tables with a Supabase secret key (sb_secret_...),
-- which bypasses Row Level Security. We still enable RLS with no policies so the
-- publishable key cannot touch the data directly — only the server-side Worker can.
alter table tasks        enable row level security;
alter table subtasks     enable row level security;
alter table activity_log enable row level security;

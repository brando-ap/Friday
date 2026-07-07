-- Public request-intake form. Each workspace can turn on a shareable form URL
-- (/request?token=...) that lets outside requesters submit work without an
-- account. The token is the only credential in the URL, so it's rotatable.
alter table companies add column if not exists intake_token   text unique;
alter table companies add column if not exists intake_enabled boolean not null default false;

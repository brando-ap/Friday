-- Migration 3/3: tighten tasks.company_id to NOT NULL.
--
-- Run this only after:
--   - 002_backfill_tasks_company.sql's verify query returned 0, AND
--   - a day or two of normal use has passed with no issues.
-- Until this runs, company_id stays nullable, which means a rollback to the
-- pre-auth-rewrite Worker build (which never sets company_id on insert) would
-- still work safely against this database. Applying NOT NULL closes that door.

alter table tasks alter column company_id set not null;

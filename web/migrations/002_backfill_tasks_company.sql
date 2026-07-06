-- Migration 2/3: backfill existing tasks to the owner's new company.
--
-- Run this AFTER you (the owner) have signed up for real through the new /signup
-- flow (that creates your `companies` row automatically). Not before — there's no
-- company to backfill into yet.

-- 1. Find your company id (there should be exactly one row right after signup):
select id, name from companies;

-- 2. Backfill — replace <ID> with the id from step 1:
update tasks set company_id = <ID> where company_id is null;

-- 3. Verify — should return 0:
select count(*) from tasks where company_id is null;

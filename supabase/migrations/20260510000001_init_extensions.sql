-- 0001_init_extensions
-- Extensions and shared enums. Run before any domain table.

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

-- Domain enums
do $$ begin
  create type contact_type as enum ('twibbonize', 'external');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_tier as enum ('free', 'premium_creator', 'premium_supporter');
exception when duplicate_object then null; end $$;

do $$ begin
  create type workspace_role as enum ('admin', 'pm', 'sdr', 'mkt', 'cs', 'viewer');
exception when duplicate_object then null; end $$;

-- Shared trigger function used by all updated_at-tracked tables.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

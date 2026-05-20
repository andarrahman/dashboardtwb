-- 0002_workspaces_profiles
-- Multi-tenant root + user mirror + role membership. RLS for contacts (next
-- migration) depends on workspace_members.

----------------------------------------------------------------------
-- workspaces
----------------------------------------------------------------------
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger workspaces_set_updated_at
before update on workspaces
for each row execute function set_updated_at();

alter table workspaces enable row level security;

----------------------------------------------------------------------
-- profiles  (mirrors auth.users; app-level fields live here)
----------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  email        citext,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on profiles
for each row execute function set_updated_at();

alter table profiles enable row level security;

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function handle_new_auth_user() returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_auth_user();

----------------------------------------------------------------------
-- workspace_members  (drives RLS on every domain table)
----------------------------------------------------------------------
create table workspace_members (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references profiles(id)   on delete cascade,
  role          workspace_role not null default 'viewer',
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user on workspace_members (user_id);

alter table workspace_members enable row level security;

----------------------------------------------------------------------
-- RLS policies
----------------------------------------------------------------------

-- workspaces: a user sees workspaces they're a member of.
create policy workspaces_member_read on workspaces
for select using (
  exists (
    select 1 from workspace_members m
    where m.workspace_id = workspaces.id
      and m.user_id = auth.uid()
  )
);

-- profiles: anyone authenticated can read profiles in workspaces they share.
create policy profiles_self_read on profiles
for select using (
  id = auth.uid()
  or exists (
    select 1
    from workspace_members me
    join workspace_members them on me.workspace_id = them.workspace_id
    where me.user_id = auth.uid()
      and them.user_id = profiles.id
  )
);

create policy profiles_self_update on profiles
for update using (id = auth.uid());

-- workspace_members: visible to fellow members of the same workspace.
create policy workspace_members_visible on workspace_members
for select using (
  exists (
    select 1 from workspace_members me
    where me.workspace_id = workspace_members.workspace_id
      and me.user_id = auth.uid()
  )
);

-- Admins manage membership.
create policy workspace_members_admin_write on workspace_members
for all using (
  exists (
    select 1 from workspace_members me
    where me.workspace_id = workspace_members.workspace_id
      and me.user_id = auth.uid()
      and me.role = 'admin'
  )
) with check (
  exists (
    select 1 from workspace_members me
    where me.workspace_id = workspace_members.workspace_id
      and me.user_id = auth.uid()
      and me.role = 'admin'
  )
);

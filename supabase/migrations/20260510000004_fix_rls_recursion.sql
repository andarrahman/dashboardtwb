-- 0004_fix_rls_recursion
-- The workspace_members RLS policies reference workspace_members itself,
-- causing infinite recursion. Fix: replace the self-referencing EXISTS checks
-- with a security-definer helper function that bypasses RLS.

----------------------------------------------------------------------
-- Helper: is_workspace_member()
-- SECURITY DEFINER → runs as the function owner (bypasses RLS),
-- so it can read workspace_members without triggering the policy.
----------------------------------------------------------------------
create or replace function is_workspace_member(ws_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id
      and user_id = uid
  );
$$;

create or replace function is_workspace_admin(ws_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id
      and user_id = uid
      and role = 'admin'
  );
$$;

----------------------------------------------------------------------
-- Re-create workspace_members policies using the helper functions
----------------------------------------------------------------------
drop policy if exists workspace_members_visible       on workspace_members;
drop policy if exists workspace_members_admin_write   on workspace_members;

-- Any member of the workspace can see the membership list
create policy workspace_members_visible on workspace_members
for select using (
  is_workspace_member(workspace_id, auth.uid())
);

-- Only admins can insert / update / delete membership rows
create policy workspace_members_admin_write on workspace_members
for all using (
  is_workspace_admin(workspace_id, auth.uid())
) with check (
  is_workspace_admin(workspace_id, auth.uid())
);

----------------------------------------------------------------------
-- Also fix the workspaces + contacts + profiles policies that call
-- workspace_members inline (safe to leave as-is — they reference a
-- *different* table so no recursion — but switching to the helper
-- keeps things consistent and avoids future surprises).
----------------------------------------------------------------------
drop policy if exists workspaces_member_read     on workspaces;
drop policy if exists contacts_read              on contacts;
drop policy if exists contacts_insert            on contacts;
drop policy if exists contacts_update            on contacts;
drop policy if exists profiles_self_read         on profiles;

create policy workspaces_member_read on workspaces
for select using (
  is_workspace_member(id, auth.uid())
);

create policy contacts_read on contacts
for select using (
  is_workspace_member(workspace_id, auth.uid())
);

create policy contacts_insert on contacts
for insert with check (
  exists (
    select 1 from workspace_members m
    where m.workspace_id = contacts.workspace_id
      and m.user_id = auth.uid()
      and m.role in ('admin','pm','sdr','mkt','cs')
  )
);

create policy contacts_update on contacts
for update using (
  exists (
    select 1 from workspace_members m
    where m.workspace_id = contacts.workspace_id
      and m.user_id = auth.uid()
      and m.role in ('admin','pm','sdr','mkt','cs')
  )
);

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

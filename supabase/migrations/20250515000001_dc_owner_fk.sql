-- Add FK from discovery_calls.owner_id to profiles.id
-- This lets PostgREST resolve the owner join in DC_SELECT.
ALTER TABLE discovery_calls
  ADD CONSTRAINT discovery_calls_owner_profiles_fkey
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;

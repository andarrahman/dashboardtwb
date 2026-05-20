-- ─── Dev seed ────────────────────────────────────────────────────────────────
-- Run once in the Supabase SQL Editor (or via psql) after migrations.
-- Creates a workspace + sample contacts.
-- NOTE: replace the profile UUID with your actual auth.users.id after sign-up.

-- ─── 1. Workspace ─────────────────────────────────────────────────────────────
insert into workspaces (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Twibbonize', 'twibbonize')
on conflict (slug) do nothing;

-- ─── 2. Add you as admin ──────────────────────────────────────────────────────
-- IMPORTANT: Run this AFTER signing up via the app/Supabase dashboard.
-- Replace <YOUR_USER_ID> with the UUID from auth.users.
--
-- insert into workspace_members (workspace_id, user_id, role)
-- values ('00000000-0000-0000-0000-000000000001', '<YOUR_USER_ID>', 'admin')
-- on conflict do nothing;

-- ─── 3. Sample contacts ───────────────────────────────────────────────────────
insert into contacts (
  workspace_id, type, name, email, whatsapp_number, instagram_handle, website_url,
  twibbonize_user_id, account_tier, country, account_created_at,
  first_campaign_at, latest_campaign_at, total_campaigns, total_supporters,
  top_supporter_countries, last_synced_at,
  segment, use_case_category, summary_profile
) values
  (
    '00000000-0000-0000-0000-000000000001',
    'twibbonize', 'Amara Nwosu', 'amara.nwosu@email.com',
    '+62811234567', 'amaranwosu', 'https://amaranwosu.com',
    'twib_001', 'enterprise', 'ID',
    '2022-03-11T00:00:00Z', '2022-04-01T00:00:00Z', '2025-01-15T00:00:00Z',
    142, 89420, ARRAY['ID','MY','SG'], now(),
    'Partner Creator', 'Brand Advocacy',
    'Top-tier Indonesian creator with strong SEO audience.'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'twibbonize', 'Reza Pratama', 'reza.pratama@mail.co',
    '+62822345678', 'rezapratama_', null,
    'twib_002', 'pro', 'ID',
    '2023-06-20T00:00:00Z', '2023-07-01T00:00:00Z', '2024-11-30T00:00:00Z',
    38, 12471, ARRAY['ID','MY'], now(),
    'Growth Creator', null,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'twibbonize', 'Mei Lin Tan', 'meilin@tancreative.my',
    '+60123456789', 'meilin.tan', 'https://tancreative.my',
    'twib_003', 'pro', 'MY',
    '2021-09-05T00:00:00Z', '2021-10-01T00:00:00Z', '2025-04-02T00:00:00Z',
    76, 31200, ARRAY['MY','SG','ID'], now(),
    'Partner Creator', 'Campaign Design',
    null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'twibbonize', 'Carlos Rivera', 'carlos@rivmedia.com',
    '+628933344556', 'carlosrivmedia', 'https://rivmedia.com',
    'twib_004', 'free', 'SG',
    '2024-01-15T00:00:00Z', '2024-02-01T00:00:00Z', '2024-08-20T00:00:00Z',
    8, 1340, ARRAY['SG','PH'], now(),
    null, null, null
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'twibbonize', 'Layla Hassan', 'layla.h@hassan.ae',
    null, 'layla_hassan', null,
    'twib_005', 'enterprise', 'MY',
    '2020-11-01T00:00:00Z', '2020-12-01T00:00:00Z', '2025-05-01T00:00:00Z',
    203, 145000, ARRAY['MY','ID','GB'], now(),
    'Partner Creator', 'Social Impact',
    'Highest reach creator in our network. Premium advocate.'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'external', 'Budi Santoso', 'budi@santosocorp.id',
    '+62811987654', 'budi.santoso.corp', 'https://santosocorp.id',
    null, null, 'ID',
    null, null, null,
    null, null, null, null,
    'Prospect', 'Corporate Sponsorship',
    'VP Marketing at Santoso Corp. Interested in branded campaign packages.'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'external', 'Yuki Tanaka', 'yuki@tanaka-agency.jp',
    null, null, 'https://tanaka-agency.jp',
    null, null, 'SG',
    null, null, null,
    null, null, null, null,
    'Lead', 'Agency Partnership',
    null
  );

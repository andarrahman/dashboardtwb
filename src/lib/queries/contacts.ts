import { createClient } from '@/lib/supabase/browser'
import type { ContactRow, AccountTier, ContactType } from '@/lib/supabase/types'

export type { ContactRow }

// ─── Filter params ─────────────────────────────────────────────────────────────
export interface ContactFilters {
  workspaceId: string
  search?: string
  types?: ContactType[]
  tiers?: AccountTier[]
  segments?: string[]
  countries?: string[]
  useCases?: string[]
  page?: number
  pageSize?: number
}

// ─── Tab counts (fetched once, not affected by active filters) ─────────────────
export interface ContactTabCounts {
  total: number
  twibbonize: number
  external: number
}

export async function getContactTabCounts(workspaceId: string): Promise<ContactTabCounts> {
  const supabase = createClient()

  const [all, twib, ext] = await Promise.all([
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null),
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .eq('type', 'twibbonize'),
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .eq('type', 'external'),
  ])

  return {
    total:       all.count  ?? 0,
    twibbonize:  twib.count ?? 0,
    external:    ext.count  ?? 0,
  }
}

// ─── Distinct filter options ───────────────────────────────────────────────────
export interface ContactFilterOptions {
  segments: string[]
  countries: string[]
  useCases: string[]
}

export async function getContactFilterOptions(workspaceId: string): Promise<ContactFilterOptions> {
  const supabase = createClient()

  const [seg, cty, uc] = await Promise.all([
    supabase
      .from('contacts')
      .select('segment')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('segment', 'is', null),
    supabase
      .from('contacts')
      .select('country')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('country', 'is', null),
    supabase
      .from('contacts')
      .select('use_case_category')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('use_case_category', 'is', null),
  ])

  const unique = <T>(arr: T[]) => [...new Set(arr)].sort() as string[]

  return {
    segments: unique((seg.data ?? []).map((r: { segment: string | null }) => r.segment).filter(Boolean) as string[]),
    countries: unique((cty.data ?? []).map((r: { country: string | null }) => r.country).filter(Boolean) as string[]),
    useCases:  unique((uc.data  ?? []).map((r: { use_case_category: string | null }) => r.use_case_category).filter(Boolean) as string[]),
  }
}

// ─── Result ────────────────────────────────────────────────────────────────────
export interface ContactsResult {
  data: ContactRow[]
  count: number
  error: string | null
}

// ─── List contacts ─────────────────────────────────────────────────────────────
export async function getContacts(filters: ContactFilters): Promise<ContactsResult> {
  const supabase = createClient()
  const { workspaceId, search, types, tiers, segments, countries, useCases, page = 1, pageSize = 20 } = filters

  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (types?.length)     query = query.in('type', types)
  if (tiers?.length)     query = query.in('account_tier', tiers)
  if (segments?.length)  query = query.in('segment', segments)
  if (countries?.length) query = query.in('country', countries)
  if (useCases?.length)  query = query.in('use_case_category', useCases)

  if (search && search.trim()) {
    // Full-text search using the generated tsvector column
    query = query.textSearch('search', search.trim(), {
      type: 'websearch',
      config: 'simple',
    })
  }

  const { data, count, error } = await query

  return {
    data: data ?? [],
    count: count ?? 0,
    error: error ? error.message : null,
  }
}

// ─── Single contact ────────────────────────────────────────────────────────────
export async function getContact(
  workspaceId: string,
  contactId: string
): Promise<{ data: ContactRow | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .single()

  return { data: data ?? null, error: error ? error.message : null }
}

// ─── Create / Update ──────────────────────────────────────────────────────────

export interface ContactCreateData {
  type: ContactType
  name: string
  email?: string | null
  whatsapp_number?: string | null
  instagram_handle?: string | null
  website_url?: string | null
  // Twibbonize only
  profile_url?: string | null
  account_tier?: AccountTier | null
  country?: string | null
  account_created_at?: string | null
  first_campaign_at?: string | null
  latest_campaign_at?: string | null
  total_campaigns?: number | null
  total_supporters?: number | null
  top_supporter_countries?: string[] | null
  // Internal
  summary_profile?: string | null
  segment?: string | null
  use_case_category?: string | null
}

export async function createContact(
  workspaceId: string,
  createdBy: string,
  data: ContactCreateData
): Promise<{ data: ContactRow | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: row, error } = await supabase
    .from('contacts')
    .insert({ ...data, workspace_id: workspaceId, created_by: createdBy })
    .select('*')
    .single()
  return { data: row ?? null, error: error ? error.message : null }
}

export async function updateContact(
  workspaceId: string,
  contactId: string,
  data: Partial<ContactCreateData>
): Promise<{ data: ContactRow | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: row, error } = await supabase
    .from('contacts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', contactId)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single()
  return { data: row ?? null, error: error ? error.message : null }
}

// ─── Soft-delete ───────────────────────────────────────────────────────────────
export async function softDeleteContact(
  workspaceId: string,
  contactId: string,
  deletedBy: string
): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { error } = await supabase
    .from('contacts')
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq('id', contactId)
    .eq('workspace_id', workspaceId)
  return { error: error ? error.message : null }
}

// ─── Restore (undo soft-delete) ────────────────────────────────────────────────
export async function restoreContact(
  workspaceId: string,
  contactId: string
): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { error } = await supabase
    .from('contacts')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', contactId)
    .eq('workspace_id', workspaceId)
  return { error: error ? error.message : null }
}

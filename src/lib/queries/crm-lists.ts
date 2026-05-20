import { createClient } from '@/lib/supabase/browser'
import type { CrmListRow, CrmListContactRow, ContactRow } from '@/lib/supabase/types'

// ─── List queries ──────────────────────────────────────────────────────────────

export interface GetCrmListsParams {
  search?: string
  folder?: string
  page?: number
  pageSize?: number
}

export async function getCrmLists(
  workspaceId: string,
  params: GetCrmListsParams = {}
): Promise<{ lists: CrmListRow[]; total: number; error: string | null }> {
  const supabase = createClient()
  const { search, folder, page = 1, pageSize = 10 } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = (supabase as any)
    .from('crm_lists')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }
  if (folder) {
    query = query.eq('folder', folder)
  }

  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) return { lists: [], total: 0, error: error.message }
  return { lists: (data ?? []) as CrmListRow[], total: count ?? 0, error: null }
}

export async function getCrmList(
  workspaceId: string,
  listId: string
): Promise<{ list: CrmListRow | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
    .from('crm_lists')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', listId)
    .is('deleted_at', null)
    .single()

  if (error) return { list: null, error: error.message }
  return { list: data as CrmListRow, error: null }
}

// ─── List contacts ─────────────────────────────────────────────────────────────

export interface GetCrmListContactsParams {
  search?: string
  tier?: string
  page?: number
  pageSize?: number
}

export async function getCrmListContacts(
  workspaceId: string,
  listId: string,
  params: GetCrmListContactsParams = {}
): Promise<{ contacts: CrmListContactRow[]; total: number; error: string | null }> {
  const supabase = createClient()
  const { search, tier, page = 1, pageSize = 10 } = params

  // Step 1: fetch all membership rows for this list (no FK join)
  const { data: memberRows, error: memberError } = await (supabase as any)
    .from('crm_list_contacts')
    .select('id, list_id, contact_id, workspace_id, added_at, added_by, added_by_name')
    .eq('workspace_id', workspaceId)
    .eq('list_id', listId)
    .order('added_at', { ascending: false })

  if (memberError) return { contacts: [], total: 0, error: memberError.message }
  if (!memberRows || memberRows.length === 0) return { contacts: [], total: 0, error: null }

  const contactIds: string[] = memberRows.map((r: { contact_id: string }) => r.contact_id)

  // Step 2: fetch contacts by IDs with optional filters
  let contactQuery = (supabase as any)
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .in('id', contactIds)

  if (search) {
    const s = search.replace(/'/g, "''")
    contactQuery = contactQuery.or(`name.ilike.%${s}%,email.ilike.%${s}%`)
  }
  if (tier) {
    contactQuery = contactQuery.eq('account_tier', tier)
  }

  const { data: contactData, count, error: contactError } = await contactQuery

  if (contactError) return { contacts: [], total: 0, error: contactError.message }

  // Step 3: merge membership metadata onto each contact row
  const contactMap = new Map<string, ContactRow>(
    (contactData ?? []).map((c: ContactRow) => [c.id, c])
  )

  const from = (page - 1) * pageSize
  const to = from + pageSize

  const merged: CrmListContactRow[] = memberRows
    .filter((r: { contact_id: string }) => contactMap.has(r.contact_id))
    .slice(from, to)
    .map((r: { id: string; list_id: string; contact_id: string; workspace_id: string; added_at: string; added_by: string | null; added_by_name: string | null }) => ({
      ...r,
      contact: contactMap.get(r.contact_id)!,
    }))

  return { contacts: merged, total: count ?? 0, error: null }
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export interface CreateCrmListData {
  name: string
  description?: string
  folder?: string
  owner_id?: string
  owner_name?: string
}

export async function createCrmList(
  workspaceId: string,
  userId: string,
  userName: string,
  data: CreateCrmListData
): Promise<{ list: CrmListRow | null; error: string | null }> {
  const supabase = createClient()

  const { data: row, error } = await (supabase as any)
    .from('crm_lists')
    .insert({
      workspace_id: workspaceId,
      name: data.name,
      description: data.description ?? null,
      folder: data.folder ?? null,
      owner_id: data.owner_id ?? userId,
      owner_name: data.owner_name ?? userName,
      created_by: userId,
      created_by_name: userName,
      updated_by: userId,
      updated_by_name: userName,
      contact_count: 0,
    })
    .select()
    .single()

  if (error) return { list: null, error: error.message }
  return { list: row as CrmListRow, error: null }
}

export async function updateCrmList(
  workspaceId: string,
  listId: string,
  userId: string,
  userName: string,
  data: Partial<CreateCrmListData>
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('crm_lists')
    .update({
      ...data,
      updated_by: userId,
      updated_by_name: userName,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', listId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteCrmList(
  workspaceId: string,
  listId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  // Hard delete — cascade removes crm_list_contacts rows
  const { error } = await (supabase as any)
    .from('crm_lists')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', listId)

  if (error) return { error: error.message }
  return { error: null }
}

// ─── Contact membership ────────────────────────────────────────────────────────

async function syncContactCount(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  listId: string
): Promise<void> {
  const { count } = await (supabase as any)
    .from('crm_list_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('list_id', listId)

  await (supabase as any)
    .from('crm_lists')
    .update({
      contact_count: count ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', listId)
}

export async function addContactsToList(
  workspaceId: string,
  listId: string,
  contactIds: string[],
  userId: string,
  userName: string
): Promise<{ added: number; error: string | null }> {
  if (contactIds.length === 0) return { added: 0, error: null }

  const supabase = createClient()

  const rows = contactIds.map((contactId) => ({
    list_id: listId,
    contact_id: contactId,
    workspace_id: workspaceId,
    added_by: userId,
    added_by_name: userName,
  }))

  const { data, error } = await (supabase as any)
    .from('crm_list_contacts')
    .upsert(rows, { onConflict: 'list_id,contact_id', ignoreDuplicates: true })
    .select()

  if (error) return { added: 0, error: error.message }

  await syncContactCount(supabase, workspaceId, listId)

  // Fire-and-forget: trigger automation enrollments via server API
  // (browser client cannot run server-side enrollment logic)
  fetch(`/api/crm/lists/${listId}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, contact_ids: contactIds }),
  }).catch(console.error)

  return { added: (data ?? []).length, error: null }
}

export async function removeContactFromList(
  workspaceId: string,
  listId: string,
  contactId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('crm_list_contacts')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('list_id', listId)
    .eq('contact_id', contactId)

  if (error) return { error: error.message }

  await syncContactCount(supabase, workspaceId, listId)

  return { error: null }
}

// ─── Duplicate ─────────────────────────────────────────────────────────────────

export async function duplicateCrmList(
  workspaceId: string,
  listId: string,
  userId: string,
  userName: string
): Promise<{ list: CrmListRow | null; error: string | null }> {
  const supabase = createClient()

  // Fetch original
  const { data: original, error: fetchError } = await (supabase as any)
    .from('crm_lists')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', listId)
    .single()

  if (fetchError || !original) return { list: null, error: fetchError?.message ?? 'List not found' }

  const src = original as CrmListRow

  // Create duplicate
  const { data: newList, error: createError } = await (supabase as any)
    .from('crm_lists')
    .insert({
      workspace_id: workspaceId,
      name: `${src.name} (copy)`,
      description: src.description,
      folder: src.folder,
      owner_id: userId,
      owner_name: userName,
      created_by: userId,
      created_by_name: userName,
      updated_by: userId,
      updated_by_name: userName,
      contact_count: 0,
    })
    .select()
    .single()

  if (createError || !newList) return { list: null, error: createError?.message ?? 'Failed to create duplicate' }

  const created = newList as CrmListRow

  // Copy contacts
  const { data: contacts } = await (supabase as any)
    .from('crm_list_contacts')
    .select('contact_id')
    .eq('workspace_id', workspaceId)
    .eq('list_id', listId)

  if (contacts && contacts.length > 0) {
    const newRows = (contacts as { contact_id: string }[]).map((c) => ({
      list_id: created.id,
      contact_id: c.contact_id,
      workspace_id: workspaceId,
      added_by: userId,
      added_by_name: userName,
    }))

    await (supabase as any).from('crm_list_contacts').insert(newRows)
    await syncContactCount(supabase, workspaceId, created.id)

    // Re-fetch with updated contact_count
    const { data: updated } = await (supabase as any)
      .from('crm_lists')
      .select('*')
      .eq('id', created.id)
      .single()

    return { list: updated as CrmListRow, error: null }
  }

  return { list: created, error: null }
}

// ─── Available contacts (not yet in this list) ─────────────────────────────────

export async function getContactsNotInList(
  workspaceId: string,
  listId: string,
  params: { search?: string; tier?: string; page?: number; pageSize?: number } = {}
): Promise<{ contacts: ContactRow[]; total: number; error: string | null }> {
  const supabase = createClient()
  const { search, tier, page = 1, pageSize = 20 } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Get existing contact IDs in list
  const { data: existing } = await (supabase as any)
    .from('crm_list_contacts')
    .select('contact_id')
    .eq('workspace_id', workspaceId)
    .eq('list_id', listId)

  const existingIds: string[] = (existing ?? []).map(
    (r: { contact_id: string }) => r.contact_id
  )

  let query = (supabase as any)
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (existingIds.length > 0) {
    query = query.not('id', 'in', `(${existingIds.join(',')})`)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (tier) {
    query = query.eq('account_tier', tier)
  }

  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) return { contacts: [], total: 0, error: error.message }
  return { contacts: (data ?? []) as ContactRow[], total: count ?? 0, error: null }
}

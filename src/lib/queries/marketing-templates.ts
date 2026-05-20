import { createClient } from '@/lib/supabase/browser'
import type { MarketingTemplateRow, EmailBlock, TemplateStatus, TemplateCategory, SavedBlockRow } from '@/lib/supabase/types'

// ─── Template versions ─────────────────────────────────────────────────────────

export interface TemplateVersionRow {
  id: string
  template_id: string
  version_number: number
  blocks: EmailBlock[]
  html_content: string | null
  bg_color: string | null
  font_family: string | null
  body_bg_color: string | null
  email_width: number | null
  created_at: string
  created_by: string | null
  created_by_name: string | null
}

// ─── List queries ──────────────────────────────────────────────────────────────

export interface GetTemplatesParams {
  search?: string
  category?: TemplateCategory | ''
  status?: TemplateStatus | 'all' | 'shared'
  page?: number
  pageSize?: number
}

export async function getMarketingTemplates(
  workspaceId: string,
  params: GetTemplatesParams = {}
): Promise<{ templates: MarketingTemplateRow[]; total: number; error: string | null }> {
  const supabase = createClient()
  const { search, category, status, page = 1, pageSize = 12 } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = (supabase as any)
    .from('marketing_templates')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  // Tab filter
  if (status === 'shared') {
    query = query.eq('is_shared', true).is('archived_at', null)
  } else if (status === 'draft') {
    query = query.eq('status', 'draft').is('archived_at', null)
  } else if (status === 'published') {
    query = query.eq('status', 'published').is('archived_at', null)
  } else if (status === 'archived') {
    query = query.not('archived_at', 'is', null)
  } else {
    // 'all' — exclude archived from the all tab
    query = query.is('archived_at', null)
  }

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }
  if (category) {
    query = query.eq('category', category)
  }

  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) return { templates: [], total: 0, error: error.message }
  return {
    templates: (data ?? []) as MarketingTemplateRow[],
    total: count ?? 0,
    error: null,
  }
}

// ─── Tab counts ────────────────────────────────────────────────────────────────

export interface TemplateCounts {
  all: number
  mine: number
  shared: number
  draft: number
  archived: number
}

export async function getTemplateCounts(
  workspaceId: string,
  userId: string
): Promise<{ counts: TemplateCounts; error: string | null }> {
  const supabase = createClient()

  const counts: TemplateCounts = { all: 0, mine: 0, shared: 0, draft: 0, archived: 0 }

  const run = async (extraFilter: (q: any) => any): Promise<number> => {
    const base = (supabase as any)
      .from('marketing_templates')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
    const { count, error } = await extraFilter(base)
    if (error) return 0
    return count ?? 0
  }

  const [all, mine, shared, draft, archived] = await Promise.all([
    run((q: any) => q.is('archived_at', null)),
    run((q: any) => q.eq('owner_id', userId).is('archived_at', null)),
    run((q: any) => q.eq('is_shared', true).is('archived_at', null)),
    run((q: any) => q.eq('status', 'draft').is('archived_at', null)),
    run((q: any) => q.not('archived_at', 'is', null)),
  ])

  counts.all = all
  counts.mine = mine
  counts.shared = shared
  counts.draft = draft
  counts.archived = archived

  return { counts, error: null }
}

// ─── Single template ───────────────────────────────────────────────────────────

export async function getMarketingTemplate(
  workspaceId: string,
  templateId: string
): Promise<{ template: MarketingTemplateRow | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
    .from('marketing_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', templateId)
    .is('deleted_at', null)
    .single()

  if (error) return { template: null, error: error.message }
  return { template: data as MarketingTemplateRow, error: null }
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export interface CreateTemplateData {
  name: string
  category?: TemplateCategory | ''
  subject_line?: string
  preview_text?: string
}

export async function createMarketingTemplate(
  workspaceId: string,
  userId: string,
  userName: string,
  data: CreateTemplateData
): Promise<{ template: MarketingTemplateRow | null; error: string | null }> {
  const supabase = createClient()

  const { data: row, error } = await (supabase as any)
    .from('marketing_templates')
    .insert({
      workspace_id: workspaceId,
      name: data.name,
      category: data.category || null,
      subject_line: data.subject_line || null,
      preview_text: data.preview_text || null,
      status: 'draft',
      blocks: [],
      version: 1,
      is_shared: false,
      owner_id: userId,
      owner_name: userName,
      created_by: userId,
      created_by_name: userName,
      updated_by: userId,
      updated_by_name: userName,
      times_used: 0,
    })
    .select()
    .single()

  if (error) return { template: null, error: error.message }
  return { template: row as MarketingTemplateRow, error: null }
}

export interface UpdateTemplateData {
  name?: string
  subject_line?: string | null
  preview_text?: string | null
  category?: TemplateCategory | null
  blocks?: EmailBlock[]
  html_content?: string | null
  bg_color?: string | null
  font_family?: string | null
  body_bg_color?: string | null
  email_width?: number | null
  status?: TemplateStatus
  is_shared?: boolean
  version?: number
  folder?: string | null
}

export async function updateMarketingTemplate(
  workspaceId: string,
  templateId: string,
  userId: string,
  userName: string,
  data: UpdateTemplateData
): Promise<{ template: MarketingTemplateRow | null; error: string | null }> {
  const supabase = createClient()

  const { data: row, error } = await (supabase as any)
    .from('marketing_templates')
    .update({
      ...data,
      updated_by: userId,
      updated_by_name: userName,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', templateId)
    .select()
    .single()

  if (error) return { template: null, error: error.message }
  return { template: row as MarketingTemplateRow, error: null }
}

export async function deleteMarketingTemplate(
  workspaceId: string,
  templateId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('marketing_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', templateId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function archiveMarketingTemplate(
  workspaceId: string,
  templateId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('marketing_templates')
    .update({ archived_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', templateId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function unarchiveMarketingTemplate(
  workspaceId: string,
  templateId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('marketing_templates')
    .update({ archived_at: null })
    .eq('workspace_id', workspaceId)
    .eq('id', templateId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function duplicateMarketingTemplate(
  workspaceId: string,
  templateId: string,
  userId: string,
  userName: string
): Promise<{ template: MarketingTemplateRow | null; error: string | null }> {
  const supabase = createClient()

  const { data: original, error: fetchError } = await (supabase as any)
    .from('marketing_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', templateId)
    .single()

  if (fetchError || !original) {
    return { template: null, error: fetchError?.message ?? 'Template not found' }
  }

  const src = original as MarketingTemplateRow

  const { data: row, error } = await (supabase as any)
    .from('marketing_templates')
    .insert({
      workspace_id: workspaceId,
      name: `${src.name} (copy)`,
      subject_line: src.subject_line,
      preview_text: src.preview_text,
      category: src.category,
      status: 'draft',
      blocks: src.blocks,
      html_content: src.html_content,
      version: 1,
      is_shared: false,
      owner_id: userId,
      owner_name: userName,
      created_by: userId,
      created_by_name: userName,
      updated_by: userId,
      updated_by_name: userName,
      times_used: 0,
    })
    .select()
    .single()

  if (error) return { template: null, error: error.message }
  return { template: row as MarketingTemplateRow, error: null }
}

// ─── Publish ───────────────────────────────────────────────────────────────────

export async function publishMarketingTemplate(
  workspaceId: string,
  templateId: string,
  userId: string,
  userName: string,
  currentVersion: number
): Promise<{ template: MarketingTemplateRow | null; error: string | null }> {
  return updateMarketingTemplate(workspaceId, templateId, userId, userName, {
    status: 'published',
    version: currentVersion + 1,
  })
}

export async function saveTemplateVersion(
  templateId: string,
  userId: string,
  userName: string,
  data: Omit<TemplateVersionRow, 'id' | 'template_id' | 'created_at' | 'created_by' | 'created_by_name'>
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('template_versions')
    .insert({ ...data, template_id: templateId, created_by: userId, created_by_name: userName })
  return { error: error?.message ?? null }
}

export async function getTemplateVersions(
  templateId: string
): Promise<{ versions: TemplateVersionRow[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await (supabase as any)
    .from('template_versions')
    .select('*')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(20)
  if (error) return { versions: [], error: error.message }
  return { versions: data as TemplateVersionRow[], error: null }
}

// ─── Saved blocks ──────────────────────────────────────────────────────────────

export async function getSavedBlocks(
  workspaceId: string
): Promise<{ blocks: SavedBlockRow[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await (supabase as any)
    .from('saved_blocks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  if (error) return { blocks: [], error: error.message }
  return { blocks: data as SavedBlockRow[], error: null }
}

export async function saveBlock(
  workspaceId: string,
  userId: string,
  userName: string,
  name: string,
  block: EmailBlock
): Promise<{ savedBlock: SavedBlockRow | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await (supabase as any)
    .from('saved_blocks')
    .insert({
      workspace_id: workspaceId,
      name,
      block,
      created_by: userId,
      created_by_name: userName,
    })
    .select()
    .single()
  if (error) return { savedBlock: null, error: error.message }
  return { savedBlock: data as SavedBlockRow, error: null }
}

export async function deleteSavedBlock(
  workspaceId: string,
  savedBlockId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('saved_blocks')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', savedBlockId)
  if (error) return { error: error.message }
  return { error: null }
}

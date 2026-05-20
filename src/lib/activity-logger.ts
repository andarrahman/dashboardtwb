import { createClient } from '@/lib/supabase/server'

export type ActivityAction = 'created' | 'updated' | 'deleted' | 'status_changed'
export type ActivityEntityType = 'project' | 'task' | 'subtask' | 'weekly_update'

export interface LogActivityParams {
  supabase: Awaited<ReturnType<typeof createClient>>
  projectId: string
  workspaceId: string
  actorId: string
  actorName: string
  action: ActivityAction
  entityType: ActivityEntityType
  entityId?: string
  entityTitle?: string
  meta?: Record<string, unknown>
}

export async function logActivity(p: LogActivityParams) {
  try {
    const { error } = await (p.supabase as any).from('project_activity_logs').insert({
      project_id:   p.projectId,
      workspace_id: p.workspaceId,
      actor_id:     p.actorId,
      actor_name:   p.actorName,
      action:       p.action,
      entity_type:  p.entityType,
      entity_id:    p.entityId    ?? null,
      entity_title: p.entityTitle ?? null,
      meta:         p.meta        ?? null,
    })
    if (error) {
      console.error('[activity-logger] insert failed:', error.message, error.code)
    }
  } catch (err) {
    console.error('[activity-logger] unexpected error:', err)
  }
}

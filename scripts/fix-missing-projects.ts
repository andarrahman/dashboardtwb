// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: ws } as any }
)

const workspaceId = '00000000-0000-0000-0000-000000000001'
const andarId = 'b020db2a-1b3a-41d8-81da-8ede0902c41d'
const andarName = 'Andar Rahman'

function tsToISO(ms: string) { return new Date(Number(ms)).toISOString() }

const missing = [
  {
    code: 'PRJ-013',
    name: 'Cross-Team Dependency Map Maintained and Current',
    status: 'in_progress', due: '1782421200000', start: '1774818000000', progress: 50,
    tasks: [
      { name: 'Build cross-team dependency map', status: 'done', due: '1775768400000', start: '1774818000000' },
      { name: 'Update dependency map — flag anything slipped or at risk', status: 'in_progress', due: '1782421200000', start: '1774818000000' },
    ]
  },
  {
    code: 'PRJ-014',
    name: 'Friday Synthesis Delivered Weekly',
    status: 'in_progress', due: '1782421200000', start: '1774818000000', progress: 0,
    tasks: [
      { name: 'Write 5-line judgment call for CEO — cross-functional implications + recommended priority adjustments', status: 'in_progress', due: '1782421200000', start: '1774818000000' },
    ]
  },
]

async function main() {
  for (const proj of missing) {
    const { data: p, error } = await (supabase as any).from('projects').insert({
      workspace_id: workspaceId, project_code: proj.code, title: proj.name,
      field: 'Growth', department: 'COO', owner_id: andarId, owner_name: andarName,
      assignee_ids: [andarId], assignees: [{ id: andarId, name: andarName }],
      status: proj.status, sprint: 'Q2 2026', quarter: 'Q2 2026',
      start_date: tsToISO(proj.start), due_date: tsToISO(proj.due), progress: proj.progress,
      created_by: andarId, created_by_name: andarName, updated_by: andarId, updated_by_name: andarName,
    }).select().single()

    if (error) { console.error(`❌ ${proj.name}: ${error.message}`); continue }
    console.log(`✅ [${proj.code}] ${proj.name}`)

    for (let i = 0; i < proj.tasks.length; i++) {
      const t = proj.tasks[i]
      const { error: te } = await (supabase as any).from('project_tasks').insert({
        project_id: p.id, workspace_id: workspaceId, title: t.name, status: t.status,
        assignee_id: andarId, assignee_name: andarName,
        start_date: tsToISO(t.start), due_date: tsToISO(t.due), sort_order: i + 1,
        created_by: andarId, created_by_name: andarName, updated_by: andarId, updated_by_name: andarName,
      })
      if (te) console.error(`  ❌ ${t.name}: ${te.message}`)
      else console.log(`  ✓ [${t.status}] ${t.name}`)
    }
  }

  await (supabase as any).from('project_code_sequences')
    .upsert({ workspace_id: workspaceId, next_val: 15 }, { onConflict: 'workspace_id' })

  console.log('
🎉 All 12 projects now imported!')
}

main().catch(console.error)

/**
 * One-shot import: ClickUp Q2 parent tasks → CRM Projects
 *                  ClickUp subtasks        → CRM Tasks  (Nicky)
 *
 * Run: npx ts-node --project tsconfig.json scripts/import-clickup-nicky.ts
 *   or: bun scripts/import-clickup-nicky.ts
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const NICKY_EMAIL = 'nicky@twibbonize.com'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws } as any,
})

// ── Status map ClickUp → CRM ─────────────────────────────────────────────────
function mapStatus(clickupStatus: string): string {
  switch (clickupStatus.toLowerCase()) {
    case 'done':         return 'done'
    case 'in progress':  return 'in_progress'
    case 'in review':    return 'review'
    case 'on hold':      return 'backlog'
    default:             return 'backlog'  // "to do"
  }
}

function tsToISO(ms: string | number | null): string | null {
  if (!ms) return null
  return new Date(Number(ms)).toISOString()
}

// ── ClickUp data ─────────────────────────────────────────────────────────────

const PROJECTS = [
  {
    name: 'Support Quality Maintained',
    status: 'done',
    due_date: '1782766800000',
    start_date: '1774818000000',
    tasks: [
      { name: 'CX oversight check',                 status: 'done', due: '1782766800000', start: '1774818000000' },
      { name: 'Runi solo resolution rate tracking', status: 'done', due: '1782421200000', start: '1774818000000' },
      { name: 'CX independence validation',         status: 'done', due: '1784840400000', start: '1783890000000' },
    ],
  },
  {
    name: 'CX Execution Playbook Written and Usable',
    status: 'in progress',
    due_date: '1782421200000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Write CX Execution Playbook draft — escalation routing table, top 10 question categories + reply templates, known bugs list, compensation guidelines, ticket tagging system', status: 'in progress', due: '1775768400000', start: '1774818000000' },
      { name: "Runi tests playbook on 10 real support tickets, surfaces gaps",                                                                                                               status: 'done',        due: '1775768400000', start: '1774818000000' },
      { name: "Refine playbook based on Runi's gap log",                                                                                                                                    status: 'in progress', due: '1776978000000', start: '1776027600000' },
      { name: 'Exit criteria check — confirm Runi handles 80%+ of tickets solo using playbook alone',                                                                                       status: 'to do',       due: '1782421200000', start: '1781470800000' },
    ],
  },
  {
    name: 'CX Insight System Producing Actionable Intelligence',
    status: 'in progress',
    due_date: '1782421200000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Build 4-bucket CX insight',             status: 'done',  due: '1776978000000', start: '1776027600000' },
      { name: 'Friday CX insight review with Runi',    status: 'done',  due: '1782421200000', start: '1774818000000' },
      { name: 'CX → Product Monday update to Yoga',    status: 'done',  due: '1782680400000', start: '1774818000000' },
      { name: 'Customer Signals Report',               status: 'done',  due: '1782421200000', start: '1776027600000' },
      { name: 'Cross-initiative insight synthesis',    status: 'to do', due: '1779397200000', start: '1778446800000' },
    ],
  },
  {
    name: 'Social Presence Reactivated and Consistent',
    status: 'to do',
    due_date: '1782421200000',
    start_date: '1776027600000',
    tasks: [
      { name: 'Instagram: 2–3 posts/week',                                  status: 'to do', due: '1782421200000', start: '1776027600000' },
      { name: 'Blog: 1+ piece/week published',                              status: 'to do', due: '1782421200000', start: '1776027600000' },
      { name: 'Weekly Instagram Use Case Spotlight',                        status: 'to do', due: '1782421200000', start: '1776027600000' },
      { name: 'Content template for reuse across all social posts',         status: 'to do', due: '1776978000000', start: '1776027600000' },
    ],
  },
  {
    name: 'Creator Stories Captured and Published',
    status: 'to do',
    due_date: '1782421200000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Creator story #1',                                                                              status: 'to do', due: '1778187600000', start: '1777237200000' },
      { name: 'Creator story #2',                                                                              status: 'to do', due: '1779397200000', start: '1778446800000' },
      { name: 'Creator story #3',                                                                              status: 'to do', due: '1780606800000', start: '1779656400000' },
      { name: 'Flag interesting creators from CX inbox and platform browsing to Growth',                      status: 'to do', due: '1782421200000', start: '1774818000000' },
      { name: 'Use case proof library finalized — 10 compelling campaigns, visuals included',                 status: 'to do', due: '1779397200000', start: '1778446800000' },
    ],
  },
  {
    name: 'Content Engine Live and Running Consistently',
    status: 'in progress',
    due_date: '1782421200000',
    start_date: '1776027600000',
    tasks: [
      { name: 'Draft brand voice guidelines + reusable content templates', status: 'done',        due: '1776978000000', start: '1776027600000' },
      { name: 'Decide content resourcing model',                           status: 'done',        due: '1776978000000', start: '1776027600000' },
      { name: 'Test one full content',                                     status: 'done',        due: '1776978000000', start: '1776027600000' },
      { name: 'Launch content production engine',                          status: 'done',        due: '1776978000000', start: '1776027600000' },
      { name: 'Regular content posting',                                   status: 'in progress', due: '1782421200000', start: '1776027600000' },
      { name: 'Content engine validation',                                 status: 'to do',       due: '1782421200000', start: '1781470800000' },
    ],
  },
  {
    name: 'Content Initiatives Shipped (Creator Success)',
    status: 'to do',
    due_date: '1781816400000',
    start_date: '1776027600000',
    tasks: [
      { name: 'Use case playbook #1 + #2 published (e.g. cause/advocacy + fan/fandom)',                                                status: 'to do', due: '1776978000000', start: '1776027600000' },
      { name: 'Campaign naming guide published as blog post — repurposed to Instagram + email',                                        status: 'to do', due: '1776978000000', start: '1776027600000' },
      { name: 'Draft 5-email onboarding sequence (Day 0, 3, 7, 14, 30)',                                                              status: 'to do', due: '1776978000000', start: '1776027600000' },
      { name: 'Use case playbook #3 + #4 published (e.g. achievement + event)',                                                       status: 'to do', due: '1778187600000', start: '1777237200000' },
      { name: 'Use case playbook #5 + #6 published (e.g. launch + membership)',                                                       status: 'to do', due: '1779397200000', start: '1778446800000' },
      { name: 'Use case playbook #7 published (final — category determined by S4 research gap)',                                      status: 'to do', due: '1780606800000', start: '1779656400000' },
      { name: 'Creator Success Guide published on blog — "How to run a campaign that actually spreads"',                              status: 'to do', due: '1780606800000', start: '1779656400000' },
      { name: 'Creator Design Brief delivered to Yoga',                                                                               status: 'to do', due: '1781816400000', start: '1780866000000' },
    ],
  },
  {
    name: 'Help Center Updated and Useful',
    status: 'in progress',
    due_date: '1781211600000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Request current known bugs snapshot from Zikri',                                                                        status: 'to do',       due: '1775768400000', start: '1774818000000' },
      { name: 'Help center audit',                                                                                                     status: 'done',        due: '1776978000000', start: '1776027600000' },
      { name: 'Help center articles published',                                                                                        status: 'done',        due: '1779397200000', start: '1777237200000' },
      { name: 'Use case playbooks + Creator Success Guide + Campaign Naming Guide published on help center', status: 'in progress', due: '1781211600000', start: '1776027600000' },
    ],
  },
]

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Get workspace_id
  const { data: workspace, error: wsErr } = await (supabase as any)
    .from('workspaces')
    .select('id, name')
    .limit(1)
    .single()

  if (wsErr) { console.error('❌ Cannot get workspace:', wsErr.message); process.exit(1) }
  const workspaceId: string = workspace.id
  console.log(`✅ Workspace: ${workspace.name} (${workspaceId})`)

  // 2. Get Nicky's user_id
  const { data: profile, error: profErr } = await (supabase as any)
    .from('profiles')
    .select('id, display_name, email')
    .eq('email', NICKY_EMAIL)
    .single()

  if (profErr) { console.error('❌ Cannot get Nicky profile:', profErr.message); process.exit(1) }
  const userId: string = profile.id
  const userName: string = profile.display_name || 'Nicky'
  console.log(`✅ Assignee: ${userName} (${userId})`)

  // 3. Read current next_val from DB (so script can be run independently)
  const { data: seqRow } = await (supabase as any)
    .from('project_code_sequences')
    .select('next_val')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  let nextCode = seqRow?.next_val ?? 1

  function getNextCode(): string {
    const code = `PRJ-${String(nextCode).padStart(3, '0')}`
    nextCode++
    return code
  }

  // 4. Import each project + tasks
  let projectsCreated = 0
  let tasksCreated = 0

  for (const proj of PROJECTS) {
    const project_code = getNextCode()
    const projStatus = mapStatus(proj.status)
    const dueDate = tsToISO(proj.due_date)
    const startDate = tsToISO(proj.start_date)
    const quarter = dueDate
      ? `Q${Math.ceil((new Date(dueDate).getMonth() + 1) / 3)} ${new Date(dueDate).getFullYear()}`
      : 'Q2 2026'

    const doneTasks = proj.tasks.filter(t => t.status === 'done')
    const progress = proj.tasks.length > 0
      ? Math.round((doneTasks.length / proj.tasks.length) * 100)
      : 0

    const { data: createdProject, error: projErr } = await (supabase as any)
      .from('projects')
      .insert({
        workspace_id:    workspaceId,
        project_code,
        title:           proj.name,
        field:           'Marketing',
        department:      'Marketing',
        owner_id:        userId,
        owner_name:      userName,
        assignee_ids:    [userId],
        assignees:       [{ id: userId, name: userName }],
        status:          projStatus,
        sprint:          'Q2 2026',
        quarter,
        start_date:      startDate,
        due_date:        dueDate,
        progress,
        created_by:      userId,
        created_by_name: userName,
        updated_by:      userId,
        updated_by_name: userName,
      })
      .select()
      .single()

    if (projErr) {
      console.error(`  ❌ Project "${proj.name}": ${projErr.message}`)
      continue
    }

    projectsCreated++
    console.log(`  ✅ Project [${project_code}] ${proj.name} (${projStatus}, progress: ${progress}%)`)

    // Insert tasks
    for (let i = 0; i < proj.tasks.length; i++) {
      const t = proj.tasks[i]
      const { error: taskErr } = await (supabase as any)
        .from('project_tasks')
        .insert({
          project_id:      createdProject.id,
          workspace_id:    workspaceId,
          title:           t.name,
          status:          mapStatus(t.status),
          assignee_id:     userId,
          assignee_name:   userName,
          start_date:      tsToISO(t.start),
          due_date:        tsToISO(t.due),
          sort_order:      i + 1,
          created_by:      userId,
          created_by_name: userName,
          updated_by:      userId,
          updated_by_name: userName,
        })

      if (taskErr) {
        console.error(`    ❌ Task "${t.name}": ${taskErr.message}`)
      } else {
        tasksCreated++
        console.log(`    ✓ [${mapStatus(t.status)}] ${t.name}`)
      }
    }
  }

  // 5. Update sequence
  await (supabase as any)
    .from('project_code_sequences')
    .upsert({ workspace_id: workspaceId, next_val: nextCode }, { onConflict: 'workspace_id' })

  console.log(`\n🎉 Done! Created ${projectsCreated} projects and ${tasksCreated} tasks.`)
}

main().catch(console.error)

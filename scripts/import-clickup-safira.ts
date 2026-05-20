// @ts-nocheck
/**
 * One-shot import: ClickUp Q2 parent tasks → CRM Projects
 *                  ClickUp subtasks        → CRM Tasks  (Safira)
 *
 * Run: npx ts-node --project tsconfig.json scripts/import-clickup-safira.ts
 *   or: bun scripts/import-clickup-safira.ts
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SAFIRA_EMAIL = 'fira@twibbonize.com'

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
    name: 'Financial Review',
    status: 'in progress',
    due_date: '1782766800000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Build 3-scenario runway projection (base, optimistic, pessimistic)',                                           status: 'done',        due: '1775768400000', start: '1774818000000' },
      { name: 'Weekly runway status report',                                                                                  status: 'in progress', due: '1779397200000', start: '1775768400000' },
      { name: 'Monthly financial review with CEO',                                                                            status: 'in progress', due: '1782766800000', start: '1777582800000' },
      { name: 'Begin Ripple cost tagging — tag all Ripple-specific expenses',                                                 status: 'to do',       due: '1780606800000', start: '1779656400000' },
      { name: 'Build hiring impact calculator',                                                                               status: 'done',        due: '1778187600000', start: '1777237200000' },
      { name: 'Complete tool audit: inventory, per-person mapping, keep/review/cut recommendations',                         status: 'in review',   due: '1776978000000', start: '1776027600000' },
      { name: 'Build Project Cost Management',                                                                                status: 'to do',       due: '1778187600000', start: '1777237200000' },
    ],
  },
  {
    name: 'Unit Economics Populated with Real Data',
    status: 'to do',
    due_date: '1781816400000',
    start_date: '1776027600000',
    tasks: [
      { name: 'ARPU creator, ARPU supporter, ad RPM per country, payment channel efficiency (Month 1 baseline)',             status: 'in progress', due: '1776978000000', start: '1776027600000' },
      { name: "Populate cost-to-serve — cost per user, per campaign, per geography via Zikri's API",                        status: 'in progress', due: '1776978000000', start: '1776027600000' },
      { name: 'Calculate gross margin per creator, per supporter, per campaign broken down by geography',                    status: 'in progress', due: '1779397200000', start: '1778446800000' },
      { name: 'Q2 wrap-up — confirm unit economics populated for all 3 months',                                              status: 'in progress', due: '1781816400000', start: '1780866000000' },
    ],
  },
  {
    name: 'Business Tier Pricing Scenarios Modeled',
    status: 'to do',
    due_date: '1778014800000',
    start_date: '1778014800000',
    tasks: [
      { name: 'Break-even price per supporter per geography (Community + Business tier)',                                     status: 'in progress', due: '1780606800000', start: '1778446800000' },
      { name: '3 pricing scenarios — conservative, growth, premium',                                                         status: 'to do',       due: '1780606800000', start: '1779656400000' },
      { name: 'Cannibalization estimates',                                                                                    status: 'to do',       due: '1780606800000', start: '1779656400000' },
      { name: 'Geographic pricing analysis',                                                                                  status: 'to do',       due: '1780606800000', start: '1779656400000' },
      { name: 'Pricing recommendation document',                                                                              status: 'to do',       due: '1780606800000', start: '1779656400000' },
      { name: 'Quarterly 12-month projection review',                                                                        status: 'to do',       due: '1780606800000', start: '1779656400000' },
    ],
  },
  {
    name: 'Finance Dashboard',
    status: 'in progress',
    due_date: '1773349200000',
    start_date: '1773349200000',
    tasks: [
      { name: 'Populate View 1 — Cash & Runway: full historical bank balance, burn, runway, color status',                   status: 'done',        due: '1775768400000', start: '1774818000000' },
      { name: 'Populate View 2 — Revenue Breakdown: non-ad (API auto) + ad revenue manually',                               status: 'done',        due: '1775768400000', start: '1774818000000' },
      { name: 'Populate View 3 — Cost Structure: infra (API auto) + manual expenses by category',                           status: 'in progress', due: '1775768400000', start: '1774818000000' },
      { name: 'Populate View 4 — Ripple Pilot Log: one row per historical pilot',                                            status: 'in progress', due: '1775768400000', start: '1774818000000' },
      { name: 'Populate View 5 — Unit Economics: ARPU creator, ARPU supporter, ad RPM, payment channel efficiency',         status: 'in progress', due: '1775768400000', start: '1774818000000' },
      { name: 'Populate View 6 — Pricing Analysis: placeholder structure ready for real data',                               status: 'in progress', due: '1775768400000', start: '1774818000000' },
      { name: 'Employee View 7 — Showing metrics for employee',                                                              status: 'in progress', due: '1777496400000', start: '1776286800000' },
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

  // 2. Get Safira's user_id
  const { data: profile, error: profErr } = await (supabase as any)
    .from('profiles')
    .select('id, display_name, email')
    .eq('email', SAFIRA_EMAIL)
    .single()

  if (profErr) { console.error('❌ Cannot get Safira profile:', profErr.message); process.exit(1) }
  const userId: string = profile.id
  const userName: string = profile.display_name || 'Safira'
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
        field:           'Finance',
        department:      'Finance',
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

  console.log(`
🎉 Done! Created ${projectsCreated} projects and ${tasksCreated} tasks.`)
}

main().catch(console.error)

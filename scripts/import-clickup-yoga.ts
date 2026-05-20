/**
 * One-shot import: ClickUp Q2 parent tasks → CRM Projects
 *                  ClickUp subtasks        → CRM Tasks  (Yoga)
 *
 * Run: npx ts-node --project tsconfig.json scripts/import-clickup-yoga.ts
 *   or: bun scripts/import-clickup-yoga.ts
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const YOGA_EMAIL = 'yoga@twibbonize.com'

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
    name: 'Reconstruction Requirements Defined and Delivered on Schedule',
    status: 'to do',
    due_date: '1782766800000',
    start_date: '1776027600000',
    tasks: [
      { name: 'Design-to-code POC',                                                                                          status: 'done',        due: '1775768400000', start: '1774818000000' },
      { name: 'Validate handoff format with Zikri',                                                                          status: 'done',        due: '1775768400000', start: '1774818000000' },
      { name: 'Build React component library',                                                                                status: 'in progress', due: '1776978000000', start: '1776027600000' },
      { name: 'Campaign creation design finalized',                                                                           status: 'in progress', due: '1776978000000', start: '1776027600000' },
      { name: 'Homepage + pricing page designs',                                                                              status: 'to do',       due: '1778187600000', start: '1777237200000' },
      { name: 'Marketing pages finalized with all assets',                                                                    status: 'to do',       due: '1779397200000', start: '1778446800000' },
      { name: 'Billing + usage page, team seats, analytics dashboards designed',                                              status: 'to do',       due: '1779397200000', start: '1778446800000' },
      { name: 'Full pricing schema spec written',                                                                             status: 'to do',       due: '1781816400000', start: '1780866000000' },
      { name: 'Specs for all pricing-dependent features',                                                                     status: 'to do',       due: '1781816400000', start: '1780866000000' },
      { name: 'Engineering handoff packages delivered',                                                                       status: 'to do',       due: '1781816400000', start: '1780866000000' },
      { name: 'Engineering blocking audit',                                                                                   status: 'to do',       due: '1782766800000', start: '1774818000000' },
    ],
  },
  {
    name: 'Growth Briefs Evaluated and Prioritized',
    status: 'to do',
    due_date: '1782680400000',
    start_date: '1774818000000',
    tasks: [
      { name: "Review Andar's 3 product briefs (Campaign Categories, Naming Examples, Description Prompts)", status: 'to do', due: '1778187600000', start: '1777237200000' },
      { name: 'Growth brief processing',                                                                     status: 'to do', due: '1782421200000', start: '1774818000000' },
      { name: 'Business tier pricing input delivered to Andar and Fira',                                     status: 'to do', due: '1781816400000', start: '1780866000000' },
      { name: 'Creator Design Brief intake from Nicky',                                                      status: 'to do', due: '1781816400000', start: '1780347600000' },
      { name: 'CX → Product weekly update review',                                                           status: 'to do', due: '1782680400000', start: '1776027600000' },
    ],
  },
  {
    name: 'Fariz and Dika Growing into Product Thinkers',
    status: 'to do',
    due_date: '1782421200000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Fariz: audit + document 100% UI components (S1) → build React component library (S2) → Quiz mobile responsive (S3) → billing, team seats, analytics (S4) → QA/QC twibbonize-next (S5)', status: 'to do', due: '1780606800000', start: '1774818000000' },
      { name: 'Dika: campaign creation prototypes (S1) → final campaign creation design (S2) → homepage + pricing page (S3) → marketing pages finalized (S4) → campaign support design (S5)',          status: 'to do', due: '1780606800000', start: '1774818000000' },
      { name: 'Fariz delivers one full spec independently',                                                                                                                                              status: 'to do', due: '1780606800000', start: '1779656400000' },
      { name: 'Design review',                                                                                                                                                                           status: 'to do', due: '1782421200000', start: '1774818000000' },
      { name: 'Usability review',                                                                                                                                                                        status: 'to do', due: '1780606800000', start: '1779656400000' },
    ],
  },
  {
    name: 'Measurement Integrated into Every Spec',
    status: 'to do',
    due_date: '1782421200000',
    start_date: '1776027600000',
    tasks: [
      { name: 'Define Event Map framework',                                                                        status: 'to do', due: '1775768400000', start: '1774818000000' },
      { name: 'Event Map shared with Zikri for Engineering implementation planning',                               status: 'to do', due: '1776978000000', start: '1776027600000' },
      { name: '100% of features shipped in Q2 have defined success metrics before Engineering starts',             status: 'to do', due: '1781816400000', start: '1774818000000' },
      { name: 'Event Map updated',                                                                                 status: 'to do', due: '1782421200000', start: '1777237200000' },
    ],
  },
  {
    name: 'AI-Assisted Product Process Documented and Operational',
    status: 'to do',
    due_date: '1782421200000',
    start_date: '1776027600000',
    tasks: [
      { name: 'Establish AI-assisted workflow for component documentation',  status: 'done',  due: '1773349200000', start: '1773349200000' },
      { name: 'Fariz delivers one complete spec end-to-end independently',   status: 'to do', due: '1780606800000', start: '1779656400000' },
      { name: 'Design review with Fariz and Dika',                          status: 'to do', due: '1781816400000', start: '1774818000000' },
    ],
  },
  {
    name: 'Product Knowledge System Established and Maintained',
    status: 'to do',
    due_date: '1781816400000',
    start_date: '1776027600000',
    tasks: [
      { name: 'Audit and document 100% of existing UI components in Figma',             status: 'done',        due: '1775768400000', start: '1774818000000' },
      { name: 'Refine design system components',                                        status: 'in progress', due: '1776978000000', start: '1776027600000' },
      { name: 'Full QA/QC of twibbonize-next',                                         status: 'to do',       due: '1780606800000', start: '1779656400000' },
      { name: 'QC findings compiled into prioritized fix list (critical/major/minor)',  status: 'to do',       due: '1780606800000', start: '1779656400000' },
      { name: 'Q2 spec completeness review',                                            status: 'to do',       due: '1781816400000', start: '1780866000000' },
      { name: 'Event Map maintenance',                                                  status: 'to do',       due: '1781816400000', start: '1777237200000' },
      { name: 'Monthly product review',                                                 status: 'to do',       due: '1781816400000', start: '1778187600000' },
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

  // 2. Get Yoga's user_id
  const { data: profile, error: profErr } = await (supabase as any)
    .from('profiles')
    .select('id, display_name, email')
    .eq('email', YOGA_EMAIL)
    .single()

  if (profErr) { console.error('❌ Cannot get Yoga profile:', profErr.message); process.exit(1) }
  const userId: string = profile.id
  const userName: string = profile.display_name || 'Yoga'
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
        field:           'Product',
        department:      'Product',
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

// @ts-nocheck
/**
 * One-shot import: ClickUp Q2 parent tasks → CRM Projects
 *                  ClickUp subtasks        → CRM Tasks
 *
 * Run: npx ts-node --project tsconfig.json scripts/import-clickup-andar.ts
 *   or: bun scripts/import-clickup-andar.ts
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const ANDAR_EMAIL = 'andar@twibbonize.com'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws } as any,
})

// ── Status map ClickUp → CRM ─────────────────────────────────────────────────
function mapStatus(clickupStatus: string): string {
  switch (clickupStatus.toLowerCase()) {
    case 'done':        return 'done'
    case 'in progress': return 'in_progress'
    case 'in review':   return 'review'
    case 'on hold':     return 'backlog'
    default:            return 'backlog'  // "to do"
  }
}

function tsToISO(ms: string | number | null): string | null {
  if (!ms) return null
  return new Date(Number(ms)).toISOString()
}

// ── ClickUp data (fetched manually above) ───────────────────────────────────

const PROJECTS = [
  {
    name: 'Cross-Team Dependency Map Maintained and Current',
    status: 'in progress',
    due_date: '1782421200000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Build cross-team dependency map',                          status: 'done',        due: '1775768400000', start: '1774818000000' },
      { name: 'Update dependency map — flag anything slipped or at risk', status: 'in progress', due: '1782421200000', start: '1774818000000' },
    ],
  },
  {
    name: 'Friday Synthesis Delivered Weekly',
    status: 'in progress',
    due_date: '1782421200000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Write 5-line judgment call for CEO — cross-functional implications + recommended priority adjustments', status: 'in progress', due: '1782421200000', start: '1774818000000' },
    ],
  },
  {
    name: 'Bi-Weekly Priority Meetings Facilitated with Recommendations',
    status: 'to do',
    due_date: '1782421200000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Prepare agenda with recommended priority adjustments',            status: 'to do', due: '1782421200000', start: '1774818000000' },
      { name: 'Facilitate meeting, maintain decision log, follow up on execution', status: 'to do', due: '1782421200000', start: '1774818000000' },
    ],
  },
  {
    name: 'Marketing Operations Stack',
    status: 'in progress',
    due_date: '1779397200000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Email tool selected (Mailchimp, Brevo, or ConvertKit)',                     status: 'done',  due: '1775768400000', start: '1774818000000' },
      { name: 'Segmentation engine live (by creator type, geography, past campaign category)', status: 'done',  due: '1776978000000', start: '1776027600000' },
      { name: 'Creator lifecycle tracking active',                                          status: 'done',  due: '1778187600000', start: '1777237200000' },
      { name: 'Initiative measurement dashboards built',                                    status: 'done',  due: '1778187600000', start: '1777237200000' },
      { name: 'Creator onboarding email sequence tested on a small group (100–500 creators)', status: 'to do', due: '1778187600000', start: '1777237200000' },
      { name: 'Dormant re-engagement sequence tested (100–200 creators)',                   status: 'to do', due: '1778187600000', start: '1777237200000' },
      { name: 'Post-campaign follow-up email tested manually (20–30 creators first)',       status: 'to do', due: '1779397200000', start: '1778446800000' },
    ],
  },
  {
    name: 'Business Tier Pricing Recommendation',
    status: 'in progress',
    due_date: '1779397200000',
    start_date: '1776027600000',
    tasks: [
      { name: 'WTP signals collected from all discovery conversations',              status: 'done',  due: '1779397200000', start: '1776027600000' },
      { name: 'All signals structured and synthesized by Andar',                    status: 'done',  due: '1779397200000', start: '1776027600000' },
      { name: 'Pricing scenarios modeled by Fira (break-even, geographic pricing, cannibalization)', status: 'to do', due: '1780606800000', start: '1779656400000' },
      { name: 'Final pricing recommendation delivered to CEO and Fira by end of Q2', status: 'to do', due: '1780606800000', start: '1779656400000' },
    ],
  },
  {
    name: 'Product-Growth Bridge',
    status: 'in progress',
    due_date: '1778187600000',
    start_date: '1777237200000',
    tasks: [
      { name: 'Insight Report',               status: 'done',  due: '1778187600000', start: '1777928400000' },
      { name: 'Discussion with Yoga & Mulqan', status: 'to do', due: '1779260400000', start: '1779256800000' },
    ],
  },
  {
    name: 'Cross-Company Retro System Producing Real Interventions',
    status: 'in progress',
    due_date: '1778187600000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Design retro format for all departments + communicate to leaders',                            status: 'done',  due: '1778187600000', start: '1773349200000' },
      { name: 'Collect retro outputs from all departments, identify systemic patterns, present interventions to CEO', status: 'to do', due: '1776978000000', start: '1775768400000' },
      { name: 'Conduct retrospective cycle 3 — collect outputs, assess team development milestones',         status: 'to do', due: '1778187600000', start: '1777237200000' },
    ],
  },
  {
    name: 'Discovery Conversations Completed with Structured Insights',
    status: 'in progress',
    due_date: '1777496400000',
    start_date: '1776027600000',
    tasks: [
      { name: '15–20 brands/organizations on Twibbonize identified and scored', status: 'in progress', due: '1776978000000', start: '1776027600000' },
      { name: '8–12 structured discovery conversations completed across Q2',    status: 'in progress', due: '1776978000000', start: '1776027600000' },
    ],
  },
  {
    name: 'International Growth Targeting System',
    status: 'in progress',
    due_date: '1776978000000',
    start_date: '1774818000000',
    tasks: [
      { name: 'International creator data pulled from Zikri (format: name, email, segment, campaign type, frequency)', status: 'done',  due: '1776027600000', start: '1774818000000' },
      { name: 'Seasonal campaign calendar built (moments mapped across countries & use case categories)',               status: 'done',  due: '1776978000000', start: '1776027600000' },
      { name: 'International creator activation outreach — first wave in Sprint 1, continued each sprint',             status: 'done',  due: '1776978000000', start: '1776027600000' },
      { name: 'Use Case Distribution Analysis',                                                                        status: 'done',  due: '1776978000000', start: '1776027600000' },
      { name: 'Monthly growth intelligence report → delivered to CEO',                                                 status: 'to do', due: '1782766800000', start: '1776027600000' },
    ],
  },
  {
    name: 'AI Adoption Progressing Across Non-Engineering Teams',
    status: 'to do',
    due_date: '1779397200000',
    start_date: '1776027600000',
    tasks: [
      { name: 'Identify top 5 repetitive non-dev tasks across company + select first workflow to automate', status: 'in progress', due: '1776978000000', start: '1776027600000' },
      { name: 'Set up and implement first AI workflow for 1 non-dev team + document time saved',            status: 'to do',       due: '1778187600000', start: '1777237200000' },
      { name: 'Execute second AI workflow for a different non-dev team + document time saved',              status: 'to do',       due: '1779397200000', start: '1778446800000' },
      { name: 'Run "AI wins" share in bi-weekly meeting (5 min — what worked, what didn\'t)',               status: 'to do',       due: '1779397200000', start: '1778187600000' },
    ],
  },
  {
    name: 'Structured Insights',
    status: 'to do',
    due_date: '1779397200000',
    start_date: '1776027600000',
    tasks: [
      { name: 'Structured insights delivered to Yoga (product direction) after every 3 conversations', status: 'to do', due: '1779397200000', start: '1776027600000' },
      { name: 'Structured insights delivered to Fira (pricing data) after every 3 conversations',      status: 'done',  due: '1779397200000', start: '1776027600000' },
      { name: 'Use case stories flagged to Nicky (Marketing) for content pipeline',                    status: 'to do', due: '1782766800000', start: '1776027600000' },
    ],
  },
  {
    name: 'Reconstruction on Track with No Surprise Blockers',
    status: 'to do',
    due_date: '1781816400000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Review all leader daily updates for blockers, misalignments, dependency risks',                   status: 'to do', due: '1782421200000', start: '1774818000000' },
      { name: 'Conduct Q2 mid-point health check — all playbook deliverables reviewed against timeline',         status: 'to do', due: '1779397200000', start: '1778446800000' },
      { name: 'Write Q2 operational retrospective — what worked, what didn\'t, where dependency map caught blockers', status: 'to do', due: '1781816400000', start: '1780866000000' },
      { name: 'Archive all Q2 Growth and COO outputs — indexed and organized for Q3',                            status: 'to do', due: '1781816400000', start: '1780866000000' },
    ],
  },
]

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Get workspace_id
  const { data: workspaces, error: wsErr } = await (supabase as any)
    .from('workspaces')
    .select('id, name')
    .limit(1)
    .single()

  if (wsErr) { console.error('❌ Cannot get workspace:', wsErr.message); process.exit(1) }
  const workspaceId: string = workspaces.id
  console.log(`✅ Workspace: ${workspaces.name} (${workspaceId})`)

  // 2. Get Andar's user_id
  const { data: profile, error: profErr } = await (supabase as any)
    .from('profiles')
    .select('id, display_name, email')
    .eq('email', ANDAR_EMAIL)
    .single()

  if (profErr) { console.error('❌ Cannot get Andar profile:', profErr.message); process.exit(1) }
  const andarId: string = profile.id
  const andarName: string = profile.display_name || 'Andar Rahman'
  console.log(`✅ Assignee: ${andarName} (${andarId})`)

  // 3. Get next project code sequence
  const { data: seqRow } = await (supabase as any)
    .from('project_code_sequences')
    .select('next_val')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  let nextCode = seqRow?.next_val ?? 1

  async function getNextCode(): Promise<string> {
    const code = `PRJ-${String(nextCode).padStart(3, '0')}`
    nextCode++
    return code
  }

  // 4. Import each project + tasks
  let projectsCreated = 0
  let tasksCreated = 0

  for (const proj of PROJECTS) {
    const project_code = await getNextCode()
    const projStatus = mapStatus(proj.status)
    const dueDate = tsToISO(proj.due_date)
    const startDate = tsToISO(proj.start_date)
    const quarter = dueDate ? `Q${Math.ceil((new Date(dueDate).getMonth() + 1) / 3)} ${new Date(dueDate).getFullYear()}` : 'Q2 2026'

    // Calculate initial progress from tasks
    const doneTasks = proj.tasks.filter(t => t.status === 'done').length
    const progress = proj.tasks.length > 0 ? Math.round((doneTasks / proj.tasks.length) * 100) : 0

    const { data: createdProject, error: projErr } = await (supabase as any)
      .from('projects')
      .insert({
        workspace_id:     workspaceId,
        project_code,
        title:            proj.name,
        field:            'Growth',
        department:       'COO',
        owner_id:         andarId,
        owner_name:       andarName,
        assignee_ids:     [andarId],
        assignees:        [{ id: andarId, name: andarName }],
        status:           projStatus,
        sprint:           'Q2 2026',
        quarter,
        start_date:       startDate,
        due_date:         dueDate,
        progress,
        created_by:       andarId,
        created_by_name:  andarName,
        updated_by:       andarId,
        updated_by_name:  andarName,
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
          assignee_id:     andarId,
          assignee_name:   andarName,
          start_date:      tsToISO(t.start),
          due_date:        tsToISO(t.due),
          sort_order:      i + 1,
          created_by:      andarId,
          created_by_name: andarName,
          updated_by:      andarId,
          updated_by_name: andarName,
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

// @ts-nocheck
/**
 * One-shot import: ClickUp Q2 parent tasks → CRM Projects
 *                  ClickUp subtasks        → CRM Tasks  (Zikri)
 *
 * Run: npx ts-node --project tsconfig.json scripts/import-clickup-zikri.ts
 *   or: bun scripts/import-clickup-zikri.ts
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const ZIKRI_EMAIL = 'zikri@twibbonize.com'

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
    name: 'Hygience',
    status: 'in progress',
    due_date: '1782766800000',
    start_date: '1774818000000',
    tasks: [
      { name: 'All 6 engineers confirm local env setup; Zikri shadows Farhan 2x on DevOps',                                              status: 'done',        due: '1775768400000', start: '1774818000000' },
      { name: 'First delegation briefs: Farhan owns Pluto, Aditya owns FE architecture',                                                 status: 'done',        due: '1776978000000', start: '1776027600000' },
      { name: 'Farhan officially takes DevOps backup from Zikri; runbook committed',                                                     status: 'on hold',     due: '1778187600000', start: '1777237200000' },
      { name: 'Rehearsal week — rollback drills, incident response prep',                                                                status: 'to do',       due: '1779397200000', start: '1778446800000' },
      { name: 'Sentry in prod, alerts trigger, rollback drills 2x, <10 min recovery; Farhan+Aditya own briefs independently',           status: 'to do',       due: '1780606800000', start: '1779656400000' },
      { name: 'Leadership handoff confirmed: Farhan owns DevOps+Nexus Q3, Aditya owns FE, Zikri 50% free',                              status: 'to do',       due: '1781816400000', start: '1780866000000' },
      { name: 'Weekly engineering report (metric snapshot)',                                                                             status: 'done',        due: '1781816400000', start: '1774818000000' },
      { name: 'Bi-weekly sync (Yoga, Zikri, Farhan, Aditya — block/risk review)',                                                       status: 'to do',       due: '1781816400000', start: '1776027600000' },
      { name: 'Monthly scorecard to CEO (Mulqan)',                                                                                       status: 'to do',       due: '1782766800000', start: '1777237200000' },
      { name: 'Sprint retro cycle',                                                                                                      status: 'done',        due: '1781816400000', start: '1774818000000' },
    ],
  },
  {
    name: 'Nexus',
    status: 'in progress',
    due_date: '1781816400000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Start JWT middleware — mount on setter routes (currently unauthenticated)',                                               status: 'done',        due: '1775768400000', start: '1774818000000' },
      { name: 'JWT mounted 60/60 routes protected; unauthenticated rejected; tests passing',                                            status: 'done',        due: '1776978000000', start: '1776027600000' },
      { name: 'Contract parity wave 1 — Account + Post endpoints match legacy v3',                                                      status: 'in progress', due: '1778187600000', start: '1777237200000' },
      { name: 'Kong cutover rehearsal in staging (rollback tested, routing config for Q3)',                                              status: 'to do',       due: '1779397200000', start: '1778446800000' },
      { name: 'Observability wired in prod cluster (Cloud SQL, Kong, Dragonfly, GKE → Grafana)',                                        status: 'to do',       due: '1780606800000', start: '1779656400000' },
      { name: 'Production-ready signoff (60/60 auth, parity, observability, Kong final, Farhan sign-off)',                              status: 'to do',       due: '1781816400000', start: '1780866000000' },
    ],
  },
  {
    name: 'QA Transformation',
    status: 'on hold',
    due_date: '1781816400000',
    start_date: '1776027600000',
    tasks: [
      { name: 'Helena baseline logging — track time split (strategic vs manual)',                                                        status: 'on hold', due: '1776978000000', start: '1776027600000' },
      { name: 'Helena scenario-first live: designs test scenarios before feature build; merge gate active',                              status: 'to do',   due: '1778187600000', start: '1777237200000' },
      { name: 'Scenario format iteration + AI test scaffold refinement (accuracy tracking begins)',                                      status: 'to do',   due: '1779397200000', start: '1778446800000' },
      { name: 'Helena ≥60% strategic time; AI test accuracy ≥70%; test maintenance <5 hrs/week',                                       status: 'to do',   due: '1780606800000', start: '1779656400000' },
      { name: 'Helena full scenario-architect mode confirmed in final scorecard',                                                        status: 'to do',   due: '1781816400000', start: '1780866000000' },
    ],
  },
  {
    name: 'Architecture Knowledge System',
    status: 'in progress',
    due_date: '1781816400000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Coding conventions v0 draft; ADR log started; first 3 ADRs committed',                                                   status: 'in review', due: '1776978000000', start: '1776027600000' },
      { name: 'Conventions v1 locked, merged, committed in AI-readable format; rules file fed to AI',                                   status: 'done',      due: '1776978000000', start: '1776027600000' },
      { name: 'Codebase docs bootstrap — 5 critical modules, AI-generated + engineer-reviewed',                                         status: 'done',      due: '1778187600000', start: '1776027600000' },
      { name: 'Continued ADR entries (target ≥8 total by Q2 end)',                                                                      status: 'to do',     due: '1781816400000', start: '1778446800000' },
    ],
  },
  {
    name: 'Pluto AWS→GCP',
    status: 'in progress',
    due_date: '1781816400000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Rotate plaintext credentials → Secret Manager; scrub git history',                                                       status: 'done',        due: '1775768400000', start: '1774818000000' },
      { name: 'AWS→GCP migration plan draft (high-level steps, maintenance window, rollback)',                                           status: 'in progress', due: '1776978000000', start: '1776027600000' },
      { name: 'Migration plan v1 finalized (~30 min maintenance window strategy + rollback) + Request for approval',                    status: 'to do',       due: '1778187600000', start: '1777237200000' },
      { name: 'Analyze result GCP; rollback strategy sign-off',                                                                         status: 'to do',       due: '1779397200000', start: '1778446800000' },
      { name: 'Maintenance window scheduled + final runbook; all teams briefed; rollback drills',                                       status: 'to do',       due: '1780606800000', start: '1779656400000' },
      { name: 'AWS→GCP migration executed (~30 min window); data validated; creds rotated',                                             status: 'to do',       due: '1781816400000', start: '1780866000000' },
    ],
  },
  {
    name: 'Twibbonize-Next',
    status: 'in progress',
    due_date: '1781816400000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Bootstrap Playwright + GitHub Actions; E2E test gate on PR pipeline, auth flow tests',                                   status: 'done',        due: '1776978000000', start: '1776027600000' },
      { name: 'Provider + Zustand + CUD POC landed (state management proven on 3–5 features)',                                          status: 'done',        due: '1776978000000', start: '1776027600000' },
      { name: 'Feature set frozen (marketing pages, dashboard, campaign creation scope locked)',                                         status: 'in review',   due: '1778187600000', start: '1777237200000' },
      { name: 'Canary-ready: auth + creation + mutations + ISR + comments all wired, feature-complete',                                 status: 'to do',       due: '1779397200000', start: '1778446800000' },
      { name: 'Canary rollout 10% → 50% on Cloudflare with monitoring',                                                                 status: 'to do',       due: '1780606800000', start: '1779656400000' },
      { name: '100% ready to production — ready to replace big-quantum-web, E2E green, zero incidents final 2 weeks',                   status: 'to do',       due: '1781816400000', start: '1780866000000' },
      { name: 'Feature Development',                                                                                                    status: 'to do',       due: '1781816400000', start: '1774818000000' },
    ],
  },
  {
    name: 'AI-First Engineering Transformation',
    status: 'in progress',
    due_date: '1781816400000',
    start_date: '1774818000000',
    tasks: [
      { name: 'AI coding assistant evaluation (Cursor vs Claude vs Copilot) — ADR output',                                              status: 'in review',   due: '1776978000000', start: '1774818000000' },
      { name: 'AI tool live with all 6 engineers + prompt library v1 (10+ prompts) + rules file',                                       status: 'done',        due: '1776978000000', start: '1776027600000' },
      { name: 'Full team AI-first sprint committed; codebase docs bootstrap (5 critical modules)',                                       status: 'done',        due: '1778187600000', start: '1777237200000' },
      { name: 'AI code review integrated into CI (GitHub Actions + Cloud Build hook for PRs)',                                          status: 'done',        due: '1779397200000', start: '1778446800000' },
      { name: 'AI test generation ≥70% accuracy; AI transformation scorecard Month 2',                                                  status: 'in review',   due: '1780606800000', start: '1779656400000' },
      { name: 'Final Q2 AI-first scorecard — metrics hit/missed, lessons learned',                                                      status: 'in progress', due: '1781816400000', start: '1780866000000' },
      { name: 'Standardized Open Spec for AI Development',                                                                              status: 'to do',       due: '1781816400000', start: '1776027600000' },
    ],
  },
  {
    name: 'CX Dashboard',
    status: 'in progress',
    due_date: '1780606800000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Audit partial dev work; identify blockers for Reports Dashboard',                                                         status: 'done',  due: '1775768400000', start: '1774818000000' },
      { name: 'Reports Dashboard v1 live — CX team (Nicky + Runi) access /admin/reports',                                              status: 'to do', due: '1779397200000', start: '1778446800000' },
      { name: 'Continued refinement for CX self-serve report triage',                                                                   status: 'to do', due: '1780606800000', start: '1779656400000' },
    ],
  },
  {
    name: 'Company Dashboard - Skyline',
    status: 'in progress',
    due_date: '1780606800000',
    start_date: '1774818000000',
    tasks: [
      { name: 'Inventory existing partial development; identify blockers',                                                               status: 'done',  due: '1775768400000', start: '1774818000000' },
      { name: 'Cost dashboard wired to real GCP billing; cost trends visible',                                                          status: 'to do', due: '1779397200000', start: '1778446800000' },
      { name: 'Continue building toward 3–5 of 6 dashboards on real data',                                                             status: 'to do', due: '1780606800000', start: '1779656400000' },
    ],
  },
  {
    name: 'Design-to-Code Pipeline',
    status: 'on hold',
    due_date: null,                  // no due date — handled by tsToISO returning null
    start_date: '1774818000000',
    tasks: [
      { name: 'Measure S1 baseline (component: Figma to merge time pre-library)',                                                       status: 'to do', due: '1776978000000', start: '1774818000000' },
      { name: 'Aditya owns FE architecture brief sign-off',                                                                             status: 'to do', due: '1776978000000', start: '1776027600000' },
      { name: "Leaf library build begins (depends on Dika's design tokens by May 12)",                                                  status: 'to do', due: '1779397200000', start: '1778446800000' },
      { name: 'Leaf library expansion + S5 re-measurement vs S1 baseline (target ≥30% faster)',                                        status: 'to do', due: '1780606800000', start: '1779656400000' },
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

  // 2. Get Zikri's user_id
  const { data: profile, error: profErr } = await (supabase as any)
    .from('profiles')
    .select('id, display_name, email')
    .eq('email', ZIKRI_EMAIL)
    .single()

  if (profErr) { console.error('❌ Cannot get Zikri profile:', profErr.message); process.exit(1) }
  const userId: string = profile.id
  const userName: string = profile.display_name || 'Zikri'
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
    // Design-to-Code Pipeline has no due_date — default quarter to Q2 2026
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
        field:           'Engineering',
        department:      'Engineering',
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

import type { DiscoveryCallStage } from '@/lib/supabase/types'

export const STAGES: {
  key: DiscoveryCallStage
  label: string
  color: string
  dot: string
}[] = [
  { key: 'replied',           label: 'Replied Email/Whatsapp', color: '#8D8D8D', dot: 'bg-foreground-muted' },
  { key: 'waiting_reschedule',label: 'Waiting Reschedule',     color: '#F59E0B', dot: 'bg-amber-400' },
  { key: 'scheduled',         label: 'Scheduled',              color: '#16DAC1', dot: 'bg-primary' },
  { key: 'waiting_result',    label: 'Waiting Result',         color: '#16DAC1', dot: 'bg-primary' },
  { key: 'finished',          label: 'Finished',               color: '#EF4444', dot: 'bg-red-500' },
  { key: 'skipped',           label: 'Skipped',                color: '#8D8D8D', dot: 'bg-foreground-muted' },
]

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<DiscoveryCallStage, typeof STAGES[0]>

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
}

export const SURVEY_STATUS_LABELS: Record<string, string> = {
  not_sent: 'Not sent',
  sent_pending: 'Sent · pending',
  completed: 'Completed',
  skipped: 'Skipped',
}

export const RESULT_LABELS: Record<string, string> = {
  pending: 'Pending',
  qualified: 'Qualified',
  nurture: 'Nurture',
  not_qualified: 'Not qualified',
}

export const RESCHEDULE_REASON_LABELS: Record<string, string> = {
  no_show: 'No-show',
  postponed_by_us: 'Postponed by us',
  postponed_by_them: 'Postponed by them',
  other: 'Other',
}

export const SKIP_REASON_OPTIONS = [
  { value: 'ghosted',      label: 'Ghosted',       description: 'No response after 2+ follow-ups' },
  { value: 'declined',     label: 'Declined',      description: 'Explicitly said no to the interview' },
  { value: 'out_of_scope', label: 'Out of scope',  description: 'Wrong audience or use case for Twibbonize' },
  { value: 'duplicate',    label: 'Duplicate',     description: 'Same prospect already in pipeline under another card' },
  { value: 'other',        label: 'Other',         description: '' },
]

export const SKIP_REASON_LABELS: Record<string, string> = {
  ghosted:      'Ghosted',
  declined:     'Declined',
  out_of_scope: 'Out of scope',
  duplicate:    'Duplicate',
  other:        'Other',
}

export const NEXT_ACTION_OPTIONS = [
  { value: 'to_partnership', label: '→ Send to Partnership', description: 'Hand off to Partnership pipeline. They\'ll be notified.' },
  { value: 'nurture_90d',    label: 'Nurture · re-check in 90 days', description: 'Reminder created for 90 days from now.' },
  { value: 'archive',        label: 'Archive only', description: 'Close the card with no follow-up.' },
]

export const NEXT_ACTION_LABELS: Record<string, string> = {
  to_partnership: '→ Partnership',
  nurture_90d:    'Nurture · 90d',
  archive:        'Archive',
}

// Stale thresholds in days
export const STALE_THRESHOLDS: Partial<Record<DiscoveryCallStage, number>> = {
  replied: 3,
  waiting_reschedule: 5,
  waiting_result: 7,
}

export function isStale(stage: DiscoveryCallStage, lastStageChangedAt: string, interviewDate?: string | null): boolean {
  if (stage === 'finished' || stage === 'skipped') return false
  if (stage === 'scheduled') {
    if (!interviewDate) return false
    return new Date(interviewDate) < new Date()
  }
  const threshold = STALE_THRESHOLDS[stage]
  if (!threshold) return false
  const days = (Date.now() - new Date(lastStageChangedAt).getTime()) / (1000 * 60 * 60 * 24)
  return days > threshold
}

export function staleDays(lastStageChangedAt: string): number {
  return Math.floor((Date.now() - new Date(lastStageChangedAt).getTime()) / (1000 * 60 * 60 * 24))
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

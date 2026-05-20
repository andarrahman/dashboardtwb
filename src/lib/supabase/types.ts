// ─── Hand-written DB types matching migrations ────────────────────────────────
// Run `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`
// to regenerate automatically after schema changes.

export type ContactType = 'twibbonize' | 'external'
export type AccountTier = 'free' | 'premium_creator' | 'premium_supporter'
export type WorkspaceRole = 'admin' | 'pm' | 'sdr' | 'mkt' | 'cs' | 'viewer'

// ─── Discovery Call enums ──────────────────────────────────────────────────────
export type DiscoveryCallStage =
  | 'replied'
  | 'waiting_reschedule'
  | 'scheduled'
  | 'waiting_result'
  | 'finished'
  | 'skipped'

export type DiscoveryCallLeadSource = 'email' | 'whatsapp' | 'linkedin' | 'instagram'
export type DiscoveryCallSurveyStatus = 'not_sent' | 'sent_pending' | 'completed' | 'skipped'
export type DiscoveryCallResult = 'pending' | 'qualified' | 'nurture' | 'not_qualified'
export type DiscoveryCallNextAction = 'to_partnership' | 'nurture_90d' | 'archive' | 'none'
export type DiscoveryCallSkipReason = 'ghosted' | 'declined' | 'out_of_scope' | 'duplicate' | 'other'
export type DiscoveryCallRescheduleReason = 'no_show' | 'postponed_by_us' | 'postponed_by_them' | 'other'

// ─── Discovery Call row types ─────────────────────────────────────────────────
export interface DiscoveryCallRow {
  id: string
  workspace_id: string
  contact_id: string
  stage: DiscoveryCallStage
  owner_id: string
  lead_source: DiscoveryCallLeadSource
  replied_at: string
  interview_date: string | null
  interview_time: string | null
  interview_timezone: string | null
  interview_meeting_url: string | null
  reschedule_count: number
  reschedule_reason: DiscoveryCallRescheduleReason | null
  reschedule_note: string | null
  survey_status: DiscoveryCallSurveyStatus
  survey_sent_at: string | null
  survey_completed_at: string | null
  survey_response_id: string | null
  result: DiscoveryCallResult
  result_decided_at: string | null
  result_decided_by: string | null
  next_action: DiscoveryCallNextAction
  skip_reason: DiscoveryCallSkipReason | null
  skip_note: string | null
  notes: string | null
  last_stage_change_at: string
  last_activity_at: string
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string | null
  deleted_at: string | null
  // Joined from contacts
  contact?: import('./types').ContactRow
  // Joined from profiles
  owner?: { id: string; display_name: string | null; email: string | null }
}

export interface DiscoveryCallStageHistoryRow {
  id: string
  discovery_call_id: string
  from_stage: DiscoveryCallStage | null
  to_stage: DiscoveryCallStage
  changed_by: string
  changed_at: string
  reason: string | null
}

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['workspaces']['Insert']>
      }

      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }

      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: WorkspaceRole
          created_at: string
        }
        Insert: {
          workspace_id: string
          user_id: string
          role?: WorkspaceRole
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['workspace_members']['Insert']>
      }

      contacts: {
        Row: {
          id: string
          workspace_id: string
          type: ContactType

          // Common
          name: string
          email: string | null
          whatsapp_number: string | null
          instagram_handle: string | null
          website_url: string | null

          // Twibbonize-synced
          twibbonize_user_id: string | null
          profile_url: string | null
          account_tier: AccountTier | null
          country: string | null
          account_created_at: string | null
          first_campaign_at: string | null
          latest_campaign_at: string | null
          total_campaigns: number | null
          total_supporters: number | null
          top_supporter_countries: string[] | null
          last_synced_at: string | null

          // External-only
          company: string | null
          business_category: string | null

          // CRM-managed
          summary_profile: string | null
          segment: string | null
          use_case_category: string | null

          // Custom fields
          custom_fields: Record<string, unknown>

          // Provenance
          created_by: string | null

          // Audit
          created_at: string
          updated_at: string
          deleted_at: string | null
          deleted_by: string | null

          // FTS (read-only, generated)
          search?: unknown
        }
        Insert: {
          id?: string
          workspace_id: string
          type: ContactType
          name: string
          email?: string | null
          whatsapp_number?: string | null
          instagram_handle?: string | null
          website_url?: string | null
          twibbonize_user_id?: string | null
          profile_url?: string | null
          account_tier?: AccountTier | null
          country?: string | null
          account_created_at?: string | null
          first_campaign_at?: string | null
          latest_campaign_at?: string | null
          total_campaigns?: number | null
          total_supporters?: number | null
          top_supporter_countries?: string[] | null
          last_synced_at?: string | null
          company?: string | null
          business_category?: string | null
          summary_profile?: string | null
          segment?: string | null
          use_case_category?: string | null
          custom_fields?: Record<string, unknown>
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
      }
    }

    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      contact_type: ContactType
      account_tier: AccountTier  // 'free' | 'premium_creator' | 'premium_supporter'
      workspace_role: WorkspaceRole
    }
  }
}

// ─── Convenience row types ─────────────────────────────────────────────────────
export type WorkspaceRow = Database['public']['Tables']['workspaces']['Row']
export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type WorkspaceMemberRow = Database['public']['Tables']['workspace_members']['Row']
export type ContactRow = Database['public']['Tables']['contacts']['Row']

// ─── Contact email log (from checkdailyemail.py + CRM outbound) ──────────────
export interface ContactEmailLogRow {
  id: string
  contact_id: string
  workspace_id: string
  from_email: string
  from_name: string | null
  to_email: string | null
  subject: string | null
  received_at: string
  direction: 'inbound' | 'outbound'
  body_preview: string | null
  body_html: string | null
  attachments: EmailAttachment[] | null
  thread_id: string | null
  is_read: boolean
  created_at: string
  // Joined
  contact?: ContactRow | null
}

// ─── Unified email list item (merges threads + log entries) ──────────────────
export interface UnifiedEmailRow {
  id: string
  source: 'thread' | 'log'
  workspace_id: string
  contact_id: string | null
  contact?: ContactRow | null
  subject: string
  body_preview: string | null
  direction: 'inbound' | 'outbound'
  status: 'draft' | 'sent' | 'scheduled' | 'replied'
  from_email: string | null
  to_email: string | null
  owner_id: string | null
  owner?: { id: string; display_name: string | null; email: string | null } | null
  is_stale: boolean
  stale_since_days: number | null
  scheduled_at: string | null
  last_message_at: string | null
  message_count: number
  // Original row for actions
  thread?: EmailThreadRow
  log?: ContactEmailLogRow
}

// ─── Email enums ──────────────────────────────────────────────────────────────
export type EmailStatus = 'draft' | 'sent' | 'scheduled' | 'replied'
export type EmailDirection = 'outbound' | 'inbound'

// ─── Email attachment ─────────────────────────────────────────────────────────
export interface EmailAttachment {
  name: string
  size: number   // bytes
  mime_type: string
  url?: string
  /** Base64-encoded file content — present only when sending (not stored in DB) */
  content?: string
}

// ─── Email thread (one conversation with one contact) ─────────────────────────
export interface EmailThreadRow {
  id: string
  workspace_id: string
  contact_id: string | null
  owner_id: string | null
  subject: string
  status: EmailStatus
  last_message_at: string | null
  message_count: number
  is_stale: boolean
  stale_since_days: number | null
  scheduled_at: string | null
  ai_generated: boolean
  ai_tone: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  /** Whether the thread has been read by the user (default true for sent, false for inbound replies) */
  is_read?: boolean
  // Joined
  contact?: ContactRow | null
  owner?: { id: string; display_name: string | null; email: string | null } | null
  messages?: EmailMessageRow[]
}

// ─── Email message (single send/reply within a thread) ────────────────────────
export interface EmailMessageRow {
  id: string
  thread_id: string
  workspace_id: string
  direction: EmailDirection
  from_email: string | null
  to_email: string | null
  cc_emails: string[]
  bcc_emails: string[]
  body: string | null
  body_html: string | null
  attachments: EmailAttachment[]
  sent_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ─── CRM Lists ─────────────────────────────────────────────────────────────────
export interface CrmListRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  folder: string | null
  owner_id: string | null
  owner_name: string | null
  contact_count: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
}

export interface CrmListContactRow {
  id: string
  list_id: string
  contact_id: string
  workspace_id: string
  added_at: string
  added_by: string | null
  added_by_name: string | null
  contact?: ContactRow
}

// ─── Marketing Templates ───────────────────────────────────────────────────────

export type TemplateStatus = 'draft' | 'published' | 'archived'
export type TemplateCategory =
  | 'newsletter'
  | 'promo'
  | 'onboarding'
  | 'reactivation'
  | 'transactional'

export type BlockType = 'heading' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'social' | 'html' | 'columns' | 'unsubscribe'

export interface ColumnItem {
  type: 'text' | 'image' | 'button' | 'heading'
  headingText?: string
  headingTag?: 'h1' | 'h2' | 'h3'
  textContent?: string
  imageUrl?: string
  imageAlt?: string
  imageLink?: string
  buttonLabel?: string
  buttonUrl?: string
  buttonBgColor?: string
  buttonTextColor?: string
  fontSize?: number
  color?: string
  alignment?: 'left' | 'center' | 'right'
}

export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'twitter' | 'tiktok'

export interface SocialLink {
  platform: SocialPlatform
  url: string
  enabled: boolean
}

export interface EmailBlock {
  id: string
  type: BlockType
  // Heading
  headingTag?: 'h1' | 'h2' | 'h3'
  headingText?: string
  // Text
  textContent?: string
  // Image
  imageUrl?: string
  imageAlt?: string
  imageLink?: string
  imageWidth?: number // percent
  // Button
  buttonLabel?: string
  buttonUrl?: string
  buttonBgColor?: string
  buttonTextColor?: string
  buttonRadius?: number
  // Divider
  dividerColor?: string
  dividerThickness?: number
  // Common
  fontSize?: number
  color?: string
  alignment?: 'left' | 'center' | 'right'
  paddingTop?: number
  paddingBottom?: number
  paddingLeft?: number
  paddingRight?: number
  // Spacer
  spacerHeight?: number
  // Social
  socialLinks?: SocialLink[]
  socialIconSize?: number
  socialIconColor?: string
  socialIconBgColor?: string
  socialIconRadius?: number
  // HTML
  htmlContent?: string
  // Columns
  columnCount?: 2 | 3
  columnItems?: ColumnItem[]
  columnGap?: number
  // Visibility
  hideOnMobile?: boolean
  hideOnDesktop?: boolean
  // Block background
  bgColor?: string
  // Block background image (behind content)
  bgImage?: string
  bgImageOverlay?: number // 0-1, dark overlay opacity
  // Columns stacks
  columnStacks?: ColumnItem[][] // [column0items[], column1items[], ...]
}

export interface MarketingTemplateRow {
  id: string
  workspace_id: string
  name: string
  subject_line: string | null
  preview_text: string | null
  category: TemplateCategory | null
  folder: string | null
  status: TemplateStatus
  blocks: EmailBlock[]
  html_content: string | null
  bg_color: string | null
  font_family: string | null
  body_bg_color: string | null
  email_width: number | null
  version: number
  is_shared: boolean
  owner_id: string | null
  owner_name: string | null
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  times_used: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  archived_at: string | null
}

export interface SavedBlockRow {
  id: string
  workspace_id: string
  name: string
  block: EmailBlock
  created_at: string
  created_by: string | null
  created_by_name: string | null
}

// ─── Email Automation types ────────────────────────────────────────────────────

export type AutomationStatus = 'draft' | 'active' | 'paused' | 'archived'
export type AutomationTriggerType = 'list_subscription' | 'form_submitted' | 'date_time' | 'contact_inactive' | 'custom_event' | 'twibbonize_campaign'
export type AutomationStepType = 'send_email' | 'wait_delay' | 'if_else' | 'tag_contact' | 'move_to_list' | 'end_workflow'
export type AutomationEventType = 'enrolled' | 'email_sent' | 'opened' | 'clicked' | 'exited' | 'error' | 'workflow_edit' | 'paused' | 'resumed' | 'published'

export interface AutomationStep {
  id: string
  type: AutomationStepType
  name: string
  // send_email
  template_id?: string
  template_name?: string
  subject_line?: string
  preview_text?: string
  from_name?: string
  from_email?: string
  send_window_weekdays_only?: boolean
  send_window_start?: string
  send_window_end?: string
  goal?: string
  // wait_delay
  delay_days?: number
  delay_hours?: number
  // tag_contact
  tag?: string
  // move_to_list
  list_id?: string
  list_name?: string
  // if_else specific
  condition_field?: string   // e.g. 'opened_email', 'clicked_link', 'country', 'tag'
  condition_operator?: string // e.g. 'is', 'is_not', 'contains'
  condition_value?: string
  yes_label?: string
  no_label?: string
  yes_steps?: AutomationStep[]  // steps in the YES branch
  no_steps?: AutomationStep[]   // steps in the NO branch
}

export interface AutomationTriggerConfig {
  list_id?: string
  list_name?: string
  list_contact_count?: number
  enroll_existing?: boolean
  re_enroll?: 'never' | 'once_per_90d' | 'always'
  filters?: Array<{ field: string; operator: string; value: string }>
  scheduled_at?: string
  inactive_days?: number
  form_id?: string
  event_name?: string
}

export interface EmailAutomationRow {
  id: string
  workspace_id: string
  name: string
  status: AutomationStatus
  trigger_type: AutomationTriggerType | null
  trigger_config: AutomationTriggerConfig
  steps: AutomationStep[]
  goal: string | null
  total_enrolled: number
  total_completed: number
  avg_open_rate: number | null
  avg_click_rate: number | null
  owner_id: string | null
  owner_name: string | null
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  published_at: string | null
  paused_at: string | null
  scheduled_publish_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AutomationEnrollmentRow {
  id: string
  automation_id: string
  workspace_id: string
  contact_id: string
  current_step_index: number
  current_step_name: string | null
  next_action_at: string | null
  next_step_name: string | null
  status: 'active' | 'completed' | 'exited' | 'error'
  exit_reason: string | null
  enrolled_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
  // joined
  contact?: ContactRow
}

export interface AutomationLogRow {
  id: string
  automation_id: string
  workspace_id: string
  contact_id: string | null
  event_type: AutomationEventType
  event_label: string
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
  // joined
  contact?: ContactRow | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Management types
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectStatus = 'backlog' | 'in_progress' | 'review' | 'done' | 'archived'
export type ProjectTaskStatus = 'backlog' | 'planning' | 'in_progress' | 'review' | 'done'
export type WeeklyUpdateStatus = 'on_track' | 'ongoing' | 'behind'

export interface ProjectAssignee {
  id: string
  name: string
  avatar_url: string | null
}

export interface ProjectRow {
  id: string
  workspace_id: string
  project_code: string
  title: string
  field: string | null
  department: string | null
  owner_id: string | null
  owner_name: string | null
  assignee_ids: string[]
  assignees: ProjectAssignee[]
  status: ProjectStatus
  sprint: string | null
  quarter: string | null
  start_date: string | null
  due_date: string | null
  progress: number
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Optional join
  task_count?: number
}

export interface ProjectTaskRow {
  id: string
  project_id: string
  workspace_id: string
  title: string
  status: ProjectTaskStatus
  assignee_id: string | null
  assignee_name: string | null
  assignee_avatar_url: string | null
  start_date: string | null
  due_date: string | null
  sort_order: number
  parent_task_id: string | null
  priority: string | null
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface TaskComment {
  id: string
  task_id: string
  project_id: string
  workspace_id: string
  author_id: string | null
  author_name: string
  body: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ProjectComment {
  id: string
  project_id: string
  workspace_id: string
  author_id: string | null
  author_name: string
  body: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ProjectWeeklyUpdateRow {
  id: string
  project_id: string
  workspace_id: string
  week_start: string
  week_end: string
  status: WeeklyUpdateStatus
  result: string
  concern: string | null
  plus: string | null
  minus: string | null
  submitted_by: string | null
  submitted_by_name: string | null
  submitted_at: string | null
  is_draft: boolean
  edit_window_closes_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

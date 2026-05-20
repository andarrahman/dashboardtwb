export interface AutomationTemplate {
  id: string
  name: string
  description: string
  icon: string
  trigger_type: string
  steps: object[]
  goal: string
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'welcome_series',
    name: 'Welcome Series',
    description: 'Greet new subscribers with a 3-email welcome sequence',
    icon: '👋',
    trigger_type: 'list_subscription',
    goal: 'Onboard new subscribers',
    steps: [
      { id: '1', type: 'send_email', name: 'Welcome Email', subject_line: 'Welcome to {{company_name}}!', delay_days: 0, delay_hours: 0 },
      { id: '2', type: 'wait_delay', name: 'Wait 2 days', delay_days: 2, delay_hours: 0 },
      { id: '3', type: 'send_email', name: 'Getting Started', subject_line: 'Getting started with {{company_name}}', delay_days: 0, delay_hours: 0 },
      { id: '4', type: 'wait_delay', name: 'Wait 3 days', delay_days: 3, delay_hours: 0 },
      { id: '5', type: 'send_email', name: 'Tips & Tricks', subject_line: '5 tips to get the most out of {{company_name}}', delay_days: 0, delay_hours: 0 },
    ],
  },
  {
    id: 'reengagement',
    name: 'Re-engagement',
    description: 'Win back inactive contacts with a targeted campaign',
    icon: '🔄',
    trigger_type: 'contact_inactive',
    goal: 'Re-engage inactive contacts',
    steps: [
      { id: '1', type: 'send_email', name: 'We Miss You', subject_line: 'We miss you, {{first_name}}!', delay_days: 0, delay_hours: 0 },
      { id: '2', type: 'wait_delay', name: 'Wait 5 days', delay_days: 5, delay_hours: 0 },
      { id: '3', type: 'send_email', name: 'Last Chance', subject_line: 'Last chance to reconnect', delay_days: 0, delay_hours: 0 },
      { id: '4', type: 'wait_delay', name: 'Wait 7 days', delay_days: 7, delay_hours: 0 },
      { id: '5', type: 'end_workflow', name: 'End', delay_days: 0, delay_hours: 0 },
    ],
  },
  {
    id: 'event_followup',
    name: 'Event Follow-up',
    description: 'Nurture contacts after a form submission or event',
    icon: '📅',
    trigger_type: 'form_submitted',
    goal: 'Convert event attendees',
    steps: [
      { id: '1', type: 'send_email', name: 'Thank You', subject_line: 'Thanks for joining us!', delay_days: 0, delay_hours: 1 },
      { id: '2', type: 'wait_delay', name: 'Wait 1 day', delay_days: 1, delay_hours: 0 },
      { id: '3', type: 'send_email', name: 'Resources', subject_line: 'Your event resources are ready', delay_days: 0, delay_hours: 0 },
      { id: '4', type: 'wait_delay', name: 'Wait 3 days', delay_days: 3, delay_hours: 0 },
      { id: '6', type: 'send_email', name: 'Next Steps', subject_line: "What's next for you?", delay_days: 0, delay_hours: 0 },
    ],
  },
]

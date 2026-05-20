"use client"
import * as React from "react"
import { useWorkspace } from "@/lib/hooks/use-workspace"
import { useToast } from "@/components/ui/toast"
import { createClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"
import {
  RiMailSettingsLine,
  RiShieldKeyholeLine,
  RiSave3Line,
  RiCheckLine,
  RiLoaderLine,
  RiBarChartLine,
  RiMailForbidLine,
  RiMailCheckLine,
  RiAlertLine,
  RiCursorLine,
  RiTeamLine,
  RiAddLine,
  RiDeleteBinLine,
  RiPencilLine,
  RiUserLine,
} from "@remixicon/react"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface EmailSettings {
  from_name: string
  from_email: string
  reply_to: string
  resend_api_key: string
  resend_webhook_secret: string
}

interface DeliverabilityLog {
  id: string
  email: string
  event_type: string
  subject: string | null
  created_at: string
}

type UserType = "admin" | "head" | "staff"

interface UserRow {
  id: string
  user_id: string
  email: string | null
  display_name: string | null
  user_type: UserType
  features: string[]
  created_at: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

type TabKey = "email" | "deliverability" | "users"

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "email",          label: "Email Settings",  icon: <RiMailSettingsLine size={15} /> },
  { key: "deliverability", label: "Deliverability",  icon: <RiBarChartLine size={15} /> },
  { key: "users",          label: "User Access",     icon: <RiTeamLine size={15} /> },
]

const USER_TYPE_CONFIG: Record<UserType, { label: string; bg: string; color: string; dot: string }> = {
  admin: { label: "Admin", bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1" },
  head:  { label: "Head",  bg: "#E6FAF8", color: "#0D9488", dot: "#14C4AE" },
  staff: { label: "Staff", bg: "#F1F5F9", color: "#475569", dot: "#94A3B8" },
}

const ALL_FEATURES = ['crm', 'outreach', 'marketing', 'projects', 'partnership', 'report'] as const
type Feature = typeof ALL_FEATURES[number]

const FEATURE_CONFIG: Record<Feature, { label: string; icon: string }> = {
  crm:         { label: 'CRM',              icon: '👥' },
  outreach:    { label: 'Outreach Creator', icon: '✉️' },
  marketing:   { label: 'Marketing',        icon: '📣' },
  projects:    { label: 'Projects',         icon: '📋' },
  partnership: { label: 'Partnership',      icon: '🤝' },
  report:      { label: 'Report',           icon: '📊' },
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FeatureCheckboxes({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (f: string[]) => void
  disabled?: boolean
}) {
  function toggle(feat: string) {
    if (disabled) return
    if (value.includes(feat)) {
      onChange(value.filter((f) => f !== feat))
    } else {
      onChange([...value, feat])
    }
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 12px",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {ALL_FEATURES.map((feat) => {
          const cfg = FEATURE_CONFIG[feat]
          const checked = disabled ? true : value.includes(feat)
          return (
            <label
              key={feat}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: disabled ? "default" : "pointer",
                userSelect: "none",
              }}
            >
              <span
                onClick={() => toggle(feat)}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: checked ? "none" : "1.5px solid #E5EAEC",
                  background: checked ? "#14C4AE" : "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.12s, border 0.12s",
                }}
              >
                {checked && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span style={{ fontSize: 12, color: "var(--color-foreground, #0F1828)", fontWeight: 500 }}>
                {cfg.icon} {cfg.label}
              </span>
            </label>
          )
        })}
      </div>
      {disabled && (
        <p style={{ fontSize: 11, color: "var(--color-foreground-muted, #7A8A93)", marginTop: 8 }}>
          Admins have access to all features
        </p>
      )}
    </div>
  )
}

function FeatureBadges({ features }: { features: string[] }) {
  if (!features || features.length === 0) {
    return <span style={{ fontSize: 11, color: "var(--color-foreground-muted, #7A8A93)" }}>—</span>
  }
  const badgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    background: "#E6FAF8",
    color: "#0D9488",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
    paddingBlock: 2,
    paddingInline: 8,
    fontFamily: '"Manrope", system-ui, sans-serif',
    whiteSpace: "nowrap",
  }
  if (features.length === ALL_FEATURES.length) {
    return <span style={badgeStyle}>All features</span>
  }
  const shown = features.slice(0, 3)
  const rest = features.length - shown.length
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {shown.map((f) => (
        <span key={f} style={badgeStyle}>
          {FEATURE_CONFIG[f as Feature]?.label ?? f}
        </span>
      ))}
      {rest > 0 && (
        <span style={{ ...badgeStyle, background: "#F1F5F9", color: "#475569" }}>+{rest} more</span>
      )}
    </div>
  )
}

function EventBadge({ type }: { type: string }) {
  const variants: Record<string, string> = {
    delivered:  "bg-green-100 text-green-700",
    bounced:    "bg-red-100 text-red-700",
    complained: "bg-orange-100 text-orange-700",
    opened:     "bg-sky-100 text-sky-700",
    clicked:    "bg-purple-100 text-purple-700",
  }
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", variants[type] ?? "bg-gray-100 text-gray-700")}>
      {type}
    </span>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={cn("rounded-lg border border-border p-4", color)}>
      <div className="flex items-center justify-between mb-2">{icon}</div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-foreground-muted mt-0.5">{label}</p>
    </div>
  )
}

function UserTypeBadge({ type }: { type: UserType }) {
  const cfg = USER_TYPE_CONFIG[type] ?? USER_TYPE_CONFIG.staff
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: cfg.bg,
        borderRadius: 999,
        paddingBlock: 3,
        paddingInline: 9,
        fontSize: 11,
        fontWeight: 700,
        color: cfg.color,
        fontFamily: '"Manrope", system-ui, sans-serif',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

function UserTypeChips({
  value,
  onChange,
}: {
  value: UserType
  onChange: (t: UserType) => void
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {(["admin", "head", "staff"] as UserType[]).map((t) => {
        const cfg = USER_TYPE_CONFIG[t]
        const isActive = value === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            style={{
              flex: 1,
              paddingBlock: 8,
              borderRadius: 999,
              border: isActive ? `1.5px solid ${cfg.dot}` : "1.5px solid #E5EAEC",
              background: isActive ? cfg.bg : "#fff",
              color: isActive ? cfg.color : "#7A8A93",
              fontWeight: isActive ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.12s",
              fontFamily: '"Manrope", system-ui, sans-serif',
            }}
          >
            {cfg.label}
          </button>
        )
      })}
    </div>
  )
}

function getAvatarColor(name: string): string {
  const colors = [
    "#6366F1", "#0D9488", "#F59E0B", "#EF4444",
    "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function UserAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
  const bg = getAvatarColor(name)
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: "#fff",
        fontSize: size * 0.375,
        fontWeight: 700,
        flexShrink: 0,
        fontFamily: '"Manrope", system-ui, sans-serif',
        letterSpacing: "0.02em",
      }}
    >
      {initials || "?"}
    </span>
  )
}

// ─── Modal: Add User ────────────────────────────────────────────────────────────

function AddUserModal({
  open,
  onClose,
  workspaceId,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  workspaceId: string
  onAdded: () => void
}) {
  const { showToast } = useToast()
  const [form, setForm] = React.useState({ name: "", email: "", password: "", user_type: "staff" as UserType })
  const [features, setFeatures] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setForm({ name: "", email: "", password: "", user_type: "staff" })
      setFeatures([])
    }
  }, [open])

  // Auto-set features when user_type changes
  React.useEffect(() => {
    if (form.user_type === "admin") {
      setFeatures([...ALL_FEATURES])
    } else {
      setFeatures([])
    }
  }, [form.user_type])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password) return
    setSaving(true)
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, ...form, display_name: form.name, features }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast({ title: "Error", subtitle: data.error ?? "Could not add user." })
      } else {
        showToast({ title: "User added", subtitle: `${form.email} has been added to the workspace.` })
        onAdded()
        onClose()
      }
    } catch {
      showToast({ title: "Error", subtitle: "An unexpected error occurred." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.30)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ width: "100%", maxWidth: 480, borderRadius: 20, background: "var(--color-background, #fff)", boxShadow: "0 25px 60px rgba(0,0,0,0.18)", overflow: "hidden", fontFamily: '"Manrope", system-ui, sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid var(--color-border, #E8ECEF)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, background: "#EEF2FF" }}>
              <RiAddLine size={16} style={{ color: "#6366F1" }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "var(--color-foreground, #0F1828)", margin: 0 }}>Add User</p>
              <p style={{ fontSize: 12, color: "var(--color-foreground-muted, #7A8A93)", margin: 0 }}>Create a new workspace member</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-foreground-muted, #7A8A93)", marginBottom: 6 }}>Full name</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. John Doe"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-10 w-full rounded-full border border-border px-4 text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-colors bg-background"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-foreground-muted, #7A8A93)", marginBottom: 6 }}>Email address</label>
              <input
                type="email"
                required
                placeholder="user@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="h-10 w-full rounded-full border border-border px-4 text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-colors bg-background"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-foreground-muted, #7A8A93)", marginBottom: 6 }}>Password</label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="h-10 w-full rounded-full border border-border px-4 text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-colors bg-background"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-foreground-muted, #7A8A93)", marginBottom: 8 }}>User type</label>
              <UserTypeChips value={form.user_type} onChange={(t) => setForm((f) => ({ ...f, user_type: t }))} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-foreground-muted, #7A8A93)", marginBottom: 8 }}>Feature Access</label>
              <FeatureCheckboxes
                value={features}
                onChange={setFeatures}
                disabled={form.user_type === "admin"}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 24px 20px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ height: 36, paddingInline: 16, borderRadius: 999, border: "1.5px solid var(--color-border, #E8ECEF)", background: "transparent", fontSize: 13, fontWeight: 600, color: "var(--color-foreground-muted, #7A8A93)", cursor: "pointer", fontFamily: '"Manrope", system-ui, sans-serif' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ height: 36, paddingInline: 20, borderRadius: 999, background: "var(--color-primary, #6366F1)", border: "none", fontSize: 13, fontWeight: 700, color: "#fff", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: '"Manrope", system-ui, sans-serif' }}
            >
              {saving && <RiLoaderLine size={14} style={{ animation: "spin 1s linear infinite" }} />}
              {saving ? "Adding…" : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Edit Role ───────────────────────────────────────────────────────────

function EditRoleModal({
  user,
  onClose,
  workspaceId,
  onSaved,
}: {
  user: UserRow | null
  onClose: () => void
  workspaceId: string
  onSaved: () => void
}) {
  const { showToast } = useToast()
  const [userType, setUserType] = React.useState<UserType>("staff")
  const [features, setFeatures] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (user) {
      setUserType(user.user_type)
      setFeatures(user.features ?? [])
    }
  }, [user])

  // Auto-set features when userType changes
  React.useEffect(() => {
    if (userType === "admin") {
      setFeatures([...ALL_FEATURES])
    }
    // When switching away from admin, keep current selection (user can adjust)
  }, [userType])

  if (!user) return null

  async function handleSave() {
    if (!user) return
    setSaving(true)
    try {
      const res = await fetch(`/api/settings/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, user_type: userType, features }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast({ title: "Error", subtitle: data.error ?? "Could not update role." })
      } else {
        showToast({ title: "Role updated", subtitle: `${user.email ?? user.display_name} is now ${USER_TYPE_CONFIG[userType].label}.` })
        onSaved()
        onClose()
      }
    } catch {
      showToast({ title: "Error", subtitle: "An unexpected error occurred." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.30)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ width: "100%", maxWidth: 440, borderRadius: 20, background: "var(--color-background, #fff)", boxShadow: "0 25px 60px rgba(0,0,0,0.18)", overflow: "hidden", fontFamily: '"Manrope", system-ui, sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid var(--color-border, #E8ECEF)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, background: "#E6FAF8" }}>
              <RiPencilLine size={16} style={{ color: "#0D9488" }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "var(--color-foreground, #0F1828)", margin: 0 }}>Edit Role</p>
              <p style={{ fontSize: 12, color: "var(--color-foreground-muted, #7A8A93)", margin: 0, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email ?? user.display_name ?? user.user_id}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-foreground-muted, #7A8A93)", marginBottom: 8 }}>User type</label>
            <UserTypeChips value={userType} onChange={setUserType} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-foreground-muted, #7A8A93)", marginBottom: 8 }}>Feature Access</label>
            <FeatureCheckboxes
              value={features}
              onChange={setFeatures}
              disabled={userType === "admin"}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "4px 24px 20px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ height: 36, paddingInline: 16, borderRadius: 999, border: "1.5px solid var(--color-border, #E8ECEF)", background: "transparent", fontSize: 13, fontWeight: 600, color: "var(--color-foreground-muted, #7A8A93)", cursor: "pointer", fontFamily: '"Manrope", system-ui, sans-serif' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            style={{ height: 36, paddingInline: 20, borderRadius: 999, background: "var(--color-primary, #6366F1)", border: "none", fontSize: 13, fontWeight: 700, color: "#fff", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: '"Manrope", system-ui, sans-serif' }}
          >
            {saving && <RiLoaderLine size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Delete Confirm ──────────────────────────────────────────────────────

function DeleteUserModal({
  user,
  onClose,
  workspaceId,
  onDeleted,
}: {
  user: UserRow | null
  onClose: () => void
  workspaceId: string
  onDeleted: () => void
}) {
  const { showToast } = useToast()
  const [saving, setSaving] = React.useState(false)

  if (!user) return null

  async function handleDelete() {
    if (!user) return
    setSaving(true)
    try {
      const res = await fetch(`/api/settings/users/${user.id}?workspace_id=${encodeURIComponent(workspaceId)}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        showToast({ title: "Error", subtitle: data.error ?? "Could not remove user." })
      } else {
        showToast({ title: "User removed", subtitle: `${user.email ?? user.display_name} has been removed from the workspace.` })
        onDeleted()
        onClose()
      }
    } catch {
      showToast({ title: "Error", subtitle: "An unexpected error occurred." })
    } finally {
      setSaving(false)
    }
  }

  const displayName = user.email ?? user.display_name ?? user.user_id

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.30)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ width: "100%", maxWidth: 420, borderRadius: 20, background: "var(--color-background, #fff)", boxShadow: "0 25px 60px rgba(0,0,0,0.18)", overflow: "hidden", fontFamily: '"Manrope", system-ui, sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid var(--color-border, #E8ECEF)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, background: "#FEE2E2" }}>
              <RiDeleteBinLine size={16} style={{ color: "#EF4444" }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "var(--color-foreground, #0F1828)", margin: 0 }}>Remove User</p>
              <p style={{ fontSize: 12, color: "var(--color-foreground-muted, #7A8A93)", margin: 0 }}>This action cannot be undone</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <p style={{ fontSize: 14, color: "var(--color-foreground, #0F1828)", margin: 0 }}>
            Are you sure you want to remove{" "}
            <span style={{ fontWeight: 700 }}>{displayName}</span>{" "}
            from this workspace?
          </p>
          <p style={{ fontSize: 12, color: "var(--color-foreground-muted, #7A8A93)", margin: "6px 0 0" }}>
            Their account will remain but they will lose access to this workspace.
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: "4px 24px 20px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ height: 36, paddingInline: 16, borderRadius: 999, border: "1.5px solid var(--color-border, #E8ECEF)", background: "transparent", fontSize: 13, fontWeight: 600, color: "var(--color-foreground-muted, #7A8A93)", cursor: "pointer", fontFamily: '"Manrope", system-ui, sans-serif' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleDelete}
            style={{ height: 36, paddingInline: 20, borderRadius: 999, background: "#EF4444", border: "none", fontSize: 13, fontWeight: 700, color: "#fff", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: '"Manrope", system-ui, sans-serif' }}
          >
            {saving && <RiLoaderLine size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {saving ? "Removing…" : "Remove User"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { workspaceId, loading: wsLoading } = useWorkspace()
  const { showToast } = useToast()

  // Tab state
  const [activeTab, setActiveTab] = React.useState<TabKey>("email")

  // ── Email settings state ──
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState<EmailSettings>({
    from_name: "Twibbonize",
    from_email: "noreply@twibbonize.com",
    reply_to: "",
    resend_api_key: "",
    resend_webhook_secret: "",
  })

  // ── Deliverability state ──
  const [logs, setLogs] = React.useState<DeliverabilityLog[]>([])
  const [suppressionCount, setSuppressionCount] = React.useState<number>(0)
  const [delivStats, setDelivStats] = React.useState({ total: 0, delivered: 0, bounced: 0, complained: 0 })
  const [delivLoading, setDelivLoading] = React.useState(true)

  // ── User Access state ──
  const [users, setUsers] = React.useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = React.useState(false)
  const [usersError, setUsersError] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [editUser, setEditUser] = React.useState<UserRow | null>(null)
  const [deleteUser, setDeleteUser] = React.useState<UserRow | null>(null)

  // ── Load email settings ──
  React.useEffect(() => {
    if (wsLoading) return
    setLoading(true)
    fetch("/api/settings/email")
      .then((r) => r.json())
      .then((data: { settings?: EmailSettings | null }) => {
        if (data.settings) {
          setForm({
            from_name: data.settings.from_name ?? "Twibbonize",
            from_email: data.settings.from_email ?? "noreply@twibbonize.com",
            reply_to: data.settings.reply_to ?? "",
            resend_api_key: data.settings.resend_api_key ?? "",
            resend_webhook_secret: data.settings.resend_webhook_secret ?? "",
          })
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [wsLoading])

  // ── Load deliverability ──
  React.useEffect(() => {
    if (!workspaceId) return
    setDelivLoading(true)
    const supabase = createClient()
    Promise.all([
      (supabase as any)
        .from("email_deliverability_logs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(50),
      (supabase as any)
        .from("email_suppression")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
    ])
      .then(([logsRes, suppRes]: [{ data: DeliverabilityLog[] | null }, { count: number | null }]) => {
        const logData = logsRes.data ?? []
        setLogs(logData)
        const total = logData.length
        const delivered  = logData.filter((l) => l.event_type === "delivered").length
        const bounced    = logData.filter((l) => l.event_type === "bounced").length
        const complained = logData.filter((l) => l.event_type === "complained").length
        setDelivStats({ total, delivered, bounced, complained })
        setSuppressionCount(suppRes.count ?? 0)
      })
      .catch(console.error)
      .finally(() => setDelivLoading(false))
  }, [workspaceId])

  // ── Load users when Users tab is active ──
  async function fetchUsers() {
    if (!workspaceId) {
      console.warn("[fetchUsers] workspaceId is null, skipping")
      return
    }
    setUsersLoading(true)
    setUsersError(null)
    try {
      const res = await fetch(`/api/settings/users?workspace_id=${workspaceId}`)
      const d = await res.json()
      console.log("[fetchUsers] API response:", res.status, d)
      if (!res.ok) {
        setUsersError(d.error ?? `Request failed (${res.status})`)
        setUsers([])
      } else {
        setUsers(d.users ?? [])
      }
    } catch (err) {
      console.error("[fetchUsers] network error:", err)
      setUsersError("Network error — could not load users.")
    } finally {
      setUsersLoading(false)
    }
  }

  React.useEffect(() => {
    if (activeTab === "users" && workspaceId) {
      fetchUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, workspaceId])

  // ── Save email settings ──
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/settings/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_name: form.from_name,
          from_email: form.from_email,
          reply_to: form.reply_to || null,
          resend_api_key: form.resend_api_key || null,
          resend_webhook_secret: form.resend_webhook_secret || null,
        }),
      })
      if (res.ok) {
        showToast({ title: "Settings saved", subtitle: "Email settings updated successfully." })
      } else {
        showToast({ title: "Save failed", subtitle: "Could not save settings. Try again." })
      }
    } catch {
      showToast({ title: "Save failed", subtitle: "An unexpected error occurred." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-background" style={{ fontFamily: '"Manrope", system-ui, sans-serif' }}>
      {/* ── Page Header ── */}
      <div className="border-b border-border bg-background px-8 py-6">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-foreground-muted">Manage your workspace configuration and email preferences.</p>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 border-b border-border px-8 bg-background">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 px-8 py-8">

        {/* ════ Email Settings Tab ════ */}
        {activeTab === "email" && (
          <div className="max-w-3xl space-y-8">
            <section className="rounded-xl border border-border bg-background overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-background-subtle">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <RiMailSettingsLine size={16} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Email Settings</h2>
                  <p className="text-xs text-foreground-muted">Configure your sending address and Resend integration.</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RiLoaderLine size={20} className="animate-spin text-foreground-muted" />
                </div>
              ) : (
                <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground-muted mb-1.5">From Name</label>
                      <input
                        type="text"
                        value={form.from_name}
                        onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
                        placeholder="Twibbonize"
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground-muted mb-1.5">From Email</label>
                      <input
                        type="email"
                        value={form.from_email}
                        onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))}
                        placeholder="noreply@twibbonize.com"
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground-muted mb-1.5">Reply-To (optional)</label>
                    <input
                      type="email"
                      value={form.reply_to}
                      onChange={(e) => setForm((f) => ({ ...f, reply_to: e.target.value }))}
                      placeholder="support@twibbonize.com"
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-colors"
                    />
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <RiShieldKeyholeLine size={14} className="text-foreground-muted" />
                      <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">Resend Integration</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground-muted mb-1.5">Resend API Key</label>
                        <input
                          type="password"
                          value={form.resend_api_key}
                          onChange={(e) => setForm((f) => ({ ...f, resend_api_key: e.target.value }))}
                          placeholder="re_xxxxxxxxxxxx"
                          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-colors"
                        />
                        <p className="mt-1 text-[11px] text-foreground-muted">Overrides the RESEND_API_KEY environment variable for this workspace.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground-muted mb-1.5">Webhook Secret</label>
                        <input
                          type="password"
                          value={form.resend_webhook_secret}
                          onChange={(e) => setForm((f) => ({ ...f, resend_webhook_secret: e.target.value }))}
                          placeholder="whsec_xxxxxxxxxxxx"
                          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-colors"
                        />
                        <p className="mt-1 text-[11px] text-foreground-muted">Set this in Resend dashboard → Webhooks. Points to <code className="bg-background-subtle rounded px-1">/api/webhooks/resend</code>.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      {saving ? <RiLoaderLine size={14} className="animate-spin" /> : <RiSave3Line size={14} />}
                      {saving ? "Saving…" : "Save Settings"}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        )}

        {/* ════ Deliverability Tab ════ */}
        {activeTab === "deliverability" && (
          <div className="max-w-3xl space-y-8">
            <section className="rounded-xl border border-border bg-background overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-background-subtle">
                <div className="flex size-8 items-center justify-center rounded-lg bg-green-100">
                  <RiBarChartLine size={16} className="text-green-700" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Deliverability</h2>
                  <p className="text-xs text-foreground-muted">Monitor bounce rates, complaints, and email health.</p>
                </div>
              </div>

              {delivLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RiLoaderLine size={20} className="animate-spin text-foreground-muted" />
                </div>
              ) : (
                <div className="px-6 py-5 space-y-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard label="Total Events" value={delivStats.total.toString()} icon={<RiBarChartLine size={16} className="text-foreground-muted" />} color="bg-background-subtle" />
                    <StatCard label="Delivered" value={delivStats.total > 0 ? `${Math.round((delivStats.delivered / delivStats.total) * 100)}%` : "—"} icon={<RiMailCheckLine size={16} className="text-green-600" />} color="bg-green-50" />
                    <StatCard label="Bounce Rate" value={delivStats.total > 0 ? `${Math.round((delivStats.bounced / delivStats.total) * 100)}%` : "—"} icon={<RiMailForbidLine size={16} className="text-red-600" />} color="bg-red-50" />
                    <StatCard label="Complaint Rate" value={delivStats.total > 0 ? `${Math.round((delivStats.complained / delivStats.total) * 100)}%` : "—"} icon={<RiAlertLine size={16} className="text-orange-600" />} color="bg-orange-50" />
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-border bg-background-subtle px-4 py-3">
                    <RiCursorLine size={16} className="text-foreground-muted shrink-0" />
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{suppressionCount}</span>{" "}
                      <span className="text-foreground-muted">email{suppressionCount !== 1 ? "s" : ""} on suppression list</span>
                    </p>
                  </div>

                  {logs.length === 0 ? (
                    <div className="rounded-lg border border-border bg-background-subtle py-10 text-center">
                      <RiBarChartLine size={24} className="mx-auto text-foreground-muted/50 mb-2" />
                      <p className="text-sm text-foreground-muted">No deliverability events yet.</p>
                      <p className="text-xs text-foreground-muted mt-1">Events will appear here once emails are sent.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-background-subtle">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide">Email</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide">Event</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide hidden md:table-cell">Subject</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-background-subtle transition-colors">
                              <td className="px-4 py-2.5 text-xs text-foreground font-mono truncate max-w-[180px]">{log.email}</td>
                              <td className="px-4 py-2.5"><EventBadge type={log.event_type} /></td>
                              <td className="px-4 py-2.5 text-xs text-foreground-muted truncate max-w-[200px] hidden md:table-cell">{log.subject ?? "—"}</td>
                              <td className="px-4 py-2.5 text-xs text-foreground-muted whitespace-nowrap">
                                {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ════ User Access Tab ════ */}
        {activeTab === "users" && (
          <div className="max-w-5xl" style={{ fontFamily: '"Manrope", system-ui, sans-serif' }}>
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-foreground, #0F1828)", margin: 0 }}>Workspace Members</h2>
                <p style={{ fontSize: 13, color: "var(--color-foreground-muted, #7A8A93)", margin: "3px 0 0" }}>
                  Manage who has access to this workspace and their roles.
                </p>
              </div>
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-full bg-primary text-white hover:opacity-90 transition-opacity"
                style={{ fontFamily: '"Manrope", system-ui, sans-serif', flexShrink: 0 }}
              >
                <RiAddLine size={15} />
                Add User
              </button>
            </div>

            {/* Table / empty state */}
            {usersLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0" }}>
                <RiLoaderLine size={22} className="animate-spin text-foreground-muted" />
              </div>
            ) : usersError ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "48px 24px",
                  borderRadius: 16,
                  border: "1.5px dashed #FCA5A5",
                  background: "#FEF2F2",
                  textAlign: "center",
                }}
              >
                <RiAlertLine size={22} style={{ color: "#EF4444", marginBottom: 10 }} />
                <p style={{ fontWeight: 700, fontSize: 14, color: "#EF4444", margin: 0 }}>Failed to load users</p>
                <p style={{ fontSize: 12, color: "#B91C1C", margin: "6px 0 16px", maxWidth: 380 }}>{usersError}</p>
                <button
                  onClick={fetchUsers}
                  style={{ height: 34, paddingInline: 16, borderRadius: 999, border: "1.5px solid #FCA5A5", background: "#fff", fontSize: 12, fontWeight: 600, color: "#EF4444", cursor: "pointer" }}
                >
                  Try again
                </button>
              </div>
            ) : users.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "72px 24px",
                  borderRadius: 16,
                  border: "1.5px dashed var(--color-border, #E8ECEF)",
                  background: "var(--color-background-subtle, #F8FAFC)",
                  textAlign: "center",
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <RiTeamLine size={22} style={{ color: "#6366F1" }} />
                </div>
                <p style={{ fontWeight: 700, fontSize: 15, color: "var(--color-foreground, #0F1828)", margin: 0 }}>No users yet</p>
                <p style={{ fontSize: 13, color: "var(--color-foreground-muted, #7A8A93)", margin: "6px 0 20px" }}>
                  Add team members to give them access to this workspace.
                </p>
                <button
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-full bg-primary text-white hover:opacity-90 transition-opacity"
                  style={{ fontFamily: '"Manrope", system-ui, sans-serif' }}
                >
                  <RiAddLine size={15} />
                  Add User
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--color-background-subtle, #F8FAFC)", borderBottom: "1px solid var(--color-border, #E8ECEF)" }}>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Member</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Type</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground-muted hidden md:table-cell">Features</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground-muted hidden sm:table-cell">Joined</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, idx) => {
                      const name = user.display_name || user.email?.split("@")[0] || "Unknown"
                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-background-subtle transition-colors"
                          style={{ borderTop: idx > 0 ? "1px solid var(--color-border, #E8ECEF)" : undefined }}
                        >
                          {/* Member cell */}
                          <td style={{ padding: "14px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <UserAvatar name={name} size={34} />
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontWeight: 600, fontSize: 13, color: "var(--color-foreground, #0F1828)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {user.display_name || name}
                                </p>
                                {user.display_name && user.email && (
                                  <p style={{ fontSize: 11, color: "var(--color-foreground-muted, #7A8A93)", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {user.email}
                                  </p>
                                )}
                                {!user.display_name && user.email && (
                                  <p style={{ fontSize: 11, color: "var(--color-foreground-muted, #7A8A93)", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {user.email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Type badge */}
                          <td style={{ padding: "14px 20px" }}>
                            <UserTypeBadge type={user.user_type} />
                          </td>

                          {/* Features */}
                          <td style={{ padding: "14px 20px" }} className="hidden md:table-cell">
                            <FeatureBadges features={user.features ?? []} />
                          </td>

                          {/* Joined date */}
                          <td style={{ padding: "14px 20px" }} className="hidden sm:table-cell">
                            <span style={{ fontSize: 12, color: "var(--color-foreground-muted, #7A8A93)" }}>
                              {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "14px 20px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <button
                                onClick={() => setEditUser(user)}
                                style={{
                                  height: 30,
                                  paddingInline: 12,
                                  borderRadius: 999,
                                  border: "1.5px solid var(--color-border, #E8ECEF)",
                                  background: "transparent",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "var(--color-foreground-muted, #7A8A93)",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  transition: "all 0.12s",
                                  fontFamily: '"Manrope", system-ui, sans-serif',
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#6366F1"; (e.currentTarget as HTMLButtonElement).style.color = "#6366F1" }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border, #E8ECEF)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-foreground-muted, #7A8A93)" }}
                              >
                                <RiPencilLine size={12} />
                                Edit role
                              </button>
                              <button
                                onClick={() => setDeleteUser(user)}
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 999,
                                  border: "1.5px solid var(--color-border, #E8ECEF)",
                                  background: "transparent",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "var(--color-foreground-muted, #7A8A93)",
                                  transition: "all 0.12s",
                                  flexShrink: 0,
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#EF4444"; (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2" }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border, #E8ECEF)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-foreground-muted, #7A8A93)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
                                title="Remove user"
                              >
                                <RiDeleteBinLine size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {workspaceId && (
        <>
          <AddUserModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            workspaceId={workspaceId}
            onAdded={fetchUsers}
          />
          <EditRoleModal
            user={editUser}
            onClose={() => setEditUser(null)}
            workspaceId={workspaceId}
            onSaved={fetchUsers}
          />
          <DeleteUserModal
            user={deleteUser}
            onClose={() => setDeleteUser(null)}
            workspaceId={workspaceId}
            onDeleted={fetchUsers}
          />
        </>
      )}
    </div>
  )
}

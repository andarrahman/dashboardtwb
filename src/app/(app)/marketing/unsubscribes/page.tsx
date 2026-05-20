"use client"
import * as React from "react"
import { useWorkspace } from "@/lib/hooks/use-workspace"
import { useToast } from "@/components/ui/toast"
import { createClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"
import {
  RiMailForbidLine,
  RiSearchLine,
  RiDownloadLine,
  RiLoaderLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiUserAddLine,
} from "@remixicon/react"

interface UnsubscribeRecord {
  id: string
  contact_id: string
  email: string
  unsubscribed_at: string
  contact?: {
    name: string | null
    email: string
  } | null
}

const PAGE_SIZE = 20

export default function UnsubscribesPage() {
  const { workspaceId, loading: wsLoading } = useWorkspace()
  const { showToast } = useToast()
  const [records, setRecords] = React.useState<UnsubscribeRecord[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [totalContacts, setTotalContacts] = React.useState(0)
  const [thisMonth, setThisMonth] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [confirmId, setConfirmId] = React.useState<string | null>(null)
  const [resubscribing, setResubscribing] = React.useState(false)

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset page on search change
  React.useEffect(() => {
    setPage(0)
  }, [debouncedSearch])

  // Load data
  React.useEffect(() => {
    if (!workspaceId) return
    setLoading(true)

    const supabase = createClient()

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = (supabase as any)
      .from("contact_unsubscribes")
      .select("id, contact_id, email, unsubscribed_at, contact:contacts(name, email)", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .order("unsubscribed_at", { ascending: false })
      .range(from, to)

    if (debouncedSearch) {
      query = query.ilike("email", `%${debouncedSearch}%`)
    }

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    Promise.all([
      query,
      (supabase as any)
        .from("contact_unsubscribes")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("unsubscribed_at", startOfMonth.toISOString()),
      (supabase as any)
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
    ])
      .then(([res, monthRes, contactsRes]: [{ data: UnsubscribeRecord[] | null; count: number | null }, { count: number | null }, { count: number | null }]) => {
        setRecords(res.data ?? [])
        setTotalCount(res.count ?? 0)
        setThisMonth(monthRes.count ?? 0)
        setTotalContacts(contactsRes.count ?? 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [workspaceId, page, debouncedSearch])

  async function handleResubscribe(record: UnsubscribeRecord) {
    setResubscribing(true)
    try {
      const supabase = createClient()

      // Delete from contact_unsubscribes
      await (supabase as any)
        .from("contact_unsubscribes")
        .delete()
        .eq("id", record.id)

      // Remove from email_suppression if present
      await (supabase as any)
        .from("email_suppression")
        .delete()
        .eq("email", record.email)
        .eq("workspace_id", workspaceId)

      // Reset contact email_status
      if (record.contact_id) {
        await (supabase as any)
          .from("contacts")
          .update({ email_status: "active", updated_at: new Date().toISOString() })
          .eq("id", record.contact_id)
      }

      setRecords((prev) => prev.filter((r) => r.id !== record.id))
      setTotalCount((c) => Math.max(0, c - 1))
      showToast({ title: "Re-subscribed", subtitle: `${record.email} has been re-subscribed.` })
    } catch {
      showToast({ title: "Error", subtitle: "Could not re-subscribe. Try again." })
    } finally {
      setResubscribing(false)
      setConfirmId(null)
    }
  }

  function handleExportCSV() {
    const rows = [
      ["Name", "Email", "Unsubscribed At"],
      ...records.map((r) => [
        r.contact?.name ?? "",
        r.email,
        new Date(r.unsubscribed_at).toLocaleString(),
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "unsubscribes.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const unsubscribeRate = totalContacts > 0 ? ((totalCount / totalContacts) * 100).toFixed(1) : "0.0"

  if (wsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RiLoaderLine size={24} className="animate-spin text-foreground-muted" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Unsubscribes</h1>
            <p className="mt-1 text-sm text-foreground-muted">Contacts who have opted out of email communications.</p>
          </div>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-background text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-background-subtle transition-colors"
          >
            <RiDownloadLine size={14} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex-1 px-8 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-center gap-2 mb-2">
              <RiMailForbidLine size={16} className="text-foreground-muted" />
              <span className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Total Unsubscribes</span>
            </div>
            <p className="text-2xl font-semibold text-foreground">{totalCount.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-center gap-2 mb-2">
              <RiMailForbidLine size={16} className="text-orange-500" />
              <span className="text-xs font-medium text-foreground-muted uppercase tracking-wide">This Month</span>
            </div>
            <p className="text-2xl font-semibold text-foreground">{thisMonth.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-center gap-2 mb-2">
              <RiMailForbidLine size={16} className="text-red-500" />
              <span className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Unsubscribe Rate</span>
            </div>
            <p className="text-2xl font-semibold text-foreground">{unsubscribeRate}%</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <RiSearchLine size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-colors"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RiLoaderLine size={24} className="animate-spin text-foreground-muted" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-border bg-background-subtle">
            <RiMailForbidLine size={32} className="text-foreground-muted/40 mb-3" />
            <p className="text-sm font-medium text-foreground-muted">
              {debouncedSearch ? "No results found" : "No unsubscribes yet"}
            </p>
            <p className="text-xs text-foreground-muted mt-1">
              {debouncedSearch ? "Try a different search term." : "Contacts who unsubscribe will appear here."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide">Contact</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide">Unsubscribed At</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-foreground-muted uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-background-subtle transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">
                      {record.contact?.name ?? <span className="text-foreground-muted italic">Unknown</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground-muted font-mono">{record.email}</td>
                    <td className="px-5 py-3 text-sm text-foreground-muted">
                      {new Date(record.unsubscribed_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {confirmId === record.id ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="text-xs text-foreground-muted">Confirm?</span>
                          <button
                            type="button"
                            disabled={resubscribing}
                            onClick={() => handleResubscribe(record)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                          >
                            {resubscribing ? <RiLoaderLine size={11} className="animate-spin" /> : null}
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="h-7 px-2.5 rounded-md border border-border text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(record.id)}
                          className={cn(
                            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-xs font-medium transition-colors",
                            "text-foreground-muted hover:text-foreground hover:bg-background-subtle"
                          )}
                        >
                          <RiUserAddLine size={12} />
                          Re-subscribe
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-background-subtle">
                <p className="text-xs text-foreground-muted">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="size-7 rounded-md border border-border flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-background transition-colors disabled:opacity-40"
                  >
                    <RiArrowLeftSLine size={14} />
                  </button>
                  <span className="text-xs text-foreground-muted px-2">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="size-7 rounded-md border border-border flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-background transition-colors disabled:opacity-40"
                  >
                    <RiArrowRightSLine size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

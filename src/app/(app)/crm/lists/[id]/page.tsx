"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter, useParams } from "next/navigation";
import {
  RiArrowLeftLine,
  RiAddLine,
  RiEditLine,
  RiSearchLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiMoreLine,
  RiListCheck2,
  RiDeleteBin2Line,
  RiFileCopyLine,
  RiUserAddLine,
  RiLoaderLine,
  RiCloseLine,
  RiDownloadLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { EditListModal } from "@/components/crm/lists/edit-list-modal";
import { DeleteListModal } from "@/components/crm/lists/delete-list-modal";
import { AddContactsModal } from "@/components/crm/lists/add-contacts-modal";
import { ContactQuickView } from "@/components/contacts/contact-quick-view";
import {
  getCrmList,
  getCrmListContacts,
  updateCrmList,
  deleteCrmList,
  duplicateCrmList,
  removeContactFromList,
  addContactsToList,
} from "@/lib/queries/crm-lists";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { createClient } from "@/lib/supabase/browser";
import type { CrmListRow, CrmListContactRow, AccountTier } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TONES = [
  "bg-turquoise-100 text-turquoise-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
];

function avatarTone(name: string) {
  return TONES[(name.charCodeAt(0) ?? 0) % TONES.length];
}

function nameInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function relativeDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function getPageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  for (let p = lo; p <= hi; p++) pages.push(p);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

function TierBadge({ tier }: { tier: AccountTier | null }) {
  if (!tier) return <span className="text-foreground-muted">—</span>;
  const labels: Record<AccountTier, string> = {
    premium_creator: "★ Premium Creator",
    premium_supporter: "Premium Supporter",
    free: "Free",
  };
  const variants: Record<AccountTier, "accent" | "neutral"> = {
    premium_creator: "accent",
    premium_supporter: "neutral",
    free: "neutral",
  };
  return (
    <Badge variant={variants[tier]} size="sm">
      {labels[tier]}
    </Badge>
  );
}

const PAGE_SIZE = 10;

const TIER_FILTER_OPTIONS = [
  { value: "", label: "All tiers" },
  { value: "premium_creator", label: "★ Premium Creator" },
  { value: "premium_supporter", label: "Premium Supporter" },
  { value: "free", label: "Free" },
];

// ─── Contact row menu ──────────────────────────────────────────────────────────

function ContactRowMenu({ onRemove }: { onRemove: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({});
  const btnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick() { setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 48;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < menuHeight
        ? rect.top - menuHeight - 4
        : rect.bottom + 4;
      setMenuStyle({
        position: "fixed",
        top,
        left: rect.right - 176,
        zIndex: 99999,
      });
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="size-8 inline-flex items-center justify-center rounded-lg text-foreground-muted hover:bg-background-subtle hover:text-foreground transition-colors"
        aria-label="More options"
      >
        <RiMoreLine size={16} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          style={menuStyle}
          className="w-44 rounded-xl border border-border bg-background shadow-lg py-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onRemove(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <RiCloseLine size={15} className="shrink-0" />
            Remove from list
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Header menu ──────────────────────────────────────────────────────────────

function HeaderMenu({
  onEdit,
  onAddContacts,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onAddContacts: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const items = [
    { label: "Edit list", icon: RiEditLine, onClick: onEdit },
    { label: "Add contacts", icon: RiUserAddLine, onClick: onAddContacts },
    { label: "Duplicate list", icon: RiFileCopyLine, onClick: onDuplicate },
    { label: "Delete list", icon: RiDeleteBin2Line, onClick: onDelete, destructive: true },
  ];

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        size="icon-sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
      >
        <RiMoreLine size={16} />
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-border bg-background shadow-lg py-1">
          {items.map(({ label, icon: Icon, onClick: itemClick, destructive }) => (
            <button
              key={label}
              onClick={() => { setOpen(false); itemClick(); }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                destructive
                  ? "text-red-600 hover:bg-red-50"
                  : "text-foreground hover:bg-background-subtle"
              )}
            >
              <Icon size={15} className="shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton rows ──────────────────────────────────────────────────────────────

function SkeletonContactRow() {
  return (
    <tr className="border-b border-border last:border-b-0 animate-pulse">
      <td className="px-4 py-4">
        <div className="size-4 rounded bg-border" />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-border" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 rounded bg-border" />
            <div className="h-2.5 w-44 rounded bg-border" />
          </div>
        </div>
      </td>
      <td className="px-4 py-4"><div className="h-5 w-28 rounded bg-border" /></td>
      <td className="px-4 py-4"><div className="h-3 w-20 rounded bg-border" /></td>
      <td className="px-4 py-4"><div className="h-3 w-16 rounded bg-border" /></td>
      <td className="px-4 py-4"><div className="h-3 w-20 rounded bg-border" /></td>
      <td className="px-4 py-4"><div className="h-3 w-20 rounded bg-border" /></td>
      <td className="px-4 py-4" />
    </tr>
  );
}

// ─── Inner page ────────────────────────────────────────────────────────────────

function ListDetailPageInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const listId = params.id;
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

  const [list, setList] = React.useState<CrmListRow | null>(null);
  const [listLoading, setListLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);

  const [contacts, setContacts] = React.useState<CrmListContactRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [contactsLoading, setContactsLoading] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [tierFilter, setTierFilter] = React.useState("");

  // Selection state
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkRemoving, setBulkRemoving] = React.useState(false);
  const [contactsRefetchKey, setContactsRefetchKey] = React.useState(0);

  // Quick view
  const [quickViewContact, setQuickViewContact] = React.useState<import("@/lib/supabase/types").ContactRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);

  // Modal state
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [addContactsOpen, setAddContactsOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  // User info
  const [userId, setUserId] = React.useState("");
  const [userName, setUserName] = React.useState("");

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const name =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split("@")[0] ??
        "User";
      setUserName(name);
    });
  }, []);

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch list metadata
  React.useEffect(() => {
    if (!workspaceId || !listId) return;
    setListLoading(true);
    getCrmList(workspaceId, listId).then(({ list: l, error }) => {
      if (error || !l) {
        setListError(error ?? "List not found");
      } else {
        setList(l);
      }
      setListLoading(false);
    });
  }, [workspaceId, listId]);

  // Fetch contacts
  React.useEffect(() => {
    if (!workspaceId || !listId) return;
    setContactsLoading(true);
    getCrmListContacts(workspaceId, listId, {
      search: debouncedSearch || undefined,
      tier: tierFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    }).then(({ contacts: c, total: t, error }) => {
      if (!error) {
        setContacts(c);
        setTotal(t);
      }
      setContactsLoading(false);
    });
  }, [workspaceId, listId, debouncedSearch, tierFilter, page, contactsRefetchKey]);

  const isContactsLoading = wsLoading || contactsLoading;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageFirst = (page - 1) * PAGE_SIZE + 1;
  const pageLast = Math.min(page * PAGE_SIZE, total);

  // Clear selection whenever the contacts list changes
  React.useEffect(() => { setSelected(new Set()); }, [contacts]);

  const allOnPageSelected = contacts.length > 0 && contacts.every((r) => selected.has(r.contact_id));
  const someSelected = selected.size > 0;

  function toggleRow(contactId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(contactId) ? next.delete(contactId) : next.add(contactId);
      return next;
    });
  }

  function toggleAll() {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        contacts.forEach((r) => next.delete(r.contact_id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        contacts.forEach((r) => next.add(r.contact_id));
        return next;
      });
    }
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  async function handleEdit(data: { name: string; description: string; folder: string }) {
    if (!workspaceId || !list || !userId) return;
    const { error } = await updateCrmList(workspaceId, list.id, userId, userName, {
      name: data.name,
      description: data.description || undefined,
      folder: data.folder || undefined,
    });
    if (error) {
      showToast({ title: "Failed to update list", subtitle: error });
      return;
    }
    setEditOpen(false);
    setList((prev) =>
      prev
        ? { ...prev, name: data.name, description: data.description || null, folder: data.folder || null }
        : prev
    );
    showToast({ title: `List updated · ${data.name}`, subtitle: "Changes saved" });
  }

  async function handleDelete() {
    if (!workspaceId || !list) return;
    const { error } = await deleteCrmList(workspaceId, list.id);
    if (error) {
      showToast({ title: "Failed to delete list", subtitle: error });
      return;
    }
    showToast({ title: `"${list.name}" deleted`, subtitle: "The list has been permanently removed" });
    router.push("/crm/lists");
  }

  async function handleDuplicate() {
    if (!workspaceId || !list || !userId) return;
    const { list: copy, error } = await duplicateCrmList(workspaceId, list.id, userId, userName);
    if (error || !copy) {
      showToast({ title: "Failed to duplicate list", subtitle: error ?? "Unknown error" });
      return;
    }
    showToast({
      title: `List duplicated · ${copy.name}`,
      subtitle: "A copy has been created",
      action: {
        label: "View →",
        onClick: () => router.push(`/crm/lists/${copy.id}`),
      },
    });
  }

  async function handleAddContacts(contactIds: string[]) {
    if (!workspaceId || !list || !userId) return;
    const { added, error } = await addContactsToList(
      workspaceId,
      list.id,
      contactIds,
      userId,
      userName
    );
    if (error) {
      showToast({ title: "Failed to add contacts", subtitle: error });
      return;
    }
    setAddContactsOpen(false);
    setList((prev) => (prev ? { ...prev, contact_count: prev.contact_count + added } : prev));
    // Trigger contacts refetch via key — handles both page=1 already case and active filters
    setPage(1);
    setContactsRefetchKey((k) => k + 1);
    showToast({
      title: `${added} contact${added !== 1 ? "s" : ""} added`,
      subtitle: "Updated just now",
    });
  }

  async function handleRemoveContact(contactId: string) {
    if (!workspaceId || !list) return;
    const { error } = await removeContactFromList(workspaceId, list.id, contactId);
    if (error) {
      showToast({ title: "Failed to remove contact", subtitle: error });
      return;
    }
    setContacts((prev) => prev.filter((c) => c.contact_id !== contactId));
    setTotal((prev) => Math.max(0, prev - 1));
    setList((prev) => (prev ? { ...prev, contact_count: Math.max(0, prev.contact_count - 1) } : prev));
    showToast({ title: "Contact removed from list", subtitle: "Updated just now" });
  }

  async function handleBulkRemove() {
    if (!workspaceId || !list || selected.size === 0) return;
    setBulkRemoving(true);
    const ids = [...selected];
    let removed = 0;
    for (const contactId of ids) {
      const { error } = await removeContactFromList(workspaceId, list.id, contactId);
      if (!error) removed++;
    }
    setContacts((prev) => prev.filter((c) => !selected.has(c.contact_id)));
    setTotal((prev) => Math.max(0, prev - removed));
    setList((prev) => (prev ? { ...prev, contact_count: Math.max(0, prev.contact_count - removed) } : prev));
    setSelected(new Set());
    setBulkRemoving(false);
    showToast({
      title: `${removed} contact${removed !== 1 ? "s" : ""} removed`,
      subtitle: "Updated just now",
    });
  }

  async function handleExportCSV() {
    if (!workspaceId || !list) return;
    setExporting(true);
    try {
      const { contacts: all } = await getCrmListContacts(workspaceId, list.id, {
        pageSize: 9999,
        page: 1,
      });

      const TIER_LABELS: Record<string, string> = {
        premium_creator: "Premium Creator",
        premium_supporter: "Premium Supporter",
        free: "Free",
      };

      const csvEscape = (val: string | null | undefined) => {
        const s = val ?? "";
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };

      const headers = ["Name", "Email", "Tier", "Segment", "Country", "Added On", "Added By"];
      const rows = all.map((row) => {
        const c = row.contact;
        return [
          csvEscape(c?.name),
          csvEscape(c?.email),
          csvEscape(c?.account_tier ? TIER_LABELS[c.account_tier] : ""),
          csvEscape(c?.segment),
          csvEscape(c?.country),
          csvEscape(row.added_at ? new Date(row.added_at).toLocaleDateString("en-GB") : ""),
          csvEscape(row.added_by_name),
        ].join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${list.name.replace(/[^a-z0-9]/gi, "_")}_contacts.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showToast({ title: "Export complete", subtitle: `${all.length} contacts exported` });
    } finally {
      setExporting(false);
    }
  }

  // ─── Loading / error states ────────────────────────────────────────────────────

  if (wsLoading || listLoading) {
    return (
      <main className="px-12 py-10 flex items-center justify-center min-h-[400px]">
        <RiLoaderLine size={24} className="animate-spin text-foreground-muted" />
      </main>
    );
  }

  if (listError || !list) {
    return (
      <main className="px-12 py-10">
        <p className="text-destructive text-sm">{listError ?? "List not found"}</p>
        <button
          onClick={() => router.push("/crm/lists")}
          className="mt-3 text-sm font-medium text-primary hover:underline inline-flex items-center gap-1.5"
        >
          <RiArrowLeftLine size={14} />
          Back to lists
        </button>
      </main>
    );
  }

  return (
    <main className="px-12 py-10 max-w-[1760px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        <button
          onClick={() => router.push("/crm/lists")}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <RiArrowLeftLine size={12} />
          Back to lists
        </button>
        <span>·</span>
        <span>CRM · Lists · {list.name}</span>
      </div>

      {/* Header card */}
      <div className="mt-5 rounded-2xl border border-border bg-background p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="shrink-0 size-14 rounded-xl border-2 border-primary flex items-center justify-center">
              <RiListCheck2 size={26} className="text-primary" />
            </div>
            {/* Meta */}
            <div>
              <h1 className="text-2xl font-bold leading-tight">{list.name}</h1>
              {list.description && (
                <p className="mt-1 text-sm text-foreground-muted max-w-xl">{list.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-foreground-muted">
                {list.folder && (
                  <span>
                    <span className="text-foreground-subtle font-medium">Folder:</span>{" "}
                    {list.folder}
                  </span>
                )}
                {list.owner_name && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-foreground-subtle font-medium">Owner:</span>
                    <Avatar
                      initials={nameInitials(list.owner_name)}
                      size="sm"
                      tone={avatarTone(list.owner_name)}
                    />
                    {list.owner_name}
                  </span>
                )}
                <span>
                  <span className="text-foreground-subtle font-medium">Created:</span>{" "}
                  {formatDate(list.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Contact count + actions */}
          <div className="flex flex-col items-end gap-4 shrink-0">
            <div className="text-right">
              <p className="text-4xl font-bold tabular-nums">{list.contact_count.toLocaleString()}</p>
              <p className="text-xs text-foreground-muted mt-0.5">contacts in list</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCSV}
                disabled={exporting || list.contact_count === 0}
              >
                {exporting
                  ? <RiLoaderLine size={15} className="animate-spin" />
                  : <RiDownloadLine size={15} />
                }
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <RiEditLine size={15} />
                Edit list
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAddContactsOpen(true)}
              >
                <RiAddLine size={15} />
                Add contacts
              </Button>
              <HeaderMenu
                onEdit={() => setEditOpen(true)}
                onAddContacts={() => setAddContactsOpen(true)}
                onDuplicate={handleDuplicate}
                onDelete={() => setDeleteOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-48">
            <Select
              value={tierFilter}
              onChange={(v) => { setTierFilter(v); setPage(1); }}
              options={TIER_FILTER_OPTIONS}
              placeholder="All tiers"
            />
          </div>

          {tierFilter && (
            <button
              onClick={() => { setTierFilter(""); setPage(1); }}
              className="inline-flex items-center gap-1.5 rounded-full h-10 px-3 text-sm font-medium text-foreground-subtle hover:text-foreground hover:bg-background-subtle transition-colors"
            >
              <RiCloseLine size={14} />
              Clear filter
            </button>
          )}
        </div>

        <div className="relative w-full max-w-xs">
          <RiSearchLine
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted"
          />
          <input
            type="search"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-full border border-border bg-background pl-9 pr-4 text-sm outline-none placeholder:text-foreground-muted focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-primary text-white text-xs font-semibold px-2.5 py-1">
              {selected.size} selected
            </span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
            >
              Clear selection
            </button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkRemove}
            disabled={bulkRemoving}
          >
            {bulkRemoving
              ? <><RiLoaderLine size={15} className="animate-spin" /> Removing…</>
              : <><RiCloseLine size={15} /> Remove {selected.size} from list</>
            }
          </Button>
        </div>
      )}

      {/* Contacts table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-background-subtle text-left text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  className="size-4 rounded border-border cursor-pointer accent-primary"
                />
              </th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Added on</th>
              <th className="px-4 py-3">Added by</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isContactsLoading
              ? [...Array(5)].map((_, i) => <SkeletonContactRow key={i} />)
              : contacts.length === 0
              ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-foreground-muted">
                    <RiListCheck2 size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                      {debouncedSearch || tierFilter ? "No contacts match filters" : "No contacts in this list yet"}
                    </p>
                    {!debouncedSearch && !tierFilter && (
                      <button
                        onClick={() => setAddContactsOpen(true)}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <RiAddLine size={13} />
                        Add contacts
                      </button>
                    )}
                  </td>
                </tr>
              )
              : contacts.map((row) => {
                const c = row.contact;
                const displayName = c?.name ?? "Unknown";
                const isRowSelected = selected.has(row.contact_id);
                return (
                  <tr
                    key={row.id}
                    onClick={() => { if (c) { setQuickViewContact(c); setQuickViewOpen(true); } }}
                    className={cn(
                      "group border-b border-border last:border-b-0 cursor-pointer transition-colors",
                      isRowSelected ? "bg-primary-subtle hover:bg-primary-subtle" : "hover:bg-background-subtle"
                    )}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={() => toggleRow(row.contact_id)}
                        className="size-4 rounded border-border cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          initials={nameInitials(displayName)}
                          size="md"
                          tone={avatarTone(displayName)}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{displayName}</p>
                          <p className="text-xs text-foreground-muted truncate max-w-[220px]">
                            {c?.email ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <TierBadge tier={c?.account_tier ?? null} />
                    </td>
                    <td className="px-4 py-4">
                      {c?.segment ? (
                        <Badge variant="neutral" size="sm">{c.segment}</Badge>
                      ) : (
                        <span className="text-foreground-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-foreground-muted">{c?.country ?? "—"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{relativeDate(row.added_at)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-foreground-muted">{row.added_by_name ?? "—"}</span>
                    </td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <ContactRowMenu
                        onRemove={() => handleRemoveContact(row.contact_id)}
                      />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isContactsLoading && total > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-foreground-muted">
            Showing {pageFirst}–{pageLast} of {total.toLocaleString()} contact{total !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <RiArrowLeftSLine size={16} />
            </Button>
            {getPageWindow(page, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`ellipsis-${i}`} className="px-1 text-foreground-muted select-none">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={cn(
                    "size-9 rounded-full text-sm font-medium transition-colors",
                    page === p
                      ? "bg-primary text-white font-semibold"
                      : "text-foreground-subtle hover:bg-background-subtle"
                  )}
                >
                  {p}
                </button>
              )
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <RiArrowRightSLine size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Quick view */}
      <ContactQuickView
        contact={quickViewContact}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
      />

      {/* Modals */}
      <EditListModal
        open={editOpen}
        onOpenChange={setEditOpen}
        list={list}
        onSubmit={handleEdit}
      />

      <DeleteListModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        list={list}
        onConfirm={handleDelete}
      />

      <AddContactsModal
        open={addContactsOpen}
        onOpenChange={setAddContactsOpen}
        workspaceId={workspaceId ?? ""}
        listId={list.id}
        listContactCount={list.contact_count}
        onAdd={handleAddContacts}
      />
    </main>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ListDetailPage() {
  return (
    <ToastProvider>
      <ListDetailPageInner />
    </ToastProvider>
  );
}

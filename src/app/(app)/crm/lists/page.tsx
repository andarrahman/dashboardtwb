"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiSearchLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiMoreLine,
  RiListCheck2,
  RiEditLine,
  RiDeleteBin2Line,
  RiFileCopyLine,
  RiUserAddLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { CreateListModal } from "@/components/crm/lists/create-list-modal";
import { EditListModal } from "@/components/crm/lists/edit-list-modal";
import { DeleteListModal } from "@/components/crm/lists/delete-list-modal";
import { AddContactsModal } from "@/components/crm/lists/add-contacts-modal";
import {
  getCrmLists,
  createCrmList,
  updateCrmList,
  deleteCrmList,
  duplicateCrmList,
  addContactsToList,
} from "@/lib/queries/crm-lists";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { createClient } from "@/lib/supabase/browser";
import type { CrmListRow } from "@/lib/supabase/types";
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

const PAGE_SIZE = 10;

const FOLDER_FILTER_OPTIONS = [
  { value: "", label: "All folders" },
  { value: "Partnerships", label: "Partnerships" },
  { value: "Campaigns", label: "Campaigns" },
  { value: "Marketing", label: "Marketing" },
  { value: "General", label: "General" },
];

// ─── Row menu ──────────────────────────────────────────────────────────────────

interface RowMenuProps {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddContacts: () => void;
}

function ListRowMenu({
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onAddContacts,
}: RowMenuProps) {
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
      const menuHeight = 220;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < menuHeight
        ? rect.top - menuHeight - 4
        : rect.bottom + 4;
      setMenuStyle({
        position: "fixed",
        top,
        left: rect.right - 208, // 208 = menu width
        zIndex: 99999,
      });
    }
    setOpen((v) => !v);
  }

  const items = [
    { label: "View list", icon: RiListCheck2, onClick: onView },
    { label: "Edit list", icon: RiEditLine, onClick: onEdit },
    { label: "Add contacts", icon: RiUserAddLine, onClick: onAddContacts },
    { label: "Duplicate list", icon: RiFileCopyLine, onClick: onDuplicate },
    { label: "Delete list", icon: RiDeleteBin2Line, onClick: onDelete, destructive: true },
  ];

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
          className="w-52 rounded-xl border border-border bg-background shadow-lg py-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {items.map(({ label, icon: Icon, onClick: itemClick, destructive }) => (
            <button
              key={label}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                itemClick();
              }}
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
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Skeleton rows ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-b-0 animate-pulse">
      <td className="px-4 py-4">
        <div className="space-y-1.5">
          <div className="h-3 w-40 rounded bg-border" />
          <div className="h-2.5 w-56 rounded bg-border" />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="h-3 w-8 rounded bg-border" />
      </td>
      <td className="px-4 py-4">
        <div className="h-3 w-20 rounded bg-border" />
      </td>
      <td className="px-4 py-4">
        <div className="h-3 w-24 rounded bg-border" />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-border" />
          <div className="h-3 w-20 rounded bg-border" />
        </div>
      </td>
      <td className="px-4 py-4" />
    </tr>
  );
}

// ─── Inner page ────────────────────────────────────────────────────────────────

function ListsPageInner() {
  const router = useRouter();
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

  const [lists, setLists] = React.useState<CrmListRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [dataError, setDataError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [folderFilter, setFolderFilter] = React.useState("");

  // Modal state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<CrmListRow | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<CrmListRow | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [addContactsTarget, setAddContactsTarget] = React.useState<CrmListRow | null>(null);
  const [addContactsOpen, setAddContactsOpen] = React.useState(false);

  // User info for create/edit
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

  // Fetch lists
  React.useEffect(() => {
    if (!workspaceId) return;
    setDataLoading(true);
    setDataError(null);
    getCrmLists(workspaceId, {
      search: debouncedSearch || undefined,
      folder: folderFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    }).then(({ lists: l, total: t, error }) => {
      if (error) {
        setDataError(error);
      } else {
        setLists(l);
        setTotal(t);
      }
      setDataLoading(false);
    });
  }, [workspaceId, debouncedSearch, folderFilter, page]);

  const isLoading = wsLoading || dataLoading;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageFirst = (page - 1) * PAGE_SIZE + 1;
  const pageLast = Math.min(page * PAGE_SIZE, total);

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  async function handleCreate(data: { name: string; description: string; folder: string }) {
    if (!workspaceId || !userId) return null;
    const { list, error } = await createCrmList(workspaceId, userId, userName, {
      name: data.name,
      description: data.description || undefined,
      folder: data.folder || undefined,
    });
    if (error || !list) {
      showToast({ title: "Failed to create list", subtitle: error ?? "Unknown error" });
      return null;
    }
    setCreateOpen(false);
    setLists((prev) => [list, ...prev]);
    setTotal((prev) => prev + 1);
    showToast({
      title: `List created · ${list.name}`,
      subtitle: "Saved just now",
      action: {
        label: "View list →",
        onClick: () => router.push(`/crm/lists/${list.id}`),
      },
    });
    return list;
  }

  async function handleEdit(data: { name: string; description: string; folder: string }) {
    if (!workspaceId || !editTarget || !userId) return;
    const { error } = await updateCrmList(workspaceId, editTarget.id, userId, userName, {
      name: data.name,
      description: data.description || undefined,
      folder: data.folder || undefined,
    });
    if (error) {
      showToast({ title: "Failed to update list", subtitle: error });
      return;
    }
    setEditOpen(false);
    setLists((prev) =>
      prev.map((l) =>
        l.id === editTarget.id
          ? { ...l, name: data.name, description: data.description || null, folder: data.folder || null }
          : l
      )
    );
    showToast({ title: `List updated · ${data.name}`, subtitle: "Changes saved" });
    setEditTarget(null);
  }

  async function handleDelete() {
    if (!workspaceId || !deleteTarget) return;
    const { error } = await deleteCrmList(workspaceId, deleteTarget.id);
    if (error) {
      showToast({ title: "Failed to delete list", subtitle: error });
      return;
    }
    const deleted = deleteTarget;
    setDeleteOpen(false);
    setDeleteTarget(null);
    setLists((prev) => prev.filter((l) => l.id !== deleted.id));
    setTotal((prev) => Math.max(0, prev - 1));
    showToast({ title: `"${deleted.name}" deleted`, subtitle: "The list has been permanently removed" });
  }

  async function handleDuplicate(list: CrmListRow) {
    if (!workspaceId || !userId) return;
    const { list: copy, error } = await duplicateCrmList(workspaceId, list.id, userId, userName);
    if (error || !copy) {
      showToast({ title: "Failed to duplicate list", subtitle: error ?? "Unknown error" });
      return;
    }
    setLists((prev) => [copy, ...prev]);
    setTotal((prev) => prev + 1);
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
    if (!workspaceId || !addContactsTarget || !userId) return;
    const { added, error } = await addContactsToList(
      workspaceId,
      addContactsTarget.id,
      contactIds,
      userId,
      userName
    );
    if (error) {
      showToast({ title: "Failed to add contacts", subtitle: error });
      return;
    }
    setAddContactsOpen(false);
    // Update local count
    setLists((prev) =>
      prev.map((l) =>
        l.id === addContactsTarget.id
          ? { ...l, contact_count: l.contact_count + added }
          : l
      )
    );
    showToast({
      title: `${added} contact${added !== 1 ? "s" : ""} added to "${addContactsTarget.name}"`,
      subtitle: "Updated just now",
    });
    setAddContactsTarget(null);
  }

  return (
    <main className="px-12 py-10 max-w-[1760px] mx-auto">
      {/* Breadcrumb */}
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        CRM · Lists
      </p>

      {/* Header */}
      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-title-h2 font-bold">Lists</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Group contacts manually. Lists power outreach sends and campaign targeting.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <RiAddLine size={16} />
            Create list
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-48">
            <Select
              value={folderFilter}
              onChange={(v) => { setFolderFilter(v); setPage(1); }}
              options={FOLDER_FILTER_OPTIONS}
              placeholder="All folders"
            />
          </div>
        </div>
        <div className="relative w-full max-w-xs">
          <RiSearchLine
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted"
          />
          <input
            type="search"
            placeholder="Search lists by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-full border border-border bg-background pl-9 pr-4 text-sm outline-none placeholder:text-foreground-muted focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>

      {/* Error */}
      {dataError && (
        <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {dataError}
        </div>
      )}

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-subtle text-left text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <th className="px-4 py-3">List name</th>
              <th className="px-4 py-3 text-right">Contacts</th>
              <th className="px-4 py-3">Folder</th>
              <th className="px-4 py-3">Last updated</th>
              <th className="px-4 py-3">Owner</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              : lists.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-foreground-muted">
                    <RiListCheck2 size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                      {debouncedSearch
                        ? "No lists found"
                        : folderFilter
                        ? `No lists in "${folderFilter}"`
                        : "No lists yet"}
                    </p>
                    <p className="text-xs mt-1">
                      {debouncedSearch
                        ? `No matches for "${debouncedSearch}"`
                        : folderFilter
                        ? "Try a different folder or create a new list"
                        : "Create your first list to start grouping contacts"}
                    </p>
                    {!debouncedSearch && !folderFilter && (
                      <button
                        onClick={() => setCreateOpen(true)}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <RiAddLine size={13} />
                        Create list
                      </button>
                    )}
                  </td>
                </tr>
              )
              : lists.map((list) => (
                <tr
                  key={list.id}
                  onClick={() => router.push(`/crm/lists/${list.id}`)}
                  className="group border-b border-border last:border-b-0 hover:bg-background-subtle cursor-pointer"
                >
                  <td className="px-4 py-4">
                    <p className="font-semibold">{list.name}</p>
                    {list.description && (
                      <p className="text-xs text-foreground-muted mt-0.5 max-w-xs truncate">
                        {list.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right font-medium tabular-nums">
                    {list.contact_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-4">
                    {list.folder ? (
                      <span className="text-foreground-muted">{list.folder}</span>
                    ) : (
                      <span className="text-foreground-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium">{relativeDate(list.updated_at)}</p>
                    {list.updated_by_name && (
                      <p className="text-xs text-foreground-muted mt-0.5">
                        by {list.updated_by_name}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {list.owner_name ? (
                      <div className="flex items-center gap-2">
                        <Avatar
                          initials={nameInitials(list.owner_name)}
                          size="sm"
                          tone={avatarTone(list.owner_name)}
                        />
                        <span className="text-sm">{list.owner_name}</span>
                      </div>
                    ) : (
                      <span className="text-foreground-muted">—</span>
                    )}
                  </td>
                  <td
                    className="px-4 py-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ListRowMenu
                      onView={() => router.push(`/crm/lists/${list.id}`)}
                      onEdit={() => { setEditTarget(list); setEditOpen(true); }}
                      onDelete={() => { setDeleteTarget(list); setDeleteOpen(true); }}
                      onDuplicate={() => handleDuplicate(list)}
                      onAddContacts={() => { setAddContactsTarget(list); setAddContactsOpen(true); }}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-foreground-muted">
            Showing {pageFirst}–{pageLast} of {total.toLocaleString()} list{total !== 1 ? "s" : ""}
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

      {/* Modals */}
      <CreateListModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />

      <EditListModal
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditTarget(null);
        }}
        list={editTarget}
        onSubmit={handleEdit}
      />

      <DeleteListModal
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setDeleteTarget(null);
        }}
        list={deleteTarget}
        onConfirm={handleDelete}
      />

      {addContactsTarget && (
        <AddContactsModal
          open={addContactsOpen}
          onOpenChange={(o) => {
            setAddContactsOpen(o);
            if (!o) setAddContactsTarget(null);
          }}
          workspaceId={workspaceId ?? ""}
          listId={addContactsTarget.id}
          listContactCount={addContactsTarget.contact_count}
          onAdd={handleAddContacts}
        />
      )}

    </main>
  );
}

// ─── Page wrapped in ToastProvider ────────────────────────────────────────────

export default function ListsPage() {
  return (
    <ToastProvider>
      <ListsPageInner />
    </ToastProvider>
  );
}

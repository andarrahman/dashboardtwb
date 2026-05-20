"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RiUploadLine,
  RiAddLine,
  RiSearchLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiErrorWarningLine,
  RiRefreshLine,
  RiCloseLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ContactQuickView } from "@/components/contacts/contact-quick-view";
import { RowMenu } from "@/components/contacts/row-menu";
import { DeleteContactDialog } from "@/components/contacts/delete-contact-dialog";
import { ToastProvider, useToast } from "@/components/ui/toast";
import {
  getContacts,
  getContactFilterOptions,
  getContactTabCounts,
  softDeleteContact,
  restoreContact,
} from "@/lib/queries/contacts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ContactTabCounts } from "@/lib/queries/contacts";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { FilterDropdown } from "@/components/ui/filter-dropdown";
import type { ContactRow, AccountTier, ContactType } from "@/lib/supabase/types";
import type { ContactFilterOptions } from "@/lib/queries/contacts";
import { createClient } from "@/lib/supabase/browser";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  ID: "🇮🇩 Indonesia", MY: "🇲🇾 Malaysia", SG: "🇸🇬 Singapore",
  PH: "🇵🇭 Philippines", VN: "🇻🇳 Vietnam", TH: "🇹🇭 Thailand",
  US: "🇺🇸 United States", GB: "🇬🇧 United Kingdom",
};

function countryLabel(code: string) {
  return COUNTRY_NAMES[code] ?? code;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function TierBadge({ tier }: { tier: AccountTier | null }) {
  if (!tier) return <span className="text-foreground-muted">—</span>;
  const labels: Record<AccountTier, string> = {
    premium_creator:   "★ Premium Creator",
    premium_supporter: "Premium Supporter",
    free:              "Free",
  };
  const variants: Record<AccountTier, "accent" | "neutral"> = {
    premium_creator:   "accent",
    premium_supporter: "neutral",
    free:              "neutral",
  };
  return (
    <Badge variant={variants[tier]} size="sm">
      {labels[tier]}
    </Badge>
  );
}

function FlagDot({ country }: { country: string | null }) {
  if (!country) return <span className="text-foreground-muted">—</span>;
  return <span>{countryLabel(country)}</span>;
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

// ─── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-b-0 animate-pulse">
      <td className="px-4 py-4 sticky left-0 z-10 bg-background">
        <div className="size-4 rounded bg-border" />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-border" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 rounded bg-border" />
            <div className="h-2.5 w-48 rounded bg-border" />
          </div>
        </div>
      </td>
      {[...Array(8)].map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3 w-20 rounded bg-border" />
        </td>
      ))}
      <td className="px-4 py-4" />
    </tr>
  );
}

// ─── Pagination window helper ──────────────────────────────────────────────────

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

// ─── Inner page (needs toast context) ─────────────────────────────────────────

const PAGE_SIZE = 20;

const filterTabs = [
  { label: "All contacts",        type: undefined },
  { label: "Twibbonize User",     type: "twibbonize" as const },
  { label: "Non-Twibbonize User", type: "external" as const },
];

function ContactsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspaceId, loading: wsLoading, error: wsError } = useWorkspace();
  const { showToast } = useToast();

  const [contacts, setContacts] = React.useState<ContactRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [dataError, setDataError] = React.useState<string | null>(null);

  const [activeTabIdx, setActiveTabIdx] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  const [typeFilter,    setTypeFilter]    = React.useState<string[]>([]);
  const [tierFilter,    setTierFilter]    = React.useState<string[]>([]);
  const [countryFilter, setCountryFilter] = React.useState<string[]>([]);
  const [segmentFilter, setSegmentFilter] = React.useState<string[]>([]);
  const [useCaseFilter, setUseCaseFilter] = React.useState<string[]>([]);

  const [filterOptions, setFilterOptions] = React.useState<ContactFilterOptions>({
    segments: [], countries: [], useCases: [],
  });

  const [tabCounts, setTabCounts] = React.useState<ContactTabCounts>({
    total: 0, twibbonize: 0, external: 0,
  });

  const [quickViewContact, setQuickViewContact] = React.useState<ContactRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = React.useState<ContactRow | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // Bulk select + confirm dialog
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);

  // Guard against React StrictMode double-firing the URL-param toast
  const didHandleParams = React.useRef(false);

  // Bump to trigger a data refetch (e.g. after undo from edit-page delete)
  const [refetchKey, setRefetchKey] = React.useState(0);

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Load filter options + tab counts once when workspace is ready
  React.useEffect(() => {
    if (!workspaceId) return;
    getContactFilterOptions(workspaceId).then(setFilterOptions);
    getContactTabCounts(workspaceId).then(setTabCounts);
  }, [workspaceId]);

  // Handle URL params — waits for workspaceId so counts can be refreshed immediately
  React.useEffect(() => {
    if (didHandleParams.current || !workspaceId) return;

    const created = searchParams.get("created");
    const name = searchParams.get("name");
    const edited = searchParams.get("edited");
    const deleted = searchParams.get("deleted");

    if (!created && !edited && !deleted) return;

    didHandleParams.current = true;

    if (created && name) {
      showToast({
        title: `Contact added · ${name}`,
        subtitle: "Saved just now",
        action: {
          label: "View contact →",
          onClick: () => router.push(`/contacts/${created}`),
        },
      });
      router.replace("/contacts", { scroll: false });
      // Refresh counts — new contact was just added
      getContactTabCounts(workspaceId).then(setTabCounts);
    } else if (edited && name) {
      showToast({
        title: `Contact updated · ${name}`,
        subtitle: "Changes saved",
        action: {
          label: "View contact →",
          onClick: () => router.push(`/contacts/${edited}`),
        },
      });
      router.replace("/contacts", { scroll: false });
    } else if (deleted) {
      const deletedId   = searchParams.get("id");
      const deletedName = searchParams.get("name");
      showToast({
        title: deletedName ? `${deletedName} moved to trash` : "Contact moved to trash",
        subtitle: "Recoverable for 30 days",
        action: deletedId ? {
          label: "Undo →",
          onClick: async () => {
            if (!workspaceId) return;
            const { error } = await restoreContact(workspaceId, deletedId);
            if (!error) {
              setRefetchKey((k) => k + 1);
              getContactTabCounts(workspaceId).then(setTabCounts);
            }
          },
        } : undefined,
      });
      router.replace("/contacts", { scroll: false });
      getContactTabCounts(workspaceId).then(setTabCounts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // Fetch contacts whenever workspace / filters / page change
  React.useEffect(() => {
    if (!workspaceId) return;

    setDataLoading(true);
    setDataError(null);

    const tabType = filterTabs[activeTabIdx].type;
    const resolvedTypes: ContactType[] = typeFilter.length > 0
      ? typeFilter as ContactType[]
      : tabType ? [tabType] : [];

    getContacts({
      workspaceId,
      search: debouncedSearch || undefined,
      types:    resolvedTypes.length ? resolvedTypes : undefined,
      tiers:    tierFilter.length    ? tierFilter as AccountTier[] : undefined,
      countries: countryFilter.length ? countryFilter : undefined,
      segments:  segmentFilter.length ? segmentFilter : undefined,
      useCases:  useCaseFilter.length ? useCaseFilter : undefined,
      page,
      pageSize: PAGE_SIZE,
    }).then(({ data, count, error }) => {
      if (error) {
        setDataError(error);
      } else {
        setContacts(data);
        setTotal(count);
        setSelectedIds(new Set()); // clear selection on every fetch
      }
      setDataLoading(false);
    });
  }, [workspaceId, activeTabIdx, debouncedSearch,
      typeFilter, tierFilter, countryFilter, segmentFilter, useCaseFilter, page, refetchKey]);

  function openQuickView(c: ContactRow) {
    setQuickViewContact(c);
    setQuickViewOpen(true);
  }

  function handleDeleteRequest(c: ContactRow) {
    setDeleteTarget(c);
    setDeleteOpen(true);
  }

  async function handleDeleteConfirm(c: ContactRow) {
    if (!workspaceId) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await softDeleteContact(workspaceId, c.id, user.id);

    if (!error) {
      setContacts((prev) => prev.filter((x) => x.id !== c.id));
      setTotal((prev) => Math.max(0, prev - 1));
      setTabCounts((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        twibbonize: c.type === "twibbonize" ? Math.max(0, prev.twibbonize - 1) : prev.twibbonize,
        external: c.type === "external" ? Math.max(0, prev.external - 1) : prev.external,
      }));
      showToast({
        title: `${c.name} moved to trash`,
        subtitle: "Recoverable for 30 days",
        action: {
          label: "Undo →",
          onClick: async () => {
            if (!workspaceId) return;
            const { error } = await restoreContact(workspaceId, c.id);
            if (!error) {
              setContacts((prev) => [c, ...prev]);
              setTotal((prev) => prev + 1);
              setTabCounts((prev) => ({
                ...prev,
                total: prev.total + 1,
                twibbonize: c.type === "twibbonize" ? prev.twibbonize + 1 : prev.twibbonize,
                external:   c.type === "external"   ? prev.external   + 1 : prev.external,
              }));
            }
          },
        },
      });
    }

    setDeleteOpen(false);
    setDeleteTarget(null);
  }

  async function handleBulkDelete() {
    if (!workspaceId || selectedIds.size === 0) return;
    setBulkDeleting(true);
    setBulkConfirmOpen(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBulkDeleting(false); return; }

    const ids = [...selectedIds];
    const removedContacts = contacts.filter((c) => selectedIds.has(c.id));
    const twibCount = removedContacts.filter((c) => c.type === "twibbonize").length;
    const extCount  = removedContacts.filter((c) => c.type === "external").length;

    await Promise.all(ids.map((id) => softDeleteContact(workspaceId, id, user.id)));

    setContacts((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setTotal((prev) => Math.max(0, prev - ids.length));
    setTabCounts((prev) => ({
      ...prev,
      total:      Math.max(0, prev.total      - ids.length),
      twibbonize: Math.max(0, prev.twibbonize - twibCount),
      external:   Math.max(0, prev.external   - extCount),
    }));
    setSelectedIds(new Set());
    setBulkDeleting(false);
    showToast({
      title: `${ids.length} contact${ids.length > 1 ? "s" : ""} moved to trash`,
      subtitle: "Recoverable for 30 days",
      action: {
        label: "Undo →",
        onClick: async () => {
          if (!workspaceId) return;
          await Promise.all(ids.map((id) => restoreContact(workspaceId, id)));
          setContacts((prev) => [...removedContacts, ...prev]);
          setTotal((prev) => prev + ids.length);
          setTabCounts((prev) => ({
            ...prev,
            total:      prev.total      + ids.length,
            twibbonize: prev.twibbonize + twibCount,
            external:   prev.external   + extCount,
          }));
        },
      },
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageFirst = (page - 1) * PAGE_SIZE + 1;
  const pageLast = Math.min(page * PAGE_SIZE, total);

  const isLoading = wsLoading || dataLoading;
  const error = wsError ?? dataError;
  const hasActiveFilters =
    typeFilter.length > 0 || tierFilter.length > 0 ||
    countryFilter.length > 0 || segmentFilter.length > 0 ||
    useCaseFilter.length > 0;

  return (
    <main className="px-12 py-10 max-w-[1760px] mx-auto">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        Workspace · CRM
      </p>
      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-title-h2 font-bold">Contacts</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            {wsLoading ? "Loading…" : `${tabCounts.total.toLocaleString()} records`}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="md">
            <RiUploadLine size={16} />
            Import CSV
          </Button>
          <Button variant="primary" size="md" onClick={() => router.push("/contacts/new")}>
            <RiAddLine size={16} />
            New contact
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 inline-flex items-center gap-1 rounded-full p-1 overflow-x-auto" style={{ backgroundColor: "#F0F7F7" }}>
        {filterTabs.map((t, i) => {
          const isActive = activeTabIdx === i;
          const count = t.type === "twibbonize"
            ? tabCounts.twibbonize
            : t.type === "external"
            ? tabCounts.external
            : tabCounts.total;

          return (
            <button
              key={t.label}
              onClick={() => { setActiveTabIdx(i); setPage(1); }}
              className={[
                "inline-flex items-center gap-2 rounded-full px-4 h-9 text-sm font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "bg-white text-foreground shadow-sm"
                  : "text-foreground-subtle hover:text-foreground",
              ].join(" ")}
            >
              {t.label}
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums transition-colors",
                  isActive ? "text-foreground" : "text-foreground-muted",
                ].join(" ")}
                style={isActive ? { backgroundColor: "#F0F7F7" } : undefined}
              >
                {wsLoading ? "—" : count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters + search */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            label="Type"
            values={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
            options={[
              { value: "twibbonize", label: "Twibbonize User" },
              { value: "external",   label: "External" },
            ]}
          />
          <FilterDropdown
            label="Tier"
            values={tierFilter}
            onChange={(v) => { setTierFilter(v); setPage(1); }}
            options={[
              { value: "premium_creator",   label: "★ Premium Creator" },
              { value: "premium_supporter", label: "Premium Supporter" },
              { value: "free",              label: "Free" },
            ]}
          />
          <FilterDropdown
            label="Country"
            values={countryFilter}
            onChange={(v) => { setCountryFilter(v); setPage(1); }}
            options={filterOptions.countries.map((c) => ({
              value: c,
              label: countryLabel(c),
            }))}
          />
          <FilterDropdown
            label="Segment"
            values={segmentFilter}
            onChange={(v) => { setSegmentFilter(v); setPage(1); }}
            options={filterOptions.segments.map((s) => ({ value: s, label: s }))}
          />
          <FilterDropdown
            label="Use case"
            values={useCaseFilter}
            onChange={(v) => { setUseCaseFilter(v); setPage(1); }}
            options={filterOptions.useCases.map((u) => ({ value: u, label: u }))}
          />

          {(typeFilter.length || tierFilter.length || countryFilter.length || segmentFilter.length || useCaseFilter.length) ? (
            <button
              onClick={() => {
                setTypeFilter([]);
                setTierFilter([]);
                setCountryFilter([]);
                setSegmentFilter([]);
                setUseCaseFilter([]);
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 h-10 text-sm font-medium text-foreground-subtle hover:text-foreground hover:bg-background-subtle transition-colors"
            >
              <RiCloseLine size={14} />
              Clear all
            </button>
          ) : null}
        </div>

        <div className="relative w-full max-w-sm">
          <RiSearchLine
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted"
          />
          <input
            type="search"
            placeholder="Name, email, WhatsApp…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-10 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm outline-none placeholder:text-foreground-muted focus:border-primary focus:ring-3 focus:ring-primary/10"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 flex items-center gap-3 text-sm text-destructive">
          <RiErrorWarningLine size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary-subtle px-4 py-3">
          <span className="text-sm font-medium">
            {selectedIds.size} contact{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-foreground-subtle hover:text-foreground transition-colors"
            >
              Clear
            </button>
            <Button variant="destructive" size="sm" onClick={() => setBulkConfirmOpen(true)} disabled={bulkDeleting}>
              {bulkDeleting ? "Deleting…" : `Delete ${selectedIds.size}`}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-background [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-border bg-background-subtle text-left text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <th className="w-10 px-4 py-3 sticky left-0 z-10 bg-background-subtle">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border cursor-pointer"
                  checked={contacts.length > 0 && selectedIds.size === contacts.length}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < contacts.length;
                  }}
                  onChange={() => {
                    if (selectedIds.size === contacts.length) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(contacts.map((c) => c.id)));
                    }
                  }}
                />
              </th>
              <th className="px-4 py-3 sticky left-10 z-10 bg-background-subtle">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">Use Case</th>
              <th className="px-4 py-3">Total Campaigns</th>
              <th className="px-4 py-3">Latest Activity</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
              : contacts.length === 0
              ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-foreground-muted" suppressHydrationWarning>
                    <RiRefreshLine size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                      {debouncedSearch || hasActiveFilters ? "No contacts found" : "No contacts yet"}
                    </p>
                    <p className="text-xs mt-1">
                      {debouncedSearch
                        ? `No matches for "${debouncedSearch}"`
                        : hasActiveFilters
                        ? "Try adjusting or clearing your filters"
                        : "Add your first contact to get started"}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={() => {
                          setTypeFilter([]); setTierFilter([]); setCountryFilter([]);
                          setSegmentFilter([]); setUseCaseFilter([]); setPage(1);
                        }}
                        className="mt-3 text-xs font-medium text-primary hover:underline"
                      >
                        Clear all filters
                      </button>
                    )}
                  </td>
                </tr>
              )
              : contacts.map((c) => {
                const ini = initials(c.name);
                const toneIdx = (c.name.charCodeAt(0) % 5);
                const tones = [
                  "bg-turquoise-100 text-turquoise-700",
                  "bg-amber-100 text-amber-700",
                  "bg-violet-100 text-violet-700",
                  "bg-rose-100 text-rose-700",
                  "bg-sky-100 text-sky-700",
                ];
                return (
                  <tr
                    key={c.id}
                    onClick={() => openQuickView(c)}
                    className="group border-b border-border last:border-b-0 hover:bg-background-subtle cursor-pointer"
                  >
                    <td className="px-4 py-4 sticky left-0 z-10 bg-background group-hover:bg-background-subtle" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border cursor-pointer"
                        checked={selectedIds.has(c.id)}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-4 py-4 sticky left-10 z-10 bg-background group-hover:bg-background-subtle">
                      <div className="flex items-center gap-3">
                        <Avatar initials={ini} size="md" tone={tones[toneIdx]} />
                        <div className="min-w-0">
                          <p className="font-semibold line-clamp-2">{c.name}</p>
                          <p className="text-xs text-foreground-muted truncate max-w-[260px]">
                            {c.email ?? c.instagram_handle ?? c.whatsapp_number ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={c.type === "twibbonize" ? "twibbonize" : "external"}
                        size="sm"
                        dot
                        dotColor={c.type === "twibbonize" ? "var(--primary)" : "var(--destructive)"}
                      >
                        {c.type === "twibbonize" ? "Twibbonize" : "External"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <FlagDot country={c.country} />
                    </td>
                    <td className="px-4 py-4">
                      <TierBadge tier={c.account_tier} />
                    </td>
                    <td className="px-4 py-4">
                      {c.segment
                        ? <Badge variant="neutral" size="sm">{c.segment}</Badge>
                        : <span className="text-foreground-muted">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      {c.use_case_category
                        ? <Badge variant="accent" size="sm">{c.use_case_category}</Badge>
                        : <span className="text-foreground-muted">—</span>}
                    </td>
                    <td className="px-4 py-4 font-medium">
                      {c.total_campaigns != null
                        ? c.total_campaigns.toLocaleString()
                        : <span className="text-foreground-muted">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{relativeDate(c.latest_campaign_at)}</p>
                      <p className="text-xs text-foreground-muted">
                        {c.latest_campaign_at
                          ? new Date(c.latest_campaign_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        contact={c}
                        onDelete={handleDeleteRequest}
                        onSynced={(updated) =>
                          setContacts((prev) =>
                            prev.map((x) => (x.id === updated.id ? updated : x))
                          )
                        }
                      />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-foreground-muted">
            Showing {pageFirst}–{pageLast} of {total.toLocaleString()}
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
                  className={[
                    "size-9 rounded-full text-sm font-medium transition-colors",
                    page === p
                      ? "bg-primary text-white font-semibold"
                      : "text-foreground-subtle hover:bg-background-subtle",
                  ].join(" ")}
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

      {/* Quick-view popup */}
      <ContactQuickView
        contact={quickViewContact}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
      />

      {/* Bulk delete confirmation dialog */}
      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent size="sm" hideClose>
          <div className="p-6">
            <DialogTitle className="text-base font-semibold">
              Delete {selectedIds.size} contact{selectedIds.size > 1 ? "s" : ""}?
            </DialogTitle>
            <p className="mt-2 text-sm text-foreground-muted">
              {selectedIds.size} contact{selectedIds.size > 1 ? "s" : ""} will be moved to trash.
              You can undo this immediately after.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setBulkConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? "Deleting…" : `Delete ${selectedIds.size}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <DeleteContactDialog
        contact={deleteTarget}
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </main>
  );
}

// ─── Page wrapped in ToastProvider ────────────────────────────────────────────

export default function ContactsPage() {
  return (
    <ToastProvider>
      <ContactsPageInner />
    </ToastProvider>
  );
}

"use client";

import * as React from "react";
import { RiSearchLine, RiCloseLine, RiAddLine, RiLoaderLine } from "@remixicon/react";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getContactsNotInList } from "@/lib/queries/crm-lists";
import type { ContactRow, AccountTier } from "@/lib/supabase/types";

const TONES = [
  "bg-turquoise-100 text-turquoise-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
];

function avatarTone(name: string) {
  return TONES[name.charCodeAt(0) % TONES.length];
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
  if (!tier) return null;
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
    <Badge variant={variants[tier]} size="xs">
      {labels[tier]}
    </Badge>
  );
}

const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All tiers" },
  { value: "premium_creator", label: "★ Premium Creator" },
  { value: "premium_supporter", label: "Premium Supporter" },
  { value: "free", label: "Free" },
];

const PAGE_SIZE = 20;

interface AddContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  listId: string;
  listContactCount: number;
  onAdd: (contactIds: string[]) => Promise<void>;
}

export function AddContactsModal({
  open,
  onOpenChange,
  workspaceId,
  listId,
  listContactCount,
  onAdd,
}: AddContactsModalProps) {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [tier, setTier] = React.useState("");
  const [contacts, setContacts] = React.useState<ContactRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const lastClickedIdx = React.useRef<number | null>(null);

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset on open/close
  React.useEffect(() => {
    if (open) {
      setSearch("");
      setDebouncedSearch("");
      setTier("");
      setPage(1);
      setSelected(new Set());
      setContacts([]);
    }
  }, [open]);

  // Fetch contacts
  React.useEffect(() => {
    if (!open || !workspaceId || !listId) return;
    setLoading(true);
    getContactsNotInList(workspaceId, listId, {
      search: debouncedSearch || undefined,
      tier: tier || undefined,
      page,
      pageSize: PAGE_SIZE,
    }).then(({ contacts: c, total: t, error }) => {
      if (!error) {
        if (page === 1) {
          setContacts(c);
        } else {
          setContacts((prev) => [...prev, ...c]);
        }
        setTotal(t);
      }
      setLoading(false);
    });
  }, [open, workspaceId, listId, debouncedSearch, tier, page]);

  function toggleContact(id: string, idx: number, shiftHeld: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftHeld && lastClickedIdx.current !== null) {
        const lo = Math.min(lastClickedIdx.current, idx);
        const hi = Math.max(lastClickedIdx.current, idx);
        const allSelected = contacts.slice(lo, hi + 1).every((c) => next.has(c.id));
        for (let i = lo; i <= hi; i++) {
          if (allSelected) {
            next.delete(contacts[i].id);
          } else {
            next.add(contacts[i].id);
          }
        }
      } else {
        next.has(id) ? next.delete(id) : next.add(id);
      }
      lastClickedIdx.current = idx;
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(contacts.map((c) => c.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      await onAdd([...selected]);
    } finally {
      setAdding(false);
    }
  }

  const hasMore = contacts.length < total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" hideClose className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div>
            <DialogTitle className="text-base font-semibold">
              Add contacts to list
            </DialogTitle>
            <p className="text-sm text-foreground-muted mt-0.5">
              List has {listContactCount} contact{listContactCount !== 1 ? "s" : ""}. Added contacts stay until manually removed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="size-8 inline-flex items-center justify-center rounded-full text-foreground-muted hover:bg-background-subtle hover:text-foreground transition-colors shrink-0"
            aria-label="Close"
          >
            <RiCloseLine size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 flex flex-wrap items-center gap-3 shrink-0 border-b border-border">
          <div className="w-44">
            <Select
              value={tier}
              onChange={(v) => { setTier(v); setPage(1); }}
              options={TIER_OPTIONS}
              placeholder="All tiers"
            />
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <RiSearchLine
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
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

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Select all row */}
          {contacts.length > 0 && (
            <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-background-subtle">
              <span className="text-xs text-foreground-muted">
                {contacts.length} of {total} visible · scroll to load more
              </span>
              <button
                onClick={selected.size > 0 ? clearAll : selectAll}
                className="text-xs font-medium text-primary hover:underline"
              >
                {selected.size > 0 ? "Clear selection" : `Select all ${contacts.length}`}
              </button>
            </div>
          )}

          {contacts.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-foreground-muted">
              <p className="font-medium text-sm">No contacts available</p>
              <p className="text-xs mt-1">All contacts are already in this list, or no matches found.</p>
            </div>
          )}

          <ul className="divide-y divide-border">
            {contacts.map((c, idx) => {
              const isSelected = selected.has(c.id);
              return (
                <li
                  key={c.id}
                  onClick={(e) => toggleContact(c.id, idx, e.shiftKey)}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors select-none",
                    isSelected ? "bg-primary-subtle" : "hover:bg-background-subtle"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleContact(c.id, idx, false)}
                    onClick={(e) => e.stopPropagation()}
                    className="size-4 rounded border-border cursor-pointer shrink-0 accent-primary"
                  />
                  <Avatar
                    initials={initials(c.name)}
                    size="sm"
                    tone={avatarTone(c.name)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-foreground-muted truncate">
                      {[c.email, c.segment, c.country].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <TierBadge tier={c.account_tier} />
                </li>
              );
            })}
          </ul>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center py-3">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}

          {loading && contacts.length === 0 && (
            <div className="flex items-center justify-center py-12 text-foreground-muted">
              <RiLoaderLine size={20} className="animate-spin mr-2" />
              <span className="text-sm">Loading contacts…</span>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-t border-border bg-background">
          <div className="flex items-center gap-3">
            {selected.size > 0 && (
              <span className="inline-flex items-center rounded-full bg-primary text-white text-xs font-semibold px-2.5 py-1">
                {selected.size} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAdd}
              disabled={selected.size === 0 || adding}
            >
              {adding ? (
                "Adding…"
              ) : (
                <>
                  <RiAddLine size={15} />
                  Add {selected.size > 0 ? selected.size : ""} to list
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  RiMore2Fill,
  RiArrowRightLine,
  RiEditLine,
  RiMailLine,
  RiChat3Line,
  RiPhoneLine,
  RiStickyNoteLine,
  RiDeleteBin2Line,
  RiRefreshLine,
  RiCheckboxCircleLine,
  RiFlashlightLine,
} from "@remixicon/react";
import type { ContactRow, AccountTier } from "@/lib/supabase/types";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { updateContact } from "@/lib/queries/contacts";

// ─── Helpers (mirrored from edit page) ───────────────────────────────────────

function extractUsername(profileUrl: string): string {
  const match = profileUrl.match(/twibbonize\.com\/(?:u\/)?([^/?#\s]+)/i);
  if (match) return match[1];
  return profileUrl.trim();
}

function mapScraperTier(raw: string): string {
  const s = (raw ?? "").toLowerCase();
  if (s === "premium_creator" || s === "premium" || s === "diamond") return "premium_creator";
  if (s === "premium_supporter" || s === "gold" || s === "silver") return "premium_supporter";
  if (s === "free" || s === "basic" || !s) return "free";
  return raw;
}

function humanize(raw: string): string {
  if (!raw) return raw;
  const spaced = raw.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RowMenuProps {
  contact: ContactRow;
  onDelete: (contact: ContactRow) => void;
  onSynced?: (updated: ContactRow) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RowMenu({ contact, onDelete, onSynced }: RowMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [syncOk, setSyncOk] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { workspaceId } = useWorkspace();

  const isTwibbonize = contact.type === "twibbonize";

  // Derive username from profile_url only — never fall back to name
  const syncUsername = React.useMemo(() => {
    if (!contact.profile_url) return null;
    const u = extractUsername(contact.profile_url);
    return u || null;
  }, [contact.profile_url]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  function close() { setOpen(false); }

  // Reset sync state when menu closes
  React.useEffect(() => {
    if (!open) {
      setSyncError(null);
      if (syncOk) setSyncOk(false);
    }
  }, [open, syncOk]);

  async function handleSync(e: React.MouseEvent) {
    e.stopPropagation();
    if (!workspaceId || syncing) return;

    if (!syncUsername) return;
    const username = syncUsername;

    setSyncing(true);
    setSyncOk(false);
    setSyncError(null);

    try {
      const res = await fetch("/api/scrape-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setSyncError(data.error ?? "Scrape failed");
        setSyncing(false);
        return;
      }

      // Scraper returns { contact: { ... } }
      const p = data.contact ?? data;

      // Build update payload from scraper output
      const payload: Record<string, unknown> = {};

      if (p.name)                payload.name = p.name;
      if (p.email)               payload.email = p.email;
      if (p.instagram_handle)    payload.instagram_handle = p.instagram_handle;
      if (p.website_url) {
        const url = p.website_url.trim();
        payload.website_url = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      }
      if (p.account_tier)        payload.account_tier = mapScraperTier(p.account_tier) as AccountTier;
      if (p.country)             payload.country = p.country;
      if (p.account_created_at)  payload.account_created_at = p.account_created_at;
      if (p.first_campaign_at)   payload.first_campaign_at = p.first_campaign_at;
      if (p.latest_campaign_at)  payload.latest_campaign_at = p.latest_campaign_at;
      if (p.total_campaigns != null) payload.total_campaigns = Number(p.total_campaigns);
      if (p.total_supporters != null) payload.total_supporters = Number(p.total_supporters);
      if (p.top_supporter_countries?.length)
        payload.top_supporter_countries = p.top_supporter_countries
          .map((c: string) => c.trim().toUpperCase())
          .slice(0, 3);
      if (p.summary_profile)     payload.summary_profile = p.summary_profile;
      if (p.segment)             payload.segment = humanize(p.segment);
      if (p.use_case_category)   payload.use_case_category = humanize(p.use_case_category);

      const { data: updated, error } = await updateContact(workspaceId, contact.id, payload);

      if (error || !updated) {
        setSyncError(error ?? "Failed to save");
        setSyncing(false);
        return;
      }

      setSyncOk(true);
      setSyncing(false);
      onSynced?.(updated);

      // Close after short delay to show success
      setTimeout(() => setOpen(false), 1200);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Network error");
      setSyncing(false);
    }
  }

  const hasEmail = Boolean(contact.email);
  const hasWhatsApp = Boolean(contact.whatsapp_number);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-full p-1.5 hover:bg-background-subtle text-foreground-muted transition-colors"
        aria-label="Row actions"
      >
        <RiMore2Fill size={16} />
      </button>

      {open && (
        <div
          className="absolute right-8 top-0 z-50 min-w-[200px] rounded-xl border border-border bg-background shadow-[var(--shadow-card-bold)] py-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* View full detail */}
          <MenuItem
            icon={<RiArrowRightLine size={15} />}
            label="View full detail"
            trailingIcon={<RiArrowRightLine size={13} className="text-foreground-muted" />}
            onClick={() => { close(); router.push(`/contacts/${contact.id}`); }}
          />

          {/* Edit contact */}
          <MenuItem
            icon={<RiEditLine size={15} />}
            label="Edit contact"
            onClick={() => { close(); router.push(`/contacts/${contact.id}/edit`); }}
          />

          <Divider />

          {/* Sync New Data — Twibbonize only */}
          {isTwibbonize && (
            <button
              onClick={handleSync}
              disabled={syncing || !syncUsername}
              title={!syncUsername ? "No profile URL set — edit contact to add one" : undefined}
              className={[
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
                !syncUsername || syncing ? "opacity-40 cursor-not-allowed" : "hover:bg-background-subtle",
                syncOk ? "text-green-600" : "text-foreground",
              ].join(" ")}
            >
              <span className="shrink-0">
                {syncing ? (
                  <RiRefreshLine size={15} className="animate-spin text-primary" />
                ) : syncOk ? (
                  <RiCheckboxCircleLine size={15} className="text-green-600" />
                ) : (
                  <RiFlashlightLine size={15} className={syncUsername ? "text-primary" : "text-foreground-muted"} />
                )}
              </span>
              <span className="flex-1">
                {syncing ? "Enriching profile… (~30s)" : syncOk ? "Refreshed!" : "Refresh Profile"}
              </span>
            </button>
          )}

          {/* Sync error */}
          {syncError && (
            <p className="px-3 pb-1.5 text-xs text-destructive">{syncError}</p>
          )}

          {isTwibbonize && <Divider />}

          {/* Compose email */}
          <MenuItem
            icon={<RiMailLine size={15} />}
            label="Compose email"
            disabled={!hasEmail}
            onClick={() => {
              if (hasEmail) { close(); window.location.href = `mailto:${contact.email}`; }
            }}
          />

          {/* Send WhatsApp */}
          <MenuItem
            icon={<RiChat3Line size={15} />}
            label="Send WhatsApp"
            disabled={!hasWhatsApp}
            onClick={() => {
              if (hasWhatsApp) {
                close();
                const num = contact.whatsapp_number!.replace(/\D/g, "");
                window.open(`https://wa.me/${num}`, "_blank");
              }
            }}
          />

          {/* Schedule call */}
          <MenuItem icon={<RiPhoneLine size={15} />} label="Schedule call" disabled comingSoon />

          {/* Log note */}
          <MenuItem icon={<RiStickyNoteLine size={15} />} label="Log note" disabled comingSoon />

          <Divider />

          {/* Delete */}
          <MenuItem
            icon={<RiDeleteBin2Line size={15} />}
            label="Delete contact"
            destructive
            onClick={() => { close(); onDelete(contact); }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Divider() {
  return <div className="my-1 border-t border-border" />;
}

function MenuItem({
  icon, label, trailingIcon, onClick, disabled, destructive, comingSoon,
}: {
  icon: React.ReactNode;
  label: string;
  trailingIcon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  comingSoon?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : destructive
          ? "text-destructive hover:bg-destructive-subtle"
          : "text-foreground hover:bg-background-subtle",
      ].join(" ")}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {comingSoon && (
        <span className="text-[10px] font-medium text-foreground-muted bg-background-subtle rounded px-1.5 py-0.5">
          Soon
        </span>
      )}
      {trailingIcon && !comingSoon && <span className="shrink-0">{trailingIcon}</span>}
    </button>
  );
}

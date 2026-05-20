"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  RiArrowLeftLine,
  RiCheckLine,
  RiAtLine,
  RiGlobalLine,
  RiDeleteBin2Line,
  RiFlashlightLine,
  RiRefreshLine,
  RiCheckboxCircleLine,
  RiMailLine,
  RiChat3Line,
  RiPriceTag3Line,
  RiLightbulbLine,
  RiUserLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { createClient } from "@/lib/supabase/browser";
import { getContact, updateContact, softDeleteContact } from "@/lib/queries/contacts";
import { DeleteContactDialog } from "@/components/contacts/delete-contact-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import type { ContactRow, AccountTier } from "@/lib/supabase/types";

// ─── Constants (same as new page) ────────────────────────────────────────────

const TIER_OPTIONS: { value: AccountTier; label: string }[] = [
  { value: "premium_creator", label: "★ Premium Creator" },
  { value: "premium_supporter", label: "Premium Supporter" },
  { value: "free", label: "Free" },
];

const COUNTRY_OPTIONS = [
  { value: "ID", label: "Indonesia" },
  { value: "MY", label: "Malaysia" },
  { value: "SG", label: "Singapore" },
  { value: "PH", label: "Philippines" },
  { value: "VN", label: "Vietnam" },
  { value: "TH", label: "Thailand" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "JP", label: "Japan" },
  { value: "KR", label: "Korea" },
  { value: "IN", label: "India" },
  { value: "CN", label: "China" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "NL", label: "Netherlands" },
];

const SEGMENT_OPTIONS = [
  "Indie creator",
  "Brand prospect",
  "Influencer",
  "Agency",
  "Corporate",
  "NGO",
  "Government",
];

const USE_CASE_OPTIONS = [
  "Fundraiser",
  "Co-marketing",
  "Brand awareness",
  "Community building",
  "Event promotion",
  "Product launch",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function isValidWhatsApp(v: string) {
  return /^\+?[\d\s\-()+]{7,}$/.test(v.trim());
}

function normalizeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function humanize(raw: string): string {
  if (!raw) return raw;
  const spaced = raw.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function mapScraperTier(raw: string): string {
  const s = (raw ?? "").toLowerCase();
  if (s === "premium_creator" || s === "premium" || s === "diamond") return "premium_creator";
  if (s === "premium_supporter" || s === "gold" || s === "silver") return "premium_supporter";
  if (s === "free" || s === "basic" || !s) return "free";
  return raw; // unknown — pass through
}

function tierLabel(tier: string): string {
  const map: Record<string, string> = {
    premium_creator: "★ Premium Creator",
    premium_supporter: "Premium Supporter",
    free: "Free",
  };
  return map[tier] ?? tier;
}

function extractUsername(profileUrl: string): string {
  const match = profileUrl.match(/twibbonize\.com\/(?:u\/)?([^/?#\s]+)/i);
  if (match) return match[1];
  return profileUrl.trim();
}

// ─── Input styles ─────────────────────────────────────────────────────────────

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-foreground-muted focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-colors";

// Pill-shaped trigger — matches Paper "Dropdown / Date Picker" component spec
const selectClass =
  "h-10 w-full rounded-full border border-border bg-background px-[18px] text-sm font-medium outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-colors disabled:opacity-50 disabled:bg-[#F0F7F7] disabled:cursor-not-allowed appearance-none cursor-pointer";

const dateInputClass =
  "h-10 w-full rounded-full border border-border bg-background px-[18px] text-sm font-medium outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-colors disabled:opacity-50 disabled:bg-[#F0F7F7] disabled:cursor-not-allowed";

const labelClass = "text-sm font-medium text-foreground mb-1.5 block";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatRelative(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Form state shape ─────────────────────────────────────────────────────────

interface FormData {
  name: string;
  email: string;
  whatsapp_number: string;
  instagram_handle: string;
  website_url: string;
  profile_url: string;
  account_tier: string;
  country: string;
  account_created_at: string;
  first_campaign_at: string;
  latest_campaign_at: string;
  total_campaigns: string;
  total_supporters: string;
  top_supporter_countries: string;
  summary_profile: string;
  segment: string;
  use_case_category: string;
}

function contactToForm(c: ContactRow): FormData {
  return {
    name: c.name ?? "",
    email: c.email ?? "",
    whatsapp_number: c.whatsapp_number ?? "",
    instagram_handle: c.instagram_handle ?? "",
    website_url: c.website_url ?? "",
    profile_url: c.profile_url ?? "",
    account_tier: c.account_tier ?? "",
    country: c.country ?? "",
    account_created_at: c.account_created_at ? c.account_created_at.slice(0, 10) : "",
    first_campaign_at: c.first_campaign_at ? c.first_campaign_at.slice(0, 10) : "",
    latest_campaign_at: c.latest_campaign_at ? c.latest_campaign_at.slice(0, 10) : "",
    total_campaigns: c.total_campaigns != null ? String(c.total_campaigns) : "",
    total_supporters: c.total_supporters != null ? String(c.total_supporters) : "",
    top_supporter_countries: (c.top_supporter_countries ?? []).join(", "),
    summary_profile: c.summary_profile ?? "",
    segment: c.segment ?? "",
    use_case_category: c.use_case_category ?? "",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-6">
      {children}
    </div>
  );
}

function SectionHeader({
  step,
  title,
  badge,
}: {
  step: number;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="size-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
        {step}
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      {badge && (
        <Badge variant="neutral" size="xs">
          {badge}
        </Badge>
      )}
    </div>
  );
}

function InputWithPrefix({
  prefixIcon,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> & { prefixIcon: React.ReactNode }) {
  return (
    <div className="relative flex items-center">
      <span className="absolute left-3 flex items-center text-foreground-muted text-sm">
        {prefixIcon}
      </span>
      <input {...props} className={inputClass + " pl-8"} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditContactPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const contactId = params.id;

  const { workspaceId } = useWorkspace();

  const [contact, setContact] = React.useState<ContactRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<FormData | null>(null);
  const [originalForm, setOriginalForm] = React.useState<FormData | null>(null);
  const [touched, setTouched] = React.useState<Partial<Record<keyof FormData, boolean>>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Dynamic options — grow if contact has a value not in the predefined list
  const [dynSegmentOptions, setDynSegmentOptions] = React.useState<string[]>(SEGMENT_OPTIONS);
  const [dynUseCaseOptions, setDynUseCaseOptions] = React.useState<string[]>(USE_CASE_OPTIONS);
  const [dynTierOptions, setDynTierOptions] = React.useState(TIER_OPTIONS);
  const [dynCountryOptions, setDynCountryOptions] = React.useState(COUNTRY_OPTIONS);

  // Scraper state
  const [scraping, setScraping] = React.useState(false);
  const [scrapeOk, setScrapeOk] = React.useState(false);
  const [scrapeError, setScrapeError] = React.useState<string | null>(null);

  async function handleScrape() {
    const raw = form?.profile_url?.trim() ?? "";
    const username = extractUsername(raw);
    if (!username || scraping) return;

    setScraping(true);
    setScrapeOk(false);
    setScrapeError(null);

    try {
      const res = await fetch("/api/scrape-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setScrapeError(data.error ?? "Scrape failed");
        return;
      }

      const c = data.contact ?? {};

      function addOpt<T extends { value: string; label: string }>(
        setter: React.Dispatch<React.SetStateAction<T[]>>,
        list: T[],
        value: string,
        label: string
      ) {
        if (!list.some((o) => o.value === value))
          setter((prev) => [...prev, { value, label } as T]);
      }
      function addStr(
        setter: React.Dispatch<React.SetStateAction<string[]>>,
        list: string[],
        value: string
      ) {
        if (!list.includes(value)) setter((prev) => [...prev, value]);
      }

      if (c.name) set("name", c.name);
      if (c.instagram_handle) set("instagram_handle", c.instagram_handle);
      if (c.website_url) set("website_url", c.website_url);
      if (c.summary_profile) set("summary_profile", c.summary_profile.slice(0, 500));
      if (c.account_created_at) set("account_created_at", c.account_created_at.substring(0, 10));
      if (c.first_campaign_at)  set("first_campaign_at",  c.first_campaign_at.substring(0, 10));
      if (c.latest_campaign_at) set("latest_campaign_at", c.latest_campaign_at.substring(0, 10));
      if (c.total_campaigns != null) set("total_campaigns", String(c.total_campaigns));
      if (c.total_supporters != null) set("total_supporters", String(c.total_supporters));

      if (c.account_tier) {
        const tier = mapScraperTier(c.account_tier);
        addOpt(setDynTierOptions, dynTierOptions, tier, tierLabel(tier));
        set("account_tier", tier);
      }
      if (c.country) {
        addOpt(setDynCountryOptions, dynCountryOptions, c.country, c.country);
        set("country", c.country);
      }
      if (c.segment) {
        const seg = humanize(c.segment);
        addStr(setDynSegmentOptions, dynSegmentOptions, seg);
        set("segment", seg);
      }
      if (c.use_case_category) {
        const uc = humanize(c.use_case_category);
        addStr(setDynUseCaseOptions, dynUseCaseOptions, uc);
        set("use_case_category", uc);
      }

      setScrapeOk(true);
      setTimeout(() => setScrapeOk(false), 4000);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Network error");
    } finally {
      setScraping(false);
    }
  }

  function touch(field: keyof FormData) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // Load contact
  React.useEffect(() => {
    if (!workspaceId || !contactId) return;
    setLoading(true);
    getContact(workspaceId, contactId).then(({ data, error }) => {
      if (error || !data) {
        setLoadError(error ?? "Contact not found.");
      } else {
        setContact(data);
        const f = contactToForm(data);
        setForm(f);
        setOriginalForm(f);

        // If the contact's segment/use_case is not in the predefined list, add it dynamically
        if (f.segment && !SEGMENT_OPTIONS.includes(f.segment)) {
          setDynSegmentOptions((prev) => [...prev, f.segment]);
        }
        if (f.use_case_category && !USE_CASE_OPTIONS.includes(f.use_case_category)) {
          setDynUseCaseOptions((prev) => [...prev, f.use_case_category]);
        }
      }
      setLoading(false);
    });
  }, [workspaceId, contactId]);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  const isDirty = React.useMemo(() => {
    if (!form || !originalForm) return false;
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  }, [form, originalForm]);

  // Keyboard shortcut — only fires when there are actual changes
  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (isDirty) handleSubmit();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  async function handleSubmit() {
    if (!workspaceId || !contact || !form) return;

    const nameInvalid = !form.name.trim();
    const emailInvalid = !!(form.email && !isValidEmail(form.email));
    const waInvalid = !!(form.whatsapp_number && !isValidWhatsApp(form.whatsapp_number));

    if (nameInvalid || emailInvalid || waInvalid) {
      setTouched((prev) => ({ ...prev, name: true, email: true, whatsapp_number: true }));
      setSubmitError(nameInvalid ? "Name is required." : "Please fix the highlighted fields before saving.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const isTwibbonize = contact.type === "twibbonize";

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      whatsapp_number: form.whatsapp_number.trim() || null,
      instagram_handle: form.instagram_handle.trim() || null,
      website_url: normalizeUrl(form.website_url),
      profile_url: isTwibbonize ? form.profile_url.trim() || null : undefined,
      account_tier: isTwibbonize
        ? (form.account_tier as AccountTier) || null
        : undefined,
      country: isTwibbonize ? form.country || null : undefined,
      account_created_at: isTwibbonize ? form.account_created_at || null : undefined,
      first_campaign_at: isTwibbonize ? form.first_campaign_at || null : undefined,
      latest_campaign_at: isTwibbonize ? form.latest_campaign_at || null : undefined,
      total_campaigns:
        isTwibbonize && form.total_campaigns
          ? parseInt(form.total_campaigns, 10)
          : isTwibbonize
          ? null
          : undefined,
      total_supporters:
        isTwibbonize && form.total_supporters
          ? parseInt(form.total_supporters, 10)
          : isTwibbonize
          ? null
          : undefined,
      top_supporter_countries:
        isTwibbonize
          ? form.top_supporter_countries.trim()
            ? form.top_supporter_countries
                .split(",")
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean)
                .slice(0, 3)
            : null
          : undefined,
      summary_profile: form.summary_profile.trim() || null,
      segment: form.segment || null,
      use_case_category: form.use_case_category || null,
    };

    const { error } = await updateContact(workspaceId, contact.id, payload);

    if (error) {
      setSubmitError(error);
      setSubmitting(false);
      return;
    }

    router.push(
      `/contacts?edited=${contact.id}&name=${encodeURIComponent(form.name.trim())}`
    );
  }

  async function handleDelete(c: ContactRow) {
    if (!workspaceId) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await softDeleteContact(workspaceId, c.id, user.id);
    setDeleteOpen(false);
    router.push(`/contacts?deleted=true&id=${c.id}&name=${encodeURIComponent(c.name)}&dtype=${c.type}`);
  }

  // ─── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-12 py-10">
        <div className="max-w-[1120px] animate-pulse space-y-4">
          <div className="h-5 w-32 rounded bg-border" />
          <div className="h-8 w-64 rounded bg-border" />
          <div className="h-40 rounded-xl bg-border" />
        </div>
      </div>
    );
  }

  if (loadError || !contact || !form) {
    return (
      <div className="px-10 py-10 text-sm text-destructive">
        {loadError ?? "Contact not found."}
      </div>
    );
  }

  const isTwibbonize = contact.type === "twibbonize";
  const ini = initials(contact.name);
  const tone = avatarTone(contact.name);
  const summaryLen = form.summary_profile.length;

  return (
    <main className="px-12 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-foreground-muted mb-6">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <RiArrowLeftLine size={14} />
          Back
        </Link>
        <span>/</span>
        <span>Contacts</span>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[180px]">
          {contact.name}
        </span>
        <span>/</span>
        <span className="text-foreground font-medium">Edit</span>
      </div>

      <div className="max-w-[1760px] mx-auto">
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-10 xl:items-start">
        {/* ── Left: form ── */}
        <div className="min-w-0">

      {/* Header card */}
      <div className="mb-8 rounded-xl border border-border bg-background p-5 flex items-start gap-4">
        <Avatar initials={ini} size="xl" tone={tone} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1">
            Edit Contact · All fields editable
          </p>
          <p className="text-lg font-bold leading-tight">{contact.name}</p>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            {contact.account_tier && (
              <Badge variant="accent" size="xs">
                {TIER_OPTIONS.find((t) => t.value === contact.account_tier)?.label ??
                  contact.account_tier}
              </Badge>
            )}
            <Badge
              variant={contact.type === "twibbonize" ? "twibbonize" : "external"}
              size="xs"
            >
              {contact.type === "twibbonize" ? "Twibbonize" : "External"}
            </Badge>
          </div>
          <p className="text-xs text-foreground-muted mt-2">
            Created {formatDate(contact.created_at)}
            {contact.updated_at !== contact.created_at && (
              <> · Last edited {formatRelative(contact.updated_at)}</>
            )}
          </p>
        </div>
      </div>

      {/* Form sections */}
      <div className="space-y-6">
        {/* Section 1: Identity */}
        <SectionCard>
          <SectionHeader step={1} title="Identity" />
          <div className="space-y-4">
            <div>
              <label className={labelClass}>
                Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                onBlur={() => touch("name")}
                placeholder="Full name"
                className={[
                  inputClass,
                  touched.name && !form.name.trim() ? "border-destructive focus:border-destructive focus:ring-destructive/10" : "",
                ].join(" ")}
              />
              {touched.name && !form.name.trim() && (
                <p className="mt-1 text-xs text-destructive">Name is required.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  onBlur={() => touch("email")}
                  placeholder="name@example.com"
                  className={[
                    inputClass,
                    touched.email && form.email && !isValidEmail(form.email)
                      ? "border-destructive focus:border-destructive focus:ring-destructive/10"
                      : "",
                  ].join(" ")}
                />
                {touched.email && form.email && !isValidEmail(form.email) && (
                  <p className="mt-1 text-xs text-destructive">Enter a valid email address.</p>
                )}
              </div>
              <div>
                <label className={labelClass}>WhatsApp number</label>
                <input
                  type="tel"
                  value={form.whatsapp_number}
                  onChange={(e) => set("whatsapp_number", e.target.value)}
                  onBlur={() => touch("whatsapp_number")}
                  placeholder="+62 812 000 0000"
                  className={[
                    inputClass,
                    touched.whatsapp_number && form.whatsapp_number && !isValidWhatsApp(form.whatsapp_number)
                      ? "border-destructive focus:border-destructive focus:ring-destructive/10"
                      : "",
                  ].join(" ")}
                />
                {touched.whatsapp_number && form.whatsapp_number && !isValidWhatsApp(form.whatsapp_number) && (
                  <p className="mt-1 text-xs text-destructive">Enter a valid phone number (e.g. +62 812 000 0000).</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Instagram handle</label>
                <InputWithPrefix
                  prefixIcon={<RiAtLine size={14} />}
                  type="text"
                  value={form.instagram_handle}
                  onChange={(e) => set("instagram_handle", e.target.value)}
                  placeholder="username"
                />
              </div>
              <div>
                <label className={labelClass}>Website</label>
                <InputWithPrefix
                  prefixIcon={<RiGlobalLine size={14} />}
                  type="text"
                  value={form.website_url}
                  onChange={(e) => set("website_url", e.target.value)}
                  placeholder="www.example.com"
                />
                <p className="mt-1 text-xs text-foreground-muted">
                  https:// will be added automatically if omitted
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Section 2: Twibbonize profile (Twibbonize only) */}
        {isTwibbonize && (
          <SectionCard>
            <SectionHeader
              step={2}
              title="Twibbonize profile"
              badge="Twibbonize User only"
            />
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Profile URL</label>
                <div className="flex items-center gap-0 rounded-lg border border-border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-colors overflow-hidden">
                  <span className="px-3 text-sm text-foreground-muted bg-background-subtle border-r border-border h-10 flex items-center shrink-0">
                    twibbonize.com /
                  </span>
                  <input
                    type="text"
                    value={form.profile_url}
                    onChange={(e) => set("profile_url", e.target.value)}
                    placeholder="username"
                    className="h-10 flex-1 px-3 text-sm outline-none bg-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Account tier</label>
                  <Select
                    value={form.account_tier}
                    onChange={(v) => set("account_tier", v)}
                    options={TIER_OPTIONS}
                    placeholder="Select tier…"
                  />
                </div>
                <div>
                  <label className={labelClass}>Country</label>
                  <Select
                    value={form.country}
                    onChange={(v) => set("country", v)}
                    options={COUNTRY_OPTIONS}
                    placeholder="Select country…"
                  />
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Section 3: Activity & reach (Twibbonize only) */}
        {isTwibbonize && (
          <SectionCard>
            <SectionHeader
              step={3}
              title="Activity & reach"
              badge="Twibbonize User only"
            />
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Account created</label>
                  <DatePicker
                    value={form.account_created_at}
                    onChange={(v) => set("account_created_at", v)}
                    placeholder="Select date"
                  />
                </div>
                <div>
                  <label className={labelClass}>First campaign</label>
                  <DatePicker
                    value={form.first_campaign_at}
                    onChange={(v) => set("first_campaign_at", v)}
                    placeholder="Select date"
                  />
                </div>
                <div>
                  <label className={labelClass}>Latest campaign</label>
                  <DatePicker
                    value={form.latest_campaign_at}
                    onChange={(v) => set("latest_campaign_at", v)}
                    placeholder="Select date"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Total campaigns</label>
                  <input
                    type="number"
                    min="0"
                    value={form.total_campaigns}
                    onChange={(e) => set("total_campaigns", e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Total supporters</label>
                  <input
                    type="number"
                    min="0"
                    value={form.total_supporters}
                    onChange={(e) => set("total_supporters", e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Top 3 supporter countries</label>
                <input
                  type="text"
                  value={form.top_supporter_countries}
                  onChange={(e) => set("top_supporter_countries", e.target.value)}
                  placeholder="ID, MY, SG"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-foreground-muted">
                  Up to 3 · enter ISO codes (e.g. ID, MY, SG) separated by commas
                </p>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Internal classification */}
        <SectionCard>
          <SectionHeader
            step={isTwibbonize ? 4 : 2}
            title="Internal classification"
          />
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Summary profile</label>
              <div className="relative">
                <textarea
                  value={form.summary_profile}
                  onChange={(e) => set("summary_profile", e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Brief description of this contact…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-foreground-muted focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-colors resize-none"
                />
                <span className="absolute bottom-2.5 right-3 text-xs text-foreground-muted">
                  {summaryLen}/500
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Segment</label>
                <Select
                  value={form.segment}
                  onChange={(v) => set("segment", v)}
                  options={dynSegmentOptions.map((s) => ({ value: s, label: s }))}
                  placeholder="Select segment…"
                />
              </div>
              <div>
                <label className={labelClass}>Use case category</label>
                <Select
                  value={form.use_case_category}
                  onChange={(v) => set("use_case_category", v)}
                  options={dynUseCaseOptions.map((u) => ({ value: u, label: u }))}
                  placeholder="Select use case…"
                />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Inline error */}
      {submitError && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      )}
        </div>{/* end left col */}

        {/* ── Right: preview + scraper (xl+) ── */}
        <div className="hidden xl:flex flex-col gap-4 sticky top-6">

          {/* Preview card */}
          <div className="rounded-xl border border-border bg-background overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Contact preview</p>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className={[
                  "size-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  form?.name ? avatarTone(form.name) : "bg-border text-foreground-muted",
                ].join(" ")}>
                  {form?.name ? initials(form.name) : <RiUserLine size={18} />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {form?.name || <span className="italic text-foreground-muted font-normal">Name not set</span>}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`size-1.5 rounded-full shrink-0 ${contact?.type === "twibbonize" ? "bg-primary" : "bg-amber-500"}`} />
                    <span className="text-xs text-foreground-muted">
                      {contact?.type === "twibbonize" ? "Twibbonize User" : "External"}
                    </span>
                  </div>
                </div>
              </div>
              {/* Field list — rows differ by type, empty fields show "—" */}
              {(() => {
                const isTwib = contact?.type === "twibbonize";
                const rows = [
                  // Common
                  { label: "Email",     value: form?.email || null,           icon: RiMailLine },
                  { label: "WhatsApp",  value: form?.whatsapp_number || null, icon: RiChat3Line },
                  // Twibbonize-only
                  ...(isTwib ? [
                    { label: "Profile",  value: form?.profile_url ? extractUsername(form.profile_url) : null, icon: RiAtLine },
                    { label: "Country",  value: form?.country || null,         icon: RiGlobalLine },
                    { label: "Tier",     value: form?.account_tier ? tierLabel(form.account_tier) : null, icon: null as never },
                  ] : [
                    // External-only
                    { label: "Website",   value: form?.website_url || null,     icon: RiGlobalLine },
                    { label: "Instagram", value: form?.instagram_handle || null, icon: RiAtLine },
                  ]),
                  // Common bottom
                  { label: "Segment",   value: form?.segment || null,          icon: RiPriceTag3Line },
                  { label: "Use case",  value: form?.use_case_category || null, icon: RiLightbulbLine },
                ];
                return (
                  <dl className="flex flex-col divide-y divide-border border-t border-border">
                    {rows.map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                        <dt className="flex items-center gap-1.5 text-xs text-foreground-muted shrink-0">
                          {Icon && <Icon size={12} />}
                          {label}
                        </dt>
                        <dd className={[
                          "text-xs text-right truncate max-w-[180px]",
                          value ? "text-foreground font-medium" : "text-foreground-muted italic",
                        ].join(" ")}>
                          {value ?? "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                );
              })()}
            </div>
          </div>

          {/* ── Get Automatic Data button ── */}
          {contact?.type === "twibbonize" && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleScrape}
                disabled={!form?.profile_url?.trim() || scraping}
                className={[
                  "w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 border",
                  scrapeOk
                    ? "border-green-500 bg-green-50 text-green-700"
                    : form?.profile_url?.trim() && !scraping
                    ? "border-primary bg-primary text-white hover:bg-primary/90 cursor-pointer shadow-sm"
                    : "border-border bg-background-subtle text-foreground-muted cursor-not-allowed",
                ].join(" ")}
              >
                {scraping ? (
                  <><RiRefreshLine size={15} className="animate-spin shrink-0" />Fetching profile data…</>
                ) : scrapeOk ? (
                  <><RiCheckboxCircleLine size={15} className="shrink-0" />Data filled successfully!</>
                ) : (
                  <><RiFlashlightLine size={15} className="shrink-0" />Get Automatic Data</>
                )}
              </button>
              {!form?.profile_url?.trim() && !scraping && (
                <p className="text-xs text-center text-foreground-muted">Enter a Profile URL to enable</p>
              )}
              {scraping && (
                <p className="text-xs text-center text-foreground-muted animate-pulse">Running web enrichment — this may take ~30s</p>
              )}
              {scrapeError && (
                <p className="text-xs text-center text-destructive">{scrapeError}</p>
              )}
            </div>
          )}

          {/* Tips card */}
          <div className="rounded-xl border border-border bg-background-subtle/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">Tips</p>
            <ul className="space-y-2.5 text-xs text-foreground-muted">
              <li className="flex items-start gap-2"><span className="text-primary shrink-0 mt-px">·</span>Name is the only required field</li>
              <li className="flex items-start gap-2"><span className="text-primary shrink-0 mt-px">·</span>WhatsApp format: +62 812 000 0000</li>
              <li className="flex items-start gap-2"><span className="text-primary shrink-0 mt-px">·</span>Website https:// added automatically</li>
              <li className="flex items-start gap-2">
                <span className="text-primary shrink-0 mt-px">·</span>
                Press <kbd className="mx-1 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">⌘↵</kbd> to save
              </li>
            </ul>
          </div>

        </div>{/* end right panel */}
        </div>{/* end two-col grid */}
      </div>{/* end max-w-[1760px] */}

      {/* Footer */}
      <div className="max-w-[1760px] mx-auto sticky bottom-0 mt-8">
        {/* TOP: blur + fully transparent — no background so frosted glass shows through */}
        <div
          className="pointer-events-none h-10"
          style={{
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
          }}
        />
        {/* BOTTOM: solid white bg + pb-3 so nothing shows through beneath the card */}
        <div className="bg-background pb-3">
        <div
          className="rounded-2xl border border-border bg-background px-6 py-4 flex items-center justify-between"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
        >
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
          >
            <RiDeleteBin2Line size={15} />
            Delete contact
          </button>

          <div className="flex items-center gap-4">
            {isDirty && (
              <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
            )}
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("/contacts")}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !form.name.trim() || !isDirty}
              >
                <RiCheckLine size={15} />
                {submitting ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
        </div>{/* end bg-background pb-3 */}
      </div>{/* end sticky wrapper */}

      {/* Delete dialog */}
      <DeleteContactDialog
        contact={contact}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
      />
    </main>
  );
}

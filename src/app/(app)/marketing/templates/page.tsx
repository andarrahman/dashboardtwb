"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiSearchLine,
  RiMoreLine,
  RiEyeLine,
  RiEditLine,
  RiSendPlaneLine,
  RiFileCopyLine,
  RiDownloadLine,
  RiArchiveLine,
  RiDeleteBin2Line,
  RiCloseLine,
  RiCheckLine,
  RiMailLine,
  RiLayoutGridLine,
  RiUploadLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { CreateTemplateModal } from "@/components/marketing/create-template-modal";
import { DeleteTemplateModal } from "@/components/marketing/delete-template-modal";
import { SendTestModal } from "@/components/marketing/send-test-modal";
import { PreviewModal } from "@/components/marketing/preview-modal";
import {
  getMarketingTemplates,
  getTemplateCounts,
  createMarketingTemplate,
  updateMarketingTemplate,
  deleteMarketingTemplate,
  archiveMarketingTemplate,
  duplicateMarketingTemplate,
} from "@/lib/queries/marketing-templates";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { createClient } from "@/lib/supabase/browser";
import { generateEmailHtml } from "@/lib/email-html";
import type { MarketingTemplateRow, TemplateCategory } from "@/lib/supabase/types";
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
  return TONES[(name?.charCodeAt(0) ?? 0) % TONES.length];
}

function nameInitials(name: string) {
  return (name || "?")
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

function categoryLabel(cat: TemplateCategory | null) {
  if (!cat) return null;
  const map: Record<string, string> = {
    newsletter: "Newsletter",
    promo: "Promotional",
    onboarding: "Onboarding",
    reactivation: "Reactivation",
    transactional: "Transactional",
  };
  return map[cat] ?? cat;
}

// Category bg colors for thumbnail
const CATEGORY_BG: Record<string, string> = {
  newsletter: "bg-sky-50",
  promo: "bg-violet-50",
  onboarding: "bg-teal-50",
  reactivation: "bg-amber-50",
  transactional: "bg-gray-50",
};

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "newsletter", label: "Newsletter" },
  { value: "promo", label: "Promotional" },
  { value: "onboarding", label: "Onboarding" },
  { value: "reactivation", label: "Reactivation" },
  { value: "transactional", label: "Transactional" },
];

type ActiveTab = "all" | "mine" | "shared" | "draft" | "archived";

// ─── Card skeleton ──────────────────────────────────────────────────────────────

function TemplateCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-background overflow-hidden animate-pulse">
      <div className="h-44 bg-background-subtle" />
      <div className="p-4 space-y-2">
        <div className="h-3 w-32 bg-border rounded" />
        <div className="h-2.5 w-24 bg-border rounded" />
        <div className="h-2.5 w-40 bg-border rounded" />
        <div className="flex items-center gap-2 pt-1">
          <div className="size-6 rounded-full bg-border" />
          <div className="h-2.5 w-20 bg-border rounded" />
        </div>
      </div>
    </div>
  );
}

// ─── Template thumbnail ────────────────────────────────────────────────────────

function TemplateThumbnail({
  template,
}: {
  template: MarketingTemplateRow;
}) {
  const bg = CATEGORY_BG[template.category ?? ""] ?? "bg-gray-50";
  return (
    <div className={cn("h-44 w-full flex flex-col items-center justify-center gap-2 p-6", bg)}>
      <RiMailLine size={28} className="text-foreground-muted opacity-30" />
      <div className="w-full space-y-1.5">
        <div className="h-2 w-4/5 mx-auto rounded-full bg-foreground/10" />
        <div className="h-2 w-3/5 mx-auto rounded-full bg-foreground/8" />
        <div className="h-2 w-4/5 mx-auto rounded-full bg-foreground/10" />
        <div className="h-2 w-2/5 mx-auto rounded-full bg-foreground/8" />
      </div>
    </div>
  );
}

// ─── Card three-dot menu ───────────────────────────────────────────────────────

interface CardMenuProps {
  template: MarketingTemplateRow;
  onPreview: () => void;
  onEdit: () => void;
  onSendTest: () => void;
  onDuplicate: () => void;
  onExportHtml: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onMoveToFolder: () => void;
}

function TemplateCardMenu({
  template,
  onPreview,
  onEdit,
  onSendTest,
  onDuplicate,
  onExportHtml,
  onArchive,
  onDelete,
  onMoveToFolder,
}: CardMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({});
  const btnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4;
      setMenuStyle({
        position: "fixed",
        top,
        left: rect.right - 208,
        zIndex: 99999,
      });
    }
    setOpen((v) => !v);
  }

  const items = [
    { label: "Preview", icon: RiEyeLine, onClick: onPreview },
    { label: "Edit in builder", icon: RiEditLine, onClick: onEdit },
    { label: "Send test email", icon: RiSendPlaneLine, onClick: onSendTest },
    { label: "Duplicate", icon: RiFileCopyLine, onClick: onDuplicate },
    { label: "Export HTML", icon: RiDownloadLine, onClick: onExportHtml },
    { label: "Move to folder", icon: RiLayoutGridLine, onClick: onMoveToFolder },
    {
      label: template.archived_at ? "Unarchive" : "Archive template",
      icon: RiArchiveLine,
      onClick: onArchive,
    },
    {
      label: "Delete template",
      icon: RiDeleteBin2Line,
      onClick: onDelete,
      destructive: true,
    },
  ];

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="size-7 inline-flex items-center justify-center rounded-lg text-foreground-muted hover:bg-background-subtle hover:text-foreground transition-colors"
        aria-label="More options"
      >
        <RiMoreLine size={15} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
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

// ─── Template card ─────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: MarketingTemplateRow;
  onPreview: () => void;
  onEdit: () => void;
  onSendTest: () => void;
  onDuplicate: () => void;
  onExportHtml: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onMoveToFolder: () => void;
  selected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
}

function TemplateCard({
  template,
  onPreview,
  onEdit,
  onSendTest,
  onDuplicate,
  onExportHtml,
  onArchive,
  onDelete,
  onMoveToFolder,
  selected = false,
  onToggleSelect,
}: TemplateCardProps) {
  const cat = categoryLabel(template.category);

  return (
    <div
      onClick={onEdit}
      className={cn(
        "group rounded-2xl border bg-background overflow-hidden hover:border-primary/30 hover:shadow-md transition-all cursor-pointer",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      )}
    >
      {/* Thumbnail area */}
      <div className="relative">
        <TemplateThumbnail template={template} />
        {/* Selection checkbox */}
        {onToggleSelect && (
          <button
            onClick={onToggleSelect}
            className={cn(
              "absolute top-2 left-2 size-6 rounded-md border-2 flex items-center justify-center transition-all z-10",
              selected
                ? "bg-primary border-primary text-white opacity-100"
                : "bg-background/80 border-border text-transparent opacity-0 group-hover:opacity-100 backdrop-blur-sm"
            )}
            title={selected ? "Deselect" : "Select"}
          >
            {selected && <RiCheckLine size={12} />}
          </button>
        )}
        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
              template.archived_at
                ? "bg-gray-100 text-gray-500"
                : template.status === "published"
                ? "bg-teal-50 text-teal-700 border border-teal-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            )}
          >
            {template.archived_at
              ? "Archived"
              : template.status === "published"
              ? "✓ Published"
              : "Draft"}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{template.name}</p>
            {cat && (
              <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-background-subtle border border-border text-foreground-muted">
                {cat}
              </span>
            )}
            {template.folder && (
              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-background-subtle text-foreground-muted border border-border">
                📁 {template.folder}
              </span>
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <TemplateCardMenu
              template={template}
              onPreview={onPreview}
              onEdit={onEdit}
              onSendTest={onSendTest}
              onDuplicate={onDuplicate}
              onExportHtml={onExportHtml}
              onArchive={onArchive}
              onDelete={onDelete}
              onMoveToFolder={onMoveToFolder}
            />
          </div>
        </div>

        <p className="text-xs text-foreground-muted mt-2">
          Updated {relativeDate(template.updated_at)}
          {template.times_used > 0 && ` · used ${template.times_used}× this month`}
        </p>

        {/* Owner */}
        {template.owner_name && (
          <div className="flex items-center gap-1.5 mt-3">
            <Avatar
              initials={nameInitials(template.owner_name)}
              size="sm"
              tone={avatarTone(template.owner_name)}
            />
            <span className="text-xs text-foreground-muted">{template.owner_name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create-new card ───────────────────────────────────────────────────────────

function CreateNewCard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-background hover:border-primary/40 hover:bg-background-subtle transition-all flex flex-col items-center justify-center gap-4 p-8 min-h-[280px]">
      <div className="size-12 rounded-2xl bg-background-subtle border border-border flex items-center justify-center">
        <RiMailLine size={24} className="text-foreground-muted" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Create new template</p>
        <p className="text-xs text-foreground-muted mt-1">Start from scratch</p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={onCreate}
        >
          <RiAddLine size={15} />
          New template
        </Button>
      </div>
    </div>
  );
}

// ─── Inner page ────────────────────────────────────────────────────────────────

function TemplatesPageInner() {
  const router = useRouter();
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

  const [templates, setTemplates] = React.useState<MarketingTemplateRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [counts, setCounts] = React.useState({
    all: 0,
    mine: 0,
    shared: 0,
    draft: 0,
    archived: 0,
  });
  const [dataLoading, setDataLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<ActiveTab>("all");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [folderFilter, setFolderFilter] = React.useState("");
  const [folderEditId, setFolderEditId] = React.useState<string | null>(null);
  const [folderEditValue, setFolderEditValue] = React.useState("");
  const [folderSaving, setFolderSaving] = React.useState(false);

  // Modal state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<MarketingTemplateRow | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [sendTestTarget, setSendTestTarget] = React.useState<MarketingTemplateRow | null>(null);
  const [sendTestOpen, setSendTestOpen] = React.useState(false);
  const [previewTarget, setPreviewTarget] = React.useState<MarketingTemplateRow | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkArchiving, setBulkArchiving] = React.useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = React.useState(false);

  // Auth
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

  // Debounce
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch templates
  React.useEffect(() => {
    if (!workspaceId) return;
    setDataLoading(true);
    getMarketingTemplates(workspaceId, {
      search: debouncedSearch || undefined,
      category: (categoryFilter as TemplateCategory) || undefined,
      status: activeTab === "mine" ? "all" : activeTab,
    }).then(({ templates: t, total: tot, error }) => {
      if (!error) {
        // For "mine" tab, filter client-side since owner_id = userId
        if (activeTab === "mine") {
          const filtered = t.filter((tpl) => tpl.owner_id === userId);
          setTemplates(filtered);
          setTotal(filtered.length);
        } else {
          setTemplates(t);
          setTotal(tot);
        }
      }
      setDataLoading(false);
    });
  }, [workspaceId, debouncedSearch, categoryFilter, activeTab, userId]);

  // Fetch counts
  React.useEffect(() => {
    if (!workspaceId || !userId) return;
    getTemplateCounts(workspaceId, userId).then(({ counts: c }) => {
      if (c) setCounts(c);
    });
  }, [workspaceId, userId, templates]);

  const isLoading = wsLoading || dataLoading;

  const availableFolders = React.useMemo(() => {
    const set = new Set<string>();
    templates.forEach(t => { if (t.folder) set.add(t.folder); });
    return Array.from(set).sort();
  }, [templates]);

  const displayedTemplates = folderFilter
    ? templates.filter(t => t.folder === folderFilter)
    : templates;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleCreate(data: { name: string; category: string; subject_line: string; preview_text: string; starterBlocks: import("@/lib/supabase/types").EmailBlock[] }) {
    if (!workspaceId || !userId) return;
    const { template, error } = await createMarketingTemplate(
      workspaceId,
      userId,
      userName,
      {
        name: data.name,
        category: (data.category as TemplateCategory) || undefined,
        subject_line: data.subject_line || undefined,
        preview_text: data.preview_text || undefined,
      }
    );
    if (error || !template) {
      showToast({ title: "Failed to create template", subtitle: error ?? "Unknown error" });
      return;
    }
    if (data.starterBlocks.length > 0) {
      await updateMarketingTemplate(workspaceId, template.id, userId, userName, { blocks: data.starterBlocks });
    }
    setCreateOpen(false);
    showToast({ title: `Template created · ${template.name}`, subtitle: "Opening builder…" });
    router.push(`/marketing/templates/${template.id}/edit`);
  }

  async function handleDelete() {
    if (!workspaceId || !deleteTarget) return;
    const { error } = await deleteMarketingTemplate(workspaceId, deleteTarget.id);
    if (error) {
      showToast({ title: "Failed to delete template", subtitle: error });
      return;
    }
    const deleted = deleteTarget;
    setDeleteOpen(false);
    setDeleteTarget(null);
    setTemplates((prev) => prev.filter((t) => t.id !== deleted.id));
    setTotal((prev) => Math.max(0, prev - 1));
    showToast({
      title: `"${deleted.name}" deleted`,
      subtitle: "The template has been permanently removed",
    });
  }

  async function handleDuplicate(template: MarketingTemplateRow) {
    if (!workspaceId || !userId) return;
    const { template: copy, error } = await duplicateMarketingTemplate(
      workspaceId,
      template.id,
      userId,
      userName
    );
    if (error || !copy) {
      showToast({ title: "Failed to duplicate template", subtitle: error ?? "Unknown error" });
      return;
    }
    setTemplates((prev) => [copy, ...prev]);
    setTotal((prev) => prev + 1);
    showToast({
      title: `Duplicated · ${copy.name}`,
      subtitle: "A copy has been created",
      action: {
        label: "Edit →",
        onClick: () => router.push(`/marketing/templates/${copy.id}/edit`),
      },
    });
  }

  async function handleArchive(template: MarketingTemplateRow) {
    if (!workspaceId) return;
    if (template.archived_at) {
      // Unarchive
      const { error } = await archiveMarketingTemplate(workspaceId, template.id);
      if (error) {
        showToast({ title: "Failed to update template", subtitle: error });
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      showToast({ title: `"${template.name}" unarchived` });
    } else {
      const { error } = await archiveMarketingTemplate(workspaceId, template.id);
      if (error) {
        showToast({ title: "Failed to archive template", subtitle: error });
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      setTotal((prev) => Math.max(0, prev - 1));
      showToast({ title: `"${template.name}" archived` });
    }
  }

  async function handleMoveToFolder(templateId: string, folder: string) {
    if (!workspaceId || !userId) return;
    setFolderSaving(true);
    const { error } = await updateMarketingTemplate(workspaceId, templateId, userId, userName, { folder: folder || null });
    setFolderSaving(false);
    if (error) {
      showToast({ title: "Failed to update folder", subtitle: error });
      return;
    }
    setTemplates((prev) => prev.map((t) => t.id === templateId ? { ...t, folder: folder || null } : t));
    setFolderEditId(null);
    showToast({ title: folder ? `Moved to folder "${folder}"` : "Removed from folder" });
  }

  async function handleBulkArchive() {
    if (!workspaceId || selectedIds.size === 0) return;
    setBulkArchiving(true);
    await Promise.all(
      [...selectedIds].map((id) => archiveMarketingTemplate(workspaceId, id))
    );
    setTemplates((prev) => prev.filter((t) => !selectedIds.has(t.id)));
    setTotal((prev) => Math.max(0, prev - selectedIds.size));
    const count = selectedIds.size;
    showToast({ title: `${count} template${count !== 1 ? 's' : ''} archived` });
    setSelectedIds(new Set());
    setBulkArchiving(false);
  }

  async function handleBulkDelete() {
    if (!workspaceId || selectedIds.size === 0) return;
    setBulkDeleting(true);
    await Promise.all(
      [...selectedIds].map((id) => deleteMarketingTemplate(workspaceId, id))
    );
    setTemplates((prev) => prev.filter((t) => !selectedIds.has(t.id)));
    setTotal((prev) => Math.max(0, prev - selectedIds.size));
    const count = selectedIds.size;
    showToast({ title: `${count} template${count !== 1 ? 's' : ''} deleted` });
    setSelectedIds(new Set());
    setBulkDeleting(false);
    setBulkDeleteConfirmOpen(false);
  }

  function handleExportHtml(template: MarketingTemplateRow) {
    const html = generateEmailHtml(template);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ title: "HTML exported", subtitle: `${template.name}.html downloaded` });
  }

  async function handleSendTest(emails: string[], addPrefix: boolean) {
    setSendTestOpen(false);
    if (!sendTestTarget) return;
    const html = generateEmailHtml(sendTestTarget);
    const subject = addPrefix
      ? `[TEST] ${sendTestTarget.subject_line ?? sendTestTarget.name ?? ""}`
      : (sendTestTarget.subject_line ?? sendTestTarget.name ?? "");
    try {
      const res = await fetch("/api/email/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emails, subject, html, templateName: sendTestTarget.name, addPrefix }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast({ title: "Failed to send test", subtitle: data.error ?? "Unknown error" });
        setSendTestTarget(null);
        return;
      }
      showToast({
        title: `Test sent to ${emails.length} recipient${emails.length !== 1 ? "s" : ""}`,
        subtitle: `Subject: ${subject}`,
      });
    } catch (err) {
      showToast({ title: "Failed to send test", subtitle: String(err) });
    }
    setSendTestTarget(null);
  }

  // ─── Tabs ──────────────────────────────────────────────────────────────────

  const TABS: { id: ActiveTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "mine", label: "My templates", count: counts.mine },
    { id: "shared", label: "Shared", count: counts.shared },
    { id: "draft", label: "Drafts", count: counts.draft },
    { id: "archived", label: "Archived", count: counts.archived },
  ];

  const previewHtml = previewTarget ? generateEmailHtml(previewTarget) : "";

  return (
    <main className="px-12 py-10 max-w-[1760px] mx-auto">
      {/* Breadcrumb */}
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        Marketing · Email Templates
      </p>

      {/* Header */}
      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-title-h2 font-bold">Email templates</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Design, manage and reuse email templates for your marketing campaigns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" disabled className="opacity-50 cursor-not-allowed">
            <RiUploadLine size={15} />
            Import HTML
            <span className="ml-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-background-muted text-foreground-muted border border-border">
              soon
            </span>
          </Button>
          <Button variant="secondary" size="md" disabled className="opacity-50 cursor-not-allowed">
            <RiLayoutGridLine size={15} />
            Gallery
            <span className="ml-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-background-muted text-foreground-muted border border-border">
              soon
            </span>
          </Button>
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <RiAddLine size={16} />
            Create template
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex items-center gap-1 border-b border-border">
        {TABS.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px",
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-foreground-muted hover:text-foreground"
            )}
          >
            {label}
            {count > 0 && (
              <span
                className={cn(
                  "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full",
                  activeTab === id
                    ? "bg-primary/10 text-primary"
                    : "bg-background-subtle text-foreground-muted"
                )}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-44">
            <Select
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v)}
              options={CATEGORY_OPTIONS}
              placeholder="All categories"
            />
          </div>
          {availableFolders.length > 0 && (
            <div className="w-44">
              <Select
                value={folderFilter}
                onChange={(v) => setFolderFilter(v)}
                options={[
                  { value: "", label: "All folders" },
                  ...availableFolders.map(f => ({ value: f, label: f }))
                ]}
              />
            </div>
          )}
        </div>
        <div className="relative w-full max-w-xs">
          <RiSearchLine
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted"
          />
          <input
            type="search"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-full border border-border bg-background pl-9 pr-4 text-sm outline-none placeholder:text-foreground-muted focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>

      {/* Folder edit modal */}
      {folderEditId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFolderEditId(null)}>
          <div className="bg-background rounded-xl border border-border shadow-lg p-5 w-80" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-3">Move to folder</p>
            <input
              type="text"
              value={folderEditValue}
              onChange={(e) => setFolderEditValue(e.target.value)}
              placeholder="Folder name (leave blank to remove)"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 mb-3"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleMoveToFolder(folderEditId, folderEditValue); if (e.key === "Escape") setFolderEditId(null); }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setFolderEditId(null)} className="px-3 py-1.5 rounded-lg text-xs text-foreground-muted hover:bg-background-subtle transition-colors">Cancel</button>
              <button onClick={() => handleMoveToFolder(folderEditId, folderEditValue)} disabled={folderSaving} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50 transition-colors">
                {folderSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading
          ? [...Array(6)].map((_, i) => <TemplateCardSkeleton key={i} />)
          : displayedTemplates.length === 0
          ? (
            <div className="col-span-full py-20 text-center text-foreground-muted">
              <RiMailLine size={40} className="mx-auto mb-4 opacity-20" />
              <p className="font-semibold">
                {debouncedSearch
                  ? `No templates matching "${debouncedSearch}"`
                  : activeTab === "archived"
                  ? "No archived templates"
                  : "No templates yet"}
              </p>
              <p className="text-xs mt-1">
                {activeTab === "all" && !debouncedSearch
                  ? "Create your first template to get started"
                  : "Try a different filter or search term"}
              </p>
              {activeTab === "all" && !debouncedSearch && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <RiAddLine size={13} />
                  Create template
                </button>
              )}
            </div>
          )
          : (
            <>
              {displayedTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onPreview={() => {
                    setPreviewTarget(template);
                    setPreviewOpen(true);
                  }}
                  onEdit={() =>
                    router.push(`/marketing/templates/${template.id}/edit`)
                  }
                  onSendTest={() => {
                    setSendTestTarget(template);
                    setSendTestOpen(true);
                  }}
                  onDuplicate={() => handleDuplicate(template)}
                  onExportHtml={() => handleExportHtml(template)}
                  onArchive={() => handleArchive(template)}
                  onDelete={() => {
                    setDeleteTarget(template);
                    setDeleteOpen(true);
                  }}
                  onMoveToFolder={() => {
                    setFolderEditId(template.id);
                    setFolderEditValue(template.folder ?? "");
                  }}
                  selected={selectedIds.has(template.id)}
                  onToggleSelect={(e) => {
                    e.stopPropagation();
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(template.id)) next.delete(template.id);
                      else next.add(template.id);
                      return next;
                    });
                  }}
                />
              ))}
              {activeTab === "all" && !debouncedSearch && !categoryFilter && !folderFilter && (
                <CreateNewCard onCreate={() => setCreateOpen(true)} />
              )}
            </>
          )}
      </div>

      {/* Modals */}
      <CreateTemplateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />

      <DeleteTemplateModal
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setDeleteTarget(null);
        }}
        template={deleteTarget}
        onConfirm={handleDelete}
      />

      {sendTestTarget && (
        <SendTestModal
          open={sendTestOpen}
          onOpenChange={(o) => {
            setSendTestOpen(o);
            if (!o) setSendTestTarget(null);
          }}
          templateName={sendTestTarget.name}
          subjectLine={sendTestTarget.subject_line}
          onSend={handleSendTest}
        />
      )}

      {previewTarget && (
        <PreviewModal
          open={previewOpen}
          onOpenChange={(o) => {
            setPreviewOpen(o);
            if (!o) setPreviewTarget(null);
          }}
          template={previewTarget}
          renderedHtml={previewHtml}
          onSendTest={() => {
            setPreviewOpen(false);
            setSendTestTarget(previewTarget);
            setSendTestOpen(true);
          }}
          onUseTemplate={() => {
            setPreviewOpen(false);
            router.push(`/marketing/templates/${previewTarget.id}/edit`);
          }}
        />
      )}
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-gray-900 text-white rounded-2xl px-5 py-3 shadow-2xl border border-white/10">
            <span className="text-sm font-semibold">
              {selectedIds.size} selected
            </span>
            <div className="w-px h-4 bg-white/20" />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkArchive}
              disabled={bulkArchiving}
              className="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20"
            >
              <RiArchiveLine size={14} />
              {bulkArchiving ? 'Archiving…' : 'Archive'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBulkDeleteConfirmOpen(true)}
              className="!bg-red-500/20 !text-red-300 !border-red-500/30 hover:!bg-red-500/30"
            >
              <RiDeleteBin2Line size={14} />
              Delete
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="size-7 inline-flex items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              title="Clear selection"
            >
              <RiCloseLine size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-80 p-5">
            <h3 className="text-sm font-semibold mb-1">Delete {selectedIds.size} template{selectedIds.size !== 1 ? 's' : ''}?</h3>
            <p className="text-xs text-foreground-muted mb-4">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setBulkDeleteConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Page wrapped in ToastProvider ────────────────────────────────────────────

export default function TemplatesPage() {
  return (
    <ToastProvider>
      <TemplatesPageInner />
    </ToastProvider>
  );
}

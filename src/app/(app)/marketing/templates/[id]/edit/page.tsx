"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter, useParams } from "next/navigation";
import {
  RiArrowLeftLine,
  RiComputerLine,
  RiSmartphoneLine,
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiEyeLine,
  RiSendPlaneLine,
  RiMoreLine,
  RiHeading,
  RiText,
  RiImage2Line,
  RiImageLine,
  RiRectangleLine,
  RiSeparator,
  RiTextSpacing,
  RiArrowUpLine,
  RiArrowDownLine,
  RiFileCopyLine,
  RiDeleteBin2Line,
  RiCheckLine,
  RiLayoutLine,
  RiLayoutGridLine,
  RiPaintLine,
  RiMailLine,
  RiShareLine,
  RiCodeLine,
  RiFacebookBoxLine,
  RiInstagramLine,
  RiLinkedinBoxLine,
  RiYoutubeLine,
  RiTwitterXLine,
  RiTiktokLine,
  RiListUnordered,
  RiListOrdered,
  RiLink,
  RiBold,
  RiItalic,
  RiUnderline,
  RiCloseLine,
  RiExternalLinkLine,
  RiEdit2Line,
  RiDeleteBinLine,
  RiUploadLine,
  RiLayoutColumnLine,
  RiHistoryLine,
  RiDownloadLine,
  RiEyeOffLine,
  RiBookmarkLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { SendTestModal } from "@/components/marketing/send-test-modal";
import { PreviewModal } from "@/components/marketing/preview-modal";
import { ImageLibraryModal } from "@/components/marketing/image-library-modal";
import {
  getMarketingTemplate,
  updateMarketingTemplate,
  publishMarketingTemplate,
  saveTemplateVersion,
  getTemplateVersions,
  getSavedBlocks,
  saveBlock,
  deleteSavedBlock,
  type TemplateVersionRow,
} from "@/lib/queries/marketing-templates";
import type { SavedBlockRow } from "@/lib/supabase/types";
import { SECTION_CATEGORIES, type SectionCategory, type SectionTemplate } from "@/lib/section-templates";
import { generateEmailHtml } from "@/lib/email-html";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { createClient } from "@/lib/supabase/browser";
import type { MarketingTemplateRow, EmailBlock, BlockType, SocialLink, SocialPlatform, ColumnItem } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { blockToHtml } from "@/lib/email-html";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function createBlock(type: BlockType): EmailBlock {
  const base: EmailBlock = {
    id: generateId(),
    type,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 0,
    paddingRight: 0,
    alignment: "left",
  };
  switch (type) {
    case "heading":
      return { ...base, headingTag: "h2", headingText: "Your Heading", fontSize: 24, color: "#1B1B1B", alignment: "center" };
    case "text":
      return { ...base, textContent: "Write your email content here. Keep it concise and engaging.", fontSize: 15, color: "#4B4B4B" };
    case "image":
      return { ...base, imageUrl: "", imageAlt: "", imageLink: "", imageWidth: 100, alignment: "center" };
    case "button":
      return { ...base, buttonLabel: "Click Here", buttonUrl: "#", buttonBgColor: "#16DAC1", buttonTextColor: "#FFFFFF", buttonRadius: 100, alignment: "center", paddingTop: 16, paddingBottom: 16 };
    case "divider":
      return { ...base, dividerColor: "#E5E7EB", dividerThickness: 1, paddingTop: 16, paddingBottom: 16 };
    case "spacer":
      return { ...base, spacerHeight: 24 };
    case "social":
      return {
        ...base,
        alignment: "center",
        paddingTop: 16,
        paddingBottom: 16,
        socialIconSize: 36,
        socialIconBgColor: "",
        socialIconColor: "#FFFFFF",
        socialIconRadius: 50,
        socialLinks: [
          { platform: "facebook", url: "https://facebook.com", enabled: true },
          { platform: "instagram", url: "https://instagram.com", enabled: true },
          { platform: "linkedin", url: "https://linkedin.com", enabled: true },
          { platform: "youtube", url: "https://youtube.com", enabled: false },
          { platform: "twitter", url: "https://twitter.com", enabled: false },
          { platform: "tiktok", url: "https://tiktok.com", enabled: false },
        ] as SocialLink[],
      };
    case "html":
      return { ...base, htmlContent: "<!-- Your custom HTML here -->\n<p style=\"color:#555;\">Custom HTML block</p>", paddingTop: 8, paddingBottom: 8 };
    case "columns":
      return {
        ...base,
        columnCount: 2,
        columnStacks: [
          [{ type: "text" as const, textContent: "Column 1", alignment: "left" as const }],
          [{ type: "text" as const, textContent: "Column 2", alignment: "left" as const }],
        ],
        columnGap: 16,
      };
    case "unsubscribe":
      return { ...base, fontSize: 11, color: "#999999", alignment: "center" as const, paddingTop: 16, paddingBottom: 16 };
    default:
      return base;
  }
}

// ─── Block catalog ─────────────────────────────────────────────────────────────

const BLOCK_CATALOG: { type: BlockType; label: string; icon: React.ElementType; description: string }[] = [
  { type: "heading", label: "Heading", icon: RiHeading, description: "H1, H2, or H3 title" },
  { type: "text", label: "Text", icon: RiText, description: "Paragraph of text" },
  { type: "image", label: "Image", icon: RiImage2Line, description: "Image with optional link" },
  { type: "button", label: "Button", icon: RiRectangleLine, description: "Call-to-action button" },
  { type: "divider", label: "Divider", icon: RiSeparator, description: "Horizontal line" },
  { type: "spacer", label: "Spacer", icon: RiTextSpacing, description: "Empty vertical space" },
  { type: "social", label: "Social", icon: RiShareLine, description: "Social media links" },
  { type: "html", label: "HTML", icon: RiCodeLine, description: "Custom HTML code" },
  { type: "columns", label: "Columns", icon: RiLayoutColumnLine, description: "2 or 3 column layout" },
  { type: "unsubscribe", label: "Unsub", icon: RiMailLine, description: "Unsubscribe footer link" },
];

// Social platform config
const SOCIAL_PLATFORM_CONFIG: Record<SocialPlatform, { label: string; icon: React.ElementType; color: string }> = {
  facebook: { label: "Facebook", icon: RiFacebookBoxLine, color: "#1877F2" },
  instagram: { label: "Instagram", icon: RiInstagramLine, color: "#E1306C" },
  linkedin: { label: "LinkedIn", icon: RiLinkedinBoxLine, color: "#0A66C2" },
  youtube: { label: "YouTube", icon: RiYoutubeLine, color: "#FF0000" },
  twitter: { label: "Twitter / X", icon: RiTwitterXLine, color: "#000000" },
  tiktok: { label: "TikTok", icon: RiTiktokLine, color: "#010101" },
};

// ─── Block preview (canvas render) ────────────────────────────────────────────

function BlockPreview({ block }: { block: EmailBlock }) {
  const html = blockToHtml(block);
  const wrapStyle: React.CSSProperties = {};
  if (block.bgColor) wrapStyle.backgroundColor = block.bgColor;
  if (block.bgImage) {
    wrapStyle.backgroundImage = `url(${block.bgImage})`;
    wrapStyle.backgroundSize = 'cover';
    wrapStyle.backgroundPosition = 'center';
    wrapStyle.position = 'relative';
  }
  return (
    <div className="w-full" style={wrapStyle}>
      {block.bgImage && block.bgImageOverlay != null && block.bgImageOverlay > 0 && (
        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${block.bgImageOverlay})`, zIndex: 0 }} />
      )}
      <div
        style={block.bgImage ? { position: 'relative', zIndex: 1 } : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ─── Font options (module-level so BuilderInner can access) ───────────────────

const FONT_OPTIONS: { value: string; label: string; googleFont?: string }[] = [
  { value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", label: "System UI" },
  { value: "'Inter', sans-serif", label: "Inter", googleFont: "Inter" },
  { value: "'Lato', sans-serif", label: "Lato", googleFont: "Lato" },
  { value: "'Open Sans', sans-serif", label: "Open Sans", googleFont: "Open+Sans" },
  { value: "'Montserrat', sans-serif", label: "Montserrat", googleFont: "Montserrat" },
  { value: "'Raleway', sans-serif", label: "Raleway", googleFont: "Raleway" },
  { value: "'Merriweather', serif", label: "Merriweather", googleFont: "Merriweather" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: "Helvetica" },
];

// ─── Properties panel ─────────────────────────────────────────────────────────

function PaddingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-foreground-muted w-10 shrink-0">{label}</span>
      <input
        type="number"
        value={value}
        min={0}
        max={120}
        onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onChange(v); }}
        className="h-7 w-full min-w-0 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
      />
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground-muted block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 rounded cursor-pointer border border-border"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
        />
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  unit = "px",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground-muted block mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onChange(v); }}
          className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
        />
        <span className="text-[11px] text-foreground-muted shrink-0">{unit}</span>
      </div>
    </div>
  );
}

const ALIGNMENT_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const HEADING_TAG_OPTIONS = [
  { value: "h1", label: "H1 — Large" },
  { value: "h2", label: "H2 — Medium" },
  { value: "h3", label: "H3 — Small" },
];

const VARIABLES = [
  { label: "First name", value: "{{first_name}}" },
  { label: "Last name", value: "{{last_name}}" },
  { label: "Full name", value: "{{full_name}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Company", value: "{{company}}" },
  { label: "Unsubscribe link", value: "{{unsubscribe_url}}" },
];

// ─── Text format toolbar (WYSIWYG contenteditable) ────────────────────────────

function TextFormatToolbar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  // Link insertion panel
  const [showLinkPanel, setShowLinkPanel] = React.useState(false);
  const [linkText, setLinkText] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("https://");
  // Link hover tooltip
  const [hoveredLink, setHoveredLink] = React.useState<{ el: HTMLAnchorElement; rect: DOMRect } | null>(null);
  const [editingHover, setEditingHover] = React.useState(false);
  const [hoverText, setHoverText] = React.useState("");
  const [hoverUrl, setHoverUrl] = React.useState("");
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  // Variable menu
  const [showVarMenu, setShowVarMenu] = React.useState(false);
  const [varMenuRect, setVarMenuRect] = React.useState<DOMRect | null>(null);
  const varBtnRef = React.useRef<HTMLButtonElement>(null);
  const varMenuRef = React.useRef<HTMLDivElement>(null);
  const savedRange = React.useRef<Range | null>(null);

  // Active format states — updated whenever selection changes inside the editor
  const [fmtBold, setFmtBold] = React.useState(false);
  const [fmtItalic, setFmtItalic] = React.useState(false);
  const [fmtUnderline, setFmtUnderline] = React.useState(false);
  const [fmtBullet, setFmtBullet] = React.useState(false);
  const [fmtOrdered, setFmtOrdered] = React.useState(false);

  function isInsideTag(tagName: string): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if ((node as Element).nodeName?.toLowerCase() === tagName) return true;
      node = node.parentNode;
    }
    return false;
  }

  function refreshFormatState() {
    const sel = window.getSelection();
    if (!sel || !editorRef.current?.contains(sel.anchorNode)) {
      setFmtBold(false); setFmtItalic(false); setFmtUnderline(false);
      setFmtBullet(false); setFmtOrdered(false);
      return;
    }
    setFmtBold(document.queryCommandState("bold"));
    setFmtItalic(document.queryCommandState("italic"));
    setFmtUnderline(document.queryCommandState("underline"));
    setFmtBullet(isInsideTag("ul"));
    setFmtOrdered(isInsideTag("ol"));
  }

  React.useEffect(() => {
    document.addEventListener("selectionchange", refreshFormatState);
    return () => document.removeEventListener("selectionchange", refreshFormatState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close variable menu on outside click
  React.useEffect(() => {
    if (!showVarMenu) return;
    function handleClick(e: MouseEvent) {
      if (
        varMenuRef.current && !varMenuRef.current.contains(e.target as Node) &&
        varBtnRef.current && !varBtnRef.current.contains(e.target as Node)
      ) {
        setShowVarMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showVarMenu]);

  // Initialize content once on mount (parent uses key={block.id} to remount on block change)
  React.useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function sync() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    refreshFormatState();
  }

  // Save current selection so toolbar buttons can restore it after gaining focus
  function saveRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreRange() {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }

  // onMouseDown + preventDefault keeps focus in editor while clicking toolbar
  function execBtn(command: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, val ?? undefined);
    sync();
  }

  // Manual list insertion using insertHTML — reliable cross-browser
  function applyList(tag: "ul" | "ol") {
    const el = editorRef.current;
    if (!el) return;
    el.focus();

    const sel = window.getSelection();
    const selectedText = sel && !sel.isCollapsed ? sel.toString() : "";
    const lines = selectedText
      ? selectedText.split("\n").filter((l) => l.trim())
      : [""];

    const listStyle = tag === "ul" ? "disc" : "decimal";
    const items = lines.map((l) => `<li style="margin:0;text-align:left;">${l.trim() || "​"}</li>`).join("");
    const html = `<${tag} style="margin:0;padding-left:24px;list-style-type:${listStyle};text-align:left;">${items}</${tag}>`;

    document.execCommand("insertHTML", false, html);
    sync();
  }

  function applyLink() {
    const url = linkUrl.trim();
    if (!url || url === "https://") return;
    restoreRange();
    const el = editorRef.current;
    if (!el) return;
    el.focus();

    const sel = window.getSelection();
    const selText = sel && !sel.isCollapsed ? sel.toString() : "";
    const display = linkText.trim() || selText || url;

    // Build anchor element manually for full control
    const a = document.createElement("a");
    a.href = url;
    a.style.cssText = "color:#16DAC1;text-decoration:underline;cursor:pointer;";
    a.textContent = display;

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(a);
      const after = document.createRange();
      after.setStartAfter(a);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    }

    sync();
    setShowLinkPanel(false);
    setLinkText("");
    setLinkUrl("https://");
  }

  // Link hover handlers
  function handleEditorMouseOver(e: React.MouseEvent) {
    const anchor = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
    if (anchor && editorRef.current?.contains(anchor)) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setHoveredLink({ el: anchor, rect: anchor.getBoundingClientRect() });
      setEditingHover(false);
      setHoverText(anchor.textContent ?? "");
      setHoverUrl(anchor.getAttribute("href") ?? "");
    }
  }

  function handleEditorMouseLeave() {
    hideTimer.current = setTimeout(() => {
      if (!tooltipRef.current?.matches(":hover")) {
        setHoveredLink(null);
        setEditingHover(false);
      }
    }, 180);
  }

  function saveHoverLink() {
    if (!hoveredLink) return;
    hoveredLink.el.href = hoverUrl;
    hoveredLink.el.textContent = hoverText;
    hoveredLink.el.style.cssText = "color:#16DAC1;text-decoration:underline;cursor:pointer;";
    setEditingHover(false);
    setHoveredLink({ el: hoveredLink.el, rect: hoveredLink.el.getBoundingClientRect() });
    sync();
  }

  function removeHoverLink() {
    if (!hoveredLink) return;
    const el = hoveredLink.el;
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    }
    setHoveredLink(null);
    sync();
  }

  function insertVar(variable: string) {
    restoreRange();
    editorRef.current?.focus();
    document.execCommand("insertText", false, variable);
    sync();
    setShowVarMenu(false);
  }

  const tbtn = "size-7 inline-flex items-center justify-center rounded transition-colors text-foreground-muted hover:bg-background hover:text-foreground";
  const activeCls = "bg-foreground/10 text-foreground";

  return (
    <div className="border border-border rounded-lg overflow-visible">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border bg-background-subtle">
        <button type="button" title="Bold"
          onMouseDown={(e) => { e.preventDefault(); execBtn("bold"); }}
          className={cn(tbtn, fmtBold && activeCls)}><RiBold size={13} /></button>
        <button type="button" title="Italic"
          onMouseDown={(e) => { e.preventDefault(); execBtn("italic"); }}
          className={cn(tbtn, fmtItalic && activeCls)}><RiItalic size={13} /></button>
        <button type="button" title="Underline"
          onMouseDown={(e) => { e.preventDefault(); execBtn("underline"); }}
          className={cn(tbtn, fmtUnderline && activeCls)}><RiUnderline size={13} /></button>

        <div className="w-px h-4 bg-border mx-0.5 shrink-0" />

        <button type="button" title="Bullet list"
          onMouseDown={(e) => { e.preventDefault(); applyList("ul"); }}
          className={cn(tbtn, fmtBullet && activeCls)}><RiListUnordered size={13} /></button>
        <button type="button" title="Numbered list"
          onMouseDown={(e) => { e.preventDefault(); applyList("ol"); }}
          className={cn(tbtn, fmtOrdered && activeCls)}><RiListOrdered size={13} /></button>

        <div className="w-px h-4 bg-border mx-0.5 shrink-0" />

        <button type="button" title="Add link"
          onMouseDown={(e) => {
            e.preventDefault();
            saveRange();
            setShowLinkPanel((v) => !v);
            setShowVarMenu(false);
          }}
          className={cn(tbtn, showLinkPanel && "bg-primary/10 text-primary")}>
          <RiLink size={13} />
        </button>

        <button ref={varBtnRef} type="button" title="Insert variable"
          onMouseDown={(e) => {
            e.preventDefault();
            saveRange();
            const rect = varBtnRef.current?.getBoundingClientRect() ?? null;
            setVarMenuRect(rect);
            setShowVarMenu((v) => !v);
            setShowLinkPanel(false);
          }}
          className={cn(tbtn, "font-mono text-[10px] font-bold", showVarMenu && "bg-primary/10 text-primary")}>
          {"{ }"}
        </button>
      </div>

      {/* Link insertion panel */}
      {showLinkPanel && (
        <div className="px-2 py-2 border-b border-border bg-background-subtle space-y-1.5">
          <input
            type="text"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            placeholder="Display text (optional)"
            autoFocus
            className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
          />
          <div className="flex gap-1.5">
            <input type="url" value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              onKeyDown={(e) => { if (e.key === "Enter") applyLink(); }}
              className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
            <button type="button" onClick={applyLink}
              className="h-7 px-2.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0">
              Insert
            </button>
            <button type="button" onClick={() => setShowLinkPanel(false)}
              className="size-7 inline-flex items-center justify-center rounded-md text-foreground-muted hover:bg-background transition-colors shrink-0">
              <RiCloseLine size={13} />
            </button>
          </div>
        </div>
      )}

      {/* WYSIWYG editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        onMouseOver={handleEditorMouseOver}
        onMouseLeave={handleEditorMouseLeave}
        className="w-full min-h-[120px] px-2.5 py-2 text-sm outline-none bg-background empty:before:content-[attr(data-placeholder)] empty:before:text-foreground-muted"
        data-placeholder="Write your text content here…"
        style={{ lineHeight: 1.6, wordBreak: "break-word" }}
      />

      {/* Link hover tooltip — rendered via portal so it's never clipped */}
      {hoveredLink && typeof window !== "undefined" && createPortal(
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            top: hoveredLink.rect.bottom + 6,
            left: hoveredLink.rect.left,
            zIndex: 99999,
            minWidth: 240,
            maxWidth: 320,
          }}
          onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); }}
          onMouseLeave={() => { setHoveredLink(null); setEditingHover(false); }}
          className="bg-background border border-border rounded-xl shadow-xl overflow-hidden"
        >
          {editingHover ? (
            /* Edit mode */
            <div className="p-2.5 space-y-1.5">
              <input
                type="text"
                value={hoverText}
                onChange={(e) => setHoverText(e.target.value)}
                placeholder="Display text"
                autoFocus
                className="h-7 w-full rounded-md border border-border bg-background-subtle px-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="url"
                value={hoverUrl}
                onChange={(e) => setHoverUrl(e.target.value)}
                placeholder="https://..."
                onKeyDown={(e) => { if (e.key === "Enter") saveHoverLink(); }}
                className="h-7 w-full rounded-md border border-border bg-background-subtle px-2 text-xs outline-none focus:border-primary"
              />
              <div className="flex gap-1.5 pt-0.5">
                <button onClick={saveHoverLink}
                  className="h-7 flex-1 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">
                  Save
                </button>
                <button onClick={() => setEditingHover(false)}
                  className="h-7 px-2.5 rounded-md border border-border text-xs text-foreground-muted hover:bg-background-subtle transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* View mode */
            <div className="flex items-center gap-1 px-2 py-1.5">
              <RiLink size={11} className="text-primary shrink-0" />
              <a
                href={hoveredLink.el.getAttribute("href") ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-xs text-primary truncate hover:underline min-w-0"
              >
                {hoveredLink.el.getAttribute("href")}
              </a>
              <div className="flex items-center gap-0.5 shrink-0 ml-1">
                <button
                  onClick={() => { setEditingHover(true); setHoverText(hoveredLink.el.textContent ?? ""); setHoverUrl(hoveredLink.el.getAttribute("href") ?? ""); }}
                  className="size-6 inline-flex items-center justify-center rounded hover:bg-background-subtle transition-colors text-foreground-muted hover:text-foreground"
                  title="Edit link"
                >
                  <RiEdit2Line size={11} />
                </button>
                <a
                  href={hoveredLink.el.getAttribute("href") ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="size-6 inline-flex items-center justify-center rounded hover:bg-background-subtle transition-colors text-foreground-muted hover:text-foreground"
                  title="Open link"
                >
                  <RiExternalLinkLine size={11} />
                </a>
                <button
                  onClick={removeHoverLink}
                  className="size-6 inline-flex items-center justify-center rounded hover:bg-background-subtle transition-colors text-foreground-muted hover:text-destructive"
                  title="Remove link"
                >
                  <RiDeleteBinLine size={11} />
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Variable menu — rendered via portal so it's never clipped */}
      {showVarMenu && varMenuRect && typeof window !== "undefined" && createPortal(
        <div
          ref={varMenuRef}
          style={{
            position: "fixed",
            top: varMenuRect.bottom + 4,
            // Align right edge of menu to right edge of button
            left: Math.max(8, varMenuRect.right - 220),
            zIndex: 99999,
            width: 220,
          }}
          onMouseDown={(e) => e.preventDefault()}
          className="rounded-xl border border-border bg-background shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Insert variable</p>
          </div>
          <div className="py-1">
            {VARIABLES.map((v) => (
              <button key={v.value} type="button"
                onClick={() => insertVar(v.value)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-background-subtle transition-colors group">
                <span className="size-6 inline-flex items-center justify-center rounded-md bg-primary/10 text-primary text-[9px] font-bold font-mono shrink-0 group-hover:bg-primary/20">
                  {"{}"}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground leading-none mb-0.5">{v.label}</p>
                  <p className="text-[10px] text-foreground-muted font-mono truncate">{v.value}</p>
                </div>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface PropertiesPanelProps {
  block: EmailBlock | null;
  onChange: (updates: Partial<EmailBlock>) => void;
  templateBgColor: string;
  templateFontFamily: string;
  onTemplateBgChange: (v: string) => void;
  onTemplateFontChange: (v: string) => void;
  templateBodyBgColor: string;
  onTemplateBodyBgChange: (v: string) => void;
  templateEmailWidth: number;
  onTemplateEmailWidthChange: (v: number) => void;
  workspaceId: string;
}

function PropertiesPanel({
  block,
  onChange,
  templateBgColor,
  templateFontFamily,
  onTemplateBgChange,
  onTemplateFontChange,
  templateBodyBgColor,
  onTemplateBodyBgChange,
  templateEmailWidth,
  onTemplateEmailWidthChange,
  workspaceId,
}: PropertiesPanelProps) {
  const imageFileInputRef = React.useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = React.useState(false);
  const [imageLibraryOpen, setImageLibraryOpen] = React.useState(false);
  const bgImageFileInputRef = React.useRef<HTMLInputElement>(null);
  const [bgImageUploading, setBgImageUploading] = React.useState(false);
  const [bgImageLibraryOpen, setBgImageLibraryOpen] = React.useState(false);

  if (!block) {
    // Global email settings
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Email settings
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <ColorInput
            label="Background color"
            value={templateBgColor}
            onChange={onTemplateBgChange}
          />
          <ColorInput
            label="Email body color"
            value={templateBodyBgColor}
            onChange={onTemplateBodyBgChange}
          />
          <div>
            <label className="text-xs font-medium text-foreground-muted block mb-1">
              Font family
            </label>
            <Select
              value={templateFontFamily}
              onChange={onTemplateFontChange}
              options={FONT_OPTIONS}
              placeholder="Select font"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-foreground-muted">Email width</label>
              <span className="text-xs font-mono text-foreground-muted">{templateEmailWidth}px</span>
            </div>
            <input
              type="range"
              min={400}
              max={700}
              step={10}
              value={templateEmailWidth}
              onChange={(e) => onTemplateEmailWidthChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-foreground-muted">400px</span>
              <span className="text-[10px] text-foreground-muted">700px</span>
            </div>
          </div>
          <div className="rounded-lg bg-background-subtle border border-border p-3">
            <p className="text-[11px] text-foreground-muted">
              Click any block in the canvas to edit its properties.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          {block.type.charAt(0).toUpperCase() + block.type.slice(1)} properties
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* ── Heading ── */}
        {block.type === "heading" && (
          <>
            <div>
              <label className="text-xs font-medium text-foreground-muted block mb-1">Tag</label>
              <Select
                value={block.headingTag ?? "h2"}
                onChange={(v) => {
                  const tagFontSizes: Record<string, number> = { h1: 32, h2: 24, h3: 18 };
                  onChange({ headingTag: v as "h1" | "h2" | "h3", fontSize: tagFontSizes[v] ?? 24 });
                }}
                options={HEADING_TAG_OPTIONS}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground-muted block mb-1">Text</label>
              <input
                type="text"
                value={block.headingText ?? ""}
                onChange={(e) => onChange({ headingText: e.target.value })}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
              />
            </div>
          </>
        )}

        {/* ── Text ── */}
        {block.type === "text" && (
          <div>
            <label className="text-xs font-medium text-foreground-muted block mb-1">Content</label>
            <TextFormatToolbar
              key={block.id}
              value={block.textContent ?? ""}
              onChange={(v) => onChange({ textContent: v })}
            />
          </div>
        )}

        {/* ── Image ── */}
        {block.type === "image" && (
          <>
            <div>
              <label className="text-xs font-medium text-foreground-muted block mb-1">Image URL</label>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  value={block.imageUrl ?? ""}
                  onChange={(e) => onChange({ imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="h-8 flex-1 min-w-0 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                />
                <button
                  type="button"
                  disabled={imageUploading}
                  onClick={() => imageFileInputRef.current?.click()}
                  className="h-8 px-2.5 rounded-md border border-border bg-background-subtle text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-background transition-colors shrink-0 inline-flex items-center gap-1 disabled:opacity-50"
                  title="Upload image"
                >
                  <RiUploadLine size={12} />
                  {imageUploading ? "…" : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={() => setImageLibraryOpen(true)}
                  className="h-8 px-2.5 rounded-md border border-border bg-background-subtle text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-background transition-colors shrink-0 inline-flex items-center gap-1"
                  title="Open image library"
                >
                  <RiImageLine size={12} />
                  Library
                </button>
                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !workspaceId) return;
                    setImageUploading(true);
                    try {
                      const supabase = createClient();
                      const path = `${workspaceId}/${block.id}/${file.name}`;
                      const { error: uploadError } = await supabase.storage
                        .from("template-images")
                        .upload(path, file, { upsert: true });
                      if (uploadError) throw uploadError;
                      const { data: urlData } = supabase.storage
                        .from("template-images")
                        .getPublicUrl(path);
                      onChange({ imageUrl: urlData.publicUrl });
                    } catch (err) {
                      console.error("Image upload failed:", err);
                    } finally {
                      setImageUploading(false);
                      // Reset file input so same file can be re-uploaded
                      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
                    }
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground-muted block mb-1">Alt text</label>
              <input
                type="text"
                value={block.imageAlt ?? ""}
                onChange={(e) => onChange({ imageAlt: e.target.value })}
                placeholder="Describe the image"
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground-muted block mb-1">Link URL (optional)</label>
              <input
                type="url"
                value={block.imageLink ?? ""}
                onChange={(e) => onChange({ imageLink: e.target.value })}
                placeholder="https://..."
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
              />
            </div>
            <NumberInput
              label="Width"
              value={block.imageWidth ?? 100}
              onChange={(v) => onChange({ imageWidth: v })}
              min={10}
              max={100}
              unit="%"
            />
          </>
        )}

        {/* ── Button ── */}
        {block.type === "button" && (
          <>
            <div>
              <label className="text-xs font-medium text-foreground-muted block mb-1">Label</label>
              <input
                type="text"
                value={block.buttonLabel ?? ""}
                onChange={(e) => onChange({ buttonLabel: e.target.value })}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground-muted block mb-1">Link URL</label>
              <input
                type="url"
                value={block.buttonUrl ?? ""}
                onChange={(e) => onChange({ buttonUrl: e.target.value })}
                placeholder="https://..."
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
              />
            </div>
            <ColorInput
              label="Background color"
              value={block.buttonBgColor ?? "#16DAC1"}
              onChange={(v) => onChange({ buttonBgColor: v })}
            />
            <ColorInput
              label="Text color"
              value={block.buttonTextColor ?? "#FFFFFF"}
              onChange={(v) => onChange({ buttonTextColor: v })}
            />
            <NumberInput
              label="Border radius"
              value={block.buttonRadius ?? 100}
              onChange={(v) => onChange({ buttonRadius: v })}
              min={0}
              max={100}
            />
          </>
        )}

        {/* ── Divider ── */}
        {block.type === "divider" && (
          <>
            <ColorInput
              label="Color"
              value={block.dividerColor ?? "#E5E7EB"}
              onChange={(v) => onChange({ dividerColor: v })}
            />
            <NumberInput
              label="Thickness"
              value={block.dividerThickness ?? 1}
              onChange={(v) => onChange({ dividerThickness: v })}
              min={1}
              max={20}
            />
          </>
        )}

        {/* ── Spacer ── */}
        {block.type === "spacer" && (
          <NumberInput
            label="Height"
            value={block.spacerHeight ?? 24}
            onChange={(v) => onChange({ spacerHeight: v })}
            min={4}
            max={200}
          />
        )}

        {/* ── Social ── */}
        {block.type === "social" && (
          <>
            <div>
              <label className="text-xs font-medium text-foreground-muted block mb-2">Social links</label>
              <div className="space-y-2">
                {(block.socialLinks ?? []).map((link, idx) => {
                  const cfg = SOCIAL_PLATFORM_CONFIG[link.platform as SocialPlatform];
                  const Icon = cfg?.icon ?? RiShareLine;
                  const color = cfg?.color ?? "#555";
                  return (
                    <div key={link.platform} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = (block.socialLinks ?? []).map((l, i) =>
                            i === idx ? { ...l, enabled: !l.enabled } : l
                          );
                          onChange({ socialLinks: next });
                        }}
                        className={cn(
                          "shrink-0 size-7 rounded-lg flex items-center justify-center border transition-colors",
                          link.enabled
                            ? "border-transparent text-white"
                            : "border-border bg-background-subtle text-foreground-muted"
                        )}
                        style={link.enabled ? { backgroundColor: color } : {}}
                        title={cfg?.label}
                      >
                        <Icon size={13} />
                      </button>
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => {
                          const next = (block.socialLinks ?? []).map((l, i) =>
                            i === idx ? { ...l, url: e.target.value } : l
                          );
                          onChange({ socialLinks: next });
                        }}
                        placeholder={`https://${link.platform}.com/...`}
                        disabled={!link.enabled}
                        className="flex-1 h-7 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 disabled:opacity-40"
                      />
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-foreground-muted">Click icon to toggle on/off</p>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground-muted block mb-1">Alignment</label>
              <Select
                value={block.alignment ?? "center"}
                onChange={(v) => onChange({ alignment: v as "left" | "center" | "right" })}
                options={ALIGNMENT_OPTIONS}
              />
            </div>
            <NumberInput
              label="Icon size"
              value={block.socialIconSize ?? 36}
              onChange={(v) => onChange({ socialIconSize: v })}
              min={20}
              max={64}
            />
            <NumberInput
              label="Border radius"
              value={block.socialIconRadius ?? 50}
              onChange={(v) => onChange({ socialIconRadius: v })}
              min={0}
              max={50}
              unit="%"
            />
            <div>
              <label className="text-xs font-medium text-foreground-muted block mb-1.5">
                Custom icon background
              </label>
              <p className="text-[10px] text-foreground-muted mb-2">
                Leave empty to use each platform's brand color.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={block.socialIconBgColor || "#16DAC1"}
                  onChange={(e) => onChange({ socialIconBgColor: e.target.value })}
                  className="size-8 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={block.socialIconBgColor ?? ""}
                  onChange={(e) => onChange({ socialIconBgColor: e.target.value })}
                  placeholder="Use brand colors"
                  className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                />
                {block.socialIconBgColor && (
                  <button
                    type="button"
                    onClick={() => onChange({ socialIconBgColor: "" })}
                    className="text-[10px] text-foreground-muted hover:text-destructive transition-colors shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── HTML ── */}
        {block.type === "html" && (
          <div>
            <label className="text-xs font-medium text-foreground-muted block mb-1">HTML code</label>
            <textarea
              value={block.htmlContent ?? ""}
              onChange={(e) => onChange({ htmlContent: e.target.value })}
              rows={10}
              spellCheck={false}
              className="w-full rounded-md border border-border bg-background-subtle px-2 py-2 text-xs font-mono outline-none placeholder:text-foreground-muted focus:border-primary focus:ring-1 focus:ring-primary/10 resize-none"
              placeholder="<!-- Your custom HTML -->"
            />
            <p className="mt-1.5 text-[10px] text-foreground-muted">
              Inline styles recommended for email compatibility.
            </p>
          </div>
        )}

        {/* ── Columns ── */}
        {block.type === "columns" && (() => {
          const stacks: ColumnItem[][] = block.columnStacks
            ?? (block.columnItems?.map((item: ColumnItem) => [item]) ?? [
              [{ type: "text" as const, textContent: "Column 1", alignment: "left" as const }],
              [{ type: "text" as const, textContent: "Column 2", alignment: "left" as const }],
            ]);

          function updateStacks(newStacks: ColumnItem[][]) {
            onChange({ columnStacks: newStacks, columnItems: undefined });
          }

          function renderItemEditor(item: ColumnItem, colIdx: number, itemIdx: number) {
            function updateItem(patch: Partial<ColumnItem>) {
              const newStacks = stacks.map((s, ci) =>
                ci === colIdx ? s.map((it, ii) => ii === itemIdx ? { ...it, ...patch } : it) : s
              );
              updateStacks(newStacks);
            }
            return (
              <div key={itemIdx} className="rounded-md border border-border bg-background overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wide">Item {itemIdx + 1}</p>
                  {stacks[colIdx].length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newStacks = stacks.map((s, ci) =>
                          ci === colIdx ? s.filter((_, ii) => ii !== itemIdx) : s
                        );
                        updateStacks(newStacks);
                      }}
                      className="text-[10px] text-foreground-muted hover:text-destructive transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="p-3 space-y-3">
                  {/* Content type */}
                  <div>
                    <label className="text-xs font-medium text-foreground-muted block mb-1">Type</label>
                    <Select
                      value={item.type}
                      onChange={(v) => updateItem({ type: v as ColumnItem["type"] })}
                      options={[
                        { value: "text", label: "Text" },
                        { value: "heading", label: "Heading" },
                        { value: "image", label: "Image" },
                        { value: "button", label: "Button" },
                      ]}
                    />
                  </div>
                  {item.type === "text" && (
                    <div>
                      <label className="text-xs font-medium text-foreground-muted block mb-1">Text</label>
                      <textarea
                        value={item.textContent ?? ""}
                        onChange={(e) => updateItem({ textContent: e.target.value })}
                        rows={3}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 resize-none"
                      />
                    </div>
                  )}
                  {item.type === "heading" && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-foreground-muted block mb-1">Heading text</label>
                        <input
                          type="text"
                          value={item.headingText ?? ""}
                          onChange={(e) => updateItem({ headingText: e.target.value })}
                          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground-muted block mb-1">Tag</label>
                        <Select
                          value={item.headingTag ?? "h2"}
                          onChange={(v) => updateItem({ headingTag: v as "h1" | "h2" | "h3" })}
                          options={[{ value: "h1", label: "H1" }, { value: "h2", label: "H2" }, { value: "h3", label: "H3" }]}
                        />
                      </div>
                    </>
                  )}
                  {item.type === "image" && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-foreground-muted block mb-1">Image URL</label>
                        <input
                          type="url"
                          value={item.imageUrl ?? ""}
                          onChange={(e) => updateItem({ imageUrl: e.target.value })}
                          placeholder="https://..."
                          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground-muted block mb-1">Link URL</label>
                        <input
                          type="url"
                          value={item.imageLink ?? ""}
                          onChange={(e) => updateItem({ imageLink: e.target.value })}
                          placeholder="https://..."
                          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                        />
                      </div>
                    </>
                  )}
                  {item.type === "button" && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-foreground-muted block mb-1">Label</label>
                        <input
                          type="text"
                          value={item.buttonLabel ?? ""}
                          onChange={(e) => updateItem({ buttonLabel: e.target.value })}
                          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground-muted block mb-1">URL</label>
                        <input
                          type="url"
                          value={item.buttonUrl ?? ""}
                          onChange={(e) => updateItem({ buttonUrl: e.target.value })}
                          placeholder="https://..."
                          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground-muted block mb-1">Background</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={item.buttonBgColor ?? "#16DAC1"} onChange={(e) => updateItem({ buttonBgColor: e.target.value })} className="size-8 rounded cursor-pointer border border-border" />
                          <input type="text" value={item.buttonBgColor ?? "#16DAC1"} onChange={(e) => updateItem({ buttonBgColor: e.target.value })} className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs font-mono outline-none focus:border-primary" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground-muted block mb-1">Text color</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={item.buttonTextColor ?? "#FFFFFF"} onChange={(e) => updateItem({ buttonTextColor: e.target.value })} className="size-8 rounded cursor-pointer border border-border" />
                          <input type="text" value={item.buttonTextColor ?? "#FFFFFF"} onChange={(e) => updateItem({ buttonTextColor: e.target.value })} className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs font-mono outline-none focus:border-primary" />
                        </div>
                      </div>
                    </>
                  )}
                  {/* Alignment for all types */}
                  <div>
                    <label className="text-xs font-medium text-foreground-muted block mb-1">Alignment</label>
                    <Select
                      value={item.alignment ?? "left"}
                      onChange={(v) => updateItem({ alignment: v as "left" | "center" | "right" })}
                      options={ALIGNMENT_OPTIONS}
                    />
                  </div>
                </div>
              </div>
            );
          }

          return (
            <>
              <div>
                <label className="text-xs font-medium text-foreground-muted block mb-1">Column count</label>
                <div className="flex gap-2">
                  {([2, 3] as (2 | 3)[]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        let newStacks = [...stacks];
                        if (n === 2 && newStacks.length > 2) newStacks = newStacks.slice(0, 2);
                        if (n === 3 && newStacks.length < 3) newStacks = [...newStacks, [{ type: "text" as const, textContent: `Column ${newStacks.length + 1}`, alignment: "left" as const }]];
                        onChange({ columnCount: n, columnStacks: newStacks, columnItems: undefined });
                      }}
                      className={cn(
                        "flex-1 h-8 rounded-md border text-xs font-medium transition-colors",
                        block.columnCount === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background-subtle text-foreground-muted hover:text-foreground"
                      )}
                    >
                      {n} columns
                    </button>
                  ))}
                </div>
              </div>
              <NumberInput
                label="Column gap"
                value={block.columnGap ?? 16}
                onChange={(v) => onChange({ columnGap: v })}
                min={0}
                max={80}
              />
              {stacks.map((colItems, colIdx) => (
                <div key={colIdx} className="rounded-lg border border-border bg-background-subtle overflow-hidden">
                  <div className="px-3 py-2 border-b border-border bg-background">
                    <p className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wide">Column {colIdx + 1}</p>
                  </div>
                  <div className="p-3 space-y-3">
                    {colItems.map((item, itemIdx) => renderItemEditor(item, colIdx, itemIdx))}
                    <button
                      type="button"
                      onClick={() => {
                        const newStacks = stacks.map((s, ci) =>
                          ci === colIdx ? [...s, { type: "text" as const, textContent: "", alignment: "left" as const }] : s
                        );
                        updateStacks(newStacks);
                      }}
                      className="w-full h-7 rounded-md border border-dashed border-border text-[10px] text-foreground-muted hover:text-foreground hover:border-primary/40 transition-colors"
                    >
                      + Add item to column
                    </button>
                  </div>
                </div>
              ))}
            </>
          );
        })()}

        {/* ── Common: alignment, font size, color ── */}
        {(block.type === "heading" || block.type === "text" || block.type === "button") && (
          <>
            <div>
              <label className="text-xs font-medium text-foreground-muted block mb-1">Alignment</label>
              <Select
                value={block.alignment ?? "left"}
                onChange={(v) => onChange({ alignment: v as "left" | "center" | "right" })}
                options={ALIGNMENT_OPTIONS}
              />
            </div>
          </>
        )}

        {(block.type === "heading" || block.type === "text") && (
          <>
            <NumberInput
              label="Font size"
              value={block.fontSize ?? (block.type === "heading" ? 24 : 15)}
              onChange={(v) => onChange({ fontSize: v })}
              min={10}
              max={72}
            />
            <ColorInput
              label="Color"
              value={block.color ?? "#1B1B1B"}
              onChange={(v) => onChange({ color: v })}
            />
          </>
        )}

        {block.type === "image" && (
          <div>
            <label className="text-xs font-medium text-foreground-muted block mb-1">Alignment</label>
            <Select
              value={block.alignment ?? "center"}
              onChange={(v) => onChange({ alignment: v as "left" | "center" | "right" })}
              options={ALIGNMENT_OPTIONS}
            />
          </div>
        )}

        {/* ── Block background ── */}
        <div>
          <label className="text-xs font-medium text-foreground-muted block mb-1">Block background</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={block.bgColor || "#ffffff"}
              onChange={(e) => onChange({ bgColor: e.target.value })}
              className="size-8 rounded cursor-pointer border border-border"
            />
            <input
              type="text"
              value={block.bgColor ?? ""}
              onChange={(e) => onChange({ bgColor: e.target.value || undefined })}
              placeholder="No background"
              className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
            />
            {block.bgColor && (
              <button
                type="button"
                onClick={() => onChange({ bgColor: undefined })}
                className="text-[10px] text-foreground-muted hover:text-destructive transition-colors shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Background image */}
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">Background Image</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={block.bgImage ?? ""}
              onChange={(e) => onChange({ bgImage: e.target.value || undefined })}
              placeholder="https://..."
              className="h-8 flex-1 min-w-0 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
            />
            <button
              type="button"
              disabled={bgImageUploading}
              onClick={() => bgImageFileInputRef.current?.click()}
              className="h-8 px-2.5 rounded-md border border-border bg-background-subtle text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-background transition-colors shrink-0 inline-flex items-center gap-1 disabled:opacity-50"
              title="Upload background image"
            >
              <RiUploadLine size={12} />
              {bgImageUploading ? "…" : "Upload"}
            </button>
            <button
              type="button"
              onClick={() => setBgImageLibraryOpen(true)}
              className="h-8 px-2.5 rounded-md border border-border bg-background-subtle text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-background transition-colors shrink-0 inline-flex items-center gap-1"
              title="Open image library"
            >
              <RiImageLine size={12} />
              Lib
            </button>
            <input
              ref={bgImageFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !workspaceId) return;
                setBgImageUploading(true);
                try {
                  const supabase = createClient();
                  const ext = file.name.split(".").pop();
                  const path = `${workspaceId}/blocks/${Date.now()}-bg.${ext}`;
                  const { error: upErr } = await supabase.storage
                    .from("template-images")
                    .upload(path, file, { upsert: false });
                  if (!upErr) {
                    const { data: urlData } = supabase.storage
                      .from("template-images")
                      .getPublicUrl(path);
                    if (urlData?.publicUrl) onChange({ bgImage: urlData.publicUrl });
                  }
                } catch (err) {
                  console.error("Background image upload failed:", err);
                } finally {
                  setBgImageUploading(false);
                  if (bgImageFileInputRef.current) bgImageFileInputRef.current.value = "";
                }
              }}
            />
          </div>
        </div>
        {block.bgImage && (
          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1">
              Overlay opacity: {Math.round((block.bgImageOverlay ?? 0) * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={block.bgImageOverlay ?? 0}
              onChange={(e) => onChange({ bgImageOverlay: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
        )}

        {/* ── Padding ── */}
        <div>
          <p className="text-xs font-medium text-foreground-muted mb-2">Padding</p>
          <div className="grid grid-cols-2 gap-2">
            <PaddingRow
              label="Top"
              value={block.paddingTop ?? 8}
              onChange={(v) => onChange({ paddingTop: v })}
            />
            <PaddingRow
              label="Bottom"
              value={block.paddingBottom ?? 8}
              onChange={(v) => onChange({ paddingBottom: v })}
            />
            <PaddingRow
              label="Left"
              value={block.paddingLeft ?? 0}
              onChange={(v) => onChange({ paddingLeft: v })}
            />
            <PaddingRow
              label="Right"
              value={block.paddingRight ?? 0}
              onChange={(v) => onChange({ paddingRight: v })}
            />
          </div>
        </div>

        {/* ── Visibility ── */}
        <div>
          <p className="text-xs font-medium text-foreground-muted mb-2">Visibility</p>
          <div className="rounded-lg border border-border bg-background-subtle p-3 space-y-2">
            <label className="flex items-center justify-between cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <RiComputerLine size={13} className="text-foreground-muted shrink-0" />
                <span className="text-xs text-foreground">Desktop</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!block.hideOnDesktop}
                onClick={() => onChange({ hideOnDesktop: !block.hideOnDesktop })}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                  !block.hideOnDesktop ? "bg-primary" : "bg-border"
                )}
              >
                <span className={cn(
                  "inline-block size-3.5 rounded-full bg-white shadow transition-transform",
                  !block.hideOnDesktop ? "translate-x-4" : "translate-x-0.5"
                )} />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <RiSmartphoneLine size={13} className="text-foreground-muted shrink-0" />
                <span className="text-xs text-foreground">Mobile</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!block.hideOnMobile}
                onClick={() => onChange({ hideOnMobile: !block.hideOnMobile })}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                  !block.hideOnMobile ? "bg-primary" : "bg-border"
                )}
              >
                <span className={cn(
                  "inline-block size-3.5 rounded-full bg-white shadow transition-transform",
                  !block.hideOnMobile ? "translate-x-4" : "translate-x-0.5"
                )} />
              </button>
            </label>
          </div>
        </div>

      </div>
    </div>

    <ImageLibraryModal
      open={imageLibraryOpen}
      onOpenChange={setImageLibraryOpen}
      workspaceId={workspaceId}
      onSelect={(url) => onChange({ imageUrl: url })}
    />
    <ImageLibraryModal
      open={bgImageLibraryOpen}
      onOpenChange={setBgImageLibraryOpen}
      workspaceId={workspaceId}
      onSelect={(url) => onChange({ bgImage: url })}
    />
    </>
  );
}

// ─── Block card (left panel visual card) ──────────────────────────────────────

function BlockCardPreview({ type }: { type: BlockType }) {
  switch (type) {
    case "heading":
      return (
        <div className="flex flex-col items-center justify-center gap-1 w-full px-2">
          <div className="h-2.5 w-10 rounded bg-foreground/70" />
          <div className="h-1.5 w-7 rounded bg-foreground/20" />
        </div>
      );
    case "text":
      return (
        <div className="flex flex-col gap-1 w-full px-2">
          <div className="h-1 w-full rounded bg-foreground/30" />
          <div className="h-1 w-full rounded bg-foreground/30" />
          <div className="h-1 w-3/4 rounded bg-foreground/30" />
        </div>
      );
    case "image":
      return (
        <div className="w-10 h-8 rounded-md border border-border bg-background-subtle flex items-center justify-center">
          <RiImage2Line size={14} className="text-foreground-muted/60" />
        </div>
      );
    case "button":
      return (
        <div className="h-5 w-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <span className="text-[8px] font-bold text-primary">Button</span>
        </div>
      );
    case "divider":
      return (
        <div className="w-full px-2">
          <div className="h-px w-full bg-border" />
        </div>
      );
    case "spacer":
      return (
        <div className="w-10 h-8 rounded border-2 border-dashed border-primary/40 bg-primary/5" />
      );
    case "social":
      return (
        <div className="grid grid-cols-2 gap-1">
          {(["facebook", "instagram", "linkedin", "youtube"] as SocialPlatform[]).map((p) => {
            const cfg = SOCIAL_PLATFORM_CONFIG[p];
            const Icon = cfg.icon;
            return (
              <div
                key={p}
                className="size-5 rounded flex items-center justify-center"
                style={{ backgroundColor: cfg.color + "22", border: `1px solid ${cfg.color}44` }}
              >
                <Icon size={10} style={{ color: cfg.color }} />
              </div>
            );
          })}
        </div>
      );
    case "html":
      return (
        <div className="h-8 w-12 rounded-md border border-primary/30 bg-primary/5 flex items-center justify-center">
          <span className="text-[9px] font-mono font-bold text-primary">{"</>"}</span>
        </div>
      );
    case "columns":
      return (
        <div className="flex gap-1 w-full px-1">
          <div className="flex-1 h-8 rounded bg-background-subtle border border-border" />
          <div className="flex-1 h-8 rounded bg-background-subtle border border-border" />
        </div>
      );
    default:
      return null;
  }
}

interface BlockCardProps {
  type: BlockType;
  label: string;
  isDraggingThis: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function BlockCard({ type, label, isDraggingThis, onDragStart, onDragEnd, onClick }: BlockCardProps) {
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border bg-background p-3 pt-2.5 text-center transition-all duration-150 select-none cursor-grab active:cursor-grabbing group",
        isDraggingThis
          ? "opacity-50 scale-95 border-primary/40 bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-background-subtle hover:shadow-sm"
      )}
    >
      {/* Drag handle dots */}
      <div className="grid grid-cols-3 gap-[3px] opacity-30 group-hover:opacity-60 transition-opacity">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="size-[3px] rounded-full bg-foreground" />
        ))}
      </div>

      {/* Visual preview */}
      <div className="flex items-center justify-center h-10 w-full">
        <BlockCardPreview type={type} />
      </div>

      {/* Label */}
      <span className={cn(
        "text-[11px] font-semibold transition-colors",
        isDraggingThis ? "text-primary" : "text-foreground group-hover:text-primary"
      )}>
        {label}
      </span>
    </button>
  );
}

// ─── Drop zone ─────────────────────────────────────────────────────────────────

interface DropZoneProps {
  index: number;
  isActive: boolean;
  isDragging: boolean;
  onDrop: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragLeave: () => void;
}

function DropZone({ index, isActive, isDragging, onDrop, onDragOver, onDragLeave }: DropZoneProps) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; onDragOver(index); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(index); }}
      className={cn(
        "relative transition-all duration-100 ease-out",
        isDragging ? "h-5" : "h-0 overflow-hidden pointer-events-none"
      )}
    >
      {/* Insertion stroke line — only visible when actively hovering */}
      <div
        className={cn(
          "absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center transition-all duration-100",
          isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
        )}
      >
        {/* Left dot */}
        <div className="size-2 rounded-full bg-primary shrink-0 -ml-1 shadow-sm" />
        {/* Stroke line */}
        <div className="flex-1 h-[2px] bg-primary shadow-sm" />
        {/* Right dot */}
        <div className="size-2 rounded-full bg-primary shrink-0 -mr-1 shadow-sm" />
      </div>
    </div>
  );
}

// ─── Left panel ────────────────────────────────────────────────────────────────

type LeftTab = "blocks" | "sections" | "saved";

interface LeftPanelProps {
  onAddBlock: (type: BlockType, insertIndex?: number) => void;
  onAddSection: (blocks: EmailBlock[]) => void;
  onUseSavedBlock: (block: EmailBlock) => void;
  onDragStart: (type: BlockType) => void;
  onDragEnd: () => void;
  onSectionDragStart: (sectionBlocks: EmailBlock[]) => void;
  onSectionDragEnd: () => void;
  isDragging: boolean;
  savedBlocks?: SavedBlockRow[];
  savedBlocksLoading?: boolean;
  onDeleteSavedBlock?: (id: string) => void;
}

// ─── Section accordion (used inside LeftPanel) ─────────────────────────────────

function SectionAccordion({
  category,
  onAddSection,
  onDragStart,
  onDragEnd,
}: {
  category: SectionCategory;
  onAddSection: (blocks: EmailBlock[]) => void;
  onDragStart: (sectionBlocks: EmailBlock[]) => void;
  onDragEnd: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  return (
    <div className="border border-border rounded-xl overflow-hidden mb-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-background hover:bg-background-subtle transition-colors text-left"
      >
        <span className="text-[11px] font-semibold text-foreground">{category.label}</span>
        <span className={cn("text-foreground-muted transition-transform duration-200", open && "rotate-180")}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border">
          {category.sections.map((section: SectionTemplate) => (
            <div
              key={section.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("sectionDrag", "1");
                setDraggingId(section.id);
                onDragStart(section.blocks);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                onDragEnd();
              }}
              onClick={() => onAddSection(section.blocks)}
              className={cn(
                "w-full flex flex-col items-start gap-0.5 px-3 py-2.5 transition-colors text-left group cursor-grab active:cursor-grabbing select-none",
                draggingId === section.id
                  ? "opacity-40 bg-background-subtle"
                  : "hover:bg-background-subtle"
              )}
            >
              <span className={cn("text-[11px] font-semibold transition-colors", draggingId === section.id ? "text-foreground-muted" : "text-foreground group-hover:text-primary")}>{section.name}</span>
              {section.description && (
                <span className="text-[10px] text-foreground-muted leading-tight">{section.description}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LeftPanel({ onAddBlock, onAddSection, onUseSavedBlock, onDragStart, onDragEnd, onSectionDragStart, onSectionDragEnd, isDragging, savedBlocks, savedBlocksLoading, onDeleteSavedBlock }: LeftPanelProps) {
  const [tab, setTab] = React.useState<LeftTab>("blocks");
  const [draggingType, setDraggingType] = React.useState<BlockType | null>(null);

  return (
    <div className="flex flex-col h-full border-r border-border bg-background">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(
          [
            { id: "blocks", icon: RiLayoutLine, label: "Blocks" },
            { id: "sections", icon: RiLayoutGridLine, label: "Sections" },
            { id: "saved", icon: RiBookmarkLine, label: "Saved" },
          ] as { id: LeftTab; icon: React.ElementType; label: string }[]
        ).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 inline-flex flex-col items-center gap-0.5 py-3 text-[11px] font-semibold transition-colors",
              tab === id
                ? "text-primary border-b-2 border-primary"
                : "text-foreground-muted hover:text-foreground border-b-2 border-transparent"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "blocks" ? (
        <>
          {/* Block card grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {BLOCK_CATALOG.map(({ type, label }) => (
                <BlockCard
                  key={type}
                  type={type}
                  label={label}
                  isDraggingThis={draggingType === type}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "copy";
                    e.dataTransfer.setData("blockType", type);
                    setDraggingType(type);
                    onDragStart(type);
                  }}
                  onDragEnd={() => {
                    setDraggingType(null);
                    onDragEnd();
                  }}
                  onClick={() => onAddBlock(type)}
                />
              ))}
            </div>

            {/* Drag hint */}
            {!isDragging && (
              <p className="mt-4 text-[10px] text-foreground-muted text-center leading-relaxed">
                Drag or click to add blocks
              </p>
            )}
          </div>
        </>
      ) : tab === "saved" ? (
        <div className="flex-1 overflow-y-auto p-3">
          {savedBlocksLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-background-subtle animate-pulse" />
              ))}
            </div>
          ) : (savedBlocks ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2 text-foreground-muted">
              <RiBookmarkLine size={28} className="opacity-30" />
              <p className="text-xs font-medium">No saved blocks</p>
              <p className="text-[10px] leading-relaxed">Hover a block on the canvas and click the bookmark icon to save it</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(savedBlocks ?? []).map((sb) => (
                <div
                  key={sb.id}
                  className="group relative rounded-xl border border-border bg-background hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer overflow-hidden"
                  onClick={() => onUseSavedBlock(sb.block)}
                >
                  <div className="px-3 py-2.5 pr-8">
                    <p className="text-[11px] font-semibold text-foreground truncate">{sb.name}</p>
                    <p className="text-[10px] text-foreground-muted capitalize mt-0.5">{sb.block.type}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteSavedBlock?.(sb.id); }}
                    className="absolute top-2 right-2 size-5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-foreground-muted hover:text-destructive flex items-center justify-center"
                    title="Remove saved block"
                  >
                    <RiDeleteBin2Line size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* sections tab */
        <div className="flex-1 overflow-y-auto p-3">
          {SECTION_CATEGORIES.map((cat) => (
            <SectionAccordion
              key={cat.id}
              category={cat}
              onAddSection={onAddSection}
              onDragStart={onSectionDragStart}
              onDragEnd={onSectionDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Canvas block wrapper ──────────────────────────────────────────────────────

interface CanvasBlockProps {
  block: EmailBlock;
  blockIndex: number;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  isDraggingThis: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSave: () => void;
  onDragStart: (blockId: string, blockIndex: number) => void;
  onDragEnd: () => void;
}

function CanvasBlock({
  block,
  blockIndex,
  isSelected,
  isFirst,
  isLast,
  isDraggingThis,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onSave,
  onDragStart,
  onDragEnd,
}: CanvasBlockProps) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("canvasBlockId", block.id);
        onDragStart(block.id, blockIndex);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "relative group transition-all duration-150 cursor-grab active:cursor-grabbing",
        isDraggingThis ? "opacity-40 scale-[0.98]" : "",
        isSelected
          ? "ring-2 ring-primary ring-offset-0 rounded-sm"
          : hovered
          ? "ring-1 ring-primary/40 rounded-sm"
          : ""
      )}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Visibility badges */}
      {(block.hideOnMobile || block.hideOnDesktop) && (
        <div className="absolute top-1 left-1 z-10 flex gap-1 pointer-events-none">
          {block.hideOnMobile && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-900/75 text-white backdrop-blur-sm">
              <RiSmartphoneLine size={8} />
              Hidden mobile
            </span>
          )}
          {block.hideOnDesktop && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-900/75 text-white backdrop-blur-sm">
              <RiComputerLine size={8} />
              Hidden desktop
            </span>
          )}
        </div>
      )}

      {/* Hover toolbar */}
      {(hovered || isSelected) && (
        <div
          className="absolute -top-8 right-0 z-10 flex items-center gap-0.5 rounded-lg bg-gray-900 px-1 py-1 shadow-lg"
          onMouseEnter={() => setHovered(true)}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="size-6 inline-flex items-center justify-center rounded text-white disabled:opacity-30 hover:bg-white/10 transition-colors"
            title="Move up"
          >
            <RiArrowUpLine size={12} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="size-6 inline-flex items-center justify-center rounded text-white disabled:opacity-30 hover:bg-white/10 transition-colors"
            title="Move down"
          >
            <RiArrowDownLine size={12} />
          </button>
          <button
            onClick={onDuplicate}
            className="size-6 inline-flex items-center justify-center rounded text-white hover:bg-white/10 transition-colors"
            title="Duplicate"
          >
            <RiFileCopyLine size={12} />
          </button>
          <button
            onClick={onSave}
            className="size-6 inline-flex items-center justify-center rounded text-yellow-400 hover:bg-white/10 transition-colors"
            title="Save block as snippet"
          >
            <RiBookmarkLine size={12} />
          </button>
          <div className="w-px h-4 bg-white/20 mx-0.5" />
          <button
            onClick={onDelete}
            className="size-6 inline-flex items-center justify-center rounded text-red-400 hover:bg-white/10 transition-colors"
            title="Delete"
          >
            <RiDeleteBin2Line size={12} />
          </button>
        </div>
      )}

      <BlockPreview block={block} />
    </div>
  );
}

// ─── History hook ──────────────────────────────────────────────────────────────

function useHistory<T>(initial: T) {
  // Single state object — atomic update, no stale-closure race between index & stack
  const [history, setHistory] = React.useState<{ stack: T[]; index: number }>({
    stack: [initial],
    index: 0,
  });

  const current = history.stack[history.index] ?? initial;

  function push(value: T) {
    setHistory((prev) => {
      const newStack = [...prev.stack.slice(0, prev.index + 1), value];
      return { stack: newStack, index: newStack.length - 1 };
    });
  }

  function undo() {
    setHistory((prev) =>
      prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev
    );
  }

  function redo() {
    setHistory((prev) =>
      prev.index < prev.stack.length - 1
        ? { ...prev, index: prev.index + 1 }
        : prev
    );
  }

  function jumpTo(index: number) {
    setHistory((prev) =>
      index >= 0 && index < prev.stack.length ? { ...prev, index } : prev
    );
  }

  const canUndo = history.index > 0;
  const canRedo = history.index < history.stack.length - 1;
  const stackLength = history.stack.length;
  const currentIndex = history.index;

  return { current, push, undo, redo, jumpTo, canUndo, canRedo, stackLength, currentIndex };
}

// ─── Builder inner ─────────────────────────────────────────────────────────────

function BuilderInner() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

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

  // Template state
  const [template, setTemplate] = React.useState<MarketingTemplateRow | null>(null);
  const [templateLoading, setTemplateLoading] = React.useState(true);

  // Editable fields
  const [templateName, setTemplateName] = React.useState("");
  const [subjectLine, setSubjectLine] = React.useState("");
  const [previewText, setPreviewText] = React.useState("");
  const [templateBgColor, setTemplateBgColor] = React.useState("#F6F6F6");
  const [templateBodyBgColor, setTemplateBodyBgColor] = React.useState("#FFFFFF");
  const [templateFontFamily, setTemplateFontFamily] = React.useState(
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  );
  const [templateEmailWidth, setTemplateEmailWidth] = React.useState(600);

  // Blocks history
  const blocksHistory = useHistory<EmailBlock[]>([]);
  const blocks: EmailBlock[] = blocksHistory.current ?? [];

  // Selection
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null;

  // Drag & drop
  const [isDragging, setIsDragging] = React.useState(false);
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null);
  const dragInfo = React.useRef<
    | { kind: "panel"; blockType: BlockType }
    | { kind: "canvas"; blockId: string; blockIndex: number }
    | { kind: "section"; sectionBlocks: EmailBlock[] }
    | null
  >(null);

  // View
  const [viewMode, setViewMode] = React.useState<"desktop" | "mobile">("desktop");

  // Auto-save
  const [saveStatus, setSaveStatus] = React.useState<"saved" | "saving" | "unsaved">("saved");
  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals
  const [sendTestOpen, setSendTestOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [versionHistory, setVersionHistory] = React.useState<TemplateVersionRow[]>([]);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = React.useState(false);

  // Import HTML
  const [importHtmlOpen, setImportHtmlOpen] = React.useState(false);
  const [importHtmlValue, setImportHtmlValue] = React.useState("");

  // Saved blocks
  const [savedBlocks, setSavedBlocks] = React.useState<SavedBlockRow[]>([]);
  const [savedBlocksLoading, setSavedBlocksLoading] = React.useState(false);
  const [saveBlockDialogOpen, setSaveBlockDialogOpen] = React.useState(false);
  const [saveBlockName, setSaveBlockName] = React.useState("");
  const [blockToSaveId, setBlockToSaveId] = React.useState<string | null>(null);

  // Overflow menu
  const [overflowMenuOpen, setOverflowMenuOpen] = React.useState(false);
  const [overflowMenuStyle, setOverflowMenuStyle] = React.useState<React.CSSProperties>({});
  const overflowBtnRef = React.useRef<HTMLButtonElement>(null);

  // Load template
  React.useEffect(() => {
    if (!workspaceId || !templateId) return;
    getMarketingTemplate(workspaceId, templateId).then(({ template: t, error }) => {
      if (error || !t) {
        showToast({ title: "Failed to load template", subtitle: error ?? "Not found" });
        setTemplateLoading(false);
        return;
      }
      setTemplate(t);
      setTemplateName(t.name);
      setSubjectLine(t.subject_line ?? "");
      setPreviewText(t.preview_text ?? "");
      if (t.bg_color) setTemplateBgColor(t.bg_color);
      if (t.body_bg_color) setTemplateBodyBgColor(t.body_bg_color);
      if (t.font_family) setTemplateFontFamily(t.font_family);
      if (t.email_width) setTemplateEmailWidth(t.email_width);
      blocksHistory.push(t.blocks ?? []);
      setTemplateLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, templateId]);

  // Load saved blocks
  React.useEffect(() => {
    if (!workspaceId) return;
    setSavedBlocksLoading(true);
    getSavedBlocks(workspaceId).then(({ blocks: sb }) => {
      setSavedBlocks(sb);
      setSavedBlocksLoading(false);
    });
  }, [workspaceId]);

  // Google Font injection
  React.useEffect(() => {
    const fontOption = FONT_OPTIONS.find(f => f.value === templateFontFamily)
    if (fontOption?.googleFont) {
      const id = 'google-font-link'
      let link = document.getElementById(id) as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.id = id
        link.rel = 'stylesheet'
        document.head.appendChild(link)
      }
      link.href = `https://fonts.googleapis.com/css2?family=${fontOption.googleFont}:wght@400;600;700&display=swap`
    }
  }, [templateFontFamily])

  // Auto-save on change
  function scheduleAutoSave() {
    setSaveStatus("unsaved");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (!workspaceId || !userId || !template) return;
      setSaveStatus("saving");
      const { error } = await updateMarketingTemplate(
        workspaceId,
        template.id,
        userId,
        userName,
        {
          name: templateName,
          subject_line: subjectLine || null,
          preview_text: previewText || null,
          blocks: blocksHistory.current,
          bg_color: templateBgColor,
          body_bg_color: templateBodyBgColor,
          font_family: templateFontFamily,
          email_width: templateEmailWidth,
        }
      );
      setSaveStatus(error ? "unsaved" : "saved");
    }, 2000);
  }

  // Watch block + settings changes → auto-save
  React.useEffect(() => {
    if (!template) return;
    scheduleAutoSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, templateName, subjectLine, previewText, templateBgColor, templateBodyBgColor, templateFontFamily, templateEmailWidth]);

  // Drag handlers
  function handlePanelDragStart(type: BlockType) {
    dragInfo.current = { kind: "panel", blockType: type };
    setIsDragging(true);
  }

  function handleSectionDragStart(sectionBlocks: EmailBlock[]) {
    dragInfo.current = { kind: "section", sectionBlocks };
    setIsDragging(true);
  }

  function handleCanvasDragStart(blockId: string, blockIndex: number) {
    dragInfo.current = { kind: "canvas", blockId, blockIndex };
    setIsDragging(true);
  }

  function handleDragEnd() {
    dragInfo.current = null;
    setIsDragging(false);
    setDropTargetIndex(null);
  }

  function handleDropAtIndex(dropIndex: number) {
    if (!dragInfo.current) return;
    if (dragInfo.current.kind === "panel") {
      addBlock(dragInfo.current.blockType, dropIndex);
    } else if (dragInfo.current.kind === "section") {
      addSection(dragInfo.current.sectionBlocks, dropIndex);
    } else {
      const { blockId, blockIndex } = dragInfo.current;
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      // Don't reorder if dropped on itself
      if (dropIndex === blockIndex || dropIndex === blockIndex + 1) {
        handleDragEnd();
        return;
      }
      const filtered = blocks.filter((b) => b.id !== blockId);
      const insertAt = dropIndex > blockIndex ? dropIndex - 1 : dropIndex;
      const next = [
        ...filtered.slice(0, insertAt),
        block,
        ...filtered.slice(insertAt),
      ];
      blocksHistory.push(next);
    }
    handleDragEnd();
  }

  // Block mutations
  function addBlock(type: BlockType, insertIndex?: number) {
    const newBlock = createBlock(type);
    const next =
      insertIndex !== undefined
        ? [...blocks.slice(0, insertIndex), newBlock, ...blocks.slice(insertIndex)]
        : [...blocks, newBlock];
    blocksHistory.push(next);
    setSelectedBlockId(newBlock.id);
  }

  function updateBlock(id: string, updates: Partial<EmailBlock>) {
    const next = blocks.map((b) => (b.id === id ? { ...b, ...updates } : b));
    blocksHistory.push(next);
  }

  function deleteBlock(id: string) {
    const next = blocks.filter((b) => b.id !== id);
    blocksHistory.push(next);
    if (selectedBlockId === id) setSelectedBlockId(null);
  }

  function moveBlock(id: string, direction: "up" | "down") {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const next = [...blocks];
    if (direction === "up" && idx > 0) {
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    } else if (direction === "down" && idx < next.length - 1) {
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    }
    blocksHistory.push(next);
  }

  function duplicateBlock(id: string) {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    const copy = { ...block, id: generateId() };
    const idx = blocks.findIndex((b) => b.id === id);
    const next = [...blocks.slice(0, idx + 1), copy, ...blocks.slice(idx + 1)];
    blocksHistory.push(next);
    setSelectedBlockId(copy.id);
  }

  // Add a whole section (regenerates all block IDs)
  function addSection(sectionBlocks: EmailBlock[], insertIndex?: number) {
    const newBlocks = sectionBlocks.map((b) => ({ ...b, id: generateId() }));
    const next =
      insertIndex !== undefined
        ? [...blocks.slice(0, insertIndex), ...newBlocks, ...blocks.slice(insertIndex)]
        : [...blocks, ...newBlocks];
    blocksHistory.push(next);
    setSelectedBlockId(newBlocks[0]?.id ?? null);
  }

  // Saved block handlers
  function useSavedBlock(block: EmailBlock) {
    const copy = { ...block, id: generateId() };
    const next = [...blocks, copy];
    blocksHistory.push(next);
    setSelectedBlockId(copy.id);
  }

  async function handleSaveBlock() {
    if (!blockToSaveId || !saveBlockName.trim() || !workspaceId || !userId) return;
    const block = blocks.find((b) => b.id === blockToSaveId);
    if (!block) return;
    const { savedBlock, error } = await saveBlock(workspaceId, userId, userName, saveBlockName.trim(), block);
    if (error || !savedBlock) {
      showToast({ title: "Failed to save block", subtitle: error ?? "" });
      return;
    }
    setSavedBlocks((prev) => [savedBlock, ...prev]);
    setSaveBlockDialogOpen(false);
    setSaveBlockName("");
    setBlockToSaveId(null);
    showToast({ title: `Block saved as "${savedBlock.name}"` });
  }

  async function handleDeleteSavedBlock(id: string) {
    if (!workspaceId) return;
    const { error } = await deleteSavedBlock(workspaceId, id);
    if (!error) setSavedBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  // Helper to derive googleFontUrl
  function getGoogleFontUrl(fontFamily: string): string | undefined {
    const opt = FONT_OPTIONS.find(f => f.value === fontFamily)
    if (!opt?.googleFont) return undefined
    return `https://fonts.googleapis.com/css2?family=${opt.googleFont}:wght@400;600;700&display=swap`
  }

  // Save & publish
  async function handlePublish() {
    if (!workspaceId || !userId || !template) return;
    setPublishing(true);
    const googleFontUrl = getGoogleFontUrl(templateFontFamily)
    const html = generateEmailHtml({
      ...template,
      name: templateName,
      subject_line: subjectLine || null,
      preview_text: previewText || null,
      blocks,
    }, { bgColor: templateBgColor, fontFamily: templateFontFamily, bodyBgColor: templateBodyBgColor, maxWidth: templateEmailWidth, googleFontUrl });
    const { template: updated, error } = await publishMarketingTemplate(
      workspaceId,
      template.id,
      userId,
      userName,
      template.version
    );
    // Also save blocks + html
    await updateMarketingTemplate(workspaceId, template.id, userId, userName, {
      name: templateName,
      subject_line: subjectLine || null,
      preview_text: previewText || null,
      blocks,
      html_content: html,
      bg_color: templateBgColor,
      body_bg_color: templateBodyBgColor,
      font_family: templateFontFamily,
      email_width: templateEmailWidth,
    });
    // Save a version snapshot
    await saveTemplateVersion(template.id, userId, userName, {
      version_number: updated?.version ?? template.version,
      blocks,
      html_content: html,
      bg_color: templateBgColor,
      font_family: templateFontFamily,
      body_bg_color: templateBodyBgColor,
      email_width: templateEmailWidth,
    });
    setPublishing(false);
    if (error) {
      showToast({ title: "Failed to publish", subtitle: error });
      return;
    }
    if (updated) {
      setTemplate({ ...updated, version: updated.version });
    }
    setSaveStatus("saved");
    showToast({
      title: "Template published",
      subtitle: `v${(updated?.version ?? template.version)}`,
    });
  }

  async function openHistory() {
    setHistoryOpen(true);
    if (versionHistory.length === 0 && template) {
      const { versions } = await getTemplateVersions(template.id);
      setVersionHistory(versions);
    }
  }

  // Import HTML
  function handleImportHtml(mode: 'append' | 'replace') {
    if (!importHtmlValue.trim()) return;
    const newBlock: EmailBlock = { ...createBlock('html'), htmlContent: importHtmlValue };
    if (mode === 'replace') {
      blocksHistory.push([newBlock]);
    } else {
      blocksHistory.push([...blocks, newBlock]);
      setSelectedBlockId(newBlock.id);
    }
    setImportHtmlValue('');
    setImportHtmlOpen(false);
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      const target = e.target as HTMLElement;
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as HTMLElement).isContentEditable;

      if (ctrl && e.key === 'z' && !e.shiftKey && !isEditing) {
        e.preventDefault();
        blocksHistory.undo();
      } else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !isEditing) {
        e.preventDefault();
        blocksHistory.redo();
      } else if (ctrl && e.key === 's') {
        e.preventDefault();
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        (async () => {
          if (!workspaceId || !userId || !template) return;
          setSaveStatus('saving');
          const { error } = await updateMarketingTemplate(
            workspaceId, template.id, userId, userName,
            {
              name: templateName, subject_line: subjectLine || null,
              preview_text: previewText || null, blocks: blocksHistory.current,
              bg_color: templateBgColor, body_bg_color: templateBodyBgColor,
              font_family: templateFontFamily, email_width: templateEmailWidth,
            }
          );
          setSaveStatus(error ? 'unsaved' : 'saved');
        })();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocksHistory, template, workspaceId, userId, userName, templateName, subjectLine, previewText, templateBgColor, templateBodyBgColor, templateFontFamily, templateEmailWidth]);

  // Export HTML
  function handleExportHtml() {
    if (!template) return;
    const googleFontUrl = getGoogleFontUrl(templateFontFamily)
    const html = generateEmailHtml({
      ...template,
      name: templateName,
      subject_line: subjectLine || null,
      preview_text: previewText || null,
      blocks,
    }, { bgColor: templateBgColor, fontFamily: templateFontFamily, bodyBgColor: templateBodyBgColor, maxWidth: templateEmailWidth, googleFontUrl });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${templateName.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ title: "HTML exported" });
  }

  async function handleSendTest(emails: string[], addPrefix: boolean) {
    setSendTestOpen(false);
    if (!template) return;
    const googleFontUrl = getGoogleFontUrl(templateFontFamily)
    const html = generateEmailHtml({
      ...template,
      name: templateName,
      blocks,
    }, { bgColor: templateBgColor, fontFamily: templateFontFamily, bodyBgColor: templateBodyBgColor, maxWidth: templateEmailWidth, googleFontUrl });
    const subject = addPrefix
      ? `[TEST] ${subjectLine || templateName}`
      : (subjectLine || templateName);
    try {
      const res = await fetch("/api/email/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emails, subject, html, templateName, addPrefix }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast({ title: "Failed to send test", subtitle: data.error ?? "Unknown error" });
        return;
      }
      showToast({
        title: `Test sent to ${emails.length} recipient${emails.length !== 1 ? "s" : ""}`,
        subtitle: `Subject: ${subject}`,
      });
    } catch (err) {
      showToast({ title: "Failed to send test", subtitle: String(err) });
    }
  }

  const canvasWidth = viewMode === "mobile" ? 375 : templateEmailWidth;

  const previewTemplate: MarketingTemplateRow = template
    ? {
        ...template,
        name: templateName,
        subject_line: subjectLine || null,
        preview_text: previewText || null,
        blocks,
      }
    : ({} as MarketingTemplateRow);

  if (templateLoading || wsLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-sm text-foreground-muted animate-pulse">Loading builder…</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground-muted">Template not found</p>
          <button
            onClick={() => router.push("/marketing/templates")}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Back to templates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border bg-background shrink-0">
        {/* Back link */}
        <button
          onClick={() => router.push("/marketing/templates")}
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors shrink-0"
        >
          <RiArrowLeftLine size={15} />
          Templates
        </button>

        <div className="w-px h-5 bg-border" />

        {/* Template name (inline edit) */}
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="flex-1 min-w-0 max-w-xs text-sm font-semibold bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition-colors py-0.5"
          spellCheck={false}
        />

        {/* Save status */}
        <span
          className={cn(
            "text-[11px] font-medium shrink-0 transition-colors",
            saveStatus === "saving"
              ? "text-foreground-muted"
              : saveStatus === "unsaved"
              ? "text-amber-600"
              : "text-teal-600"
          )}
        >
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "unsaved"
            ? "Unsaved changes"
            : (
              <span className="flex items-center gap-1">
                <RiCheckLine size={12} />
                Saved
              </span>
            )}
        </span>

        <div className="flex-1" />

        {/* Desktop / Mobile toggle */}
        <div className="flex items-center gap-0.5 bg-background-subtle rounded-full p-1">
          <button
            onClick={() => setViewMode("desktop")}
            className={cn(
              "size-8 rounded-full flex items-center justify-center transition-colors",
              viewMode === "desktop"
                ? "bg-background shadow-sm text-foreground"
                : "text-foreground-muted hover:text-foreground"
            )}
            title="Desktop view"
          >
            <RiComputerLine size={15} />
          </button>
          <button
            onClick={() => setViewMode("mobile")}
            className={cn(
              "size-8 rounded-full flex items-center justify-center transition-colors",
              viewMode === "mobile"
                ? "bg-background shadow-sm text-foreground"
                : "text-foreground-muted hover:text-foreground"
            )}
            title="Mobile view"
          >
            <RiSmartphoneLine size={15} />
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={blocksHistory.undo}
            disabled={!blocksHistory.canUndo}
            className="size-8 inline-flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-subtle transition-colors disabled:opacity-30"
            title="Undo"
          >
            <RiArrowGoBackLine size={15} />
          </button>
          <button
            onClick={blocksHistory.redo}
            disabled={!blocksHistory.canRedo}
            className="size-8 inline-flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-subtle transition-colors disabled:opacity-30"
            title="Redo"
          >
            <RiArrowGoForwardLine size={15} />
          </button>
          <div className="relative">
            <button
              onClick={() => setHistoryPanelOpen(v => !v)}
              title="History"
              className={cn("size-8 rounded-lg inline-flex items-center justify-center transition-colors", historyPanelOpen ? "bg-primary/10 text-primary" : "text-foreground-muted hover:bg-background-subtle hover:text-foreground")}
            >
              <RiHistoryLine size={15} />
            </button>
            {historyPanelOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 rounded-xl border border-border bg-background shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-foreground">History</p>
                  <p className="text-[10px] text-foreground-muted">{blocksHistory.stackLength} states</p>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {Array.from({ length: blocksHistory.stackLength }, (_, i) => blocksHistory.stackLength - 1 - i).map(idx => (
                    <button
                      key={idx}
                      onClick={() => { blocksHistory.jumpTo(idx); setHistoryPanelOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                        idx === blocksHistory.currentIndex
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-background-subtle"
                      )}
                    >
                      <span className="size-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0" />
                      {idx === 0 ? "Initial state" : `Change ${idx}`}
                      {idx === blocksHistory.currentIndex && (
                        <span className="ml-auto text-[9px] text-primary">Current</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={openHistory}
            className="size-8 inline-flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-subtle transition-colors"
            title="Version history"
          >
            <RiHistoryLine size={15} />
          </button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPreviewOpen(true)}
        >
          <RiEyeLine size={14} />
          Preview
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSendTestOpen(true)}
        >
          <RiSendPlaneLine size={14} />
          Send test
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={handlePublish}
          disabled={publishing}
        >
          {publishing ? "Publishing…" : "Save & publish"}
        </Button>

        {/* Overflow menu */}
        <button
          ref={overflowBtnRef}
          className="size-8 inline-flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-subtle transition-colors"
          onClick={() => {
            const rect = overflowBtnRef.current?.getBoundingClientRect();
            if (rect) {
              setOverflowMenuStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
                zIndex: 99999,
              });
            }
            setOverflowMenuOpen((v) => !v);
          }}
          title="More options"
        >
          <RiMoreLine size={16} />
        </button>
        {overflowMenuOpen && typeof document !== 'undefined' && createPortal(
          <>
            <div className="fixed inset-0 z-[99998]" onClick={() => setOverflowMenuOpen(false)} />
            <div style={{ ...overflowMenuStyle, zIndex: 99999 }} className="w-44 rounded-xl border border-border bg-background shadow-lg py-1">
              <button
                onClick={() => { setOverflowMenuOpen(false); setImportHtmlOpen(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-background-subtle transition-colors text-left"
              >
                <RiUploadLine size={14} className="text-foreground-muted shrink-0" />
                Import HTML
              </button>
              <button
                onClick={() => { setOverflowMenuOpen(false); handleExportHtml(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-background-subtle transition-colors text-left"
              >
                <RiDownloadLine size={14} className="text-foreground-muted shrink-0" />
                Export HTML
              </button>
            </div>
          </>,
          document.body
        )}
      </div>

      {/* ── Subject + preview text bar ── */}
      <div className="flex items-center gap-4 px-6 h-11 border-b border-border bg-background-subtle shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted shrink-0">
            Subject
          </span>
          <input
            type="text"
            value={subjectLine}
            onChange={(e) => setSubjectLine(e.target.value)}
            placeholder="Enter email subject line…"
            className="flex-1 min-w-0 h-8 bg-transparent text-sm border-0 outline-none placeholder:text-foreground-muted"
          />
        </div>
        <div className="w-px h-5 bg-border shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted shrink-0">
            Preview
          </span>
          <input
            type="text"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Preview text shown in inbox…"
            className="flex-1 min-w-0 h-8 bg-transparent text-sm border-0 outline-none placeholder:text-foreground-muted"
          />
        </div>
      </div>

      {/* ── 3-column layout ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: 240px */}
        <div className="w-60 shrink-0 overflow-hidden flex flex-col">
          <LeftPanel
            onAddBlock={addBlock}
            onAddSection={addSection}
            onUseSavedBlock={useSavedBlock}
            onDragStart={handlePanelDragStart}
            onDragEnd={handleDragEnd}
            onSectionDragStart={handleSectionDragStart}
            onSectionDragEnd={handleDragEnd}
            isDragging={isDragging}
            savedBlocks={savedBlocks}
            savedBlocksLoading={savedBlocksLoading}
            onDeleteSavedBlock={handleDeleteSavedBlock}
          />
        </div>

        {/* Center: Canvas */}
        <div
          className="flex-1 overflow-y-auto py-8 px-4"
          style={{ backgroundColor: templateBgColor }}
          onClick={() => setSelectedBlockId(null)}
        >
          <div
            className="shadow-md mx-auto"
            style={{
              width: canvasWidth,
              minHeight: 400,
              borderRadius: 4,
              overflow: "hidden",
              backgroundColor: templateBodyBgColor,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Email inner padding */}
            <div
              style={{ padding: "32px 24px", backgroundColor: templateBodyBgColor, fontFamily: templateFontFamily }}
              onDragOver={(e) => { if (isDragging) e.preventDefault(); }}
            >
              {blocks.length === 0 ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDropTargetIndex(0); }}
                  onDragLeave={() => setDropTargetIndex(null)}
                  onDrop={(e) => { e.preventDefault(); handleDropAtIndex(0); }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 py-16 rounded-lg border-2 border-dashed cursor-default select-none transition-all duration-150",
                    dropTargetIndex === 0 && isDragging
                      ? "border-primary/60 bg-primary/5"
                      : "border-gray-200"
                  )}
                  onClick={(e) => { e.stopPropagation(); }}
                >
                  <RiMailLine size={32} className={cn("transition-colors", dropTargetIndex === 0 && isDragging ? "text-primary" : "text-gray-300")} />
                  <p className={cn("text-sm font-medium transition-colors", dropTargetIndex === 0 && isDragging ? "text-primary" : "text-gray-400")}>
                    {isDragging ? "Drop block here" : "Drop block here · or click to add"}
                  </p>
                  {!isDragging && (
                    <p className="text-xs text-gray-400">
                      Click a block in the left panel to add it
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {/* Top drop zone */}
                  <DropZone
                    index={0}
                    isActive={dropTargetIndex === 0}
                    isDragging={isDragging}
                    onDrop={handleDropAtIndex}
                    onDragOver={setDropTargetIndex}
                    onDragLeave={() => setDropTargetIndex(null)}
                  />

                  {blocks.map((block, i) => (
                    <React.Fragment key={block.id}>
                      <CanvasBlock
                        block={block}
                        blockIndex={i}
                        isSelected={selectedBlockId === block.id}
                        isFirst={i === 0}
                        isLast={i === blocks.length - 1}
                        isDraggingThis={
                          isDragging &&
                          dragInfo.current?.kind === "canvas" &&
                          dragInfo.current.blockId === block.id
                        }
                        onSelect={() => setSelectedBlockId(block.id)}
                        onMoveUp={() => moveBlock(block.id, "up")}
                        onMoveDown={() => moveBlock(block.id, "down")}
                        onDuplicate={() => duplicateBlock(block.id)}
                        onDelete={() => deleteBlock(block.id)}
                        onSave={() => { setBlockToSaveId(block.id); setSaveBlockName(block.type); setSaveBlockDialogOpen(true); }}
                        onDragStart={handleCanvasDragStart}
                        onDragEnd={handleDragEnd}
                      />

                      {/* Drop zone after each block */}
                      <DropZone
                        index={i + 1}
                        isActive={dropTargetIndex === i + 1}
                        isDragging={isDragging}
                        onDrop={handleDropAtIndex}
                        onDragOver={setDropTargetIndex}
                        onDragLeave={() => setDropTargetIndex(null)}
                      />
                    </React.Fragment>
                  ))}

                  {/* Click-to-add zone at bottom (only when not dragging) */}
                  {!isDragging && (
                    <div
                      className="flex items-center justify-center py-5 rounded-lg border-2 border-dashed border-gray-200 mt-1 cursor-pointer text-xs text-gray-400 hover:border-primary/40 hover:text-primary transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        addBlock("text");
                      }}
                    >
                      Click to add a text block
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel: 280px */}
        <div className="w-70 shrink-0 border-l border-border overflow-hidden flex flex-col" style={{ width: 280 }}>
          <PropertiesPanel
            block={selectedBlock}
            onChange={(updates) => {
              if (selectedBlockId) updateBlock(selectedBlockId, updates);
            }}
            templateBgColor={templateBgColor}
            templateFontFamily={templateFontFamily}
            onTemplateBgChange={setTemplateBgColor}
            onTemplateFontChange={setTemplateFontFamily}
            templateBodyBgColor={templateBodyBgColor}
            onTemplateBodyBgChange={setTemplateBodyBgColor}
            templateEmailWidth={templateEmailWidth}
            onTemplateEmailWidthChange={setTemplateEmailWidth}
            workspaceId={workspaceId ?? ""}
          />
        </div>
      </div>

      {/* Save Block Dialog */}
      {saveBlockDialogOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-80 p-5">
            <h3 className="text-sm font-semibold mb-3">Save block as snippet</h3>
            <input
              type="text"
              value={saveBlockName}
              onChange={(e) => setSaveBlockName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveBlock(); if (e.key === 'Escape') setSaveBlockDialogOpen(false); }}
              placeholder="e.g. Hero section, Footer"
              autoFocus
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setSaveBlockDialogOpen(false); setSaveBlockName(""); setBlockToSaveId(null); }}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleSaveBlock} disabled={!saveBlockName.trim()}>Save snippet</Button>
            </div>
          </div>
        </div>
      )}

      {/* Import HTML Modal */}
      {importHtmlOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-[600px] max-w-[calc(100vw-48px)] flex flex-col" style={{ maxHeight: '70vh' }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-semibold">Import HTML</h2>
                <p className="text-xs text-foreground-muted mt-0.5">Paste email HTML to add as a block or replace all blocks</p>
              </div>
              <button
                onClick={() => { setImportHtmlOpen(false); setImportHtmlValue(''); }}
                className="size-8 inline-flex items-center justify-center rounded-full text-foreground-muted hover:bg-background-subtle hover:text-foreground transition-colors"
              >
                <RiCloseLine size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-5">
              <textarea
                value={importHtmlValue}
                onChange={(e) => setImportHtmlValue(e.target.value)}
                placeholder="<!-- Paste your HTML here -->"
                rows={14}
                spellCheck={false}
                className="w-full h-full rounded-lg border border-border bg-background-subtle px-3 py-2.5 text-xs font-mono outline-none resize-none focus:border-primary focus:ring-1 focus:ring-primary/10"
              />
            </div>
            <div className="flex items-center justify-between gap-2 px-5 pb-5 shrink-0">
              <p className="text-[11px] text-foreground-muted">
                {importHtmlValue.length > 0 ? `${importHtmlValue.length.toLocaleString()} characters` : 'No HTML pasted yet'}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setImportHtmlOpen(false); setImportHtmlValue(''); }}>Cancel</Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleImportHtml('replace')}
                  disabled={!importHtmlValue.trim()}
                >
                  Replace all blocks
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleImportHtml('append')}
                  disabled={!importHtmlValue.trim()}
                >
                  Add as block
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History Drawer */}
      {historyOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-72 bg-background shadow-xl border-l border-border flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <p className="text-sm font-semibold">Version History</p>
            <button
              onClick={() => setHistoryOpen(false)}
              className="size-7 inline-flex items-center justify-center rounded-lg text-foreground-muted hover:bg-background-subtle hover:text-foreground transition-colors"
            >
              <RiCloseLine size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {versionHistory.length === 0 ? (
              <p className="text-sm text-foreground-muted text-center py-8">No published versions yet.</p>
            ) : (
              versionHistory.map((v) => (
                <div key={v.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">v{v.version_number}</p>
                      <p className="text-xs text-foreground-muted mt-0.5">
                        {new Date(v.created_at).toLocaleString()}
                      </p>
                      {v.created_by_name && (
                        <p className="text-xs text-foreground-muted">{v.created_by_name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        blocksHistory.push(v.blocks);
                        if (v.bg_color) setTemplateBgColor(v.bg_color);
                        if (v.font_family) setTemplateFontFamily(v.font_family);
                        if (v.body_bg_color) setTemplateBodyBgColor(v.body_bg_color);
                        if (v.email_width) setTemplateEmailWidth(v.email_width);
                        setHistoryOpen(false);
                        showToast({ title: `Restored to v${v.version_number}` });
                      }}
                      className="text-xs font-medium text-primary hover:underline shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <SendTestModal
        open={sendTestOpen}
        onOpenChange={setSendTestOpen}
        templateName={templateName}
        subjectLine={subjectLine || null}
        onSend={handleSendTest}
      />

      <PreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        template={previewTemplate}
        renderedHtml={generateEmailHtml(previewTemplate, { bgColor: templateBgColor, fontFamily: templateFontFamily, bodyBgColor: templateBodyBgColor, maxWidth: templateEmailWidth, googleFontUrl: getGoogleFontUrl(templateFontFamily) })}
        onSendTest={() => {
          setPreviewOpen(false);
          setSendTestOpen(true);
        }}
        onUseTemplate={() => setPreviewOpen(false)}
      />
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  return (
    <ToastProvider>
      <BuilderInner />
    </ToastProvider>
  );
}

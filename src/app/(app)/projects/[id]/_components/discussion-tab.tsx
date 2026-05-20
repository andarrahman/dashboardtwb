"use client";

import * as React from "react";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { createClient } from "@/lib/supabase/browser";
import type { ProjectComment } from "@/lib/supabase/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const manrope = '"Manrope", system-ui, sans-serif';

const AVATAR_COLORS = [
  "#14C4AE", "#6366F1", "#F97316", "#EC4899",
  "#8B5CF6", "#22C55E", "#3B82F6", "#F59E0B",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtDateGroup(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const logDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (logDay.getTime() === today.getTime()) return "Today";
  if (logDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** Render comment body, highlighting @mention tokens in teal */
function CommentBody({ text }: { text: string }) {
  const parts = text.split(/(@\w+)/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^@\w+$/.test(part) ? (
          <span key={i} style={{ color: "#14C4AE", fontWeight: 600 }}>{part}</span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface DiscussionTabProps {
  projectId: string;
  onCountChange?: (count: number) => void;
}

export function DiscussionTab({ projectId, onCountChange }: DiscussionTabProps) {
  const { workspaceId } = useWorkspace();
  const [comments, setComments] = React.useState<ProjectComment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Current user
  const [currentUser, setCurrentUser] = React.useState<{ id: string; name: string } | null>(null);

  // Input state
  const [draft, setDraft] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Load current user from Supabase auth + profiles
  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      (supabase as any)
        .from("profiles")
        .select("display_name, email")
        .eq("id", data.user.id)
        .single()
        .then(({ data: p }: any) => {
          const rawName = p?.display_name ?? p?.email ?? "You";
          const name = rawName.includes("@") ? rawName.split("@")[0] : rawName;
          setCurrentUser({ id: data.user!.id, name });
        });
    });
  }, []);

  // Fetch comments
  React.useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/projects/${projectId}/comments?workspace_id=${workspaceId}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
        const fetched: ProjectComment[] = d.comments ?? [];
        setComments(fetched);
        onCountChange?.(fetched.length);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, workspaceId]);

  async function handleSubmit() {
    if (!draft.trim() || !workspaceId || !currentUser || submitting) return;
    const optimistic: ProjectComment = {
      id: `optimistic-${Date.now()}`,
      project_id: projectId,
      workspace_id: workspaceId,
      author_id: currentUser.id,
      author_name: currentUser.name,
      body: draft.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    setComments(prev => {
      const next = [...prev, optimistic];
      onCountChange?.(next.length);
      return next;
    });
    setDraft("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          body: optimistic.body,
          author_name: currentUser.name,
          author_id: currentUser.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to post comment");
      // Replace optimistic with real
      setComments(prev => prev.map(c => c.id === optimistic.id ? json.comment : c));
    } catch {
      // Rollback
      setComments(prev => {
        const next = prev.filter(c => c.id !== optimistic.id);
        onCountChange?.(next.length);
        return next;
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // Group by date
  const groups: { label: string; items: ProjectComment[] }[] = [];
  for (const c of comments) {
    const label = fmtDateGroup(c.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(c);
    } else {
      groups.push({ label, items: [c] });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Comment list */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0", color: "#AABBC2", fontFamily: manrope, fontSize: 13 }}>
          Loading comments…
        </div>
      ) : error ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0" }}>
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10,
            padding: "12px 18px", maxWidth: 480, textAlign: "center",
          }}>
            <p style={{ fontFamily: manrope, fontSize: 13, fontWeight: 600, color: "#DC2626", margin: "0 0 4px 0" }}>
              Failed to load comments
            </p>
            <p style={{ fontFamily: manrope, fontSize: 12, color: "#EF4444", margin: 0 }}>{error}</p>
          </div>
        </div>
      ) : comments.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", gap: 10 }}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="22" fill="#F0F4F5" />
            <path
              d="M12 16a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H16l-5 4V16z"
              stroke="#B0BEC5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"
            />
          </svg>
          <p style={{ fontFamily: manrope, fontSize: 13, color: "#7A8A93", margin: 0 }}>
            No comments yet. Start the discussion.
          </p>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.label}>
            {/* Date label */}
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
              color: "#AABBC2", fontFamily: manrope, padding: "16px 0 8px 0",
            }}>
              {group.label}
            </div>

            {/* Comment cards */}
            <div style={{ background: "#FFFFFF", border: "1px solid #E5EAEC", borderRadius: 12, overflow: "hidden" }}>
              {group.items.map((comment, i) => (
                <div
                  key={comment.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "12px 16px",
                    borderBottom: i < group.items.length - 1 ? "1px solid #F0F4F5" : "none",
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: avatarColor(comment.author_name),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0,
                    fontFamily: manrope,
                  }}>
                    {initials(comment.author_name)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F2A37", fontFamily: manrope }}>
                      {comment.author_name}
                    </span>
                    <p style={{
                      fontSize: 13, color: "#4A5C66", fontFamily: manrope,
                      margin: "4px 0 0 0", lineHeight: "1.55", wordBreak: "break-word",
                    }}>
                      <CommentBody text={comment.body} />
                    </p>
                  </div>

                  {/* Time */}
                  <span style={{ fontSize: 11, color: "#AABBC2", fontFamily: manrope, flexShrink: 0, paddingTop: 2 }}>
                    {fmtTime(comment.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Comment input */}
      <div style={{
        marginTop: comments.length === 0 ? 0 : 20,
        background: "#FFFFFF", border: "1px solid #E5EAEC", borderRadius: 12,
        padding: "12px 14px",
        display: "flex", alignItems: "flex-end", gap: 10,
      }}>
        {/* Current user avatar */}
        {currentUser && (
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: avatarColor(currentUser.name),
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0,
            fontFamily: manrope,
          }}>
            {initials(currentUser.name)}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment… (Ctrl+Enter to send)"
          rows={1}
          style={{
            flex: 1, resize: "none", border: "none", outline: "none",
            fontFamily: manrope, fontSize: 13, color: "#0F2A37",
            background: "transparent", lineHeight: "1.55",
            paddingTop: 4, paddingBottom: 4,
            overflowY: "hidden",
          }}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
        />

        {draft.trim() && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: submitting ? "#B2EFE9" : "#14C4AE",
              border: "none", cursor: submitting ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
            title="Send (Ctrl+Enter)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12.5 1.5L6.5 7.5M12.5 1.5L8.5 12.5L6.5 7.5L1.5 5.5L12.5 1.5Z"
                stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

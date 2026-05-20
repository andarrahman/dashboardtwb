/**
 * Format a timestamp as relative time: "3h ago", "2d", "May 11", etc.
 */
export function formatRelativeTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a timestamp as a human-friendly date+time: "Tue 14:30", "May 11 · 10:30", etc.
 */
export function formatDate(ts: string | null | undefined): string {
  if (!ts) return "—";
  const date = new Date(ts);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - date.getTime()) / 86_400_000);

  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  if (diffDays === 0) return `Today · ${timeStr}`;
  if (diffDays === 1) return `Yesterday · ${timeStr}`;
  if (diffDays < 7) {
    const day = date.toLocaleDateString("en-US", { weekday: "short" });
    return `${day} · ${timeStr}`;
  }
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${monthDay} · ${timeStr}`;
}

/**
 * Format schedule datetime for display: "Wed, May 13 · 09:00"
 */
export function formatScheduled(ts: string | null | undefined): string {
  if (!ts) return "—";
  const date = new Date(ts);
  const day = date.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day}, ${monthDay} · ${time}`;
}

/**
 * Format a short date only: "May 13"
 */
export function formatShortDate(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

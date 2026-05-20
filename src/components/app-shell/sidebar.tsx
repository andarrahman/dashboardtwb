"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  RiDashboardLine,
  RiSendPlaneLine,
  RiShakeHandsLine,
  RiBarChartLine,
  RiSettings4Line,
  RiMoreFill,
  RiSearchEyeLine,
  RiMailLine,
  RiContactsBook2Line,
  RiContactsLine,
  RiListCheck2,
  RiPieChartLine,
  RiMegaphoneLine,
  RiLayoutMasonryLine,
  RiFlowChart,
  RiMailForbidLine,
  RiFolderLine,
  RiLogoutBoxRLine,
  RiArrowDownSLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";
import { useWorkspace } from "@/lib/hooks/use-workspace";

type ChildItem = { href: string; label: string; icon: React.ElementType };

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  children?: ChildItem[];
  /** Feature key that gates this item — undefined means always visible */
  feature?: string;
  /** Custom function to determine if this item (or its children) is active */
  isActive?: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: RiDashboardLine },
  {
    href: "/crm",
    label: "CRM",
    icon: RiContactsBook2Line,
    feature: "crm",
    isActive: (pathname) =>
      pathname.startsWith("/contacts") ||
      pathname.startsWith("/crm"),
    children: [
      { href: "/contacts", label: "Contacts", icon: RiContactsLine },
      { href: "/crm/lists", label: "Lists", icon: RiListCheck2 },
      { href: "/crm/segments", label: "Segments", icon: RiPieChartLine },
    ],
  },
  {
    href: "/outreach",
    label: "Outreach Creator",
    icon: RiSendPlaneLine,
    feature: "outreach",
    children: [
      { href: "/email", label: "Email · WhatsApp", icon: RiMailLine },
      { href: "/discovery-call", label: "Discovery Call", icon: RiSearchEyeLine },
    ],
  },
  {
    href: "/marketing",
    label: "Marketing",
    icon: RiMegaphoneLine,
    feature: "marketing",
    isActive: (pathname) => pathname.startsWith("/marketing"),
    children: [
      { href: "/marketing/templates", label: "Templates", icon: RiLayoutMasonryLine },
      { href: "/marketing/automations", label: "Automations", icon: RiFlowChart },
      { href: "/marketing/unsubscribes", label: "Unsubscribes", icon: RiMailForbidLine },
    ],
  },
  { href: "/projects", label: "Projects", icon: RiFolderLine, feature: "projects", isActive: (pathname) => pathname.startsWith("/projects") },
  { href: "/partnership", label: "Partnership", icon: RiShakeHandsLine, feature: "partnership" },
  { href: "/reports", label: "Reports", icon: RiBarChartLine, feature: "report" },
  { href: "/settings", label: "Settings", icon: RiSettings4Line },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, features } = useWorkspace();

  const [displayName, setDisplayName] = React.useState("…");
  const [avatarInitials, setAvatarInitials] = React.useState("…");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Track which parent nav items are expanded
  // Auto-expand the section containing the active route
  const [openSections, setOpenSections] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    navItems.forEach((item) => {
      if (item.children) {
        const hasActive = item.children.some((c) => pathname.startsWith(c.href));
        if (hasActive) initial.add(item.href);
      }
    });
    return initial;
  });

  function toggleSection(href: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  // Close menu when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split("@")[0] ??
        "User";
      setDisplayName(name);
      setAvatarInitials(initials(name));
    });
  }, []);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-background-subtle sticky top-0">
      {/* Workspace badge */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-base font-bold text-white">
            T
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Twibbonize</p>
          </div>
        </div>
      </div>

      {/* Workspace section */}
      <p className="px-5 pt-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
        Workspace
      </p>

      <nav className="flex-1 px-3">
        <ul className="flex flex-col gap-0.5">
          {navItems.filter(({ feature }) => !feature || features.includes(feature)).map(({ href, label, icon: Icon, children, isActive: customIsActive }) => {
            const active = customIsActive
              ? customIsActive(pathname)
              : href === "/"
              ? pathname === "/"
              : pathname === href || (!children && pathname.startsWith(href));
            const childActive = children?.some((c) => pathname.startsWith(c.href));
            const parentHighlighted = active || !!childActive;
            const isOpen = openSections.has(href);

            return (
              <li key={href}>
                {children ? (
                  /* Parent with children — toggle button */
                  <button
                    type="button"
                    onClick={() => toggleSection(href)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      parentHighlighted
                        ? "text-foreground"
                        : "text-foreground-subtle hover:bg-background-muted hover:text-foreground"
                    )}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                    <RiArrowDownSLine
                      size={15}
                      className={cn(
                        "shrink-0 transition-transform duration-200 text-foreground-muted",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                ) : (
                  /* Leaf item — direct link */
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      parentHighlighted
                        ? "text-foreground"
                        : "text-foreground-subtle hover:bg-background-muted hover:text-foreground"
                    )}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                )}

                {/* Sub-nav items — only shown when open */}
                {children && isOpen && (
                  <ul className="mt-0.5 mb-1 flex flex-col gap-0.5 pl-9">
                    {children.map(({ href: childHref, label: childLabel, icon: ChildIcon }) => {
                      const childIsActive = pathname.startsWith(childHref);
                      return (
                        <li key={childHref}>
                          <Link
                            href={childHref}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                              childIsActive
                                ? "bg-background text-foreground shadow-sm"
                                : "text-foreground-subtle hover:bg-background-muted hover:text-foreground"
                            )}
                          >
                            <ChildIcon size={15} />
                            {childLabel}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User card */}
      <div className="px-3 pb-3" ref={menuRef}>
        {/* Dropdown menu */}
        {menuOpen && (
          <div
            className="mb-2 rounded-xl border border-border bg-background shadow-lg overflow-hidden"
            style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
          >
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              <RiLogoutBoxRLine size={16} />
              Sign out
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 shadow-sm">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
            {avatarInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">
              {displayName}
            </p>
            <p className="text-xs text-foreground-muted capitalize">
              {role ?? "Member"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              "shrink-0 transition-colors",
              menuOpen ? "text-foreground" : "text-foreground-muted hover:text-foreground"
            )}
            aria-label="More"
          >
            <RiMoreFill size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

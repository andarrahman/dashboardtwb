/**
 * Mock contacts. Mirrors the artboard for visual fidelity. Replace with
 * the Drizzle / Supabase query layer when the backend is wired up.
 */

export type Tier =
  | "Premium Creator"
  | "Premium Supporter"
  | "Free"
  | "Brand Lead"
  | "Programs Director"
  | "Awaiting sync"
  | null;

export type ContactType = "Twibbonize" | "External";

export interface Contact {
  id: string;
  initials: string;
  initialsTone: string;
  name: string;
  email: string;
  emailMeta?: string;
  type: ContactType;
  pendingSync?: boolean;
  tier: Tier;
  tierMeta?: string;
  country: string | "—";
  campaigns: number | "—";
  latestActivity: string;
  latestActivitySub: string;
  ownerInitials: string | null;
  ownerName: string | null;
  ownerTone?: string;
}

export const contacts: Contact[] = [
  {
    id: "aulia-pratiwi",
    initials: "AP",
    initialsTone: "bg-accent-subtle text-foreground",
    name: "Aulia Pratiwi",
    email: "aulia.pratiwi@gmail.com",
    type: "Twibbonize",
    tier: "Premium Creator",
    country: "Indonesia",
    campaigns: 14,
    latestActivity: "2 min ago",
    latestActivitySub: "Email reply",
    ownerInitials: "AR",
    ownerName: "Andar R.",
    ownerTone: "bg-primary text-white",
  },
  {
    id: "karina-sari",
    initials: "KS",
    initialsTone: "bg-primary-subtle text-foreground",
    name: "Karina Sari",
    email: "karina.sari@outlook.com",
    type: "Twibbonize",
    tier: "Premium Creator",
    country: "Vietnam",
    campaigns: 8,
    latestActivity: "21 min ago",
    latestActivitySub: "Tier upgrade",
    ownerInitials: "RS",
    ownerName: "Rara S.",
    ownerTone: "bg-foreground text-white",
  },
  {
    id: "anita-wijaya",
    initials: "AW",
    initialsTone: "bg-primary-subtle text-foreground",
    name: "Anita Wijaya",
    email: "anita@mahanusa.id · PT Mahanusa",
    type: "External",
    tier: "Brand Lead",
    tierMeta: "FMCG",
    country: "Indonesia",
    campaigns: "—",
    latestActivity: "1 hr ago",
    latestActivitySub: "Discovery call",
    ownerInitials: "AR",
    ownerName: "Andar R.",
    ownerTone: "bg-primary text-white",
  },
  {
    id: "bagas-tirta",
    initials: "BT",
    initialsTone: "bg-primary-subtle text-foreground",
    name: "Bagas Tirta",
    email: "bagas.tirta@gmail.com",
    type: "Twibbonize",
    tier: "Free",
    country: "Malaysia",
    campaigns: 3,
    latestActivity: "Today, 09:14",
    latestActivitySub: "WhatsApp sent",
    ownerInitials: "RS",
    ownerName: "Rara S.",
    ownerTone: "bg-foreground text-white",
  },
  {
    id: "farah-hidayat",
    initials: "FH",
    initialsTone: "bg-primary-subtle text-foreground",
    name: "Farah Hidayat",
    email: "farah.hidayat@gmail.com",
    type: "Twibbonize",
    tier: "Premium Supporter",
    country: "Indonesia",
    campaigns: "—",
    latestActivity: "Yesterday",
    latestActivitySub: "Profile updated",
    ownerInitials: null,
    ownerName: "Unassigned",
  },
  {
    id: "sinta-putri",
    initials: "SP",
    initialsTone: "bg-primary-subtle text-foreground",
    name: "Sinta Putri",
    email: "sinta.putri@gmail.com",
    emailMeta: "added 2 hr ago",
    pendingSync: true,
    type: "Twibbonize",
    tier: "Awaiting sync",
    country: "—",
    campaigns: "—",
    latestActivity: "2 hr ago",
    latestActivitySub: "Manual add",
    ownerInitials: "AR",
    ownerName: "Andar R.",
    ownerTone: "bg-primary text-white",
  },
  {
    id: "dion-kusuma",
    initials: "DK",
    initialsTone: "bg-primary-subtle text-foreground",
    name: "Dion Kusuma",
    email: "dion@sinaredu.org · Sinar Edu",
    type: "External",
    tier: "Programs Director",
    tierMeta: "Education",
    country: "Indonesia",
    campaigns: "—",
    latestActivity: "5 days ago",
    latestActivitySub: "Email sent",
    ownerInitials: "DM",
    ownerName: "Dimas M.",
    ownerTone: "bg-foreground-muted text-white",
  },
];

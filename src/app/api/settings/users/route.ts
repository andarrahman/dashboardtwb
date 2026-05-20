import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspace_id")
  if (!workspaceId)
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 })

  console.log("[users/GET] workspaceId:", workspaceId)

  // Use admin client to bypass RLS and see all workspace members
  const admin = createAdminClient()

  // Try with user_type first; fall back if column doesn't exist yet
  // Note: workspace_members uses composite PK (workspace_id, user_id) — no id column
  let membersData: any[] | null = null
  const { data: d1, error: e1 } = await (admin as any)
    .from("workspace_members")
    .select("user_id, role, user_type, features, created_at")
    .eq("workspace_id", workspaceId)

  console.log("[users/GET] members query:", { count: d1?.length, error: e1?.message })

  if (e1) {
    // user_type/features columns may not exist yet — retry without them
    const { data: d2, error: e2 } = await (admin as any)
      .from("workspace_members")
      .select("user_id, role, features, created_at")
      .eq("workspace_id", workspaceId)
    console.log("[users/GET] fallback query:", { count: d2?.length, error: e2?.message })
    if (e2)
      return NextResponse.json({ error: e2.message }, { status: 500 })
    membersData = d2
  } else {
    membersData = d1
  }

  const memberList: any[] = membersData ?? []
  console.log("[users/GET] memberList count:", memberList.length)
  const userIds = memberList.map((m: any) => m.user_id).filter(Boolean)

  // Get profiles via admin to bypass RLS
  const { data: profiles } = await (admin as any)
    .from("profiles")
    .select("id, display_name, email")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"])

  const profileMap: Record<string, any> = Object.fromEntries(
    ((profiles as any[]) ?? []).map((p: any) => [p.id, p])
  )

  // Fallback: get emails directly from auth.users for any missing profiles
  const missingIds = userIds.filter((id: string) => !profileMap[id])
  if (missingIds.length > 0) {
    const { data: authUsers } = await admin.auth.admin.listUsers()
    for (const u of authUsers?.users ?? []) {
      if (missingIds.includes(u.id)) {
        profileMap[u.id] = {
          id: u.id,
          email: u.email ?? null,
          display_name: u.user_metadata?.display_name ?? u.email?.split("@")[0] ?? null,
        }
      }
    }
  }

  const result = memberList.map((m: any) => ({
    id: m.user_id,           // use user_id as row key (no separate id column)
    user_id: m.user_id,
    role: m.role,
    user_type: m.user_type ?? "staff",
    features: m.features ?? [],
    created_at: m.created_at,
    email: profileMap[m.user_id]?.email ?? null,
    display_name: profileMap[m.user_id]?.display_name ?? null,
  }))

  return NextResponse.json({ users: result })
}

const ALL_FEATURES = ['crm', 'outreach', 'marketing', 'projects', 'partnership', 'report']

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, email, password, user_type, features, display_name } = body

  if (!workspace_id || !email || !password) {
    return NextResponse.json(
      { error: "workspace_id, email, and password are required" },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Create user via Supabase Auth Admin API
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError)
    return NextResponse.json({ error: authError.message }, { status: 400 })

  const userId = authData.user.id

  // Upsert profile record
  await admin
    .from("profiles")
    .upsert(
      { id: userId, email, display_name: display_name || email.split("@")[0] },
      { onConflict: "id" }
    )

  const finalFeatures = (user_type ?? "staff") === "admin" ? ALL_FEATURES : (features ?? [])

  // Add to workspace_members
  const { error: memberError } = await admin
    .from("workspace_members")
    .insert({
      workspace_id,
      user_id: userId,
      role: "viewer",
      user_type: user_type ?? "staff",
      features: finalFeatures,
    })

  if (memberError)
    return NextResponse.json({ error: memberError.message }, { status: 500 })

  return NextResponse.json({ success: true, user_id: userId })
}

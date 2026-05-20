import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const ALL_FEATURES = ['crm', 'outreach', 'marketing', 'projects', 'partnership', 'report']
const DEFAULT_RESET_PASSWORD = 'password!@#'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const body = await req.json()
  const { workspace_id, action, user_type, features } = body

  const admin = createAdminClient()

  // ── Reset Password action ──
  if (action === 'reset_password') {
    if (!workspace_id)
      return NextResponse.json({ error: "workspace_id required" }, { status: 400 })

    // Verify the user belongs to this workspace
    const { data: member, error: memberError } = await (admin as any)
      .from("workspace_members")
      .select("user_id")
      .eq("user_id", userId)
      .eq("workspace_id", workspace_id)
      .single()

    if (memberError || !member)
      return NextResponse.json({ error: "User not found in workspace" }, { status: 404 })

    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      password: DEFAULT_RESET_PASSWORD,
    })

    if (authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  // ── Update role/features action ──
  if (!workspace_id)
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 })

  const finalFeatures = user_type === "admin" ? ALL_FEATURES : (features ?? [])

  const { error } = await (admin as any)
    .from("workspace_members")
    .update({ user_type, features: finalFeatures })
    .eq("user_id", userId)
    .eq("workspace_id", workspace_id)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const workspaceId = req.nextUrl.searchParams.get("workspace_id")

  if (!workspaceId)
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await (admin as any)
    .from("workspace_members")
    .delete()
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

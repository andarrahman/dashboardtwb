import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const workspaceId = req.nextUrl.searchParams.get("workspace_id");
  if (!workspaceId) return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("project_comments")
    .select("*")
    .eq("project_id", projectId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await req.json();
  const { workspace_id, body: commentBody, author_name, author_id } = body;
  if (!workspace_id || !commentBody?.trim() || !author_name)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("project_comments")
    .insert({ project_id: projectId, workspace_id, author_id: author_id ?? null, author_name, body: commentBody.trim() })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data });
}

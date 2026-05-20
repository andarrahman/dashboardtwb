import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, email } = body as { token: string; email?: string };

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Token format: CONTACT_ID-WORKSPACE_ID
    // Parse workspace_id and contact_id from the token
    // The token is "{contact_id}-{workspace_id}" where contact_id and workspace_id are UUIDs
    // UUIDs are 36 chars (8-4-4-4-12), so split on the separator between the two UUIDs
    let contactId: string | undefined
    let workspaceId: string | undefined

    // UUIDs look like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
    // Token is contact_id + '-' + workspace_id, so total length is 73 chars
    // Split at index 36 after the first UUID
    if (token.length >= 73) {
      contactId = token.substring(0, 36)
      workspaceId = token.substring(37)
    }

    const { error } = await supabase
      .from("contact_unsubscribes")
      .upsert(
        {
          token,
          email: email ?? "",
          workspace_id: workspaceId ?? "00000000-0000-0000-0000-000000000000",
          contact_id: contactId ?? null,
          unsubscribed_at: new Date().toISOString(),
        },
        { onConflict: "token" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

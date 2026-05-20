import { createClient } from '@supabase/supabase-js'

/**
 * Lightweight admin client using the service-role key.
 * Bypasses RLS and supports auth.admin.* API calls.
 * NEVER expose this to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

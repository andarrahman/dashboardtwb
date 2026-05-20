'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { WorkspaceRow } from '@/lib/supabase/types'

interface WorkspaceState {
  workspace: WorkspaceRow | null
  workspaceId: string | null
  role: string | null
  features: string[]
  loading: boolean
  error: string | null
}

/**
 * Returns the first workspace the authenticated user is a member of.
 * For a multi-workspace UI, swap this with a workspace selector.
 */
export function useWorkspace(): WorkspaceState {
  const [state, setState] = useState<WorkspaceState>({
    workspace: null,
    workspaceId: null,
    role: null,
    features: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setState({ workspace: null, workspaceId: null, role: null, features: [], loading: false, error: 'Not authenticated' })
        return
      }

      // Get the first workspace the user belongs to
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, features, workspaces!inner(id, name, slug, created_at, updated_at)')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (error || !data) {
        setState({ workspace: null, workspaceId: null, role: null, features: [], loading: false, error: error?.message ?? 'No workspace found' })
        return
      }

      // Supabase join returns nested object
      const row = data as unknown as { role: string | null; features: string[] | null; workspaces: WorkspaceRow }
      const ws = row.workspaces

      setState({ workspace: ws, workspaceId: ws.id, role: row.role ?? null, features: row.features ?? [], loading: false, error: null })
    }

    load()
  }, [])

  return state
}

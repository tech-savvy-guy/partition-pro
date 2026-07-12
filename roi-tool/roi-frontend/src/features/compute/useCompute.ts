import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { qk } from '@/shared/api/queryKeys'

type ComputeReq = { session_id: string; parameters: Record<string, unknown>; priority?: 'low'|'normal'|'high' }
type ComputeResp = { job_id: string; deduped: boolean; status: string }

export function useCompute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: ComputeReq) => {
      const res = await api.post('compute', { json: req }).json<ComputeResp>()
      return res
    },
    onSuccess: (_data, variables) => {
      // optimistic: mark relevant queries as fetching or invalidate later when SSE events arrive
      // e.g., invalidate tree root to refresh when results are ready
      const tenantId = import.meta.env.VITE_TENANT_ID || 'tenant'
      const paramHash = stableHash(variables.parameters)
      qc.invalidateQueries({ queryKey: qk.treeRoot(tenantId, variables.session_id, paramHash) })
    }
  })
}

// Very small deterministic hash for demo (use a stronger one in prod)
function stableHash(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).slice(0, 16)
}

export { stableHash }

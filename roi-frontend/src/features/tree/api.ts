import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { qk } from '@/shared/api/queryKeys'
import type { TreeNode } from '@/entities/types'

export function useTreeRoot(tenantId: string, sessionId: string, paramHash: string) {
  return useQuery({
    queryKey: qk.treeRoot(tenantId, sessionId, paramHash),
    queryFn: async () => {
      return await api.get(`tree/${sessionId}`).json<TreeNode>()
    }
  })
}

export function useTreeNode(tenantId: string, sessionId: string, paramHash: string, nodePath: string) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: qk.treeNode(tenantId, sessionId, paramHash, nodePath),
    queryFn: async () => await api.get(`tree/${sessionId}/node`, { searchParams: { path: nodePath } }).json<TreeNode>(),
    // Prefetch children so clicking a node feels instant
    // onSuccess: (data) => {
    //   const children = data.children ?? []
    //   for (const c of children) {
    //     qc.prefetchQuery({
    //       queryKey: qk.treeNode(tenantId, sessionId, paramHash, c.path),
    //       queryFn: async () => await api.get(`tree/${sessionId}/node`, { searchParams: { path: c.path } }).json<TreeNode>()
    //     })
    //   }
    // }
  })
}

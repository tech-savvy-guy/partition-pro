export type Session = {
  id: string
  tenantId: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  createdAt: string
}

export type TreeSummary = {
  path: string
  label: string
  metrics?: Record<string, number>
}

export type TreeNode = {
  node: { path: string; summary: Record<string, unknown> }
  children: Array<{ path: string; summary: Record<string, unknown> }>
}

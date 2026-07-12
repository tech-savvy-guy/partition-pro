import { useMemo } from 'react'
import type { TreeNode } from '@/entities/types'

type Props = {
  data: TreeNode | undefined
  onOpen: (path: string) => void
  loading?: boolean
}

export default function TreeView({ data, onOpen, loading }: Props) {
  if (loading) return <div className="p-4 animate-pulse">Loading tree…</div>
  if (!data) return <div className="p-4 text-gray-500">No data.</div>

  const items = useMemo(() => {
    const current = [{ ...data.node, isChild: false }]
    const kids = (data.children || []).map(c => ({ ...c, isChild: true }))
    return [...current, ...kids]
  }, [data])

  return (
    <div className="border rounded-xl divide-y bg-white">
      {items.map((n, i) => (
        <button
          key={n.path + i}
          className="w-full text-left px-4 py-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
          onClick={() => onOpen(n.path as string)}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{n.path}</span>
            {n.isChild && <span className="text-xs text-gray-500">child</span>}
          </div>
        </button>
      ))}
    </div>
  )
}

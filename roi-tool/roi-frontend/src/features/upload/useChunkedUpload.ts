import { api } from '@/shared/api/client'

export async function chunkedUpload(file: File, sessionId: string, chunkSize = 5 * 1024 * 1024, onProgress?: (p: number) => void) {
  const total = Math.ceil(file.size / chunkSize)
  let uploaded = 0

  for (let i = 0; i < total; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const blob = file.slice(start, end)
    const form = new FormData()
    form.set('part_no', String(i + 1))
    form.set('file', blob)

    await api.post(`sessions/${sessionId}/parts`, { body: form }).json()
    uploaded++
    onProgress?.(Math.round((uploaded / total) * 100))
  }

  await api.post(`sessions/${sessionId}/complete`).json()
}

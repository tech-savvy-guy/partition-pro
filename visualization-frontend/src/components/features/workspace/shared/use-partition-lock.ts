import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { AxiosRequestConfig } from "axios"

import {
  ApiError,
  PartitionApi,
  type Partition,
  type PartitionLockConflict,
  type PartitionLockResponse,
} from "@/core/api"
import { useUI } from "@/core/ui"

const LOCK_RENEW_INTERVAL_MS = 4 * 60 * 1000
const LOCK_WATCH_INTERVAL_MS = 20 * 1000
const pendingReleases = new Map<string, Promise<void>>()

export type PartitionLockLifecycle =
  | { status: "acquiring" }
  | {
      status: "owned"
      ownerId: string
      ownerDisplayName: string
      expiresAt: string
    }
  | {
      status: "blocked"
      ownerId: string
      ownerDisplayName: string
      expiresAt: string | null
    }
  | { status: "view-only"; message: string }
  | { status: "uncertain"; message: string }

function lockConflictFrom(error: ApiError): PartitionLockConflict | null {
  if (!error.data || typeof error.data !== "object") return null
  const data = error.data as Partial<PartitionLockConflict>
  if (typeof data.detail !== "string") return null

  return {
    detail: data.detail,
    locked_by: typeof data.locked_by === "string" ? data.locked_by : "",
    locked_by_display_name:
      typeof data.locked_by_display_name === "string"
        ? data.locked_by_display_name
        : typeof data.locked_by === "string"
          ? data.locked_by
          : "another user",
    lock_expires_at:
      typeof data.lock_expires_at === "string" ? data.lock_expires_at : null,
  }
}

export function usePartitionLock(caseId: string, partitionId: string) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useUI()
  const [lock, setLock] = useState<PartitionLockLifecycle>({
    status: "acquiring",
  })

  const mountedRef = useRef(true)
  const holdsLockRef = useRef(false)
  const ownerIdRef = useRef<string | null>(null)
  const requestGenerationRef = useRef(0)
  const acquireControllerRef = useRef<AbortController | null>(null)
  const releasedRef = useRef(false)
  const lockKey = `${caseId}:${partitionId}`

  const partitionQueryKey = useMemo(
    () => ["partition", caseId, partitionId] as const,
    [caseId, partitionId]
  )
  const partitionsQueryKey = useMemo(
    () => ["case-partitions", caseId] as const,
    [caseId]
  )

  const patchCaches = useCallback(
    (lockData: {
      locked_by: string | null
      locked_by_display_name: string | null
      lock_expires_at: string | null
    }) => {
      queryClient.setQueryData<Partition>(partitionQueryKey, (partition) =>
        partition ? { ...partition, ...lockData } : partition
      )
      queryClient.setQueryData<Partition[]>(partitionsQueryKey, (partitions) =>
        partitions?.map((partition) =>
          partition.id === partitionId ? { ...partition, ...lockData } : partition
        )
      )
    },
    [partitionId, partitionQueryKey, partitionsQueryKey, queryClient]
  )

  const refreshLockCaches = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: partitionQueryKey })
    void queryClient.invalidateQueries({ queryKey: partitionsQueryKey })
  }, [partitionQueryKey, partitionsQueryKey, queryClient])

  const partitionQuery = useQuery({
    queryKey: partitionQueryKey,
    queryFn: () => PartitionApi.getPartition(caseId, partitionId),
    refetchInterval:
      lock.status === "owned" ? LOCK_WATCH_INTERVAL_MS : false,
  })

  const loseOwnedLock = useCallback(() => {
    if (!holdsLockRef.current) return

    holdsLockRef.current = false
    ownerIdRef.current = null
    requestGenerationRef.current += 1
    setLock({
      status: "uncertain",
      message: "This partition lock is no longer owned by this session.",
    })
    refreshLockCaches()
    showToast("This partition was unlocked", "info", {
      description:
        "A publisher updated this case's datasets and released active partition locks. Returning to the case overview.",
    })
    void navigate({ to: "/cases/$caseId", params: { caseId } })
  }, [caseId, navigate, refreshLockCaches, showToast])

  const applyOwnedLock = useCallback(
    (response: PartitionLockResponse) => {
      holdsLockRef.current = true
      ownerIdRef.current = response.locked_by
      releasedRef.current = false
      patchCaches({
        locked_by: response.locked_by,
        locked_by_display_name:
          response.locked_by_display_name || response.locked_by,
        lock_expires_at: response.lock_expires_at,
      })
      setLock({
        status: "owned",
        ownerId: response.locked_by,
        ownerDisplayName:
          response.locked_by_display_name || response.locked_by,
        expiresAt: response.lock_expires_at,
      })
      refreshLockCaches()
    },
    [patchCaches, refreshLockCaches]
  )

  const acquire = useCallback(
    async (kind: "initial" | "retry" | "renew" | "restore") => {
      const generation = ++requestGenerationRef.current
      acquireControllerRef.current?.abort()
      const controller = new AbortController()
      acquireControllerRef.current = controller

      if (kind !== "renew") {
        holdsLockRef.current = false
        ownerIdRef.current = null
        setLock({ status: "acquiring" })
      }

      try {
        await pendingReleases.get(lockKey)
        if (
          !mountedRef.current ||
          controller.signal.aborted ||
          generation !== requestGenerationRef.current
        ) {
          return
        }
        const response = await PartitionApi.acquireLock(caseId, partitionId, {
          signal: controller.signal,
        })
        if (
          !mountedRef.current ||
          controller.signal.aborted ||
          generation !== requestGenerationRef.current
        ) {
          return
        }
        applyOwnedLock(response)
      } catch (error) {
        if (
          !mountedRef.current ||
          controller.signal.aborted ||
          generation !== requestGenerationRef.current
        ) {
          return
        }

        if (error instanceof ApiError && error.status === 409) {
          const conflict = lockConflictFrom(error)
          if (kind === "renew") {
            loseOwnedLock()
            return
          }
          holdsLockRef.current = false
          ownerIdRef.current = null
          patchCaches({
            locked_by: conflict?.locked_by || null,
            locked_by_display_name:
              conflict?.locked_by_display_name || "another user",
            lock_expires_at: conflict?.lock_expires_at ?? null,
          })
          setLock({
            status: "blocked",
            ownerId: conflict?.locked_by || "",
            ownerDisplayName:
              conflict?.locked_by_display_name || "another user",
            expiresAt: conflict?.lock_expires_at ?? null,
          })
          refreshLockCaches()
          return
        }

        if (error instanceof ApiError && error.status === 403) {
          if (kind === "renew") {
            loseOwnedLock()
            return
          }
          holdsLockRef.current = false
          ownerIdRef.current = null
          setLock({ status: "view-only", message: error.message })
          refreshLockCaches()
          return
        }

        holdsLockRef.current = false
        ownerIdRef.current = null
        setLock({
          status: "uncertain",
          message:
            error instanceof Error
              ? error.message
              : "The partition lock could not be confirmed.",
        })
        refreshLockCaches()
      }
    }, [
      applyOwnedLock,
      caseId,
      loseOwnedLock,
      lockKey,
      partitionId,
      patchCaches,
      refreshLockCaches,
    ]
  )

  const retry = useCallback(() => {
    void acquire("retry")
  }, [acquire])

  const releaseOnce = useCallback(
    (keepalive: boolean) => {
      if (!holdsLockRef.current || releasedRef.current) return

      releasedRef.current = true
      holdsLockRef.current = false
      ownerIdRef.current = null
      requestGenerationRef.current += 1
      acquireControllerRef.current?.abort()
      patchCaches({
        locked_by: null,
        locked_by_display_name: null,
        lock_expires_at: null,
      })

      const config = keepalive
        ? ({
            adapter: "fetch",
            fetchOptions: { keepalive: true },
          } satisfies AxiosRequestConfig)
        : undefined

      const releasePromise = PartitionApi.releaseLock(caseId, partitionId, config)
        .catch(() => {})
        .then(() => undefined)
        .finally(refreshLockCaches)
      pendingReleases.set(lockKey, releasePromise)
      void releasePromise.finally(() => {
        if (pendingReleases.get(lockKey) === releasePromise) {
          pendingReleases.delete(lockKey)
        }
      })
    }, [caseId, lockKey, partitionId, patchCaches, refreshLockCaches]
  )

  useEffect(() => {
    mountedRef.current = true
    void acquire("initial")

    return () => {
      mountedRef.current = false
      acquireControllerRef.current?.abort()
      releaseOnce(false)
    }
  }, [acquire, releaseOnce])

  useEffect(() => {
    if (lock.status !== "owned") return
    const interval = window.setInterval(() => {
      void acquire("renew")
    }, LOCK_RENEW_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [acquire, lock.status])

  useEffect(() => {
    if (lock.status !== "owned" || !ownerIdRef.current) return
    const partition = partitionQuery.data
    if (!partition) return

    const expiry = partition.lock_expires_at
      ? new Date(partition.lock_expires_at).getTime()
      : Number.NaN
    if (
      partition.locked_by !== ownerIdRef.current ||
      !Number.isFinite(expiry) ||
      expiry <= Date.now()
    ) {
      loseOwnedLock()
    }
  }, [lock.status, loseOwnedLock, partitionQuery.data])

  useEffect(() => {
    const handlePageHide = () => releaseOnce(true)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      releasedRef.current = false
      void acquire("restore")
    }

    window.addEventListener("pagehide", handlePageHide)
    window.addEventListener("pageshow", handlePageShow)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
      window.removeEventListener("pageshow", handlePageShow)
    }
  }, [acquire, releaseOnce])

  return { lock, retry, partitionQuery }
}

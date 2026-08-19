'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { toast } from 'sonner'

export interface RealtimeNotification {
  type: string
  title: string
  severity?: string
  timestamp: string
  data?: Record<string, unknown>
}

function getIcon(type: string): string {
  switch (type) {
    case 'finding_detected':
      return '🔍'
    case 'evidence_committed':
      return '📝'
    case 'compliance_score_updated':
      return '📊'
    case 'analysis_completed':
      return '✅'
    default:
      return '🔔'
  }
}

/**
 * Connects to the ws-notifications mini-service via socket.io.
 * Uses the XTransformPort gateway pattern so Caddy proxies correctly.
 *
 * On connect, emits 'subscribe' to start receiving simulated events.
 * Each incoming 'notification' event is surfaced via the `onNotification` callback
 * and also shown as a sonner toast (unless suppressed).
 */
export function useRealtimeNotifications(options?: {
  /** Custom handler called for every incoming notification (after toast) */
  onNotification?: (event: RealtimeNotification) => void
  /** Set to true to skip the automatic sonner toast */
  suppressToast?: boolean
}) {
  const socketRef = useRef<Socket | null>(null)
  const optionsRef = useRef(options)

  // We need to sync the latest options into the effect without re-running it.
  // React 19 disallows setting ref.current during render, so we use a
  // sync-style effect that runs before the socket effect.
  useEffect(() => {
    optionsRef.current = options
  })

  const stableGetIcon = useCallback((type: string) => getIcon(type), [])

  useEffect(() => {
    // Never use PORT in the URL, always use XTransformPort
    // DO NOT change the path, it is used by Caddy to forward the request to the correct port
    const socket = io('/?XTransformPort=3005', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 10000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[useRealtimeNotifications] Connected to notification service')
      // Subscribe to start receiving events
      socket.emit('subscribe')
    })

    socket.on('disconnect', (reason) => {
      console.log('[useRealtimeNotifications] Disconnected:', reason)
    })

    socket.on('notification', (event: RealtimeNotification) => {
      // Fire custom handler from latest options
      optionsRef.current?.onNotification?.(event)

      // Show sonner toast unless suppressed
      if (!optionsRef.current?.suppressToast) {
        const icon = stableGetIcon(event.type)
        const description = event.severity
          ? `Severity: ${event.severity}`
          : undefined

        toast(`${icon} ${event.title}`, {
          description,
          duration: 5000,
        })
      }
    })

    socket.on('connect_error', () => {
      // Silent reconnect – transport errors are expected when WS proxy is unavailable
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [stableGetIcon])

  return {
    /** The raw socket instance (null until connected) */
    socket: socketRef,
  }
}

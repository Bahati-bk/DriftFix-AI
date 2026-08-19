import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// --- Event simulation data ---

interface NotificationEvent {
  type: string
  title: string
  severity?: string
  timestamp: string
  data?: Record<string, unknown>
}

const findingTitles = [
  'Hardcoded API key detected in auth/service.ts',
  'SQL injection risk in users/query.ts',
  'Missing input validation on /api/upload',
  'Insecure direct object reference in /api/users/:id',
  'Outdated dependency: lodash@4.17.15 has CVE-2024-XXXX',
  'CORS wildcard origin in production config',
  'Debug logging enabled in payment handler',
  'Weak cryptographic hash used for passwords',
  'Exposed .env file in public directory',
  'Missing rate limiting on authentication endpoint',
]

const evidenceTitles = [
  'Evidence committed: policy CC6.1 access control check',
  'Evidence committed: Art.32 data encryption verification',
  'Evidence committed: P1.2 physical access control review',
  'Evidence committed: A1.2 audit trail integrity check',
  'Evidence committed: CC7.1 system monitoring verification',
  'Evidence committed: CC6.6 logical access security review',
]

const severities: Array<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

const filePaths = [
  'src/auth/service.ts',
  'src/api/users.ts',
  'src/payment/handler.ts',
  'src/config/cors.ts',
  'src/utils/crypto.ts',
  'src/db/connection.ts',
  'src/middleware/rate-limiter.ts',
  'src/routes/upload.ts',
  'src/lib/validation.ts',
  'src/services/notification.ts',
]

const complianceFrameworks = ['SOC 2', 'GDPR', 'HIPAA', 'PCI-DSS', 'ISO 27001']

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomScore(): number {
  return Math.floor(Math.random() * 30) + 65 // 65-94
}

function generateNotification(): NotificationEvent {
  const eventTypes: Array<() => NotificationEvent> = [
    // New finding detected
    () => {
      const severity = randomItem(severities)
      return {
        type: 'finding_detected',
        title: randomItem(findingTitles),
        severity,
        timestamp: new Date().toISOString(),
        data: {
          findingId: `fnd-${Math.random().toString(36).substring(2, 10)}`,
          filePath: randomItem(filePaths),
          confidence: +(Math.random() * 0.4 + 0.6).toFixed(2),
          ruleId: `RULE-${Math.floor(Math.random() * 200) + 100}`,
          repository: 'acme-corp/backend-service',
        },
      }
    },
    // Evidence committed
    () => {
      const title = randomItem(evidenceTitles)
      return {
        type: 'evidence_committed',
        title,
        timestamp: new Date().toISOString(),
        data: {
          evidenceId: `evi-${Math.random().toString(36).substring(2, 10)}`,
          hash: `sha256:${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}...`,
          framework: title.includes('CC') ? 'SOC 2' : title.includes('Art') ? 'GDPR' : 'SOC 2',
          eventType: 'POLICY_CHECK',
        },
      }
    },
    // Compliance score updated
    () => {
      const framework = randomItem(complianceFrameworks)
      const score = randomScore()
      return {
        type: 'compliance_score_updated',
        title: `${framework} compliance score updated`,
        timestamp: new Date().toISOString(),
        severity: score < 75 ? 'MEDIUM' : 'LOW',
        data: {
          framework,
          score,
          previousScore: Math.min(100, score + Math.floor(Math.random() * 10) - 5),
          change: Math.floor(Math.random() * 6) - 2, // -2 to +3
        },
      }
    },
    // Analysis completed
    () => {
      const repo = randomItem(['acme-corp/frontend', 'acme-corp/backend-service', 'acme-corp/infra', 'acme-corp/api-gateway'])
      const findingCount = Math.floor(Math.random() * 8)
      const severity = findingCount > 5 ? 'HIGH' : findingCount > 2 ? 'MEDIUM' : 'LOW'
      return {
        type: 'analysis_completed',
        title: `Analysis complete for ${repo}`,
        severity,
        timestamp: new Date().toISOString(),
        data: {
          repository: repo,
          analysisId: `anl-${Math.random().toString(36).substring(2, 10)}`,
          findingsCount: findingCount,
          filesScanned: Math.floor(Math.random() * 200) + 50,
          duration: `${Math.floor(Math.random() * 30) + 5}s`,
        },
      }
    },
  ]

  return randomItem(eventTypes)()
}

// --- Connection & subscription handling ---

const subscriberIntervals = new Map<string, ReturnType<typeof setInterval>>()

function scheduleNextEvent(socketId: string) {
  const minDelay = 15_000
  const maxDelay = 30_000
  const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay

  const timer = setTimeout(() => {
    const event = generateNotification()
    console.log(`[notify] Emitting to ${socketId}: ${event.type} — ${event.title}`)
    io.emit('notification', event)
    // Schedule the next event
    scheduleNextEvent(socketId)
  }, delay)

  // Store so we can clear on disconnect
  subscriberIntervals.set(socketId, timer as unknown as ReturnType<typeof setInterval>)
}

function clearSubscriberTimer(socketId: string) {
  const timer = subscriberIntervals.get(socketId)
  if (timer) {
    clearTimeout(timer)
    subscriberIntervals.delete(socketId)
  }
}

io.on('connection', (socket) => {
  console.log(`[ws-notifications] Client connected: ${socket.id}`)

  socket.on('subscribe', () => {
    console.log(`[ws-notifications] Client ${socket.id} subscribed to notifications`)
    scheduleNextEvent(socket.id)
  })

  socket.on('disconnect', () => {
    console.log(`[ws-notifications] Client disconnected: ${socket.id}`)
    clearSubscriberTimer(socket.id)
  })

  socket.on('error', (error) => {
    console.error(`[ws-notifications] Socket error (${socket.id}):`, error)
    clearSubscriberTimer(socket.id)
  })
})

const PORT = 3005
httpServer.listen(PORT, () => {
  console.log(`[ws-notifications] Socket.IO notification server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[ws-notifications] Received SIGTERM, shutting down...')
  for (const id of subscriberIntervals.keys()) clearSubscriberTimer(id)
  httpServer.close(() => {
    console.log('[ws-notifications] Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[ws-notifications] Received SIGINT, shutting down...')
  for (const id of subscriberIntervals.keys()) clearSubscriberTimer(id)
  httpServer.close(() => {
    console.log('[ws-notifications] Server closed')
    process.exit(0)
  })
})

/**
 * SSE (Server-Sent Events) Streaming for MCP
 *
 * Provides utilities for creating SSE streams and managing client connections.
 */

/**
 * SSE event structure
 */
export interface SSEEvent {
  /** Event ID (optional) */
  id?: string
  /** Event type (optional, defaults to 'message') */
  event?: string
  /** Event data (required) */
  data: string
  /** Retry time in milliseconds (optional) */
  retry?: number
}

/**
 * SSE client controller
 */
export interface SSEClient {
  /** Session ID for this client */
  sessionId: string
  /** Timestamp when client connected */
  createdAt: number
  /** Send an event to the client */
  send(event: SSEEvent): void
  /** Close the connection */
  close(): void
  /** Check if client is still connected */
  isConnected(): boolean
}

/**
 * Options for creating an SSE stream
 */
export interface SSEStreamOptions {
  /** Session ID for this connection */
  sessionId?: string
  /** Initial event to send on connection */
  initialEvent?: SSEEvent
  /** Callback when connection closes */
  onClose?: () => void
}

/**
 * Result from createSSEStream
 */
export interface SSEStreamResult {
  /** The ReadableStream to use as response body */
  stream: ReadableStream<Uint8Array>
  /** Client controller for sending events */
  client: SSEClient
}

/**
 * Format an SSE event as a string
 *
 * @param event - The event to format
 * @returns Formatted SSE event string
 */
export function formatSSEEvent(event: SSEEvent): string {
  const lines: string[] = []

  // Add retry if present
  if (event.retry !== undefined) {
    lines.push(`retry: ${event.retry}`)
  }

  // Add id if present
  if (event.id !== undefined) {
    lines.push(`id: ${event.id}`)
  }

  // Add event type if present
  if (event.event !== undefined) {
    lines.push(`event: ${event.event}`)
  }

  // Handle multiline data - each line needs its own 'data:' prefix
  const dataLines = event.data.split('\n')
  for (const line of dataLines) {
    lines.push(`data: ${line}`)
  }

  // SSE events end with double newline
  return lines.join('\n') + '\n\n'
}

/**
 * Create an SSE stream with client controller
 *
 * @param options - Stream options
 * @returns Stream and client controller
 */
export function createSSEStream(options: SSEStreamOptions = {}): SSEStreamResult {
  const sessionId = options.sessionId || crypto.randomUUID()
  const createdAt = Date.now()
  let connected = true
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null

  const encoder = new TextEncoder()

  // Queue for events that arrive before controller is ready
  const pendingEvents: Uint8Array[] = []

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl

      // Send initial event
      const initialEvent = options.initialEvent || {
        event: 'connected',
        data: JSON.stringify({ sessionId }),
      }
      controller.enqueue(encoder.encode(formatSSEEvent(initialEvent)))

      // Send any pending events
      for (const event of pendingEvents) {
        controller.enqueue(event)
      }
      pendingEvents.length = 0
    },

    cancel() {
      connected = false
      if (options.onClose) {
        options.onClose()
      }
    },
  })

  const client: SSEClient = {
    sessionId,
    createdAt,

    send(event: SSEEvent): void {
      if (!connected) {
        return
      }

      const encoded = encoder.encode(formatSSEEvent(event))

      if (controller) {
        controller.enqueue(encoded)
      } else {
        // Queue the event until controller is ready
        pendingEvents.push(encoded)
      }
    },

    close(): void {
      if (!connected) {
        return
      }

      connected = false

      if (controller) {
        controller.close()
      }

      if (options.onClose) {
        options.onClose()
      }
    },

    isConnected(): boolean {
      return connected
    },
  }

  return { stream, client }
}

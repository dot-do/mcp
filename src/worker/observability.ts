/**
 * Observability for MCP Worker
 *
 * Provides logging, metrics, and tracing for the MCP server.
 */

/**
 * Log levels
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const

export type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel]

/**
 * Logger options
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  level?: LogLevelType
  /** Prefix for log messages */
  prefix?: string
  /** Whether to include timestamps */
  timestamps?: boolean
}

/**
 * Log context for structured logging
 */
export type LogContext = Record<string, unknown>

const LOG_LEVEL_PRIORITY: Record<LogLevelType, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private readonly level: LogLevelType
  private readonly prefix: string
  private readonly timestamps: boolean

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info'
    this.prefix = options.prefix || ''
    this.timestamps = options.timestamps !== false
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevelType): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level]
  }

  /**
   * Format a log message
   */
  private formatMessage(level: LogLevelType, message: string): string {
    const parts: string[] = []

    if (this.timestamps) {
      parts.push(new Date().toISOString())
    }

    parts.push(`[${level.toUpperCase()}]`)

    if (this.prefix) {
      parts.push(`[${this.prefix}]`)
    }

    parts.push(message)

    return parts.join(' ')
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), context || {})
    }
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), context || {})
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), context || {})
    }
  }

  /**
   * Log an error message
   */
  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), context || {})
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(prefix: string): Logger {
    const newPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix
    return new Logger({
      level: this.level,
      prefix: newPrefix,
      timestamps: this.timestamps,
    })
  }
}

/**
 * Create a logger instance
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options)
}

/**
 * Timing statistics
 */
export interface TimingStats {
  count: number
  min: number
  max: number
  avg: number
  sum: number
}

/**
 * Exported metrics data
 */
export interface ExportedMetrics {
  counters: Record<string, number>
  timings: Record<string, TimingStats>
  gauges: Record<string, number>
}

/**
 * Metrics class for tracking counters, timings, and gauges
 */
export class Metrics {
  private counters: Map<string, number>
  private timings: Map<string, number[]>
  private gauges: Map<string, number>

  constructor() {
    this.counters = new Map()
    this.timings = new Map()
    this.gauges = new Map()
  }

  /**
   * Increment a counter
   */
  increment(name: string, value = 1): void {
    const current = this.counters.get(name) || 0
    this.counters.set(name, current + value)
  }

  /**
   * Get a counter value
   */
  getCounter(name: string): number {
    return this.counters.get(name) || 0
  }

  /**
   * Record a timing value
   */
  timing(name: string, durationMs: number): void {
    const timings = this.timings.get(name) || []
    timings.push(durationMs)
    this.timings.set(name, timings)
  }

  /**
   * Get timing statistics
   */
  getTiming(name: string): TimingStats {
    const values = this.timings.get(name) || []
    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, sum: 0 }
    }

    const sum = values.reduce((a, b) => a + b, 0)
    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      sum,
    }
  }

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number): void {
    this.gauges.set(name, value)
  }

  /**
   * Get a gauge value
   */
  getGauge(name: string): number {
    return this.gauges.get(name) || 0
  }

  /**
   * Export all metrics
   */
  export(): ExportedMetrics {
    const counters: Record<string, number> = {}
    const timings: Record<string, TimingStats> = {}
    const gauges: Record<string, number> = {}

    for (const [name, value] of this.counters.entries()) {
      counters[name] = value
    }

    for (const [name] of this.timings.entries()) {
      timings[name] = this.getTiming(name)
    }

    for (const [name, value] of this.gauges.entries()) {
      gauges[name] = value
    }

    return { counters, timings, gauges }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear()
    this.timings.clear()
    this.gauges.clear()
  }
}

/**
 * Create a metrics instance
 */
export function createMetrics(): Metrics {
  return new Metrics()
}

/**
 * Span data structure
 */
export interface Span {
  id: string
  name: string
  startTime: number
  endTime?: number
  duration?: number
  parentId?: string
  attributes?: Record<string, unknown>
}

/**
 * Request tracer for distributed tracing
 */
export class RequestTracer {
  private spans: Map<string, Span>
  private completedSpans: Span[]

  constructor() {
    this.spans = new Map()
    this.completedSpans = []
  }

  /**
   * Generate a unique span ID
   */
  private generateId(): string {
    return crypto.randomUUID()
  }

  /**
   * Start a new span
   */
  startSpan(
    name: string,
    attributes?: Record<string, unknown>,
    parentId?: string
  ): string {
    const id = this.generateId()
    const span: Span = {
      id,
      name,
      startTime: performance.now(),
      parentId,
      attributes,
    }
    this.spans.set(id, span)
    return id
  }

  /**
   * End a span and record its duration
   */
  endSpan(spanId: string): Span {
    const span = this.spans.get(spanId)
    if (!span) {
      throw new Error(`Span not found: ${spanId}`)
    }

    span.endTime = performance.now()
    span.duration = span.endTime - span.startTime

    this.spans.delete(spanId)
    this.completedSpans.push(span)

    return span
  }

  /**
   * Get a span by ID
   */
  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId)
  }

  /**
   * Add attributes to an existing span
   */
  addAttributes(spanId: string, attributes: Record<string, unknown>): void {
    const span = this.spans.get(spanId)
    if (span) {
      span.attributes = { ...span.attributes, ...attributes }
    }
  }

  /**
   * Export all completed spans
   */
  export(): Span[] {
    return [...this.completedSpans]
  }

  /**
   * Clear all completed spans
   */
  clear(): void {
    this.completedSpans = []
  }
}

/**
 * Create a request tracer instance
 */
export function createRequestTracer(): RequestTracer {
  return new RequestTracer()
}

/**
 * Global observability instances (shared across requests in worker)
 */
let globalLogger: Logger | null = null
let globalMetrics: Metrics | null = null

/**
 * Get the global logger instance
 */
export function getLogger(options?: LoggerOptions): Logger {
  if (!globalLogger || options) {
    globalLogger = createLogger(options)
  }
  return globalLogger
}

/**
 * Get the global metrics instance
 */
export function getMetrics(): Metrics {
  if (!globalMetrics) {
    globalMetrics = createMetrics()
  }
  return globalMetrics
}

/**
 * Observability middleware for Hono
 */
export function observabilityMiddleware() {
  const logger = getLogger()
  const metrics = getMetrics()

  return async (
    c: { req: { method: string; url: string }; res?: { status?: number } },
    next: () => Promise<void>
  ) => {
    const tracer = createRequestTracer()
    const spanId = tracer.startSpan('request', {
      method: c.req.method,
      url: c.req.url,
    })

    const startTime = Date.now()
    metrics.increment('requests.total')

    try {
      await next()

      const duration = Date.now() - startTime
      metrics.timing('request.duration', duration)

      tracer.endSpan(spanId)

      logger.info('Request completed', {
        method: c.req.method,
        url: c.req.url,
        duration,
        status: c.res?.status,
      })
    } catch (error) {
      metrics.increment('requests.errors')
      tracer.addAttributes(spanId, { error: true })
      tracer.endSpan(spanId)

      logger.error('Request failed', {
        method: c.req.method,
        url: c.req.url,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }
}

/**
 * Observability Tests
 *
 * Tests for logging, metrics, and tracing in the MCP worker.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  Logger,
  createLogger,
  LogLevel,
  Metrics,
  createMetrics,
  RequestTracer,
  createRequestTracer,
} from '../../src/worker/observability.js'

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createLogger', () => {
    it('should create a logger instance', () => {
      const logger = createLogger()
      expect(logger).toBeDefined()
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.error).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.debug).toBe('function')
    })

    it('should accept custom options', () => {
      const logger = createLogger({
        level: 'debug',
        prefix: 'mcp',
      })
      expect(logger).toBeDefined()
    })
  })

  describe('Logger class', () => {
    it('should log info messages', () => {
      const logger = new Logger({ level: 'info' })
      logger.info('Test message')
      expect(console.info).toHaveBeenCalled()
    })

    it('should log error messages', () => {
      const logger = new Logger({ level: 'info' })
      logger.error('Error message')
      expect(console.error).toHaveBeenCalled()
    })

    it('should log warn messages', () => {
      const logger = new Logger({ level: 'info' })
      logger.warn('Warning message')
      expect(console.warn).toHaveBeenCalled()
    })

    it('should include context in log messages', () => {
      const logger = new Logger({ level: 'info' })
      logger.info('Test message', { requestId: '123' })
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Test message'),
        expect.objectContaining({ requestId: '123' })
      )
    })

    it('should respect log level', () => {
      const logger = new Logger({ level: 'warn' })
      logger.debug('Debug message')
      logger.info('Info message')
      expect(console.debug).not.toHaveBeenCalled()
      expect(console.info).not.toHaveBeenCalled()
    })

    it('should include timestamp in log output', () => {
      const logger = new Logger({ level: 'info' })
      logger.info('Test message')
      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}/),
        expect.anything()
      )
    })
  })

  describe('LogLevel', () => {
    it('should export log levels', () => {
      expect(LogLevel.DEBUG).toBe('debug')
      expect(LogLevel.INFO).toBe('info')
      expect(LogLevel.WARN).toBe('warn')
      expect(LogLevel.ERROR).toBe('error')
    })
  })
})

describe('Metrics', () => {
  describe('createMetrics', () => {
    it('should create a metrics instance', () => {
      const metrics = createMetrics()
      expect(metrics).toBeDefined()
      expect(typeof metrics.increment).toBe('function')
      expect(typeof metrics.timing).toBe('function')
      expect(typeof metrics.gauge).toBe('function')
    })
  })

  describe('Metrics class', () => {
    it('should track counter metrics', () => {
      const metrics = new Metrics()
      metrics.increment('requests.total')
      metrics.increment('requests.total')
      expect(metrics.getCounter('requests.total')).toBe(2)
    })

    it('should track timing metrics', () => {
      const metrics = new Metrics()
      metrics.timing('request.duration', 100)
      metrics.timing('request.duration', 200)
      const stats = metrics.getTiming('request.duration')
      expect(stats.count).toBe(2)
      expect(stats.avg).toBe(150)
    })

    it('should track gauge metrics', () => {
      const metrics = new Metrics()
      metrics.gauge('connections.active', 5)
      expect(metrics.getGauge('connections.active')).toBe(5)
      metrics.gauge('connections.active', 3)
      expect(metrics.getGauge('connections.active')).toBe(3)
    })

    it('should export all metrics', () => {
      const metrics = new Metrics()
      metrics.increment('requests')
      metrics.timing('latency', 50)
      metrics.gauge('memory', 1024)

      const exported = metrics.export()
      expect(exported.counters).toHaveProperty('requests')
      expect(exported.timings).toHaveProperty('latency')
      expect(exported.gauges).toHaveProperty('memory')
    })

    it('should reset metrics', () => {
      const metrics = new Metrics()
      metrics.increment('requests')
      metrics.reset()
      expect(metrics.getCounter('requests')).toBe(0)
    })
  })
})

describe('RequestTracer', () => {
  describe('createRequestTracer', () => {
    it('should create a request tracer', () => {
      const tracer = createRequestTracer()
      expect(tracer).toBeDefined()
      expect(typeof tracer.startSpan).toBe('function')
      expect(typeof tracer.endSpan).toBe('function')
    })
  })

  describe('RequestTracer class', () => {
    it('should generate unique request IDs', () => {
      const tracer = new RequestTracer()
      const id1 = tracer.startSpan('request')
      const id2 = tracer.startSpan('request')
      expect(id1).not.toBe(id2)
    })

    it('should track span duration', async () => {
      const tracer = new RequestTracer()
      const spanId = tracer.startSpan('test-operation')
      await new Promise((resolve) => setTimeout(resolve, 10))
      const span = tracer.endSpan(spanId)
      expect(span.duration).toBeGreaterThanOrEqual(10)
    })

    it('should include span name', () => {
      const tracer = new RequestTracer()
      const spanId = tracer.startSpan('my-operation')
      const span = tracer.endSpan(spanId)
      expect(span.name).toBe('my-operation')
    })

    it('should support span attributes', () => {
      const tracer = new RequestTracer()
      const spanId = tracer.startSpan('request', {
        method: 'POST',
        path: '/mcp',
      })
      const span = tracer.endSpan(spanId)
      expect(span.attributes?.method).toBe('POST')
      expect(span.attributes?.path).toBe('/mcp')
    })

    it('should support nested spans', () => {
      const tracer = new RequestTracer()
      const parentId = tracer.startSpan('parent')
      const childId = tracer.startSpan('child', {}, parentId)
      const childSpan = tracer.endSpan(childId)
      expect(childSpan.parentId).toBe(parentId)
    })

    it('should export trace data', () => {
      const tracer = new RequestTracer()
      const spanId = tracer.startSpan('test')
      tracer.endSpan(spanId)
      const traceData = tracer.export()
      expect(Array.isArray(traceData)).toBe(true)
      expect(traceData.length).toBeGreaterThan(0)
    })
  })
})

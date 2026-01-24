import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSSEStream,
  formatSSEEvent,
  type SSEClient,
  type SSEStreamOptions,
} from '../../src/transports/sse.js'

describe('SSE streaming', () => {
  describe('formatSSEEvent', () => {
    it('should format an event with data only', () => {
      const result = formatSSEEvent({ data: 'hello' })
      expect(result).toBe('data: hello\n\n')
    })

    it('should format an event with id and data', () => {
      const result = formatSSEEvent({ id: '1', data: 'hello' })
      expect(result).toBe('id: 1\ndata: hello\n\n')
    })

    it('should format an event with event type and data', () => {
      const result = formatSSEEvent({ event: 'message', data: 'hello' })
      expect(result).toBe('event: message\ndata: hello\n\n')
    })

    it('should format a complete event with all fields', () => {
      const result = formatSSEEvent({
        id: '123',
        event: 'tool-result',
        data: JSON.stringify({ result: 'success' }),
      })
      expect(result).toBe('id: 123\nevent: tool-result\ndata: {"result":"success"}\n\n')
    })

    it('should handle multiline data', () => {
      const result = formatSSEEvent({ data: 'line1\nline2\nline3' })
      expect(result).toBe('data: line1\ndata: line2\ndata: line3\n\n')
    })

    it('should include retry field when provided', () => {
      const result = formatSSEEvent({ data: 'hello', retry: 5000 })
      expect(result).toBe('retry: 5000\ndata: hello\n\n')
    })
  })

  describe('createSSEStream', () => {
    it('should return a ReadableStream', () => {
      const stream = createSSEStream()
      expect(stream.stream).toBeInstanceOf(ReadableStream)
    })

    it('should return client controller methods', () => {
      const { client } = createSSEStream()
      expect(typeof client.send).toBe('function')
      expect(typeof client.close).toBe('function')
    })

    it('should send initial connection event', async () => {
      const { stream } = createSSEStream({ sessionId: 'test-123' })

      const reader = stream.getReader()
      const { value, done } = await reader.read()

      expect(done).toBe(false)
      const text = new TextDecoder().decode(value)
      expect(text).toContain('event: connected')
      expect(text).toContain('test-123')
    })

    it('should allow custom initial event', async () => {
      const { stream } = createSSEStream({
        initialEvent: {
          event: 'ready',
          data: JSON.stringify({ status: 'ok' }),
        },
      })

      const reader = stream.getReader()
      const { value, done } = await reader.read()

      expect(done).toBe(false)
      const text = new TextDecoder().decode(value)
      expect(text).toContain('event: ready')
      expect(text).toContain('status')
    })
  })

  describe('SSEClient', () => {
    it('should send events to the stream', async () => {
      const { stream, client } = createSSEStream()

      // Send a custom event
      client.send({
        id: '1',
        event: 'tool-result',
        data: JSON.stringify({ tool: 'search', result: [] }),
      })

      const reader = stream.getReader()

      // Read initial connection event
      await reader.read()

      // Read the custom event
      const { value, done } = await reader.read()
      expect(done).toBe(false)
      const text = new TextDecoder().decode(value)
      expect(text).toContain('event: tool-result')
      expect(text).toContain('tool')
    })

    it('should close the stream', async () => {
      const { stream, client } = createSSEStream()

      client.close()

      const reader = stream.getReader()

      // Read initial event
      await reader.read()

      // Stream should be closed
      const { done } = await reader.read()
      expect(done).toBe(true)
    })

    it('should allow multiple events', async () => {
      const { stream, client } = createSSEStream()

      client.send({ event: 'event1', data: 'data1' })
      client.send({ event: 'event2', data: 'data2' })
      client.send({ event: 'event3', data: 'data3' })

      const reader = stream.getReader()

      // Read all events
      const events: string[] = []
      for (let i = 0; i < 4; i++) {
        // 1 initial + 3 custom
        const { value, done } = await reader.read()
        if (done) break
        events.push(new TextDecoder().decode(value))
      }

      expect(events.length).toBe(4)
      expect(events.join('')).toContain('event1')
      expect(events.join('')).toContain('event2')
      expect(events.join('')).toContain('event3')
    })
  })

  describe('client tracking', () => {
    it('should track connected clients', () => {
      const { client } = createSSEStream({ sessionId: 'session-1' })
      expect(client.sessionId).toBe('session-1')
    })

    it('should track connection status', () => {
      const { client } = createSSEStream()
      expect(client.isConnected()).toBe(true)

      client.close()
      expect(client.isConnected()).toBe(false)
    })

    it('should call onClose callback when stream closes', async () => {
      const onClose = vi.fn()
      const { client } = createSSEStream({ onClose })

      client.close()

      // Wait for callback to be called
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(onClose).toHaveBeenCalled()
    })

    it('should provide createdAt timestamp', () => {
      const before = Date.now()
      const { client } = createSSEStream()
      const after = Date.now()

      expect(client.createdAt).toBeGreaterThanOrEqual(before)
      expect(client.createdAt).toBeLessThanOrEqual(after)
    })
  })
})

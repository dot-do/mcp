import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { doTool, createDoHandler } from '../../src/tools/do.js'
import type { DoScope } from '../../src/scope/types.js'

// Mock the evaluate function from ai-evaluate
vi.mock('ai-evaluate', () => ({
  evaluate: vi.fn()
}))

import { evaluate } from 'ai-evaluate'

describe('doTool', () => {
  describe('tool definition', () => {
    it('has correct name', () => {
      expect(doTool.name).toBe('do')
    })

    it('has description', () => {
      expect(doTool.description).toBe('Execute code in a sandboxed environment with access to configured bindings')
    })

    it('has correct input schema', () => {
      expect(doTool.inputSchema).toEqual({
        type: 'object',
        properties: {
          code: { type: 'string', description: 'TypeScript/JavaScript code to execute' }
        },
        required: ['code']
      })
    })
  })

  describe('createDoHandler', () => {
    const mockEvaluate = evaluate as Mock

    beforeEach(() => {
      mockEvaluate.mockReset()
    })

    it('executes code in sandbox', async () => {
      mockEvaluate.mockResolvedValue({
        success: true,
        value: 42,
        logs: [],
        duration: 5
      })

      const scope: DoScope = {
        bindings: {},
        types: 'declare const x: number'
      }

      const handler = createDoHandler(scope)
      await handler({ code: 'return 42' })

      expect(mockEvaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          script: expect.stringContaining('return 42')
        })
      )
    })

    it('returns success result with value', async () => {
      mockEvaluate.mockResolvedValue({
        success: true,
        value: { name: 'test', count: 5 },
        logs: [],
        duration: 10
      })

      const scope: DoScope = {
        bindings: {},
        types: ''
      }

      const handler = createDoHandler(scope)
      const result = await handler({ code: 'return { name: "test", count: 5 }' })

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text)
      expect(parsed.success).toBe(true)
      expect(parsed.value).toEqual({ name: 'test', count: 5 })
      expect(parsed.logs).toEqual([])
      expect(parsed.duration).toBe(10)
      expect(result.isError).toBe(false)
    })

    it('captures console.log output', async () => {
      mockEvaluate.mockResolvedValue({
        success: true,
        value: undefined,
        logs: [
          { level: 'log', message: 'Hello', timestamp: 1234 },
          { level: 'log', message: 'World', timestamp: 1235 }
        ],
        duration: 5
      })

      const scope: DoScope = {
        bindings: {},
        types: ''
      }

      const handler = createDoHandler(scope)
      const result = await handler({ code: 'console.log("Hello"); console.log("World")' })

      const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text)
      expect(parsed.logs).toHaveLength(2)
      expect(parsed.logs[0].message).toBe('Hello')
      expect(parsed.logs[1].message).toBe('World')
    })

    it('returns error result on failure', async () => {
      mockEvaluate.mockResolvedValue({
        success: false,
        error: 'ReferenceError: x is not defined',
        logs: [],
        duration: 2
      })

      const scope: DoScope = {
        bindings: {},
        types: ''
      }

      const handler = createDoHandler(scope)
      const result = await handler({ code: 'return x' })

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toBe('ReferenceError: x is not defined')
      expect(parsed.logs).toEqual([])
      expect(parsed.duration).toBe(2)
      expect(result.isError).toBe(true)
    })

    it('respects timeout from scope', async () => {
      mockEvaluate.mockResolvedValue({
        success: true,
        value: null,
        logs: [],
        duration: 100
      })

      const scope: DoScope = {
        bindings: {},
        types: '',
        timeout: 3000
      }

      const handler = createDoHandler(scope)
      await handler({ code: 'return null' })

      expect(mockEvaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 3000
        })
      )
    })

    it('handles evaluate throwing an exception', async () => {
      mockEvaluate.mockRejectedValue(new Error('Sandbox initialization failed'))

      const scope: DoScope = {
        bindings: {},
        types: ''
      }

      const handler = createDoHandler(scope)
      const result = await handler({ code: 'return 1' })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Sandbox initialization failed' })
          }
        ],
        isError: true
      })
    })

    it('includes duration in result', async () => {
      mockEvaluate.mockResolvedValue({
        success: true,
        value: 'done',
        logs: [],
        duration: 42
      })

      const scope: DoScope = {
        bindings: {},
        types: ''
      }

      const handler = createDoHandler(scope)
      const result = await handler({ code: 'return "done"' })

      const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text)
      expect(parsed.duration).toBe(42)
    })
  })
})

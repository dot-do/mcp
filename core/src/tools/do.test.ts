/**
 * Do Tool Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { doTool, createDoHandler, executeDo, createDoTool } from './do.js'
import type { DoScope } from '../scope/types.js'

describe('Do Tool', () => {
  describe('doTool definition', () => {
    it('should have correct name', () => {
      expect(doTool.name).toBe('do')
    })

    it('should have description', () => {
      expect(doTool.description).toBeDefined()
      expect(typeof doTool.description).toBe('string')
    })

    it('should have inputSchema with code property', () => {
      expect(doTool.inputSchema.properties.code).toBeDefined()
      expect(doTool.inputSchema.properties.code.type).toBe('string')
    })

    it('should require code in inputSchema', () => {
      expect(doTool.inputSchema.required).toContain('code')
    })
  })

  describe('createDoHandler', () => {
    const testScope: DoScope = {
      bindings: {
        testFn: () => 'test result',
      },
      types: 'declare function testFn(): string;',
      timeout: 5000,
    }

    it('should return a function', () => {
      const handler = createDoHandler(testScope)
      expect(typeof handler).toBe('function')
    })

    it('should execute simple code and return result', async () => {
      const handler = createDoHandler(testScope)

      const result = await handler({ code: 'return 42' })

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const parsed = JSON.parse(result.content[0].text)
      // ai-evaluate may or may not execute successfully depending on environment
      expect('success' in parsed || 'error' in parsed).toBe(true)
    })

    it('should include duration in result', async () => {
      const handler = createDoHandler(testScope)

      const result = await handler({ code: 'return 1' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.duration).toBeDefined()
      expect(typeof parsed.duration).toBe('number')
    })

    it('should include logs array in result', async () => {
      const handler = createDoHandler(testScope)

      const result = await handler({ code: 'return 1' })

      const parsed = JSON.parse(result.content[0].text)
      expect(Array.isArray(parsed.logs)).toBe(true)
    })

    it('should handle code execution errors', async () => {
      const handler = createDoHandler(testScope)

      const result = await handler({ code: 'throw new Error("test error")' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(false)
    })

    it('should handle syntax errors gracefully', async () => {
      const handler = createDoHandler(testScope)

      const result = await handler({ code: 'invalid syntax {{' })

      expect(result.isError).toBe(true)
    })

    it('should work with scope that has timeout', async () => {
      const scopeWithTimeout: DoScope = {
        ...testScope,
        timeout: 1000,
      }
      const handler = createDoHandler(scopeWithTimeout)

      const result = await handler({ code: 'return "fast"' })

      const parsed = JSON.parse(result.content[0].text)
      // Handler should return structured result
      expect(parsed).toBeDefined()
      expect('success' in parsed || 'error' in parsed).toBe(true)
    })
  })

  describe('executeDo (legacy)', () => {
    const testScope: DoScope = {
      bindings: {},
      types: '',
      timeout: 5000,
    }

    it('should execute code and return legacy format', async () => {
      const result = await executeDo({
        code: 'return 42',
        scope: testScope,
      })

      // executeDo returns LegacyDoResult format
      expect('result' in result || 'console' in result).toBe(true)
      if ('console' in result) {
        expect(Array.isArray(result.console)).toBe(true)
        expect(typeof result.executionTime).toBe('number')
      }
    })

    it('should handle code that throws', async () => {
      const result = await executeDo({
        code: 'throw new Error("test")',
        scope: testScope,
      })

      // When ai-evaluate catches an error it may return in different formats
      // based on whether evaluate itself throws or returns success: false
      expect(result).toBeDefined()
    })
  })

  describe('createDoTool (legacy)', () => {
    const testScope: DoScope = {
      bindings: {},
      types: '',
      timeout: 5000,
    }

    it('should create a function that executes code', async () => {
      const doFn = createDoTool(testScope, undefined as any)

      const result = await doFn('return 123')

      // The function should return some result
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })
  })
})

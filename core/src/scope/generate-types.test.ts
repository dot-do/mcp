/**
 * Type Generation Tests
 */

import { describe, it, expect } from 'vitest'
import { generateTypes } from './generate-types.js'

describe('Type Generation', () => {
  describe('generateTypes', () => {
    it('should return empty string for empty bindings', () => {
      const types = generateTypes({})
      expect(types).toBe('')
    })

    it('should generate function declaration for simple function', () => {
      const bindings = {
        hello: () => 'Hello!',
      }

      const types = generateTypes(bindings)

      expect(types).toContain('declare function hello')
      expect(types).toContain('(): unknown')
    })

    it('should generate function with parameter count', () => {
      const bindings = {
        add: (a: number, b: number) => a + b,
      }

      const types = generateTypes(bindings)

      expect(types).toContain('declare function add')
      expect(types).toContain('arg0: unknown')
      expect(types).toContain('arg1: unknown')
    })

    it('should detect async functions', () => {
      const bindings = {
        fetch: async (url: string) => ({ data: 'test' }),
      }

      const types = generateTypes(bindings)

      expect(types).toContain('Promise<unknown>')
    })

    it('should generate const declaration for object', () => {
      const bindings = {
        config: {
          name: 'test',
          version: 1,
        },
      }

      const types = generateTypes(bindings)

      expect(types).toContain('declare const config')
      expect(types).toContain('name: string')
      expect(types).toContain('version: number')
    })

    it('should handle nested objects', () => {
      const bindings = {
        api: {
          users: {
            get: (id: string) => ({ id }),
          },
        },
      }

      const types = generateTypes(bindings)

      expect(types).toContain('declare const api')
      expect(types).toContain('users:')
      expect(types).toContain('get:')
    })

    it('should handle mixed function and object bindings', () => {
      const bindings = {
        greet: (name: string) => `Hello, ${name}!`,
        utils: {
          format: (value: number) => value.toString(),
        },
      }

      const types = generateTypes(bindings)

      expect(types).toContain('declare function greet')
      expect(types).toContain('declare const utils')
    })

    it('should handle boolean values', () => {
      const bindings = {
        config: {
          enabled: true,
          debug: false,
        },
      }

      const types = generateTypes(bindings)

      expect(types).toContain('enabled: boolean')
      expect(types).toContain('debug: boolean')
    })

    it('should handle null values', () => {
      const bindings = {
        config: {
          value: null,
        },
      }

      const types = generateTypes(bindings)

      expect(types).toContain('value: null')
    })

    it('should handle arrays', () => {
      const bindings = {
        config: {
          items: [1, 2, 3],
        },
      }

      const types = generateTypes(bindings)

      expect(types).toContain('items: unknown[]')
    })

    it('should handle empty objects', () => {
      const bindings = {
        empty: {},
      }

      const types = generateTypes(bindings)

      expect(types).toContain('declare const empty')
      expect(types).toContain('{}')
    })

    it('should handle function with no parameters', () => {
      const bindings = {
        now: () => Date.now(),
      }

      const types = generateTypes(bindings)

      expect(types).toContain('(): unknown')
    })

    it('should handle function with many parameters', () => {
      const bindings = {
        multi: (a: any, b: any, c: any, d: any, e: any) => {},
      }

      const types = generateTypes(bindings)

      expect(types).toContain('arg0: unknown')
      expect(types).toContain('arg4: unknown')
    })

    it('should generate multiple declarations', () => {
      const bindings = {
        fn1: () => {},
        fn2: () => {},
        obj1: { a: 1 },
      }

      const types = generateTypes(bindings)

      const lines = types.split('\n')
      expect(lines.filter((l) => l.includes('declare'))).toHaveLength(3)
    })

    it('should skip undefined values', () => {
      const bindings = {
        undefinedVal: undefined,
      }

      const types = generateTypes(bindings as any)

      // undefined is not a function or object, so it's skipped
      expect(types).toBe('')
    })

    it('should handle function inside object', () => {
      const bindings = {
        math: {
          add: (a: number, b: number) => a + b,
          constant: 42,
        },
      }

      const types = generateTypes(bindings)

      expect(types).toContain('add:')
      expect(types).toContain('=>')
      expect(types).toContain('constant: number')
    })
  })
})

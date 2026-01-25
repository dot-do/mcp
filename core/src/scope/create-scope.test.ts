/**
 * Create Scope Tests
 */

import { describe, it, expect } from 'vitest'
import { createScope, ScopeValidationError } from './create-scope.js'
import type { DoScope } from './types.js'

describe('Create Scope', () => {
  describe('createScope', () => {
    it('should create scope from function bindings', () => {
      const scope = createScope({
        greet: (name: string) => `Hello, ${name}!`,
      })

      expect(scope.bindings.greet).toBeDefined()
      expect(typeof scope.bindings.greet).toBe('function')
    })

    it('should auto-generate types when not provided', () => {
      const scope = createScope({
        add: (a: number, b: number) => a + b,
      })

      expect(scope.types).toContain('declare function add')
      expect(scope.types).toContain('arg0: unknown')
      expect(scope.types).toContain('arg1: unknown')
    })

    it('should use custom types when provided', () => {
      const customTypes = 'declare function greet(name: string): string;'
      const scope = createScope(
        { greet: (name: string) => `Hello, ${name}!` },
        customTypes
      )

      expect(scope.types).toBe(customTypes)
    })

    it('should create scope from object bindings', () => {
      const scope = createScope({
        math: {
          add: (a: number, b: number) => a + b,
          PI: 3.14159,
        },
      })

      expect(scope.bindings.math).toBeDefined()
      expect(typeof scope.bindings.math).toBe('object')
    })

    it('should throw ScopeValidationError for invalid bindings', () => {
      expect(() => {
        createScope({
          invalidNull: null as any,
        })
      }).toThrow(ScopeValidationError)
    })

    it('should include errors in ScopeValidationError', () => {
      try {
        createScope({
          invalidNull: null as any,
          invalidUndefined: undefined as any,
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ScopeValidationError)
        expect((error as ScopeValidationError).errors.length).toBe(2)
      }
    })

    it('should create scope with empty bindings', () => {
      const scope = createScope({})

      expect(scope.bindings).toEqual({})
      expect(scope.types).toBe('')
    })

    it('should create scope from mixed bindings', () => {
      const scope = createScope({
        greet: (name: string) => `Hi, ${name}`,
        utils: {
          format: (n: number) => n.toFixed(2),
        },
        config: { version: '1.0' },
      })

      expect(scope.bindings.greet).toBeDefined()
      expect(scope.bindings.utils).toBeDefined()
      expect(scope.bindings.config).toBeDefined()
    })

    it('should preserve function identity in bindings', () => {
      const fn = (x: number) => x * 2
      const scope = createScope({ double: fn })

      expect(scope.bindings.double).toBe(fn)
    })

    it('should preserve object identity in bindings', () => {
      const obj = { value: 42 }
      const scope = createScope({ data: obj })

      expect(scope.bindings.data).toBe(obj)
    })

    it('should handle async functions', () => {
      const scope = createScope({
        fetch: async (url: string) => ({ data: 'test' }),
      })

      expect(scope.types).toContain('Promise<unknown>')
    })

    it('should handle deeply nested objects', () => {
      const scope = createScope({
        api: {
          v1: {
            users: {
              get: (id: string) => ({ id }),
            },
          },
        },
      })

      expect(scope.bindings.api).toBeDefined()
      const api = scope.bindings.api as Record<string, unknown>
      const v1 = api.v1 as Record<string, unknown>
      const users = v1.users as Record<string, unknown>
      expect(typeof users.get).toBe('function')
    })

    it('should allow array bindings', () => {
      const scope = createScope({
        items: [1, 2, 3],
      })

      expect(scope.bindings.items).toEqual([1, 2, 3])
    })
  })

  describe('ScopeValidationError', () => {
    it('should be an instance of Error', () => {
      const error = new ScopeValidationError('Test error', ['error1', 'error2'])

      expect(error).toBeInstanceOf(Error)
    })

    it('should have name ScopeValidationError', () => {
      const error = new ScopeValidationError('Test', [])

      expect(error.name).toBe('ScopeValidationError')
    })

    it('should store errors array', () => {
      const errors = ['Error 1', 'Error 2', 'Error 3']
      const error = new ScopeValidationError('Multiple errors', errors)

      expect(error.errors).toEqual(errors)
    })

    it('should have message', () => {
      const error = new ScopeValidationError('Custom message', [])

      expect(error.message).toBe('Custom message')
    })
  })
})

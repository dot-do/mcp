/**
 * Binding Proxy Tests
 */

import { describe, it, expect, vi } from 'vitest'
import {
  wrapBinding,
  createBindingProxy,
  serializeValue,
  deserializeValue,
  createSerializedBinding,
  type BindingProxy,
} from './binding.js'

describe('Binding Proxy', () => {
  describe('wrapBinding', () => {
    it('should wrap sync function to return Promise', async () => {
      const syncFn = (a: number, b: number) => a + b
      const wrapped = wrapBinding('add', syncFn)

      const result = await wrapped(2, 3)

      expect(result).toBe(5)
    })

    it('should pass through async function', async () => {
      const asyncFn = async (x: number) => x * 2
      const wrapped = wrapBinding('double', asyncFn)

      const result = await wrapped(5)

      expect(result).toBe(10)
    })

    it('should preserve error from original function', async () => {
      const errorFn = () => {
        throw new Error('Original error')
      }
      const wrapped = wrapBinding('fail', errorFn)

      await expect(wrapped()).rejects.toThrow('Original error')
    })

    it('should wrap non-Error throws with context', async () => {
      const errorFn = () => {
        throw 'string error'
      }
      const wrapped = wrapBinding('fail', errorFn)

      await expect(wrapped()).rejects.toThrow("Binding 'fail' failed: string error")
    })

    it('should handle async rejection', async () => {
      const asyncErrorFn = async () => {
        throw new Error('Async error')
      }
      const wrapped = wrapBinding('asyncFail', asyncErrorFn)

      await expect(wrapped()).rejects.toThrow('Async error')
    })

    it('should handle undefined return', async () => {
      const voidFn = () => {}
      const wrapped = wrapBinding('void', voidFn)

      const result = await wrapped()

      expect(result).toBeUndefined()
    })
  })

  describe('createBindingProxy', () => {
    it('should create proxy for function bindings', async () => {
      const bindings = {
        greet: (name: string) => `Hello, ${name}!`,
      }
      const proxy = createBindingProxy(bindings)

      const result = await (proxy.greet as Function)('World')

      expect(result).toBe('Hello, World!')
    })

    it('should create proxy for nested object bindings', async () => {
      const bindings = {
        math: {
          add: (a: number, b: number) => a + b,
          multiply: (a: number, b: number) => a * b,
        },
      }
      const proxy = createBindingProxy(bindings)

      const mathProxy = proxy.math as BindingProxy
      expect(await (mathProxy.add as Function)(2, 3)).toBe(5)
      expect(await (mathProxy.multiply as Function)(2, 3)).toBe(6)
    })

    it('should wrap primitive values in getter functions', async () => {
      const bindings = {
        version: '1.0.0',
        maxRetries: 3,
        enabled: true,
      }
      const proxy = createBindingProxy(bindings)

      expect(await (proxy.version as Function)()).toBe('1.0.0')
      expect(await (proxy.maxRetries as Function)()).toBe(3)
      expect(await (proxy.enabled as Function)()).toBe(true)
    })

    it('should handle deeply nested objects', async () => {
      const bindings = {
        api: {
          v1: {
            users: {
              get: (id: string) => ({ id, name: 'Test' }),
            },
          },
        },
      }
      const proxy = createBindingProxy(bindings)

      const result = await ((proxy.api as BindingProxy).v1 as BindingProxy).users as BindingProxy
      expect(await (result.get as Function)('123')).toEqual({ id: '123', name: 'Test' })
    })

    it('should handle empty bindings', () => {
      const proxy = createBindingProxy({})

      expect(Object.keys(proxy)).toHaveLength(0)
    })

    it('should include path in error messages', async () => {
      const bindings = {
        api: {
          users: {
            create: () => {
              throw 'creation failed'
            },
          },
        },
      }
      const proxy = createBindingProxy(bindings)

      const usersProxy = (proxy.api as BindingProxy).users as BindingProxy
      await expect((usersProxy.create as Function)()).rejects.toThrow(
        "Binding 'api.users.create' failed: creation failed"
      )
    })
  })

  describe('serializeValue', () => {
    it('should serialize undefined as string', () => {
      expect(serializeValue(undefined)).toBe('undefined')
    })

    it('should serialize functions as placeholder', () => {
      expect(serializeValue(() => {})).toBe('"[Function]"')
    })

    it('should serialize null', () => {
      expect(serializeValue(null)).toBe('null')
    })

    it('should serialize primitives as JSON', () => {
      expect(serializeValue('hello')).toBe('"hello"')
      expect(serializeValue(42)).toBe('42')
      expect(serializeValue(true)).toBe('true')
    })

    it('should serialize objects as JSON', () => {
      const obj = { a: 1, b: 'two' }
      expect(serializeValue(obj)).toBe('{"a":1,"b":"two"}')
    })

    it('should serialize arrays as JSON', () => {
      expect(serializeValue([1, 2, 3])).toBe('[1,2,3]')
    })
  })

  describe('deserializeValue', () => {
    it('should deserialize undefined string', () => {
      expect(deserializeValue('undefined')).toBeUndefined()
    })

    it('should deserialize JSON strings', () => {
      expect(deserializeValue('"hello"')).toBe('hello')
      expect(deserializeValue('42')).toBe(42)
      expect(deserializeValue('true')).toBe(true)
      expect(deserializeValue('null')).toBeNull()
    })

    it('should deserialize JSON objects', () => {
      expect(deserializeValue('{"a":1}')).toEqual({ a: 1 })
    })

    it('should deserialize JSON arrays', () => {
      expect(deserializeValue('[1,2,3]')).toEqual([1, 2, 3])
    })

    it('should return raw string for invalid JSON', () => {
      expect(deserializeValue('not json')).toBe('not json')
      expect(deserializeValue('{ invalid }')).toBe('{ invalid }')
    })
  })

  describe('createSerializedBinding', () => {
    it('should deserialize string arguments', async () => {
      const fn = (x: number) => x * 2
      const serialized = createSerializedBinding('double', fn)

      const result = await serialized('5') // String "5" should be deserialized to 5

      expect(result).toBe(10)
    })

    it('should pass through non-string arguments', async () => {
      const fn = (x: number) => x * 2
      const serialized = createSerializedBinding('double', fn)

      const result = await serialized(5) // Number 5 passed directly

      expect(result).toBe(10)
    })

    it('should deserialize JSON string arguments', async () => {
      const fn = (obj: { a: number }) => obj.a * 2
      const serialized = createSerializedBinding('extract', fn)

      const result = await serialized('{"a":10}')

      expect(result).toBe(20)
    })

    it('should handle multiple arguments', async () => {
      const fn = (a: number, b: number) => a + b
      const serialized = createSerializedBinding('add', fn)

      const result = await serialized('2', '3')

      expect(result).toBe(5)
    })
  })
})

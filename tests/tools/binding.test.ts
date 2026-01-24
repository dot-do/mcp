import { describe, it, expect, vi } from 'vitest'
import {
  createBindingProxy,
  wrapBinding,
  serializeValue,
  deserializeValue,
  type BindingProxy
} from '../../src/tools/binding.js'

describe('binding proxy', () => {
  describe('wrapBinding', () => {
    it('wraps a function as an async function', async () => {
      const syncFn = (a: number, b: number) => a + b

      const wrapped = wrapBinding('add', syncFn)

      expect(typeof wrapped).toBe('function')
      const result = await wrapped(2, 3)
      expect(result).toBe(5)
    })

    it('wraps an async function', async () => {
      const asyncFn = async (x: number) => x * 2

      const wrapped = wrapBinding('double', asyncFn)

      const result = await wrapped(5)
      expect(result).toBe(10)
    })

    it('handles function that throws', async () => {
      const throwingFn = () => {
        throw new Error('Function error')
      }

      const wrapped = wrapBinding('throw', throwingFn)

      await expect(wrapped()).rejects.toThrow('Function error')
    })

    it('handles async function that rejects', async () => {
      const rejectingFn = async () => {
        throw new Error('Async error')
      }

      const wrapped = wrapBinding('reject', rejectingFn)

      await expect(wrapped()).rejects.toThrow('Async error')
    })
  })

  describe('createBindingProxy', () => {
    it('creates proxy for all bindings', () => {
      const bindings = {
        search: vi.fn(),
        fetch: vi.fn()
      }

      const proxy = createBindingProxy(bindings)

      expect(proxy.search).toBeDefined()
      expect(proxy.fetch).toBeDefined()
      expect(typeof proxy.search).toBe('function')
      expect(typeof proxy.fetch).toBe('function')
    })

    it('wraps nested object bindings', () => {
      const bindings = {
        db: {
          query: vi.fn().mockReturnValue([{ id: 1 }]),
          insert: vi.fn().mockReturnValue({ success: true })
        }
      }

      const proxy = createBindingProxy(bindings)

      expect(proxy.db).toBeDefined()
      expect(typeof proxy.db).toBe('object')
      expect(typeof proxy.db.query).toBe('function')
      expect(typeof proxy.db.insert).toBe('function')
    })

    it('calls underlying binding with arguments', async () => {
      const mockSearch = vi.fn().mockResolvedValue([{ id: '1', title: 'Result' }])
      const bindings = {
        search: mockSearch
      }

      const proxy = createBindingProxy(bindings)
      await proxy.search('test query')

      expect(mockSearch).toHaveBeenCalledWith('test query')
    })

    it('returns promise that resolves with binding result', async () => {
      const bindings = {
        fetch: vi.fn().mockResolvedValue({ content: 'Hello' })
      }

      const proxy = createBindingProxy(bindings)
      const result = await proxy.fetch('doc:123')

      expect(result).toEqual({ content: 'Hello' })
    })

    it('handles deeply nested objects', () => {
      const bindings = {
        api: {
          users: {
            get: vi.fn().mockResolvedValue({ id: 1, name: 'John' }),
            create: vi.fn().mockResolvedValue({ id: 2, name: 'Jane' })
          },
          posts: {
            list: vi.fn().mockResolvedValue([])
          }
        }
      }

      const proxy = createBindingProxy(bindings)

      expect(typeof proxy.api.users.get).toBe('function')
      expect(typeof proxy.api.users.create).toBe('function')
      expect(typeof proxy.api.posts.list).toBe('function')
    })
  })

  describe('serializeValue', () => {
    it('serializes primitive values', () => {
      expect(serializeValue(42)).toBe('42')
      expect(serializeValue('hello')).toBe('"hello"')
      expect(serializeValue(true)).toBe('true')
      expect(serializeValue(null)).toBe('null')
    })

    it('serializes arrays', () => {
      expect(serializeValue([1, 2, 3])).toBe('[1,2,3]')
    })

    it('serializes objects', () => {
      expect(serializeValue({ a: 1, b: 2 })).toBe('{"a":1,"b":2}')
    })

    it('handles undefined', () => {
      expect(serializeValue(undefined)).toBe('undefined')
    })

    it('handles functions by returning undefined indicator', () => {
      const fn = () => {}
      expect(serializeValue(fn)).toBe('"[Function]"')
    })
  })

  describe('deserializeValue', () => {
    it('deserializes primitive values', () => {
      expect(deserializeValue('42')).toBe(42)
      expect(deserializeValue('"hello"')).toBe('hello')
      expect(deserializeValue('true')).toBe(true)
      expect(deserializeValue('null')).toBe(null)
    })

    it('deserializes arrays', () => {
      expect(deserializeValue('[1,2,3]')).toEqual([1, 2, 3])
    })

    it('deserializes objects', () => {
      expect(deserializeValue('{"a":1,"b":2}')).toEqual({ a: 1, b: 2 })
    })

    it('handles undefined string', () => {
      expect(deserializeValue('undefined')).toBe(undefined)
    })

    it('returns raw string for invalid JSON', () => {
      expect(deserializeValue('not valid json')).toBe('not valid json')
    })
  })
})

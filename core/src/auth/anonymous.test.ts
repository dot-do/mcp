/**
 * Anonymous Auth Tests
 */

import { describe, it, expect } from 'vitest'
import {
  createAnonymousContext,
  isAnonymous,
  ANONYMOUS_CONTEXT,
} from './anonymous.js'
import type { AuthContext } from './types.js'

describe('Anonymous Auth', () => {
  describe('ANONYMOUS_CONTEXT', () => {
    it('should be a frozen object', () => {
      expect(Object.isFrozen(ANONYMOUS_CONTEXT)).toBe(true)
    })

    it('should have correct properties', () => {
      expect(ANONYMOUS_CONTEXT).toEqual({
        type: 'anon',
        id: 'anonymous',
        readonly: true,
      })
    })

    it('should not be modifiable', () => {
      expect(() => {
        // @ts-expect-error - testing immutability
        ANONYMOUS_CONTEXT.id = 'hacked'
      }).toThrow()
    })
  })

  describe('createAnonymousContext', () => {
    it('should create default anonymous context', () => {
      const context = createAnonymousContext()
      expect(context.type).toBe('anon')
      expect(context.id).toBe('anonymous')
      expect(context.readonly).toBe(true)
    })

    it('should allow custom id', () => {
      const context = createAnonymousContext({ id: 'guest-123' })
      expect(context.id).toBe('guest-123')
      expect(context.type).toBe('anon')
      expect(context.readonly).toBe(true)
    })

    it('should allow metadata', () => {
      const context = createAnonymousContext({
        metadata: { source: 'api', region: 'us-west' },
      })
      expect(context.metadata).toEqual({ source: 'api', region: 'us-west' })
    })

    it('should always be readonly regardless of options', () => {
      const context = createAnonymousContext()
      expect(context.readonly).toBe(true)
    })
  })

  describe('isAnonymous', () => {
    it('should return true for anon type context', () => {
      const context: AuthContext = {
        type: 'anon',
        id: 'anonymous',
        readonly: true,
      }
      expect(isAnonymous(context)).toBe(true)
    })

    it('should return false for oauth type context', () => {
      const context: AuthContext = {
        type: 'oauth',
        id: 'user-123',
        readonly: false,
      }
      expect(isAnonymous(context)).toBe(false)
    })

    it('should return false for apikey type context', () => {
      const context: AuthContext = {
        type: 'apikey',
        id: 'key-456',
        readonly: false,
      }
      expect(isAnonymous(context)).toBe(false)
    })

    it('should work with ANONYMOUS_CONTEXT', () => {
      expect(isAnonymous(ANONYMOUS_CONTEXT)).toBe(true)
    })

    it('should work with createAnonymousContext result', () => {
      const context = createAnonymousContext()
      expect(isAnonymous(context)).toBe(true)
    })
  })
})

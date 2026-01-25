/**
 * Auth Types Tests
 */

import { describe, it, expect } from 'vitest'
import { detectTokenType, ANONYMOUS_CONTEXT } from './types.js'
import type { AuthContext, AuthMode, TokenType, AuthResult, AuthError } from './types.js'

describe('Auth Types', () => {
  describe('detectTokenType', () => {
    it('should detect sk_ prefixed tokens as api-key-sk', () => {
      expect(detectTokenType('sk_live_123456')).toBe('api-key-sk')
      expect(detectTokenType('sk_test_abcdef')).toBe('api-key-sk')
    })

    it('should detect do_ prefixed tokens as api-key-do', () => {
      expect(detectTokenType('do_live_123456')).toBe('api-key-do')
      expect(detectTokenType('do_test_abcdef')).toBe('api-key-do')
    })

    it('should detect JWT tokens (three base64 parts)', () => {
      // A valid JWT structure (header.payload.signature)
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature'
      expect(detectTokenType(jwt)).toBe('jwt')
    })

    it('should return unknown for unrecognized tokens', () => {
      expect(detectTokenType('random_token')).toBe('unknown')
      expect(detectTokenType('')).toBe('unknown')
      expect(detectTokenType('just.two.parts.but.four')).toBe('unknown')
    })

    it('should handle edge cases', () => {
      expect(detectTokenType('a.b.c')).toBe('jwt') // Minimal JWT structure
      expect(detectTokenType('sk_')).toBe('api-key-sk')
      expect(detectTokenType('do_')).toBe('api-key-do')
    })
  })

  describe('ANONYMOUS_CONTEXT', () => {
    it('should have type anon', () => {
      expect(ANONYMOUS_CONTEXT.type).toBe('anon')
    })

    it('should have id anonymous', () => {
      expect(ANONYMOUS_CONTEXT.id).toBe('anonymous')
    })

    it('should be readonly', () => {
      expect(ANONYMOUS_CONTEXT.readonly).toBe(true)
    })
  })

  describe('AuthContext interface', () => {
    it('should support anon type', () => {
      const context: AuthContext = {
        type: 'anon',
        id: 'anonymous',
        readonly: true,
      }
      expect(context.type).toBe('anon')
    })

    it('should support oauth type', () => {
      const context: AuthContext = {
        type: 'oauth',
        id: 'user-123',
        readonly: false,
        isAdmin: true,
        token: 'access_token_here',
        metadata: { scope: 'read write' },
      }
      expect(context.type).toBe('oauth')
      expect(context.isAdmin).toBe(true)
    })

    it('should support apikey type', () => {
      const context: AuthContext = {
        type: 'apikey',
        id: 'key-456',
        readonly: false,
        metadata: { name: 'Production Key' },
      }
      expect(context.type).toBe('apikey')
    })
  })

  describe('AuthMode type', () => {
    it('should accept valid auth modes', () => {
      const modes: AuthMode[] = ['anon', 'anon+auth', 'auth-required']
      expect(modes).toHaveLength(3)
    })
  })

  describe('AuthResult discriminated union', () => {
    it('should represent success case', () => {
      const success: AuthResult = {
        success: true,
        context: {
          type: 'oauth',
          id: 'user-123',
          readonly: false,
        },
      }
      expect(success.success).toBe(true)
      if (success.success) {
        expect(success.context.id).toBe('user-123')
      }
    })

    it('should represent failure case', () => {
      const failure: AuthResult = {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token is expired',
        },
      }
      expect(failure.success).toBe(false)
      if (!failure.success) {
        expect(failure.error.code).toBe('INVALID_TOKEN')
      }
    })
  })
})

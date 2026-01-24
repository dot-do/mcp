import { describe, it, expect, expectTypeOf } from 'vitest'
import type { AuthContext, AuthMode, AuthConfig, AuthResult, AuthError } from './types'

describe('AuthContext type', () => {
  describe('type field', () => {
    it('should accept "anon" as type', () => {
      const ctx: AuthContext = {
        type: 'anon',
        id: 'anon-user',
        readonly: true,
      }
      expect(ctx.type).toBe('anon')
    })

    it('should accept "oauth" as type', () => {
      const ctx: AuthContext = {
        type: 'oauth',
        id: 'user-123',
        readonly: false,
      }
      expect(ctx.type).toBe('oauth')
    })

    it('should accept "apikey" as type', () => {
      const ctx: AuthContext = {
        type: 'apikey',
        id: 'key-abc',
        readonly: false,
      }
      expect(ctx.type).toBe('apikey')
    })
  })

  describe('id field', () => {
    it('should be a string', () => {
      const ctx: AuthContext = {
        type: 'anon',
        id: 'test-id',
        readonly: true,
      }
      expect(typeof ctx.id).toBe('string')
    })
  })

  describe('readonly field', () => {
    it('should be a boolean', () => {
      const ctx: AuthContext = {
        type: 'anon',
        id: 'test',
        readonly: true,
      }
      expect(typeof ctx.readonly).toBe('boolean')
    })

    it('should accept false', () => {
      const ctx: AuthContext = {
        type: 'oauth',
        id: 'test',
        readonly: false,
      }
      expect(ctx.readonly).toBe(false)
    })
  })

  describe('optional fields', () => {
    it('should allow isAdmin to be true', () => {
      const ctx: AuthContext = {
        type: 'oauth',
        id: 'admin-user',
        readonly: false,
        isAdmin: true,
      }
      expect(ctx.isAdmin).toBe(true)
    })

    it('should allow isAdmin to be false', () => {
      const ctx: AuthContext = {
        type: 'oauth',
        id: 'regular-user',
        readonly: false,
        isAdmin: false,
      }
      expect(ctx.isAdmin).toBe(false)
    })

    it('should allow metadata record', () => {
      const ctx: AuthContext = {
        type: 'apikey',
        id: 'key-123',
        readonly: false,
        metadata: {
          scope: 'read:all',
          created: '2024-01-01',
          customField: 42,
        },
      }
      expect(ctx.metadata).toEqual({
        scope: 'read:all',
        created: '2024-01-01',
        customField: 42,
      })
    })

    it('should allow empty metadata', () => {
      const ctx: AuthContext = {
        type: 'anon',
        id: 'anon',
        readonly: true,
        metadata: {},
      }
      expect(ctx.metadata).toEqual({})
    })
  })
})

describe('AuthMode type', () => {
  it('should accept "anon"', () => {
    const mode: AuthMode = 'anon'
    expect(mode).toBe('anon')
  })

  it('should accept "anon+auth"', () => {
    const mode: AuthMode = 'anon+auth'
    expect(mode).toBe('anon+auth')
  })

  it('should accept "auth-required"', () => {
    const mode: AuthMode = 'auth-required'
    expect(mode).toBe('auth-required')
  })
})

describe('AuthConfig type', () => {
  it('should require mode field', () => {
    const config: AuthConfig = {
      mode: 'anon',
    }
    expect(config.mode).toBe('anon')
  })

  it('should allow oauth configuration', () => {
    const config: AuthConfig = {
      mode: 'auth-required',
      oauth: {
        introspectionUrl: 'https://auth.example.com/introspect',
      },
    }
    expect(config.oauth?.introspectionUrl).toBe('https://auth.example.com/introspect')
  })

  it('should allow oauth with clientId', () => {
    const config: AuthConfig = {
      mode: 'anon+auth',
      oauth: {
        introspectionUrl: 'https://auth.example.com/introspect',
        clientId: 'my-client-id',
      },
    }
    expect(config.oauth?.clientId).toBe('my-client-id')
  })

  it('should allow apiKey configuration', () => {
    const config: AuthConfig = {
      mode: 'auth-required',
      apiKey: {
        verifyUrl: 'https://api.example.com/verify-key',
      },
    }
    expect(config.apiKey?.verifyUrl).toBe('https://api.example.com/verify-key')
  })

  it('should allow both oauth and apiKey configurations', () => {
    const config: AuthConfig = {
      mode: 'anon+auth',
      oauth: {
        introspectionUrl: 'https://auth.example.com/introspect',
        clientId: 'client-123',
      },
      apiKey: {
        verifyUrl: 'https://api.example.com/verify-key',
      },
    }
    expect(config.oauth).toBeDefined()
    expect(config.apiKey).toBeDefined()
  })
})

describe('AuthResult type', () => {
  it('should represent success with AuthContext', () => {
    const result: AuthResult = {
      success: true,
      context: {
        type: 'oauth',
        id: 'user-123',
        readonly: false,
      },
    }
    expect(result.success).toBe(true)
    expect(result.context.id).toBe('user-123')
  })

  it('should represent failure with AuthError', () => {
    const result: AuthResult = {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token has expired',
      },
    }
    expect(result.success).toBe(false)
    expect(result.error.code).toBe('INVALID_TOKEN')
  })
})

describe('AuthError type', () => {
  it('should have code and message', () => {
    const error: AuthError = {
      code: 'UNAUTHORIZED',
      message: 'No authentication provided',
    }
    expect(error.code).toBe('UNAUTHORIZED')
    expect(error.message).toBe('No authentication provided')
  })

  it('should allow optional details', () => {
    const error: AuthError = {
      code: 'INVALID_TOKEN',
      message: 'Token verification failed',
      details: {
        reason: 'expired',
        expiredAt: '2024-01-01T00:00:00Z',
      },
    }
    expect(error.details).toEqual({
      reason: 'expired',
      expiredAt: '2024-01-01T00:00:00Z',
    })
  })
})

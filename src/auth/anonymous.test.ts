import { describe, it, expect } from 'vitest'
import { createAnonymousContext, isAnonymous, ANONYMOUS_CONTEXT } from './anonymous'
import type { AuthContext } from './types'

describe('createAnonymousContext', () => {
  it('should return an AuthContext with type "anon"', () => {
    const ctx = createAnonymousContext()
    expect(ctx.type).toBe('anon')
  })

  it('should return an AuthContext with readonly set to true', () => {
    const ctx = createAnonymousContext()
    expect(ctx.readonly).toBe(true)
  })

  it('should have id set to "anonymous"', () => {
    const ctx = createAnonymousContext()
    expect(ctx.id).toBe('anonymous')
  })

  it('should not have isAdmin set', () => {
    const ctx = createAnonymousContext()
    expect(ctx.isAdmin).toBeUndefined()
  })

  it('should allow custom id', () => {
    const ctx = createAnonymousContext({ id: 'guest-123' })
    expect(ctx.id).toBe('guest-123')
  })

  it('should allow custom metadata', () => {
    const ctx = createAnonymousContext({
      metadata: { source: 'public-api', region: 'us-east' },
    })
    expect(ctx.metadata).toEqual({ source: 'public-api', region: 'us-east' })
  })

  it('should always be readonly regardless of options', () => {
    // Anonymous contexts should always be readonly
    const ctx = createAnonymousContext({ id: 'test' })
    expect(ctx.readonly).toBe(true)
  })
})

describe('isAnonymous', () => {
  it('should return true for anonymous context', () => {
    const ctx: AuthContext = {
      type: 'anon',
      id: 'anonymous',
      readonly: true,
    }
    expect(isAnonymous(ctx)).toBe(true)
  })

  it('should return false for oauth context', () => {
    const ctx: AuthContext = {
      type: 'oauth',
      id: 'user-123',
      readonly: false,
    }
    expect(isAnonymous(ctx)).toBe(false)
  })

  it('should return false for apikey context', () => {
    const ctx: AuthContext = {
      type: 'apikey',
      id: 'key-abc',
      readonly: false,
    }
    expect(isAnonymous(ctx)).toBe(false)
  })

  it('should return true for ANONYMOUS_CONTEXT constant', () => {
    expect(isAnonymous(ANONYMOUS_CONTEXT)).toBe(true)
  })
})

describe('ANONYMOUS_CONTEXT', () => {
  it('should be a valid AuthContext', () => {
    expect(ANONYMOUS_CONTEXT.type).toBe('anon')
    expect(ANONYMOUS_CONTEXT.id).toBe('anonymous')
    expect(ANONYMOUS_CONTEXT.readonly).toBe(true)
  })

  it('should be frozen and immutable', () => {
    expect(Object.isFrozen(ANONYMOUS_CONTEXT)).toBe(true)
  })
})

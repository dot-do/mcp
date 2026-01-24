import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyApiKey, createApiKeyContext, createApiKeyProvider } from './apikey'
import type { ApiKeyConfig, AuthResult } from './types'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('verifyApiKey', () => {
  const config: ApiKeyConfig = {
    verifyUrl: 'https://api.example.com/rpc/verify-key',
  }

  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('successful verification', () => {
    it('should return key info for valid sk_ prefixed key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          keyId: 'key-123',
          name: 'My API Key',
          permissions: ['read', 'write'],
        }),
      })

      const result = await verifyApiKey('sk_test_abc123', config)

      expect(result.valid).toBe(true)
      expect(result.keyId).toBe('key-123')
      expect(result.name).toBe('My API Key')
    })

    it('should return key info for valid do_ prefixed key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          keyId: 'do-key-456',
          name: 'Durable Object Key',
          permissions: ['read'],
        }),
      })

      const result = await verifyApiKey('do_live_xyz789', config)

      expect(result.valid).toBe(true)
      expect(result.keyId).toBe('do-key-456')
    })

    it('should call verify URL with key in JSON-RPC format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, keyId: 'test' }),
      })

      await verifyApiKey('sk_test_123', config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/rpc/verify-key',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.method).toBe('verifyApiKey')
      expect(body.params.key).toBe('sk_test_123')
    })
  })

  describe('invalid keys', () => {
    it('should return valid=false for revoked key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: false,
          error: 'Key has been revoked',
        }),
      })

      const result = await verifyApiKey('sk_revoked_key', config)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Key has been revoked')
    })

    it('should return valid=false for unknown key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: false,
          error: 'Key not found',
        }),
      })

      const result = await verifyApiKey('sk_unknown_key', config)

      expect(result.valid).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(verifyApiKey('sk_test', config)).rejects.toThrow(
        'Network error'
      )
    })

    it('should throw on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await expect(verifyApiKey('sk_test', config)).rejects.toThrow(
        'API key verification failed'
      )
    })
  })
})

describe('createApiKeyContext', () => {
  it('should create AuthContext from verification response', () => {
    const response = {
      valid: true,
      keyId: 'key-789',
      name: 'Production Key',
      permissions: ['read', 'write'],
    }

    const ctx = createApiKeyContext(response)

    expect(ctx.type).toBe('apikey')
    expect(ctx.id).toBe('key-789')
    expect(ctx.readonly).toBe(false)
  })

  it('should set readonly=true if only read permission', () => {
    const response = {
      valid: true,
      keyId: 'key-readonly',
      name: 'Read Only Key',
      permissions: ['read'],
    }

    const ctx = createApiKeyContext(response)

    expect(ctx.readonly).toBe(true)
  })

  it('should set isAdmin=true if admin permission present', () => {
    const response = {
      valid: true,
      keyId: 'key-admin',
      name: 'Admin Key',
      permissions: ['read', 'write', 'admin'],
    }

    const ctx = createApiKeyContext(response)

    expect(ctx.isAdmin).toBe(true)
  })

  it('should not set isAdmin if no admin permission', () => {
    const response = {
      valid: true,
      keyId: 'key-normal',
      name: 'Normal Key',
      permissions: ['read', 'write'],
    }

    const ctx = createApiKeyContext(response)

    expect(ctx.isAdmin).toBeUndefined()
  })

  it('should include metadata with key info', () => {
    const response = {
      valid: true,
      keyId: 'key-meta',
      name: 'Key With Meta',
      permissions: ['read'],
      ownerId: 'user-123',
      createdAt: '2024-01-01T00:00:00Z',
    }

    const ctx = createApiKeyContext(response)

    expect(ctx.metadata).toBeDefined()
    expect(ctx.metadata?.name).toBe('Key With Meta')
    expect(ctx.metadata?.permissions).toEqual(['read'])
    expect(ctx.metadata?.ownerId).toBe('user-123')
  })
})

describe('createApiKeyProvider', () => {
  const config: ApiKeyConfig = {
    verifyUrl: 'https://api.example.com/rpc/verify-key',
  }

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('should return success result for valid key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        keyId: 'key-123',
        name: 'Test Key',
        permissions: ['read', 'write'],
      }),
    })

    const provider = createApiKeyProvider(config)
    const result = await provider.verify('sk_valid_key')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.context.type).toBe('apikey')
      expect(result.context.id).toBe('key-123')
    }
  })

  it('should return error result for invalid key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: false,
        error: 'Key not found',
      }),
    })

    const provider = createApiKeyProvider(config)
    const result = await provider.verify('sk_invalid_key')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_API_KEY')
    }
  })

  it('should return error result on verification failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const provider = createApiKeyProvider(config)
    const result = await provider.verify('sk_any_key')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VERIFICATION_ERROR')
    }
  })
})

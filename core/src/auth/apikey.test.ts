/**
 * API Key Auth Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  verifyApiKey,
  createApiKeyContext,
  createApiKeyProvider,
  createLocalApiKeyProvider,
  type ApiKeyVerificationResponse,
} from './apikey.js'
import type { ApiKeyConfig } from './types.js'

describe('API Key Auth', () => {
  describe('createApiKeyContext', () => {
    it('should create context from minimal response', () => {
      const response: ApiKeyVerificationResponse = {
        valid: true,
        keyId: 'key-123',
      }
      const context = createApiKeyContext(response)

      expect(context.type).toBe('apikey')
      expect(context.id).toBe('key-123')
      expect(context.readonly).toBe(true) // No write permissions
    })

    it('should use unknown if keyId not present', () => {
      const response: ApiKeyVerificationResponse = {
        valid: true,
      }
      const context = createApiKeyContext(response)

      expect(context.id).toBe('unknown')
    })

    it('should set readonly false when write permission present', () => {
      const response: ApiKeyVerificationResponse = {
        valid: true,
        keyId: 'key-123',
        permissions: ['read', 'write'],
      }
      const context = createApiKeyContext(response)

      expect(context.readonly).toBe(false)
    })

    it('should set readonly false when admin permission present', () => {
      const response: ApiKeyVerificationResponse = {
        valid: true,
        keyId: 'key-123',
        permissions: ['read', 'admin'],
      }
      const context = createApiKeyContext(response)

      expect(context.readonly).toBe(false)
    })

    it('should set readonly false when scoped write permission present', () => {
      const response: ApiKeyVerificationResponse = {
        valid: true,
        keyId: 'key-123',
        permissions: ['read', 'users:write'],
      }
      const context = createApiKeyContext(response)

      expect(context.readonly).toBe(false)
    })

    it('should set isAdmin true when admin permission present', () => {
      const response: ApiKeyVerificationResponse = {
        valid: true,
        keyId: 'key-123',
        permissions: ['admin'],
      }
      const context = createApiKeyContext(response)

      expect(context.isAdmin).toBe(true)
    })

    it('should set isAdmin true when scoped admin permission present', () => {
      const response: ApiKeyVerificationResponse = {
        valid: true,
        keyId: 'key-123',
        permissions: ['system:admin'],
      }
      const context = createApiKeyContext(response)

      expect(context.isAdmin).toBe(true)
    })

    it('should include metadata from verification response', () => {
      const response: ApiKeyVerificationResponse = {
        valid: true,
        keyId: 'key-123',
        name: 'Production Key',
        permissions: ['read'],
        ownerId: 'user-456',
        createdAt: '2024-01-01T00:00:00Z',
      }
      const context = createApiKeyContext(response)

      expect(context.metadata).toEqual({
        name: 'Production Key',
        permissions: ['read'],
        ownerId: 'user-456',
        createdAt: '2024-01-01T00:00:00Z',
      })
    })

    it('should not include metadata if no relevant fields', () => {
      const response: ApiKeyVerificationResponse = {
        valid: true,
        keyId: 'key-123',
      }
      const context = createApiKeyContext(response)

      expect(context.metadata).toBeUndefined()
    })
  })

  describe('verifyApiKey', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
      globalThis.fetch = vi.fn()
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('should send JSON-RPC request to verify endpoint', async () => {
      const mockResponse: ApiKeyVerificationResponse = {
        valid: true,
        keyId: 'key-123',
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const config: ApiKeyConfig = {
        verifyUrl: 'https://api.example.com/verify',
      }

      const result = await verifyApiKey('sk_test_123', config)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/verify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should include JSON-RPC structure in request body', async () => {
      const mockResponse: ApiKeyVerificationResponse = { valid: true }

      let capturedBody: string | undefined

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        async (_url: string, options: { body?: string }) => {
          capturedBody = options?.body
          return {
            ok: true,
            json: () => Promise.resolve(mockResponse),
          }
        }
      )

      const config: ApiKeyConfig = {
        verifyUrl: 'https://api.example.com/verify',
      }

      await verifyApiKey('sk_test_123', config)

      expect(capturedBody).toBeDefined()
      const parsed = JSON.parse(capturedBody!)
      expect(parsed.jsonrpc).toBe('2.0')
      expect(parsed.method).toBe('verifyApiKey')
      expect(parsed.params).toEqual({ key: 'sk_test_123' })
    })

    it('should throw on non-ok response', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const config: ApiKeyConfig = {
        verifyUrl: 'https://api.example.com/verify',
      }

      await expect(verifyApiKey('sk_test_123', config)).rejects.toThrow(
        'API key verification failed: 500 Internal Server Error'
      )
    })
  })

  describe('createApiKeyProvider', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
      globalThis.fetch = vi.fn()
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('should return success result for valid key', async () => {
      const mockResponse: ApiKeyVerificationResponse = {
        valid: true,
        keyId: 'key-123',
        permissions: ['read', 'write'],
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const config: ApiKeyConfig = {
        verifyUrl: 'https://api.example.com/verify',
      }

      const provider = createApiKeyProvider(config)
      const result = await provider.verify('sk_test_123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('apikey')
        expect(result.context.id).toBe('key-123')
      }
    })

    it('should return failure result for invalid key', async () => {
      const mockResponse: ApiKeyVerificationResponse = {
        valid: false,
        error: 'Key not found',
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const config: ApiKeyConfig = {
        verifyUrl: 'https://api.example.com/verify',
      }

      const provider = createApiKeyProvider(config)
      const result = await provider.verify('sk_invalid')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_API_KEY')
        expect(result.error.message).toBe('Key not found')
      }
    })

    it('should return failure result on verification error', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      )

      const config: ApiKeyConfig = {
        verifyUrl: 'https://api.example.com/verify',
      }

      const provider = createApiKeyProvider(config)
      const result = await provider.verify('sk_test_123')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VERIFICATION_ERROR')
        expect(result.error.message).toBe('Network error')
      }
    })
  })

  describe('createLocalApiKeyProvider', () => {
    it('should return success for known keys', async () => {
      const validKeys = new Map([
        [
          'sk_test_123',
          { keyId: 'key-123', name: 'Test Key', permissions: ['read'] },
        ],
      ])

      const provider = createLocalApiKeyProvider(validKeys)
      const result = await provider.verify('sk_test_123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.id).toBe('key-123')
        expect(result.context.metadata?.name).toBe('Test Key')
      }
    })

    it('should return failure for unknown keys', async () => {
      const validKeys = new Map([
        ['sk_test_123', { keyId: 'key-123' }],
      ])

      const provider = createLocalApiKeyProvider(validKeys)
      const result = await provider.verify('sk_unknown')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_API_KEY')
        expect(result.error.message).toBe('API key not found')
      }
    })

    it('should set permissions from key config', async () => {
      const validKeys = new Map([
        [
          'sk_admin',
          { keyId: 'key-admin', permissions: ['admin'] },
        ],
      ])

      const provider = createLocalApiKeyProvider(validKeys)
      const result = await provider.verify('sk_admin')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.isAdmin).toBe(true)
        expect(result.context.readonly).toBe(false)
      }
    })

    it('should include ownerId in metadata', async () => {
      const validKeys = new Map([
        [
          'sk_user',
          { keyId: 'key-user', ownerId: 'user-456' },
        ],
      ])

      const provider = createLocalApiKeyProvider(validKeys)
      const result = await provider.verify('sk_user')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.metadata?.ownerId).toBe('user-456')
      }
    })
  })
})

import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  MCPServerConfig,
  DoScope,
  AuthConfig,
  OAuthConfig,
  ApiKeyConfig,
  SearchFunction,
  FetchFunction,
  SearchOptions,
  SearchResult,
  FetchOptions,
  FetchResult,
  DoPermissions,
} from './types';

describe('MCPServerConfig types', () => {
  describe('MCPServerConfig interface', () => {
    it('should require search function', () => {
      const search: SearchFunction = async (query, options) => [];
      const fetch: FetchFunction = async (id, options) => null;
      const doScope: DoScope = { bindings: {}, types: '' };

      const config: MCPServerConfig = {
        search,
        fetch,
        do: doScope,
      };

      expect(config.search).toBe(search);
      expect(config.fetch).toBe(fetch);
      expect(config.do).toBe(doScope);
    });

    it('should allow optional auth config', () => {
      const search: SearchFunction = async () => [];
      const fetch: FetchFunction = async () => null;
      const doScope: DoScope = { bindings: {}, types: '' };

      const config: MCPServerConfig = {
        search,
        fetch,
        do: doScope,
        auth: {
          mode: 'auth-required',
        },
      };

      expect(config.auth?.mode).toBe('auth-required');
    });
  });

  describe('DoScope interface', () => {
    it('should require bindings and types', () => {
      const doScope: DoScope = {
        bindings: { myBinding: 'value' },
        types: 'type MyType = string;',
      };

      expect(doScope.bindings).toEqual({ myBinding: 'value' });
      expect(doScope.types).toBe('type MyType = string;');
    });

    it('should allow optional timeout and permissions', () => {
      const doScope: DoScope = {
        bindings: {},
        types: '',
        timeout: 5000,
        permissions: {
          allowNet: true,
          allowEnv: false,
        },
      };

      expect(doScope.timeout).toBe(5000);
      expect(doScope.permissions?.allowNet).toBe(true);
    });
  });

  describe('AuthConfig interface', () => {
    it('should support anon mode', () => {
      const auth: AuthConfig = { mode: 'anon' };
      expect(auth.mode).toBe('anon');
    });

    it('should support anon+auth mode', () => {
      const auth: AuthConfig = { mode: 'anon+auth' };
      expect(auth.mode).toBe('anon+auth');
    });

    it('should support auth-required mode', () => {
      const auth: AuthConfig = { mode: 'auth-required' };
      expect(auth.mode).toBe('auth-required');
    });

    it('should allow optional oauth config', () => {
      const auth: AuthConfig = {
        mode: 'auth-required',
        oauth: {
          clientId: 'test-client',
          issuer: 'https://auth.example.com',
        },
      };

      expect(auth.oauth?.clientId).toBe('test-client');
      expect(auth.oauth?.issuer).toBe('https://auth.example.com');
    });

    it('should allow optional apiKey config', () => {
      const auth: AuthConfig = {
        mode: 'auth-required',
        apiKey: {
          header: 'X-API-Key',
          prefix: 'Bearer ',
        },
      };

      expect(auth.apiKey?.header).toBe('X-API-Key');
    });
  });

  describe('SearchFunction type', () => {
    it('should accept query string and return SearchResult array', async () => {
      const search: SearchFunction = async (query: string, options?: SearchOptions) => {
        return [
          { id: '1', title: 'Result 1', description: 'Description 1' },
          { id: '2', title: 'Result 2', description: 'Description 2' },
        ];
      };

      const results = await search('test query');
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('1');
      expect(results[0].title).toBe('Result 1');
    });

    it('should support search options', async () => {
      const search: SearchFunction = async (query, options) => {
        if (options?.limit) {
          return [{ id: '1', title: 'Limited', description: '' }];
        }
        return [];
      };

      const results = await search('test', { limit: 10, offset: 0 });
      expect(results).toHaveLength(1);
    });
  });

  describe('FetchFunction type', () => {
    it('should accept id and return FetchResult or null', async () => {
      const fetch: FetchFunction = async (id: string, options?: FetchOptions) => {
        if (id === '1') {
          return { id: '1', content: 'Content for 1', metadata: {} };
        }
        return null;
      };

      const result = await fetch('1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('1');
      expect(result?.content).toBe('Content for 1');

      const notFound = await fetch('nonexistent');
      expect(notFound).toBeNull();
    });

    it('should support fetch options', async () => {
      const fetch: FetchFunction = async (id, options) => {
        return {
          id,
          content: 'Content',
          metadata: options?.includeMetadata ? { key: 'value' } : {},
        };
      };

      const result = await fetch('1', { includeMetadata: true });
      expect(result?.metadata).toEqual({ key: 'value' });
    });
  });

  describe('DoPermissions interface', () => {
    it('should define permission flags', () => {
      const permissions: DoPermissions = {
        allowNet: true,
        allowEnv: false,
        allowFs: false,
        allowRun: false,
      };

      expect(permissions.allowNet).toBe(true);
      expect(permissions.allowEnv).toBe(false);
    });
  });

  describe('SearchOptions interface', () => {
    it('should support pagination options', () => {
      const options: SearchOptions = {
        limit: 10,
        offset: 20,
      };

      expect(options.limit).toBe(10);
      expect(options.offset).toBe(20);
    });

    it('should support filter options', () => {
      const options: SearchOptions = {
        limit: 10,
        filter: { type: 'document' },
      };

      expect(options.filter).toEqual({ type: 'document' });
    });
  });

  describe('FetchOptions interface', () => {
    it('should support includeMetadata option', () => {
      const options: FetchOptions = {
        includeMetadata: true,
      };

      expect(options.includeMetadata).toBe(true);
    });

    it('should support format option', () => {
      const options: FetchOptions = {
        format: 'markdown',
      };

      expect(options.format).toBe('markdown');
    });
  });

  describe('SearchResult interface', () => {
    it('should have required fields', () => {
      const result: SearchResult = {
        id: 'unique-id',
        title: 'Result Title',
        description: 'Result Description',
      };

      expect(result.id).toBe('unique-id');
      expect(result.title).toBe('Result Title');
      expect(result.description).toBe('Result Description');
    });

    it('should allow optional score and metadata', () => {
      const result: SearchResult = {
        id: '1',
        title: 'Title',
        description: 'Desc',
        score: 0.95,
        metadata: { type: 'document' },
      };

      expect(result.score).toBe(0.95);
      expect(result.metadata).toEqual({ type: 'document' });
    });
  });

  describe('FetchResult interface', () => {
    it('should have required fields', () => {
      const result: FetchResult = {
        id: 'unique-id',
        content: 'Full content here',
        metadata: {},
      };

      expect(result.id).toBe('unique-id');
      expect(result.content).toBe('Full content here');
      expect(result.metadata).toEqual({});
    });

    it('should allow optional mimeType and encoding', () => {
      const result: FetchResult = {
        id: '1',
        content: '<html>...</html>',
        metadata: {},
        mimeType: 'text/html',
        encoding: 'utf-8',
      };

      expect(result.mimeType).toBe('text/html');
      expect(result.encoding).toBe('utf-8');
    });
  });

  describe('OAuthConfig interface', () => {
    it('should require clientId and issuer', () => {
      const oauth: OAuthConfig = {
        clientId: 'my-client-id',
        issuer: 'https://auth.example.com',
      };

      expect(oauth.clientId).toBe('my-client-id');
      expect(oauth.issuer).toBe('https://auth.example.com');
    });

    it('should allow optional scopes and audience', () => {
      const oauth: OAuthConfig = {
        clientId: 'my-client-id',
        issuer: 'https://auth.example.com',
        scopes: ['read', 'write'],
        audience: 'https://api.example.com',
      };

      expect(oauth.scopes).toEqual(['read', 'write']);
      expect(oauth.audience).toBe('https://api.example.com');
    });
  });

  describe('ApiKeyConfig interface', () => {
    it('should require header', () => {
      const apiKey: ApiKeyConfig = {
        header: 'X-API-Key',
      };

      expect(apiKey.header).toBe('X-API-Key');
    });

    it('should allow optional prefix', () => {
      const apiKey: ApiKeyConfig = {
        header: 'Authorization',
        prefix: 'Bearer ',
      };

      expect(apiKey.prefix).toBe('Bearer ');
    });
  });
});

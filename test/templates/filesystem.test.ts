import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  filesystem,
  createFilesystemSearch,
  createFilesystemFetch,
  FILESYSTEM_TYPES,
  type FilesystemTemplateOptions,
  type FilesystemClient
} from '../../src/templates/filesystem.js'
import type { MCPServerConfig } from '../../src/core/types.js'

describe('filesystem template', () => {
  // Mock filesystem client
  const mockClient: FilesystemClient = {
    glob: vi.fn().mockResolvedValue([
      '/data/file1.txt',
      '/data/file2.json',
      '/data/subdir/file3.md'
    ]),
    read: vi.fn().mockResolvedValue('File content here'),
    write: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    move: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({
      size: 1024,
      isFile: true,
      isDirectory: false,
      mtime: new Date()
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('filesystem()', () => {
    it('should return a valid MCPServerConfig', () => {
      const config = filesystem({ root: '/data' })

      expect(config).toHaveProperty('search')
      expect(config).toHaveProperty('fetch')
      expect(config).toHaveProperty('do')
      expect(typeof config.search).toBe('function')
      expect(typeof config.fetch).toBe('function')
      expect(config.do).toHaveProperty('bindings')
      expect(config.do).toHaveProperty('types')
    })

    it('should accept root directory option', () => {
      const config = filesystem({ root: '/home/user/data' })

      expect(config).toBeDefined()
    })

    it('should accept client option', () => {
      const config = filesystem({ root: '/data', client: mockClient })

      expect(config).toBeDefined()
    })

    it('should accept readonly option', () => {
      const config = filesystem({ root: '/data', readonly: true })

      expect(config).toBeDefined()
    })

    it('should wire bindings correctly', () => {
      const config = filesystem({ root: '/data', client: mockClient })

      expect(config.do.bindings).toHaveProperty('search')
      expect(config.do.bindings).toHaveProperty('fetch')
      expect(config.do.bindings).toHaveProperty('fs')
      expect(typeof config.do.bindings.search).toBe('function')
      expect(typeof config.do.bindings.fetch).toBe('function')
      expect(typeof config.do.bindings.fs).toBe('object')
    })

    it('should include fs operations in bindings', () => {
      const config = filesystem({ root: '/data', client: mockClient })

      const fs = config.do.bindings.fs as Record<string, unknown>
      expect(fs).toHaveProperty('glob')
      expect(fs).toHaveProperty('read')
      expect(fs).toHaveProperty('write')
      expect(fs).toHaveProperty('mkdir')
      expect(fs).toHaveProperty('move')
    })

    it('should not include write operations when readonly', () => {
      const config = filesystem({ root: '/data', client: mockClient, readonly: true })

      const fs = config.do.bindings.fs as Record<string, unknown>
      expect(fs).toHaveProperty('glob')
      expect(fs).toHaveProperty('read')
      expect(fs).toHaveProperty('stat')
      expect(fs).not.toHaveProperty('write')
      expect(fs).not.toHaveProperty('mkdir')
      expect(fs).not.toHaveProperty('delete')
    })
  })

  describe('createFilesystemSearch()', () => {
    it('should return a search function', () => {
      const search = createFilesystemSearch({ root: '/data', client: mockClient })

      expect(typeof search).toBe('function')
    })

    it('should call client.glob with the search pattern', async () => {
      const search = createFilesystemSearch({ root: '/data', client: mockClient })
      await search('**/*.txt')

      expect(mockClient.glob).toHaveBeenCalledWith('**/*.txt')
    })

    it('should transform glob results to SearchResult format', async () => {
      const search = createFilesystemSearch({ root: '/data', client: mockClient })
      const results = await search('**/*.txt')

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('id')
      expect(results[0]).toHaveProperty('title')
    })

    it('should include file path in search results', async () => {
      const search = createFilesystemSearch({ root: '/data', client: mockClient })
      const results = await search('**/*.txt')

      expect(results[0].id).toContain('/data')
    })
  })

  describe('createFilesystemFetch()', () => {
    it('should return a fetch function', () => {
      const fetch = createFilesystemFetch({ root: '/data', client: mockClient })

      expect(typeof fetch).toBe('function')
    })

    it('should call client.read with the file path', async () => {
      const fetch = createFilesystemFetch({ root: '/data', client: mockClient })
      await fetch('/data/file.txt')

      expect(mockClient.read).toHaveBeenCalledWith('/data/file.txt')
    })

    it('should return FetchResult with content', async () => {
      const fetch = createFilesystemFetch({ root: '/data', client: mockClient })
      const result = await fetch('/data/file.txt')

      expect(result).toHaveProperty('content')
      expect(result.content).toBe('File content here')
    })

    it('should validate path is within root directory', async () => {
      const fetch = createFilesystemFetch({ root: '/data', client: mockClient })

      await expect(fetch('/etc/passwd')).rejects.toThrow()
    })

    it('should prevent path traversal attacks', async () => {
      const fetch = createFilesystemFetch({ root: '/data', client: mockClient })

      await expect(fetch('/data/../etc/passwd')).rejects.toThrow()
    })
  })

  describe('FILESYSTEM_TYPES', () => {
    it('should be a string', () => {
      expect(typeof FILESYSTEM_TYPES).toBe('string')
    })

    it('should contain search function declaration', () => {
      expect(FILESYSTEM_TYPES).toContain('search')
    })

    it('should contain fetch function declaration', () => {
      expect(FILESYSTEM_TYPES).toContain('fetch')
    })

    it('should contain fs object declaration', () => {
      expect(FILESYSTEM_TYPES).toContain('fs')
    })

    it('should contain file operations', () => {
      expect(FILESYSTEM_TYPES).toContain('glob')
      expect(FILESYSTEM_TYPES).toContain('read')
      expect(FILESYSTEM_TYPES).toContain('write')
      expect(FILESYSTEM_TYPES).toContain('mkdir')
    })
  })

  describe('integration', () => {
    it('should create a complete config usable with createMCPServer', () => {
      const config = filesystem({
        root: '/data',
        client: mockClient
      })

      expect(typeof config.search).toBe('function')
      expect(typeof config.fetch).toBe('function')
      expect(config.do.bindings).toBeDefined()
      expect(config.do.types).toBeDefined()
    })

    it('should allow searching files through the config', async () => {
      const config = filesystem({ root: '/data', client: mockClient })

      const results = await config.search('**/*.txt')
      expect(mockClient.glob).toHaveBeenCalled()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should allow reading files through the config', async () => {
      const config = filesystem({ root: '/data', client: mockClient })

      const result = await config.fetch('/data/file.txt')
      expect(mockClient.read).toHaveBeenCalled()
      expect(result).toHaveProperty('content')
    })
  })
})

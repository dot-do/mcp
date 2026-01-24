import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  git,
  createGitSearch,
  createGitFetch,
  GIT_TYPES,
  type GitTemplateOptions,
  type GitClient
} from '../../src/templates/git.js'
import type { MCPServerConfig } from '../../src/core/types.js'

describe('git template', () => {
  // Mock git client
  const mockClient: GitClient = {
    log: vi.fn().mockResolvedValue([
      { hash: 'abc123', author: 'Test User', date: new Date(), message: 'Initial commit' },
      { hash: 'def456', author: 'Test User', date: new Date(), message: 'Add feature' }
    ]),
    show: vi.fn().mockResolvedValue({
      hash: 'abc123',
      author: 'Test User',
      date: new Date(),
      message: 'Initial commit',
      diff: '+ added line\n- removed line'
    }),
    status: vi.fn().mockResolvedValue({
      staged: ['file1.ts'],
      modified: ['file2.ts'],
      untracked: ['file3.ts']
    }),
    diff: vi.fn().mockResolvedValue('diff output'),
    commit: vi.fn().mockResolvedValue({ hash: 'new123' }),
    branch: vi.fn().mockResolvedValue(['main', 'feature']),
    checkout: vi.fn().mockResolvedValue(undefined),
    merge: vi.fn().mockResolvedValue({ success: true }),
    add: vi.fn().mockResolvedValue(undefined)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('git()', () => {
    it('should return a valid MCPServerConfig', () => {
      const config = git({ repo: '/path/to/repo' })

      expect(config).toHaveProperty('search')
      expect(config).toHaveProperty('fetch')
      expect(config).toHaveProperty('do')
      expect(typeof config.search).toBe('function')
      expect(typeof config.fetch).toBe('function')
      expect(config.do).toHaveProperty('bindings')
      expect(config.do).toHaveProperty('types')
    })

    it('should accept repo path option', () => {
      const config = git({ repo: '/home/user/project' })

      expect(config).toBeDefined()
    })

    it('should accept client option', () => {
      const config = git({ repo: '/path/to/repo', client: mockClient })

      expect(config).toBeDefined()
    })

    it('should accept readonly option', () => {
      const config = git({ repo: '/path/to/repo', readonly: true })

      expect(config).toBeDefined()
    })

    it('should wire bindings correctly', () => {
      const config = git({ repo: '/path/to/repo', client: mockClient })

      expect(config.do.bindings).toHaveProperty('search')
      expect(config.do.bindings).toHaveProperty('fetch')
      expect(config.do.bindings).toHaveProperty('git')
      expect(typeof config.do.bindings.search).toBe('function')
      expect(typeof config.do.bindings.fetch).toBe('function')
      expect(typeof config.do.bindings.git).toBe('object')
    })

    it('should include git operations in bindings', () => {
      const config = git({ repo: '/path/to/repo', client: mockClient })

      const gitOps = config.do.bindings.git as Record<string, unknown>
      expect(gitOps).toHaveProperty('log')
      expect(gitOps).toHaveProperty('show')
      expect(gitOps).toHaveProperty('status')
      expect(gitOps).toHaveProperty('diff')
      expect(gitOps).toHaveProperty('commit')
      expect(gitOps).toHaveProperty('branch')
    })

    it('should not include write operations when readonly', () => {
      const config = git({ repo: '/path/to/repo', client: mockClient, readonly: true })

      const gitOps = config.do.bindings.git as Record<string, unknown>
      expect(gitOps).toHaveProperty('log')
      expect(gitOps).toHaveProperty('show')
      expect(gitOps).toHaveProperty('status')
      expect(gitOps).toHaveProperty('diff')
      expect(gitOps).not.toHaveProperty('commit')
      expect(gitOps).not.toHaveProperty('checkout')
      expect(gitOps).not.toHaveProperty('merge')
    })
  })

  describe('createGitSearch()', () => {
    it('should return a search function', () => {
      const search = createGitSearch({ repo: '/path/to/repo', client: mockClient })

      expect(typeof search).toBe('function')
    })

    it('should call client.log with the search query', async () => {
      const search = createGitSearch({ repo: '/path/to/repo', client: mockClient })
      await search('--author=Test')

      expect(mockClient.log).toHaveBeenCalledWith('--author=Test')
    })

    it('should transform log results to SearchResult format', async () => {
      const search = createGitSearch({ repo: '/path/to/repo', client: mockClient })
      const results = await search('--all')

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('id')
      expect(results[0]).toHaveProperty('title')
    })

    it('should use commit hash as id', async () => {
      const search = createGitSearch({ repo: '/path/to/repo', client: mockClient })
      const results = await search('--all')

      expect(results[0].id).toBe('abc123')
    })
  })

  describe('createGitFetch()', () => {
    it('should return a fetch function', () => {
      const fetch = createGitFetch({ repo: '/path/to/repo', client: mockClient })

      expect(typeof fetch).toBe('function')
    })

    it('should call client.show with commit hash', async () => {
      const fetch = createGitFetch({ repo: '/path/to/repo', client: mockClient })
      await fetch('abc123')

      expect(mockClient.show).toHaveBeenCalledWith('abc123')
    })

    it('should return FetchResult with content', async () => {
      const fetch = createGitFetch({ repo: '/path/to/repo', client: mockClient })
      const result = await fetch('abc123')

      expect(result).toHaveProperty('content')
      expect(typeof result.content).toBe('string')
    })

    it('should include commit details in content', async () => {
      const fetch = createGitFetch({ repo: '/path/to/repo', client: mockClient })
      const result = await fetch('abc123')

      expect(result.content).toContain('Initial commit')
    })
  })

  describe('GIT_TYPES', () => {
    it('should be a string', () => {
      expect(typeof GIT_TYPES).toBe('string')
    })

    it('should contain search function declaration', () => {
      expect(GIT_TYPES).toContain('search')
    })

    it('should contain fetch function declaration', () => {
      expect(GIT_TYPES).toContain('fetch')
    })

    it('should contain git object declaration', () => {
      expect(GIT_TYPES).toContain('git')
    })

    it('should contain git operations', () => {
      expect(GIT_TYPES).toContain('log')
      expect(GIT_TYPES).toContain('show')
      expect(GIT_TYPES).toContain('commit')
      expect(GIT_TYPES).toContain('branch')
    })
  })

  describe('integration', () => {
    it('should create a complete config usable with createMCPServer', () => {
      const config = git({
        repo: '/path/to/repo',
        client: mockClient
      })

      expect(typeof config.search).toBe('function')
      expect(typeof config.fetch).toBe('function')
      expect(config.do.bindings).toBeDefined()
      expect(config.do.types).toBeDefined()
    })

    it('should allow searching commits through the config', async () => {
      const config = git({ repo: '/path/to/repo', client: mockClient })

      const results = await config.search('--all')
      expect(mockClient.log).toHaveBeenCalled()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should allow fetching commits through the config', async () => {
      const config = git({ repo: '/path/to/repo', client: mockClient })

      const result = await config.fetch('abc123')
      expect(mockClient.show).toHaveBeenCalled()
      expect(result).toHaveProperty('content')
    })
  })
})

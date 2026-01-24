/**
 * Git Template
 *
 * Pre-built configuration for git agents.
 * Provides commit log search, commit fetch, and git operations.
 */

import type { MCPServerConfig, SearchResult, FetchResult, DoScope } from '@dotdo/mcp'

/**
 * Git commit information
 */
export interface GitCommit {
  hash: string
  author: string
  date: Date
  message: string
  diff?: string
}

/**
 * Git status information
 */
export interface GitStatus {
  staged: string[]
  modified: string[]
  untracked: string[]
}

/**
 * Git merge result
 */
export interface GitMergeResult {
  success: boolean
  conflicts?: string[]
}

/**
 * Git client interface that templates expect
 */
export interface GitClient {
  /** Search commit history */
  log: (query: string) => Promise<GitCommit[]>
  /** Get a specific commit */
  show: (hash: string) => Promise<GitCommit>
  /** Get repository status */
  status: () => Promise<GitStatus>
  /** Get diff */
  diff: (target?: string) => Promise<string>
  /** Create a commit */
  commit: (message: string) => Promise<{ hash: string }>
  /** List branches */
  branch: () => Promise<string[]>
  /** Checkout a branch */
  checkout: (target: string) => Promise<void>
  /** Merge a branch */
  merge: (branch: string) => Promise<GitMergeResult>
  /** Stage files */
  add: (paths: string[]) => Promise<void>
}

/**
 * Options for configuring the git template
 */
export interface GitTemplateOptions {
  /** Path to the git repository */
  repo: string
  /** Optional git client (defaults to a mock implementation) */
  client?: GitClient
  /** If true, only allow read operations */
  readonly?: boolean
}

/**
 * Type definitions for git template bindings
 */
export const GIT_TYPES = `
/**
 * Search result from git log
 */
interface SearchResult {
  id: string;
  title: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result from fetching a commit
 */
interface FetchResult {
  content: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Git commit information
 */
interface GitCommit {
  hash: string;
  author: string;
  date: Date;
  message: string;
  diff?: string;
}

/**
 * Git status information
 */
interface GitStatus {
  staged: string[];
  modified: string[];
  untracked: string[];
}

/**
 * Search git commit history
 * @param query - Git log query (e.g., "--author=Name", "--since=2024-01-01")
 * @returns Promise resolving to array of commit search results
 */
declare function search(query: string): Promise<SearchResult[]>;

/**
 * Fetch a specific commit
 * @param hash - Commit hash
 * @returns Promise resolving to commit content
 */
declare function fetch(hash: string): Promise<FetchResult>;

/**
 * Git operations
 */
declare const git: {
  /**
   * Search commit history
   * @param query - Git log query
   * @returns Promise resolving to array of commits
   */
  log(query: string): Promise<GitCommit[]>;

  /**
   * Get a specific commit
   * @param hash - Commit hash
   * @returns Promise resolving to commit details
   */
  show(hash: string): Promise<GitCommit>;

  /**
   * Get repository status
   * @returns Promise resolving to status with staged, modified, and untracked files
   */
  status(): Promise<GitStatus>;

  /**
   * Get diff
   * @param target - Optional target (file, commit, or branch)
   * @returns Promise resolving to diff output
   */
  diff(target?: string): Promise<string>;

  /**
   * Create a commit
   * @param message - Commit message
   * @returns Promise resolving to new commit hash
   */
  commit(message: string): Promise<{ hash: string }>;

  /**
   * List branches
   * @returns Promise resolving to array of branch names
   */
  branch(): Promise<string[]>;

  /**
   * Checkout a branch or commit
   * @param target - Branch name or commit hash
   */
  checkout(target: string): Promise<void>;

  /**
   * Merge a branch
   * @param branch - Branch name to merge
   * @returns Promise resolving to merge result
   */
  merge(branch: string): Promise<{ success: boolean; conflicts?: string[] }>;

  /**
   * Stage files
   * @param paths - Array of file paths to stage
   */
  add(paths: string[]): Promise<void>;
};
`

/**
 * Default mock git client for testing
 */
function createMockGitClient(): GitClient {
  return {
    log: async () => [
      { hash: 'mock123', author: 'Mock User', date: new Date(), message: 'Mock commit' }
    ],
    show: async (hash: string) => ({
      hash,
      author: 'Mock User',
      date: new Date(),
      message: 'Mock commit',
      diff: 'Mock diff'
    }),
    status: async () => ({
      staged: [],
      modified: [],
      untracked: []
    }),
    diff: async () => '',
    commit: async () => ({ hash: 'newmock' }),
    branch: async () => ['main'],
    checkout: async () => {},
    merge: async () => ({ success: true }),
    add: async () => {}
  }
}

/**
 * Create a git search function
 */
export function createGitSearch(
  options: GitTemplateOptions
): (query: string) => Promise<SearchResult[]> {
  const { client = createMockGitClient() } = options

  return async (query: string): Promise<SearchResult[]> => {
    const commits = await client.log(query)

    return commits.map(commit => ({
      id: commit.hash,
      title: commit.message.split('\n')[0],
      snippet: `${commit.author} - ${commit.date.toISOString()}`,
      metadata: {
        hash: commit.hash,
        author: commit.author,
        date: commit.date
      }
    }))
  }
}

/**
 * Create a git fetch function
 */
export function createGitFetch(
  options: GitTemplateOptions
): (hash: string) => Promise<FetchResult> {
  const { client = createMockGitClient() } = options

  return async (hash: string): Promise<FetchResult> => {
    const commit = await client.show(hash)

    const content = [
      `Commit: ${commit.hash}`,
      `Author: ${commit.author}`,
      `Date: ${commit.date.toISOString()}`,
      '',
      commit.message,
      '',
      '---',
      commit.diff || ''
    ].join('\n')

    return {
      content,
      contentType: 'text/plain',
      metadata: {
        hash: commit.hash,
        author: commit.author,
        date: commit.date
      }
    }
  }
}

/**
 * Create git operations object
 */
function createGitOperations(
  client: GitClient,
  readonly: boolean
): Record<string, unknown> {
  const readOps = {
    log: client.log.bind(client),
    show: client.show.bind(client),
    status: client.status.bind(client),
    diff: client.diff.bind(client),
    branch: client.branch.bind(client)
  }

  if (readonly) {
    return readOps
  }

  return {
    ...readOps,
    commit: client.commit.bind(client),
    checkout: client.checkout.bind(client),
    merge: client.merge.bind(client),
    add: client.add.bind(client)
  }
}

/**
 * Create a git template configuration
 *
 * @param options - Configuration options
 * @returns MCPServerConfig for git operations
 *
 * @example
 * ```typescript
 * const config = git({
 *   repo: '/path/to/repo',
 *   readonly: false
 * })
 * ```
 */
export function git(options: GitTemplateOptions): MCPServerConfig {
  const { client = createMockGitClient(), readonly = false } = options

  const search = createGitSearch({ ...options, client })
  const fetch = createGitFetch({ ...options, client })
  const gitOps = createGitOperations(client, readonly)

  const doScope: DoScope = {
    bindings: {
      search,
      fetch,
      git: gitOps
    },
    types: GIT_TYPES
  }

  return {
    search,
    fetch,
    do: doScope
  }
}

export default git

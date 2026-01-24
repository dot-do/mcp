/**
 * Git Template
 *
 * Pre-built scope for git operations.
 */

import type { DoScope } from '../scope/types.js'

/**
 * Git interface for sandbox operations
 */
export interface GitInterface {
  /** Get git status */
  status: () => Promise<{ modified: string[]; staged: string[]; untracked: string[] }>
  /** Get git log */
  log: (limit?: number) => Promise<Array<{ hash: string; message: string; author: string; date: string }>>
  /** Get diff for a file or all files */
  diff: (path?: string) => Promise<string>
  /** Stage files */
  add: (paths: string[]) => Promise<void>
  /** Create a commit */
  commit: (message: string) => Promise<{ hash: string }>
  /** Get current branch */
  branch: () => Promise<string>
}

/**
 * Git template options
 */
export interface GitTemplateOptions {
  /** Git interface implementation */
  git: GitInterface
  /** Whether to allow write operations (commit, add) */
  allowWrites?: boolean
  /** Timeout for git operations in ms */
  timeout?: number
}

/**
 * Type definitions for the git scope
 */
const GIT_TYPES = `
/**
 * Get the current git status
 * @returns Object with modified, staged, and untracked file lists
 */
declare function status(): Promise<{ modified: string[]; staged: string[]; untracked: string[] }>;

/**
 * Get commit history
 * @param limit - Maximum number of commits to return (default: 10)
 * @returns Array of commit objects with hash, message, author, and date
 */
declare function log(limit?: number): Promise<Array<{ hash: string; message: string; author: string; date: string }>>;

/**
 * Get diff output
 * @param path - Optional path to get diff for specific file
 * @returns Diff output as a string
 */
declare function diff(path?: string): Promise<string>;

/**
 * Stage files for commit
 * @param paths - Array of file paths to stage
 */
declare function add(paths: string[]): Promise<void>;

/**
 * Create a commit with the staged changes
 * @param message - Commit message
 * @returns Object with the new commit hash
 */
declare function commit(message: string): Promise<{ hash: string }>;

/**
 * Get the current branch name
 * @returns Current branch name
 */
declare function branch(): Promise<string>;
`

/**
 * Create a git scope template
 *
 * @param options - Git template options
 * @returns DoScope configured for git operations
 */
export function createGitTemplate(options: GitTemplateOptions): DoScope {
  const bindings: Record<string, unknown> = {
    status: options.git.status,
    log: options.git.log,
    diff: options.git.diff,
    branch: options.git.branch,
  }

  if (options.allowWrites !== false) {
    bindings.add = options.git.add
    bindings.commit = options.git.commit
  }

  return {
    bindings,
    types: GIT_TYPES,
    timeout: options.timeout ?? 30000,
    permissions: {
      allowNetwork: false,
    },
  }
}

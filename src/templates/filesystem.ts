/**
 * Filesystem Template
 *
 * Pre-built configuration for filesystem agents.
 * Provides glob search, file read, and file operations.
 */

import type { MCPServerConfig, SearchResult, FetchResult, DoScope } from '@dotdo/mcp'

/**
 * File stats returned by stat operation
 */
export interface FileStat {
  size: number
  isFile: boolean
  isDirectory: boolean
  mtime: Date
}

/**
 * Filesystem client interface that templates expect
 */
export interface FilesystemClient {
  /** Search for files matching a glob pattern */
  glob: (pattern: string) => Promise<string[]>
  /** Read file contents */
  read: (path: string) => Promise<string>
  /** Write file contents */
  write: (path: string, content: string) => Promise<void>
  /** Create a directory */
  mkdir: (path: string) => Promise<void>
  /** Move/rename a file */
  move: (from: string, to: string) => Promise<void>
  /** Copy a file */
  copy: (from: string, to: string) => Promise<void>
  /** Delete a file or directory */
  delete: (path: string) => Promise<void>
  /** Get file stats */
  stat: (path: string) => Promise<FileStat>
}

/**
 * Options for configuring the filesystem template
 */
export interface FilesystemTemplateOptions {
  /** Root directory - all operations are restricted to this directory */
  root: string
  /** Optional filesystem client (defaults to a mock implementation) */
  client?: FilesystemClient
  /** If true, only allow read operations */
  readonly?: boolean
}

/**
 * Type definitions for filesystem template bindings
 */
export const FILESYSTEM_TYPES = `
/**
 * Search result from filesystem glob
 */
interface SearchResult {
  id: string;
  title: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result from fetching a file
 */
interface FetchResult {
  content: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * File statistics
 */
interface FileStat {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtime: Date;
}

/**
 * Search for files matching a glob pattern
 * @param pattern - Glob pattern (e.g., "**/*.txt")
 * @returns Promise resolving to array of matching file paths
 */
declare function search(pattern: string): Promise<SearchResult[]>;

/**
 * Fetch file contents
 * @param path - Path to the file
 * @returns Promise resolving to file content
 */
declare function fetch(path: string): Promise<FetchResult>;

/**
 * Filesystem operations
 */
declare const fs: {
  /**
   * Search for files matching a glob pattern
   * @param pattern - Glob pattern
   * @returns Promise resolving to array of file paths
   */
  glob(pattern: string): Promise<string[]>;

  /**
   * Read file contents
   * @param path - Path to the file
   * @returns Promise resolving to file content as string
   */
  read(path: string): Promise<string>;

  /**
   * Write content to a file
   * @param path - Path to the file
   * @param content - Content to write
   */
  write(path: string, content: string): Promise<void>;

  /**
   * Create a directory
   * @param path - Path for the new directory
   */
  mkdir(path: string): Promise<void>;

  /**
   * Move/rename a file or directory
   * @param from - Source path
   * @param to - Destination path
   */
  move(from: string, to: string): Promise<void>;

  /**
   * Copy a file
   * @param from - Source path
   * @param to - Destination path
   */
  copy(from: string, to: string): Promise<void>;

  /**
   * Delete a file or directory
   * @param path - Path to delete
   */
  delete(path: string): Promise<void>;

  /**
   * Get file statistics
   * @param path - Path to the file
   * @returns Promise resolving to file stats
   */
  stat(path: string): Promise<FileStat>;
};
`

/**
 * Default mock filesystem client for testing
 */
function createMockFilesystemClient(): FilesystemClient {
  return {
    glob: async (pattern: string) => [`/mock/${pattern.replace('**/*', 'file')}`],
    read: async () => 'Mock file content',
    write: async () => {},
    mkdir: async () => {},
    move: async () => {},
    copy: async () => {},
    delete: async () => {},
    stat: async () => ({
      size: 0,
      isFile: true,
      isDirectory: false,
      mtime: new Date()
    })
  }
}

/**
 * Normalize and validate a path against the root directory
 */
function normalizePath(path: string, root: string): string {
  // Normalize both paths
  const normalizedRoot = root.replace(/\/$/, '')
  const normalizedPath = path.replace(/\/$/, '')

  // Check for path traversal
  if (normalizedPath.includes('..')) {
    // Resolve the path to check if it escapes root
    const parts = normalizedPath.split('/')
    const resolved: string[] = []

    for (const part of parts) {
      if (part === '..') {
        resolved.pop()
      } else if (part !== '.' && part !== '') {
        resolved.push(part)
      }
    }

    const resolvedPath = '/' + resolved.join('/')

    if (!resolvedPath.startsWith(normalizedRoot)) {
      throw new Error(`Path "${path}" is outside root directory "${root}"`)
    }

    return resolvedPath
  }

  // Check if path is within root
  if (!normalizedPath.startsWith(normalizedRoot)) {
    throw new Error(`Path "${path}" is outside root directory "${root}"`)
  }

  return normalizedPath
}

/**
 * Get content type based on file extension
 */
function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()

  const contentTypes: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    js: 'application/javascript',
    ts: 'application/typescript',
    html: 'text/html',
    css: 'text/css',
    xml: 'application/xml',
    yaml: 'application/yaml',
    yml: 'application/yaml'
  }

  return contentTypes[ext || ''] || 'application/octet-stream'
}

/**
 * Create a filesystem search function
 */
export function createFilesystemSearch(
  options: FilesystemTemplateOptions
): (pattern: string) => Promise<SearchResult[]> {
  const { client = createMockFilesystemClient() } = options

  return async (pattern: string): Promise<SearchResult[]> => {
    const paths = await client.glob(pattern)

    return paths.map((path, index) => ({
      id: path,
      title: path.split('/').pop() || path,
      snippet: `File: ${path}`,
      metadata: {
        path,
        index
      }
    }))
  }
}

/**
 * Create a filesystem fetch function with path validation
 */
export function createFilesystemFetch(
  options: FilesystemTemplateOptions
): (path: string) => Promise<FetchResult> {
  const { root, client = createMockFilesystemClient() } = options

  return async (path: string): Promise<FetchResult> => {
    // Validate and normalize the path
    const normalizedPath = normalizePath(path, root)

    const content = await client.read(normalizedPath)

    return {
      content,
      contentType: getContentType(normalizedPath),
      metadata: {
        path: normalizedPath
      }
    }
  }
}

/**
 * Create filesystem operations object with path validation
 */
function createFilesystemOperations(
  root: string,
  client: FilesystemClient,
  readonly: boolean
): Record<string, unknown> {
  // Helper to validate paths for operations
  const validatePath = (path: string) => normalizePath(path, root)

  const readOps = {
    glob: client.glob.bind(client),
    read: async (path: string) => {
      validatePath(path)
      return client.read(path)
    },
    stat: async (path: string) => {
      validatePath(path)
      return client.stat(path)
    }
  }

  if (readonly) {
    return readOps
  }

  return {
    ...readOps,
    write: async (path: string, content: string) => {
      validatePath(path)
      return client.write(path, content)
    },
    mkdir: async (path: string) => {
      validatePath(path)
      return client.mkdir(path)
    },
    move: async (from: string, to: string) => {
      validatePath(from)
      validatePath(to)
      return client.move(from, to)
    },
    copy: async (from: string, to: string) => {
      validatePath(from)
      validatePath(to)
      return client.copy(from, to)
    },
    delete: async (path: string) => {
      validatePath(path)
      return client.delete(path)
    }
  }
}

/**
 * Create a filesystem template configuration
 *
 * @param options - Configuration options
 * @returns MCPServerConfig for filesystem operations
 *
 * @example
 * ```typescript
 * const config = filesystem({
 *   root: '/data',
 *   readonly: false
 * })
 * ```
 */
export function filesystem(options: FilesystemTemplateOptions): MCPServerConfig {
  const { root, client = createMockFilesystemClient(), readonly = false } = options

  const search = createFilesystemSearch({ ...options, client })
  const fetch = createFilesystemFetch({ ...options, client })
  const fs = createFilesystemOperations(root, client, readonly)

  const doScope: DoScope = {
    bindings: {
      search,
      fetch,
      fs
    },
    types: FILESYSTEM_TYPES
  }

  return {
    search,
    fetch,
    do: doScope
  }
}

export default filesystem

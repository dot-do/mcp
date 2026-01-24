/**
 * Templates Module
 *
 * Pre-built configurations for common MCP server use cases.
 * Each template provides search, fetch, and do scope bindings
 * tailored to a specific domain.
 */

// Export individual template functions and types
export {
  web,
  createWebSearch,
  createHttpFetch,
  WEB_TYPES,
  type WebTemplateOptions
} from './web.js'

export {
  database,
  createDatabaseSearch,
  createDatabaseFetch,
  DATABASE_TYPES,
  type DatabaseTemplateOptions,
  type DatabaseClient,
  type SchemaDefinition
} from './database.js'

export {
  filesystem,
  createFilesystemSearch,
  createFilesystemFetch,
  FILESYSTEM_TYPES,
  type FilesystemTemplateOptions,
  type FilesystemClient,
  type FileStat
} from './filesystem.js'

export {
  git,
  createGitSearch,
  createGitFetch,
  GIT_TYPES,
  type GitTemplateOptions,
  type GitClient,
  type GitCommit,
  type GitStatus,
  type GitMergeResult
} from './git.js'

export {
  memory,
  createMemorySearch,
  createMemoryFetch,
  createInMemoryStore,
  MEMORY_TYPES,
  type MemoryTemplateOptions,
  type MemoryStore,
  type Entity,
  type Relation,
  type Observation
} from './memory.js'

// Re-import for namespace export
import { web } from './web.js'
import { database } from './database.js'
import { filesystem } from './filesystem.js'
import { git } from './git.js'
import { memory } from './memory.js'

/**
 * Template namespace for convenient access
 *
 * @example
 * ```typescript
 * import { templates } from 'mcp.do'
 *
 * const server = createMCPServer(templates.web({
 *   searchProvider: 'brave',
 *   apiKey: process.env.BRAVE_API_KEY
 * }))
 * ```
 */
export const templates = {
  /**
   * Web research template
   * Provides web search and HTTP fetch capabilities
   */
  web,

  /**
   * Database template
   * Provides SQL query and record CRUD operations
   */
  database,

  /**
   * Filesystem template
   * Provides glob search and file operations
   */
  filesystem,

  /**
   * Git repository template
   * Provides commit search and git operations
   */
  git,

  /**
   * Memory / knowledge graph template
   * Provides entity, relation, and observation management
   */
  memory
}

export default templates

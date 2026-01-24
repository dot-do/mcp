/**
 * Tools Module
 *
 * Exports the three core MCP tools: search, fetch, and do.
 * Also exports the tool registration helper and binding proxy.
 */

// Search tool
export {
  searchTool,
  createSearchHandler,
  type SearchInput
} from './search.js'

// Fetch tool
export {
  fetchTool,
  createFetchHandler,
  type FetchInput
} from './fetch.js'

// Do tool
export {
  doTool,
  createDoHandler,
  executeDo,
  createDoTool,
  type DoInput,
  type DoResult,
  type DoError,
  type DoOptions,
  type LegacyDoResult
} from './do.js'

// Binding proxy
export {
  createBindingProxy,
  wrapBinding,
  serializeValue,
  deserializeValue,
  createSerializedBinding,
  type WrappedBinding,
  type BindingProxy
} from './binding.js'

// Tool registration
export {
  createToolRegistry,
  registerTools,
  getToolDefinitions,
  createToolCallHandler,
  type Tool,
  type ToolHandler,
  type ToolRegistry,
  type ToolsConfig
} from './registration.js'

// Re-export ToolResponse from search (most complete version)
export type { ToolResponse } from './search.js'

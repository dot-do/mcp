/// <reference types="node" />
/**
 * Node.js Sandbox Evaluator
 *
 * Implements the same EvaluateResult interface as the Cloudflare sandbox
 * but uses Node.js `vm` module for execution. This enables @dotdo/mcp
 * to run in both Cloudflare Workers and Node.js environments.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import vm from 'node:vm'
import type { EvaluateResult, LogEntry } from 'ai-evaluate'

export interface NodeEvaluateOptions {
  /** Script code to execute */
  script: string
  /** Module code that runs first — exports become globals */
  module?: string
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Bindings to inject as globals in the sandbox */
  bindings?: Record<string, unknown>
  /** Set to null to block network access (not enforced in Node.js vm — advisory only) */
  fetch?: null
}

/**
 * Evaluate code in a Node.js vm sandbox with bindings support.
 *
 * Compatible with @dotdo/mcp's EvaluateResult interface so consumers
 * can swap between Cloudflare and Node.js runtimes transparently.
 *
 * @example
 * ```ts
 * const result = await evaluateNode({
 *   script: 'const items = await github.listIssues(); return items.length',
 *   bindings: {
 *     github: { listIssues: async () => [...] },
 *   },
 *   timeout: 30_000,
 * })
 * ```
 */
export async function evaluateNode(options: NodeEvaluateOptions): Promise<EvaluateResult> {
  const start = Date.now()
  const logs: LogEntry[] = []

  // Build captured console
  const format = (...args: unknown[]) =>
    args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' ')

  const capturedConsole = {
    log: (...args: unknown[]) => logs.push({ level: 'log', message: format(...args), timestamp: Date.now() }),
    warn: (...args: unknown[]) => logs.push({ level: 'warn', message: format(...args), timestamp: Date.now() }),
    error: (...args: unknown[]) => logs.push({ level: 'error', message: format(...args), timestamp: Date.now() }),
    info: (...args: unknown[]) => logs.push({ level: 'info', message: format(...args), timestamp: Date.now() }),
    debug: (...args: unknown[]) => logs.push({ level: 'debug', message: format(...args), timestamp: Date.now() }),
  }

  // Build context: bindings + standard globals + captured console
  const context: Record<string, unknown> = {
    ...options.bindings,
    console: capturedConsole,
    fetch: options.fetch === null ? undefined : globalThis.fetch,
    JSON,
    Date,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    Error,
    TypeError,
    RangeError,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    setTimeout,
    clearTimeout,
    crypto: (globalThis as Record<string, unknown>).crypto,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Buffer: (globalThis as Record<string, unknown>).Buffer,
    undefined,
  }

  try {
    const vmContext = vm.createContext(context)

    // Run module code first if provided — its side effects set up globals
    if (options.module) {
      const moduleScript = new vm.Script(options.module, { filename: 'module.js' })
      moduleScript.runInContext(vmContext, { timeout: options.timeout ?? 30_000 })
    }

    // Wrap user script in async IIFE for top-level await
    const wrapped = `(async () => {\n${options.script}\n})()`
    const script = new vm.Script(wrapped, { filename: 'do.ts' })
    const value = await script.runInContext(vmContext, { timeout: options.timeout ?? 30_000 })

    return {
      success: true,
      value,
      logs,
      duration: Date.now() - start,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      logs,
      duration: Date.now() - start,
    }
  }
}

/**
 * Create an evaluateNode function bound to default options.
 */
export function createNodeEvaluator(defaults: Partial<NodeEvaluateOptions> = {}) {
  return (options: NodeEvaluateOptions) =>
    evaluateNode({ ...defaults, ...options })
}

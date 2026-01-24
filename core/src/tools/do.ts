/**
 * Do Tool
 *
 * MCP tool for executing code in a sandboxed V8 environment using ai-evaluate.
 * Provides access to configured bindings while maintaining security.
 *
 * Requires the worker_loaders binding (LOADER) to be configured in wrangler.
 * In production, ai-evaluate spawns isolated V8 sub-workers for each execution.
 */

import { evaluate } from 'ai-evaluate'
import type { SandboxEnv } from 'ai-evaluate'
import type { DoScope } from '../scope/types.js'

// Re-export SandboxEnv for consumers
export type { SandboxEnv }

/**
 * Tool definition for the do tool
 */
export const doTool = {
  name: 'do',
  description: 'Execute code in a sandboxed environment with access to configured bindings',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'TypeScript/JavaScript code to execute' }
    },
    required: ['code']
  }
} as const

/**
 * Input parameters for the do handler
 */
export interface DoInput {
  code: string
}

/**
 * MCP tool response format
 */
export interface ToolResponse {
  content: Array<{ type: string; text: string }>
  isError?: boolean
}

/**
 * Result from the do tool execution
 */
export interface DoResult {
  success: boolean
  value?: unknown
  logs: Array<{ level: string; message: string; timestamp: number }>
  error?: string
  duration: number
}

/**
 * Legacy result interface (for backwards compatibility)
 */
export interface LegacyDoResult {
  result: unknown
  console: string[]
  executionTime: number
}

/**
 * Legacy error interface (for backwards compatibility)
 */
export interface DoError {
  message: string
  stack?: string
  line?: number
  column?: number
}

/**
 * Legacy options interface (for backwards compatibility)
 */
export interface DoOptions {
  code: string
  scope: DoScope
}

/**
 * Creates a do handler function that executes code in a sandboxed environment
 *
 * Uses ai-evaluate with the worker_loaders binding (LOADER) to spawn isolated
 * V8 sub-workers for secure code execution.
 *
 * - In Cloudflare Workers: Pass env with LOADER binding (from cloudflare:workers)
 * - In Node.js/testing: ai-evaluate falls back to Miniflare automatically
 *
 * @param scope - The DoScope configuration with bindings and types
 * @param env - Optional worker environment with LOADER binding
 * @returns Handler function for the do tool
 */
export function createDoHandler(
  scope: DoScope,
  env?: SandboxEnv
): (input: DoInput) => Promise<ToolResponse> {
  return async (input: DoInput): Promise<ToolResponse> => {
    try {
      // ai-evaluate uses LOADER if available, falls back to Miniflare in Node.js
      const result = await evaluate({
        script: input.code,
        timeout: scope.timeout,
        fetch: scope.permissions?.allowNetwork ? undefined : null, // Block network unless allowed
        rpc: scope.bindings, // Pass domain bindings via RPC
      }, env)

      const doResult: DoResult = {
        success: result.success,
        value: result.value,
        logs: result.logs || [],
        duration: result.duration
      }

      if (!result.success && result.error) {
        doResult.error = result.error
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(doResult, null, 2)
          }
        ],
        isError: !result.success
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage })
          }
        ],
        isError: true
      }
    }
  }
}

/**
 * Options for executeDo with optional environment
 */
export interface DoOptionsWithEnv extends DoOptions {
  env?: SandboxEnv
}

/**
 * Execute code in a sandboxed environment (legacy API)
 *
 * @deprecated Use createDoHandler instead. This is kept for backward compatibility.
 * @param options - The code, scope, and optional env to execute with
 * @returns Result of the execution or error
 */
export async function executeDo(options: DoOptionsWithEnv): Promise<LegacyDoResult | DoError> {
  const { code, scope, env } = options
  const startTime = Date.now()

  try {
    // ai-evaluate uses LOADER if available, falls back to Miniflare in Node.js
    const result = await evaluate({
      script: code,
      timeout: scope.timeout,
      fetch: scope.permissions?.allowNetwork ? undefined : null,
      rpc: scope.bindings,
    }, env)

    // Convert to legacy format
    const consoleOutput = result.logs?.map(log =>
      log.level === 'log' ? log.message : `[${log.level.toUpperCase()}] ${log.message}`
    ) || []

    return {
      result: result.value,
      console: consoleOutput,
      executionTime: Date.now() - startTime
    }
  } catch (error) {
    const err = error as Error
    return {
      message: err.message,
      stack: err.stack,
      line: undefined,
      column: undefined
    }
  }
}

/**
 * Create a do tool handler (legacy API)
 * @deprecated Use createDoHandler instead
 */
export function createDoTool(scope: DoScope, env: SandboxEnv) {
  return async (code: string): Promise<LegacyDoResult | DoError> => {
    return executeDo({ code, scope, env })
  }
}

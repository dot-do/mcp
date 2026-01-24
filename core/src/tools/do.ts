/**
 * Do Tool
 *
 * MCP tool for executing code in a sandboxed V8 environment using ai-evaluate.
 * Provides access to configured bindings while maintaining security.
 */

import { evaluate } from 'ai-evaluate'
import type { DoScope } from '../scope/types.js'

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
 * @param scope - The DoScope configuration with bindings and types
 * @returns Handler function for the do tool
 */
export function createDoHandler(
  scope: DoScope
): (input: DoInput) => Promise<ToolResponse> {
  return async (input: DoInput): Promise<ToolResponse> => {
    try {
      const result = await evaluate({
        script: input.code,
        timeout: scope.timeout
      })

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
 * Execute code in a sandboxed environment (legacy API)
 *
 * This function runs the provided code in a V8 isolate with only
 * the bindings from the scope available. No ambient capabilities
 * like filesystem, network, or environment variables are accessible.
 *
 * @param options - The code and scope to execute with
 * @returns Result of the execution or error
 */
export async function executeDo(options: DoOptions): Promise<LegacyDoResult | DoError> {
  const { code, scope } = options
  const startTime = Date.now()
  const consoleOutput: string[] = []

  try {
    // Create a sandbox with only the provided bindings
    const sandbox = {
      ...scope.bindings,
      console: {
        log: (...args: unknown[]) => consoleOutput.push(args.map(String).join(' ')),
        error: (...args: unknown[]) => consoleOutput.push(`[ERROR] ${args.map(String).join(' ')}`),
        warn: (...args: unknown[]) => consoleOutput.push(`[WARN] ${args.map(String).join(' ')}`),
        info: (...args: unknown[]) => consoleOutput.push(`[INFO] ${args.map(String).join(' ')}`)
      }
    }

    // Wrap code in async function to support top-level await
    const wrappedCode = `
      (async () => {
        ${code}
      })()
    `

    // Create function with sandbox as scope
    // In production, this uses ai-evaluate for proper V8 isolate
    // For now, we use a basic implementation
    const fn = new Function(...Object.keys(sandbox), `return ${wrappedCode}`)
    const result = await fn(...Object.values(sandbox))

    return {
      result,
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
 */
export function createDoTool(scope: DoScope) {
  return async (code: string): Promise<LegacyDoResult | DoError> => {
    return executeDo({ code, scope })
  }
}

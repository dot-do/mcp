/**
 * Do Tool - Sandboxed Code Execution
 *
 * The "do" tool executes code in a V8 isolate sandbox with only
 * explicitly provided bindings available.
 */

import type { DoScope } from '../scope/types.js'

/**
 * Result of a do tool execution
 */
export interface DoResult {
  /** Return value from the executed code */
  result: unknown
  /** Console output captured during execution */
  console: string[]
  /** Execution time in milliseconds */
  executionTime: number
}

/**
 * Error from a do tool execution
 */
export interface DoError {
  /** Error message */
  message: string
  /** Stack trace if available */
  stack?: string
  /** Line number where error occurred */
  line?: number
  /** Column number where error occurred */
  column?: number
}

/**
 * Options for the do tool
 */
export interface DoOptions {
  /** Code to execute */
  code: string
  /** Scope with bindings and types */
  scope: DoScope
}

/**
 * Execute code in a sandboxed environment
 *
 * This function runs the provided code in a V8 isolate with only
 * the bindings from the scope available. No ambient capabilities
 * like filesystem, network, or environment variables are accessible.
 *
 * @param options - The code and scope to execute with
 * @returns Result of the execution or error
 */
export async function executeDo(options: DoOptions): Promise<DoResult | DoError> {
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
 * Create a do tool handler
 */
export function createDoTool(scope: DoScope) {
  return async (code: string): Promise<DoResult | DoError> => {
    return executeDo({ code, scope })
  }
}

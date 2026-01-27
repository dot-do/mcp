/**
 * Sandbox Evaluator with Service Bindings Support
 *
 * Wraps ai-evaluate to add support for passing service bindings
 * to the dynamically loaded sandbox worker via Workers RPC.
 */

import type { EvaluateOptions as BaseEvaluateOptions, EvaluateResult, LogEntry } from 'ai-evaluate'

// Re-export base types
export type { EvaluateResult, LogEntry }

/**
 * Extended evaluate options with service bindings support
 */
export interface EvaluateOptions extends Omit<BaseEvaluateOptions, 'env'> {
  /** Environment variables (strings only) */
  env?: Record<string, string>
  /** Service bindings to pass to the sandbox (for Workers RPC) */
  bindings?: Record<string, unknown>
}

/**
 * Worker loader binding type
 */
interface WorkerLoader {
  get(id: string, loader: () => Promise<WorkerCode>): WorkerStub
}

/**
 * Worker code configuration
 */
interface WorkerCode {
  mainModule: string
  modules: Record<string, string | { js?: string; cjs?: string; text?: string; json?: unknown }>
  compatibilityDate?: string
  env?: Record<string, unknown>
  globalOutbound?: null | unknown
}

/**
 * Worker entrypoint
 */
interface WorkerEntrypoint {
  fetch(request: Request): Promise<Response>
}

/**
 * Worker stub returned by loader
 */
interface WorkerStub {
  getEntrypoint(): WorkerEntrypoint
}

/**
 * Environment with worker loader binding
 */
export interface SandboxEnv {
  loader?: WorkerLoader
  LOADER?: WorkerLoader
}

const COMPATIBILITY_DATE = '2024-04-03'

/**
 * Generate simple worker code that supports bindings
 *
 * The worker receives bindings via env parameter in fetch handler
 */
function generateWorkerCode(options: {
  module?: string
  script?: string
}): string {
  const { module = '', script = '' } = options

  // Wrap script to capture return value
  const wrappedScript = script
    ? `const __executeScript__ = async (env) => { ${script} }; const __result__ = await __executeScript__(env);`
    : 'const __result__ = undefined;'

  return `
// Sandbox Worker with Bindings Support

const logs = [];

// Capture console output
const originalConsole = { ...console };
const captureConsole = (level) => (...args) => {
  logs.push({
    level,
    message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
    timestamp: Date.now()
  });
  originalConsole[level](...args);
};
console.log = captureConsole('log');
console.warn = captureConsole('warn');
console.error = captureConsole('error');
console.info = captureConsole('info');

// User module code - receives env with bindings
${module}

export default {
  async fetch(request, env) {
    try {
      // Make env available to the script
      globalThis.env = env;

      // Execute the script
      ${wrappedScript}

      return Response.json({
        success: true,
        value: __result__,
        logs,
        duration: 0
      });
    } catch (error) {
      return Response.json({
        success: false,
        error: error.message || String(error),
        logs,
        duration: 0
      });
    }
  }
};
`
}

/**
 * Evaluate code in a sandboxed worker with service bindings support
 *
 * @example
 * ```ts
 * const result = await evaluate({
 *   module: \`
 *     globalThis.collection = (name) => ({
 *       get: (id) => env.COLLECTIONS.get(name, id),
 *       list: () => env.COLLECTIONS.list(name),
 *     });
 *   \`,
 *   script: 'return await collection("users").list()',
 *   bindings: {
 *     COLLECTIONS: env.COLLECTIONS  // Pass service binding
 *   }
 * }, { LOADER: env.LOADER })
 * ```
 */
export async function evaluate(
  options: EvaluateOptions,
  sandboxEnv?: SandboxEnv
): Promise<EvaluateResult> {
  const start = Date.now()

  try {
    const loader = sandboxEnv?.loader || sandboxEnv?.LOADER
    if (!loader) {
      return {
        success: false,
        logs: [],
        error: 'Sandbox requires worker_loaders binding. Add to wrangler.toml: [[worker_loaders]] binding = "LOADER"',
        duration: Date.now() - start,
      }
    }

    const workerCode = generateWorkerCode({
      module: options.module,
      script: options.script,
    })

    const id = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Merge env vars and bindings into env object
    const workerEnv: Record<string, unknown> = {
      ...(options.env || {}),
      ...(options.bindings || {}),
    }

    const worker = loader.get(id, async () => ({
      mainModule: 'worker.js',
      modules: {
        'worker.js': workerCode,
      },
      compatibilityDate: COMPATIBILITY_DATE,
      // Pass bindings through env
      env: workerEnv,
      // Block network if fetch is false or null
      globalOutbound: options.fetch === false || options.fetch === null ? null : undefined,
    }))

    // Get the entrypoint and call fetch
    const entrypoint = worker.getEntrypoint()
    const response = await entrypoint.fetch(new Request('http://sandbox/execute'))
    const result = (await response.json()) as EvaluateResult

    return {
      ...result,
      duration: Date.now() - start,
    }
  } catch (error) {
    return {
      success: false,
      logs: [],
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    }
  }
}

/**
 * Create an evaluate function bound to a specific environment
 */
export function createEvaluator(sandboxEnv: SandboxEnv) {
  return (options: EvaluateOptions) => evaluate(options, sandboxEnv)
}

/**
 * Sandbox Evaluator with Service Bindings Support
 *
 * Two execution paths, same interface:
 * 1. Cloudflare Workers: worker_loaders for true V8 isolates
 * 2. Node.js: Miniflare for local V8 isolates (same security model)
 *
 * Bindings are wrapped as fetch-based RPC handlers (rpc.do pattern):
 * - Node.js side: each namespace → { fetch(req) } that dispatches to real methods
 * - Sandbox side: Proxy objects that call env.NAMESPACE.fetch() for each method
 *
 * This works identically in both Miniflare (local) and Workers (production).
 */

import type { EvaluateResult, LogEntry } from 'ai-evaluate'

// Re-export base types
export type { EvaluateResult, LogEntry }

/**
 * Extended evaluate options with service bindings support
 */
export interface EvaluateOptions {
  /** Script code to execute */
  script?: string
  /** Module code that defines exports available to the script */
  module?: string
  /** Timeout in milliseconds */
  timeout?: number
  /** Environment variables (strings only) */
  env?: Record<string, string>
  /** Service bindings to pass to the sandbox (for Workers RPC) */
  bindings?: Record<string, unknown>
  /** Set to null to block network access */
  fetch?: null
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
 * Generate worker code that uses RPC-over-fetch to call bindings.
 *
 * The generated worker:
 * 1. Creates Proxy-based clients for each binding namespace
 * 2. Captures console output into logs[]
 * 3. Runs optional module code (side effects set up globals)
 * 4. Runs the user script in an async IIFE
 * 5. Returns { success, value, logs, duration }
 */
function generateWorkerCode(options: {
  module?: string
  script?: string
  bindingNames?: string[]
}): string {
  const { module = '', script = '', bindingNames = [] } = options

  const wrappedScript = script
    ? `const __executeScript__ = async (env) => { ${script} }; const __result__ = await __executeScript__(env);`
    : 'const __result__ = undefined;'

  // Generate Proxy-based RPC clients for each binding namespace (runs inside fetch handler where env is available)
  const rpcSetup = bindingNames.map(name =>
    `globalThis.${name} = createRpcProxy(env.${name}, '${name}');`
  ).join('\n      ')

  return `
// Sandbox Worker with RPC Bindings

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

/**
 * Create a recursive Proxy that intercepts property access and method calls,
 * sending them as RPC requests to the service binding via fetch().
 */
function createRpcProxy(binding, rootName, pathParts = []) {
  return new Proxy(function() {}, {
    get(_, prop) {
      if (prop === 'then') return undefined; // Don't treat proxy as thenable
      return createRpcProxy(binding, rootName, [...pathParts, prop]);
    },
    async apply(_, thisArg, args) {
      const response = await binding.fetch(new Request('http://rpc/' + rootName, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathParts, args })
      }));
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      return result.value;
    }
  });
}

// User module code
${module}

export default {
  async fetch(request, env) {
    try {
      globalThis.env = env;

      // Set up RPC proxies for scope bindings (must be inside fetch where env is available)
      ${rpcSetup}

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
 * Wrap a binding object as a fetch-based RPC handler.
 *
 * Each method call from the sandbox becomes a POST request:
 * { path: ['getIssue'], args: [2, 'dot-do', 'priya'] }
 *
 * The handler navigates the path on the binding object and calls the method.
 * This is the same pattern as rpc.do's binding() transport.
 */
/**
 * Wrap a binding object as a fetch handler function for Miniflare serviceBindings.
 *
 * Miniflare expects serviceBindings values to be functions: (req) => Response.
 * Inside the worker, env.KEY.fetch(req) is available — Miniflare wraps the function.
 */
function wrapBindingAsFetcher(binding: unknown): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      const { path, args } = await req.json() as { path: string[]; args: unknown[] }

      // Navigate the dotted path to find the method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let target: any = binding
      for (const part of path) {
        if (target == null || typeof target !== 'object') {
          return Response.json({ error: `Cannot access '${part}' on ${typeof target}` })
        }
        target = target[part]
      }

      if (typeof target !== 'function') {
        // It's a property, return it directly
        return Response.json({ value: target })
      }

      // Call the method — bind to parent for correct `this`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parent: any = binding
      for (let i = 0; i < path.length - 1; i++) {
        parent = parent[path[i]]
      }
      const result = await target.call(parent, ...args)
      return Response.json({ value: result })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return Response.json({ error: message })
    }
  }
}

/**
 * Evaluate code in a sandboxed V8 isolate with service bindings.
 *
 * Automatically selects the right runtime:
 * - Cloudflare Workers: uses worker_loaders binding (true V8 isolate)
 * - Node.js: uses Miniflare (same V8 isolate, local)
 *
 * Bindings are wrapped as fetch-based RPC handlers (rpc.do pattern).
 * Each scope namespace becomes a service binding with a fetch() method
 * that dispatches method calls via JSON-RPC.
 */
export async function evaluate(
  options: EvaluateOptions,
  sandboxEnv?: SandboxEnv
): Promise<EvaluateResult> {
  const start = Date.now()

  try {
    const loader = sandboxEnv?.loader || sandboxEnv?.LOADER
    if (loader) {
      return await evaluateWithWorkerLoader(options, loader, start)
    }

    // Fall back to Miniflare (Node.js / local development)
    return await evaluateWithMiniflare(options, start)
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
 * Evaluate using Cloudflare worker_loaders binding (production)
 */
async function evaluateWithWorkerLoader(
  options: EvaluateOptions,
  loader: WorkerLoader,
  start: number
): Promise<EvaluateResult> {
  const bindingNames = options.bindings ? Object.keys(options.bindings).filter(k => !k.startsWith('_')) : []
  const workerCode = generateWorkerCode({
    module: options.module,
    script: options.script,
    bindingNames,
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
    env: workerEnv,
    globalOutbound: options.fetch === null ? null : undefined,
  }))

  const entrypoint = worker.getEntrypoint()
  const response = await entrypoint.fetch(new Request('http://sandbox/execute'))
  const result = (await response.json()) as EvaluateResult

  return {
    ...result,
    duration: Date.now() - start,
  }
}

/**
 * Evaluate using Miniflare (Node.js / local development)
 *
 * Bindings are wrapped as fetch-based RPC handlers (rpc.do pattern):
 * each namespace becomes a { fetch(req) } service binding that the
 * sandbox can call to invoke methods on the Node.js-side objects.
 */
async function evaluateWithMiniflare(
  options: EvaluateOptions,
  start: number
): Promise<EvaluateResult> {
  const { Miniflare } = await import('miniflare')

  // Separate binding names (skip internal ones like _logs)
  const bindingNames = options.bindings
    ? Object.keys(options.bindings).filter(k => !k.startsWith('_'))
    : []

  const workerCode = generateWorkerCode({
    module: options.module,
    script: options.script,
    bindingNames,
  })

  // Wrap each binding as a fetch handler for Miniflare serviceBindings
  const serviceBindings: Record<string, (req: Request) => Promise<Response>> = {}
  if (options.bindings) {
    for (const [key, value] of Object.entries(options.bindings)) {
      if (key.startsWith('_')) continue // Skip internal bindings
      if (value != null && typeof value === 'object') {
        serviceBindings[key] = wrapBindingAsFetcher(value)
      } else if (typeof value === 'function') {
        // Wrap standalone functions as a single-method namespace
        serviceBindings[key] = wrapBindingAsFetcher({ call: value })
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mfOptions: any = {
    modules: true,
    script: workerCode,
    compatibilityDate: COMPATIBILITY_DATE,
    bindings: options.env || {},
  }

  if (Object.keys(serviceBindings).length > 0) {
    mfOptions.serviceBindings = serviceBindings
  }

  const mf = new Miniflare(mfOptions)

  try {
    const response = await mf.dispatchFetch('http://sandbox/execute')
    const result = (await response.json()) as EvaluateResult

    return {
      ...result,
      duration: Date.now() - start,
    }
  } finally {
    await mf.dispose()
  }
}

/**
 * Create an evaluate function bound to a specific environment
 */
export function createEvaluator(sandboxEnv: SandboxEnv) {
  return (options: EvaluateOptions) => evaluate(options, sandboxEnv)
}

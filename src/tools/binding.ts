/**
 * Binding Proxy
 *
 * Wraps bindings for injection into the sandbox environment.
 * Handles serialization/deserialization and async execution.
 */

/**
 * Type for a wrapped binding function
 */
export type WrappedBinding = (...args: unknown[]) => Promise<unknown>

/**
 * Type for a binding proxy - can be a function or nested object
 */
export type BindingProxy = {
  [key: string]: WrappedBinding | BindingProxy
}

/**
 * Check if a value is a function
 */
function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

/**
 * Check if a value is a plain object (not null, not array)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Wraps a binding function to ensure it returns a Promise
 *
 * @param name - The name of the binding (for error messages)
 * @param fn - The function to wrap
 * @returns An async function that wraps the original
 */
export function wrapBinding(
  name: string,
  fn: (...args: unknown[]) => unknown
): WrappedBinding {
  return async (...args: unknown[]): Promise<unknown> => {
    try {
      const result = fn(...args)
      // If it's already a promise, await it
      if (result instanceof Promise) {
        return await result
      }
      return result
    } catch (error) {
      // Re-throw with context
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Binding '${name}' failed: ${String(error)}`)
    }
  }
}

/**
 * Recursively creates a proxy for bindings
 *
 * @param bindings - The bindings to create proxy for
 * @param path - Current path for error messages (internal)
 * @returns A proxy object with all bindings wrapped
 */
export function createBindingProxy(
  bindings: Record<string, unknown>,
  path: string[] = []
): BindingProxy {
  const proxy: BindingProxy = {}

  for (const [key, value] of Object.entries(bindings)) {
    const currentPath = [...path, key]
    const fullPath = currentPath.join('.')

    if (isFunction(value)) {
      proxy[key] = wrapBinding(fullPath, value)
    } else if (isPlainObject(value)) {
      // Recursively handle nested objects
      proxy[key] = createBindingProxy(value as Record<string, unknown>, currentPath)
    } else {
      // For non-function, non-object values, wrap in a getter function
      proxy[key] = async () => value
    }
  }

  return proxy
}

/**
 * Serializes a value for transmission to the sandbox
 *
 * @param value - The value to serialize
 * @returns JSON string representation
 */
export function serializeValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined'
  }

  if (typeof value === 'function') {
    return '"[Function]"'
  }

  return JSON.stringify(value)
}

/**
 * Deserializes a value received from the sandbox
 *
 * @param serialized - The serialized string
 * @returns The deserialized value
 */
export function deserializeValue(serialized: string): unknown {
  if (serialized === 'undefined') {
    return undefined
  }

  try {
    return JSON.parse(serialized)
  } catch {
    // Return raw string if not valid JSON
    return serialized
  }
}

/**
 * Creates a serialization-aware binding wrapper
 * Used when bindings need to communicate across process boundaries
 *
 * @param name - The binding name
 * @param fn - The underlying function
 * @returns Wrapped function with serialization
 */
export function createSerializedBinding(
  name: string,
  fn: (...args: unknown[]) => unknown
): WrappedBinding {
  const wrapped = wrapBinding(name, fn)

  return async (...args: unknown[]): Promise<unknown> => {
    // Deserialize incoming arguments if needed
    const deserializedArgs = args.map(arg =>
      typeof arg === 'string' ? deserializeValue(arg) : arg
    )

    const result = await wrapped(...deserializedArgs)

    // Result is already in native form, caller can serialize if needed
    return result
  }
}

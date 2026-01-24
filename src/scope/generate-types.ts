/**
 * Generates TypeScript declaration (.d.ts) content from bindings.
 * Introspects functions and objects to create type definitions
 * that can be used by the LLM for code generation.
 */

/**
 * Check if a value is a function
 */
function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

/**
 * Check if a function is async (returns a Promise)
 */
function isAsyncFunction(fn: (...args: unknown[]) => unknown): boolean {
  return fn.constructor.name === 'AsyncFunction'
}

/**
 * Get the parameter count of a function
 */
function getParamCount(fn: (...args: unknown[]) => unknown): number {
  return fn.length
}

/**
 * Generate parameter string for a function
 */
function generateParams(fn: (...args: unknown[]) => unknown): string {
  const paramCount = getParamCount(fn)
  if (paramCount === 0) {
    return ''
  }

  // Generate generic parameter names
  const params: string[] = []
  for (let i = 0; i < paramCount; i++) {
    params.push(`arg${i}: unknown`)
  }
  return params.join(', ')
}

/**
 * Generate return type for a function
 */
function generateReturnType(fn: (...args: unknown[]) => unknown): string {
  if (isAsyncFunction(fn)) {
    return 'Promise<unknown>'
  }
  return 'unknown'
}

/**
 * Generate type declaration for a function binding
 */
function generateFunctionDeclaration(name: string, fn: (...args: unknown[]) => unknown): string {
  const params = generateParams(fn)
  const returnType = generateReturnType(fn)
  return `declare function ${name}(${params}): ${returnType};`
}

/**
 * Generate TypeScript type for a value
 */
function getValueType(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (value === undefined) {
    return 'undefined'
  }
  if (typeof value === 'string') {
    return 'string'
  }
  if (typeof value === 'number') {
    return 'number'
  }
  if (typeof value === 'boolean') {
    return 'boolean'
  }
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown
    const params = generateParams(fn)
    const returnType = generateReturnType(fn)
    return `(${params}) => ${returnType}`
  }
  if (Array.isArray(value)) {
    return 'unknown[]'
  }
  if (typeof value === 'object') {
    return generateObjectType(value as Record<string, unknown>)
  }
  return 'unknown'
}

/**
 * Generate TypeScript object type
 */
function generateObjectType(obj: Record<string, unknown>, indent = 2): string {
  const entries = Object.entries(obj)
  if (entries.length === 0) {
    return '{}'
  }

  const indentStr = ' '.repeat(indent)
  const properties = entries.map(([key, value]) => {
    const valueType = getValueType(value)
    // Handle nested objects with proper indentation
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof value !== 'function') {
      const nestedType = generateObjectType(value as Record<string, unknown>, indent + 2)
      return `${indentStr}${key}: ${nestedType}`
    }
    return `${indentStr}${key}: ${valueType}`
  })

  return `{\n${properties.join(';\n')};\n${' '.repeat(indent - 2)}}`
}

/**
 * Generate type declaration for an object binding
 */
function generateObjectDeclaration(name: string, obj: Record<string, unknown>): string {
  const objectType = generateObjectType(obj)
  return `declare const ${name}: ${objectType};`
}

/**
 * Generate TypeScript declaration (.d.ts) content from bindings.
 *
 * @param bindings - Record of binding names to their values (functions or objects)
 * @returns TypeScript declaration content as a string
 *
 * @example
 * ```ts
 * const bindings = {
 *   greet: (name: string) => `Hello, ${name}!`,
 *   math: { add: (a, b) => a + b }
 * }
 * const types = generateTypes(bindings)
 * // Results in:
 * // declare function greet(arg0: unknown): unknown;
 * // declare const math: { add: (arg0: unknown, arg1: unknown) => unknown };
 * ```
 */
export function generateTypes(bindings: Record<string, unknown>): string {
  const entries = Object.entries(bindings)

  if (entries.length === 0) {
    return ''
  }

  const declarations: string[] = []

  for (const [name, value] of entries) {
    if (isFunction(value)) {
      declarations.push(generateFunctionDeclaration(name, value))
    } else if (typeof value === 'object' && value !== null) {
      declarations.push(generateObjectDeclaration(name, value as Record<string, unknown>))
    }
  }

  return declarations.join('\n')
}

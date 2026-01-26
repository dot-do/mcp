/**
 * Validation Module
 *
 * Reusable Valibot schemas for runtime validation of MCP tool inputs.
 * These schemas are used both for MCP SDK schema definitions and runtime validation.
 */

import * as v from 'valibot'

/**
 * Search tool input schema
 */
export const SearchInputSchema = v.object({
  query: v.string(),
  limit: v.optional(v.number()),
  offset: v.optional(v.number()),
})

export type SearchInput = v.InferOutput<typeof SearchInputSchema>

/**
 * Fetch tool input schema
 */
export const FetchInputSchema = v.object({
  id: v.string(),
  includeMetadata: v.optional(v.boolean()),
  format: v.optional(v.string()),
})

export type FetchInput = v.InferOutput<typeof FetchInputSchema>

/**
 * Do tool input schema
 */
export const DoInputSchema = v.object({
  code: v.string(),
})

export type DoInput = v.InferOutput<typeof DoInputSchema>

/**
 * Validation issue type for Valibot
 */
export interface ValidationIssue {
  path?: Array<{ key: unknown }>
  message: string
}

/**
 * Validation error class for clearer error messages
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: ValidationIssue[]
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Parse and validate input using a Valibot schema
 * Throws ValidationError with detailed message on failure
 */
export function validateInput<T>(
  schema: v.GenericSchema<unknown, T>,
  input: unknown
): T {
  const result = v.safeParse(schema, input)

  if (!result.success) {
    const issues = result.issues.map((issue) => ({
      path: issue.path?.map((p) => ({ key: p.key })),
      message: issue.message,
    }))

    const messages = result.issues.map(
      (issue) => `${issue.path?.map((p) => p.key).join('.') || ''}: ${issue.message}`
    ).join('; ')

    throw new ValidationError(
      `Invalid input: ${messages}`,
      issues
    )
  }

  return result.output
}

/**
 * Validation Module
 *
 * Reusable Zod schemas for runtime validation of MCP tool inputs.
 * These schemas are used both for MCP SDK schema definitions and runtime validation.
 */

import { z } from 'zod'

/**
 * Search tool input schema
 */
export const SearchInputSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
})

export type SearchInput = z.infer<typeof SearchInputSchema>

/**
 * Fetch tool input schema
 */
export const FetchInputSchema = z.object({
  id: z.string(),
  includeMetadata: z.boolean().optional(),
  format: z.string().optional(),
})

export type FetchInput = z.infer<typeof FetchInputSchema>

/**
 * Do tool input schema
 */
export const DoInputSchema = z.object({
  code: z.string(),
})

export type DoInput = z.infer<typeof DoInputSchema>

/**
 * Validation error class for clearer error messages
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[]
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Parse and validate input using a Zod schema
 * Throws ValidationError with detailed message on failure
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): T {
  const result = schema.safeParse(input)

  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    ).join('; ')

    throw new ValidationError(
      `Invalid input: ${messages}`,
      result.error.issues
    )
  }

  return result.data
}

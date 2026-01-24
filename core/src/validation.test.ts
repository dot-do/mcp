import { describe, it, expect } from 'vitest'
import {
  SearchInputSchema,
  FetchInputSchema,
  DoInputSchema,
  validateInput,
  ValidationError,
  type SearchInput,
  type FetchInput,
  type DoInput,
} from './validation.js'

describe('validation module', () => {
  describe('SearchInputSchema', () => {
    it('should validate valid search input', () => {
      const input = { query: 'test query' }
      const result = SearchInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.query).toBe('test query')
      }
    })

    it('should validate search input with optional fields', () => {
      const input: SearchInput = { query: 'test', limit: 10, offset: 5 }
      const result = SearchInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(10)
        expect(result.data.offset).toBe(5)
      }
    })

    it('should reject non-string query', () => {
      const input = { query: 123 }
      const result = SearchInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('should reject missing query', () => {
      const input = {}
      const result = SearchInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('should reject non-number limit', () => {
      const input = { query: 'test', limit: 'ten' }
      const result = SearchInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })

  describe('FetchInputSchema', () => {
    it('should validate valid fetch input', () => {
      const input: FetchInput = { id: 'resource-123' }
      const result = FetchInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('resource-123')
      }
    })

    it('should validate fetch input with optional fields', () => {
      const input: FetchInput = { id: 'test', includeMetadata: true, format: 'json' }
      const result = FetchInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.includeMetadata).toBe(true)
        expect(result.data.format).toBe('json')
      }
    })

    it('should reject non-string id', () => {
      const input = { id: 123 }
      const result = FetchInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('should reject missing id', () => {
      const input = {}
      const result = FetchInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('should reject non-boolean includeMetadata', () => {
      const input = { id: 'test', includeMetadata: 'yes' }
      const result = FetchInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })

  describe('DoInputSchema', () => {
    it('should validate valid do input', () => {
      const input: DoInput = { code: 'return 42' }
      const result = DoInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.code).toBe('return 42')
      }
    })

    it('should reject non-string code', () => {
      const input = { code: 123 }
      const result = DoInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('should reject missing code', () => {
      const input = {}
      const result = DoInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })

  describe('validateInput', () => {
    it('should return parsed data for valid input', () => {
      const input = { query: 'test', limit: 5 }
      const result = validateInput(SearchInputSchema, input)
      expect(result).toEqual({ query: 'test', limit: 5 })
    })

    it('should throw ValidationError for invalid input', () => {
      const input = { query: 123 }
      expect(() => validateInput(SearchInputSchema, input)).toThrow(ValidationError)
    })

    it('should include field path in error message', () => {
      const input = { query: 123 }
      try {
        validateInput(SearchInputSchema, input)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).message).toContain('query')
      }
    })

    it('should include Zod issues in error', () => {
      const input = { query: 123 }
      try {
        validateInput(SearchInputSchema, input)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).issues).toHaveLength(1)
        expect((error as ValidationError).issues[0].path).toContain('query')
      }
    })
  })

  describe('type inference', () => {
    it('should correctly infer SearchInput type', () => {
      const input: SearchInput = {
        query: 'test',
        limit: 10,
        offset: 0,
      }
      expect(input.query).toBe('test')
      expect(input.limit).toBe(10)
      expect(input.offset).toBe(0)
    })

    it('should correctly infer FetchInput type', () => {
      const input: FetchInput = {
        id: 'test-id',
        includeMetadata: true,
        format: 'markdown',
      }
      expect(input.id).toBe('test-id')
      expect(input.includeMetadata).toBe(true)
      expect(input.format).toBe('markdown')
    })

    it('should correctly infer DoInput type', () => {
      const input: DoInput = {
        code: 'console.log("hello")',
      }
      expect(input.code).toBe('console.log("hello")')
    })
  })
})

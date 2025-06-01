import { sql } from '@/libs/db'
import { log } from '@/libs/logger'

interface CreateCompanyInput {
  name: string
  website: string
  category: string
  owner: string
  description: string | null
  user_id: string
  meta?: Record<string, any>
}

export interface CompanyRow {
  id: string
  name: string
  owner_name: string
  website: string
  category: string
  description: string
  meta: string
}

/**
 * Finds a company by owner_name
 * @param ownerName The name of the owner to search for
 * @returns The first company matching the owner_name, or null if none found
 */
export async function findCompanyByOwner(ownerName: string): Promise<CompanyRow | null> {
  const result = await sql`
    SELECT *
    FROM company
    WHERE owner_name = ${ownerName}
    LIMIT 1
  `

  console.log('findCompanyByOwner result:', result)

  return result.length ? (result[0] as CompanyRow) : null
}

/**
 * Finds a company by user_id
 * @param userId The user ID to search for
 * @returns The first company matching the user_id, or null if none found
 */
export async function findCompanyByUserId(userId: string): Promise<CompanyRow | null> {
  const result = await sql`
    SELECT *
    FROM company
    WHERE user_id = ${userId}
    LIMIT 1
  `

  log.debug('findCompanyByUserId result:', { userId, result })

  return result.length ? (result[0] as CompanyRow) : null
}

export async function createCompany(input: CreateCompanyInput) {
  const result = await sql`
    INSERT INTO company (
      name,
      website,
      category,
      owner_name,
      description,
      user_id,
      meta
    ) VALUES (
      ${input.name},
      ${input.website},
      ${input.category},
      ${input.owner},
      ${input.description},
      ${input.user_id},
      ${JSON.stringify(input.meta || {})}::jsonb
    )
    RETURNING *
  `

  return result[0]
}

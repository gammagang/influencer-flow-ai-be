import { sql } from '@/libs/db'

interface CreateCompanyInput {
  name: string
  website: string
  category: string
  owner: string
  description: string | null
  meta?: Record<string, any>
}

export async function createCompany(input: CreateCompanyInput) {
  const result = await sql`
    INSERT INTO company (
      name,
      website,
      category,
      owner_name,
      description,
      meta
    ) VALUES (
      ${input.name},
      ${input.website},
      ${input.category},
      ${input.owner},
      ${input.description},
      ${JSON.stringify(input.meta || {})}::jsonb
    )
    RETURNING *
  `

  return result[0]
}

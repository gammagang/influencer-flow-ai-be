import { sql } from '@/libs/db'

interface CreateCompanyInput {
  name: string
  website: string
  category: string
  owner: string
  description: string | null
  user_id: string
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

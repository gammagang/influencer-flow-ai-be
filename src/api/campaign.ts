import { sql } from '@/libs/db'
import { CreateCampaignReq } from '@/routes/campaign/validate'

// This will contain the db calls to create, get, update campaign details

export async function createCampaign(campaign: CreateCampaignReq) {
  // For MVP, using a dummy company ID
  const dummyCompanyId = 5

  const result = await sql`
    INSERT INTO campaign (
      name,
      description,
      start_date,
      end_date,
      company_id,
      state
    ) VALUES (
      ${campaign.name},
      ${campaign.description || null},
      ${campaign.startDate},
      ${campaign.endDate},
      ${dummyCompanyId},
      'active'
    )
    RETURNING *
  `

  return result[0]
}

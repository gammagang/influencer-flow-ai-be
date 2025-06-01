import { sql } from '@/libs/db'
import { CreateCampaignReq } from '@/routes/campaign/validate'
import { CampaignCreator, CampaignRow } from '@/types/campaign'

// This will contain the db calls to create, get, update campaign details

export async function createCampaign(campaign: CreateCampaignReq, companyId: string) {
  // For MVP, using a dummy company ID

  // Extract basic campaign fields
  const { name, description, startDate, endDate, ...metaFields } = campaign

  // Store additional fields in meta column
  const meta = {
    targetAudience: {
      ageRange: metaFields.ageRange,
      gender: metaFields.gender,
      interests: metaFields.interests,
      location: metaFields.location
    },
    deliverables: metaFields.deliverables,
    contentGuidelines: metaFields.contentGuidelines,
    budget: {
      total: metaFields.totalBudget,
      perCreator: metaFields.budgetPerCreator,
      paymentModel: metaFields.paymentModel
    },
    creatorCriteria: {
      followerRange: metaFields.followerRange,
      minEngagement: metaFields.minEngagement
    }
  }

  const result = await sql`
    INSERT INTO campaign (
      name,
      description,
      start_date,
      end_date,
      company_id,
      state,
      meta
    ) VALUES (
      ${name},
      ${description || null},
      ${startDate},
      ${endDate},
      ${companyId},
      'active',
      ${sql.json(meta)}
    )
    RETURNING *
  `

  return result[0]
}

export async function getCampaignsByCompanyId(companyId: string) {
  const result = await sql`
    SELECT *
    FROM campaign
    WHERE company_id = ${companyId}
  `

  return result.map((row) => row) // Convert RowList to plain array
}

export async function getCreatorsInCampaign(campaignId: string): Promise<CampaignCreator[]> {
  const result = await sql<CampaignCreator[]>`
    SELECT 
      cr.id,
      cr.name,
      cr.platform,
      cr.category,
      cr.age,
      cr.gender,
      cr.location,
      cr.tier,
      cr.engagement_rate,
      cr.email,
      cr.phone,
      cr.language,
      cr.meta,
      cc.id as campaign_creator_id,
      cc.current_state,
      cc.assigned_budget,
      cc.last_state_change_at,
      cc.meta as campaign_creator_meta
    FROM campaign_creator cc
    JOIN creator cr ON cc.creator_id = cr.id
    WHERE cc.campaign_id = ${campaignId}
  `

  return result.map((row) => ({
    ...(row as any),
    meta: row.meta ? JSON.parse(row.meta) : {},
    campaign_creator_meta: row.campaign_creator_meta ? JSON.parse(row.campaign_creator_meta) : {}
  }))
}

export async function getCampaignById(campaignId: string): Promise<CampaignRow | null> {
  const result = await sql<CampaignRow[]>`
    SELECT * FROM campaign WHERE id = ${campaignId}
    LIMIT 1
  `

  return result?.[0] || null
}

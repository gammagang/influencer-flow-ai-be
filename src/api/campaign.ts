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
    contentDeliverables: metaFields.contentDeliverables,
    budget: {
      total: metaFields.totalBudget
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
  const results = await sql<CampaignCreator[]>`
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

  return results
}

export async function getCampaignById(campaignId: string): Promise<CampaignRow | null> {
  const result = await sql<CampaignRow[]>`
    SELECT * FROM campaign WHERE id = ${campaignId}
    LIMIT 1
  `

  return result?.[0] || null
}

export async function deleteCampaign(
  campaignId: string,
  companyId: string
): Promise<{ deletedCampaign: CampaignRow; deletedCreators: string[] }> {
  // First verify the campaign exists and belongs to the company
  const campaign = await getCampaignById(campaignId)
  if (!campaign) {
    throw new Error(`Campaign with ID ${campaignId} not found`)
  }

  if (campaign.company_id.toString() !== companyId.toString()) {
    throw new Error('Unauthorized: Campaign does not belong to this company')
  }

  // Get all creators linked to this campaign
  const campaignCreators = await sql`
    SELECT creator_id 
    FROM campaign_creator 
    WHERE campaign_id = ${campaignId}
  `

  const creatorIds = campaignCreators.map((cc) => cc.creator_id)

  // Find creators that are ONLY linked to this campaign (and not to other campaigns of the same company)
  const creatorsToDelete: string[] = []

  for (const creatorId of creatorIds) {
    const otherCampaignLinks = await sql`
      SELECT COUNT(*) as count
      FROM campaign_creator cc
      JOIN campaign c ON cc.campaign_id = c.id
      WHERE cc.creator_id = ${creatorId}
        AND c.company_id = ${companyId}
        AND cc.campaign_id != ${campaignId}
    `

    // If creator is not linked to any other campaigns of this company, mark for deletion
    if (otherCampaignLinks[0].count === 0) {
      creatorsToDelete.push(creatorId.toString())
    }
  }

  // Start transaction to ensure atomicity
  const result = await sql.begin(async (sql) => {
    // Delete campaign_creator mappings for this campaign
    await sql`
      DELETE FROM campaign_creator 
      WHERE campaign_id = ${campaignId}
    `

    // Delete creators that are only linked to this campaign
    if (creatorsToDelete.length > 0) {
      await sql`
        DELETE FROM creator 
        WHERE id = ANY(${creatorsToDelete})
      `
    }

    // Delete the campaign itself
    const deletedCampaign = await sql<CampaignRow[]>`
      DELETE FROM campaign 
      WHERE id = ${campaignId}
      RETURNING *
    `

    return { deletedCampaign: deletedCampaign[0], deletedCreators: creatorsToDelete }
  })

  return result
}

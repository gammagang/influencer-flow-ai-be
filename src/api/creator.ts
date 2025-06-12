import { sql } from '@/libs/db'
import { AddCreatorToCampaignReq } from '@/routes/campaign/validate'
import { getCampaignById } from './campaign'

/**
 * Create or find an existing creator and add them to a campaign
 */
export async function addCreatorToCampaign(data: AddCreatorToCampaignReq) {
  const { campaignId, creatorData, assignedBudget, notes } = data
  // First, check if campaign exists
  const existingCampaign = await getCampaignById(campaignId)

  console.log('Campaign Result:', JSON.stringify(existingCampaign))
  if (!existingCampaign) throw new Error(`Campaign with ID ${campaignId} not found`)

  // Check if creator already exists (upsert approach)
  let creatorId: number

  const existingCreator = await sql`
    SELECT id FROM creator 
    WHERE name = ${creatorData.name} 
    AND platform = ${creatorData.platform}
  `

  if (existingCreator.length > 0) {
    // Creator exists, use existing ID
    creatorId = existingCreator[0].id as number
  } else {
    // Create new creator
    const creatorResult = await sql`
      INSERT INTO creator (
        name,
        platform,
        email,
        age,
        gender,
        location,
        tier,
        engagement_rate,
        phone,
        language,
        category,
        meta
      ) VALUES (
        ${creatorData.name},
        ${creatorData.platform},
        ${creatorData.email || null},
        ${creatorData.age || null},
        ${creatorData.gender || null},
        ${creatorData.location || null},
        ${creatorData.tier || null},
        ${creatorData.engagement_rate || null},
        ${creatorData.phone || null},
        ${creatorData.language || null},
        ${creatorData.category || null},
        ${sql.json(creatorData.meta || {})}
      )
      RETURNING id
    `

    creatorId = creatorResult[0].id as number
  }

  // Check if the creator is already associated with this campaign
  const existingCampaignCreator = await sql`
    SELECT id FROM campaign_creator 
    WHERE campaign_id = ${campaignId} 
    AND creator_id = ${creatorId}
  `

  if (existingCampaignCreator.length > 0)
    throw new Error(`Creator is already associated with this campaign`)

  // Create campaign-creator relationship
  const campaignCreatorResult = await sql`
    INSERT INTO campaign_creator (
      campaign_id,
      creator_id,
      current_state,
      last_state_change_at,
      assigned_budget,
      notes,
      meta
    ) VALUES (
      ${campaignId},
      ${creatorId},
      'discovered',
      ${new Date().toISOString()},
      ${assignedBudget || 1000},
      ${notes || null},
      ${sql.json({
        campaignInfo: {
          contentDeliverables: existingCampaign.meta.contentDeliverables
        }
      })}
    )
    RETURNING *
  `

  const campaignCreatorId = campaignCreatorResult[0].id

  // TODO: Add later Create audit entry for the initial state
  // await sql`
  //   INSERT INTO campaign_creator_audit (
  //     campaign_creator_id,
  //     previous_state,
  //     new_state,
  //     changed_at,
  //     changed_by,
  //     notes,
  //     meta
  //   ) VALUES (
  //     ${campaignCreatorId},
  //     ${null},
  //     'discovered',
  //     ${new Date().toISOString()},
  //     'system',
  //     'Creator added to campaign',
  //     '{}'
  //   )
  // `

  // Return the complete result with creator and campaign-creator data
  const result = await sql`
    SELECT 
      cc.*,
      c.name as creator_name,
      c.platform as creator_platform,
      c.email as creator_email,
      camp.name as campaign_name
    FROM campaign_creator cc
    JOIN creator c ON cc.creator_id = c.id
    JOIN campaign camp ON cc.campaign_id = camp.id
    WHERE cc.id = ${campaignCreatorId}
  `

  return result[0]
}

/**
 * Get creator by ID
 */
export async function getCreatorById(creatorId: string) {
  const result = await sql`
    SELECT * FROM creator WHERE id = ${creatorId}
  `

  return result[0] || null
}

/**
 * Get all creators with optional filters
 */
export async function getCreators(filters: {
  platform?: string
  minFollowers?: number
  maxFollowers?: number
  page?: number
  limit?: number
}) {
  const { platform, page = 1, limit = 10 } = filters
  const offset = (page - 1) * limit

  // Build WHERE clause based on filters
  const whereConditions = []
  if (platform) {
    whereConditions.push(`platform = '${platform}'`)
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

  const result = await sql`
    SELECT * FROM creator 
    ${sql.unsafe(whereClause)}
    ORDER BY id DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const countResult = await sql`
    SELECT COUNT(*) as total FROM creator 
    ${sql.unsafe(whereClause)}
  `

  return {
    items: result,
    total: Number(countResult[0].total),
    page,
    limit,
    totalPages: Math.ceil(Number(countResult[0].total) / limit)
  }
}

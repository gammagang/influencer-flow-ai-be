import { sql } from '@/libs/db'
import { log } from '@/libs/logger'
import { UpdateCampaignCreatorLinkReq } from '@/routes/campaign-creator/validate'

// This will contain the db calls for campaign-creator operations

export interface CampaignCreatorDetails {
  // Campaign-Creator mapping fields
  cc_id: string
  campaign_creator_current_state: string
  assigned_budget: number | null
  cc_notes: string | null
  campaign_creator_meta: Record<string, any>
  cc_created_at?: string
  cc_updated_at?: string

  // Campaign fields
  campaign_id: string
  company_id: string
  campaign_name: string
  campaign_description: string | null
  campaign_start_date: string | null
  campaign_end_date: string | null
  campaign_state: string
  campaign_meta: Record<string, any>

  // Creator fields
  creator_id: string
  creator_name: string
  creator_handle?: string
  creator_platform: string
  creator_category: string | null
  creator_age: number | null
  creator_gender: string | null
  creator_location: string | null
  creator_country?: string | null
  creator_tier: string | null
  creator_engagement_rate: number | null
  creator_email: string | null
  creator_phone: string | null
  creator_language: string | null
  followers_count?: number | null
  profile_image_url?: string | null
  profile_url?: string | null
  interests?: unknown[] | null
  quality_score?: number | null
  creator_meta: Record<string, any>
}

export async function getCampaignCreatorWithCampaignDetails(
  ccMappingId: string
): Promise<CampaignCreatorDetails | null> {
  const result = await sql<CampaignCreatorDetails[]>`
    SELECT 
      cc.id as cc_id,
      cc.current_state as campaign_creator_current_state,
      cc.assigned_budget as assigned_budget,
      cc.notes as cc_notes,
      cc.meta as campaign_creator_meta,
      
      c.id as campaign_id,
      c.company_id as company_id,
      c.name as campaign_name,
      c.description as campaign_description,
      c.start_date as campaign_start_date,
      c.end_date as campaign_end_date,
      c.state as campaign_state,
      c.meta as campaign_meta,
      
      cr.id as creator_id,
      cr.name as creator_name,
      cr.platform as creator_platform,
      cr.category as creator_category,
      cr.age as creator_age,
      cr.gender as creator_gender,
      cr.location as creator_location,
      cr.tier as creator_tier,
      cr.engagement_rate as creator_engagement_rate,
      cr.email as creator_email,
      cr.phone as creator_phone,
      cr.language as creator_language,
      cr.meta as creator_meta
    FROM campaign_creator cc
    JOIN campaign c ON cc.campaign_id = c.id
    JOIN creator cr ON cc.creator_id = cr.id
    WHERE cc.id = ${ccMappingId}
  `
  return result[0] || null
}

/**
 * Get all campaign-creator links with optional filters
 */
export async function getCampaignCreators(filters: {
  campaignId?: string
  creatorId?: string
  status?: string
  page?: number
  limit?: number
}) {
  const { campaignId, creatorId, status, page = 1, limit = 10 } = filters
  const offset = (page - 1) * limit

  // Build WHERE clause based on filters
  const whereConditions = []

  if (campaignId) {
    whereConditions.push(`campaign_id = '${campaignId}'`)
  }

  if (creatorId) {
    whereConditions.push(`creator_id = '${creatorId}'`)
  }

  if (status) {
    whereConditions.push(`current_state = '${status}'`)
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

  const result = await sql`
    SELECT * FROM campaign_creator 
    ${sql.unsafe(whereClause)}
    ORDER BY last_state_change_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const countResult = await sql`
    SELECT COUNT(*) as total FROM campaign_creator 
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

/**
 * Create a new campaign-creator link
 */
export async function mapCreatorToCampaign(data: {
  campaignId: string
  creatorId: string
  status?: string
  negotiatedRate?: number
  contractId?: string | null
  notes?: string
}) {
  const { campaignId, creatorId, status = 'pending', negotiatedRate, notes } = data

  // Check if link already exists
  const existingLink = await sql`
    SELECT id FROM campaign_creator 
    WHERE campaign_id = ${campaignId} AND creator_id = ${creatorId}
  `

  if (existingLink.length > 0) {
    throw new Error('Campaign-creator link already exists')
  }

  const result = await sql`
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
      ${status},
      ${new Date().toISOString()},
      ${negotiatedRate || null},
      ${notes || null},
      ${sql.json({})}
    )
    RETURNING *
  `

  return result[0]
}

/**
 * Update a campaign-creator link
 */
export async function updateCampaignCreatorLink(
  linkId: string,
  data: {
    status?: UpdateCampaignCreatorLinkReq['status']
    contentDeliverables?: string
    negotiatedRate?: number
    contractId?: string | null
    notes?: string
  }
) {
  log.info('Updating campaign-creator link', { linkId, data })
  const { status, contentDeliverables, negotiatedRate, contractId } = data

  // Get current link to merge meta data
  const currentLink = await getCampaignCreatorWithCampaignDetails(linkId)
  if (!currentLink) throw new Error('Campaign-creator link not found')

  const updatedMeta = currentLink.campaign_creator_meta || {}
  if (contentDeliverables) updatedMeta.contentDeliverables = contentDeliverables
  if (contractId) updatedMeta.contractId = contentDeliverables

  // Use conditional logic for the update
  const newState = status ? status : currentLink.campaign_creator_current_state
  const newBudget = negotiatedRate ? negotiatedRate : currentLink.assigned_budget

  const result = await sql`
    UPDATE campaign_creator 
    SET 
      current_state = ${newState},
      assigned_budget = ${newBudget},
      meta = ${sql.json(updatedMeta)},
      last_state_change_at = CURRENT_TIMESTAMP
    WHERE id = ${linkId}
    RETURNING *
  `

  return result[0]
}

export async function updateCampaignCreatorState(
  mappingId: string,
  status: Exclude<UpdateCampaignCreatorLinkReq['status'], undefined>
) {
  log.info('Updating campaign-creator state', { mappingId, status })
  const currentLink = await getCampaignCreatorWithCampaignDetails(mappingId)
  if (!currentLink) throw new Error('Campaign-creator link not found')

  await sql`
    UPDATE campaign_creator 
    SET 
      current_state = ${status}
    WHERE id = ${mappingId}
    RETURNING *
  `

  const creatorCampaignDetails = await getCampaignCreatorWithCampaignDetails(mappingId)
  return creatorCampaignDetails
}

/**
 * Delete a campaign-creator link
 */
export async function deleteCampaignCreatorLink(linkId: string) {
  const result = await sql`
    DELETE FROM campaign_creator 
    WHERE id = ${linkId}
    RETURNING *
  `

  return result[0] || null
}

/**
 * Get all campaign-creator links with full creator details for a campaign
 */
export async function getCampaignCreatorsWithDetails(filters: {
  campaignId: string
  status?: string | string[]
  limit?: number
}) {
  const { campaignId, status, limit = 1000 } = filters

  // Build WHERE clause for status filter
  let statusFilter = ''
  if (status) {
    const statusArray = Array.isArray(status) ? status : [status]
    const statusConditions = statusArray.map((s) => `'${s}'`).join(',')
    statusFilter = `AND cc.current_state IN (${statusConditions})`
  }

  const result = await sql<CampaignCreatorDetails[]>`
    SELECT 
      cc.id as cc_id,
      cc.current_state as campaign_creator_current_state,
      cc.assigned_budget as assigned_budget,
      cc.notes as cc_notes,
      cc.meta as campaign_creator_meta,
      cc.last_state_change_at as cc_created_at,
      cc.last_state_change_at as cc_updated_at,
      
      c.id as campaign_id,
      c.company_id as company_id,
      c.name as campaign_name,
      c.description as campaign_description,
      c.start_date as campaign_start_date,
      c.end_date as campaign_end_date,
      c.state as campaign_state,
      c.meta as campaign_meta,
      
      cr.id as creator_id,
      cr.name as creator_name,
      COALESCE(cr.meta->>'handle', cr.name) as creator_handle,
      cr.platform as creator_platform,
      cr.category as creator_category,
      cr.age as creator_age,
      cr.gender as creator_gender,
      cr.location as creator_location,
      COALESCE(cr.meta->>'country', cr.location) as creator_country,
      cr.tier as creator_tier,
      cr.engagement_rate as creator_engagement_rate,
      cr.email as creator_email,
      cr.phone as creator_phone,
      cr.language as creator_language,
      COALESCE((cr.meta->>'followersCount')::int, 0) as followers_count,
      cr.meta->>'profileImageUrl' as profile_image_url,
      cr.meta->>'profileUrl' as profile_url,
      COALESCE(cr.meta->'interests', '[]'::jsonb) as interests,
      COALESCE((cr.meta->>'qualityScore')::numeric, 0) as quality_score,
      cr.meta as creator_meta
    FROM campaign_creator cc
    JOIN campaign c ON cc.campaign_id = c.id
    LEFT JOIN creator cr ON cc.creator_id = cr.id
    WHERE cc.campaign_id = ${campaignId}
    ${sql.unsafe(statusFilter)}
    ORDER BY cc.last_state_change_at DESC
    LIMIT ${limit}
  `

  return result
}

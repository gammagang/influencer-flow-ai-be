import { sql } from '@/libs/db'

// This will contain the db calls for campaign-creator operations

/**
 * Get detailed campaign-creator information with joined campaign data
 */
export async function getCampaignCreatorWithCampaignDetails(linkId: string) {
  const result = await sql`
    SELECT 
      cc.id,
      cc.campaign_id,
      cc.creator_id,
      cc.current_state,
      cc.last_state_change_at,
      cc.assigned_budget,
      cc.notes,
      cc.meta as campaign_creator_meta,
      c.id as campaign_id,
      c.name as campaign_name,
      c.description as campaign_description,
      c.start_date,
      c.end_date,
      c.company_id,
      c.state as campaign_state,
      c.meta as campaign_meta
    FROM campaign_creator cc
    JOIN campaign c ON cc.campaign_id = c.id
    WHERE cc.id = ${linkId}
  `

  return result[0] || null
}

/**
 * Get campaign-creator by ID
 */
export async function getCampaignCreatorById(linkId: string) {
  const result = await sql`
    SELECT * FROM campaign_creator WHERE id = ${linkId}
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
  let whereConditions = []

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
export async function createCampaignCreatorLink(data: {
  campaignId: string
  creatorId: string
  status?: string
  agreedDeliverables?: string[]
  negotiatedRate?: number
  contractId?: string | null
  notes?: string
}) {
  const {
    campaignId,
    creatorId,
    status = 'pending',
    agreedDeliverables = [],
    negotiatedRate,
    contractId,
    notes
  } = data

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
      ${JSON.stringify({
        agreedDeliverables,
        contractId: contractId || null
      })}
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
    status?: string
    agreedDeliverables?: string[]
    negotiatedRate?: number
    contractId?: string | null
    notes?: string
  }
) {
  const { status, agreedDeliverables, negotiatedRate, contractId, notes } = data

  // Get current link to merge meta data
  const currentLink = await getCampaignCreatorById(linkId)
  if (!currentLink) {
    throw new Error('Campaign-creator link not found')
  }

  const currentMeta = currentLink.meta || {}
  const updatedMeta = {
    ...currentMeta,
    ...(agreedDeliverables !== undefined && { agreedDeliverables }),
    ...(contractId !== undefined && { contractId })
  }

  // Use conditional logic for the update
  const newState = status !== undefined ? status : currentLink.current_state
  const newBudget = negotiatedRate !== undefined ? negotiatedRate : currentLink.assigned_budget
  const newNotes = notes !== undefined ? notes : currentLink.notes
  const newStateChangeTime =
    status !== undefined ? new Date().toISOString() : currentLink.last_state_change_at

  const result = await sql`
    UPDATE campaign_creator 
    SET 
      current_state = ${newState},
      assigned_budget = ${newBudget},
      notes = ${newNotes},
      meta = ${JSON.stringify(updatedMeta)},
      last_state_change_at = ${newStateChangeTime}
    WHERE id = ${linkId}
    RETURNING *
  `

  return result[0]
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

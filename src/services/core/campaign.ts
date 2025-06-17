import { type UserJwt } from '@/middlewares/jwt'
import { findCompanyByUserId } from '@/api/company'
import { getCampaignsByCompanyId, getCampaignById } from '@/api/campaign'
import { getCampaignCreatorsWithDetails } from '@/api/campaign-creator'
import { log } from '@/libs/logger'

export interface CampaignSummary {
  campaigns: Array<{
    id: string
    name: string
    status: string
    description: string | null
    startDate: string
    endDate: string
    creatorCount?: number
  }>
  totalCampaigns: number
}

export interface CampaignStatus {
  campaignId: string
  campaignName: string
  totalCreators: number
  statusCounts: Record<string, number>
  lastUpdated: string
}

export interface CampaignCreator {
  id: string
  name: string
  handle: string
  status: string
  email?: string | null
}

/**
 * Get a summary of all campaigns for a user's company
 */
export async function getCampaignSummary(user: UserJwt): Promise<CampaignSummary> {
  const company = await findCompanyByUserId(user.sub)
  if (!company) {
    throw new Error('Company not found for user')
  }

  const campaigns = await getCampaignsByCompanyId(company.id)

  log.info('Retrieved campaigns summary:', {
    userId: user.sub,
    companyId: company.id,
    campaignCount: campaigns.length
  })

  return {
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id.toString(),
      name: campaign.name,
      status: campaign.state,
      description: campaign.description,
      startDate: campaign.start_date,
      endDate: campaign.end_date
    })),
    totalCampaigns: campaigns.length
  }
}

/**
 * Get detailed status for a specific campaign
 */
export async function getCampaignStatus(
  campaignId: string,
  user: UserJwt
): Promise<CampaignStatus> {
  // Validate user has access to this campaign
  const company = await findCompanyByUserId(user.sub)
  if (!company) {
    throw new Error('Company not found for user')
  }

  const campaign = await getCampaignById(campaignId)
  if (!campaign || campaign.company_id !== company.id) {
    throw new Error('Campaign not found or access denied')
  }

  // Get creators for this campaign
  const creators = await getCampaignCreatorsWithDetails({
    campaignId,
    limit: 1000
  })

  // Calculate status counts
  const statusCounts = creators.reduce((acc: Record<string, number>, creator) => {
    const status = creator.campaign_creator_current_state || 'unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  log.info('Retrieved campaign status:', {
    campaignId,
    campaignName: campaign.name,
    totalCreators: creators.length,
    statusCounts
  })

  return {
    campaignId,
    campaignName: campaign.name,
    totalCreators: creators.length,
    statusCounts,
    lastUpdated: new Date().toISOString()
  }
}

/**
 * Get creators for a specific campaign with optional filtering
 */
export async function getCampaignCreators(
  campaignId: string,
  user: UserJwt,
  filters?: { status?: string; limit?: number }
): Promise<CampaignCreator[]> {
  // Validate user has access to this campaign
  const company = await findCompanyByUserId(user.sub)
  if (!company) {
    throw new Error('Company not found for user')
  }

  const campaign = await getCampaignById(campaignId)
  if (!campaign || campaign.company_id !== company.id) {
    throw new Error('Campaign not found or access denied')
  }

  // Get creators with optional filtering
  const creators = await getCampaignCreatorsWithDetails({
    campaignId,
    status: filters?.status,
    limit: filters?.limit || 100
  })

  log.info('Retrieved campaign creators:', {
    campaignId,
    campaignName: campaign.name,
    requestedStatus: filters?.status,
    limit: filters?.limit,
    resultCount: creators.length
  })

  return creators.map((creator) => ({
    id: creator.cc_id?.toString() || '',
    name: creator.creator_name || creator.creator_handle || 'Unknown',
    handle: creator.creator_handle || creator.creator_name || 'Unknown',
    status: creator.campaign_creator_current_state || 'unknown',
    email: creator.creator_email
  }))
}

/**
 * Validate if a user has access to a specific campaign
 */
export async function validateCampaignAccess(
  campaignId: string,
  user: UserJwt
): Promise<{ campaign: any; company: any }> {
  const company = await findCompanyByUserId(user.sub)
  if (!company) {
    throw new Error('Company not found for user')
  }

  const campaign = await getCampaignById(campaignId)
  if (!campaign || campaign.company_id !== company.id) {
    throw new Error('Campaign not found or access denied')
  }

  return { campaign, company }
}

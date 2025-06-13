import { discoverCreator, type DiscoverCreatorParams, mapFollowerCountToTier } from '@/api/discover'
import { createCampaign } from '@/api/campaign'
import { findCompanyByUserId } from '@/api/company'
import { CreateCampaignReq } from '@/routes/campaign/validate'
import { log } from '@/libs/logger'
import { type CreateCampaignChatParams } from './types'
import { type UserJwt } from '@/middlewares/jwt'

interface CampaignResult {
  id: number
  name: string
  description: string | null
  startDate: string
  endDate: string
  deliverables: string[]
  status: string
  createdAt: string
}

// Function to execute creator discovery
export async function executeDiscoverCreators(params: DiscoverCreatorParams) {
  try {
    const discoveryParams: DiscoverCreatorParams = {
      country: params.country,
      tier: params.tier,
      language: params.language,
      category: params.category,
      er: params.er,
      gender: params.gender,
      bio: params.bio,
      limit: Math.min(params.limit || 12, 50),
      skip: 0,
      connector: 'instagram'
    }

    const discoveryResult = await discoverCreator(discoveryParams)

    // Add debugging
    log.info('Discovery result:', {
      objectsLength: discoveryResult.objects?.length || 0,
      totalFound: discoveryResult.objects?.length || 0,
      searchParams: discoveryParams
    })

    // Transform the results
    const transformedCreators = discoveryResult.objects.map((creator) => ({
      id: creator._id,
      name: creator.full_name || creator.handle,
      handle: creator.handle,
      platform: creator.connector,
      category: creator.category,
      followersCount: creator.followers,
      tier: mapFollowerCountToTier(creator.followers),
      engagement_rate: creator.engagement / 100,
      location: creator.location,
      country: creator.country,
      gender: creator.gender,
      language: creator.languages?.join(', ') || null,
      profileImageUrl: creator.image_link,
      profileUrl: creator.handle_link,
      interests: creator.interests,
      qualityScore: creator.quality?.profile_quality_score
    }))

    return {
      success: true,
      data: {
        creators: transformedCreators,
        total: transformedCreators.length,
        searchParams: discoveryParams
      }
    }
  } catch (error) {
    log.error('Error in executeDiscoverCreators:', error)
    return {
      success: false,
      error: 'Failed to discover creators. Please try again with different parameters.'
    }
  }
}

// Function to execute campaign creation
export async function executeCreateCampaign(
  params: CreateCampaignChatParams,
  user: UserJwt
): Promise<{ success: boolean; data?: { campaign?: CampaignResult }; error?: string }> {
  try {
    log.info('Creating campaign with params:', params)

    // Get the user's company ID from the database
    const company = await findCompanyByUserId(user.sub)
    if (!company) {
      log.error('No company found for user:', { userId: user.sub, userEmail: user.email })
      return {
        success: false,
        error: 'No company found for the current user. Please create a company profile first.'
      }
    }

    const companyId = company.id
    log.info('Found company for user:', {
      userId: user.sub,
      companyId: companyId,
      companyName: company.name
    })

    // Validate required fields
    if (
      !params.name ||
      !params.startDate ||
      !params.endDate ||
      !params.deliverables ||
      params.deliverables.length === 0
    ) {
      log.error('Missing required fields for campaign creation:', params)
      return {
        success: false,
        error: 'Missing required fields: name, startDate, endDate, and deliverables are required.'
      }
    }

    // Transform chat params to API params
    const campaignData: CreateCampaignReq = {
      name: params.name,
      description: params.description || '',
      startDate: params.startDate,
      endDate: params.endDate,
      deliverables: params.deliverables,
      contentDeliverables: params.deliverables.join(', '), // Required field
      totalBudget: 10000, // Default budget for chat-created campaigns
      ageRange: '18-35', // Default values
      gender: 'all',
      interests: [],
      followerRange: '10k-100k',
      minEngagement: '2%',
      location: 'Global'
    }

    log.info('Campaign data prepared:', campaignData)

    const result = await createCampaign(campaignData, companyId)

    log.info('Campaign created successfully:', {
      campaignId: result.id,
      name: result.name
    })

    return {
      success: true,
      data: {
        campaign: {
          id: result.id,
          name: result.name,
          description: result.description,
          startDate: result.start_date,
          endDate: result.end_date,
          deliverables: params.deliverables,
          status: result.state,
          createdAt: result.created_at
        }
      }
    }
  } catch (error) {
    log.error('Error in executeCreateCampaign:', error)
    // More detailed error logging
    if (error instanceof Error) {
      log.error('Error message:', error.message)
      log.error('Error stack:', error.stack)
    }
    return {
      success: false,
      error: `Failed to create campaign. Please check the details and try again. ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

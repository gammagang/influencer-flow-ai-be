import { discoverCreator, type DiscoverCreatorParams, mapFollowerCountToTier } from '@/api/discover'
import { createCampaign, getCampaignsByCompanyId, getCampaignById } from '@/api/campaign'
import { addCreatorToCampaign } from '@/api/creator'
import { findCompanyByUserId } from '@/api/company'
import { CreateCampaignReq } from '@/routes/campaign/validate'
import { log } from '@/libs/logger'
import { type CreateCampaignChatParams } from './types'
import { type UserJwt } from '@/middlewares/jwt'
import { persistentConversationStore } from './conversation-store'

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

// Function to execute list campaigns
export async function executeListCampaigns(user: UserJwt) {
  try {
    // Find the company for this user
    const company = await findCompanyByUserId(user.sub)
    if (!company) {
      log.error('Company not found for user:', { userId: user.sub })
      return {
        success: false,
        error: 'Company not found for user.'
      }
    }

    const companyId = company.id
    log.info('Found company for user:', {
      userId: user.sub,
      companyId: companyId,
      companyName: company.name
    })

    // Get all campaigns for the company
    const campaigns = await getCampaignsByCompanyId(companyId)

    log.info('Retrieved campaigns:', {
      companyId,
      campaignCount: campaigns.length
    })

    // Transform the campaign data for response
    const transformedCampaigns = campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      status: campaign.state,
      createdAt: campaign.created_at,
      // Extract deliverables from meta if available
      deliverables: campaign.meta?.deliverables || [],
      totalBudget: campaign.meta?.budget?.total || null
    }))

    return {
      success: true,
      data: {
        campaigns: transformedCampaigns,
        total: transformedCampaigns.length
      }
    }
  } catch (error) {
    log.error('Error in executeListCampaigns:', error)
    if (error instanceof Error) {
      log.error('Error message:', error.message)
      log.error('Error stack:', error.stack)
    }
    return {
      success: false,
      error: `Failed to list campaigns. ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Function to execute adding creators to campaign
export async function executeAddCreatorsToCampaign(
  params: {
    campaignId: string
    creatorHandles: string[]
    assignedBudget?: number
    notes?: string
  },
  user: UserJwt,
  conversationId: string
) {
  try {
    log.info('Adding creators to campaign:', params)

    // Verify user has access to the campaign
    const company = await findCompanyByUserId(user.sub)
    if (!company) {
      return {
        success: false,
        error: 'Company not found for user'
      }
    }

    // Get campaign to verify it exists and belongs to user's company
    const campaign = await getCampaignById(params.campaignId)
    if (!campaign) {
      return {
        success: false,
        error: 'Campaign not found'
      }
    }

    if (campaign.company_id !== company.id.toString()) {
      return {
        success: false,
        error: 'You do not have access to this campaign'
      }
    }

    // Get conversation history to find discovered creators
    const conversation = persistentConversationStore.getConversation(conversationId)
    if (!conversation) {
      return {
        success: false,
        error: 'Conversation not found. Please discover creators first.'
      }
    }

    // Find the most recent discover_creators result in conversation
    const messages = persistentConversationStore.getMessages(conversationId)
    let discoveredCreators: Array<{
      id: string
      name: string
      handle: string
      platform: string
      category: string
      followersCount: number
      tier: string
      engagement_rate: number
      location: string | null
      gender: string | null
      language: string | null
      profileUrl: string
    }> = []

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message.role === 'tool' && message.tool_call_id) {
        try {
          const toolResult = JSON.parse(message.content)
          if (toolResult.success && toolResult.data?.creators) {
            discoveredCreators = toolResult.data.creators
            break
          }
        } catch {
          // Continue searching
        }
      }
    }

    if (discoveredCreators.length === 0) {
      return {
        success: false,
        error: 'No discovered creators found in conversation. Please discover creators first.'
      }
    }

    const addedCreators = []
    const errors = []

    // Find creators by handle and add them to campaign
    for (const handle of params.creatorHandles) {
      try {
        const discoveredCreator = discoveredCreators.find(
          (creator) => creator.handle === handle || creator.name === handle
        )

        if (!discoveredCreator) {
          errors.push(`Creator with handle ${handle} not found in discovered creators`)
          continue
        }

        // Prepare creator data for the addCreatorToCampaign function
        const creatorData = {
          name: discoveredCreator.name,
          platform: 'instagram' as const, // All discovered creators are from Instagram
          email: null,
          age: null,
          gender: discoveredCreator.gender || null,
          location: discoveredCreator.location,
          tier: discoveredCreator.tier,
          engagement_rate: discoveredCreator.engagement_rate,
          phone: null,
          language: discoveredCreator.language || null,
          category: discoveredCreator.category,
          meta: {
            externalId: discoveredCreator.id,
            handle: discoveredCreator.handle,
            profileUrl: discoveredCreator.profileUrl,
            followersCount: discoveredCreator.followersCount,
            source: 'discovery'
          }
        }

        // Use the existing addCreatorToCampaign function
        const result = await addCreatorToCampaign({
          campaignId: params.campaignId,
          creatorData,
          assignedBudget: params.assignedBudget || 1000,
          notes: params.notes || `Added via chat on ${new Date().toISOString()}`
        })

        addedCreators.push({
          creatorHandle: handle,
          creatorName: discoveredCreator.name,
          campaignCreatorId: result.id,
          status: result.current_state,
          assignedBudget: result.assigned_budget
        })

        log.info(`Successfully added creator ${handle} to campaign ${params.campaignId}`)
      } catch (error) {
        log.error(`Error adding creator ${handle} to campaign:`, error)
        errors.push(
          `Failed to add creator ${handle}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return {
      success: true,
      data: {
        campaignId: params.campaignId,
        campaignName: campaign.name,
        addedCreators,
        totalAdded: addedCreators.length,
        errors: errors.length > 0 ? errors : undefined
      }
    }
  } catch (error) {
    log.error('Error in executeAddCreatorsToCampaign:', error)
    return {
      success: false,
      error: `Failed to add creators to campaign. ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

import { discoverCreator, type DiscoverCreatorParams, mapFollowerCountToTier } from '@/api/discover'
import {
  createCampaign,
  getCampaignsByCompanyId,
  getCampaignById,
  deleteCampaign
} from '@/api/campaign'
import { addCreatorToCampaign } from '@/api/creator'
import { findCompanyByUserId } from '@/api/company'
import { CreateCampaignReq } from '@/routes/campaign/validate'
import { log } from '@/libs/logger'
import { type CreateCampaignChatParams } from './types'
import { type UserJwt } from '@/middlewares/jwt'
import { persistentConversationStore } from './conversation-store'
import {
  getCampaignCreators,
  getCampaignCreatorWithCampaignDetails,
  updateCampaignCreatorState,
  getCampaignCreatorsWithDetails
} from '@/api/campaign-creator'
import { generateEmailTemplate } from '@/api/outreach-email'
import { sendOutreachEmailProgrammatic } from '@/api/email'

// In-memory cache for email templates (cleared on server restart)
const emailTemplateCache = new Map<
  string,
  {
    subject: string
    body: string
    emailData: Record<string, unknown>
    timestamp: number
  }
>()

// Cache expiry time: 1 hour
const TEMPLATE_CACHE_TTL = 60 * 60 * 1000

// Helper function to clean expired cache entries
function cleanExpiredTemplates() {
  const now = Date.now()
  for (const [key, value] of emailTemplateCache.entries()) {
    if (now - value.timestamp > TEMPLATE_CACHE_TTL) {
      emailTemplateCache.delete(key)
    }
  }
}

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
          (creator) =>
            creator.handle.toLowerCase() === handle.toLowerCase() ||
            creator.name.toLowerCase() === handle.toLowerCase()
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

// Function to execute bulk outreach emails
export async function executeBulkOutreach(
  params: {
    campaignId: string
    creatorIds?: string[] // Optional: specific creator IDs, if not provided, send to all eligible creators
    personalizedMessage?: string
    confirmTemplate?: boolean // Whether to show template confirmation first (defaults to true for safety)
  },
  _user: UserJwt,
  conversationId: string
) {
  try {
    // Default to showing template confirmation for safety
    const shouldConfirmTemplate = params.confirmTemplate !== false

    // Define cache key once for both preview and send operations
    const templateCacheKey = `bulkOutreachTemplate_${params.campaignId}_${conversationId}`

    // Validate campaign exists and get details
    const campaign = await getCampaignById(params.campaignId)
    if (!campaign) {
      return {
        success: false,
        error: `Campaign with ID ${params.campaignId} not found`
      }
    }

    // Get all campaign-creator links for this campaign
    const campaignCreatorLinks = await getCampaignCreators({
      campaignId: params.campaignId,
      limit: 100
    })

    if (!campaignCreatorLinks.items || campaignCreatorLinks.items.length === 0) {
      return {
        success: false,
        error: 'No creators found in this campaign'
      }
    }

    // Filter creators based on:
    // 1. Specific creator IDs if provided
    // 2. Current state (exclude already contacted creators)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eligibleCreators = campaignCreatorLinks.items.filter((link: Record<string, any>) => {
      // Check if creator is in specific list (if provided)
      if (params.creatorIds && params.creatorIds.length > 0) {
        if (!params.creatorIds.includes(link.id.toString())) {
          return false
        }
      }

      // Exclude creators who have already been contacted
      const excludedStates = [
        'outreached',
        'call_initiated',
        'negotiating',
        'deal_finalized',
        'contract_sent',
        'contract_signed',
        'content_delivered',
        'payment_processed'
      ]
      return !excludedStates.includes(link.current_state)
    })

    if (eligibleCreators.length === 0) {
      return {
        success: false,
        error:
          'No eligible creators found. All creators in this campaign have already been contacted or are in advanced stages.'
      }
    }

    // If confirmTemplate is true, generate preview for first creator and return for confirmation
    if (shouldConfirmTemplate) {
      const firstCreator = eligibleCreators[0]
      const creatorDetails = await getCampaignCreatorWithCampaignDetails(firstCreator.id.toString())

      if (!creatorDetails) {
        return {
          success: false,
          error: 'Failed to get creator details for template preview'
        }
      }

      // Generate sample email template with placeholders
      const emailData = {
        subject: `Partnership Opportunity with ${campaign.name}`,
        recipient: {
          name: '{{CREATOR_NAME}}',
          email: 'sample@example.com'
        },
        campaignDetails: creatorDetails.campaign_description || campaign.description || '',
        brandName: 'Your Brand', // TODO: Get from company details
        campaignName: campaign.name,
        personalizedMessage: params.personalizedMessage || '',
        negotiationLink: '{{NEGOTIATION_LINK}}'
      }

      const templateEmail = await generateEmailTemplate(emailData)

      // Cache the template for later use during actual sending
      cleanExpiredTemplates() // Clean old entries before adding new one
      emailTemplateCache.set(templateCacheKey, {
        subject: templateEmail.subject,
        body: templateEmail.body,
        emailData,
        timestamp: Date.now()
      })

      log.info(
        `Cached email template for campaign ${params.campaignId} in conversation ${conversationId}`
      )

      // Create a sample with placeholders preserved for preview
      const sampleEmail = {
        subject: templateEmail.subject, // Keep placeholder in subject for preview
        body: templateEmail.body // Keep all placeholders in body for preview
      }

      return {
        success: true,
        data: {
          templatePreview: true,
          campaignName: campaign.name,
          eligibleCreatorsCount: eligibleCreators.length,
          sampleEmail,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eligibleCreators: eligibleCreators.map((creator: any) => ({
            id: creator.id,
            name: creator.creator?.name || 'Unknown',
            handle: creator.creator?.meta?.handle || 'Unknown',
            currentState: creator.current_state
          }))
        }
      }
    }

    // Execute bulk outreach using cached template if available, otherwise generate new one
    const results = []
    const errors = []

    // Try to get cached template first
    let cachedTemplate = emailTemplateCache.get(templateCacheKey)

    // Check if cached template is still valid (not expired)
    if (cachedTemplate && Date.now() - cachedTemplate.timestamp > TEMPLATE_CACHE_TTL) {
      emailTemplateCache.delete(templateCacheKey)
      cachedTemplate = undefined
      log.info(`Expired cached template for campaign ${params.campaignId}`)
    }

    let emailTemplate = null

    if (cachedTemplate) {
      // Use the cached template (ensures consistency with preview)
      emailTemplate = {
        subject: cachedTemplate.subject,
        body: cachedTemplate.body
      }
      log.info(`Using cached email template for campaign ${params.campaignId}`)
    } else {
      // Generate a new email template using AI (fallback if no cache)
      log.info(
        `No cached template found, generating new template for campaign ${params.campaignId}`
      )
      try {
        // Use the first creator's data to generate a template
        const firstCreator = eligibleCreators[0]
        const firstCreatorDetails = await getCampaignCreatorWithCampaignDetails(
          firstCreator.id.toString()
        )

        if (!firstCreatorDetails) {
          return {
            success: false,
            error: 'Failed to get creator details for template generation'
          }
        }

        const templateData = {
          subject: `Partnership Opportunity with ${campaign.name}`,
          recipient: {
            name: '{{CREATOR_NAME}}', // Placeholder
            email: 'template@example.com'
          },
          campaignDetails: firstCreatorDetails.campaign_description || campaign.description || '',
          brandName: 'Your Brand',
          campaignName: campaign.name,
          personalizedMessage: params.personalizedMessage || '',
          negotiationLink: '{{NEGOTIATION_LINK}}' // Placeholder
        }

        emailTemplate = await generateEmailTemplate(templateData)
        log.info('Generated new email template successfully')
      } catch (error) {
        log.error('Error generating email template:', error)
        return {
          success: false,
          error: 'Failed to generate email template'
        }
      }
    }

    // Now process all creators using the template
    for (const creatorLink of eligibleCreators) {
      try {
        const creatorDetails = await getCampaignCreatorWithCampaignDetails(
          creatorLink.id.toString()
        )

        if (!creatorDetails) {
          errors.push(
            `Failed to get details for creator ${creatorLink.creator?.name || creatorLink.id}`
          )
          continue
        }

        // Substitute placeholders in the template
        const personalizedSubject = emailTemplate.subject.replace(
          /{{CREATOR_NAME}}/g,
          creatorDetails.creator_name
        )
        const personalizedBody = emailTemplate.body
          .replace(/{{CREATOR_NAME}}/g, creatorDetails.creator_name)
          .replace(
            /{{NEGOTIATION_LINK}}/g,
            `${process.env.FRONTEND_URL || 'http://localhost:3000'}/agent-call?id=${creatorLink.id}`
          )

        // Send the personalized email
        const emailResult = await sendOutreachEmailProgrammatic({
          to: creatorDetails.creator_email || 'gammagang100x@gmail.com',
          subject: personalizedSubject,
          text: personalizedBody,
          html: personalizedBody.replace(/\n/g, '<br>')
        })

        if (emailResult.success) {
          await updateCampaignCreatorState(creatorLink.id.toString(), 'outreached')

          results.push({
            creatorId: creatorLink.id,
            creatorName: creatorDetails.creator_name,
            creatorEmail: creatorDetails.creator_email || 'gammagang100x@gmail.com',
            status: 'sent',
            emailSubject: personalizedSubject
          })

          log.info(`Successfully sent outreach email to creator ${creatorDetails.creator_name}`)
        } else {
          errors.push(
            `Failed to send email to ${creatorDetails.creator_name}: ${emailResult.error}`
          )
        }
      } catch (error) {
        log.error(`Error sending outreach to creator ${creatorLink.id}:`, error)
        errors.push(
          `Error processing creator ${creatorLink.creator?.name || creatorLink.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    // Clean up the cached template after successful bulk outreach
    if (emailTemplateCache.has(templateCacheKey)) {
      emailTemplateCache.delete(templateCacheKey)
      log.info(`Cleaned up cached template for campaign ${params.campaignId}`)
    }

    return {
      success: true,
      data: {
        campaignId: params.campaignId,
        campaignName: campaign.name,
        totalEligible: eligibleCreators.length,
        totalSent: results.length,
        successfulOutreach: results,
        errors: errors.length > 0 ? errors : undefined
      }
    }
  } catch (error) {
    log.error('Error in executeBulkOutreach:', error)
    return {
      success: false,
      error: `Failed to execute bulk outreach. ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Function to execute campaign deletion
export async function executeDeleteCampaign(
  params: { campaignId: string; confirmDelete: boolean },
  user: UserJwt
) {
  try {
    // Validate parameters
    if (!params.confirmDelete) {
      return {
        success: false,
        error: 'Delete confirmation is required'
      }
    }

    if (!params.campaignId) {
      return {
        success: false,
        error: 'Campaign ID is required'
      }
    }

    // Get the user's company
    const company = await findCompanyByUserId(user.sub)
    if (!company?.id) {
      return {
        success: false,
        error: 'No company found for the user'
      }
    }

    // Verify campaign exists and belongs to user's company
    const campaign = await getCampaignById(params.campaignId)
    if (!campaign) {
      return {
        success: false,
        error: 'Campaign not found'
      }
    }

    if (campaign.company_id.toString() !== company.id.toString()) {
      return {
        success: false,
        error: 'Unauthorized: Campaign does not belong to your company'
      }
    }

    // Delete the campaign
    const result = await deleteCampaign(params.campaignId, company.id.toString())

    log.info(`Successfully deleted campaign ${params.campaignId}`, {
      campaignName: result.deletedCampaign.name,
      deletedCreatorsCount: result.deletedCreators.length
    })

    return {
      success: true,
      data: {
        campaignId: params.campaignId,
        campaignName: result.deletedCampaign.name,
        deletedCreatorsCount: result.deletedCreators.length,
        message: `Campaign "${result.deletedCampaign.name}" has been successfully deleted${
          result.deletedCreators.length > 0
            ? ` along with ${result.deletedCreators.length} creator(s) that were only linked to this campaign across all companies.`
            : '.'
        }`
      }
    }
  } catch (error) {
    log.error('Error in executeDeleteCampaign:', error)
    return {
      success: false,
      error: `Failed to delete campaign. ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// This function has been removed as it was redundant with smart_campaign_status
// Use smart_campaign_status for campaign status overview
// Use get_campaign_creator_details for individual creator information

// Function to execute smart campaign status check (handles no campaigns, single campaign, multiple campaigns)
export async function executeSmartCampaignStatus(user: UserJwt) {
  try {
    log.info('Executing smart campaign status check for user:', user.sub)

    // First, get all campaigns for the user
    const campaignsResult = await executeListCampaigns(user)

    if (!campaignsResult.success || !campaignsResult.data?.campaigns) {
      return {
        success: false,
        error: 'Failed to retrieve campaigns'
      }
    }

    const campaigns = campaignsResult.data.campaigns

    // No campaigns: Suggest creating one
    if (campaigns.length === 0) {
      return {
        success: true,
        data: {
          type: 'no_campaigns' as const,
          message: "You don't have any campaigns yet. Would you like me to help you create one?",
          campaigns: [],
          totalCampaigns: 0
        }
      }
    }

    // Single campaign: Get status directly using the more efficient approach
    if (campaigns.length === 1) {
      // Get campaign creators for status calculation
      const creators = await getCampaignCreators({
        campaignId: campaigns[0].id.toString(),
        creatorId: undefined,
        status: undefined,
        page: 1,
        limit: 1000
      })

      // Calculate status counts inline for efficiency
      const statusCounts = creators.items.reduce((acc: Record<string, number>, creator) => {
        const status = creator.current_state || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})

      const totalCreators = creators.items.length
      const lifecycleStages = [
        'discovered',
        'outreached',
        'call complete',
        'waiting for contract',
        'waiting for signature',
        'onboarded',
        'fulfilled'
      ]

      const statusBreakdown = lifecycleStages.map((stage) => ({
        stage,
        count: statusCounts[stage] || 0,
        percentage:
          totalCreators > 0 ? Math.round(((statusCounts[stage] || 0) / totalCreators) * 100) : 0
      }))

      // Add other statuses
      Object.keys(statusCounts).forEach((status) => {
        if (!lifecycleStages.includes(status)) {
          statusBreakdown.push({
            stage: status,
            count: statusCounts[status],
            percentage:
              totalCreators > 0 ? Math.round((statusCounts[status] / totalCreators) * 100) : 0
          })
        }
      })

      return {
        success: true,
        data: {
          type: 'single_campaign_status' as const,
          campaign: campaigns[0],
          status: {
            campaignId: campaigns[0].id.toString(),
            campaignName: campaigns[0].name,
            totalCreators,
            statusCounts,
            statusBreakdown,
            lastUpdated: new Date().toISOString()
          },
          totalCampaigns: 1
        }
      }
    }

    // Multiple campaigns: Show selection interface
    return {
      success: true,
      data: {
        type: 'multiple_campaigns' as const,
        message: "You have multiple campaigns. Which campaign's status would you like to check?",
        campaigns: campaigns.map((c) => ({
          id: c.id.toString(),
          name: c.name,
          description: c.description,
          startDate: c.startDate,
          endDate: c.endDate,
          status: c.status,
          createdAt: c.createdAt,
          deliverables: c.deliverables,
          totalBudget: c.totalBudget?.toString() || null
        })),
        totalCampaigns: campaigns.length
      }
    }
  } catch (error) {
    log.error('Error in executeSmartCampaignStatus:', error)
    return {
      success: false,
      error: `Failed to check campaign status. ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Function to execute getting detailed creator statuses in a campaign with filtering
export async function executeGetCampaignCreatorDetails(
  params: {
    campaignId: string
    status?: string | string[] // Filter by specific status(es)
    limit?: number
  },
  user: UserJwt
) {
  try {
    log.info('Executing getCampaignCreatorDetails:', {
      campaignId: params.campaignId,
      status: params.status,
      userId: user.sub
    })

    // Get the user's company
    const company = await findCompanyByUserId(user.sub || '')
    if (!company?.id) {
      return {
        success: false,
        error: 'No company found for the user'
      }
    }

    // Get campaign to verify ownership
    const campaign = await getCampaignById(params.campaignId)
    if (!campaign) {
      return {
        success: false,
        error: `Campaign with ID ${params.campaignId} not found`
      }
    }

    // Verify that the campaign belongs to the user's company
    if (campaign.company_id.toString() !== company.id.toString()) {
      return {
        success: false,
        error: 'You do not have permission to access this campaign'
      }
    }

    // Get all creators in the campaign with full creator details
    const creatorsResult = await getCampaignCreatorsWithDetails({
      campaignId: params.campaignId,
      status: params.status,
      limit: params.limit || 1000
    })

    // Transform creator data for detailed view
    const detailedCreators = creatorsResult.map((creator) => ({
      id: creator.cc_id?.toString() || '',
      creatorId: creator.creator_id?.toString() || '',
      handle: creator.creator_handle || 'Unknown',
      name: creator.creator_name || creator.creator_handle || 'Unknown',
      platform: creator.creator_platform || 'instagram',
      category: creator.creator_category || null,
      followersCount: creator.followers_count || 0,
      tier: creator.creator_tier || mapFollowerCountToTier(creator.followers_count || 0),
      engagement_rate: creator.creator_engagement_rate || 0,
      location: creator.creator_location || null,
      country: creator.creator_country || null,
      gender: creator.creator_gender || null,
      language: creator.creator_language || null,
      profileImageUrl: creator.profile_image_url || null,
      profileUrl: creator.profile_url || '',
      interests: creator.interests || [],
      qualityScore: creator.quality_score || null,
      currentState: creator.campaign_creator_current_state || 'unknown',
      assignedBudget: creator.assigned_budget || 0,
      notes: creator.cc_notes || null,
      createdAt: creator.cc_created_at,
      updatedAt: creator.cc_updated_at
    }))

    // Group by status for summary
    const statusSummary = detailedCreators.reduce((acc: Record<string, number>, creator) => {
      const status = creator.currentState
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    return {
      success: true,
      data: {
        campaignId: params.campaignId,
        campaignName: campaign.name,
        totalCreators: creatorsResult.length,
        filteredCount: detailedCreators.length,
        appliedFilters: params.status
          ? Array.isArray(params.status)
            ? params.status
            : [params.status]
          : [],
        statusSummary,
        creators: detailedCreators,
        lastUpdated: new Date().toISOString()
      }
    }
  } catch (error) {
    log.error('Error in executeGetCampaignCreatorDetails:', error)
    return {
      success: false,
      error: `Failed to get campaign creator details. ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

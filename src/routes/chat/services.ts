import { discoverCreator, type DiscoverCreatorParams, mapFollowerCountToTier } from '@/api/discover'
import { createCampaign, getCampaignsByCompanyId, deleteCampaign } from '@/api/campaign'
import { addCreatorToCampaign } from '@/api/creator'
import { findCompanyByUserId } from '@/api/company'
import { CreateCampaignReq } from '@/routes/campaign/validate'
import { log } from '@/libs/logger'
import { type CreateCampaignChatParams } from './types'
import { type UserJwt } from '@/middlewares/jwt'
import {
  getCampaignSummary as getCampaignSummaryCore,
  getCampaignStatus as getCampaignStatusCore,
  getCampaignCreators as getCampaignCreatorsCore,
  validateCampaignAccess as validateCampaignAccessCore
} from '@/services/core/campaign'
import { persistentConversationStore } from './conversation-store'
import {
  getCampaignCreators,
  getCampaignCreatorWithCampaignDetails,
  updateCampaignCreatorState
} from '@/api/campaign-creator'
import { generateEmailTemplate } from '@/api/outreach-email'
import { sendOutreachEmailProgrammatic } from '@/api/email'
import {
  createCampaignFromWebsite,
  type CreateCampaignFromWebsiteParams,
  type CampaignExtractionResult
} from '@/api/create-campaign-from-website'
import {
  createBrandProfileFromWebsite,
  type CreateBrandProfileFromWebsiteParams,
  type BrandProfileExtractionResult
} from '@/api/create-brand-profile-from-website'

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

    // Transform the results - only include essential fields for the frontend
    const transformedCreators = discoveryResult.objects.map((creator) => ({
      id: creator._id,
      name: creator.full_name || creator.handle,
      handle: creator.handle,
      category: creator.category,
      followersCount: creator.followers,
      tier: mapFollowerCountToTier(creator.followers),
      engagement_rate: creator.engagement / 100,
      location: creator.location,
      profileImageUrl: creator.image_link,
      profileUrl: creator.handle_link, // For user to view profile
      interests: creator.interests?.slice(0, 5) || [] // Limit to first 5 interests
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

// Function to execute campaign creation from website
export async function executeCreateCampaignFromWebsite(
  params: CreateCampaignFromWebsiteParams,
  user: UserJwt
): Promise<{
  success: boolean
  data?: {
    extractedInfo?: CampaignExtractionResult
    missingRequiredFields?: string[]
    canCreateCampaign?: boolean
    campaign?: CampaignResult
  }
  error?: string
  message?: string
}> {
  try {
    log.info('Creating campaign from website with params:', params)

    // Step 1: Analyze the website and extract campaign information
    const result = await createCampaignFromWebsite(params)

    // Step 2: Check if we can create the campaign
    if (result.canCreateCampaign && result.suggestedCampaignData) {
      // All required fields are available, create the campaign
      const createCampaignParams: CreateCampaignChatParams = {
        name: result.suggestedCampaignData.name,
        description: result.suggestedCampaignData.description,
        startDate: result.suggestedCampaignData.startDate!,
        endDate: result.suggestedCampaignData.endDate!,
        deliverables: result.suggestedCampaignData.deliverables
      }

      // Create the campaign using the existing function
      const campaignResult = await executeCreateCampaign(createCampaignParams, user)

      if (campaignResult.success) {
        return {
          success: true,
          data: {
            extractedInfo: result.extractedInfo,
            campaign: campaignResult.data?.campaign
          },
          message: `Campaign "${result.suggestedCampaignData.name}" created successfully based on the website analysis!`
        }
      } else {
        return {
          success: false,
          error: campaignResult.error,
          data: {
            extractedInfo: result.extractedInfo,
            missingRequiredFields: result.missingRequiredFields,
            canCreateCampaign: false
          }
        }
      }
    } else {
      // Missing required fields, return the analysis for user to provide missing info
      return {
        success: true,
        data: {
          extractedInfo: result.extractedInfo,
          missingRequiredFields: result.missingRequiredFields,
          canCreateCampaign: false
        },
        message: `Website analyzed successfully! I found some information but need additional details: ${result.missingRequiredFields.join(', ')}. Please provide these details so I can create the campaign.`
      }
    }
  } catch (error) {
    log.error('Error in executeCreateCampaignFromWebsite:', error)

    // Check if it's a service unavailable error (503) from Groq
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (errorMessage.includes('503') || errorMessage.includes('Service unavailable')) {
      return {
        success: false,
        error:
          'AI service is temporarily unavailable. Please try again in a few minutes or provide campaign details manually.'
      }
    }

    return {
      success: false,
      error: `Failed to analyze website for campaign creation: ${errorMessage}`
    }
  }
}

// Function to execute brand profile creation from website
export async function executeCreateBrandProfileFromWebsite(
  params: CreateBrandProfileFromWebsiteParams,
  user: UserJwt
): Promise<{
  success: boolean
  data?: {
    extractedInfo?: BrandProfileExtractionResult
    missingRequiredFields?: string[]
    canCreateProfile?: boolean
    company?: object
  }
  error?: string
  message?: string
}> {
  try {
    log.info('Creating brand profile from website with params:', params)

    // Step 1: Analyze the website and extract brand profile information
    const result = await createBrandProfileFromWebsite(params)

    // Step 2: Check if we can create the brand profile
    if (result.canCreateProfile && result.suggestedProfileData) {
      // All required fields are available, create the company/brand profile
      const { createCompany } = await import('@/api/company')

      const newCompany = await createCompany({
        name: result.suggestedProfileData.name,
        website: result.suggestedProfileData.website,
        category: result.suggestedProfileData.category,
        owner: user.email,
        description: result.suggestedProfileData.description || null,
        user_id: user.sub,
        meta: { phone: result.suggestedProfileData.phone }
      })

      return {
        success: true,
        data: {
          extractedInfo: result.extractedInfo,
          company: newCompany
        },
        message: `Brand profile "${result.suggestedProfileData.name}" created successfully based on the website analysis!`
      }
    } else {
      // Missing required fields, return the analysis for user to provide missing info
      return {
        success: true,
        data: {
          extractedInfo: result.extractedInfo,
          missingRequiredFields: result.missingRequiredFields,
          canCreateProfile: false
        },
        message: `Website analyzed successfully! I found some information but need additional details: ${result.missingRequiredFields.join(', ')}. Please provide these details so I can create the brand profile.`
      }
    }
  } catch (error) {
    log.error('Error in executeCreateBrandProfileFromWebsite:', error)
    if (error instanceof Error) {
      log.error('Error message:', error.message)
      log.error('Error stack:', error.stack)
    }
    return {
      success: false,
      error: `Failed to analyze website for brand profile creation: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      status: campaign.state,
      startDate: campaign.start_date,
      endDate: campaign.end_date
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

    // Validate user has access to this campaign
    const { campaign } = await validateCampaignAccessCore(params.campaignId, user)

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
  user: UserJwt,
  conversationId: string
) {
  try {
    // Default to showing template confirmation for safety
    const shouldConfirmTemplate = params.confirmTemplate !== false

    // Validate user has access to this campaign
    const { campaign } = await validateCampaignAccessCore(params.campaignId, user)

    // Define cache key once for both preview and send operations
    const templateCacheKey = `bulkOutreachTemplate_${params.campaignId}_${conversationId}`

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
          sampleEmail
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
            `${process.env.FRONTEND_URL || 'http://localhost:8080'}/agent-call?id=${creatorLink.id}`
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
            creatorName: creatorDetails.creator_name,
            status: 'sent'
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

    // Validate user has access to this campaign
    const { company } = await validateCampaignAccessCore(params.campaignId, user)

    // Delete the campaign
    const result = await deleteCampaign(
      params.campaignId,
      (company as unknown as { id: string }).id.toString()
    )

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

// Function to execute campaign status check (handles no campaigns, single campaign, multiple campaigns)
export async function executeCampaignStatus(user: UserJwt, params?: { campaignId?: string }) {
  try {
    const safeParams = params || {}

    log.info('Executing smart campaign status check for user:', {
      userId: user.sub,
      campaignId: safeParams.campaignId
    })

    // If campaignId is provided, get status for that specific campaign
    if (safeParams.campaignId) {
      log.info('Getting status for specific campaign:', { campaignId: safeParams.campaignId })

      const status = await getCampaignStatusCore(safeParams.campaignId, user)

      return {
        success: true,
        data: {
          type: 'single_campaign_status' as const,
          campaignName: status.campaignName,
          totalCreators: status.totalCreators,
          statusSummary: status.statusCounts,
          lastUpdated: status.lastUpdated
        }
      }
    }

    // Get campaign summary when no specific campaign is requested
    const summary = await getCampaignSummaryCore(user)

    // No campaigns: Suggest creating one
    if (summary.totalCampaigns === 0) {
      return {
        success: true,
        data: {
          stepType: 'intermediary',
          type: 'no_campaigns' as const,
          message: "You don't have any campaigns yet. Would you like me to help you create one?",
          campaigns: [],
          totalCampaigns: 0
        }
      }
    }

    // Single campaign: Get status directly
    if (summary.totalCampaigns === 1) {
      const singleCampaign = summary.campaigns[0]
      const status = await getCampaignStatusCore(singleCampaign.id, user)

      const lifecycleStages = [
        'discovered',
        'outreached',
        'call complete',
        'waiting for signature',
        'signatures complete',
        'onboarded',
        'fulfilled'
      ]

      const statusBreakdown = lifecycleStages.map((stage) => ({
        stage,
        count: status.statusCounts[stage] || 0,
        percentage:
          status.totalCreators > 0
            ? Math.round(((status.statusCounts[stage] || 0) / status.totalCreators) * 100)
            : 0
      }))

      // Add other statuses
      Object.keys(status.statusCounts).forEach((statusKey) => {
        if (!lifecycleStages.includes(statusKey)) {
          statusBreakdown.push({
            stage: statusKey,
            count: status.statusCounts[statusKey],
            percentage:
              status.totalCreators > 0
                ? Math.round((status.statusCounts[statusKey] / status.totalCreators) * 100)
                : 0
          })
        }
      })

      return {
        success: true,
        data: {
          type: 'single_campaign_status' as const,
          campaignName: singleCampaign.name,
          totalCreators: status.totalCreators,
          statusSummary: status.statusCounts,
          lastUpdated: status.lastUpdated
        }
      }
    }

    // Multiple campaigns: Show selection interface
    return {
      success: true,
      data: {
        type: 'multiple_campaigns' as const,
        message: "You have multiple campaigns. Which campaign's status would you like to check?",
        campaigns: summary.campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status
        })),
        totalCampaigns: summary.totalCampaigns
      }
    }
  } catch (error) {
    log.error('Error in executeCampaignStatus:', error)
    return {
      success: false,
      error: `Failed to check campaign status. ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Function to execute getting detailed creator statuses in a campaign with filtering
export async function executeGetCampaignCreatorDetails(
  user: UserJwt,
  params?: {
    campaignId?: string
    status?: string
    limit?: number
  }
) {
  try {
    // Handle case where params might be null/undefined
    const safeParams = params || {}

    log.info('executeGetCampaignCreatorDetails called with params:', {
      campaignId: safeParams.campaignId,
      status: safeParams.status,
      statusType: typeof safeParams.status,
      statusLength: safeParams.status?.length,
      limit: safeParams.limit,
      userId: user.sub
    })

    // If campaignId is provided, directly process that specific campaign
    if (safeParams.campaignId) {
      log.info('Processing specific campaign:', { campaignId: safeParams.campaignId })

      const creators = await getCampaignCreatorsCore(safeParams.campaignId, user, {
        status: safeParams.status,
        limit: safeParams.limit
      })

      // Group by status for summary
      const statusSummary = creators.reduce((acc: Record<string, number>, creator) => {
        const status = creator.status || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})

      return {
        success: true,
        data: {
          type: 'single_campaign_creator_details' as const,
          campaignName: 'Campaign', // We'd need to get this from the campaign data
          statusSummary,
          creators: creators.map((creator) => ({
            id: creator.id,
            name: creator.name,
            handle: creator.handle,
            currentState: creator.status
          })),
          lastUpdated: new Date().toISOString()
        }
      }
    }

    // Get campaign summary when no specific campaign is requested
    const summary = await getCampaignSummaryCore(user)

    // No campaigns: Suggest creating one
    if (summary.totalCampaigns === 0) {
      return {
        success: true,
        data: {
          stepType: 'intermediary',
          type: 'no_campaigns' as const,
          message: "You don't have any campaigns yet. Would you like me to help you create one?",
          campaigns: [],
          totalCampaigns: 0
        }
      }
    }

    // Single campaign: Get creator details directly
    if (summary.totalCampaigns === 1) {
      const singleCampaign = summary.campaigns[0]
      const creators = await getCampaignCreatorsCore(singleCampaign.id, user, {
        status: safeParams.status,
        limit: safeParams.limit
      })

      // Group by status for summary
      const statusSummary = creators.reduce((acc: Record<string, number>, creator) => {
        const status = creator.status || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})

      return {
        success: true,
        data: {
          type: 'single_campaign_creator_details' as const,
          campaignName: singleCampaign.name,
          statusSummary,
          creators: creators.map((creator) => ({
            id: creator.id,
            name: creator.name,
            handle: creator.handle,
            currentState: creator.status
          })),
          lastUpdated: new Date().toISOString()
        }
      }
    }

    // Multiple campaigns: Show selection interface
    return {
      success: true,
      data: {
        type: 'multiple_campaigns' as const,
        message:
          "You have multiple campaigns. Which campaign's creator details would you like to see?",
        campaigns: summary.campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          startDate: c.startDate,
          endDate: c.endDate,
          status: c.status,
          createdAt: new Date().toISOString(), // We don't have this in the summary
          deliverables: [], // We don't have this in the summary
          totalBudget: null // We don't have this in the summary
        })),
        totalCampaigns: summary.totalCampaigns,
        requestedAction: 'get_campaign_creator_details',
        requestedParams: {
          status: safeParams.status,
          limit: safeParams.limit
        }
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

// Helper function to process creator details for a specific campaign
// Note: processCreatorDetails and validateCampaignAccess functions have been moved to /services/core/campaign.ts
// and are no longer needed here as the refactored functions use the core services directly

interface CreateCampaignFromProfileParams {
  name: string
  description?: string
  startDate: string
  endDate: string
  deliverables: string[]
  targetAudience?: string
  campaignGoals?: string[]
}

// Function to execute campaign creation from brand profile
export async function executeCreateCampaignFromProfile(
  params: CreateCampaignFromProfileParams,
  user: UserJwt
): Promise<{
  success: boolean
  data?: {
    campaign?: CampaignResult
    brandInfo?: {
      companyName: string
      description?: string
      category?: string
      targetAudience?: string
    }
  }
  error?: string
  message?: string
}> {
  try {
    log.info('Creating campaign from brand profile with params:', params)

    // Step 0: Validate required parameters
    if (!params.name || !params.startDate || !params.endDate || !params.deliverables?.length) {
      return {
        success: false,
        error:
          'Missing required campaign details. Please provide campaign name, start date, end date, and deliverables.'
      }
    }

    // Validate dates are not placeholder values
    if (
      params.startDate.includes('YYYY') ||
      params.endDate.includes('YYYY') ||
      params.startDate.includes('example') ||
      params.endDate.includes('example')
    ) {
      return {
        success: false,
        error: 'Please provide actual dates, not placeholder values.'
      }
    }

    // Validate name is not a placeholder
    if (
      params.name.toLowerCase().includes('example') ||
      params.name.toLowerCase().includes('placeholder') ||
      params.name.toLowerCase().includes('campaign name')
    ) {
      return {
        success: false,
        error: 'Please provide an actual campaign name, not a placeholder.'
      }
    }

    // Step 1: Get the user's company/brand profile
    const company = await findCompanyByUserId(user.sub)
    if (!company) {
      return {
        success: false,
        error:
          'No brand profile found. Please create a brand profile first before creating campaigns from it.'
      }
    }

    // Step 2: Generate campaign description if not provided
    let campaignDescription = params.description
    if (!campaignDescription) {
      // Create a description based on brand profile and campaign details
      campaignDescription = `${params.name} campaign for ${company.name}${params.targetAudience ? ` targeting ${params.targetAudience}` : ''}${params.campaignGoals ? `. Goals: ${params.campaignGoals.join(', ')}` : ''}.${company.description ? ` ${company.description}` : ''}`
    }

    // Step 3: Create the campaign using existing function
    const createCampaignParams: CreateCampaignChatParams = {
      name: params.name,
      description: campaignDescription,
      startDate: params.startDate,
      endDate: params.endDate,
      deliverables: params.deliverables
    }

    const campaignResult = await executeCreateCampaign(createCampaignParams, user)

    if (campaignResult.success) {
      return {
        success: true,
        data: {
          campaign: campaignResult.data?.campaign,
          brandInfo: {
            companyName: company.name,
            description: company.description || undefined,
            category: company.category || undefined,
            targetAudience: params.targetAudience
          }
        },
        message: `Campaign "${params.name}" created successfully using your brand profile for ${company.name}!`
      }
    } else {
      return {
        success: false,
        error: campaignResult.error || 'Failed to create campaign from brand profile'
      }
    }
  } catch (error) {
    log.error('Error in executeCreateCampaignFromProfile:', error)
    return {
      success: false,
      error: `Failed to create campaign from brand profile. ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

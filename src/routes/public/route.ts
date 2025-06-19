import { Request, Response, Router } from 'express'

import { getCampaignCreatorWithCampaignDetails } from '@/api/campaign-creator'
import { NotFoundError } from '@/errors/not-found-error'
import { SuccessResponse } from '@/libs/success-response'
import { elevenLabsRouter } from '../elevenlabs/route'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import { DocuSealWebhookSchema } from './validate'
import { updateContractStatus } from '@/api/contract'

const router = Router()
// NOTE: All public routes will have no JWT middleware

// Mount ElevenLabs routes under /elevenlabs
router.use('/elevenlabs', elevenLabsRouter)

// GET detailed campaign-creator information with related campaign data
router.get('/campaign-creator-details/:ccMappingId', async (req: Request, res: Response) => {
  const ccMappingId = req.params.ccMappingId

  // Get campaign-creator details with joined campaign data from database
  const result = await getCampaignCreatorWithCampaignDetails(ccMappingId)
  // console.log(' result:', result)

  if (!result)
    throw new NotFoundError(
      'Campaign-Creator mapping not found',
      `ccMappingId: ${ccMappingId} not found`,
      req.path
    )

  // Parse meta data to extract agreed deliverables and contract info
  const campaignCreatorMeta = result.campaign_creator_meta || {}
  const campaignMeta = result.campaign_meta || {} // Structure the response with campaignCreator and campaign objects
  const detailedResponse = {
    campaignCreator: {
      id: result.cc_id,
      campaignId: result.campaign_id,
      creatorId: result.creator_id,
      // lastStateChangeAt: result.last_state_change_at,
      assignedBudget: result.assigned_budget,
      contentDeliverables: campaignCreatorMeta?.campaignInfo?.contentDeliverables || '',
      contractId: campaignCreatorMeta.contractId || null,
      currentState: result.campaign_creator_current_state
    },
    campaign: {
      startDate: result.campaign_start_date,
      endDate: result.campaign_end_date,
      id: result.campaign_id,
      name: result.campaign_name,
      description: result.campaign_description,
      companyId: result.company_id,
      state: result.campaign_state,
      meta: campaignMeta
    },
    creator: {
      id: result.creator_id,
      name: result.creator_name,
      platform: result.creator_platform,
      category: result.creator_category,
      age: result.creator_age,
      gender: result.creator_gender,
      location: result.creator_location,
      tier: result.creator_tier,
      engagementRate: result.creator_engagement_rate,
      email: result.creator_email,
      phone: result.creator_phone,
      language: result.creator_language,
      meta: result.creator_meta || {}
    }
  }

  SuccessResponse.send({ res, data: detailedResponse })
})

router.post('/docuseal/webhook', async (req: Request, res: Response) => {
  // Validate the incoming webhook payload
  const validatedPayload = validateRequest(DocuSealWebhookSchema, req.body, req.path)

  // Extract important information
  const { event_type, timestamp, data } = validatedPayload
  const { email, status, role, documents, metadata = {} } = data
  log.info(
    `DocuSeal webhook received: ${event_type} for role ${role}, with email '${email}' and status ${status}`
  )
  log.info(`metadata & documents`, { metadata, documents })

  const contractId = metadata.contractId
  if (!contractId)
    throw new NotFoundError(
      'Contract ID not found in webhook payload',
      `No contractId found in metadata: ${JSON.stringify(metadata)}`,
      req.path
    )

  await updateContractStatus(contractId, event_type, role as 'Brand' | 'Creator')

  // Log the webhook event

  // Update Contract state in the database

  // Return success response
  SuccessResponse.send({
    res,
    status: 200,
    data: {
      message: 'Webhook processed successfully',
      event: event_type,
      timestamp: timestamp
    }
  })
})

export { router as publicRoutes }

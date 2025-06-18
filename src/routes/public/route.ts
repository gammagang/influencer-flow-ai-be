import { Request, Response, Router } from 'express'

import { getCampaignCreatorWithCampaignDetails } from '@/api/campaign-creator'
import { NotFoundError } from '@/errors/not-found-error'
import { SuccessResponse } from '@/libs/success-response'
import { elevenLabsRouter } from '../elevenlabs/route'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import { DocuSealWebhookSchema } from './validate'

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
  const { email, status, role, documents, template } = data

  // Log the webhook event
  log.info(`DocuSeal webhook received: ${event_type} for ${email} with status ${status}`)

  // Process the webhook based on event type
  switch (event_type) {
    case 'form.completed':
      // Handle completed form (signed contract)
      log.info(`Contract completed by ${role}: ${email}`)
      log.info(`Template: ${template.name}, Document: ${documents[0]?.name || 'Unknown'}`)

      // TODO: In a production environment, you would:
      // 1. Update the contract status in your database
      // 2. Notify relevant parties
      // 3. Store document URLs for future reference

      // Example processing code:
      // await contractService.updateContractStatus(data.external_id, 'signed');
      // await notificationService.notifyContractSigned(data.email, data.template.name);

      break

    case 'form.viewed':
      // Handle when the form is opened but not yet completed
      log.info(`Contract opened by ${role}: ${email}`)
      // TODO: Update contract status to 'viewed'
      break

    case 'form.declined':
      // Handle declined contracts
      log.info(`Contract declined by ${role}: ${email}`)
      log.info(`Decline reason: ${data.decline_reason || 'No reason provided'}`)
      // TODO: Update contract status to 'declined'
      break

    default:
      log.info(`Unhandled DocuSeal event type: ${event_type}`)
  }

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

import { Request, Response, Router } from 'express'

import { getCampaignCreatorWithCampaignDetails } from '@/api/campaign-creator'
import { NotFoundError } from '@/errors/not-found-error'
import { SuccessResponse } from '@/libs/success-response'
import { elevenLabsRouter } from '../elevenlabs/route'

const router = Router()
// NOTE: All public routes will have no JWT middleware

// Mount ElevenLabs routes under /elevenlabs
router.use('/elevenlabs', elevenLabsRouter)

// GET detailed campaign-creator information with related campaign data
router.get(
  '/campaign-creator-details/:campaignCreatorMappingId',
  async (req: Request, res: Response) => {
    const campaignCreatorMappingId = req.params.campaignCreatorMappingId

    // Get campaign-creator details with joined campaign data from database
    const result = await getCampaignCreatorWithCampaignDetails(campaignCreatorMappingId)
    // console.log(' result:', result)

    if (!result)
      throw new NotFoundError(
        'Campaign-Creator mapping not found',
        `campaignCreatorMappingId: ${campaignCreatorMappingId} not found`,
        req.path
      )

    // Parse meta data to extract agreed deliverables and contract info
    const campaignCreatorMeta = result.campaign_creator_meta || {}
    const campaignMeta = result.campaign_meta || {} // Structure the response with campaignCreator and campaign objects
    const detailedResponse = {
      campaignCreator: {
        id: result.id,
        campaignId: result.campaign_id,
        creatorId: result.creator_id,
        lastStateChangeAt: result.last_state_change_at,
        assignedBudget: result.assigned_budget,
        notes: result.notes,
        contentDeliverables: campaignCreatorMeta.contentDeliverables || [],
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
  }
)

router.post('/', async (req: Request, res: Response) => {
  SuccessResponse.send({ res, data: null, status: 201 })
})

export { router as publicRoutes }

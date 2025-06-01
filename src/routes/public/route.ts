import { Request, Response, Router } from 'express'

import { getCampaignCreatorWithCampaignDetails } from '@/api/campaign-creator'
import { NotFoundError } from '@/errors/not-found-error'
import { SuccessResponse } from '@/libs/success-response'

const router = Router()

// GET detailed campaign-creator information with related campaign data
router.get('/campaign_creator_details/:linkId', async (req: Request, res: Response) => {
  const linkId = req.params.linkId

  // Get campaign-creator details with joined campaign data from database
  const result = await getCampaignCreatorWithCampaignDetails(linkId)

  if (!result) {
    throw new NotFoundError(
      'Campaign-Creator link not found',
      `Link with ID ${linkId} not found`,
      req.path
    )
  }

  // Parse meta data to extract agreed deliverables and contract info
  const campaignCreatorMeta = result.campaign_creator_meta || {}
  const campaignMeta = result.campaign_meta || {} // Structure the response with campaignCreator and campaign objects
  const detailedResponse = {
    campaignCreator: {
      id: result.id,
      campaignId: result.campaign_id,
      creatorId: result.creator_id,
      currentState: result.current_state,
      lastStateChangeAt: result.last_state_change_at,
      assignedBudget: result.assigned_budget,
      notes: result.notes,
      agreedDeliverables: campaignCreatorMeta.agreedDeliverables || [],
      contractId: campaignCreatorMeta.contractId || null
    },
    campaign: {
      id: result.campaign_id,
      name: result.campaign_name,
      description: result.campaign_description,
      startDate: result.start_date,
      endDate: result.end_date,
      companyId: result.company_id,
      state: result.campaign_state,
      meta: campaignMeta
    }
  }

  SuccessResponse.send({ res, data: detailedResponse })
})

router.post('/', async (req: Request, res: Response) => {
  SuccessResponse.send({ res, data: null, status: 201 })
})

export { router as publicRoutes }

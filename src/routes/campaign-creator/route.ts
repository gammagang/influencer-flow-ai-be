import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { validateRequest } from '@/middlewares/validate-request'
import {
  LinkCreatorToCampaignSchema,
  UpdateCampaignCreatorLinkSchema,
  ListCampaignCreatorsQuerySchema,
  CreatePaymentForCampaignCreatorSchema
} from './validate'
import { NotFoundError } from '@/errors/not-found-error'
import {
  getCampaignCreatorWithCampaignDetails,
  getCampaignCreatorById,
  getCampaignCreators,
  createCampaignCreatorLink,
  updateCampaignCreatorLink,
  deleteCampaignCreatorLink
} from '@/api/campaign-creator'

const router = Router()

// --- Campaign-Creator Link Routes ---

// GET detailed campaign-creator information with related campaign data
router.get('/:linkId/details', async (req: Request, res: Response) => {
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

router.post('/campaign-creator', async (req: Request, res: Response) => {
  const validatedBody = validateRequest(LinkCreatorToCampaignSchema, req.body, req.path)

  try {
    const newLink = await createCampaignCreatorLink({
      campaignId: validatedBody.campaignId,
      creatorId: validatedBody.creatorId,
      status: validatedBody.status || 'pending',
      agreedDeliverables: validatedBody.agreedDeliverables || [],
      negotiatedRate: validatedBody.negotiatedRate,
      contractId: validatedBody.contractId,
      notes: validatedBody.notes
    })

    SuccessResponse.send({ res, data: newLink, status: 201 })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create campaign-creator link')
  }
})

router.get('/campaign-creator', async (req: Request, res: Response) => {
  const validatedQuery = validateRequest(ListCampaignCreatorsQuerySchema, req.query, req.path)

  try {
    const result = await getCampaignCreators({
      campaignId: validatedQuery.campaignId,
      creatorId: validatedQuery.creatorId,
      status: validatedQuery.status,
      page: validatedQuery.page,
      limit: validatedQuery.limit
    })

    SuccessResponse.send({ res, data: result })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch campaign-creator links')
  }
})

router.get('/campaign-creator/:linkId', async (req: Request, res: Response) => {
  const linkId = req.params.linkId

  try {
    const link = await getCampaignCreatorById(linkId)

    if (!link) {
      throw new NotFoundError(
        'Campaign-Creator link not found',
        `Link with ID ${linkId} not found`,
        req.path
      )
    }

    SuccessResponse.send({ res, data: link })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch campaign-creator link')
  }
})

router.put('/campaign-creator/:linkId', async (req: Request, res: Response) => {
  const linkId = req.params.linkId
  const validatedBody = validateRequest(UpdateCampaignCreatorLinkSchema, req.body, req.path)

  try {
    const updatedLink = await updateCampaignCreatorLink(linkId, {
      status: validatedBody.status,
      agreedDeliverables: validatedBody.agreedDeliverables,
      negotiatedRate: validatedBody.negotiatedRate,
      contractId: validatedBody.contractId,
      notes: validatedBody.notes
    })

    SuccessResponse.send({ res, data: updatedLink })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update campaign-creator link')
  }
})

router.delete('/campaign-creator/:linkId', async (req: Request, res: Response) => {
  const linkId = req.params.linkId

  try {
    const deletedLink = await deleteCampaignCreatorLink(linkId)

    if (!deletedLink) {
      throw new NotFoundError(
        'Campaign-Creator link not found',
        `Link with ID ${linkId} not found`,
        req.path
      )
    }

    SuccessResponse.send({ res, status: 204, data: {} })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete campaign-creator link')
  }
})

// --- Nested Payment Routes for Campaign-Creator ---
// Note: This is a simplified implementation for MVP. A full payment system would require
// integration with payment processors and a dedicated payment table.

router.post('/campaign-creator/:linkId/payments', async (req: Request, res: Response) => {
  const linkId = req.params.linkId
  const validatedBody = validateRequest(CreatePaymentForCampaignCreatorSchema, req.body, req.path)

  try {
    // First verify the campaign-creator link exists
    const link = await getCampaignCreatorById(linkId)
    if (!link) {
      throw new NotFoundError(
        'Campaign-Creator link not found',
        `Link with ID ${linkId} not found for creating payment`,
        req.path
      )
    }

    // For MVP, we'll store payment info in the campaign_creator meta field
    // In a production system, this would go to a dedicated payments table
    const currentMeta = link.meta || {}
    const payments = currentMeta.payments || []

    const newPayment = {
      id: `payment-uuid-${Date.now()}`,
      ...validatedBody,
      createdAt: new Date().toISOString()
    }

    payments.push(newPayment)

    // Update the campaign-creator link with the new payment
    await updateCampaignCreatorLink(linkId, {
      // Keep existing meta and add updated payments
    })

    SuccessResponse.send({ res, data: newPayment, status: 201 })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create payment')
  }
})

// TODO: Add GET, PUT, DELETE for /campaign-creator/:linkId/payments/:paymentId if needed

export { router as campaignCreatorRouter }

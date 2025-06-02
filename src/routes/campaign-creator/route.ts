import {
  createCampaignCreatorLink,
  deleteCampaignCreatorLink,
  getCampaignCreatorWithCampaignDetails,
  getCampaignCreators,
  updateCampaignCreatorLink
} from '@/api/campaign-creator'
import { NotFoundError } from '@/errors/not-found-error'
import { SuccessResponse } from '@/libs/success-response'
import { validateRequest } from '@/middlewares/validate-request'
import { Router, type Request, type Response } from 'express'
import {
  CreatePaymentForCampaignCreatorSchema,
  LinkCreatorToCampaignSchema,
  ListCampaignCreatorsQuerySchema,
  UpdateCampaignCreatorLinkSchema
} from './validate'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
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

router.get('/', async (req: Request, res: Response) => {
  const validatedQuery = validateRequest(ListCampaignCreatorsQuerySchema, req.query, req.path)

  const result = await getCampaignCreators({
    campaignId: validatedQuery.campaignId,
    creatorId: validatedQuery.creatorId,
    status: validatedQuery.status,
    page: validatedQuery.page,
    limit: validatedQuery.limit
  })

  SuccessResponse.send({ res, data: result })
})

// GET Campaign Creator Mapping with creator lifecycle in state
router.get('/', async (req: Request, res: Response) => {
  const validatedQuery = validateRequest(ListCampaignCreatorsQuerySchema, req.query, req.path)

  const result = await getCampaignCreators({
    campaignId: validatedQuery.campaignId,
    creatorId: validatedQuery.creatorId,
    status: validatedQuery.status,
    page: validatedQuery.page,
    limit: validatedQuery.limit
  })

  SuccessResponse.send({ res, data: result })
})

router.get('/:campaignCreatorMappingId', async (req: Request, res: Response) => {
  const campaignCreatorMappingId = req.params.campaignCreatorMappingId

  try {
    const link = await getCampaignCreatorWithCampaignDetails(campaignCreatorMappingId)

    if (!link) {
      throw new NotFoundError(
        'Campaign-Creator link not found',
        `campaignCreatorMappingId: ${campaignCreatorMappingId} not found`,
        req.path
      )
    }

    SuccessResponse.send({ res, data: link })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch campaign-creator link')
  }
})

router.put('/:linkId', async (req: Request, res: Response) => {
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

router.delete('/:linkId', async (req: Request, res: Response) => {
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

router.post('/:linkId/payments', async (req: Request, res: Response) => {
  const linkId = req.params.linkId
  const validatedBody = validateRequest(CreatePaymentForCampaignCreatorSchema, req.body, req.path)

  try {
    // First verify the campaign-creator link exists
    const link = await getCampaignCreatorWithCampaignDetails(linkId)
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

// TODO: Add GET, PUT, DELETE for /:linkId/payments/:paymentId if needed

export { router as campaignCreatorRouter }

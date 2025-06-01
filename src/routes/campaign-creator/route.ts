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

const router = Router()

// TODO: Replace with actual database interactions and service logic

// Mock database for campaign-creator links
const mockCampaignCreatorLinks: any[] = [
  {
    id: 'cc-link-uuid-1',
    campaignId: 'campaign-uuid-1', // From mockCampaigns
    creatorId: 'creator-uuid-1', // From mockCreators
    status: 'approved',
    agreedDeliverables: ['1 Instagram Post', '2 Instagram Stories'],
    negotiatedRate: 1200,
    contractId: 'contract-uuid-1', // Assuming a contract exists
    notes: 'Creator confirmed availability.',
    createdAt: new Date('2025-05-15T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2025-05-16T00:00:00.000Z').toISOString(),
    payments: [
      {
        id: 'payment-uuid-1',
        amount: 600,
        paymentDate: new Date('2025-05-20T00:00:00.000Z').toISOString(),
        paymentMethod: 'paypal',
        transactionId: 'paypal_tx_123',
        notes: 'First installment'
      }
    ]
  },
  {
    id: 'cc-link-uuid-2',
    campaignId: 'campaign-uuid-1',
    creatorId: 'creator-uuid-2',
    status: 'pending',
    agreedDeliverables: ['1 YouTube Video (60s+)'],
    negotiatedRate: 2500,
    contractId: null,
    notes: 'Awaiting creator response.',
    createdAt: new Date('2025-05-18T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2025-05-18T00:00:00.000Z').toISOString(),
    payments: []
  }
]

// --- Campaign-Creator Link Routes ---

router.post('/campaign-creator', async (req: Request, res: Response) => {
  const validatedBody = validateRequest(LinkCreatorToCampaignSchema, req.body, req.path)

  // TODO: Check if campaign and creator exist before linking
  // TODO: Ensure no duplicate link for the same campaignId and creatorId if that's a business rule
  const newLink = {
    id: `cc-link-uuid-${Date.now()}`,
    ...validatedBody,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    payments: []
  }
  mockCampaignCreatorLinks.push(newLink)
  SuccessResponse.send({ res, data: newLink, status: 201 })
})

router.get('/campaign-creator', async (req: Request, res: Response) => {
  const validatedQuery = validateRequest(ListCampaignCreatorsQuerySchema, req.query, req.path)

  // TODO: Implement actual filtering from a database
  let filteredLinks = [...mockCampaignCreatorLinks]
  if (validatedQuery.campaignId) {
    filteredLinks = filteredLinks.filter((link) => link.campaignId === validatedQuery.campaignId)
  }
  if (validatedQuery.creatorId) {
    filteredLinks = filteredLinks.filter((link) => link.creatorId === validatedQuery.creatorId)
  }
  if (validatedQuery.status) {
    filteredLinks = filteredLinks.filter((link) => link.status === validatedQuery.status)
  }

  const page = validatedQuery.page!
  const limit = validatedQuery.limit!
  const startIndex = (page - 1) * limit
  const endIndex = page * limit
  const paginatedLinks = filteredLinks.slice(startIndex, endIndex)

  SuccessResponse.send({
    res,
    data: {
      items: paginatedLinks,
      pagination: {
        total: filteredLinks.length,
        page,
        limit,
        totalPages: Math.ceil(filteredLinks.length / limit)
      }
    }
  })
})

router.get('/campaign-creator/:linkId', async (req: Request, res: Response) => {
  const linkId = req.params.linkId
  const link = mockCampaignCreatorLinks.find((l) => l.id === linkId)

  if (!link) {
    throw new NotFoundError(
      'Campaign-Creator link not found',
      `Link with ID ${linkId} not found`,
      req.path
    )
  }
  SuccessResponse.send({ res, data: link })
})

router.put('/campaign-creator/:linkId', async (req: Request, res: Response) => {
  const linkId = req.params.linkId
  const validatedBody = validateRequest(UpdateCampaignCreatorLinkSchema, req.body, req.path)

  const linkIndex = mockCampaignCreatorLinks.findIndex((l) => l.id === linkId)
  if (linkIndex === -1) {
    throw new NotFoundError(
      'Campaign-Creator link not found',
      `Link with ID ${linkId} not found`,
      req.path
    )
  }

  const updatedLink = {
    ...mockCampaignCreatorLinks[linkIndex],
    ...validatedBody,
    updatedAt: new Date().toISOString()
  }
  mockCampaignCreatorLinks[linkIndex] = updatedLink
  SuccessResponse.send({ res, data: updatedLink })
})

router.delete('/campaign-creator/:linkId', async (req: Request, res: Response) => {
  const linkId = req.params.linkId
  const linkIndex = mockCampaignCreatorLinks.findIndex((l) => l.id === linkId)

  if (linkIndex === -1) {
    throw new NotFoundError(
      'Campaign-Creator link not found',
      `Link with ID ${linkId} not found`,
      req.path
    )
  }
  mockCampaignCreatorLinks.splice(linkIndex, 1)
  SuccessResponse.send({ res, status: 204, data: {} })
})

// --- Nested Payment Routes for Campaign-Creator ---
// Example: POST /campaign-creator/{linkId}/payments

router.post('/campaign-creator/:linkId/payments', async (req: Request, res: Response) => {
  const linkId = req.params.linkId
  const validatedBody = validateRequest(CreatePaymentForCampaignCreatorSchema, req.body, req.path)

  const linkIndex = mockCampaignCreatorLinks.findIndex((l) => l.id === linkId)
  if (linkIndex === -1) {
    throw new NotFoundError(
      'Campaign-Creator link not found',
      `Link with ID ${linkId} not found for creating payment`,
      req.path
    )
  }

  const newPayment = {
    id: `payment-uuid-${Date.now()}`,
    ...validatedBody,
    createdAt: new Date().toISOString() // Assuming payments also have timestamps
  }

  mockCampaignCreatorLinks[linkIndex].payments.push(newPayment)
  SuccessResponse.send({ res, data: newPayment, status: 201 })
})

// TODO: Add GET, PUT, DELETE for /campaign-creator/:linkId/payments/:paymentId if needed

export { router as campaignCreatorRouter }

import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import {
  CreateCampaignReqSchema,
  UpdateCampaignReqSchema,
  ListCampaignsQuerySchema
} from './validate'
import { NotFoundError } from '@/errors/not-found-error'

const router = Router()

// TODO: Replace with actual database interactions and service logic

// Mock database for campaigns
const mockCampaigns: any[] = [
  {
    id: 'campaign-uuid-1',
    name: 'Summer Sale Campaign',
    description: 'Promotional campaign for summer products.',
    startDate: new Date('2025-06-01T00:00:00.000Z').toISOString(),
    endDate: new Date('2025-08-31T23:59:59.000Z').toISOString(),
    budget: 50000,
    companyId: 'company-uuid-123', // Relates to the sample company
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta: { engagementRate: '15%', totalReach: 120000 }
  },
  {
    id: 'campaign-uuid-2',
    name: 'New Product Launch',
    description: 'Campaign to launch the new XZ series.',
    startDate: new Date('2025-09-15T00:00:00.000Z').toISOString(),
    endDate: new Date('2025-10-15T23:59:59.000Z').toISOString(),
    budget: 75000,
    companyId: 'company-uuid-123',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta: { preLaunchSignups: 500 }
  }
]

router.get('/campaigns', async (req: Request, res: Response) => {
  log.info('Controller: GET /campaigns')
  const validatedQuery = validateRequest(ListCampaignsQuerySchema, req.query, req.path)

  let filteredCampaigns = [...mockCampaigns]
  if (validatedQuery.companyId) {
    filteredCampaigns = filteredCampaigns.filter((c) => c.companyId === validatedQuery.companyId)
  }
  if (validatedQuery.status) {
    filteredCampaigns = filteredCampaigns.filter((c) => c.status === validatedQuery.status)
  }

  const page = validatedQuery.page || 0
  const limit = validatedQuery.limit || 10
  const startIndex = (page - 1) * limit
  const endIndex = page * limit
  const paginatedCampaigns = filteredCampaigns.slice(startIndex, endIndex)

  SuccessResponse.send({
    res,
    data: {
      items: paginatedCampaigns,
      pagination: {
        total: filteredCampaigns.length,
        page,
        limit,
        totalPages: Math.ceil(filteredCampaigns.length / limit)
      }
    }
  })
})

router.get('/campaigns/:id', async (req: Request, res: Response) => {
  log.info(`Controller: GET /campaigns/${req.params.id}`)
  const campaignId = req.params.id
  const campaign = mockCampaigns.find((c) => c.id === campaignId)

  if (!campaign) {
    throw new NotFoundError(
      'Campaign not found',
      `Campaign with ID ${campaignId} not found`,
      req.path
    )
  }
  SuccessResponse.send({ res, data: campaign })
})

router.post('/campaigns', async (req: Request, res: Response) => {
  log.info('Controller: POST /campaigns')
  const validatedBody = validateRequest(CreateCampaignReqSchema, req.body, req.path)

  const newCampaign = {
    id: `campaign-uuid-${Date.now()}`,
    ...validatedBody,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta: { initialEnrichmentStatus: 'pending' }
  }
  mockCampaigns.push(newCampaign)
  SuccessResponse.send({ res, data: newCampaign, status: 201 })
})

router.put('/campaigns/:id', async (req: Request, res: Response) => {
  log.info(`Controller: PUT /campaigns/${req.params.id}`)
  const campaignId = req.params.id
  const validatedBody = validateRequest(UpdateCampaignReqSchema, req.body, req.path)

  const campaignIndex = mockCampaigns.findIndex((c) => c.id === campaignId)
  if (campaignIndex === -1) {
    throw new NotFoundError(
      'Campaign not found',
      `Campaign with ID ${campaignId} not found`,
      req.path
    )
  }

  const updatedCampaign = {
    ...mockCampaigns[campaignIndex],
    ...validatedBody,
    updatedAt: new Date().toISOString()
  }
  mockCampaigns[campaignIndex] = updatedCampaign

  SuccessResponse.send({ res, data: updatedCampaign })
})

router.delete('/campaigns/:id', async (req: Request, res: Response) => {
  log.info(`Controller: DELETE /campaigns/${req.params.id}`)
  const campaignId = req.params.id

  const campaignIndex = mockCampaigns.findIndex((c) => c.id === campaignId)
  if (campaignIndex === -1) {
    throw new NotFoundError(
      'Campaign not found',
      `Campaign with ID ${campaignId} not found`,
      req.path
    )
  }

  mockCampaigns.splice(campaignIndex, 1)
  SuccessResponse.send({ res, status: 204, data: {} })
})

export { router as campaignsRouter }

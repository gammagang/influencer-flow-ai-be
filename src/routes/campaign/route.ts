import { createCampaign, getCampaignsByCompanyId } from '@/api/campaign'
import { findCompanyByUserId } from '@/api/company'
import { BadRequestError } from '@/errors/bad-request-error'
import { NotFoundError } from '@/errors/not-found-error'
import { SuccessResponse } from '@/libs/success-response'
import { validateRequest } from '@/middlewares/validate-request'
import { Router, type Request, type Response } from 'express'
import {
  CreateCampaignReqSchema,
  ListCampaignsQuerySchema,
  UpdateCampaignReqSchema
} from './validate'

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

router.get('/', async (req: Request, res: Response) => {
  const validatedQuery = validateRequest(ListCampaignsQuerySchema, req.query, req.path)

  // Get the authenticated user's company
  const company = await findCompanyByUserId(req.user?.sub || '')
  if (!company?.id) throw new BadRequestError('No company found for the user', req.path)

  // Fetch campaigns from database for the user's company
  let campaigns = await getCampaignsByCompanyId(company.id.toString())

  // Apply status filter if provided
  if (validatedQuery.status) {
    campaigns = campaigns.filter((c: any) => c.state === validatedQuery.status)
  }

  const page = validatedQuery.page || 1
  const limit = validatedQuery.limit || 10
  const startIndex = (page - 1) * limit
  const endIndex = page * limit
  const paginatedCampaigns = campaigns.slice(startIndex, endIndex)

  SuccessResponse.send({
    res,
    data: {
      items: paginatedCampaigns,
      pagination: {
        total: campaigns.length,
        page,
        limit,
        totalPages: Math.ceil(campaigns.length / limit)
      }
    }
  })
})

router.post('/', async (req: Request, res: Response) => {
  const company = await findCompanyByUserId(req.user?.sub || '')
  if (!company?.id) throw new BadRequestError('No company found for the user', req.path)

  const validatedBody = validateRequest(CreateCampaignReqSchema, req.body, req.path)
  const campaign = await createCampaign(validatedBody, company.id)

  SuccessResponse.send({ res, data: campaign, status: 201 })
})

router.get('/:id', async (req: Request, res: Response) => {
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

router.put('/:id', async (req: Request, res: Response) => {
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

router.delete('/:id', async (req: Request, res: Response) => {
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

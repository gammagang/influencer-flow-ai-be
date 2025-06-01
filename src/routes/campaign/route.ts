import {
  createCampaign,
  getCampaignsByCompanyId,
  getCreatorsInCampaign,
  getCampaignById
} from '@/api/campaign'
import { findCompanyByUserId } from '@/api/company'
import { BadRequestError } from '@/errors/bad-request-error'
import { NotFoundError } from '@/errors/not-found-error'
import { SuccessResponse } from '@/libs/success-response'
import { validateRequest } from '@/middlewares/validate-request'
import { Router, type Request, type Response } from 'express'
import {
  AddCreatorToCampaignReqSchema,
  CreateCampaignReqSchema,
  ListCampaignsQuerySchema,
  UpdateCampaignReqSchema
} from './validate'
import { addCreatorToCampaign } from '@/api/creator'
import { ForbiddenError } from '@/errors/forbidden-error'

const campaignsRouter = Router()

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
// Create Campaign
campaignsRouter.post('/', async (req: Request, res: Response) => {
  const company = await findCompanyByUserId(req.user?.sub || '')
  if (!company?.id) throw new BadRequestError('No company found for the user', req.path)

  const validatedBody = validateRequest(CreateCampaignReqSchema, req.body, req.path)
  const campaign = await createCampaign(validatedBody, company.id)

  SuccessResponse.send({ res, data: campaign, status: 201 })
})

// Get ALL campaigns
campaignsRouter.get('/', async (req: Request, res: Response) => {
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

// Get Campaign by ID
campaignsRouter.get('/:id', async (req: Request, res: Response) => {
  const campaignId = req.params.id

  const company = await findCompanyByUserId(req.user?.sub || '')
  if (!company?.id) {
    throw new BadRequestError('No company found for the user', req.path)
  }

  const campaign = await getCampaignById(campaignId)

  if (!campaign)
    throw new NotFoundError('Campaign', `Campaign with ID ${campaignId} not found`, req.path)

  // Verify that the campaign belongs to the user's company
  if (campaign.company_id.toString() !== company.id.toString()) throw new ForbiddenError(req.path)

  SuccessResponse.send({ res, data: campaign })
})

// Update Campaign
campaignsRouter.put('/:id', async (req: Request, res: Response) => {
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

// Add Creator to Campaign
campaignsRouter.put('/:campaignId/creator', async (req: Request, res: Response) => {
  const { creatorData } = req.body
  const campaignId = req.params.campaignId
  const body = { campaignId, creatorData }

  const validatedBody = validateRequest(AddCreatorToCampaignReqSchema, body, req.path)
  const result = await addCreatorToCampaign(validatedBody)

  SuccessResponse.send({
    res,
    data: {
      campaignCreatorId: result.id,
      campaignId: result.campaign_id,
      creatorId: result.creator_id,
      creatorName: result.creator_name,
      creatorPlatform: result.creator_platform,
      campaignName: result.campaign_name,
      currentState: result.current_state,
      assignedBudget: result.assigned_budget,
      notes: result.notes,
      lastStateChangeAt: result.last_state_change_at
    }
  })
})

// List creators in campaign
campaignsRouter.get('/:campaignId/creator', async (req: Request, res: Response) => {
  const campaignId = req.params.campaignId
  const creators = await getCreatorsInCampaign(campaignId)
  SuccessResponse.send({ res, data: creators })
})

export { campaignsRouter }

import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import {
  CreateCreatorReqSchema,
  UpdateCreatorReqSchema,
  ListCreatorsQuerySchema,
  DiscoverCreatorsQuerySchema,
  AddCreatorToCampaignReqSchema,
  type DiscoverCreatorsQuery // Added type import
} from './validate'
import { NotFoundError } from '@/errors/not-found-error'
import { BadRequestError } from '@/errors/bad-request-error'
import { addCreatorToCampaign } from '@/api/creator'
import {
  discoverCreator,
  type DiscoverCreatorParams,
  type TierType,
  type EngagementRateType
} from '@/api/discover'

const router = Router()

// Mock database for creators
const mockCreators: any[] = [
  {
    id: 'creator-uuid-1',
    username: 'fashionista_jane',
    platform: 'instagram',
    email: 'jane@example.com',
    followersCount: 150000,
    engagementRate: 0.05,
    tags: ['fashion', 'lifestyle', 'beauty'],
    notes: 'Reached out on 2025-05-10, interested in collab.',
    createdAt: new Date('2025-01-15T10:00:00.000Z').toISOString(),
    updatedAt: new Date('2025-05-12T14:30:00.000Z').toISOString(),
    meta: { lastPostDate: '2025-05-28', averageLikes: 7500 }
  },
  {
    id: 'creator-uuid-2',
    username: 'gamer_mike',
    platform: 'youtube',
    email: 'mike.gamer@example.com',
    followersCount: 500000,
    engagementRate: 0.08,
    tags: ['gaming', 'esports', 'streaming'],
    notes: 'Potential for long term partnership.',
    createdAt: new Date('2024-11-20T09:00:00.000Z').toISOString(),
    updatedAt: new Date('2025-04-22T11:00:00.000Z').toISOString(),
    meta: { averageViewDuration: '10m30s', totalVideos: 150 }
  }
]

router.get('/creator/discover', async (req: Request, res: Response) => {
  // TODO: Pull info from

  const country = req.query.country
  const tier = req.query.tier
  const er = req.query.er
  const gender = req.query.gender
  const category = req.query.category
  const language = req.query.language
  const bio = req.query.bio

  const queryObj = {
    country,
    tier,
    er,
    gender,
    category,
    language,
    bio
  }
  // Cast validatedQuery to the specific type for type safety
  const validatedQuery = validateRequest(
    DiscoverCreatorsQuerySchema,
    queryObj,
    req.path
  ) as DiscoverCreatorsQuery

  const discoveryParams: DiscoverCreatorParams = {
    // connector: validatedQuery.platform, // platform is currently commented out in schema
    country: validatedQuery.country,
    tier: validatedQuery.tier as TierType[] | undefined,
    language: validatedQuery.language,
    category: validatedQuery.category,
    er: validatedQuery.er as EngagementRateType[] | undefined
  }

  const discoveryResult = await discoverCreator(discoveryParams)
  // return res.status(200).send({ data: discoveryResult })
  SuccessResponse.send({ res, data: discoveryResult })
})

router.get('/creator', async (req: Request, res: Response) => {
  log.info('Controller: GET /creator')
  const validatedQuery = validateRequest(ListCreatorsQuerySchema, req.query, req.path)

  let filteredCreators = [...mockCreators]

  if (validatedQuery.platform) {
    filteredCreators = filteredCreators.filter((c) => c.platform === validatedQuery.platform)
  }

  const minFollowers = validatedQuery.minFollowers
  if (minFollowers !== undefined) {
    filteredCreators = filteredCreators.filter((c) => c.followersCount >= minFollowers)
  }

  const maxFollowers = validatedQuery.maxFollowers
  if (maxFollowers !== undefined) {
    filteredCreators = filteredCreators.filter((c) => c.followersCount <= maxFollowers)
  }

  if (validatedQuery.tags) {
    const searchTags = validatedQuery.tags.split(',').map((tag) => tag.trim().toLowerCase())
    filteredCreators = filteredCreators.filter(
      (c) => c.tags && c.tags.some((tag: string) => searchTags.includes(tag.toLowerCase()))
    )
  }

  const page = validatedQuery.page!
  const limit = validatedQuery.limit!
  const startIndex = (page - 1) * limit
  const endIndex = page * limit
  const paginatedCreators = filteredCreators.slice(startIndex, endIndex)

  SuccessResponse.send({
    res,
    data: {
      items: paginatedCreators,
      pagination: {
        total: filteredCreators.length,
        page,
        limit,
        totalPages: Math.ceil(filteredCreators.length / limit)
      }
    }
  })
})

router.get('/creator/:id', async (req: Request, res: Response) => {
  log.info(`Controller: GET /creator/${req.params.id}`)
  const creatorId = req.params.id
  const creator = mockCreators.find((c) => c.id === creatorId)

  if (!creator) {
    throw new NotFoundError('Creator not found', `Creator with ID ${creatorId} not found`, req.path)
  }
  SuccessResponse.send({ res, data: creator })
})

router.post('/creator', async (req: Request, res: Response) => {
  log.info('Controller: POST /creator')
  const validatedBody = validateRequest(CreateCreatorReqSchema, req.body, req.path)

  const newCreator = {
    id: `creator-uuid-${Date.now()}`,
    ...validatedBody,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta: { discoverySource: 'manual_add' }
  }
  mockCreators.push(newCreator)
  SuccessResponse.send({ res, data: newCreator, status: 201 })
})

router.put('/creator/:id', async (req: Request, res: Response) => {
  log.info(`Controller: PUT /creator/${req.params.id}`)
  const creatorId = req.params.id
  const validatedBody = validateRequest(UpdateCreatorReqSchema, req.body, req.path)

  const creatorIndex = mockCreators.findIndex((c) => c.id === creatorId)
  if (creatorIndex === -1) {
    throw new NotFoundError('Creator not found', `Creator with ID ${creatorId} not found`, req.path)
  }

  const updatedCreator = {
    ...mockCreators[creatorIndex],
    ...validatedBody,
    updatedAt: new Date().toISOString()
  }
  mockCreators[creatorIndex] = updatedCreator

  SuccessResponse.send({ res, data: updatedCreator })
})

router.delete('/creator/:id', async (req: Request, res: Response) => {
  log.info(`Controller: DELETE /creator/${req.params.id}`)
  const creatorId = req.params.id

  const creatorIndex = mockCreators.findIndex((c) => c.id === creatorId)
  if (creatorIndex === -1) {
    throw new NotFoundError('Creator not found', `Creator with ID ${creatorId} not found`, req.path)
  }

  mockCreators.splice(creatorIndex, 1)
  SuccessResponse.send({ res, status: 204, data: {} })
})

router.post('/add-creator-to-campaign', async (req: Request, res: Response) => {
  log.info('Controller: POST /add-creator-to-campaign')

  // Validate request body using schema
  const validatedBody = validateRequest(AddCreatorToCampaignReqSchema, req.body, req.path)

  try {
    // Add creator to campaign using database operations
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
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw new NotFoundError(error.message, error.message, req.path)
      } else if (error.message.includes('already associated')) {
        throw new BadRequestError(error.message, req.path)
      }
    }
    throw error
  }
})

export { router as creatorsRouter }

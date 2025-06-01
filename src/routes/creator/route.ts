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
  type EngagementRateType,
  type GenderType,
  type ConnectorType
} from '@/api/discover'

const creatorsRouter = Router()

// Helper function to map follower count to tier
function mapFollowerCountToTier(followers: number): string {
  if (followers < 1000) return 'early'
  if (followers < 10000) return 'nano'
  if (followers < 100000) return 'micro'
  if (followers < 250000) return 'lower-mid'
  if (followers < 500000) return 'upper-mid'
  if (followers < 1000000) return 'macro'
  if (followers < 5000000) return 'mega'
  return 'celebrity'
}

// Helper function to extract age from age group string
function extractAgeFromGroup(ageGroup: string): number | null {
  const match = ageGroup.match(/(\d+)/)
  return match ? parseInt(match[1]) : null
}

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

creatorsRouter.get('/discover', async (req: Request, res: Response) => {
  log.info('Controller: GET /discover')

  // Parse query parameters - handle arrays correctly
  const country = req.query.country as string | undefined
  const tier = Array.isArray(req.query.tier)
    ? req.query.tier
    : req.query.tier
      ? [req.query.tier]
      : undefined
  const er = Array.isArray(req.query.er) ? req.query.er : req.query.er ? [req.query.er] : undefined
  const gender = req.query.gender as string | undefined
  const category = Array.isArray(req.query.category)
    ? req.query.category
    : req.query.category
      ? [req.query.category]
      : undefined
  const language = Array.isArray(req.query.language)
    ? req.query.language
    : req.query.language
      ? [req.query.language]
      : undefined
  const bio = req.query.bio as string | undefined
  const platform = req.query.platform as string | undefined
  const limit = req.query.limit ? Number(req.query.limit) : 12
  const skip = req.query.skip ? Number(req.query.skip) : 0
  const queryObj = {
    country,
    tier,
    er,
    gender,
    category,
    language,
    bio,
    platform
  }

  // Validate request using existing schema
  const validatedQuery = validateRequest(
    DiscoverCreatorsQuerySchema,
    queryObj,
    req.path
  ) as DiscoverCreatorsQuery // Build discovery parameters
  const discoveryParams: DiscoverCreatorParams = {
    country: validatedQuery.country,
    tier: validatedQuery.tier as TierType[] | undefined,
    language: validatedQuery.language,
    category: validatedQuery.category,
    er: validatedQuery.er as EngagementRateType[] | undefined,
    gender: validatedQuery.gender as GenderType | undefined,
    bio: validatedQuery.bio,
    limit,
    skip,
    connector: (validatedQuery.platform as ConnectorType) || 'instagram' // Default to Instagram
  }

  try {
    // Discover creators using the external API
    const discoveryResult = await discoverCreator(discoveryParams)

    // Transform the external API response to match our internal creator format
    const transformedCreators = discoveryResult.objects.map((creator) => ({
      id: creator._id,
      name: creator.full_name || creator.handle,
      platform: creator.connector,
      category: creator.category,
      age: creator.age_group ? extractAgeFromGroup(creator.age_group) : null,
      gender: creator.gender,
      location: creator.location,
      tier: mapFollowerCountToTier(creator.followers),
      engagement_rate: creator.engagement / 100, // Convert percentage to decimal
      email: creator.hasEmail ? 'available' : null,
      phone: creator.hasPhone ? 'available' : null,
      language: creator.languages?.join(', ') || null,
      followersCount: creator.followers,
      postsCount: creator.posts,
      averageViews: creator.average_views,
      handle: creator.handle,
      profileImageUrl: creator.image_link,
      profileUrl: creator.handle_link,
      insightsUrl: creator.insights_link,
      interests: creator.interests,
      country: creator.country,
      state: creator.state,
      qualityScore: creator.quality?.profile_quality_score,
      effectiveFollowerRate: creator.effective_follower_rate,
      createdAt: creator.createdDate,
      updatedAt: creator.refreshedDate,
      meta: {
        ylyticId: creator._id,
        source: creator.source,
        status: creator.status,
        inMyCreators: creator.inMyCreators,
        audience: creator.audience,
        quality: creator.quality
      }
    }))

    SuccessResponse.send({
      res,
      data: {
        creators: transformedCreators,
        total: transformedCreators.length,
        pagination: {
          skip,
          limit,
          hasMore: transformedCreators.length === limit
        }
      }
    })
  } catch (error) {
    log.error('Error discovering creators:', error)
    throw new Error('Failed to discover creators')
  }
})

creatorsRouter.get('/creator', async (req: Request, res: Response) => {
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

creatorsRouter.get('/creator/:id', async (req: Request, res: Response) => {
  log.info(`Controller: GET /creator/${req.params.id}`)
  const creatorId = req.params.id
  const creator = mockCreators.find((c) => c.id === creatorId)

  if (!creator) {
    throw new NotFoundError('Creator not found', `Creator with ID ${creatorId} not found`, req.path)
  }
  SuccessResponse.send({ res, data: creator })
})

creatorsRouter.post('/creator', async (req: Request, res: Response) => {
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

creatorsRouter.put('/creator/:id', async (req: Request, res: Response) => {
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

creatorsRouter.delete('/creator/:id', async (req: Request, res: Response) => {
  log.info(`Controller: DELETE /creator/${req.params.id}`)
  const creatorId = req.params.id

  const creatorIndex = mockCreators.findIndex((c) => c.id === creatorId)
  if (creatorIndex === -1) {
    throw new NotFoundError('Creator not found', `Creator with ID ${creatorId} not found`, req.path)
  }

  mockCreators.splice(creatorIndex, 1)
  SuccessResponse.send({ res, status: 204, data: {} })
})

creatorsRouter.post('/add-creator-to-campaign', async (req: Request, res: Response) => {
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

export { creatorsRouter }

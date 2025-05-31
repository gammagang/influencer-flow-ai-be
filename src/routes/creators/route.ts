import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import { CreateCreatorReqSchema, UpdateCreatorReqSchema, ListCreatorsQuerySchema } from './validate'
import { NotFoundError } from '@/errors/not-found-error'

const router = Router()

// TODO: Replace with actual database interactions and service logic

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

router.get('/creators', async (req: Request, res: Response) => {
  log.info('Controller: GET /creators')
  // validatedQuery will have defaults applied by Zod for page and limit.
  const validatedQuery = validateRequest(ListCreatorsQuerySchema, req.query, req.path)

  // TODO: Implement actual filtering, pagination, and sorting from a database
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

  // page and limit will have default values from the schema if not provided
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

router.get('/creators/:id', async (req: Request, res: Response) => {
  log.info(`Controller: GET /creators/${req.params.id}`)
  const creatorId = req.params.id
  const creator = mockCreators.find((c) => c.id === creatorId)

  if (!creator) {
    throw new NotFoundError('Creator not found', `Creator with ID ${creatorId} not found`, req.path)
  }
  SuccessResponse.send({ res, data: creator })
})

router.post('/creators', async (req: Request, res: Response) => {
  log.info('Controller: POST /creators')
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

router.put('/creators/:id', async (req: Request, res: Response) => {
  log.info(`Controller: PUT /creators/${req.params.id}`)
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

router.delete('/creators/:id', async (req: Request, res: Response) => {
  log.info(`Controller: DELETE /creators/${req.params.id}`)
  const creatorId = req.params.id

  const creatorIndex = mockCreators.findIndex((c) => c.id === creatorId)
  if (creatorIndex === -1) {
    throw new NotFoundError('Creator not found', `Creator with ID ${creatorId} not found`, req.path)
  }

  mockCreators.splice(creatorIndex, 1)
  SuccessResponse.send({ res, status: 204, data: {} })
})

export { router as creatorsRouter }

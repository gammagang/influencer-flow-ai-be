import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import { CreateContentReqSchema, UpdateContentReqSchema, ListContentQuerySchema } from './validate'
import { NotFoundError } from '@/errors/not-found-error'

const router = Router()

// TODO: Replace with actual database interactions and service logic

// Mock database for content
const mockContent: any[] = [
  {
    id: 'content-uuid-1',
    campaignId: 'campaign-uuid-1',
    creatorId: 'creator-uuid-1',
    campaignCreatorLinkId: 'cc-link-uuid-1',
    title: 'My Awesome Summer Post',
    description: 'Check out these amazing summer deals!',
    type: 'post',
    platform: 'instagram',
    contentUrl: 'https://instagram.com/p/yourpostid1',
    thumbnailUrl: 'https://images.example.com/thumb1.jpg',
    scheduledAt: new Date('2025-06-10T10:00:00.000Z').toISOString(),
    postedAt: null,
    status: 'scheduled',
    tags: ['summer', 'fashion', 'sale'],
    mentions: ['@brandname'],
    performanceMetrics: {},
    approvalStatus: 'approved',
    createdAt: new Date('2025-06-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2025-06-01T00:00:00.000Z').toISOString()
  },
  {
    id: 'content-uuid-2',
    campaignId: 'campaign-uuid-1',
    creatorId: 'creator-uuid-2',
    campaignCreatorLinkId: 'cc-link-uuid-2',
    title: 'Unboxing New Gadget!',
    description: 'My review of the latest tech.',
    type: 'video',
    platform: 'youtube',
    contentUrl: 'https://youtube.com/watch?v=yourvideoid2',
    thumbnailUrl: 'https://images.example.com/thumb2.jpg',
    scheduledAt: null,
    postedAt: new Date('2025-06-05T14:00:00.000Z').toISOString(),
    status: 'posted',
    tags: ['tech', 'unboxing', 'review'],
    mentions: [],
    performanceMetrics: {
      views: 15000,
      likes: 1200,
      comments: 85,
      engagementRate: 0.0856 // 8.56%
    },
    approvalStatus: 'approved',
    createdAt: new Date('2025-06-02T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2025-06-05T14:00:00.000Z').toISOString()
  }
]

router.post('', async (req: Request, res: Response) => {
  const validatedBody = validateRequest(CreateContentReqSchema, req.body, req.path)
  const newContent = {
    id: `content-uuid-${mockContent.length + 1}`,
    ...validatedBody,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    performanceMetrics: validatedBody.performanceMetrics || {}
  }
  mockContent.push(newContent)
  log.info(`Content created: ${newContent.id}`)
  SuccessResponse.send({ res, data: newContent, status: 201 })
})

router.get('', async (req: Request, res: Response) => {
  const validatedQuery = validateRequest(ListContentQuerySchema, req.query, req.path)
  const {
    campaignId,
    creatorId,
    type,
    platform,
    status,
    approvalStatus,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = validatedQuery

  let filteredContent = [...mockContent]

  if (campaignId) {
    filteredContent = filteredContent.filter((c) => c.campaignId === campaignId)
  }
  if (creatorId) {
    filteredContent = filteredContent.filter((c) => c.creatorId === creatorId)
  }
  if (type) {
    filteredContent = filteredContent.filter((c) => c.type === type)
  }
  if (platform) {
    filteredContent = filteredContent.filter((c) => c.platform === platform)
  }
  if (status) {
    filteredContent = filteredContent.filter((c) => c.status === status)
  }
  if (approvalStatus) {
    filteredContent = filteredContent.filter((c) => c.approvalStatus === approvalStatus)
  }

  // TODO: Implement actual sorting logic based on sortBy and sortOrder
  filteredContent.sort((a, b) => {
    const valA = a[sortBy as string]
    const valB = b[sortBy as string]
    let comparison = 0
    if (valA > valB) {
      comparison = 1
    } else if (valA < valB) {
      comparison = -1
    }
    return sortOrder === 'desc' ? comparison * -1 : comparison
  })

  const startIndex = (Number(page) - 1) * Number(limit)
  const endIndex = startIndex + Number(limit)
  const paginatedContent = filteredContent.slice(startIndex, endIndex)

  log.info(`Content listed with filters: ${JSON.stringify(req.query)}`)
  SuccessResponse.send({
    res,
    data: {
      items: paginatedContent,
      pagination: {
        totalItems: filteredContent.length,
        currentPage: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(filteredContent.length / Number(limit))
      }
    }
  })
})

router.get('/:contentId', async (req: Request, res: Response) => {
  const { contentId } = req.params
  const contentItem = mockContent.find((c) => c.id === contentId)

  if (!contentItem) {
    throw new NotFoundError('Content not found', `Content with ID ${contentId} not found`, req.path)
  }

  log.info(`Content retrieved: ${contentId}`)
  SuccessResponse.send({ res, data: contentItem })
})

router.put('/:contentId', async (req: Request, res: Response) => {
  const { contentId } = req.params
  const validatedBody = validateRequest(UpdateContentReqSchema, req.body, req.path)
  const index = mockContent.findIndex((c) => c.id === contentId)

  if (index === -1) {
    throw new NotFoundError(
      'Content not found for update',
      `Content with ID ${contentId} not found for update`,
      req.path
    )
  }

  mockContent[index] = {
    ...mockContent[index],
    ...validatedBody,
    updatedAt: new Date().toISOString()
  }

  log.info(`Content updated: ${contentId}`)
  SuccessResponse.send({ res, data: mockContent[index] })
})

router.delete('/:contentId', async (req: Request, res: Response) => {
  const { contentId } = req.params
  const index = mockContent.findIndex((c) => c.id === contentId)

  if (index === -1) {
    throw new NotFoundError(
      'Content not found for deletion',
      `Content with ID ${contentId} not found for deletion`,
      req.path
    )
  }

  const deletedContent = mockContent.splice(index, 1)[0]
  log.info(`Content deleted: ${contentId}`)
  SuccessResponse.send({ res, data: deletedContent })
})

export const contentRouter = router

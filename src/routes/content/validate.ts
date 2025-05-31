import { z } from 'zod'

export const CreateContentReqSchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID format'),
  creatorId: z.string().uuid('Invalid creator ID format'),
  campaignCreatorLinkId: z.string().uuid('Invalid campaign-creator link ID format').optional(),
  title: z.string().min(3, 'Title must be at least 3 characters long'),
  description: z.string().optional(),
  type: z.enum(['post', 'story', 'video', 'reel', 'short', 'article', 'other']),
  platform: z.enum([
    'instagram',
    'youtube',
    'tiktok',
    'twitter',
    'facebook',
    'linkedin',
    'blog',
    'other'
  ]),
  contentUrl: z.string().url('Invalid content URL').optional(),
  thumbnailUrl: z.string().url('Invalid thumbnail URL').optional(),
  scheduledAt: z.string().datetime('Invalid scheduled date format').optional(),
  postedAt: z.string().datetime('Invalid posted date format').optional(),
  status: z
    .enum(['draft', 'scheduled', 'posted', 'failed', 'archived', 'needs_approval'])
    .default('draft'),
  tags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  performanceMetrics: z
    .object({
      views: z.number().int().min(0).optional(),
      likes: z.number().int().min(0).optional(),
      comments: z.number().int().min(0).optional(),
      shares: z.number().int().min(0).optional(),
      engagementRate: z.number().min(0).optional(), // Could be a percentage 0-100 or a ratio 0-1
      reach: z.number().int().min(0).optional(),
      impressions: z.number().int().min(0).optional(),
      clickThroughRate: z.number().min(0).optional(),
      conversions: z.number().int().min(0).optional()
    })
    .optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  rejectionReason: z.string().optional(),
  notes: z.string().optional()
})

export type CreateContentReq = z.infer<typeof CreateContentReqSchema>

export const UpdateContentReqSchema = CreateContentReqSchema.partial().extend({
  status: z
    .enum(['draft', 'scheduled', 'posted', 'failed', 'archived', 'needs_approval'])
    .optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional()
})

export type UpdateContentReq = z.infer<typeof UpdateContentReqSchema>

export const ListContentQuerySchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID format').optional(),
  creatorId: z.string().uuid('Invalid creator ID format').optional(),
  type: z.enum(['post', 'story', 'video', 'reel', 'short', 'article', 'other']).optional(),
  platform: z
    .enum(['instagram', 'youtube', 'tiktok', 'twitter', 'facebook', 'linkedin', 'blog', 'other'])
    .optional(),
  status: z
    .enum(['draft', 'scheduled', 'posted', 'failed', 'archived', 'needs_approval'])
    .optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  sortBy: z
    .enum(['createdAt', 'scheduledAt', 'postedAt', 'status'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
})

export type ListContentQuery = z.infer<typeof ListContentQuerySchema>

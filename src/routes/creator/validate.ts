import { z } from 'zod'

// TODO: Define more specific validation schemas as per requirements

export const CreateCreatorReqSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters long' }),
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'twitter', 'facebook']), // Example platforms
  email: z.string().email({ message: 'Invalid email address' }).optional(),
  followersCount: z.number().int().positive().optional(),
  engagementRate: z.number().positive().optional(),
  tags: z.array(z.string()).optional(), // e.g., ['fashion', 'travel', 'food']
  notes: z.string().optional()
})

export type CreateCreatorReq = z.infer<typeof CreateCreatorReqSchema>

export const UpdateCreatorReqSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters long' })
    .optional(),
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'twitter', 'facebook']).optional(),
  email: z.string().email({ message: 'Invalid email address' }).optional(),
  followersCount: z.number().int().positive().optional(),
  engagementRate: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional()
})

export type UpdateCreatorReq = z.infer<typeof UpdateCreatorReqSchema>

export const ListCreatorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'twitter', 'facebook']).optional(),
  minFollowers: z.coerce.number().int().positive().optional(),
  maxFollowers: z.coerce.number().int().positive().optional(),
  tags: z.string().optional() // comma-separated for query, to be split in handler
})

export type ListCreatorsQuery = z.infer<typeof ListCreatorsQuerySchema>

export const DiscoverCreatorsQuerySchema = z.object({
  country: z.string().optional(), // Example: 'US'
  tier: z.array(z.string()).optional(), // E.g. ["10k-100k", "1M-5M"] - maps to Ylytic 'followers'
  language: z.array(z.string()).optional(), // E.g. ["en", "es"]
  category: z.array(z.string()).optional(), // E.g. ["Fashion", "Beauty"]
  er: z.array(z.string()).optional(), // Engagement Rate, E.g. ["1-2", "2-3"]
  gender: z.string().optional(), // Gender filter, single value only
  bio: z.string().optional(), // Keyword search in bio
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'twitter', 'facebook']).optional() // Platform filter
})

export type DiscoverCreatorsQuery = z.infer<typeof DiscoverCreatorsQuerySchema>

export const AddCreatorToCampaignReqSchema = z.object({
  campaignId: z.string().refine((id) => !isNaN(Number(id)) && Number(id) > 0, {
    message: 'Invalid campaign ID format'
  }),
  creatorData: z.object({
    name: z.string().min(1, { message: 'Creator name is required' }),
    platform: z.enum(['instagram', 'tiktok', 'youtube', 'twitter', 'facebook']),
    email: z.string().email({ message: 'Invalid email address' }).nullable().optional(),
    age: z.number().int().positive().optional(),
    gender: z.string().optional(),
    location: z.string().optional(),
    tier: z.string().optional(),
    engagement_rate: z.number().positive().optional(),
    phone: z.string().nullable().optional(),
    language: z.string().optional(),
    category: z.string().optional(),
    meta: z.record(z.any()).optional()
  }),
  assignedBudget: z.number().positive().optional(),
  notes: z.string().optional()
})

export type AddCreatorToCampaignReq = z.infer<typeof AddCreatorToCampaignReqSchema>

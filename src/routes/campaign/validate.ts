import { z } from 'zod'

// TODO: Define more specific validation schemas as per requirements

export const CreateCampaignReqSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  description: z.string().optional(),
  startDate: z.string().date('Invalid start date format'),
  endDate: z.string().date('Invalid end date format'),
  // All additional fields that will be stored in meta column
  ageRange: z.string().optional(),
  gender: z.string().optional(),
  interests: z.array(z.string()).optional(),
  deliverables: z.array(z.string()).optional(),
  contentGuidelines: z.string().optional(),
  totalBudget: z.string().optional(),
  budgetPerCreator: z.string().optional(),
  paymentModel: z.string().optional(),
  followerRange: z.string().optional(),
  minEngagement: z.string().optional(),
  location: z.string().optional()
})

export type CreateCampaignReq = z.infer<typeof CreateCampaignReqSchema>

export const UpdateCampaignReqSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }).optional(),
  description: z.string().optional(),
  startDate: z.string().date('Invalid start date format').optional(),
  endDate: z.string().date('Invalid end date format').optional(),
  budget: z.number().positive({ message: 'Budget must be a positive number' }).optional()
})

export type UpdateCampaignReq = z.infer<typeof UpdateCampaignReqSchema>

export const ListCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  status: z.string().optional() // e.g., 'active', 'completed', 'pending'
})

export type ListCampaignsQuery = z.infer<typeof ListCampaignsQuerySchema>

import { z } from 'zod'

// TODO: Define more specific validation schemas as per requirements

export const CreateCampaignReqSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  description: z.string().optional(),
  startDate: z.string().datetime({ message: 'Invalid start date format' }),
  endDate: z.string().datetime({ message: 'Invalid end date format' }),
  budget: z.number().positive({ message: 'Budget must be a positive number' }),
  companyId: z.string().uuid({ message: 'Invalid company ID' }) // Assuming campaigns are linked to a company
})

export type CreateCampaignReq = z.infer<typeof CreateCampaignReqSchema>

export const UpdateCampaignReqSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }).optional(),
  description: z.string().optional(),
  startDate: z.string().datetime({ message: 'Invalid start date format' }).optional(),
  endDate: z.string().datetime({ message: 'Invalid end date format' }).optional(),
  budget: z.number().positive({ message: 'Budget must be a positive number' }).optional()
})

export type UpdateCampaignReq = z.infer<typeof UpdateCampaignReqSchema>

export const ListCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  companyId: z.string().uuid({ message: 'Invalid company ID' }).optional(), // For filtering by company
  status: z.string().optional() // e.g., 'active', 'completed', 'pending'
})

export type ListCampaignsQuery = z.infer<typeof ListCampaignsQuerySchema>

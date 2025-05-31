import { z } from 'zod'

export const CreateContractReqSchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID format'),
  creatorId: z.string().uuid('Invalid creator ID format'),
  campaignCreatorLinkId: z.string().uuid('Invalid campaign-creator link ID format').optional(),
  contractType: z.enum(['fixed_price', 'commission_based', 'hybrid']),
  startDate: z.string().datetime('Invalid start date format'),
  endDate: z.string().datetime('Invalid end date format').optional(),
  deliverables: z.array(z.string()).min(1, 'At least one deliverable is required'),
  paymentTerms: z.object({
    totalAmount: z.number().positive('Total amount must be positive').optional(),
    currency: z.string().length(3, 'Currency code must be 3 characters').default('USD'),
    paymentSchedule: z
      .array(
        z.object({
          milestone: z.string(),
          amount: z.number().positive('Milestone amount must be positive'),
          dueDate: z.string().datetime('Invalid due date format')
        })
      )
      .optional(),
    commissionRate: z
      .number()
      .min(0)
      .max(100, 'Commission rate must be between 0 and 100')
      .optional()
  }),
  usageRights: z
    .object({
      platforms: z.array(z.string()).optional(),
      durationMonths: z.number().int().positive('Duration must be a positive integer').optional(),
      exclusivity: z.boolean().optional().default(false)
    })
    .optional(),
  terminationClause: z.string().optional(),
  status: z.enum(['draft', 'negotiating', 'active', 'completed', 'terminated']).default('draft'),
  additionalClauses: z.record(z.string()).optional() // For any custom key-value pairs
})

export type CreateContractReq = z.infer<typeof CreateContractReqSchema>

export const UpdateContractReqSchema = CreateContractReqSchema.partial().extend({
  status: z.enum(['draft', 'negotiating', 'active', 'completed', 'terminated']).optional()
})

export type UpdateContractReq = z.infer<typeof UpdateContractReqSchema>

export const ListContractsQuerySchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID format').optional(),
  creatorId: z.string().uuid('Invalid creator ID format').optional(),
  contractType: z.enum(['fixed_price', 'commission_based', 'hybrid']).optional(),
  status: z.enum(['draft', 'negotiating', 'active', 'completed', 'terminated']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  sortBy: z.enum(['createdAt', 'startDate', 'endDate', 'status']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
})

export type ListContractsQuery = z.infer<typeof ListContractsQuerySchema>

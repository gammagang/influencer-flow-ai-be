import { z } from 'zod'

// TODO: Define more specific validation schemas as per requirements

export const LinkCreatorToCampaignSchema = z.object({
  campaignId: z.string().min(1, { message: 'Invalid Campaign ID' }),
  creatorId: z.string().min(1, { message: 'Invalid Creator ID' }),
  status: z
    .enum(['pending', 'approved', 'rejected', 'active', 'completed'])
    .optional()
    .default('pending'),
  // Potential fields for specific terms, agreed content, etc.
  agreedDeliverables: z.array(z.string()).optional(),
  negotiatedRate: z.number().positive().optional(),
  contractId: z.string().uuid({ message: 'Invalid Contract ID' }).optional(), // Link to a contract if applicable
  notes: z.string().optional()
})

export type LinkCreatorToCampaignReq = z.infer<typeof LinkCreatorToCampaignSchema>

export const UpdateCampaignCreatorLinkSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'active', 'completed']).optional(),
  agreedDeliverables: z.array(z.string()).optional(),
  negotiatedRate: z.number().positive().optional(),
  contractId: z.string().uuid({ message: 'Invalid Contract ID' }).optional().nullable(), // Allow unsetting contract
  // Add any other updatable fields related to this link
  notes: z.string().optional()
})

export type UpdateCampaignCreatorLinkReq = z.infer<typeof UpdateCampaignCreatorLinkSchema>

export const ListCampaignCreatorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  campaignId: z.string().uuid({ message: 'Invalid Campaign ID' }).optional(),
  creatorId: z.string().uuid({ message: 'Invalid Creator ID' }).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'active', 'completed']).optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
})

export type ListCampaignCreatorsQuery = z.infer<typeof ListCampaignCreatorsQuerySchema>

// Schema for actions nested under campaign-creator, e.g., managing payments for a specific creator in a campaign
export const CreatePaymentForCampaignCreatorSchema = z.object({
  amount: z.number().positive({ message: 'Payment amount must be positive' }),
  paymentDate: z.string().datetime({ message: 'Invalid payment date format' }),
  paymentMethod: z.string().optional().default('bank_transfer'),
  transactionId: z.string().optional(),
  notes: z.string().optional()
})

export type CreatePaymentForCampaignCreatorReq = z.infer<
  typeof CreatePaymentForCampaignCreatorSchema
>

// Schema for sending outreach email to creator
export const SendOutreachEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required')
})

export type SendOutreachEmailReq = z.infer<typeof SendOutreachEmailSchema>

// Schema for previewing outreach email content (before sending)
export const PreviewOutreachEmailSchema = z.object({
  personalizedMessage: z.string().optional()
})

export type PreviewOutreachEmailReq = z.infer<typeof PreviewOutreachEmailSchema>

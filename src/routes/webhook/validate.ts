import { z } from 'zod'

// Define a list of possible event types your system might emit
// This should be comprehensive and reflect actual events in your application
export const WebhookEventTypeSchema = z.enum([
  'campaign.created',
  'campaign.updated',
  'campaign.deleted',
  'campaign.status_changed',
  'creator.created',
  'creator.updated',
  'creator.status_changed',
  'contract.created',
  'contract.status_changed',
  'content.created',
  'content.status_changed',
  'content.approved',
  'content.rejected',
  'payment.processed',
  'payment.failed'
  // Add more specific events as needed
])

export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>

export const CreateWebhookReqSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  description: z.string().optional(),
  secret: z.string().min(16, 'Secret must be at least 16 characters long').optional(), // Secret for verifying payloads
  events: z.array(WebhookEventTypeSchema).min(1, 'At least one event type must be selected'),
  isActive: z.boolean().optional().default(true),
  companyId: z.string().uuid('Invalid company ID format').optional() // Optional: if webhooks are company-specific
})

export type CreateWebhookReq = z.infer<typeof CreateWebhookReqSchema>

export const UpdateWebhookReqSchema = CreateWebhookReqSchema.partial().extend({
  url: z.string().url('Invalid webhook URL').optional(),
  events: z
    .array(WebhookEventTypeSchema)
    .min(1, 'At least one event type must be selected')
    .optional()
})

export type UpdateWebhookReq = z.infer<typeof UpdateWebhookReqSchema>

export const ListWebhooksQuerySchema = z.object({
  companyId: z.string().uuid('Invalid company ID format').optional(),
  isActive: z.coerce.boolean().optional(),
  eventType: WebhookEventTypeSchema.optional(), // Filter by a specific event type
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  sortBy: z.enum(['createdAt', 'url', 'isActive']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
})

export type ListWebhooksQuery = z.infer<typeof ListWebhooksQuerySchema>

// Schema for simulating an incoming webhook event payload (for testing or internal use)
export const SimulateWebhookEventSchema = z.object({
  webhookId: z.string().uuid('Invalid webhook ID'),
  eventType: WebhookEventTypeSchema,
  payload: z.record(z.any(), z.any()) // The actual event data
})

export type SimulateWebhookEvent = z.infer<typeof SimulateWebhookEventSchema>

import { z } from 'zod'

// Define DocuSeal specific event types
export const DocuSealEventTypeSchema = z.enum([
  'form.viewed',
  'form.started',
  'form.completed',
  'form.declined',
  'submission.created',
  'submission.completed',
  'submission.expired',
  'submission.archived',
  'template.created',
  'template.updated'
])

export type DocuSealEventType = z.infer<typeof DocuSealEventTypeSchema>

// DocuSeal webhook payload schema
export const DocuSealWebhookSchema = z.object({
  event_type: DocuSealEventTypeSchema,
  timestamp: z.string().datetime(),
  data: z.object({
    id: z.number(),
    submission_id: z.number().nullable().optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    ua: z.string().nullable().optional(),
    ip: z.string().nullable().optional(),
    sent_at: z.string().datetime().nullable().optional(),
    opened_at: z.string().datetime().nullable().optional(),
    completed_at: z.string().datetime().nullable().optional(),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
    external_id: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    status: z.string().optional(),
    application_key: z.string().nullable().optional(),
    decline_reason: z.string().nullable().optional(),
    preferences: z.record(z.string(), z.any()).optional(),
    values: z
      .array(
        z.object({
          field: z.string(),
          value: z.string()
        })
      )
      .optional(),
    role: z.string().optional(),
    documents: z
      .array(
        z.object({
          name: z.string(),
          url: z.string().url()
        })
      )
      .optional(),
    audit_log_url: z.string().url().nullable().optional(),
    submission_url: z.string().url().optional(),
    template: z.object({
      id: z.number().optional(),
      name: z.string().optional(),
      external_id: z.string().nullable().optional(),
      created_at: z.string().datetime(),
      updated_at: z.string().datetime(),
      folder_name: z.string().nullable().optional()
    }),
    submission: z
      .object({
        id: z.number(),
        created_at: z.string().datetime(),
        audit_log_url: z.string().url().nullable().optional(),
        combined_document_url: z.string().url().nullable().optional(),
        status: z.string(),
        url: z.string().url()
      })
      .optional()
  })
})

export type DocuSealWebhookPayload = z.infer<typeof DocuSealWebhookSchema>

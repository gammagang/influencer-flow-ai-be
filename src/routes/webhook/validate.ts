import { z } from 'zod'

// Define DocuSeal specific event types
export const DocuSealEventTypeSchema = z.enum([
  'form.completed',
  'form.opened',
  'form.declined',
  'form.created'
])

export type DocuSealEventType = z.infer<typeof DocuSealEventTypeSchema>

// DocuSeal webhook payload schema
export const DocuSealWebhookSchema = z.object({
  event_type: DocuSealEventTypeSchema,
  timestamp: z.string().datetime(),
  data: z.object({
    id: z.number(),
    submission_id: z.number(),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
    name: z.string().nullable(),
    ua: z.string().nullable(),
    ip: z.string().nullable(),
    sent_at: z.string().datetime().nullable(),
    opened_at: z.string().datetime().nullable(),
    completed_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    external_id: z.string().nullable(),
    metadata: z.record(z.string(), z.any()).optional(),
    status: z.string(),
    application_key: z.string().nullable(),
    decline_reason: z.string().nullable(),
    preferences: z.record(z.string(), z.any()).optional(),
    values: z.array(
      z.object({
        field: z.string(),
        value: z.string()
      })
    ),
    role: z.string(),
    documents: z.array(
      z.object({
        name: z.string(),
        url: z.string().url()
      })
    ),
    audit_log_url: z.string().url().nullable(),
    submission_url: z.string().url(),
    template: z.object({
      id: z.number(),
      name: z.string(),
      external_id: z.string().nullable(),
      created_at: z.string().datetime(),
      updated_at: z.string().datetime(),
      folder_name: z.string().nullable()
    }),
    submission: z.object({
      id: z.number(),
      created_at: z.string().datetime(),
      audit_log_url: z.string().url().nullable(),
      combined_document_url: z.string().url().nullable(),
      status: z.string(),
      url: z.string().url()
    })
  })
})

export type DocuSealWebhookPayload = z.infer<typeof DocuSealWebhookSchema>

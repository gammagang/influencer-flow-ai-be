import { z } from 'zod'

// Schema for ElevenLabs webhook payload
export const ElevenLabsWebhookSchema = z.object({
  type: z.literal('post_call_transcription'),
  event_timestamp: z.number(),
  data: z.object({
    agent_id: z.string(),
    conversation_id: z.string(),
    status: z.string(),
    transcript: z.array(
      z.object({
        role: z.string(),
        message: z.string().nullable(), // Can be null for tool calls
        tool_calls: z.any().optional(),
        tool_results: z.any().optional(),
        feedback: z.any().nullable(),
        time_in_call_secs: z.number(),
        conversation_turn_metrics: z.any().nullable(),
        // Additional fields that might be present
        llm_override: z.any().nullable().optional(),
        source_medium: z.string().nullable().optional(),
        rag_retrieval_info: z.any().nullable().optional(),
        llm_usage: z.any().nullable().optional(),
        interrupted: z.boolean().optional(),
        original_message: z.any().nullable().optional()
      })
    ),
    metadata: z
      .object({
        start_time_unix_secs: z.number(),
        accepted_time_unix_secs: z.number(),
        call_duration_secs: z.number(),
        cost: z.number(),
        deletion_settings: z.any(),
        feedback: z.any(),
        authorization_method: z.string(),
        charging: z.any(),
        phone_call: z.any().nullable(),
        batch_call: z.any().nullable(),
        termination_reason: z.string(),
        error: z.any().nullable(),
        main_language: z.string(),
        rag_usage: z.any().nullable(),
        text_only: z.boolean()
      })
      .optional(),
    analysis: z.object({
      evaluation_criteria_results: z.record(z.any()),
      data_collection_results: z.record(z.any()),
      call_successful: z.string(),
      transcript_summary: z.string()
    }),
    conversation_initiation_client_data: z.object({
      conversation_config_override: z.object({
        agent: z.object({
          prompt: z.any().nullable(),
          first_message: z.any().nullable(),
          language: z.string().nullable() // Can be null
        }),
        tts: z.object({
          voice_id: z.any().nullable()
        }),
        conversation: z
          .object({
            text_only: z.any().nullable()
          })
          .optional()
      }),
      custom_llm_extra_body: z.record(z.any()),
      dynamic_variables: z.record(z.union([z.string(), z.number(), z.null()])) // Can be string, number, or null
    })
  })
})

export type ElevenLabsWebhook = z.infer<typeof ElevenLabsWebhookSchema>

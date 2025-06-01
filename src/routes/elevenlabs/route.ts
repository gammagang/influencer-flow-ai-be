import { Router } from 'express'
import { validateRequest } from '@/middlewares/validate-request'
import { validateElevenLabsSignature } from '@/middlewares/elevenlabs-signature'
import { log } from '@/libs/logger'
import { ElevenLabsWebhookSchema, type ElevenLabsWebhook } from './validate'

const router = Router()

// Webhook endpoint
router.post('/post-call', validateElevenLabsSignature, async (req, res) => {
  log.info('ElevenLabs webhook handler started!')

  try {
    // Parse the raw body back to JSON for validation
    const bodyStr = req.body.toString()
    const parsedBody = JSON.parse(bodyStr)

    // Validate webhook payload
    const validatedData = validateRequest<ElevenLabsWebhook>(
      ElevenLabsWebhookSchema,
      parsedBody,
      'ElevenLabs Webhook'
    ) // Process the webhook data
    log.info('Received ElevenLabs webhook:', {
      type: validatedData.type,
      conversationId: validatedData.data.conversation_id,
      status: validatedData.data.status,
      transcriptSummary: validatedData.data.analysis.transcript_summary,
      callSuccessful: validatedData.data.analysis.call_successful,
      transcriptLength: validatedData.data.transcript.length
    })

    // Process transcript messages (filter out null messages)
    const messages = validatedData.data.transcript
      .filter((item) => item.message !== null)
      .map((item) => ({
        role: item.role,
        message: item.message,
        timeInCall: item.time_in_call_secs
      }))

    log.info('Transcript messages:', { messages })

    // TODO: Add your webhook processing logic here
    // For example:
    // - Store conversation data in database
    // - Update CRM records with call outcome
    // - Send notifications to relevant parties
    // - Process the transcript for insights
    // - Update campaign status based on call_successful
    // etc.

    return res.status(200).json({ message: 'Webhook received successfully' })
  } catch (error) {
    log.error('Error processing ElevenLabs webhook:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export { router as elevenLabsRouter }

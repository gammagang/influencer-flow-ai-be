import { Router } from 'express'
import { validateRequest } from '@/middlewares/validate-request'
import { validateElevenLabsSignature } from '@/middlewares/elevenlabs-signature'
import { log } from '@/libs/logger'
import { sql } from '@/libs/db'
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
    }) // Process transcript messages (filter out null messages)
    const messages = validatedData.data.transcript
      .filter((item) => item.message !== null)
      .map((item) => ({
        role: item.role,
        message: item.message,
        timeInCall: item.time_in_call_secs
      }))

    log.info('Transcript messages:', { messages }) // Extract required IDs from the webhook data
    // These should be passed in the conversation dynamic variables when the call is initiated
    const conversationId = validatedData.data.conversation_id
    const dynamicVars = validatedData.data.conversation_initiation_client_data.dynamic_variables
    const campaignCreatorId = dynamicVars?.campaign_creator_id
    const contractId = dynamicVars?.contract_id

    if (!campaignCreatorId) {
      log.error('No campaign_creator_id found in webhook data', {
        conversationId,
        availableDynamicVars: dynamicVars
      })
      return res.status(400).json({
        error: 'Missing campaign_creator_id in webhook data'
      })
    } // Determine call outcome
    const callOutcome =
      validatedData.data.analysis.call_successful === 'true' ? 'successful' : 'failed'

    // Convert transcript to a more structured format
    const fullTranscript = JSON.stringify(messages)

    // Extract negotiation details from data collection results if available
    const dataCollectionResults = validatedData.data.analysis.data_collection_results
    const deliverables = dataCollectionResults?.deliverables || null
    const agreedPrice = dataCollectionResults?.agreed_price || dataCollectionResults?.price || null
    const timeline = dataCollectionResults?.timeline || dataCollectionResults?.deadline || null

    try {
      // Store negotiation attempt in database
      const result = await sql`
        INSERT INTO negotiation_attempt (
          campaign_creator_id,
          contract_id,
          negotiation_type,
          started_at,
          ended_at,
          outcome,
          transcript,
          summary,
          deliverables,
          agreed_price,
          timeline,
          call_recording_url,
          meta
        ) VALUES (
          ${campaignCreatorId},
          ${contractId},
          'voice_call',
          ${new Date()}, -- Using current time as we don't have exact start time
          ${new Date()}, -- Using current time as call has ended
          ${callOutcome},
          ${fullTranscript},
          ${validatedData.data.analysis.transcript_summary},
          ${deliverables},
          ${agreedPrice},
          ${timeline},
          ${null}, -- call_recording_url not available in current schema
          ${JSON.stringify({
            conversation_id: conversationId,
            status: validatedData.data.status,
            call_duration_secs: validatedData.data.metadata?.call_duration_secs || null,
            agent_id: validatedData.data.agent_id || null,
            webhook_received_at: new Date().toISOString(),
            original_analysis: validatedData.data.analysis,
            evaluation_criteria_results: validatedData.data.analysis.evaluation_criteria_results,
            data_collection_results: validatedData.data.analysis.data_collection_results
          })}
        )
        RETURNING id
      `

      const negotiationAttemptId = result[0].id

      log.info('Successfully stored negotiation attempt:', {
        negotiationAttemptId,
        campaignCreatorId,
        contractId,
        conversationId,
        outcome: callOutcome,
        transcriptLength: messages.length
      })

      // If the call was successful, you might want to update the campaign_creator state
      if (validatedData.data.analysis.call_successful) {
        // TODO: Update campaign_creator current_state if needed
        // TODO: Create or update contract if negotiation was successful
        // TODO: Trigger follow-up actions like sending contracts
        log.info('Call was successful - consider triggering follow-up actions', {
          negotiationAttemptId,
          campaignCreatorId
        })
      }

      return res.status(200).json({
        message: 'Webhook received and stored successfully',
        negotiationAttemptId,
        outcome: callOutcome
      })
    } catch (dbError) {
      log.error('Database error while storing negotiation attempt:', {
        error: dbError,
        campaignCreatorId,
        conversationId
      })
      return res.status(500).json({ error: 'Failed to store negotiation data' })
    }
  } catch (error) {
    log.error('Error processing ElevenLabs webhook:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// New endpoint to update negotiation attempt with raw data in meta column
router.put('/store-meta/:id', async (req, res) => {
  log.info('ElevenLabs store-meta endpoint called for update')

  try {
    // Get the ID from URL parameters
    const negotiationAttemptId = req.params.id
    const bodyData = req.body

    if (!negotiationAttemptId || isNaN(Number(negotiationAttemptId))) {
      log.error('Invalid or missing negotiation attempt ID', {
        id: negotiationAttemptId
      })
      return res.status(400).json({
        error: 'Valid negotiation attempt ID is required'
      })
    }

    try {
      // Check if the record exists first
      const existingRecord = await sql`
        SELECT id FROM negotiation_attempt WHERE id = ${negotiationAttemptId}
      `

      if (existingRecord.length === 0) {
        log.error('Negotiation attempt not found', {
          id: negotiationAttemptId
        })
        return res.status(404).json({
          error: 'Negotiation attempt not found'
        })
      }

      // Update the existing record with the new meta data
      const result = await sql`
        UPDATE negotiation_attempt 
        SET 
          meta = ${JSON.stringify(bodyData)},
          ended_at = ${new Date()},
          summary = ${bodyData?.summary || 'Updated with raw data'}
        WHERE id = ${negotiationAttemptId}
        RETURNING id, campaign_creator_id, contract_id
      `

      const updatedRecord = result[0]

      log.info('Successfully updated negotiation attempt with meta data:', {
        negotiationAttemptId: updatedRecord.id,
        campaignCreatorId: updatedRecord.campaign_creator_id,
        contractId: updatedRecord.contract_id,
        bodySize: JSON.stringify(bodyData).length
      })

      return res.status(200).json({
        message: 'Negotiation attempt updated successfully with meta data',
        negotiationAttemptId: updatedRecord.id,
        dataUpdated: true
      })
    } catch (dbError) {
      log.error('Database error while updating meta data:', {
        error: dbError,
        negotiationAttemptId
      })
      return res.status(500).json({ error: 'Failed to update negotiation attempt' })
    }
  } catch (error) {
    log.error('Error processing store-meta update request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export { router as elevenLabsRouter }

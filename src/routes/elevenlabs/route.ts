import { updateCampaignCreatorState } from '@/api/campaign-creator'
import configs from '@/configs'
import { sql } from '@/libs/db'
import { log } from '@/libs/logger'
import { validateElevenLabsSignature } from '@/middlewares/elevenlabs-signature'
import { validateRequest } from '@/middlewares/validate-request'
import { Router } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import { ElevenLabsWebhookSchema, type ElevenLabsWebhook } from './validate'

const elevenLabsRouter = Router()

// Webhook endpoint for Eleven labs post call
elevenLabsRouter.post('/post-call', validateElevenLabsSignature, async (req, res) => {
  log.info('ElevenLabs webhook handler started!')
  try {
    const { data, type, event_timestamp } = req.body
    log.debug('Debug log. Not really used. Need to parse because of raw endpoint', {
      data,
      type,
      event_timestamp
    })

    const parsedBody = JSON.parse(req.body.toString())

    // Store the webhook request body JSON in a file
    try {
      if (configs.nodeEnv === 'development') {
        const webhooksDir = path.join(process.cwd(), 'webhook-logs', 'elevenlabs')
        await fs.mkdir(webhooksDir, { recursive: true })

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const conversationId = parsedBody?.data?.conversation_id || 'unknown'
        const filename = `webhook-${timestamp}-${conversationId}.json`
        const filepath = path.join(webhooksDir, filename)

        await fs.writeFile(filepath, JSON.stringify(parsedBody, null, 2))
        log.info('Webhook request body saved to file:', { filepath })
      }
    } catch (fileError) {
      log.error('Failed to save webhook body to file:', fileError)
      // Continue processing even if file write fails
    }

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

    // log.info('Transcript messages:', { messages }) // Extract required IDs from the webhook data
    // These should be passed in the conversation dynamic variables when the call is initiated
    const conversationId = validatedData.data.conversation_id
    const dynamicVars = validatedData.data.conversation_initiation_client_data.dynamic_variables
    const campaignCreatorId = dynamicVars?.campaign_creator_id

    if (!campaignCreatorId) {
      log.error('No campaign_creator_id found in webhook data', {
        conversationId,
        availableDynamicVars: dynamicVars
      })
      return res.status(400).json({
        error: 'Missing campaign_creator_id in webhook data'
      })
    }

    // Determine call outcome
    const callOutcome =
      validatedData.data.analysis.call_successful === 'success' ? 'successful' : 'failed'

    // Convert transcript to a more structured format
    const fullTranscript = JSON.stringify(messages)

    // Extract negotiation details from data collection results if available
    const dataCollectionResults = validatedData.data.analysis.data_collection_results
    const deliverables = dataCollectionResults?.deliverables || null
    const agreedPrice = dataCollectionResults?.agreed_price || dataCollectionResults?.price || null
    const timeline = dataCollectionResults?.timeline || dataCollectionResults?.deadline || null

    try {
      // Debug logging to identify any undefined values
      log.info('About to insert negotiation attempt with values:', {
        campaignCreatorId,
        callOutcome,
        deliverables,
        agreedPrice,
        timeline,
        transcriptSummary: validatedData.data.analysis.transcript_summary
      }) // Store negotiation attempt in database
      const result = await sql`
        INSERT INTO negotiation_attempt (
          campaign_creator_id,
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
          ${sql.json({
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
        conversationId,
        outcome: callOutcome,
        transcriptLength: messages.length
      })

      // If the call was successful, you might want to update the campaign_creator state
      if (campaignCreatorId && validatedData.data.analysis.call_successful === 'success') {
        await updateCampaignCreatorState(campaignCreatorId.toString(), 'call complete')

        // TODO: Call Contract creation Flow here
        // Contract created -> Update db -? Should be visible on Console for Brand to sign. Then Creator is sent the email.
        log.info('Call was successful - consider triggering follow-up actions', {
          negotiationAttemptId,
          campaignCreatorId
        })

        // TODO: Trigger follow-up actions like sending contracts
        // Create Contract flow
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
elevenLabsRouter.put('/store-meta/:id', async (req, res) => {
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
          summary = ${bodyData?.summary || 'Updated with raw data'}        WHERE id = ${negotiationAttemptId}
        RETURNING id, campaign_creator_id
      `

      const updatedRecord = result[0]

      log.info('Successfully updated negotiation attempt with meta data:', {
        negotiationAttemptId: updatedRecord.id,
        campaignCreatorId: updatedRecord.campaign_creator_id,
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

export { elevenLabsRouter }

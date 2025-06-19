import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { sql } from '@/libs/db'
import { NotFoundError } from '@/errors/not-found-error'

const negotiationRouter = Router()

// Get all negotiation attempts for a campaign-creator mapping
negotiationRouter.get('/:ccMappingId/negotiations', async (req: Request, res: Response) => {
  const ccMappingId = req.params.ccMappingId

  try {
    log.info(`Fetching negotiation attempts for campaign-creator mapping: ${ccMappingId}`)

    // Query negotiation attempts for this campaign-creator mapping
    const negotiations = await sql`
      SELECT 
        na.id,
        na.campaign_creator_id,
        na.negotiation_type,
        na.started_at,
        na.ended_at,
        na.outcome,
        na.transcript,
        na.summary,
        na.deliverables,
        na.agreed_price,
        na.timeline,
        na.call_recording_url,
        na.meta,
        cc.current_state as campaign_creator_state,
        c.name as campaign_name,
        cr.name as creator_name
      FROM negotiation_attempt na
      JOIN campaign_creator cc ON na.campaign_creator_id = cc.id
      JOIN campaign c ON cc.campaign_id = c.id
      JOIN creator cr ON cc.creator_id = cr.id
      WHERE cc.id = ${ccMappingId}
      ORDER BY na.started_at DESC
    `

    if (negotiations.length === 0) {
      log.info(`No negotiation attempts found for campaign-creator mapping: ${ccMappingId}`)
      SuccessResponse.send({
        res,
        data: {
          negotiations: [],
          totalCount: 0,
          message: 'No negotiation attempts found'
        }
      })
      return
    }

    // Process the negotiations to format the data
    const formattedNegotiations = negotiations.map((neg) => {
      let parsedTranscript = []
      let parsedMeta = {}

      // Parse transcript if it's a JSON string
      try {
        if (typeof neg.transcript === 'string') {
          parsedTranscript = JSON.parse(neg.transcript)
        }
      } catch (error) {
        log.error(`Failed to parse transcript for negotiation ${neg.id}:`, error)
        // Keep original transcript as fallback
        parsedTranscript = neg.transcript
      }

      // Parse meta if it exists
      try {
        if (neg.meta) {
          parsedMeta = typeof neg.meta === 'string' ? JSON.parse(neg.meta) : neg.meta
        }
      } catch (error) {
        log.error(`Failed to parse meta for negotiation ${neg.id}:`, error)
      }

      return {
        id: neg.id,
        campaignCreatorId: neg.campaign_creator_id,
        negotiationType: neg.negotiation_type,
        startedAt: neg.started_at,
        endedAt: neg.ended_at,
        outcome: neg.outcome,
        transcript: parsedTranscript,
        summary: neg.summary,
        deliverables: neg.deliverables,
        agreedPrice: neg.agreed_price,
        timeline: neg.timeline,
        callRecordingUrl: neg.call_recording_url,
        meta: parsedMeta,
        campaignCreatorState: neg.campaign_creator_state,
        campaignName: neg.campaign_name,
        creatorName: neg.creator_name
      }
    })

    log.info(
      `Found ${formattedNegotiations.length} negotiation attempts for campaign-creator mapping: ${ccMappingId}`
    )

    SuccessResponse.send({
      res,
      data: {
        negotiations: formattedNegotiations,
        totalCount: formattedNegotiations.length
      }
    })
  } catch (error) {
    log.error('Error fetching negotiation attempts:', error)
    throw new Error('Failed to fetch negotiation attempts')
  }
})

// Get a specific negotiation attempt by ID
negotiationRouter.get('/negotiation/:negotiationId', async (req: Request, res: Response) => {
  const negotiationId = req.params.negotiationId

  try {
    log.info(`Fetching negotiation attempt: ${negotiationId}`)

    const negotiations = await sql`
      SELECT 
        na.id,
        na.campaign_creator_id,
        na.negotiation_type,
        na.started_at,
        na.ended_at,
        na.outcome,
        na.transcript,
        na.summary,
        na.deliverables,
        na.agreed_price,
        na.timeline,
        na.call_recording_url,
        na.meta,
        cc.current_state as campaign_creator_state,
        c.name as campaign_name,
        cr.name as creator_name
      FROM negotiation_attempt na
      JOIN campaign_creator cc ON na.campaign_creator_id = cc.id
      JOIN campaign c ON cc.campaign_id = c.id
      JOIN creator cr ON cc.creator_id = cr.id
      WHERE na.id = ${negotiationId}
    `

    if (negotiations.length === 0) {
      throw new NotFoundError(
        'Negotiation attempt not found',
        `Negotiation attempt with ID ${negotiationId} not found`,
        req.path
      )
    }

    const neg = negotiations[0]
    let parsedTranscript = []
    let parsedMeta = {}

    // Parse transcript if it's a JSON string
    try {
      if (typeof neg.transcript === 'string') {
        parsedTranscript = JSON.parse(neg.transcript)
      }
    } catch (error) {
      log.error(`Failed to parse transcript for negotiation ${neg.id}:`, error)
      parsedTranscript = neg.transcript
    }

    // Parse meta if it exists
    try {
      if (neg.meta) {
        parsedMeta = typeof neg.meta === 'string' ? JSON.parse(neg.meta) : neg.meta
      }
    } catch (error) {
      log.error(`Failed to parse meta for negotiation ${neg.id}:`, error)
    }

    const formattedNegotiation = {
      id: neg.id,
      campaignCreatorId: neg.campaign_creator_id,
      negotiationType: neg.negotiation_type,
      startedAt: neg.started_at,
      endedAt: neg.ended_at,
      outcome: neg.outcome,
      transcript: parsedTranscript,
      summary: neg.summary,
      deliverables: neg.deliverables,
      agreedPrice: neg.agreed_price,
      timeline: neg.timeline,
      callRecordingUrl: neg.call_recording_url,
      meta: parsedMeta,
      campaignCreatorState: neg.campaign_creator_state,
      campaignName: neg.campaign_name,
      creatorName: neg.creator_name
    }

    SuccessResponse.send({
      res,
      data: formattedNegotiation
    })
  } catch (error) {
    log.error('Error fetching negotiation attempt:', error)
    if (error instanceof NotFoundError) {
      throw error
    }
    throw new Error('Failed to fetch negotiation attempt')
  }
})

export { negotiationRouter }

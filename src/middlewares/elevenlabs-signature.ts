import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { log } from '@/libs/logger'
import configs from '@/configs'

export const validateElevenLabsSignature = (req: Request, res: Response, next: NextFunction) => {
  log.info('ElevenLabs signature validation started', {
    hasSignature: !!req.headers['elevenlabs-signature']
  })

  const signatureHeader = req.headers['elevenlabs-signature'] as string
  if (!signatureHeader) {
    log.error('Missing ElevenLabs signature', {})
    return res.status(401).json({ error: 'Missing ElevenLabs signature' })
  }

  const bypassSecret = configs.elevenLabs.bypassSecret
  if (signatureHeader === bypassSecret) {
    log.info('Bypassing ElevenLabs signature validation for testing', {})
    return next()
  }

  try {
    // Parse the signature header - ElevenLabs format: "t=timestamp,v0=signature"
    const headers = signatureHeader.split(',')
    const timestampHeader = headers.find((e) => e.startsWith('t='))
    const signatureValue = headers.find((e) => e.startsWith('v0='))

    if (!timestampHeader || !signatureValue) {
      log.error('Invalid signature format', { signatureHeader })
      return res.status(401).json({ error: 'Invalid signature format' })
    }

    const timestamp = timestampHeader.substring(2) // Remove 't='

    // Validate timestamp (within last 30 minutes)
    const reqTimestamp = parseInt(timestamp) * 1000
    const tolerance = Date.now() - 30 * 60 * 1000
    if (reqTimestamp < tolerance) {
      log.error('ElevenLabs request too old', { timestamp, reqTimestamp, tolerance })
      return res.status(403).json({ error: 'Request expired' })
    }

    // Validate signature
    const secret = configs.elevenLabs.webhookSecret
    if (!secret) {
      log.error('ELEVENLABS_WEBHOOK_SECRET not configured', {})
      return res.status(500).json({ error: 'Server configuration error' })
    }

    // Create the message to sign: "timestamp.rawBody"
    const message = `${timestamp}.${req.body}`
    const digest = 'v0=' + crypto.createHmac('sha256', secret).update(message).digest('hex')

    if (signatureValue !== digest) {
      log.error('Invalid ElevenLabs signature', {
        expected: digest,
        received: signatureValue,
        message: message.substring(0, 100) + '...' // Log first 100 chars for debugging
      })
      return res.status(401).json({ error: 'Request unauthorized' })
    }

    log.info('ElevenLabs signature validation passed')
    next()
  } catch (error) {
    log.error('Error validating ElevenLabs signature:', error)
    return res.status(401).json({ error: 'Invalid signature format' })
  }
}

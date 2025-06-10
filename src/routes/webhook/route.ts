import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import { DocuSealWebhookSchema } from './validate'

const router = Router()

/**
 * DocuSeal webhook endpoint
 * This endpoint handles webhooks from DocuSeal for contract-related events
 */
router.post('/docuseal', async (req: Request, res: Response) => {
  try {
    // Validate the incoming webhook payload
    const validatedPayload = validateRequest(DocuSealWebhookSchema, req.body, req.path)

    // Extract important information
    const { event_type, timestamp, data } = validatedPayload
    const { email, status, role, documents, template } = data

    // Log the webhook event
    log.info(`DocuSeal webhook received: ${event_type} for ${email} with status ${status}`)

    // Process the webhook based on event type
    switch (event_type) {
      case 'form.completed':
        // Handle completed form (signed contract)
        log.info(`Contract completed by ${role}: ${email}`)
        log.info(`Template: ${template.name}, Document: ${documents[0]?.name || 'Unknown'}`)

        // TODO: In a production environment, you would:
        // 1. Update the contract status in your database
        // 2. Notify relevant parties
        // 3. Store document URLs for future reference

        // Example processing code:
        // await contractService.updateContractStatus(data.external_id, 'signed');
        // await notificationService.notifyContractSigned(data.email, data.template.name);

        break

      case 'form.opened':
        // Handle when the form is opened but not yet completed
        log.info(`Contract opened by ${role}: ${email}`)
        // TODO: Update contract status to 'viewed'
        break

      case 'form.declined':
        // Handle declined contracts
        log.info(`Contract declined by ${role}: ${email}`)
        log.info(`Decline reason: ${data.decline_reason || 'No reason provided'}`)
        // TODO: Update contract status to 'declined'
        break

      default:
        log.info(`Unhandled DocuSeal event type: ${event_type}`)
    }

    // Return success response
    SuccessResponse.send({
      res,
      status: 200,
      data: {
        message: 'Webhook processed successfully',
        event: event_type,
        timestamp: timestamp
      }
    })
  } catch (error) {
    // Log the error but still return a 200 response to DocuSeal
    // This prevents DocuSeal from retrying the webhook
    log.error('Error processing DocuSeal webhook', error)

    SuccessResponse.send({
      res,
      status: 200,
      data: {
        message: 'Webhook received but encountered processing error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
  }
})

export const webhooksRouter = router

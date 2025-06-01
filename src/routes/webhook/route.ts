import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import {
  CreateWebhookReqSchema,
  UpdateWebhookReqSchema,
  ListWebhooksQuerySchema,
  SimulateWebhookEventSchema
} from './validate'
import { NotFoundError } from '@/errors/not-found-error'
import crypto from 'crypto' // For generating secrets and signing payloads

const router = Router()

// TODO: Replace with actual database interactions and service logic
// TODO: Implement actual webhook event dispatching and payload signing

// Mock database for webhooks
const mockWebhooks: any[] = [
  {
    id: 'webhook-uuid-1',
    url: 'https://example.com/webhook-receiver-1',
    description: 'Notify on campaign updates',
    secret: 'supersecretstringforsigning1',
    events: ['campaign.created', 'campaign.updated'],
    isActive: true,
    companyId: 'company-uuid-123',
    createdAt: new Date('2025-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2025-01-01T00:00:00.000Z').toISOString()
    // deliveryHistory: [ { eventId: 'evt-uuid-1', timestamp: new Date(), status: 'success', statusCode: 200 } ] // Optional: for logs
  }
]

// Helper function to generate a secure secret
function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

router.post('', async (req: Request, res: Response) => {
  const validatedBody = validateRequest(CreateWebhookReqSchema, req.body, req.path)
  const newWebhook = {
    id: `webhook-uuid-${mockWebhooks.length + 1}`,
    ...validatedBody,
    secret: validatedBody.secret || generateSecret(), // Generate secret if not provided
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  mockWebhooks.push(newWebhook)
  log.info(`Webhook created: ${newWebhook.id} for URL ${newWebhook.url}`)
  SuccessResponse.send({ res, data: newWebhook, status: 201 })
})

router.get('', async (req: Request, res: Response) => {
  const validatedQuery = validateRequest(ListWebhooksQuerySchema, req.query, req.path)
  const {
    companyId,
    isActive,
    eventType,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = validatedQuery

  let filteredWebhooks = [...mockWebhooks]

  if (companyId) {
    filteredWebhooks = filteredWebhooks.filter((wh) => wh.companyId === companyId)
  }
  if (isActive !== undefined) {
    filteredWebhooks = filteredWebhooks.filter((wh) => wh.isActive === isActive)
  }
  if (eventType) {
    filteredWebhooks = filteredWebhooks.filter((wh) => wh.events.includes(eventType))
  }

  // TODO: Implement actual sorting logic based on sortBy and sortOrder
  filteredWebhooks.sort((a, b) => {
    const valA = a[sortBy as string]
    const valB = b[sortBy as string]
    let comparison = 0
    if (valA > valB) {
      comparison = 1
    } else if (valA < valB) {
      comparison = -1
    }
    return sortOrder === 'desc' ? comparison * -1 : comparison
  })

  const startIndex = (Number(page) - 1) * Number(limit)
  const endIndex = startIndex + Number(limit)
  const paginatedWebhooks = filteredWebhooks.slice(startIndex, endIndex)

  log.info(`Webhooks listed with filters: ${JSON.stringify(req.query)}`)
  SuccessResponse.send({
    res,
    data: {
      items: paginatedWebhooks,
      pagination: {
        totalItems: filteredWebhooks.length,
        currentPage: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(filteredWebhooks.length / Number(limit))
      }
    }
  })
})

router.get('/:webhookId', async (req: Request, res: Response) => {
  const { webhookId } = req.params
  const webhook = mockWebhooks.find((wh) => wh.id === webhookId)

  if (!webhook) {
    throw new NotFoundError('Webhook not found', `Webhook with ID ${webhookId} not found`, req.path)
  }

  log.info(`Webhook retrieved: ${webhookId}`)
  SuccessResponse.send({ res, data: webhook })
})

router.put('/:webhookId', async (req: Request, res: Response) => {
  const { webhookId } = req.params
  const validatedBody = validateRequest(UpdateWebhookReqSchema, req.body, req.path)
  const index = mockWebhooks.findIndex((wh) => wh.id === webhookId)

  if (index === -1) {
    throw new NotFoundError(
      'Webhook not found for update',
      `Webhook with ID ${webhookId} not found for update`,
      req.path
    )
  }

  mockWebhooks[index] = {
    ...mockWebhooks[index],
    ...validatedBody,
    updatedAt: new Date().toISOString()
  }

  log.info(`Webhook updated: ${webhookId}`)
  SuccessResponse.send({ res, data: mockWebhooks[index] })
})

router.delete('/:webhookId', async (req: Request, res: Response) => {
  const { webhookId } = req.params
  const index = mockWebhooks.findIndex((wh) => wh.id === webhookId)

  if (index === -1) {
    throw new NotFoundError(
      'Webhook not found for deletion',
      `Webhook with ID ${webhookId} not found for deletion`,
      req.path
    )
  }

  const deletedWebhook = mockWebhooks.splice(index, 1)[0]
  log.info(`Webhook deleted: ${webhookId}`)
  SuccessResponse.send({ res, data: deletedWebhook })
})

// Route to simulate sending a webhook event (for testing purposes)
// In a real system, this would be triggered by internal application events
router.post('/:webhookId/simulate', async (req: Request, res: Response) => {
  const { webhookId } = req.params
  const validatedBody = validateRequest(SimulateWebhookEventSchema, req.body, req.path)

  const webhook = mockWebhooks.find((wh) => wh.id === webhookId)
  if (!webhook) {
    throw new NotFoundError(
      'Webhook not found for simulation',
      `Webhook with ID ${webhookId} not found`,
      req.path
    )
  }

  if (!webhook.isActive) {
    log.info(`Webhook ${webhookId} is inactive. Simulation skipped.`)
    return SuccessResponse.send({
      res,
      data: { message: 'Webhook is inactive. Simulation skipped.' },
      status: 200
    })
  }

  if (!webhook.events.includes(validatedBody.eventType)) {
    log.info(
      `Webhook ${webhookId} is not subscribed to event ${validatedBody.eventType}. Simulation skipped.`
    )
    return SuccessResponse.send({
      res,
      data: {
        message: `Webhook not subscribed to event ${validatedBody.eventType}. Simulation skipped.`
      },
      status: 200
    })
  }

  const payload = JSON.stringify(validatedBody.payload)
  const signature = crypto.createHmac('sha256', webhook.secret).update(payload).digest('hex')

  // TODO: In a real scenario, you would make an HTTP POST request to webhook.url
  // with the payload and X-Signature header.
  log.info(
    `Simulating webhook event: ${validatedBody.eventType} for webhook ${webhookId} to URL ${webhook.url}`
  )
  log.info(`Payload: ${payload}`)
  log.info(`Signature: sha256=${signature}`)

  // Mocking the external call
  // const response = await axios.post(webhook.url, payload, { headers: { 'X-Signature': `sha256=${signature}` } });
  // log.info(`Webhook simulation response status: ${response.status}`);

  SuccessResponse.send({
    res,
    data: {
      message: 'Webhook event simulation triggered successfully.',
      eventType: validatedBody.eventType,
      payload: validatedBody.payload,
      signature: `sha256=${signature}`,
      targetUrl: webhook.url
    }
  })
})

export const webhooksRouter = router

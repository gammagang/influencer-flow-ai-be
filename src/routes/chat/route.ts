import { Router, type Request, type Response } from 'express'
import { log } from '@/libs/logger'
import { SuccessResponse } from '@/libs/success-response'
import { ChatRequestSchema } from './types'
import { handleChatMessage } from './chat-handler'

const chatRouter = Router()

chatRouter.post('/message', async (req: Request, res: Response) => {
  try {
    // Validate request
    const { message, conversationId } = ChatRequestSchema.parse(req.body)

    const response = await handleChatMessage(message, conversationId)

    SuccessResponse.send({
      res,
      data: response
    })
  } catch (error) {
    log.error('Error in chat endpoint:', error)
    throw new Error('Failed to process chat message')
  }
})

// Get conversation history (placeholder for future implementation)
chatRouter.get('/conversation/:id', async (req: Request, res: Response) => {
  const { id } = req.params

  // TODO: Implement conversation history retrieval from database
  SuccessResponse.send({
    res,
    data: {
      conversationId: id,
      messages: [],
      message: 'Conversation history not implemented yet'
    }
  })
})

export { chatRouter }

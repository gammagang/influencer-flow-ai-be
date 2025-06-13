import { Router, type Request, type Response } from 'express'
import { log } from '@/libs/logger'
import { SuccessResponse } from '@/libs/success-response'
import { ChatRequestSchema } from './types'
import { handleChatMessage } from './chat-handler'
import { conversationStore } from './conversation-store'

const chatRouter = Router()

chatRouter.post('/message', async (req: Request, res: Response) => {
  try {
    // Validate request
    const { message, conversationId } = ChatRequestSchema.parse(req.body)

    // User is available from JWT middleware
    if (!req.user) {
      throw new Error('User not authenticated')
    }

    const response = await handleChatMessage(message, req.user, conversationId)

    SuccessResponse.send({
      res,
      data: response
    })
  } catch (error) {
    log.error('Error in chat endpoint:', error)
    throw new Error('Failed to process chat message')
  }
})

// Get conversation history
chatRouter.get('/conversation/:id', async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const messages = conversationStore.getMessages(id)

    SuccessResponse.send({
      res,
      data: {
        conversationId: id,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        })),
        total: messages.length
      }
    })
  } catch (error) {
    log.error('Error getting conversation:', error)
    SuccessResponse.send({
      res,
      data: {
        conversationId: id,
        messages: [],
        message: 'Conversation not found'
      }
    })
  }
})

// Get conversation stats (for debugging)
chatRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = conversationStore.getStats()

    SuccessResponse.send({
      res,
      data: stats
    })
  } catch (error) {
    log.error('Error getting conversation stats:', error)
    throw new Error('Failed to get conversation stats')
  }
})

export { chatRouter }

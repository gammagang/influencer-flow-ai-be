import { Router, type Request, type Response } from 'express'
import { log } from '@/libs/logger'
import { SuccessResponse } from '@/libs/success-response'
import { ChatRequestSchema } from './types'
import { handleChatMessage } from './chat-handler'
import { persistentConversationStore as conversationStore } from './conversation-store'

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

    // Check if this is an API error with a user-friendly message
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      (error.message.includes('daily API limit') ||
        error.message.includes('technical difficulties'))
    ) {
      // This is likely our handled API error - return it as data
      SuccessResponse.send({
        res,
        data: {
          message: error.message,
          toolCalls: [],
          conversationId: req.body.conversationId || null,
          isError: true
        }
      })
      return
    }

    throw new Error('Failed to process chat message')
  }
})

// Get conversation history
chatRouter.get('/conversation/:id', async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    log.info('Getting conversation history for:', id)
    const messages = conversationStore.getMessages(id)
    log.info('Found messages:', messages.length)

    SuccessResponse.send({
      res,
      data: {
        conversationId: id,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          tool_call_id: msg.tool_call_id, // Include tool_call_id for tool messages
          tool_calls: msg.tool_calls // Include tool_calls for assistant messages
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

// Delete/clear a conversation
chatRouter.delete('/conversation/:id', async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    log.info('Deleting conversation:', id)
    const deleted = conversationStore.deleteConversation(id)

    if (deleted) {
      SuccessResponse.send({
        res,
        data: {
          message: 'Conversation deleted successfully',
          conversationId: id
        }
      })
    } else {
      SuccessResponse.send({
        res,
        data: {
          message: 'Conversation not found',
          conversationId: id
        }
      })
    }
  } catch (error) {
    log.error('Error deleting conversation:', error)
    throw new Error('Failed to delete conversation')
  }
})

export { chatRouter }

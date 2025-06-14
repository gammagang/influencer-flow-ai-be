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
    const { message } = ChatRequestSchema.parse(req.body)

    // User is available from JWT middleware
    if (!req.user) {
      throw new Error('User not authenticated')
    }

    const userId = req.user.sub

    // Get or create user's conversation (each user can only have one)
    const conversation = conversationStore.getOrCreateUserConversation(
      userId,
      'You are a helpful AI assistant specialized in influencer marketing and campaign management.'
    )

    const response = await handleChatMessage(message, req.user, conversation.id)

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

// Get user's conversation
chatRouter.get('/user/conversation', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new Error('User not authenticated')
    }

    const userId = req.user.sub
    const conversation = conversationStore.getUserActiveConversation(userId)

    if (!conversation) {
      SuccessResponse.send({
        res,
        data: {
          message: 'No conversation found',
          conversation: null
        }
      })
      return
    }

    SuccessResponse.send({
      res,
      data: {
        conversationId: conversation.id,
        messages: conversation.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          tool_call_id: msg.tool_call_id,
          tool_calls: msg.tool_calls
        })),
        total: conversation.messages.length
      }
    })
  } catch (error) {
    log.error('Error getting user conversation:', error)
    throw new Error('Failed to get user conversation')
  }
})

// Delete user's conversation
chatRouter.delete('/user/conversation', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new Error('User not authenticated')
    }

    const userId = req.user.sub
    const deleted = conversationStore.deleteUserConversation(userId)

    SuccessResponse.send({
      res,
      data: {
        message: deleted ? 'Conversation deleted successfully' : 'No conversation found',
        deleted
      }
    })
  } catch (error) {
    log.error('Error deleting user conversation:', error)
    throw new Error('Failed to delete user conversation')
  }
})

export { chatRouter }

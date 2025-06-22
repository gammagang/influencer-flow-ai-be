import { log } from '@/libs/logger'
import { sql } from '@/libs/database'
import {
  ChatMessage,
  Conversation,
  ConversationDbRow,
  ChatMessageDbRow
} from '@/types/conversation'

interface DbMessageCount {
  count: number
}

interface DbMessageId {
  id: string
}

interface DbConversationId {
  id: string
}

class DatabaseConversationStore {
  private readonly MAX_CONVERSATIONS = 1000
  private readonly MAX_MESSAGES_PER_CONVERSATION = 50
  private readonly CONVERSATION_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

  constructor() {
    this.cleanupExpiredConversations()
    // Run cleanup every hour
    setInterval(() => this.cleanupExpiredConversations(), 60 * 60 * 1000)
  }

  generateConversationId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const [conversation] = await sql<[ConversationDbRow]>`
        SELECT id, user_id, created_at, updated_at
        FROM conversations
        WHERE id = ${conversationId}
      `

      if (!conversation) {
        return null
      }

      // Check if conversation has expired
      if (Date.now() - new Date(conversation.updated_at).getTime() > this.CONVERSATION_TTL) {
        await this.deleteConversation(conversationId)
        return null
      }

      // Get messages for this conversation
      const messages = await sql<ChatMessageDbRow[]>`
        SELECT role, content, tool_calls, tool_call_id, timestamp
        FROM chat_messages
        WHERE conversation_id = ${conversationId}
        ORDER BY timestamp ASC
      `

      return {
        id: conversation.id,
        userId: conversation.user_id,
        messages: messages.map((msg: ChatMessageDbRow) => ({
          role: msg.role,
          content: msg.content,
          tool_calls: msg.tool_calls || undefined,
          tool_call_id: msg.tool_call_id || undefined,
          timestamp: new Date(msg.timestamp)
        })),
        createdAt: new Date(conversation.created_at),
        updatedAt: new Date(conversation.updated_at)
      }
    } catch (error) {
      log.error(`Error getting conversation ${conversationId}:`, error)
      return null
    }
  }

  async createConversation(
    conversationId: string,
    userId: string,
    systemPrompt: string
  ): Promise<Conversation> {
    try {
      // Delete any existing conversation for this user (one conversation per user)
      await this.deleteUserConversation(userId)

      // Create conversation
      await sql`
        INSERT INTO conversations (id, user_id)
        VALUES (${conversationId}, ${userId})
      `

      // Create system message
      await sql`
        INSERT INTO chat_messages (conversation_id, role, content, timestamp)
        VALUES (${conversationId}, 'system', ${systemPrompt}, NOW())
      `

      // Get the conversation with messages
      const conversation = await this.getConversation(conversationId)

      await this.cleanupOldConversations()

      if (!conversation) {
        throw new Error('Failed to create conversation')
      }

      return conversation
    } catch (error) {
      log.error(`Error creating conversation ${conversationId}:`, error)
      throw error
    }
  }

  async addMessage(
    conversationId: string,
    role: ChatMessage['role'],
    content: string,
    tool_calls?: object[],
    tool_call_id?: string
  ): Promise<void> {
    try {
      // Check if conversation exists
      const [conversation] = await sql`
        SELECT id FROM conversations WHERE id = ${conversationId}
      `

      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`)
      }

      // Create the message
      let toolCallsJson = null
      if (tool_calls) {
        // Validate that tool_calls is a proper array and contains valid structure
        try {
          const isValidArray = Array.isArray(tool_calls)
          let hasValidStructure = false

          if (isValidArray && tool_calls.length > 0) {
            // Check if first tool call has expected structure
            const firstTool = tool_calls[0]
            hasValidStructure = Boolean(
              firstTool &&
                typeof firstTool === 'object' &&
                'id' in firstTool &&
                'type' in firstTool &&
                'function' in firstTool
            )
          }

          if (isValidArray && (tool_calls.length === 0 || hasValidStructure)) {
            toolCallsJson = JSON.stringify(tool_calls)
            log.info('Storing valid tool_calls in database:', {
              originalToolCalls: tool_calls,
              toolCallsType: typeof tool_calls,
              isArray: isValidArray,
              hasValidStructure,
              jsonString: toolCallsJson
            })
          } else {
            log.error('Invalid tool_calls structure detected, not storing:', {
              originalToolCalls: tool_calls,
              toolCallsType: typeof tool_calls,
              isArray: isValidArray,
              hasValidStructure
            })
          }
        } catch (error) {
          log.error('Error validating tool_calls:', { error, tool_calls })
        }
      }

      await sql`
        INSERT INTO chat_messages (conversation_id, role, content, tool_calls, tool_call_id, timestamp)
        VALUES (${conversationId}, ${role}, ${content}, ${toolCallsJson}, ${tool_call_id || null}, NOW())
      `

      // Update conversation timestamp
      await sql`
        UPDATE conversations 
        SET updated_at = NOW() 
        WHERE id = ${conversationId}
      `

      // Limit messages per conversation
      await this.limitConversationMessages(conversationId)
    } catch (error) {
      log.error(`Error adding message to conversation ${conversationId}:`, error)
      throw error
    }
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      const messages = await sql<ChatMessageDbRow[]>`
        SELECT role, content, tool_calls, tool_call_id, timestamp
        FROM chat_messages
        WHERE conversation_id = ${conversationId}
        ORDER BY timestamp ASC
      `

      return messages.map((msg: ChatMessageDbRow) => {
        // Ensure tool_calls is properly parsed from JSON if it exists
        let toolCalls = msg.tool_calls
        if (toolCalls && typeof toolCalls === 'string') {
          try {
            toolCalls = JSON.parse(toolCalls)
          } catch (error) {
            log.error(`Failed to parse tool_calls in getMessages: ${error}`)
            toolCalls = undefined
          }
        }

        return {
          role: msg.role,
          content: msg.content,
          tool_calls:
            toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0 ? toolCalls : undefined,
          tool_call_id: msg.tool_call_id || undefined,
          timestamp: new Date(msg.timestamp)
        }
      })
    } catch (error) {
      log.error(`Error getting messages for conversation ${conversationId}:`, error)
      return []
    }
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      const result = await sql`
        DELETE FROM conversations
        WHERE id = ${conversationId}
      `

      if (result.count > 0) {
        log.info(`Deleted conversation: ${conversationId}`)
        return true
      }
      return false
    } catch (error) {
      log.error(`Error deleting conversation ${conversationId}:`, error)
      return false
    }
  }

  async getUserActiveConversation(userId: string): Promise<Conversation | null> {
    try {
      const [conversation] = await sql<[ConversationDbRow]>`
        SELECT id, user_id, created_at, updated_at
        FROM conversations
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
        LIMIT 1
      `

      if (!conversation) {
        return null
      }

      // Check if conversation has expired
      if (Date.now() - new Date(conversation.updated_at).getTime() > this.CONVERSATION_TTL) {
        await this.deleteConversation(conversation.id)
        return null
      }

      // Get messages for this conversation
      const messages = await sql<ChatMessageDbRow[]>`
        SELECT role, content, tool_calls, tool_call_id, timestamp
        FROM chat_messages
        WHERE conversation_id = ${conversation.id}
        ORDER BY timestamp ASC
      `

      return {
        id: conversation.id,
        userId: conversation.user_id,
        messages: messages.map((msg: ChatMessageDbRow) => {
          // Ensure tool_calls is properly parsed from JSON if it exists
          let toolCalls = msg.tool_calls
          if (toolCalls && typeof toolCalls === 'string') {
            try {
              toolCalls = JSON.parse(toolCalls)
            } catch (error) {
              log.error(`Failed to parse tool_calls for message: ${error}`)
              toolCalls = undefined
            }
          }

          // Debug: Log what we're retrieving
          if (toolCalls) {
            log.info('Retrieved tool_calls from database:', {
              rawFromDb: msg.tool_calls,
              rawType: typeof msg.tool_calls,
              parsedToolCalls: toolCalls,
              parsedType: typeof toolCalls,
              isArray: Array.isArray(toolCalls)
            })
          }

          return {
            role: msg.role,
            content: msg.content,
            tool_calls:
              toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0 ? toolCalls : undefined,
            tool_call_id: msg.tool_call_id || undefined,
            timestamp: new Date(msg.timestamp)
          }
        }),
        createdAt: new Date(conversation.created_at),
        updatedAt: new Date(conversation.updated_at)
      }
    } catch (error) {
      log.error(`Error getting user conversation for ${userId}:`, error)
      return null
    }
  }

  async getOrCreateUserConversation(userId: string, systemPrompt: string): Promise<Conversation> {
    try {
      // Check if user has an active conversation
      let conversation = await this.getUserActiveConversation(userId)

      if (conversation) {
        return conversation
      }

      // Create new conversation for user
      const conversationId = this.generateConversationId()
      conversation = await this.createConversation(conversationId, userId, systemPrompt)

      return conversation
    } catch (error) {
      log.error(`Error getting or creating user conversation for ${userId}:`, error)
      throw error
    }
  }

  async deleteUserConversation(userId: string): Promise<boolean> {
    try {
      const result = await sql`
        DELETE FROM conversations
        WHERE user_id = ${userId}
      `

      return result.count > 0
    } catch (error) {
      log.error(`Error deleting user conversation for ${userId}:`, error)
      return false
    }
  }

  private async limitConversationMessages(conversationId: string): Promise<void> {
    try {
      const [messageCount] = await sql<[DbMessageCount]>`
        SELECT COUNT(*) as count
        FROM chat_messages
        WHERE conversation_id = ${conversationId}
      `

      if (messageCount.count > this.MAX_MESSAGES_PER_CONVERSATION) {
        // Get IDs of messages to delete (keep system message and recent messages)
        const messagesToDelete = await sql<DbMessageId[]>`
          SELECT id
          FROM chat_messages
          WHERE conversation_id = ${conversationId}
            AND role != 'system'
          ORDER BY timestamp ASC
          LIMIT ${messageCount.count - this.MAX_MESSAGES_PER_CONVERSATION + 1}
        `

        if (messagesToDelete.length > 0) {
          const messageIds = messagesToDelete.map((msg: DbMessageId) => msg.id)

          await sql`
            DELETE FROM chat_messages
            WHERE id = ANY(${messageIds})
          `

          log.info(
            `Cleaned up ${messageIds.length} old messages from conversation ${conversationId}`
          )
        }
      }
    } catch (error) {
      log.error(`Error limiting messages for conversation ${conversationId}:`, error)
    }
  }

  private async cleanupOldConversations(): Promise<void> {
    try {
      const [conversationCount] = await sql<[DbMessageCount]>`
        SELECT COUNT(*) as count FROM conversations
      `

      if (conversationCount.count <= this.MAX_CONVERSATIONS) {
        return
      }

      // Get oldest conversation IDs
      const oldConversations = await sql<DbConversationId[]>`
        SELECT id
        FROM conversations
        ORDER BY updated_at ASC
        LIMIT ${conversationCount.count - this.MAX_CONVERSATIONS}
      `

      if (oldConversations.length > 0) {
        const conversationIds = oldConversations.map((conv: DbConversationId) => conv.id)

        await sql`
          DELETE FROM conversations
          WHERE id = ANY(${conversationIds})
        `

        log.info(`Cleaned up ${conversationIds.length} old conversations`)
      }
    } catch (error) {
      log.error('Error cleaning up old conversations:', error)
    }
  }

  private async cleanupExpiredConversations(): Promise<void> {
    try {
      const expiredDate = new Date(Date.now() - this.CONVERSATION_TTL)

      const result = await sql`
        DELETE FROM conversations
        WHERE updated_at < ${expiredDate.toISOString()}
      `

      if (result.count > 0) {
        log.info(`Cleaned up ${result.count} expired conversations`)
      }
    } catch (error) {
      log.error('Error cleaning up expired conversations:', error)
    }
  }
}

// Export singleton instance
export const databaseConversationStore = new DatabaseConversationStore()

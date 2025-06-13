import fs from 'fs'
import path from 'path'
import { log } from '@/libs/logger'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: object[]
  tool_call_id?: string
  timestamp: Date
}

interface Conversation {
  id: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

class PersistentConversationStore {
  private conversations: Map<string, Conversation> = new Map()
  private readonly MAX_CONVERSATIONS = 1000
  private readonly MAX_MESSAGES_PER_CONVERSATION = 50
  private readonly CONVERSATION_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days
  private readonly STORAGE_PATH = path.join(process.cwd(), 'data', 'conversations')
  private saveTimeout: NodeJS.Timeout | null = null

  constructor() {
    this.ensureStorageDirectory()
    this.loadConversations()
  }

  private ensureStorageDirectory() {
    if (!fs.existsSync(this.STORAGE_PATH)) {
      fs.mkdirSync(this.STORAGE_PATH, { recursive: true })
    }
  }

  private getConversationFilePath(conversationId: string): string {
    return path.join(this.STORAGE_PATH, `${conversationId}.json`)
  }

  private loadConversations() {
    try {
      if (!fs.existsSync(this.STORAGE_PATH)) {
        return
      }

      const files = fs.readdirSync(this.STORAGE_PATH)

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.STORAGE_PATH, file)
            const data = fs.readFileSync(filePath, 'utf8')
            const conversation: Conversation = JSON.parse(data)

            // Convert timestamp strings back to Date objects
            conversation.createdAt = new Date(conversation.createdAt)
            conversation.updatedAt = new Date(conversation.updatedAt)
            conversation.messages.forEach((msg) => {
              msg.timestamp = new Date(msg.timestamp)
            })

            // Check if conversation has expired
            if (Date.now() - conversation.updatedAt.getTime() > this.CONVERSATION_TTL) {
              fs.unlinkSync(filePath) // Delete expired conversation file
              continue
            }

            this.conversations.set(conversation.id, conversation)
          } catch (error) {
            log.error(`Error loading conversation file ${file}:`, error)
          }
        }
      }

      log.info(`Loaded ${this.conversations.size} conversations from storage`)
    } catch (error) {
      log.error('Error loading conversations:', error)
    }
  }

  private saveConversation(conversation: Conversation) {
    // Debounce saves to avoid too frequent writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    this.saveTimeout = setTimeout(() => {
      try {
        const filePath = this.getConversationFilePath(conversation.id)
        fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2))
      } catch (error) {
        log.error(`Error saving conversation ${conversation.id}:`, error)
      }
    }, 1000) // Save after 1 second of inactivity
  }

  generateConversationId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getConversation(conversationId: string): Conversation | null {
    const conversation = this.conversations.get(conversationId)

    if (!conversation) {
      return null
    }

    // Check if conversation has expired
    if (Date.now() - conversation.updatedAt.getTime() > this.CONVERSATION_TTL) {
      this.conversations.delete(conversationId)
      // Delete the file as well
      try {
        const filePath = this.getConversationFilePath(conversationId)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (error) {
        log.error(`Error deleting expired conversation file ${conversationId}:`, error)
      }
      return null
    }

    return conversation
  }

  createConversation(conversationId: string, systemPrompt: string): Conversation {
    const conversation: Conversation = {
      id: conversationId,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
          timestamp: new Date()
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.conversations.set(conversationId, conversation)
    this.saveConversation(conversation)
    this.cleanupOldConversations()
    return conversation
  }

  addMessage(
    conversationId: string,
    role: ChatMessage['role'],
    content: string,
    tool_calls?: object[],
    tool_call_id?: string
  ): void {
    const conversation = this.conversations.get(conversationId)

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`)
    }

    const message: ChatMessage = {
      role,
      content,
      timestamp: new Date()
    }

    if (tool_calls) {
      message.tool_calls = tool_calls
    }

    if (tool_call_id) {
      message.tool_call_id = tool_call_id
    }

    conversation.messages.push(message)
    conversation.updatedAt = new Date()

    // Limit messages per conversation to prevent memory issues
    if (conversation.messages.length > this.MAX_MESSAGES_PER_CONVERSATION) {
      // Keep system message and remove oldest user/assistant messages
      const systemMessage = conversation.messages[0]
      const recentMessages = conversation.messages.slice(-this.MAX_MESSAGES_PER_CONVERSATION + 1)
      conversation.messages = [systemMessage, ...recentMessages]
    }

    this.saveConversation(conversation)
  }

  getMessages(conversationId: string): ChatMessage[] {
    const conversation = this.getConversation(conversationId)
    return conversation ? conversation.messages : []
  }

  private cleanupOldConversations(): void {
    if (this.conversations.size <= this.MAX_CONVERSATIONS) {
      return
    }

    // Remove oldest conversations
    const sortedConversations = Array.from(this.conversations.entries()).sort(
      ([, a], [, b]) => a.updatedAt.getTime() - b.updatedAt.getTime()
    )

    const toRemove = sortedConversations.slice(
      0,
      sortedConversations.length - this.MAX_CONVERSATIONS
    )

    toRemove.forEach(([id, conversation]) => {
      this.conversations.delete(id)
      // Delete the file as well
      try {
        const filePath = this.getConversationFilePath(id)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (error) {
        log.error(`Error deleting conversation file ${id}:`, error)
      }
    })
  }

  // Helper method to get conversation stats (for debugging)
  getStats() {
    return {
      totalConversations: this.conversations.size,
      conversations: Array.from(this.conversations.entries()).map(([id, conv]) => ({
        id,
        messageCount: conv.messages.length,
        lastUpdated: conv.updatedAt
      }))
    }
  }
}

// Export singleton instance
export const persistentConversationStore = new PersistentConversationStore()

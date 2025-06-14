import { log } from '@/libs/logger'
import fs from 'fs'
import path from 'path'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: object[]
  tool_call_id?: string
  timestamp: Date
}

interface Conversation {
  id: string
  userId: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

class PersistentConversationStore {
  private conversations: Map<string, Conversation> = new Map()
  private userActiveConversations: Map<string, string> = new Map() // userId -> conversationId (one per user)
  private readonly MAX_CONVERSATIONS = 1000
  private readonly MAX_MESSAGES_PER_CONVERSATION = 50
  private readonly CONVERSATION_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days
  private readonly STORAGE_PATH = path.join(process.cwd(), 'data', 'conversations')
  private readonly USER_MAPPING_PATH = path.join(process.cwd(), 'data', 'user-conversations.json')
  private saveTimeout: NodeJS.Timeout | null = null

  constructor() {
    this.ensureStorageDirectory()
    this.loadConversations()
    this.loadUserMappings()
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

            // Handle backward compatibility for existing conversations
            if (!conversation.userId) {
              conversation.userId = 'unknown' // Default for old conversations
            }

            // Check if conversation has expired
            if (Date.now() - conversation.updatedAt.getTime() > this.CONVERSATION_TTL) {
              fs.unlinkSync(filePath) // Delete expired conversation file
              continue
            }

            this.conversations.set(conversation.id, conversation)

            // Rebuild user mappings - each user can only have one conversation
            if (conversation.userId !== 'unknown') {
              const existingConversationId = this.userActiveConversations.get(conversation.userId)
              if (existingConversationId) {
                const existingConversation = this.conversations.get(existingConversationId)
                if (existingConversation) {
                  // Keep the more recent conversation
                  if (conversation.updatedAt > existingConversation.updatedAt) {
                    // Delete the older conversation
                    this.conversations.delete(existingConversationId)
                    try {
                      const oldFilePath = this.getConversationFilePath(existingConversationId)
                      if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath)
                      }
                    } catch (error) {
                      log.error(
                        `Error deleting old conversation file ${existingConversationId}:`,
                        error
                      )
                    }
                    this.userActiveConversations.set(conversation.userId, conversation.id)
                  } else {
                    // Current conversation is older, delete it
                    this.conversations.delete(conversation.id)
                    try {
                      fs.unlinkSync(filePath)
                    } catch (error) {
                      log.error(`Error deleting older conversation file ${conversation.id}:`, error)
                    }
                  }
                }
              } else {
                this.userActiveConversations.set(conversation.userId, conversation.id)
              }
            }
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
        this.saveUserMappings() // Save user mappings when saving conversation
      } catch (error) {
        log.error(`Error saving conversation ${conversation.id}:`, error)
      }
    }, 1000) // Save after 1 second of inactivity
  }

  private loadUserMappings() {
    try {
      if (fs.existsSync(this.USER_MAPPING_PATH)) {
        const data = fs.readFileSync(this.USER_MAPPING_PATH, 'utf8')
        const mappings = JSON.parse(data)
        this.userActiveConversations = new Map(Object.entries(mappings))
        log.info(`Loaded ${this.userActiveConversations.size} user conversation mappings`)
      }
    } catch (error) {
      log.error('Error loading user mappings:', error)
    }
  }

  private saveUserMappings() {
    try {
      const mappings = Object.fromEntries(this.userActiveConversations)
      fs.writeFileSync(this.USER_MAPPING_PATH, JSON.stringify(mappings, null, 2))
    } catch (error) {
      log.error('Error saving user mappings:', error)
    }
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

  createConversation(conversationId: string, userId: string, systemPrompt: string): Conversation {
    const conversation: Conversation = {
      id: conversationId,
      userId: userId,
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
    this.userActiveConversations.set(userId, conversationId) // Map user to this conversation
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

    toRemove.forEach(([id]) => {
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

  // Delete a specific conversation
  deleteConversation(conversationId: string): boolean {
    const conversation = this.conversations.get(conversationId)

    if (!conversation) {
      return false
    }

    // Remove user mapping if this was their conversation
    if (conversation.userId) {
      this.userActiveConversations.delete(conversation.userId)
    }

    // Remove from memory
    this.conversations.delete(conversationId)

    // Delete the file
    try {
      const filePath = this.getConversationFilePath(conversationId)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        log.info(`Deleted conversation file: ${conversationId}`)
      }

      // Save user mappings after deletion
      this.saveUserMappings()

      return true
    } catch (error) {
      log.error(`Error deleting conversation file ${conversationId}:`, error)
      return false
    }
  }

  // Get user's conversation
  getUserActiveConversation(userId: string): Conversation | null {
    const conversationId = this.userActiveConversations.get(userId)
    if (!conversationId) {
      return null
    }
    return this.getConversation(conversationId)
  }

  // Create or get user's conversation
  getOrCreateUserConversation(userId: string, systemPrompt: string): Conversation {
    // Check if user has a conversation
    let conversation = this.getUserActiveConversation(userId)

    if (conversation) {
      return conversation
    }

    // Create new conversation for user
    const conversationId = this.generateConversationId()
    conversation = this.createConversation(conversationId, userId, systemPrompt)

    return conversation
  }

  // Delete user's conversation and remove mapping
  deleteUserConversation(userId: string): boolean {
    const conversationId = this.userActiveConversations.get(userId)
    if (!conversationId) {
      return false
    }

    // Remove user mapping
    this.userActiveConversations.delete(userId)
    this.saveUserMappings()

    // Delete the conversation
    return this.deleteConversation(conversationId)
  }
}

// Export singleton instance
export const persistentConversationStore = new PersistentConversationStore()

import { persistentConversationStore } from './conversation-store'
import { databaseConversationStore } from './database-conversation-store'
import { ChatMessage, Conversation } from '@/types/conversation'

// Configuration to switch between file-based and database storage
const USE_DATABASE_STORE = process.env.USE_DATABASE_CONVERSATION_STORE === 'true'

interface ConversationStore {
  generateConversationId(): string
  getConversation(conversationId: string): Promise<Conversation | null> | Conversation | null
  createConversation(
    conversationId: string,
    userId: string,
    systemPrompt: string
  ): Promise<Conversation> | Conversation
  addMessage(
    conversationId: string,
    role: ChatMessage['role'],
    content: string,
    tool_calls?: object[],
    tool_call_id?: string
  ): Promise<void> | void
  getMessages(conversationId: string): Promise<ChatMessage[]> | ChatMessage[]
  deleteConversation(conversationId: string): Promise<boolean> | boolean
  getUserActiveConversation(userId: string): Promise<Conversation | null> | Conversation | null
  getOrCreateUserConversation(
    userId: string,
    systemPrompt: string
  ): Promise<Conversation> | Conversation
  deleteUserConversation(userId: string): Promise<boolean> | boolean
}

class ConversationStoreAdapter implements ConversationStore {
  private store: typeof persistentConversationStore | typeof databaseConversationStore

  constructor() {
    this.store = USE_DATABASE_STORE ? databaseConversationStore : persistentConversationStore
  }

  generateConversationId(): string {
    return this.store.generateConversationId()
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    if (USE_DATABASE_STORE) {
      return await this.store.getConversation(conversationId)
    }
    return this.store.getConversation(conversationId)
  }

  async createConversation(
    conversationId: string,
    userId: string,
    systemPrompt: string
  ): Promise<Conversation> {
    if (USE_DATABASE_STORE) {
      return await this.store.createConversation(conversationId, userId, systemPrompt)
    }
    return this.store.createConversation(conversationId, userId, systemPrompt)
  }

  async addMessage(
    conversationId: string,
    role: ChatMessage['role'],
    content: string,
    tool_calls?: object[],
    tool_call_id?: string
  ): Promise<void> {
    if (USE_DATABASE_STORE) {
      await this.store.addMessage(conversationId, role, content, tool_calls, tool_call_id)
    } else {
      this.store.addMessage(conversationId, role, content, tool_calls, tool_call_id)
    }
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    if (USE_DATABASE_STORE) {
      return await this.store.getMessages(conversationId)
    }
    return this.store.getMessages(conversationId)
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    if (USE_DATABASE_STORE) {
      return await this.store.deleteConversation(conversationId)
    }
    return this.store.deleteConversation(conversationId)
  }

  async getUserActiveConversation(userId: string): Promise<Conversation | null> {
    if (USE_DATABASE_STORE) {
      return await this.store.getUserActiveConversation(userId)
    }
    return this.store.getUserActiveConversation(userId)
  }

  async getOrCreateUserConversation(userId: string, systemPrompt: string): Promise<Conversation> {
    if (USE_DATABASE_STORE) {
      return await this.store.getOrCreateUserConversation(userId, systemPrompt)
    }
    return this.store.getOrCreateUserConversation(userId, systemPrompt)
  }

  async deleteUserConversation(userId: string): Promise<boolean> {
    if (USE_DATABASE_STORE) {
      return await this.store.deleteUserConversation(userId)
    }
    return this.store.deleteUserConversation(userId)
  }
}

// Export unified conversation store
export const conversationStore = new ConversationStoreAdapter()
export { USE_DATABASE_STORE }

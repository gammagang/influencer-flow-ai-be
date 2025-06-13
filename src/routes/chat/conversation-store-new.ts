// Simple in-memory conversation storage
// In production, this should be replaced with a database or Redis

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

class ConversationStore {
  private conversations: Map<string, Conversation> = new Map()
  private readonly MAX_CONVERSATIONS = 1000
  private readonly MAX_MESSAGES_PER_CONVERSATION = 50
  private readonly CONVERSATION_TTL = 24 * 60 * 60 * 1000

  generateConversationId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getConversation(conversationId: string): Conversation | null {
    const conversation = this.conversations.get(conversationId)

    if (!conversation) {
      return null
    }

    if (Date.now() - conversation.updatedAt.getTime() > this.CONVERSATION_TTL) {
      this.conversations.delete(conversationId)
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

    if (conversation.messages.length > this.MAX_MESSAGES_PER_CONVERSATION) {
      const systemMessage = conversation.messages[0]
      const recentMessages = conversation.messages.slice(-this.MAX_MESSAGES_PER_CONVERSATION + 1)
      conversation.messages = [systemMessage, ...recentMessages]
    }
  }

  getMessages(conversationId: string): ChatMessage[] {
    const conversation = this.getConversation(conversationId)
    return conversation ? conversation.messages : []
  }

  private cleanupOldConversations(): void {
    if (this.conversations.size <= this.MAX_CONVERSATIONS) {
      return
    }

    const sortedConversations = Array.from(this.conversations.entries()).sort(
      ([, a], [, b]) => a.updatedAt.getTime() - b.updatedAt.getTime()
    )

    const toRemove = sortedConversations.slice(
      0,
      sortedConversations.length - this.MAX_CONVERSATIONS
    )
    toRemove.forEach(([id]) => this.conversations.delete(id))
  }

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

export const conversationStore = new ConversationStore()

// Database types for conversations
export interface ConversationDbRow {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface ChatMessageDbRow {
  id: string
  conversation_id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: object[] | null
  tool_call_id?: string | null
  timestamp: string
}

// Interface types used by the application
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: object[]
  tool_call_id?: string
  timestamp: Date
}

export interface Conversation {
  id: string
  userId: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

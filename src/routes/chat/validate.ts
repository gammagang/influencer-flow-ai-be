import { z } from 'zod'

export const ChatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
  conversationId: z.string().optional()
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

export const ConversationSchema = z.object({
  id: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'tool']),
      content: z.string(),
      timestamp: z.date().optional(),
      toolCalls: z.array(z.any()).optional()
    })
  ),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type Conversation = z.infer<typeof ConversationSchema>

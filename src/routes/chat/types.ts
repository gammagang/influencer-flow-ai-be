import { z } from 'zod'
import { type DiscoverCreatorParams } from '@/api/discover'

// Schema for chat request
export const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  conversationId: z.string().optional()
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>

// Define interface for tool call results
export interface ToolCallResult {
  toolCallId: string
  functionName: string
  result: {
    success: boolean
    data?: {
      creators?: Array<{
        id: string
        name: string
        handle: string
        platform: string
        category: string
        followersCount: number
        tier: string
        engagement_rate: number
        location: string | null
        country: string | null
        gender: string | null
        language: string | null
        profileImageUrl: string | null
        profileUrl: string
        interests: string[]
        qualityScore: number | null | undefined
      }>
      total?: number
      searchParams?: DiscoverCreatorParams
    }
    error?: string
  }
}

export interface ChatResponse {
  message: string
  toolCalls: ToolCallResult[]
  conversationId: string
}

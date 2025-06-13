import { z } from 'zod'
import { type DiscoverCreatorParams } from '@/api/discover'

// Schema for chat request
export const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  conversationId: z.string().optional()
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>

// Schema for campaign creation in chat
export const CreateCampaignChatSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, use YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, use YYYY-MM-DD'),
  deliverables: z.array(z.string()).min(1, 'At least one deliverable is required')
})

export type CreateCampaignChatParams = z.infer<typeof CreateCampaignChatSchema>

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
        // For detailed creator information
        creatorId?: string
        currentState?: string
        assignedBudget?: number
        notes?: string | null
        createdAt?: string
        updatedAt?: string
      }>
      total?: number
      searchParams?: DiscoverCreatorParams
      campaign?: {
        id: number
        name: string
        description: string | null
        startDate: string
        endDate: string
        deliverables: string[]
        status: string
        createdAt: string
      }
      campaigns?: Array<{
        id: string
        name: string
        description: string | null
        startDate: string
        endDate: string
        status: string
        createdAt: string
        deliverables: string[]
        totalBudget: string | null
      }>
      // For add creators to campaign
      campaignId?: string
      campaignName?: string
      addedCreators?: Array<{
        creatorHandle: string
        creatorName: string
        campaignCreatorId: string
        status: string
        assignedBudget: number
      }>
      totalAdded?: number
      errors?: string[]
      // For smart campaign status
      type?: 'no_campaigns' | 'single_campaign_status' | 'multiple_campaigns'
      message?: string
      totalCampaigns?: number
      status?: {
        campaignId: string
        campaignName: string
        totalCreators: number
        statusCounts: Record<string, number>
        statusBreakdown: Array<{
          stage: string
          count: number
          percentage: number
        }>
        lastUpdated: string
      }
      // For campaign creator details
      filteredCount?: number
      appliedFilters?: string[]
      statusSummary?: Record<string, number>
      lastUpdated?: string
    }
    error?: string
  }
}

export interface ChatResponse {
  message: string
  toolCalls: ToolCallResult[]
  conversationId: string
  isError?: boolean
}

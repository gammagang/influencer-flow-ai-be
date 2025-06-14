import { type DiscoverCreatorParams } from '@/api/discover'
import { groq } from '@/libs/groq'
import { log } from '@/libs/logger'
import { type UserJwt } from '@/middlewares/jwt'
import { persistentConversationStore as conversationStore } from './conversation-store'
import { creatorDiscoverySystemPrompt, finalResponseSystemPrompt } from './prompts-condensed'
import {
  executeAddCreatorsToCampaign,
  executeBulkOutreach,
  executeCreateCampaign,
  executeDeleteCampaign,
  executeDiscoverCreators,
  executeGetCampaignCreatorDetails,
  executeListCampaigns,
  executeSmartCampaignStatus
} from './services'
import {
  addCreatorsToCampaignTool,
  bulkOutreachTool,
  createCampaignTool,
  deleteCampaignTool,
  discoverCreatorsTool,
  getCampaignCreatorDetailsTool,
  listCampaignsTool,
  smartCampaignStatusTool
} from './tools'
import { type ChatResponse, type CreateCampaignChatParams, type ToolCallResult } from './types'

// Enhanced model configuration based on Groq documentation
const GROQ_MODELS = {
  // Primary tool-calling model - optimized for function calling and structured data
  TOOL_USE: 'llama-3.1-8b-instant',
  // Faster model for final response generation
  RESPONSE: 'llama-3.1-8b-instant',
  // Alternative models for fallback
  FALLBACK: 'llama-3.1-70b-versatile'
} as const

// Enhanced temperature settings based on Groq best practices
const TEMPERATURE_CONFIG = {
  TOOL_CALLING: 0.1, // Very low for deterministic tool calling
  RESPONSE_GENERATION: 0.3, // Slightly higher for natural responses
  ERROR_RECOVERY: 0.0 // Deterministic for error handling
} as const

// Enhanced token limits based on model capabilities
const TOKEN_LIMITS = {
  TOOL_CALLING: 512, // Conservative for tool calling
  RESPONSE_GENERATION: 1024, // Adequate for responses
  MAX_COMPLETION: 4096 // Maximum allowed
} as const

// Enhanced error response structure following Groq recommendations
interface GroqErrorResponse {
  message: string
  toolCalls: ToolCallResult[]
  conversationId: string
  isError: true
  errorType: 'rate_limit' | 'api_error' | 'validation_error' | 'internal_error'
  retryable: boolean
}

// Utility function to safely convert and validate numeric parameters
function validateAndCoerceNumericParam(
  value: unknown,
  paramName: string,
  min?: number,
  max?: number
): number | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  const numValue = Number(value)
  if (isNaN(numValue)) {
    throw new Error(`Invalid ${paramName} parameter: ${value}. Must be a number.`)
  }

  if (min !== undefined && numValue < min) {
    throw new Error(`Invalid ${paramName} parameter: ${value}. Must be >= ${min}.`)
  }

  if (max !== undefined && numValue > max) {
    throw new Error(`Invalid ${paramName} parameter: ${value}. Must be <= ${max}.`)
  }

  return numValue
}

// Enhanced error handling function based on Groq documentation
function _handleGroqError(error: unknown, conversationId: string): GroqErrorResponse {
  log.error('Groq API error encountered:', error)

  // Handle rate limit errors specifically (429)
  if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
    return {
      message:
        "I've reached my API rate limit. Please try again in a few moments. If this persists, please contact support.",
      toolCalls: [],
      conversationId,
      isError: true,
      errorType: 'rate_limit',
      retryable: true
    }
  }

  // Handle authentication errors (401)
  if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
    return {
      message: 'Authentication failed. Please check your API configuration.',
      toolCalls: [],
      conversationId,
      isError: true,
      errorType: 'api_error',
      retryable: false
    }
  }

  // Handle validation errors (400)
  if (error && typeof error === 'object' && 'status' in error && error.status === 400) {
    return {
      message: 'I encountered a validation error. Please try rephrasing your request.',
      toolCalls: [],
      conversationId,
      isError: true,
      errorType: 'validation_error',
      retryable: true
    }
  }

  // Handle other API errors (500, 502, 503, etc.)
  if (error && typeof error === 'object' && 'status' in error) {
    return {
      message:
        "I'm experiencing technical difficulties with the AI service. Please try again in a moment.",
      toolCalls: [],
      conversationId,
      isError: true,
      errorType: 'api_error',
      retryable: true
    }
  }

  // Handle general errors
  return {
    message:
      'I encountered an unexpected error. Please try again or contact support if the issue persists.',
    toolCalls: [],
    conversationId,
    isError: true,
    errorType: 'internal_error',
    retryable: true
  }
}

export async function handleChatMessage(
  message: string,
  user: UserJwt,
  conversationId?: string
): Promise<ChatResponse> {
  log.info('Chat request received:', { message, conversationId })

  try {
    // Generate or use existing conversation ID
    const currentConversationId = conversationId || conversationStore.generateConversationId()

    // Get or create conversation
    let conversation = conversationStore.getConversation(currentConversationId)
    if (!conversation) {
      conversation = conversationStore.createConversation(
        currentConversationId,
        user.sub, // Use user ID from JWT
        creatorDiscoverySystemPrompt
      )
    }

    // Add user message to conversation
    conversationStore.addMessage(currentConversationId, 'user', message)

    // Get all messages for context and convert to proper format
    const allMessages = conversationStore.getMessages(currentConversationId)

    // Prepare messages for Groq with proper typing
    const messages = allMessages.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'system' as const, content: msg.content }
      }
      if (msg.role === 'user') {
        return { role: 'user' as const, content: msg.content }
      }
      if (msg.role === 'assistant') {
        if (msg.tool_calls) {
          return {
            role: 'assistant' as const,
            content: msg.content,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tool_calls: msg.tool_calls as any
          }
        }
        return { role: 'assistant' as const, content: msg.content }
      }
      if (msg.role === 'tool' && msg.tool_call_id) {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.tool_call_id
        }
      }
      // Fallback
      return { role: 'user' as const, content: msg.content }
    })

    // Call Groq with enhanced configuration based on documentation best practices
    let completion
    try {
      completion = await groq.chat.completions.create({
        model: GROQ_MODELS.TOOL_USE, // Use the optimized tool-calling model
        messages,
        tools: [
          addCreatorsToCampaignTool,
          bulkOutreachTool,
          createCampaignTool,
          deleteCampaignTool,
          discoverCreatorsTool,
          getCampaignCreatorDetailsTool,
          listCampaignsTool,
          smartCampaignStatusTool
        ],
        tool_choice: 'auto',
        temperature: TEMPERATURE_CONFIG.TOOL_CALLING, // Lower temperature for more deterministic responses
        max_tokens: TOKEN_LIMITS.TOOL_CALLING // Conservative token limit for tool calling
      })
    } catch (error: unknown) {
      return _handleGroqError(error, currentConversationId)
    }

    const assistantMessage = completion.choices[0]?.message

    if (!assistantMessage) {
      throw new Error('No response from AI assistant')
    }

    let response: ChatResponse = {
      message: assistantMessage.content || '',
      toolCalls: [],
      conversationId: currentConversationId
    }

    // Handle function calls if any
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Store assistant message with tool calls
      conversationStore.addMessage(
        currentConversationId,
        'assistant',
        assistantMessage.content || '',
        assistantMessage.tool_calls
      )

      const toolResults: ToolCallResult[] = []

      // Execute all tool calls with enhanced error handling
      // Process in parallel for better performance (following Groq best practices)
      const toolPromises = assistantMessage.tool_calls.map(async (toolCall) => {
        try {
          // Validate tool call structure
          if (!toolCall.function?.name || !toolCall.id) {
            return {
              toolCallId: toolCall.id,
              functionName: toolCall.function?.name || 'unknown',
              result: {
                success: false,
                error: 'Invalid tool call structure'
              }
            }
          }

          // Parse arguments with enhanced error handling
          let parsedArgs: Record<string, unknown>
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments)
          } catch (parseError) {
            log.error('Failed to parse tool call arguments:', {
              toolName: toolCall.function.name,
              arguments: toolCall.function.arguments,
              parseError
            })
            return {
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result: {
                success: false,
                error:
                  'Invalid function arguments format. Please check your parameters and try again.'
              }
            }
          }

          // Execute the appropriate tool function
          let result: unknown
          switch (toolCall.function.name) {
            case 'discover_creators': {
              // Enhanced parameter validation for discover_creators
              const params: DiscoverCreatorParams = {
                ...parsedArgs,
                limit: validateAndCoerceNumericParam(parsedArgs.limit, 'limit', 1, 50),
                skip: validateAndCoerceNumericParam(parsedArgs.skip, 'skip', 0)
              }
              log.info('Executing discover_creators with validated params:', params)
              result = await executeDiscoverCreators(params)
              break
            }
            case 'create_campaign': {
              log.info('Executing create_campaign with params:', parsedArgs)
              result = await executeCreateCampaign(parsedArgs as CreateCampaignChatParams, user)
              break
            }
            case 'list_campaigns': {
              log.info('Executing list_campaigns')
              result = await executeListCampaigns(user)
              break
            }
            case 'add_creators_to_campaign': {
              log.info('Executing add_creators_to_campaign with params:', parsedArgs)
              result = await executeAddCreatorsToCampaign(
                parsedArgs as {
                  campaignId: string
                  creatorHandles: string[]
                  assignedBudget?: number
                  notes?: string
                },
                user,
                currentConversationId
              )
              break
            }
            case 'bulk_outreach': {
              log.info('Executing bulk_outreach with params:', parsedArgs)
              result = await executeBulkOutreach(
                parsedArgs as {
                  campaignId: string
                  creatorIds?: string[]
                  personalizedMessage?: string
                  confirmTemplate?: boolean
                },
                user,
                currentConversationId
              )
              break
            }
            case 'delete_campaign': {
              log.info('Executing delete_campaign with params:', parsedArgs)
              result = await executeDeleteCampaign(
                parsedArgs as { campaignId: string; confirmDelete: boolean },
                user
              )
              break
            }
            case 'smart_campaign_status': {
              log.info('Executing smart_campaign_status')
              result = await executeSmartCampaignStatus(user)
              break
            }
            case 'get_campaign_creator_details': {
              log.info('Executing get_campaign_creator_details with params:', parsedArgs)
              result = await executeGetCampaignCreatorDetails(
                parsedArgs as { campaignId: string; status?: string | string[]; limit?: number },
                user
              )
              break
            }
            default:
              return {
                toolCallId: toolCall.id,
                functionName: toolCall.function.name,
                result: {
                  success: false,
                  error: `Unknown tool: ${toolCall.function.name}`
                }
              }
          }

          // Store successful result in conversation
          conversationStore.addMessage(
            currentConversationId,
            'tool',
            JSON.stringify(result),
            undefined,
            toolCall.id
          )

          return {
            toolCallId: toolCall.id,
            functionName: toolCall.function.name,
            result
          } as ToolCallResult
        } catch (error) {
          log.error(`Error executing ${toolCall.function?.name || 'unknown'} tool call:`, {
            error,
            arguments: toolCall.function?.arguments,
            toolCallId: toolCall.id
          })

          const errorResult = {
            success: false,
            error: `Failed to execute ${toolCall.function?.name || 'tool'}. Please check your parameters and try again.`
          }

          // Store error result in conversation
          conversationStore.addMessage(
            currentConversationId,
            'tool',
            JSON.stringify(errorResult),
            undefined,
            toolCall.id
          )

          return {
            toolCallId: toolCall.id,
            functionName: toolCall.function?.name || 'unknown',
            result: errorResult
          }
        }
      })

      // Execute all tool calls in parallel for better performance
      toolResults.push(...(await Promise.all(toolPromises)))

      // Generate final response with tool results
      // Get updated conversation history
      const updatedMessages = conversationStore.getMessages(currentConversationId)
      const followUpMessages = updatedMessages.map((msg) => {
        if (msg.role === 'system') {
          return { role: 'system' as const, content: msg.content }
        }
        if (msg.role === 'user') {
          return { role: 'user' as const, content: msg.content }
        }
        if (msg.role === 'assistant') {
          if (msg.tool_calls) {
            return {
              role: 'assistant' as const,
              content: msg.content,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tool_calls: msg.tool_calls as any
            }
          }
          return { role: 'assistant' as const, content: msg.content }
        }
        if (msg.role === 'tool' && msg.tool_call_id) {
          return {
            role: 'tool' as const,
            content: msg.content,
            tool_call_id: msg.tool_call_id
          }
        }
        return { role: 'user' as const, content: msg.content }
      })

      // Get final response from Groq with specialized system prompt for summarization
      const finalMessages = [
        {
          role: 'system' as const,
          content: finalResponseSystemPrompt
        },
        // Include the last few messages for context (user message, assistant with tools, tool results)
        ...followUpMessages.slice(-6) // Keep last 6 messages for context
      ]

      const finalCompletion = await groq.chat.completions.create({
        model: GROQ_MODELS.RESPONSE,
        messages: finalMessages,
        temperature: TEMPERATURE_CONFIG.RESPONSE_GENERATION, // Lower temperature for more consistent summarization
        max_tokens: TOKEN_LIMITS.RESPONSE_GENERATION
      })

      response = {
        message: finalCompletion.choices[0]?.message?.content || response.message,
        toolCalls: toolResults,
        conversationId: response.conversationId
      }

      // Store final assistant response
      conversationStore.addMessage(
        currentConversationId,
        'assistant',
        finalCompletion.choices[0]?.message?.content || ''
      )
    } else {
      // No tool calls, just store the assistant response
      conversationStore.addMessage(
        currentConversationId,
        'assistant',
        assistantMessage.content || ''
      )
    }

    return response
  } catch (error) {
    log.error('Error in handleChatMessage:', error)
    // Return conversation ID even on error so frontend can continue conversation
    const currentConversationId = conversationId || conversationStore.generateConversationId()

    // Return a proper error response instead of throwing
    return {
      message: "I'm sorry, I encountered an error while processing your request. Please try again.",
      toolCalls: [],
      conversationId: currentConversationId
    }
  }
}

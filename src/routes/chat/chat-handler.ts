import { type DiscoverCreatorParams } from '@/api/discover'
import { groq } from '@/libs/groq'
import { log } from '@/libs/logger'
import { type UserJwt } from '@/middlewares/jwt'
import { conversationStore } from './conversation-store-adapter'
import { finalResponseSystemPrompt } from './prompts'
import {
  executeAddCreatorsToCampaign,
  executeBulkOutreach,
  executeCreateCampaign,
  executeCreateCampaignFromWebsite,
  executeCreateCampaignFromProfile,
  executeCreateBrandProfileFromWebsite,
  executeDeleteCampaign,
  executeDiscoverCreators,
  executeGetCampaignCreatorDetails,
  executeListCampaigns,
  executeCampaignStatus
} from './services'
import {
  addCreatorsToCampaignTool,
  bulkOutreachTool,
  createCampaignTool,
  createCampaignFromWebsiteTool,
  createCampaignFromProfileTool,
  createBrandProfileFromWebsiteTool,
  deleteCampaignTool,
  discoverCreatorsTool,
  getCampaignCreatorDetailsTool,
  listCampaignsTool,
  smartCampaignStatusTool
} from './tools'
import { type ChatResponse, type CreateCampaignChatParams, type ToolCallResult } from './types'
import { type CreateCampaignFromWebsiteParams } from '@/api/create-campaign-from-website'
import { type CreateBrandProfileFromWebsiteParams } from '@/api/create-brand-profile-from-website'

// Type for create campaign from profile
interface CreateCampaignFromProfileParams {
  name: string
  description?: string
  startDate: string
  endDate: string
  deliverables: string[]
  targetAudience?: string
  campaignGoals?: string[]
}

// Enhanced model configuration based on Groq documentation
const GROQ_MODELS = {
  // Primary tool-calling model - optimized for function calling and structured data
  TOOL_USE: 'llama-3.1-8b-instant',
  // Faster model for final response generation
  RESPONSE: 'llama-3.1-8b-instant',
  // Alternative models for fallback
  FALLBACK: 'llama-3.3-70b-versatile'
} as const

// Enhanced temperature settings based on Groq best practices
const TEMPERATURE_CONFIG = {
  TOOL_CALLING: 0.1, // Very low for deterministic tool calling
  RESPONSE_GENERATION: 0.3, // Slightly higher for natural responses
  ERROR_RECOVERY: 0.0 // Deterministic for error handling
} as const

// Enhanced token limits based on model capabilities
const TOKEN_LIMITS = {
  TOOL_CALLING: 512, // Reduced to conserve tokens
  RESPONSE_GENERATION: 512, // Reduced to conserve tokens
  MAX_COMPLETION: 1024 // Reduced maximum
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

  // Handle rate limit errors specifically (429 or rate_limit_exceeded code)
  if (
    (error && typeof error === 'object' && 'status' in error && error.status === 429) ||
    (error && typeof error === 'object' && 'code' in error && error.code === 'rate_limit_exceeded')
  ) {
    let waitTime = 'a few moments'
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = String(error.message)
      const waitTimeMatch = errorMessage.match(/(\d+\.?\d*)s/)
      if (waitTimeMatch) {
        waitTime = `${Math.ceil(parseFloat(waitTimeMatch[1]))} seconds`
      }
    }

    return {
      message: `I've reached my API rate limit. Please try again in ${waitTime}. If this persists, please contact support.`,
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

// Helper function to clean XML-like artifacts from AI responses
function cleanAIResponse(content: string): string {
  if (!content) return content

  // Remove XML-like function tags and their content
  return content
    .replace(/<function[^>]*>.*?<\/function>/gi, '') // Remove <function>...</function> tags
    .replace(/<\|[^|]*\|>/g, '') // Remove <|...|> internal tags
    .replace(/[a-zA-Z_]+>.*?<\/function>/gi, '') // Remove malformed function calls like "add_creators_to_campaign>...</function>"
    .replace(/[a-zA-Z_]+>\{.*?\}<\/function>/gi, '') // Remove specific pattern "functionName>{...}</function>"
    .replace(/\s*\n\s*\n\s*/g, '\n\n') // Clean up extra whitespace
    .trim()
}

// ...existing code...

export async function handleChatMessage(
  message: string,
  user: UserJwt,
  conversationId?: string
): Promise<ChatResponse> {
  log.info('Chat request received:', { message, conversationId })

  try {
    // Generate or use existing conversation ID
    const currentConversationId = conversationId || conversationStore.generateConversationId()

    // Get existing conversation (should already be created by route)
    const conversation = await conversationStore.getConversation(currentConversationId)
    if (!conversation) {
      throw new Error(`Conversation ${currentConversationId} not found`)
    }

    // Add user message to conversation
    await conversationStore.addMessage(currentConversationId, 'user', message)

    // Get all messages for context and convert to proper format
    const allMessages = await conversationStore.getMessages(currentConversationId)

    // Prepare messages for Groq with proper typing
    const messages = allMessages.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'system' as const, content: msg.content }
      }
      if (msg.role === 'user') {
        return { role: 'user' as const, content: msg.content }
      }
      if (msg.role === 'assistant') {
        if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
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
          createCampaignFromWebsiteTool,
          createCampaignFromProfileTool,
          createBrandProfileFromWebsiteTool,
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

    // Debug: Log the complete assistant message from Groq
    log.info('Complete assistant message from Groq:', {
      conversationId: currentConversationId,
      content: assistantMessage.content,
      contentType: typeof assistantMessage.content,
      contentLength: assistantMessage.content?.length || 0,
      tool_calls: assistantMessage.tool_calls,
      tool_calls_length: assistantMessage.tool_calls?.length || 0,
      hasToolCalls: Boolean(assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0),
      messageKeys: Object.keys(assistantMessage)
    })

    // Check for malformed function calls in content
    if (assistantMessage.content && !assistantMessage.tool_calls) {
      const hasMalformedFunctionCalls =
        assistantMessage.content.includes('_tag|>') ||
        assistantMessage.content.includes('</function>') ||
        /[a-zA-Z_]+>\{.*?\}/.test(assistantMessage.content)

      if (hasMalformedFunctionCalls) {
        log.error('AI generated malformed function calls instead of using tools:', {
          conversationId: currentConversationId,
          content: assistantMessage.content,
          shouldHaveUsedTools: true
        })

        // Try to extract and execute the intended tool call
        const toolCallMatch = assistantMessage.content.match(
          /([a-zA-Z_]+)>\s*(\{.*?\})\s*<\/function>/
        )
        if (toolCallMatch) {
          const [, functionName, argsJson] = toolCallMatch
          try {
            const args = JSON.parse(argsJson)
            log.info(`Attempting to execute extracted tool call: ${functionName}`, { args })

            // Create a synthetic tool call structure
            const syntheticToolCall = {
              id: `synthetic_${Date.now()}`,
              type: 'function' as const,
              function: {
                name: functionName,
                arguments: argsJson
              }
            }

            // Add the synthetic tool call to trigger proper execution
            assistantMessage.tool_calls = [syntheticToolCall]
            log.info('Created synthetic tool call for malformed function call', {
              syntheticToolCall
            })
          } catch (parseError) {
            log.error('Failed to parse malformed function call arguments:', {
              parseError,
              argsJson
            })
          }
        }
      }
    }

    let response: ChatResponse = {
      message: cleanAIResponse(assistantMessage.content || ''),
      toolCalls: [],
      conversationId: currentConversationId
    }

    // Handle function calls if any
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Debug: Log the tool_calls structure
      log.info('Raw tool_calls from Groq:', {
        toolCalls: assistantMessage.tool_calls,
        toolCallsType: typeof assistantMessage.tool_calls,
        isArray: Array.isArray(assistantMessage.tool_calls),
        stringified: JSON.stringify(assistantMessage.tool_calls, null, 2)
      })

      // Store assistant message with tool calls
      await conversationStore.addMessage(
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
            case 'create_campaign_from_website': {
              log.info('Executing create_campaign_from_website with params:', parsedArgs)
              result = await executeCreateCampaignFromWebsite(
                parsedArgs as unknown as CreateCampaignFromWebsiteParams,
                user
              )
              break
            }
            case 'create_campaign_from_profile': {
              log.info('Executing create_campaign_from_profile with params:', parsedArgs)
              result = await executeCreateCampaignFromProfile(
                parsedArgs as unknown as CreateCampaignFromProfileParams,
                user
              )
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
            case 'campaign_status': {
              log.info('Executing campaign_status with params:', parsedArgs)
              result = await executeCampaignStatus(user, parsedArgs as { campaignId?: string })
              break
            }
            case 'get_campaign_creator_details': {
              log.info('Executing get_campaign_creator_details with params:', parsedArgs)
              result = await executeGetCampaignCreatorDetails(
                user,
                parsedArgs as { campaignId?: string; status?: string; limit?: number }
              )
              break
            }
            case 'create_brand_profile_from_website': {
              log.info('Executing create_brand_profile_from_website with params:', parsedArgs)
              result = await executeCreateBrandProfileFromWebsite(
                parsedArgs as unknown as CreateBrandProfileFromWebsiteParams,
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
          await conversationStore.addMessage(
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
          await conversationStore.addMessage(
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
      const updatedMessages = await conversationStore.getMessages(currentConversationId)
      const followUpMessages = updatedMessages.map((msg) => {
        if (msg.role === 'system') {
          return { role: 'system' as const, content: msg.content }
        }
        if (msg.role === 'user') {
          return { role: 'user' as const, content: msg.content }
        }
        if (msg.role === 'assistant') {
          if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
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
        message: cleanAIResponse(finalCompletion.choices[0]?.message?.content || response.message),
        toolCalls: toolResults,
        conversationId: response.conversationId
      }

      // Store final assistant response
      const finalResponseContent = cleanAIResponse(
        finalCompletion.choices[0]?.message?.content || ''
      )
      log.info('Storing final assistant response:', {
        conversationId: currentConversationId,
        finalResponseContent,
        originalResponseMessage: response.message,
        contentLength: finalResponseContent.length
      })

      await conversationStore.addMessage(currentConversationId, 'assistant', finalResponseContent)
    } else {
      // No tool calls, just store the assistant response
      const directResponseContent = cleanAIResponse(assistantMessage.content || '')
      log.info('Storing direct assistant response (no tool calls):', {
        conversationId: currentConversationId,
        directResponseContent,
        contentLength: directResponseContent.length
      })

      await conversationStore.addMessage(currentConversationId, 'assistant', directResponseContent)
    }

    // Debug: Log the final response being returned to frontend
    log.info('Final response being returned to frontend:', {
      conversationId: currentConversationId,
      message: response.message,
      messageLength: response.message?.length || 0,
      toolCallsCount: response.toolCalls?.length || 0
    })

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

import { groq } from '@/libs/groq'
import { log } from '@/libs/logger'
import { type DiscoverCreatorParams } from '@/api/discover'
import {
  discoverCreatorsTool,
  createCampaignTool,
  listCampaignsTool,
  addCreatorsToCampaignTool,
  bulkOutreachTool,
  deleteCampaignTool
} from './tools'
import {
  executeDiscoverCreators,
  executeCreateCampaign,
  executeListCampaigns,
  executeAddCreatorsToCampaign,
  executeBulkOutreach,
  executeDeleteCampaign
} from './services'
import { creatorDiscoverySystemPrompt } from './prompts'
import { type ToolCallResult, type ChatResponse, type CreateCampaignChatParams } from './types'
import { persistentConversationStore as conversationStore } from './conversation-store'
import { type UserJwt } from '@/middlewares/jwt'
import configs from '@/configs'

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

    // Call Groq with function calling and error handling
    let completion
    try {
      completion = await groq.chat.completions.create({
        model: configs.groqModel,
        messages,
        tools: [
          discoverCreatorsTool,
          createCampaignTool,
          listCampaignsTool,
          addCreatorsToCampaignTool,
          bulkOutreachTool,
          deleteCampaignTool
        ],
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1024
      })
    } catch (error: unknown) {
      // Handle rate limit errors specifically
      if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
        log.error('Groq API rate limit exceeded:', error)
        return {
          message:
            "I apologize, but I've reached my daily API limit. Please try again in a few minutes or contact support to upgrade the service tier.",
          toolCalls: [],
          conversationId: currentConversationId,
          isError: true
        }
      }

      // Handle other API errors
      if (error && typeof error === 'object' && 'status' in error) {
        log.error('Groq API error:', error)
        return {
          message: "I'm experiencing some technical difficulties. Please try again in a moment.",
          toolCalls: [],
          conversationId: currentConversationId,
          isError: true
        }
      }

      // Re-throw other errors
      throw error
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

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.function.name === 'discover_creators') {
          try {
            let rawParams: DiscoverCreatorParams
            try {
              rawParams = JSON.parse(toolCall.function.arguments) as DiscoverCreatorParams
            } catch (parseError) {
              log.error('Failed to parse tool call arguments:', {
                arguments: toolCall.function.arguments,
                parseError
              })
              throw new Error('Invalid function arguments format')
            }

            // Validate and coerce parameter types to handle AI model inconsistencies
            const params: DiscoverCreatorParams = {
              ...rawParams,
              // Ensure limit is a number, not a string
              limit: validateAndCoerceNumericParam(rawParams.limit, 'limit', 1, 50),
              // Ensure skip is a number if provided
              skip: validateAndCoerceNumericParam(rawParams.skip, 'skip', 0)
            }

            log.info('Executing discover_creators with params:', params)

            const result = await executeDiscoverCreators(params)
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify(result),
              undefined,
              toolCall.id
            )
          } catch (error) {
            log.error('Error executing discover_creators tool call:', {
              error,
              arguments: toolCall.function.arguments,
              toolCallId: toolCall.id
            })
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result: {
                success: false,
                error:
                  'Failed to execute creator search. Please check your parameters and try again.'
              }
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify({
                success: false,
                error:
                  'Failed to execute creator search. Please check your parameters and try again.'
              }),
              undefined,
              toolCall.id
            )
          }
        } else if (toolCall.function.name === 'create_campaign') {
          try {
            const params = JSON.parse(toolCall.function.arguments) as CreateCampaignChatParams
            log.info('Executing create_campaign with params:', params)

            const result = await executeCreateCampaign(params, user)
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify(result),
              undefined,
              toolCall.id
            )
          } catch (error) {
            log.error('Error executing campaign creation:', error)
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result: {
                success: false,
                error: 'Failed to create campaign'
              }
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify({
                success: false,
                error: 'Failed to create campaign'
              }),
              undefined,
              toolCall.id
            )
          }
        } else if (toolCall.function.name === 'list_campaigns') {
          try {
            log.info('Executing list_campaigns')

            const result = await executeListCampaigns(user)
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify(result),
              undefined,
              toolCall.id
            )
          } catch (error) {
            log.error('Error executing list campaigns:', error)
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result: {
                success: false,
                error: 'Failed to list campaigns'
              }
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify({
                success: false,
                error: 'Failed to list campaigns'
              }),
              undefined,
              toolCall.id
            )
          }
        } else if (toolCall.function.name === 'add_creators_to_campaign') {
          try {
            const params = JSON.parse(toolCall.function.arguments) as {
              campaignId: string
              creatorHandles: string[]
              assignedBudget?: number
              notes?: string
            }
            log.info('Executing add_creators_to_campaign with params:', params)

            const result = await executeAddCreatorsToCampaign(params, user, currentConversationId)
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify(result),
              undefined,
              toolCall.id
            )
          } catch (error) {
            log.error('Error executing add creators to campaign:', error)
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result: {
                success: false,
                error: 'Failed to add creators to campaign'
              }
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify({
                success: false,
                error: 'Failed to add creators to campaign'
              }),
              undefined,
              toolCall.id
            )
          }
        } else if (toolCall.function.name === 'bulk_outreach') {
          try {
            const params = JSON.parse(toolCall.function.arguments) as {
              campaignId: string
              creatorIds?: string[]
              personalizedMessage?: string
              confirmTemplate?: boolean
            }
            log.info('Executing bulk_outreach with params:', params)

            const result = await executeBulkOutreach(params, user, currentConversationId)
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify(result),
              undefined,
              toolCall.id
            )
          } catch (error) {
            log.error('Error executing bulk outreach:', error)
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result: {
                success: false,
                error: 'Failed to execute bulk outreach'
              }
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify({
                success: false,
                error: 'Failed to execute bulk outreach'
              }),
              undefined,
              toolCall.id
            )
          }
        } else if (toolCall.function.name === 'delete_campaign') {
          try {
            const params = JSON.parse(toolCall.function.arguments) as {
              campaignId: string
              confirmDelete: boolean
            }
            log.info('Executing delete_campaign with params:', params)

            const result = await executeDeleteCampaign(params, user)
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify(result),
              undefined,
              toolCall.id
            )
          } catch (error) {
            log.error('Error executing delete campaign:', error)
            toolResults.push({
              toolCallId: toolCall.id,
              functionName: toolCall.function.name,
              result: {
                success: false,
                error: 'Failed to delete campaign'
              }
            })

            // Store tool result in conversation
            conversationStore.addMessage(
              currentConversationId,
              'tool',
              JSON.stringify({
                success: false,
                error: 'Failed to delete campaign'
              }),
              undefined,
              toolCall.id
            )
          }
        }
      }

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

      // Get final response from Groq
      const finalCompletion = await groq.chat.completions.create({
        model: configs.groqModel,
        messages: followUpMessages,
        temperature: 0.7,
        max_tokens: 1024
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

import { groq } from '@/libs/groq'
import { log } from '@/libs/logger'
import { type DiscoverCreatorParams } from '@/api/discover'
import { discoverCreatorsTool, createCampaignTool } from './tools'
import { executeDiscoverCreators, executeCreateCampaign } from './services'
import { creatorDiscoverySystemPrompt } from './prompts'
import { type ToolCallResult, type ChatResponse, type CreateCampaignChatParams } from './types'
import { conversationStore } from './conversation-store'
import { type UserJwt } from '@/middlewares/jwt'

export async function handleChatMessage(
  message: string,
  user: UserJwt,
  conversationId?: string
): Promise<ChatResponse> {
  log.info('Chat request received:', { message, conversationId })

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

  // Call Groq with function calling
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    tools: [discoverCreatorsTool, createCampaignTool],
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 1024
  })

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
          const params = JSON.parse(toolCall.function.arguments) as DiscoverCreatorParams
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
          log.error('Error executing tool call:', error)
          toolResults.push({
            toolCallId: toolCall.id,
            functionName: toolCall.function.name,
            result: {
              success: false,
              error: 'Failed to execute creator search'
            }
          })

          // Store tool result in conversation
          conversationStore.addMessage(
            currentConversationId,
            'tool',
            JSON.stringify({
              success: false,
              error: 'Failed to execute creator search'
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
      model: 'llama-3.3-70b-versatile',
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
    conversationStore.addMessage(currentConversationId, 'assistant', assistantMessage.content || '')
  }

  return response
}

import { groq } from '@/libs/groq'
import { log } from '@/libs/logger'
import { type DiscoverCreatorParams } from '@/api/discover'
import { discoverCreatorsTool } from './tools'
import { executeDiscoverCreators } from './services'
import { creatorDiscoverySystemPrompt } from './prompts'
import { type ToolCallResult, type ChatResponse } from './types'

export async function handleChatMessage(
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  log.info('Chat request received:', { message, conversationId })

  // Prepare messages for Groq
  const messages = [
    {
      role: 'system' as const,
      content: creatorDiscoverySystemPrompt
    },
    {
      role: 'user' as const,
      content: message
    }
  ]

  // Call Groq with function calling
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    tools: [discoverCreatorsTool],
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
    conversationId: conversationId || `chat_${Date.now()}`
  }

  // Handle function calls if any
  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
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
        }
      }
    }

    // Generate final response with tool results
    const followUpMessages = [
      ...messages,
      {
        role: 'assistant' as const,
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls
      },
      ...toolResults.map((result) => ({
        role: 'tool' as const,
        tool_call_id: result.toolCallId,
        content: JSON.stringify(result.result)
      }))
    ]

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
  }

  return response
}

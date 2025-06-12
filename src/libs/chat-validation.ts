/**
 * Environment validation for Chat API
 */

import configs from '@/configs'
import { log } from '@/libs/logger'

export function validateChatEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check Groq API Key
  if (!configs.groqApiKey) {
    errors.push('GROQ_API_KEY environment variable is not set')
  }

  // Check Ylytic API Key (needed for creator discovery)
  if (!configs.yltic.apiKey) {
    errors.push('YLYTIC_API_KEY environment variable is not set')
  }

  const isValid = errors.length === 0

  if (!isValid) {
    log.error('Chat API environment validation failed:', errors)
  } else {
    log.info('Chat API environment validation passed')
  }

  return { isValid, errors }
}

export function logChatStartup() {
  const validation = validateChatEnvironment()

  if (validation.isValid) {
    log.info('✅ Chat API is ready to use!')
    log.info('📖 API Documentation: /docs/chat-api.md')
    log.info('🚀 Test with: POST /chat/message')
  } else {
    log.error('❌ Chat API setup incomplete:')
    validation.errors.forEach((error) => log.error(`  - ${error}`))
  }
}

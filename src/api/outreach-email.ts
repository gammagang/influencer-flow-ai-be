import configs from '@/configs'
import { groq } from '@/libs/groq'
import {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam
} from 'groq-sdk/resources/chat/completions'

const SYSTEM_PROMPT =
  `You are an AI email assistant for InfluencerFlow AI, specializing in influencer marketing outreach. Your task is to generate personalized, professional outreach emails using the following data structure:

  Generate an email that:

  1. Uses a clear, compelling subject line
  2. Addresses the creator by name
  3. Introduces the brand and campaign concisely
  4. Incorporates the personalized message naturally
  5. Includes the negotiation link with a clear call-to-action
  6. Maintains a professional yet friendly tone
  7. Keeps the email between 150-200 words
  8. Uses proper formatting with line breaks and structure

  **FORMATTING REQUIREMENTS:**
  - Start with a warm, professional greeting
  - Use proper line breaks (\\n) for paragraph separation  
  - Include clear section breaks between greeting, body, and closing
  - Format the call-to-action prominently with proper spacing
  - End with a professional signature
  - Example structure:
    "Hi [Name],\\n\\n[Introduction paragraph]\\n\\n[Campaign details paragraph]\\n\\n[Call to action with link]\\n\\nBest regards,\\nThe [Brand] Team"

  IMPORTANT: Always include the negotiation link in the email body with a compelling call-to-action phrase like "Ready to discuss this opportunity?" or "Click here to start the conversation:" followed by the link.

  Required Input Format:

  \`\`\`json
  {
    "subject": "string",
    "recipient": {
      "name": "string",
      "email": "string"
    },
    "campaignDetails": "string",
    "brandName": "string",
    "campaignName": "string",
    "personalizedMessage": "string",
    "negotiationLink": "string"
  }
  \`\`\`

  Output Format (MUST be valid JSON with proper formatting):

  \`\`\`json
  {
    "subject": "string - The email subject line",
    "body": "string - The complete email body with proper line breaks and formatting"
  }
  \`\`\`

  Note: This system is exclusively for influencer marketing outreach emails. Any other email types or requests will be declined.
` as const

const SYSTEM_PROMPT_MSG: ChatCompletionSystemMessageParam = {
  name: 'Influencer flow',
  role: 'system',
  content: SYSTEM_PROMPT
} as const

function generateChatMsg(content: string): ChatCompletionUserMessageParam {
  return { role: 'user', content }
}

function generateStringifiedObject(obj: object): string {
  return `\n
    \`\`\`json
    ${JSON.stringify(obj, null, 2)}
    \`\`\`
    \n
  `
}

export async function generateUserOutreachEmail(candidate: Record<string, unknown>) {
  const msg = `Generate a personalized outreach email for the following creator: ${generateStringifiedObject(
    candidate
  )}`

  const messages: ChatCompletionMessageParam[] = [SYSTEM_PROMPT_MSG, generateChatMsg(msg)]

  const completion = await groq.chat.completions.create({
    messages,
    model: configs.groqModel,
    response_format: { type: 'json_object' },
    temperature: 0.7
  })

  const mail = completion.choices[0].message.content

  if (!mail) throw new Error('Failed to generate email content')

  try {
    const parsedResponse = JSON.parse(mail)
    if (!parsedResponse.subject || !parsedResponse.body)
      throw new Error('Invalid response format: missing subject or body')

    return {
      subject: parsedResponse.subject,
      body: parsedResponse.body
    }
  } catch {
    throw new Error('Failed to parse email response as JSON')
  }
}

// Template generation function that creates emails with placeholders
export async function generateEmailTemplate(templateData: Record<string, unknown>) {
  const msg = `Generate a reusable email template with placeholders for the following campaign data: ${generateStringifiedObject(
    templateData
  )}
  
  IMPORTANT: Use these exact placeholders in your response:
  - {{CREATOR_NAME}} for the creator's name
  - {{NEGOTIATION_LINK}} for the negotiation/agent call link
  
  The placeholders should appear naturally in the email text where personalization is needed.`

  const messages: ChatCompletionMessageParam[] = [SYSTEM_PROMPT_MSG, generateChatMsg(msg)]

  const completion = await groq.chat.completions.create({
    messages,
    model: configs.groqModel,
    response_format: { type: 'json_object' },
    temperature: 0.7
  })

  const mail = completion.choices[0].message.content

  if (!mail) throw new Error('Failed to generate email template')

  try {
    const parsedResponse = JSON.parse(mail)
    if (!parsedResponse.subject || !parsedResponse.body)
      throw new Error('Invalid template format: missing subject or body')

    return {
      subject: parsedResponse.subject,
      body: parsedResponse.body
    }
  } catch {
    throw new Error('Failed to parse email template as JSON')
  }
}

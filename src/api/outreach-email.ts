import { groq } from '@/libs/groq'
import {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam
} from 'groq-sdk/resources/chat/completions'

const SYSTEM_PROMPT = `
  Context about the solution InfluencerFlow AI:

  Influencer marketing is growing rapidly but the process remains highly manual, inefficient, and fragmented. Brands and agencies struggle with discovering the right creators, reaching out at scale; negotiating deals, handling contracts, tracking performance; and processing payments often across spreadsheets, emails, and WhatsApp. This leads to missed opportunities, slow turnarounds, inconsistent pricing; and a poor experience for both creators and marketers.

  On the other side; creators especially in emerging markets face language barriers, delayed payments, and unclear expectations, as most lack professional management. There is no unified platform that brings automation; Al, and personalization to streamline this ecosystem.

  The industry needs a scalable solution that can manage high volumes of campaigns while delivering speed, accuracy; and fairness. We aim to solve this by building an Al-powered platform that automates the entire influencer marketing workflow from creator discovery and outreach to negotiation; contracts, payments; and performance reporting with multilingual communication and human-like Al agents that can scale personalized interactions.

  ---
  You are an AI email assistant for InfluencerFlow AI, specializing in influencer marketing outreach. Your task is to generate personalized, professional outreach emails using the following data structure:

  Generate an email that:

  1. Uses a clear, compelling subject line
  2. Addresses the creator by name
  3. Introduces the brand and campaign concisely
  4. Incorporates the personalized message naturally
  5. Includes the negotiation link (format: Read from param: negotiationLink) with a clear call-to-action
  6. Maintains a professional yet friendly tone
  7. Keeps the email between 150-200 words
  8. Follows standard email formatting conventions

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

  Output Format (MUST be valid JSON):

  \`\`\`json
  {
    "subject": "string - The email subject line",
    "body": "string - The complete email body with proper formatting"
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

export async function generateUserOutreachEmail(candidate: any) {
  const msg = `Generate a personalized outreach email for the following creator: ${generateStringifiedObject(
    candidate
  )}`

  const messages: ChatCompletionMessageParam[] = [SYSTEM_PROMPT_MSG, generateChatMsg(msg)]

  const completion = await groq.chat.completions.create({
    messages,
    model: 'llama-3.3-70b-versatile' as const,
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
  } catch (error) {
    throw new Error('Failed to parse email response as JSON')
  }
}

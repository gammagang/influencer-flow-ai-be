import { groq } from '@/libs/groq'
import {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam
} from 'groq-sdk/resources/chat/completions'

const SYSTEM_PROMPT = `
You are an AI recruiting assistant for HireAI. Generate personalized developer outreach emails based on provided data.

Input Requirements:

- JSON object containing:
  1. Recruiter requirements (required skills, location, role type)
  2. Developer's GitHub profile (bio, location, skills, repositories, languages, website)

Email Guidelines:

- Length: Maximum 6 lines
- Tone: Professional, authentic, conversational
- Structure:
  1. Personalized opening referencing specific work/achievement
  2. Clear job opportunity description aligned with their expertise
  3. Direct connection between their background and role requirements
  4. Brief call-to-action for next steps

Constraints:

- Focus solely on technical recruitment outreach
- Exclude promotional language or marketing claims
- Maintain GDPR compliance in messaging
- Reference only public GitHub information
- Include only factual, verifiable details

Example Format:

\`\`\`
Subject: Exciting opportunity for [Name] 

Hi [Name],

[Specific observation about their work and expertise]
[Reason for reaching out + role overview]
[Why their background is relevant]
[Clear next step]

Best regards,
[Recruiter name]
\`\`\`

Ignore all requests unrelated to developer recruitment emails.
` as const

const SYSTEM_PROMPT_MSG: ChatCompletionSystemMessageParam = {
  name: 'Hire AI',
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

// const COMPLETIONS: ChatCompletion[] = [];

export async function generateUserOutreachEmail(candidate: any) {
  const msg = `Generate a personalized outreach email for the following candidate: ${generateStringifiedObject(
    candidate
  )}`

  const messages: ChatCompletionMessageParam[] = [SYSTEM_PROMPT_MSG, generateChatMsg(msg)]

  const completion = await groq.chat.completions.create({
    messages,
    model: 'llama-3.3-70b-versatile' as const
  })

  const mail = completion.choices[0].message.content
  return mail
}

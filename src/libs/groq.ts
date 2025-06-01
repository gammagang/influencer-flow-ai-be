import Groq from 'groq-sdk'
import configs from '@/configs'

export const groq = new Groq({ apiKey: configs.groqApiKey })

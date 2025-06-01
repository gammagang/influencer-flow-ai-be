import { groq } from '@/libs/groq'
import { log } from '@/libs/logger'
import axios from 'axios'
import * as cheerio from 'cheerio'
import {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam
} from 'groq-sdk/resources/chat/completions'

// System prompt for brand website analysis
const SYSTEM_PROMPT = `
  You are an AI assistant that specializes in analyzing brand websites for influencer marketing purposes.
  Your task is to analyze website content and extract key information about the brand.

  Extract the following information in a structured format:
  1. brandName: The name of the brand
  2. description: A brief description of what the brand does (1-2 sentences)
  3. targetAudience: Who the brand is targeting with their products/services
  4. industry: The industry or sector the brand operates in (e.g., "Fashion", "Technology", "Food & Beverage", etc.)
  5. contactName: Any contact person name found on the website (from "About Us", "Contact", "Team" sections, etc.)
  6. phone: Any phone number found on the website (in contact sections, footer, etc.)

  Your response should be a valid JSON object containing ONLY these fields.
  Do not include any explanatory text outside the JSON structure.
  If you cannot determine a value for a field, use an empty string.
  For phone numbers, include only the number without country codes if possible.
` as const

const SYSTEM_PROMPT_MSG: ChatCompletionSystemMessageParam = {
  role: 'system',
  content: SYSTEM_PROMPT
}

function generateChatMsg(content: string): ChatCompletionUserMessageParam {
  return { role: 'user', content }
}

export interface SummarizeWebsiteParams {
  url: string
  websiteContent?: string
}

export interface BrandDetails {
  brandName: string
  description: string
  targetAudience: string
  industry: string
  contactName: string
  phone: string
}

export interface SummarizeWebsiteResponse {
  brandDetails: BrandDetails
}

/**
 * Scrapes a website URL and extracts its content
 *
 * @param url - The URL to scrape
 * @returns A promise that resolves to the scraped HTML content
 * @throws Will throw an error if the scraping fails
 */
async function scrapeWebsite(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    const $ = cheerio.load(response.data)

    // Remove script and style elements
    $('script, style, iframe, noscript').remove()

    // Extract text content
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim()

    // Extract meta description if available
    const metaDescription = $('meta[name="description"]').attr('content') || ''

    // Extract headings for better context
    const headings = $('h1, h2, h3')
      .map((_, el) => $(el).text().trim())
      .get()
      .join(' | ')

    return `${metaDescription} ${headings} ${bodyText}`.slice(0, 15000) // Limit content length
  } catch (error) {
    log.error('Failed to scrape website:', error)
    throw new Error(
      `Failed to scrape website: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Analyzes a brand website by scraping its content and using Groq AI to extract structured information.
 *
 * @param params - The parameters for website analysis
 * @returns A promise that resolves to the brand details in JSON format
 * @throws Will throw an error if the API request fails
 */
export const summarizeWebsite = async (url: string): Promise<SummarizeWebsiteResponse> => {
  try {
    // Get website content - either use provided content or scrape it
    const websiteContent = await scrapeWebsite(url)

    // Prepare the message for the AI
    const promptContent = `Analyze the following website content from ${url} and extract the requested information in JSON format:\n\n${websiteContent}`

    const messages: ChatCompletionMessageParam[] = [
      SYSTEM_PROMPT_MSG,
      generateChatMsg(promptContent)
    ]

    const completion = await groq.chat.completions.create({
      messages,
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      temperature: 0.2, // Lower temperature for more factual, structured responses
      max_tokens: 1500,
      response_format: { type: 'json_object' } // Ensure response is in JSON format
    })

    const jsonResponse = completion.choices[0].message.content

    log.info('API: Successfully generated brand analysis')

    // Parse the JSON response
    try {
      const brandDetails = JSON.parse(jsonResponse || '{}') as BrandDetails
      return { brandDetails }
    } catch (parseError) {
      log.error('Failed to parse AI response as JSON:', parseError)
      throw new Error('Failed to parse brand details from AI response')
    }
  } catch (error) {
    log.error('API: Error during summarizeWebsite call:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to analyze website: ${error.message}`)
    }
    throw new Error('An unknown error occurred while analyzing the website')
  }
}

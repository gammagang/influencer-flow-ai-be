import { groq } from '@/libs/groq'
import { log } from '@/libs/logger'
import axios from 'axios'
import * as cheerio from 'cheerio'
import {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam
} from 'groq-sdk/resources/chat/completions'

// System prompt for campaign information extraction from website
const CAMPAIGN_EXTRACTION_PROMPT = `
  You are an AI assistant that specializes in analyzing brand websites to extract information relevant for creating influencer marketing campaigns.
  
  Analyze the website content and extract the following information in a structured JSON format:
  
  1. suggestedCampaignName: A catchy, descriptive campaign name based on the brand/product (e.g., "Nike Summer Athletics Campaign", "Starbucks Holiday Blend Promotion")
  2. brandName: The name of the brand/company
  3. description: A comprehensive campaign description that includes:
     - What the brand/product is about
     - Campaign objectives and goals
     - Target audience
     - Key messaging points
  4. suggestedDeliverables: An array of likely deliverables for this type of brand/campaign (e.g., ["Instagram post", "Story highlight", "Reel", "YouTube video"])
  5. industry: The industry or sector (e.g., "Fashion", "Technology", "Food & Beverage", "Travel", "Beauty")
  6. targetAudience: Detailed description of the target audience
  7. keyProducts: Array of main products/services mentioned on the website
  8. campaignType: Suggested campaign type (e.g., "Product Launch", "Brand Awareness", "Seasonal Promotion", "Event Marketing")
  
  Your response should be a valid JSON object containing ONLY these fields.
  Do not include any explanatory text outside the JSON structure.
  If you cannot determine a value for a field, use an empty string or empty array as appropriate.
  Make the campaign name creative and engaging, not just the brand name.
  For deliverables, suggest 3-5 realistic options based on the brand type and typical influencer marketing practices.
` as const

const SYSTEM_PROMPT_MSG: ChatCompletionSystemMessageParam = {
  role: 'system',
  content: CAMPAIGN_EXTRACTION_PROMPT
}

function generateChatMsg(content: string): ChatCompletionUserMessageParam {
  return { role: 'user', content }
}

export interface CampaignExtractionResult {
  suggestedCampaignName: string
  brandName: string
  description: string
  suggestedDeliverables: string[]
  industry: string
  targetAudience: string
  keyProducts: string[]
  campaignType: string
}

export interface UserProvidedDetails {
  name?: string
  startDate?: string
  endDate?: string
  deliverables?: string[]
  description?: string
}

export interface CreateCampaignFromWebsiteParams {
  url: string
  userProvidedDetails?: UserProvidedDetails
}

export interface CreateCampaignFromWebsiteResponse {
  extractedInfo: CampaignExtractionResult
  missingRequiredFields: string[]
  canCreateCampaign: boolean
  suggestedCampaignData?: {
    name: string
    description: string
    startDate?: string
    endDate?: string
    deliverables: string[]
  }
}

/**
 * Scrapes a website URL and extracts its content
 * Reuses the scraping logic from summarize.ts
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
 * Extracts campaign-relevant information from website content using AI
 */
async function extractCampaignInfo(
  url: string,
  websiteContent: string
): Promise<CampaignExtractionResult> {
  try {
    const promptContent = `Analyze the following website content from ${url} and extract campaign information in JSON format:\n\n${websiteContent}`

    const messages: ChatCompletionMessageParam[] = [
      SYSTEM_PROMPT_MSG,
      generateChatMsg(promptContent)
    ]

    const completion = await groq.chat.completions.create({
      messages,
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      temperature: 0.3, // Slightly higher temperature for creative campaign names
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })

    const jsonResponse = completion.choices[0].message.content

    try {
      const extractedInfo = JSON.parse(jsonResponse || '{}') as CampaignExtractionResult
      return extractedInfo
    } catch (parseError) {
      log.error('Failed to parse AI response as JSON:', parseError)
      throw new Error('Failed to parse campaign information from AI response')
    }
  } catch (error) {
    log.error('Error extracting campaign info:', error)
    throw new Error('Failed to extract campaign information from website')
  }
}

/**
 * Determines which required fields are missing for campaign creation
 */
function identifyMissingFields(
  extractedInfo: CampaignExtractionResult,
  userProvidedDetails?: UserProvidedDetails
): string[] {
  const missing: string[] = []

  // Check campaign name
  if (!userProvidedDetails?.name && !extractedInfo.suggestedCampaignName) {
    missing.push('Campaign name')
  }

  // Check dates (always required from user as they're time-sensitive)
  if (!userProvidedDetails?.startDate) {
    missing.push('Start date')
  }

  if (!userProvidedDetails?.endDate) {
    missing.push('End date')
  }

  // Check deliverables
  if (!userProvidedDetails?.deliverables?.length && !extractedInfo.suggestedDeliverables?.length) {
    missing.push('Deliverables')
  }

  return missing
}

/**
 * Creates campaign data structure if all required fields are available
 */
function prepareCampaignData(
  extractedInfo: CampaignExtractionResult,
  userProvidedDetails?: UserProvidedDetails
) {
  return {
    name: userProvidedDetails?.name || extractedInfo.suggestedCampaignName,
    description: userProvidedDetails?.description || extractedInfo.description,
    startDate: userProvidedDetails?.startDate,
    endDate: userProvidedDetails?.endDate,
    deliverables: userProvidedDetails?.deliverables || extractedInfo.suggestedDeliverables
  }
}

/**
 * Main function to analyze website and prepare campaign creation
 */
export const createCampaignFromWebsite = async (
  params: CreateCampaignFromWebsiteParams
): Promise<CreateCampaignFromWebsiteResponse> => {
  try {
    log.info(`Starting website analysis for campaign creation: ${params.url}`)

    // Step 1: Scrape website content
    const websiteContent = await scrapeWebsite(params.url)

    // Step 2: Extract campaign information using AI
    const extractedInfo = await extractCampaignInfo(params.url, websiteContent)

    // Step 3: Identify missing required fields
    const missingRequiredFields = identifyMissingFields(extractedInfo, params.userProvidedDetails)

    // Step 4: Determine if campaign can be created
    const canCreateCampaign = missingRequiredFields.length === 0

    // Step 5: Prepare campaign data if ready
    let suggestedCampaignData
    if (canCreateCampaign) {
      suggestedCampaignData = prepareCampaignData(extractedInfo, params.userProvidedDetails)
    }

    log.info(`Website analysis complete. Missing fields: ${missingRequiredFields.join(', ')}`)

    return {
      extractedInfo,
      missingRequiredFields,
      canCreateCampaign,
      suggestedCampaignData
    }
  } catch (error) {
    log.error('Error in createCampaignFromWebsite:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to analyze website for campaign creation: ${error.message}`)
    }
    throw new Error('An unknown error occurred while analyzing the website')
  }
}

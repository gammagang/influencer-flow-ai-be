import { groq } from '@/libs/groq'
import { log } from '@/libs/logger'
import axios from 'axios'
import * as cheerio from 'cheerio'
import {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam
} from 'groq-sdk/resources/chat/completions'

// System prompt for brand profile extraction from website
const BRAND_PROFILE_EXTRACTION_PROMPT = `
  You are an AI assistant that specializes in analyzing brand websites to extract information relevant for creating a company brand profile.
  
  Analyze the website content and extract the following information in a structured JSON format:
  
  1. brandName: The name of the brand/company
  2. description: A comprehensive brand description that includes:
     - What the brand/company does
     - Their mission/vision
     - Key value propositions
     - Main products or services offered
  3. industry: The industry or sector the brand operates in (e.g., "Fashion", "Technology", "Food & Beverage", "Travel", "Beauty", "Healthcare", "Fitness", "Home & Garden", etc.)
  4. targetAudience: Detailed description of the target audience/customers
  5. contactName: Any contact person name found on the website (from "About Us", "Contact", "Team" sections, etc.)
  6. phone: Any phone number found on the website (in contact sections, footer, etc.)
  7. email: Any email address found on the website (in contact sections, footer, etc.)
  8. keyProducts: Array of main products/services mentioned on the website
  9. companySize: Estimated company size based on website content ("Startup", "Small Business", "Medium Business", "Enterprise", "Unknown")
  10. location: Any location/address information found on the website
  
  Your response should be a valid JSON object containing ONLY these fields.
  Do not include any explanatory text outside the JSON structure.
  If you cannot determine a value for a field, use an empty string or empty array as appropriate.
  For phone numbers, include the full number as found on the website.
  For email addresses, include the main contact or business email found.
` as const

const SYSTEM_PROMPT_MSG: ChatCompletionSystemMessageParam = {
  role: 'system',
  content: BRAND_PROFILE_EXTRACTION_PROMPT
}

function generateChatMsg(content: string): ChatCompletionUserMessageParam {
  return { role: 'user', content }
}

export interface BrandProfileExtractionResult {
  brandName: string
  description: string
  industry: string
  targetAudience: string
  contactName: string
  phone: string
  email: string
  keyProducts: string[]
  companySize: string
  location: string
}

export interface UserProvidedBrandDetails {
  name?: string
  phone?: string
  description?: string
  category?: string
}

export interface CreateBrandProfileFromWebsiteParams {
  url: string
  userProvidedDetails?: UserProvidedBrandDetails
}

export interface CreateBrandProfileFromWebsiteResponse {
  extractedInfo: BrandProfileExtractionResult
  missingRequiredFields: string[]
  canCreateProfile: boolean
  suggestedProfileData?: {
    name: string
    website: string
    description: string
    category: string
    phone: string
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
 * Extracts brand profile information from website content using AI
 */
async function extractBrandProfileInfo(
  url: string,
  websiteContent: string
): Promise<BrandProfileExtractionResult> {
  try {
    const promptContent = `Analyze the following website content from ${url} and extract brand profile information in JSON format:\n\n${websiteContent}`

    const messages: ChatCompletionMessageParam[] = [
      SYSTEM_PROMPT_MSG,
      generateChatMsg(promptContent)
    ]

    const completion = await groq.chat.completions.create({
      messages,
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      temperature: 0.2, // Lower temperature for more factual analysis
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })

    const jsonResponse = completion.choices[0].message.content

    try {
      const extractedInfo = JSON.parse(jsonResponse || '{}') as BrandProfileExtractionResult
      return extractedInfo
    } catch (parseError) {
      log.error('Failed to parse AI response as JSON:', parseError)
      throw new Error('Failed to parse brand profile information from AI response')
    }
  } catch (error) {
    log.error('Error extracting brand profile info:', error)
    throw new Error('Failed to extract brand profile information from website')
  }
}

/**
 * Determines which required fields are missing for brand profile creation
 */
function identifyMissingFields(
  extractedInfo: BrandProfileExtractionResult,
  userProvidedDetails?: UserProvidedBrandDetails
): string[] {
  const missing: string[] = []

  // Check brand name (required)
  if (!userProvidedDetails?.name && !extractedInfo.brandName) {
    missing.push('Brand name')
  }

  // Check industry/category (required)
  if (!userProvidedDetails?.category && !extractedInfo.industry) {
    missing.push('Industry/Category')
  }

  // Description is recommended but not strictly required
  if (!userProvidedDetails?.description && !extractedInfo.description) {
    missing.push('Brand description')
  }

  // Phone is recommended but not strictly required
  if (!userProvidedDetails?.phone && !extractedInfo.phone) {
    missing.push('Phone number')
  }

  return missing
}

/**
 * Creates brand profile data structure if all required fields are available
 */
function prepareBrandProfileData(
  url: string,
  extractedInfo: BrandProfileExtractionResult,
  userProvidedDetails?: UserProvidedBrandDetails
) {
  return {
    name: userProvidedDetails?.name || extractedInfo.brandName,
    website: url,
    description: userProvidedDetails?.description || extractedInfo.description,
    category: userProvidedDetails?.category || extractedInfo.industry,
    phone: userProvidedDetails?.phone || extractedInfo.phone
  }
}

/**
 * Main function to analyze website and prepare brand profile creation
 */
export const createBrandProfileFromWebsite = async (
  params: CreateBrandProfileFromWebsiteParams
): Promise<CreateBrandProfileFromWebsiteResponse> => {
  try {
    log.info(`Starting website analysis for brand profile creation: ${params.url}`)

    // Step 1: Scrape website content
    const websiteContent = await scrapeWebsite(params.url)

    // Step 2: Extract brand profile information using AI
    const extractedInfo = await extractBrandProfileInfo(params.url, websiteContent)

    // Step 3: Identify missing required fields
    const missingRequiredFields = identifyMissingFields(extractedInfo, params.userProvidedDetails)

    // Step 4: Determine if brand profile can be created
    const canCreateProfile = missingRequiredFields.length === 0

    // Step 5: Prepare brand profile data if ready
    let suggestedProfileData
    if (canCreateProfile) {
      suggestedProfileData = prepareBrandProfileData(
        params.url,
        extractedInfo,
        params.userProvidedDetails
      )
    }

    log.info(`Website analysis complete. Missing fields: ${missingRequiredFields.join(', ')}`)

    return {
      extractedInfo,
      missingRequiredFields,
      canCreateProfile,
      suggestedProfileData
    }
  } catch (error) {
    log.error('Error in createBrandProfileFromWebsite:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to analyze website for brand profile creation: ${error.message}`)
    }
    throw new Error('An unknown error occurred while analyzing the website')
  }
}

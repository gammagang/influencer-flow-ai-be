import configs from '@/configs'
import { log } from '@/libs/logger'

// const YLYTIC_API_BASE_URL = 'https://app.ylytic.com/ylytic/admin/api/v1/search'
const YLYTIC_API_BASE_URL = 'https://dashboard.ylytic.com/ylytic/admin/api/v1/search'

export type ConnectorType = 'instagram' | 'youtube' | 'tiktok' | 'twitter' | 'facebook'
export type TierType =
  | 'early' // 0-1k
  | 'nano' // 1k-10k
  | 'micro' // 10k-100k
  | 'lower-mid' // 100k-250k
  | 'upper-mid' // 250k-500k
  | 'macro' // 500k-1M
  | 'mega' // 1M-5M
  | 'celebrity' // 5M+
export type EngagementRateType =
  | 'vlow' // 0-1%
  | 'low' // 1-3%
  | 'micro' // 3-5%
  | 'mid' // 5-7%
  | 'macro' // 7-10%
  | 'high' // 10-15%
  | 'vhigh' // 15%+
export type PostCountType =
  | 'low' // 1-50
  | 'micro' // 50-200
  | 'mid' // 200-500
  | 'macro' // 500+
export type ContactType = 'email' | 'phone' | 'either' | 'both'
export type AverageViewRangeType =
  | '0-10000'
  | '10000-50000'
  | '50000-100000'
  | '100000-500000'
  | '500000-1000000'
export type ProfileQualityScoreRangeType = '0-25' | '25-50' | '50-75' | '75-100'
export type EffectiveFollowerRateRangeType = '0-1' | '1-3' | '3-5' | '5-7' | '7-10' | '10-15'
export type GenderType = 'male' | 'female' | 'n/a'
export type AgeGroupType = '13-17' | '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65-'

export interface DiscoverCreatorParams {
  skip?: number
  limit?: number
  handle?: string
  connector?: ConnectorType
  location?: string // City
  country?: string
  tier?: TierType[] // Changed: maps to 'followers' in Ylytic API
  er?: EngagementRateType[] // Changed
  posts?: PostCountType
  category?: string[] // Changed
  contact?: ContactType
  bio?: string // Keyword search in bio
  average_views_range?: AverageViewRangeType[] // Changed
  pqs_range?: ProfileQualityScoreRangeType
  efr_range?: EffectiveFollowerRateRangeType
  hashtags?: string
  brand_mentions?: string
  gender?: GenderType // Changed from array to single value
  agegroup?: AgeGroupType[] // Changed
  language?: string[] // New
  sortby?: string // New
  type?: 'discovery' // Fixed value for discovery search
  // `followers` parameter from Ylytic docs is handled by `tier` and mapped.
}

interface YlyticAudience {
  location?: string
  gender?: string
  ageGroup?: string
}

interface YlyticQuality {
  profile_quality_score: number
  profile_quality_rating: number
}

export interface DiscoveredCreator {
  _id: string
  connector: string
  handle: string
  image_link: string // Added
  handle_link: string // Added
  insights_link: string // Added
  followers: number
  engagement: number // Changed: No longer optional
  posts: number // Changed: No longer optional
  category: string // Changed: No longer optional
  audience: YlyticAudience | null // Changed: No longer optional
  full_name: string // Changed: No longer optional
  average_views: number | null // Changed: No longer optional
  gender: string | null // Changed: No longer optional
  age_group: string | null // Changed: No longer optional
  effective_follower_rate: number | null // Changed: No longer optional
  quality: YlyticQuality | null // Changed: No longer optional
  interests: string[] // Changed: No longer optional
  languages: string[] // Added
  location: string | null // Changed: No longer optional, type updated
  state: string | null // Added
  country: string | null // Changed: No longer optional, type updated
  hasEmail: boolean // Changed: No longer optional
  hasPhone: boolean // Changed: No longer optional
  createdDate: string // Changed: No longer optional
  refreshedDate: string // Changed: No longer optional
  status: string // Changed: No longer optional
  source: string // Changed: No longer optional
  inMyCreators: boolean // Changed: No longer optional
}

export interface DiscoverCreatorResponse {
  objects: DiscoveredCreator[]
  // Based on the provided sample, the response is an object with an "objects" array.
  // Other fields like totalResults, page, limit are not present in the sample body.
}

/**
 * Fetches creators from the Ylytic Discovery Search API.
 *
 * @param params - The query parameters for creator discovery.
 * @returns A promise that resolves to the discovery search results.
 * @throws Will throw an error if the API request fails.
 */
export const discoverCreator = async (
  params: DiscoverCreatorParams
): Promise<DiscoverCreatorResponse> => {
  const actualParams = { ...params, connector: 'instagram', limit: 12, skip: 0, type: 'discovery' } // Default to Instagram for now
  log.info('API: discoverCreator called with params:', actualParams)

  const apiKey = configs.ylyticApiKey
  if (!apiKey) {
    // log.error('API: YLYTIC_API_KEY is not set in environment variables.', {}) // Ensure log.error has a context object if needed by your logger setup
    log.error('API: YLYTIC_API_KEY is not set in environment variables.')
    throw new Error('API key for Ylytic is missing.')
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }

  const queryParams = new URLSearchParams({ type: 'discovery' })

  const paramMappings: Partial<Record<keyof DiscoverCreatorParams, string>> = {
    tier: 'followers'
  }

  Object.entries(actualParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const paramKey = paramMappings[key as keyof DiscoverCreatorParams] || key
      let paramValue: string

      if (Array.isArray(value)) {
        if (value.length > 0) {
          // Only append if array is not empty
          paramValue = value.join(',')
          queryParams.append(paramKey, paramValue)
        }
      } else {
        paramValue = String(value)
        queryParams.append(paramKey, paramValue)
      }
    }
  })

  const requestUrl = `${YLYTIC_API_BASE_URL}?${queryParams.toString()}`
  log.info(`API: Requesting Ylytic Discovery API: ${requestUrl}`)

  try {
    const response = await fetch(requestUrl, { headers })

    if (!response.ok) {
      let errorData: any
      try {
        errorData = await response.json()
      } catch (e) {
        errorData = { message: response.statusText }
      }
      log.error('API: Ylytic API request failed:', {
        status: response.status,
        errorData
      })
      throw new Error(
        `Ylytic API Error: ${response.status} - ${errorData?.message || 'Unknown error'}`
      )
    }

    const data: DiscoverCreatorResponse = (await response.json()) as DiscoverCreatorResponse
    log.info('API: Ylytic API response received successfully.')
    return data
  } catch (error) {
    log.error('API: Error during discoverCreator call:', error)
    if (error instanceof Error) {
      // Re-throw the original error or a new error with more context
      throw new Error(`Failed to discover creators via Ylytic: ${error.message}`)
    }
    throw new Error('An unknown error occurred while calling Ylytic discovery API.')
  }
}

import {
  discoverCreator,
  type ConnectorType,
  type DiscoverCreatorParams,
  type EngagementRateType,
  type GenderType,
  type TierType
} from '@/api/discover'
import { log } from '@/libs/logger'
import { SuccessResponse } from '@/libs/success-response'
import { validateRequest } from '@/middlewares/validate-request'
import { Router, type Request, type Response } from 'express'
import {
  DiscoverCreatorsQuerySchema,
  type DiscoverCreatorsQuery // Added type import
} from './validate'

const creatorsRouter = Router()

// Helper function to map follower count to tier
function mapFollowerCountToTier(followers: number): string {
  if (followers < 1000) return 'early'
  if (followers < 10000) return 'nano'
  if (followers < 100000) return 'micro'
  if (followers < 250000) return 'lower-mid'
  if (followers < 500000) return 'upper-mid'
  if (followers < 1000000) return 'macro'
  if (followers < 5000000) return 'mega'
  return 'celebrity'
}

// Helper function to extract age from age group string
function extractAgeFromGroup(ageGroup: string): number | null {
  const match = ageGroup.match(/(\d+)/)
  return match ? parseInt(match[1]) : null
}

creatorsRouter.get('/discover', async (req: Request, res: Response) => {
  // Parse query parameters - handle arrays correctly
  const country = req.query.country as string | undefined
  const tier = Array.isArray(req.query.tier)
    ? req.query.tier
    : req.query.tier
      ? [req.query.tier]
      : undefined
  const er = Array.isArray(req.query.er) ? req.query.er : req.query.er ? [req.query.er] : undefined
  const gender = req.query.gender as string | undefined
  const category = Array.isArray(req.query.category)
    ? req.query.category
    : req.query.category
      ? [req.query.category]
      : undefined
  const language = Array.isArray(req.query.language)
    ? req.query.language
    : req.query.language
      ? [req.query.language]
      : undefined
  const bio = req.query.bio as string | undefined
  const platform = req.query.platform as string | undefined
  const limit = req.query.limit ? Number(req.query.limit) : 12
  const skip = req.query.skip ? Number(req.query.skip) : 0
  const queryObj = {
    country,
    tier,
    er,
    gender,
    category,
    language,
    bio,
    platform
  }

  // Validate request using existing schema
  const validatedQuery = validateRequest(
    DiscoverCreatorsQuerySchema,
    queryObj,
    req.path
  ) as DiscoverCreatorsQuery // Build discovery parameters
  const discoveryParams: DiscoverCreatorParams = {
    country: validatedQuery.country,
    tier: validatedQuery.tier as TierType[] | undefined,
    language: validatedQuery.language,
    category: validatedQuery.category,
    er: validatedQuery.er as EngagementRateType[] | undefined,
    gender: validatedQuery.gender as GenderType | undefined,
    bio: validatedQuery.bio,
    limit,
    skip,
    connector: (validatedQuery.platform as ConnectorType) || 'instagram' // Default to Instagram
  }

  try {
    // Discover creators using the external API
    const discoveryResult = await discoverCreator(discoveryParams)

    // Transform the external API response to match our internal creator format
    const transformedCreators = discoveryResult.objects.map((creator) => ({
      id: creator._id,
      name: creator.full_name || creator.handle,
      platform: creator.connector,
      category: creator.category,
      age: creator.age_group ? extractAgeFromGroup(creator.age_group) : null,
      gender: creator.gender,
      location: creator.location,
      tier: mapFollowerCountToTier(creator.followers),
      engagement_rate: creator.engagement / 100, // Convert percentage to decimal
      email: creator.hasEmail ? 'available' : null,
      phone: creator.hasPhone ? 'available' : null,
      language: creator.languages?.join(', ') || null,
      followersCount: creator.followers,
      postsCount: creator.posts,
      averageViews: creator.average_views,
      handle: creator.handle,
      profileImageUrl: creator.image_link,
      profileUrl: creator.handle_link,
      insightsUrl: creator.insights_link,
      interests: creator.interests,
      country: creator.country,
      state: creator.state,
      qualityScore: creator.quality?.profile_quality_score,
      effectiveFollowerRate: creator.effective_follower_rate,
      createdAt: creator.createdDate,
      updatedAt: creator.refreshedDate,
      meta: {
        ylyticId: creator._id,
        source: creator.source,
        status: creator.status,
        inMyCreators: creator.inMyCreators,
        audience: creator.audience,
        quality: creator.quality
      }
    }))

    SuccessResponse.send({
      res,
      data: {
        creators: transformedCreators,
        total: transformedCreators.length,
        pagination: {
          skip,
          limit,
          hasMore: transformedCreators.length === limit
        }
      }
    })
  } catch (error) {
    log.error('Error discovering creators:', error)
    throw new Error('Failed to discover creators')
  }
})

export { creatorsRouter }

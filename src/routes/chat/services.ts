import { discoverCreator, type DiscoverCreatorParams, mapFollowerCountToTier } from '@/api/discover'
import { log } from '@/libs/logger'

// Function to execute creator discovery
export async function executeDiscoverCreators(params: DiscoverCreatorParams) {
  try {
    const discoveryParams: DiscoverCreatorParams = {
      country: params.country,
      tier: params.tier,
      language: params.language,
      category: params.category,
      er: params.er,
      gender: params.gender,
      bio: params.bio,
      limit: Math.min(params.limit || 12, 50),
      skip: 0,
      connector: 'instagram'
    }

    const discoveryResult = await discoverCreator(discoveryParams)

    // Add debugging
    log.info('Discovery result:', {
      objectsLength: discoveryResult.objects?.length || 0,
      totalFound: discoveryResult.objects?.length || 0,
      searchParams: discoveryParams
    })

    // Transform the results
    const transformedCreators = discoveryResult.objects.map((creator) => ({
      id: creator._id,
      name: creator.full_name || creator.handle,
      handle: creator.handle,
      platform: creator.connector,
      category: creator.category,
      followersCount: creator.followers,
      tier: mapFollowerCountToTier(creator.followers),
      engagement_rate: creator.engagement / 100,
      location: creator.location,
      country: creator.country,
      gender: creator.gender,
      language: creator.languages?.join(', ') || null,
      profileImageUrl: creator.image_link,
      profileUrl: creator.handle_link,
      interests: creator.interests,
      qualityScore: creator.quality?.profile_quality_score
    }))

    return {
      success: true,
      data: {
        creators: transformedCreators,
        total: transformedCreators.length,
        searchParams: discoveryParams
      }
    }
  } catch (error) {
    log.error('Error in executeDiscoverCreators:', error)
    return {
      success: false,
      error: 'Failed to discover creators. Please try again with different parameters.'
    }
  }
}

// Function calling tool definition for creator discovery
export const discoverCreatorsTool = {
  type: 'function' as const,
  function: {
    name: 'discover_creators',
    description:
      'Search and discover creators/influencers based on various criteria like location, follower count, engagement rate, category, etc.',
    parameters: {
      type: 'object',
      properties: {
        country: {
          type: 'string',
          description: 'Country code (e.g., "US", "IN", "UK")'
        },
        tier: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Follower count tiers: "early" (<1k), "nano" (1k-10k), "micro" (10k-100k), "lower-mid" (100k-250k), "upper-mid" (250k-500k), "macro" (500k-1M), "mega" (1M-5M), "celebrity" (>5M)'
        },
        language: {
          type: 'array',
          items: { type: 'string' },
          description: 'Languages spoken by creators (e.g., ["en", "es", "fr"])'
        },
        category: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Content categories (e.g., ["Fashion", "Beauty", "Tech", "Gaming", "Food", "Travel"])'
        },
        er: {
          type: 'array',
          items: { type: 'string' },
          description: 'Engagement rate ranges (e.g., ["1-2", "2-3", "3-5", "5+"])'
        },
        gender: {
          type: 'string',
          description: 'Gender filter: "male", "female", or "other"'
        },
        bio: {
          type: 'string',
          description: 'Keywords to search in creator bio/description'
        },
        limit: {
          type: 'number',
          description: 'Number of creators to return (default: 12, max: 50)'
        }
      }
    }
  }
}

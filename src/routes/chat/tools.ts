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

// Function calling tool definition for campaign creation
export const createCampaignTool = {
  type: 'function' as const,
  function: {
    name: 'create_campaign',
    description:
      'Create a new influencer marketing campaign ONLY when you have collected ALL required information from the user: name, start date, end date, and deliverables. Do not call this function until you have confirmed all required details with the user.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Campaign name (required) - must be provided by user'
        },
        description: {
          type: 'string',
          description: 'Campaign description explaining the goals and objectives (optional)'
        },
        startDate: {
          type: 'string',
          description:
            'Campaign start date in YYYY-MM-DD format (required) - must be provided by user'
        },
        endDate: {
          type: 'string',
          description:
            'Campaign end date in YYYY-MM-DD format (required) - must be provided by user'
        },
        deliverables: {
          type: 'array',
          items: { type: 'string' },
          description:
            'List of deliverables expected from creators (required) - must be provided by user (e.g., ["Instagram post", "Story", "Reel"])'
        }
      },
      required: ['name', 'startDate', 'endDate', 'deliverables']
    }
  }
}

// Function calling tool definition for listing campaigns
export const listCampaignsTool = {
  type: 'function' as const,
  function: {
    name: 'list_campaigns',
    description: "List all campaigns for the current user's company",
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
}

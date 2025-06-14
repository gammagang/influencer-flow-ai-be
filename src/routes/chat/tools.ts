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
          description:
            'Country filter - ONLY include this parameter if user explicitly mentions a specific country or location. Do not include by default.'
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
          description:
            'Number of creators to return (default: 12, max: 50). Must be a number, not a string.',
          minimum: 1,
          maximum: 50,
          default: 12
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

// Function calling tool definition for adding creators to campaign
export const addCreatorsToCampaignTool = {
  type: 'function' as const,
  function: {
    name: 'add_creators_to_campaign',
    description:
      'Add discovered creators to a specific campaign. This should only be used after creators have been discovered using the discover_creators tool in the current conversation.',
    parameters: {
      type: 'object',
      properties: {
        campaignId: {
          type: 'string',
          description: 'The ID of the campaign to add creators to (required)'
        },
        creatorHandles: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Array of creator handles/usernames to add to the campaign (required). Use handles from previously discovered creators.'
        },
        assignedBudget: {
          type: 'number',
          description: 'Budget assigned to each creator (optional, defaults to 1000)'
        },
        notes: {
          type: 'string',
          description: 'Additional notes about adding these creators (optional)'
        }
      },
      required: ['campaignId', 'creatorHandles']
    }
  }
}

// Function calling tool definition for bulk outreach emails
export const bulkOutreachTool = {
  type: 'function' as const,
  function: {
    name: 'bulk_outreach',
    description:
      'Send personalized outreach emails to multiple creators in a campaign. Can preview template first or send directly to eligible creators.',
    parameters: {
      type: 'object',
      properties: {
        campaignId: {
          type: 'string',
          description: 'The ID of the campaign to send outreach emails for (required)'
        },
        creatorIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional: specific creator IDs to send to. If not provided, sends to all eligible creators in the campaign'
        },
        personalizedMessage: {
          type: 'string',
          description: 'Optional: custom message to include in all outreach emails'
        },
        confirmTemplate: {
          type: 'boolean',
          description:
            'If true (default), shows email template preview and eligible creators for confirmation before sending. If false, sends emails directly. ALWAYS use true first for safety.'
        }
      },
      required: ['campaignId']
    }
  }
}

// Function calling tool definition for deleting campaigns
export const deleteCampaignTool = {
  type: 'function' as const,
  function: {
    name: 'delete_campaign',
    description:
      'Delete a campaign permanently. This will also remove all creators linked ONLY to this campaign. Creators linked to other campaigns will remain.',
    parameters: {
      type: 'object',
      properties: {
        campaignId: {
          type: 'string',
          description: 'The ID of the campaign to delete (required)'
        },
        confirmDelete: {
          type: 'boolean',
          description:
            'Confirmation that the user wants to permanently delete the campaign (required, must be true)'
        }
      },
      required: ['campaignId', 'confirmDelete']
    }
  }
}

// Function calling tool definition for smart campaign status
export const smartCampaignStatusTool = {
  type: 'function' as const,
  function: {
    name: 'smart_campaign_status',
    description:
      'Intelligently handle campaign status requests. Shows list of campaigns if multiple exist, gets status directly for single campaign, or suggests creating one if none exist. Use this when user asks about "campaign status" without specifying a campaign ID.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
}

// Function calling tool definition for getting detailed campaign creator statuses
export const getCampaignCreatorDetailsTool = {
  type: 'function' as const,
  function: {
    name: 'get_campaign_creator_details',
    description:
      'Get detailed information about all creators in a specific campaign, with optional filtering by status. Shows individual creator progress, contact info, and current state in the campaign lifecycle.',
    parameters: {
      type: 'object',
      properties: {
        campaignId: {
          type: 'string',
          description: 'The ID of the campaign to get creator details for (required)'
        },
        status: {
          oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
          description:
            'Filter creators by status. Can be a single status or array of statuses. Common values: "discovered", "outreached", "call_initiated", "negotiating", "deal_finalized", "contract_sent", "contract_signed", "content_delivered", "payment_processed"'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of creators to return (optional, default: 1000)',
          minimum: 1,
          maximum: 1000
        }
      },
      required: ['campaignId']
    }
  }
}

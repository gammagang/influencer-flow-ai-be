export interface Creator {
  id: number
  name: string
  platform: string
  category?: string
  age?: number
  gender?: string
  location?: string
  tier?: string
  engagement_rate?: number
  email?: string
  phone?: string
  language?: string
  meta?: any
}

export interface CampaignCreator extends Creator {
  campaign_creator_id: number
  current_state:
    | 'discovered'
    | 'outreached'
    | 'call complete'
    | 'waiting for contract'
    | 'waiting for signature'
    | 'fulfilled'
  assigned_budget?: number
  last_state_change_at?: string
  campaign_creator_meta?: any
}

export interface CampaignRow {
  id: string
  company_id: string
  name: string
  description: string
  start_date: Date
  end_date: Date
  state: string
  meta: Meta
}

export interface Meta {
  budget: Budget
  deliverables: any[]
  targetAudience: TargetAudience
  creatorCriteria: CreatorCriteria
  contentGuidelines: string
}

export interface Budget {
  total: string
  perCreator: string
  paymentModel: string
}

export interface CreatorCriteria {
  followerRange: string
  minEngagement: string
}

export interface TargetAudience {
  gender: string
  ageRange: string
  location: string
  interests: any[]
}

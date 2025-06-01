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

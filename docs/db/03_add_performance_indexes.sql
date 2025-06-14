-- Performance optimization indexes for campaign_creator queries
-- This file adds essential indexes to improve query performance

-- Index for campaign_id lookups (most common filter)
CREATE INDEX IF NOT EXISTS idx_campaign_creator_campaign_id 
ON campaign_creator(campaign_id);

-- Index for creator_id lookups (for JOIN operations)
CREATE INDEX IF NOT EXISTS idx_campaign_creator_creator_id 
ON campaign_creator(creator_id);

-- Index for current_state filtering
CREATE INDEX IF NOT EXISTS idx_campaign_creator_current_state 
ON campaign_creator(current_state);

-- Index for sorting by last_state_change_at
CREATE INDEX IF NOT EXISTS idx_campaign_creator_last_state_change 
ON campaign_creator(last_state_change_at DESC);

-- Composite index for common query patterns (campaign_id + current_state)
CREATE INDEX IF NOT EXISTS idx_campaign_creator_campaign_state 
ON campaign_creator(campaign_id, current_state);

-- Composite index for campaign_id + ordering
CREATE INDEX IF NOT EXISTS idx_campaign_creator_campaign_time 
ON campaign_creator(campaign_id, last_state_change_at DESC);

-- Index for company_id lookups on campaign table
CREATE INDEX IF NOT EXISTS idx_campaign_company_id 
ON campaign(company_id);

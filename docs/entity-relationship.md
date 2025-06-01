# InfluencerFlow MVP — Entity-Relationship Design

## Overview

This ERD outlines the main entities, their key attributes, and their relationships for the MVP version of InfluencerFlow, focusing on robust tracking of campaigns, creator interactions, negotiations, contracts, content delivery, analytics, and payments. Auditability, extensibility, and analytic aggregation are first-class concerns.

---

## Entity List & Relationships

### 1. **Company**
- **Fields:** id, name, owner_name, website, category, description, meta (JSONB)
- **Relationships:**  
    - 1-to-many with Campaign

### 2. **Campaign**
- **Fields:** id, company_id (FK), name, description, start_date, end_date, state (draft/active/completed), meta (JSONB)
- **Relationships:**  
    - Many-to-1 with Company  
    - Many-to-many with Creator (via CampaignCreator)

### 3. **Creator**
- **Fields:** id, name, platform, category, age, gender, location, tier, engagement_rate, email, phone, language, meta (JSONB)
- **Relationships:**  
    - Many-to-many with Campaign (via CampaignCreator)

### 4. **CampaignCreator** (linking table for Campaign and Creator, with current state)
- **Fields:** id, campaign_id (FK), creator_id (FK), current_state (see lifecycle), last_state_change_at, assigned_budget, notes, meta (JSONB)
- **Relationships:**  
    - Many-to-1 with Campaign  
    - Many-to-1 with Creator  
    - 1-to-many with CampaignCreatorAudit  
    - 1-to-1 with Contract  
    - 1-to-many with NegotiationAttempt  
    - 1-to-many with DeliveredContent  
    - 1-to-many with Payment

### 5. **CampaignCreatorAudit** (state transitions/auditing)
- **Fields:** id, campaign_creator_id (FK), previous_state, new_state, changed_at, changed_by (AI/human/role), notes, meta (JSONB)

### 6. **NegotiationAttempt**
- **Fields:** id, campaign_creator_id (FK), contract_id (nullable, FK), negotiation_type (AI/human), started_at, ended_at, outcome (success/failure/pending), transcript (full text), summary (AI-generated), deliverables, agreed_price, timeline, call_recording_url, meta (JSONB)

### 7. **Contract**
- **Fields:** id, campaign_creator_id (FK), pdf_url, status (draft/sent/signed_by_brand/signed_by_creator/active/completed), sent_at, signed_by_brand_at, signed_by_creator_at, meta (JSONB)
- **Relationships:**  
    - 1-to-1 with CampaignCreator  
    - 1-to-many with ContractAudit

### 8. **ContractAudit**
- **Fields:** id, contract_id (FK), event_type (created/sent/signed/fulfilled/etc.), event_at, actor (brand/creator/AI/human), notes, meta (JSONB)

### 9. **DeliveredContent**
- **Fields:** id, campaign_creator_id (FK), content_type (post/story/reel), content_url, caption, posted_at, verified_at, meta (JSONB)
- **Relationships:**  
    - Many-to-1 with CampaignCreator  
    - 1-to-1 or 1-to-many with ContentAnalytics

### 10. **ContentAnalytics**
- **Fields:** id, delivered_content_id (FK), likes, comments, shares, views, reach, engagement_rate, fetched_at, meta (JSONB)

### 11. **Payment**
- **Fields:** id, campaign_creator_id (FK), contract_id (nullable, FK), payment_type (full/milestone/split), amount, currency, status (pending/paid/failed), paid_at, receipt_url, meta (JSONB)

---

## Key Relationships Summary

- **Company** 1—*N* **Campaign**
- **Campaign** *N*—*N* **Creator** (via **CampaignCreator**)
- **CampaignCreator** 1—*N* **CampaignCreatorAudit**
- **CampaignCreator** 1—*N* **NegotiationAttempt**
- **CampaignCreator** 1—1 **Contract**
- **Contract** 1—*N* **ContractAudit**
- **CampaignCreator** 1—*N* **DeliveredContent**
- **DeliveredContent** 1—1 **ContentAnalytics**
- **CampaignCreator** 1—*N* **Payment**

---

## Lifecycle: Campaign x Creator

Each creator in a campaign progresses through states (see your lifecycle diagram):  
**discovered → outreached → call_initiated → call_completed → waiting_for_contract → waiting_for_signature → onboarded → fulfilled**  
- Each transition is recorded in **CampaignCreatorAudit**, with actor/source.
- Negotiations (AI/human) are tracked in **NegotiationAttempt**.
- Contract status and audit tracked in **Contract** and **ContractAudit**.
- Content delivery and analytics tracked in **DeliveredContent**/**ContentAnalytics**.
- Payments tracked in **Payment**.

---

## Aggregation & Analytics

- **Dashboard**: Aggregate metrics (total spend, total engagement, campaign status breakdown, etc.) can be computed from the above tables using SQL or views.
- **Auditability**: All status changes, negotiations, contract events, and payments are auditable and traceable to actors and timestamps.

---

## Extensibility

- **Multi-user companies**: Add a User and UserCompany table.
- **More platforms**: Add platform fields or dedicated tables.
- **More content types/analytics**: Extend DeliveredContent and ContentAnalytics.
- **More detailed negotiations/payments**: Add extra fields or related tables.

---

**Ready for DB schema design and MVP implementation!**
Let me know if you want a visual ERD or further breakdowns.
# Entity Relationship Diagram

This diagram represents the database schema for the influencer marketing platform.

```mermaid
erDiagram
    COMPANY {
        bigint id PK
        text name
        text owner_name
        text website
        text category
        text description
        jsonb meta
    }
    
    CAMPAIGN {
        bigint id PK
        bigint company_id FK
        text name
        text description
        date start_date
        date end_date
        text state
        jsonb meta
    }
    
    CREATOR {
        bigint id PK
        text name
        text platform
        text category
        int age
        text gender
        text location
        text tier
        numeric engagement_rate
        text email
        text phone
        text language
        jsonb meta
    }
    
    CAMPAIGN_CREATOR {
        bigint id PK
        bigint campaign_id FK
        bigint creator_id FK
        text current_state
        timestamp last_state_change_at
        numeric assigned_budget
        text notes
        jsonb meta
    }
    
    CONTRACT {
        bigint id PK
        bigint campaign_creator_id FK
        text pdf_url
        text status
        timestamp sent_at
        timestamp signed_by_brand_at
        timestamp signed_by_creator_at
        jsonb meta
    }
    
    CONTRACT_AUDIT {
        bigint id PK
        bigint contract_id FK
        text event_type
        timestamp event_at
        text actor
        text notes
        jsonb meta
    }
    
    CAMPAIGN_CREATOR_AUDIT {
        bigint id PK
        bigint campaign_creator_id FK
        text previous_state
        text new_state
        timestamp changed_at
        text changed_by
        text notes
        jsonb meta
    }
    
    NEGOTIATION_ATTEMPT {
        bigint id PK
        bigint campaign_creator_id FK
        bigint contract_id FK
        text negotiation_type
        timestamp started_at
        timestamp ended_at
        text outcome
        text transcript
        text summary
        text deliverables
        numeric agreed_price
        text timeline
        text call_recording_url
        jsonb meta
    }
    
    DELIVERED_CONTENT {
        bigint id PK
        bigint campaign_creator_id FK
        text content_type
        text content_url
        text caption
        timestamp posted_at
        timestamp verified_at
        jsonb meta
    }
    
    CONTENT_ANALYTICS {
        bigint id PK
        bigint delivered_content_id FK
        int likes
        int comments
        int shares
        int views
        int reach
        numeric engagement_rate
        timestamp fetched_at
        jsonb meta
    }
    
    PAYMENT {
        bigint id PK
        bigint campaign_creator_id FK
        bigint contract_id FK
        text payment_type
        numeric amount
        text currency
        text status
        timestamp paid_at
        text receipt_url
        jsonb meta
    }
    
    COMPANY ||--o{ CAMPAIGN : "has"
    CAMPAIGN ||--o{ CAMPAIGN_CREATOR : "engages"
    CREATOR ||--o{ CAMPAIGN_CREATOR : "participates in"
    CAMPAIGN_CREATOR ||--o{ CONTRACT : "establishes"
    CONTRACT ||--o{ CONTRACT_AUDIT : "logs"
    CAMPAIGN_CREATOR ||--o{ CAMPAIGN_CREATOR_AUDIT : "tracks"
    CAMPAIGN_CREATOR ||--o{ NEGOTIATION_ATTEMPT : "negotiates"
    CONTRACT ||--o{ NEGOTIATION_ATTEMPT : "involves"
    CAMPAIGN_CREATOR ||--o{ DELIVERED_CONTENT : "produces"
    DELIVERED_CONTENT ||--o{ CONTENT_ANALYTICS : "measures"
    CAMPAIGN_CREATOR ||--o{ PAYMENT : "receives"
    CONTRACT ||--o{ PAYMENT : "specifies"
```

## Relationship Descriptions

- A **Company** can have multiple **Campaigns**
- A **Campaign** can engage multiple **Creators** through **Campaign_Creator** association
- A **Creator** can participate in multiple **Campaigns** through **Campaign_Creator** association
- A **Campaign_Creator** relationship establishes **Contracts**
- **Contract** changes are logged in **Contract_Audit**
- **Campaign_Creator** state changes are tracked in **Campaign_Creator_Audit**
- **Campaign_Creator** relationships involve **Negotiation_Attempts** which may be linked to a **Contract**
- **Campaign_Creator** relationships result in **Delivered_Content**
- **Delivered_Content** performance is measured through **Content_Analytics**
- **Payments** are made to **Campaign_Creator** relationships based on **Contracts**

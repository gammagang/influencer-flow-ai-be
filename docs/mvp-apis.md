# InfluencerFlow MVP — Backend API Specification

This document defines the REST API contract for the InfluencerFlow MVP backend, designed for a separate React/Next frontend. The API is written in Express + TypeScript, with a PostgreSQL data layer, and integrates with Supabase Auth for authentication.

## General Principles

- **Auth:** All endpoints (except public webhooks) require authentication via Supabase JWT in the `Authorization: Bearer <token>` header.
- **CORS:** Restrict API access to allowed frontend domains.
- **Base URL:** `/api/v1/`
- **All IDs** are UUIDs unless specified.

---

## 1. Authentication

**Handled by Supabase.**  
Backend will verify JWT in `Authorization` header for all requests.  
No custom login/logout endpoints are required.

---

## 2. Company (Brand) Profile

### `GET /company/me`

Returns the profile of the logged-in user's company.

**Response:**

```json
{
  "id": "company-uuid",
  "name": "Acme Corp",
  "ownerName": "Jane Doe",
  "website": "https://acme.com",
  "category": "E-commerce",
  "description": "Leading online store",
  "meta": { ... }
}
```

### `PUT /company/me`

Update company profile and trigger AI enrichment (e.g., website scraping).

**Request:**

```json
{
  "name": "Acme Corp",
  "website": "https://acme.com",
  "category": "E-commerce",
  "description": "Leading online store"
}
```

**Response:** Updated company profile object (as above).

### `POST /company`

Create a new company (brand) profile for the authenticated user.  
**Called immediately after first login, before any campaign creation.**

**Request:**

```json
{
  "name": "Acme Corp",
  "website": "https://acme.com",
  "category": "E-commerce",
  "phone": "68468",
  "description": "Leading online store"
}
```

- The backend will trigger the web scraper and summarizer for the website URL, storing the enriched information in the `meta` field.

**Response:**

```json
{
  "name": "Acme Corp",
  "website": "https://acme.com",
  "category": "E-commerce",
  "phone": "68468",
  "description": "Leading online store"
}
```

**Notes:**

- This endpoint must check if the user already has a company profile (enforce one-company-per-user for MVP).
- If a company already exists for the user, return an error or redirect to `/company/me`.

---

## 3. Campaigns

### `GET /campaign`

List all campaigns for the authenticated company.

**Response:**

```json
[
  {
    "id": "campaign-uuid",
    "name": "Summer Launch 2024",
    "state": "active",
    "startDate": "2024-06-01",
    "endDate": "2024-06-30",
    "creatorCount": 5,
    "meta": { ... }
  }
]
```

### `POST /campaign`

Create a new campaign.

**Request:**

```json
{
  "name": "Summer Launch 2024",
  "description": "Launch new summer products",
  "startDate": "2024-06-01",
  "endDate": "2024-06-30"
}
```

**Response:** Campaign object.

### `GET /campaign/:campaignId`

Get campaign details, including participating creators and summary stats.

**Response:**

```json
{
  "id": "campaign-uuid",
  "name": "Summer Launch 2024",
  "description": "Launch new summer products",
  "startDate": "2024-06-01",
  "endDate": "2024-06-30",
  "state": "active",
  "creators": [ ...summary info... ],
  "meta": { ... }
}
```

### `PUT /campaign/:campaignId`

Update campaign details.

**Request:**

```json
{
  "name": "New Name (optional)",
  "description": "Updated description (optional)",
  "startDate": "2024-06-02",
  "endDate": "2024-06-30"
}
```

**Response:** Updated campaign object.

---

## 4. Creator Discovery/Search

### `GET /creator/search`

Search for creators (via query params: `keyword`, `minFollowers`, `maxFollowers`, `engagement`, etc.)

**Response:**

```json
[
  {
    "id": "creator-uuid",
    "name": "JaneInfluencer",
    "platform": "instagram",
    "category": "Fashion",
    "followers": 50000,
    "engagementRate": 4.5,
    "location": "NY, USA",
    "tier": "mid",
    "meta": { ... }
  }
]
```

### `GET /creator/:creatorId`

Get detailed creator profile.

**Response:**

```json
{
  "id": "creator-uuid",
  "name": "JaneInfluencer",
  "platform": "instagram",
  "category": "Fashion",
  "followers": 50000,
  "engagementRate": 4.5,
  "email": "jane@email.com",
  "bio": "...",
  "meta": { ... }
}
```

---

## 5. Campaign Creator Management (Lifecycle)

### `POST /campaign/:campaignId/creator`

Add one or more creators to a campaign.

**Request:**

```json
{
  "creatorIds": ["creator-uuid-1", "creator-uuid-2"]
}
```

**Response:**

```json
[
  {
    "campaignCreatorId": "cc-uuid-1",
    "status": "discovered"
  }
]
```

### `GET /campaign/:campaignId/creator`

List all creators in a campaign, with current state.

**Response:**

```json
[
  {
    "campaignCreatorId": "cc-uuid-1",
    "creator": { ...summary... },
    "currentState": "outreached",
    "lastStateChangeAt": "2024-06-02T12:00:00Z"
  }
]
```

### `PATCH /campaign-creator/:campaignCreatorId/state`

Update a creator's state in a campaign (e.g., outreach sent, call initiated, etc.).

**Request:**

```json
{ "newState": "call_initiated" }
```

**Response:**

```json
{ "campaignCreatorId": "cc-uuid-1", "currentState": "call_initiated" }
```

### `GET /campaign-creator/:campaignCreatorId/audit`

Get full audit trail (state changes) for a creator in a campaign.

**Response:**

```json
[
  {
    "previousState": "outreached",
    "newState": "call_initiated",
    "changedAt": "2024-06-02T12:00:00Z",
    "changedBy": "AI"
  }
]
```

---

## 6. Negotiation (AI/Manual Calls)

### `POST /campaign-creator/:campaignCreatorId/negotiations`

Log a negotiation attempt (AI or manual).

**Request:**

```json
{
  "negotiationType": "AI",
  "startedAt": "2024-06-02T12:01:00Z",
  "endedAt": "2024-06-02T12:10:00Z",
  "outcome": "success",
  "transcript": "...full text...",
  "summary": "...short summary...",
  "deliverables": "2 posts, 1 reel",
  "agreedPrice": 1000,
  "timeline": "2024-06-15 to 2024-06-30",
  "callRecordingUrl": "https://link.to/recording"
}
```

**Response:** Negotiation object (with ID and timestamps).

### `GET /campaign-creator/:campaignCreatorId/negotiations`

List all negotiation attempts for this creator in the campaign.

**Response:**

```json
[
  {
    "id": "neg-uuid-1",
    "negotiationType": "AI",
    "outcome": "success",
    "summary": "...",
    "startedAt": "...",
    "endedAt": "..."
  }
]
```

---

## 7. Contracts

### `POST /campaign-creator/:campaignCreatorId/contract`

Generate/initiate contract (from negotiation).

**Request:**

```json
{
  "deliverables": "2 posts, 1 reel",
  "price": 1000,
  "timeline": "2024-06-15 to 2024-06-30",
  "terms": "...",
  "negotiationId": "neg-uuid-1"
}
```

**Response:**

```json
{
  "contractId": "contract-uuid",
  "status": "draft",
  "pdfUrl": "https://link.to/contract.pdf"
}
```

### `GET /campaign-creator/:campaignCreatorId/contract`

Get contract details/status for this creator in the campaign.

**Response:**

```json
{
  "id": "contract-uuid",
  "status": "signed_by_brand",
  "pdfUrl": "https://link.to/contract.pdf",
  "signedByBrandAt": "2024-06-02T13:00:00Z",
  "signedByCreatorAt": null
}
```

### `POST /contracts/:contractId/sign`

Sign contract (by brand, assuming creator signature is handled externally).

**Request:**

```json
{ "signerType": "brand" }
```

**Response:**

```json
{ "contractId": "contract-uuid", "status": "signed_by_brand" }
```

### `GET /contracts/:contractId/audit`

Get contract audit trail.

**Response:**

```json
[
  {
    "eventType": "created",
    "eventAt": "2024-06-02T12:30:00Z",
    "actor": "brand"
  },
  {
    "eventType": "signed",
    "eventAt": "2024-06-02T13:00:00Z",
    "actor": "brand"
  }
]
```

---

## 8. Delivered Content & Analytics

### `POST /campaign-creator/:campaignCreatorId/content`

Log delivered content (post, story, reel).

**Request:**

```json
{
  "contentType": "reel",
  "contentUrl": "https://instagram.com/...",
  "caption": "Check out our product!",
  "postedAt": "2024-06-16T09:00:00Z"
}
```

**Response:** Content object with ID.

### `GET /campaign-creator/:campaignCreatorId/content`

List all delivered content for this campaign-creator.

**Response:**

```json
[
  {
    "id": "content-uuid-1",
    "contentType": "reel",
    "contentUrl": "...",
    "caption": "...",
    "postedAt": "...",
    "analytics": {
      "likes": 1200,
      "comments": 35,
      "views": 25000
    }
  }
]
```

### `GET /content/:contentId/analytics`

Get analytics for a specific piece of content.

**Response:**

```json
{
  "likes": 1200,
  "comments": 35,
  "shares": 10,
  "views": 25000,
  "reach": 22000,
  "engagementRate": 4.8
}
```

---

## 9. Payments (Mock)

### `POST /campaign-creator/:campaignCreatorId/payments`

Log/initiate a payment (mock flow).

**Request:**

```json
{
  "amount": 1000,
  "paymentType": "full",
  "status": "pending",
  "paidAt": null,
  "receiptUrl": null
}
```

**Response:** Payment object with ID.

### `GET /campaign-creator/:campaignCreatorId/payments`

List all payments for this contract.

**Response:**

```json
[
  {
    "id": "payment-uuid-1",
    "amount": 1000,
    "status": "paid",
    "paidAt": "2024-06-20T15:00:00Z",
    "receiptUrl": "https://link.to/receipt"
  }
]
```

---

## 10. Dashboard/Aggregation

### `GET /dashboard/campaign`

Returns all campaigns and aggregate stats for company.

**Response:**

```json
[
  {
    "id": "campaign-uuid",
    "name": "Summer Launch 2024",
    "totalSpend": 5000,
    "totalEngagement": 50000,
    "state": "active",
    "creatorCount": 5
  }
]
```

### `GET /dashboard/analytics`

Aggregate analytics for a campaign or all campaigns.

**Query:** `?campaignId=campaign-uuid` (optional)

**Response:**

```json
{
  "totalPosts": 12,
  "totalReels": 5,
  "totalStories": 8,
  "totalReach": 100000,
  "avgEngagement": 4.7,
  "totalSpend": 5000
}
```

---

## 11. Webhook: AI Voice Negotiation Results

### `POST /webhook/negotiation-result`

**Public endpoint (no auth required, but must validate a secret/API key or signature). Called by ElevenLabs (or similar) after AI call ends.**

**Request:**

```json
{
  "campaignId": "campaign-uuid",
  "creatorId": "creator-uuid",
  "campaignCreatorId": "cc-uuid-1",
  "negotiationType": "AI",
  "startedAt": "2024-06-02T12:10:00Z",
  "endedAt": "2024-06-02T12:20:00Z",
  "outcome": "success",
  "transcript": "...full text...",
  "summary": "...short summary...",
  "deliverables": "2 posts, 1 reel",
  "agreedPrice": 1000,
  "timeline": "2024-06-15 to 2024-06-30",
  "callRecordingUrl": "https://link.to/recording",
  "signature": "<hmac or secret for validation>"
}
```

**Response:**

```json
{ "status": "ok" }
```

---

## Security Notes

- **Auth:** All business endpoints require Supabase JWT in Authorization header.
- **CORS:** Restrict allowed origins.
- **Webhook security:** Validate all webhook payloads (HMAC, shared secret, or signature).
- **File uploads:** Use URLs (S3, Supabase Storage) for all content and contract references.

---

## Out of Scope for MVP

- Creator onboarding/auth flows
- In-app notifications
- Admin/bulk management APIs
- Real payment/e-signature integrations (mock flows only)

---

**Ready for backend implementation in Express + TypeScript!**

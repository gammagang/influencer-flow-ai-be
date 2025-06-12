# Chat API Documentation

## Overview

The Chat API provides an intelligent interface to discover creators using natural language. It uses Groq's LLM with function calling to understand user requests and automatically call the appropriate creator discovery endpoints.

## Endpoints

### POST /chat/message

Send a message to the AI assistant to discover creators.

**Request Body:**

```json
{
  "message": "Find me fashion influencers in the US with 10k-100k followers",
  "conversationId": "optional-conversation-id"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "I found 12 fashion influencers in the US with 10k-100k followers. Here are the results:",
    "toolCalls": [
      {
        "toolCallId": "call_123",
        "functionName": "discover_creators",
        "result": {
          "success": true,
          "data": {
            "creators": [
              {
                "id": "creator_id",
                "name": "Creator Name",
                "handle": "@creator_handle",
                "platform": "instagram",
                "category": "Fashion",
                "followersCount": 50000,
                "tier": "micro",
                "engagement_rate": 0.035,
                "location": "New York, NY",
                "country": "US",
                "profileImageUrl": "https://...",
                "profileUrl": "https://...",
                "interests": ["fashion", "style", "lifestyle"]
              }
            ],
            "total": 12,
            "searchParams": {
              "country": "US",
              "tier": ["micro"],
              "category": ["Fashion"],
              "platform": "instagram"
            }
          }
        }
      }
    ],
    "conversationId": "chat_1671234567890"
  }
}
```

### GET /chat/conversation/:id

Get conversation history (placeholder for future implementation).

## Example Usage

### 1. Basic Creator Search

```bash
POST /chat/message
{
  "message": "Find me tech YouTubers with high engagement rates"
}
```

### 2. Specific Demographics

```bash
POST /chat/message
{
  "message": "I need female beauty influencers in India who speak Hindi and have 100k+ followers"
}
```

### 3. Engagement-focused Search

```bash
POST /chat/message
{
  "message": "Show me micro-influencers in the gaming niche with engagement rates above 3%"
}
```

### 4. Location-specific Search

```bash
POST /chat/message
{
  "message": "Find food bloggers in New York with nano to micro follower counts"
}
```

## Supported Parameters

The AI can understand and extract the following parameters from natural language:

- **Platform**: Instagram, TikTok, YouTube, Twitter, Facebook
- **Country**: US, IN, UK, CA, etc.
- **Follower Tiers**:
  - Early (<1k)
  - Nano (1k-10k)
  - Micro (10k-100k)
  - Lower-mid (100k-250k)
  - Upper-mid (250k-500k)
  - Macro (500k-1M)
  - Mega (1M-5M)
  - Celebrity (>5M)
- **Categories**: Fashion, Beauty, Tech, Gaming, Food, Travel, Fitness, etc.
- **Gender**: Male, Female, Other
- **Languages**: en, es, fr, de, hi, etc.
- **Engagement Rates**: 1-2%, 2-3%, 3-5%, 5%+
- **Keywords**: Bio/description search terms

## Response Fields

Each creator in the response includes:

- `id`: Unique creator identifier
- `name`: Creator's full name
- `handle`: Social media handle
- `platform`: Social media platform
- `category`: Content category/niche
- `followersCount`: Number of followers
- `tier`: Follower count tier
- `engagement_rate`: Engagement rate (decimal)
- `location`: Geographic location
- `country`: Country code
- `gender`: Gender
- `language`: Spoken languages
- `profileImageUrl`: Profile picture URL
- `profileUrl`: Social media profile URL
- `interests`: Array of interests/topics
- `qualityScore`: Profile quality score

## Error Handling

The API handles errors gracefully and will provide helpful error messages if:

- Creator discovery fails
- Invalid parameters are provided
- API limits are exceeded

Example error response:

```json
{
  "success": true,
  "data": {
    "message": "I apologize, but I couldn't find creators matching those specific criteria. Would you like to try with different parameters or expand your search?",
    "toolCalls": [
      {
        "toolCallId": "call_123",
        "functionName": "discover_creators",
        "result": {
          "success": false,
          "error": "Failed to discover creators. Please try again with different parameters."
        }
      }
    ],
    "conversationId": "chat_1671234567890"
  }
}
```

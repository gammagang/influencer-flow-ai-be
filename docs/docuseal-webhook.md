# DocuSeal Webhook Integration

This document describes how to set up the DocuSeal webhook integration with Influencer Flow AI.

## Overview

The DocuSeal webhook integration allows our system to receive real-time updates about contract signing events. When a contract is signed, opened, or declined in DocuSeal, they'll send a webhook notification to our system.

## Setup Instructions

### 1. Configure DocuSeal Webhook

1. Log in to your DocuSeal account
2. Navigate to Settings > Integrations > Webhooks
3. Click "Add Webhook"
4. Enter your webhook URL: `https://your-api-domain.com/api/webhooks/docuseal`
5. Select events to listen for:
   - `form.completed` (When a form is fully signed)
   - `form.opened` (When a recipient opens a form)
   - `form.declined` (When a recipient declines to sign)

### 2. Testing the Integration

You can test the integration using the provided test script:

```bash
# Make sure your server is running
npm run dev

# In another terminal window, run the webhook test
npm run test:webhook
```

This will send sample webhook events to your local server.

## Webhook Payload Structure

DocuSeal sends webhook events with the following structure:

```json
{
  "event_type": "form.completed",
  "timestamp": "2025-06-07T11:31:35Z",
  "data": {
    "id": 2882519,
    "submission_id": 2166170,
    "email": "vovom19056@adrewire.com",
    "role": "Influencer",
    "status": "completed",
    "documents": [
      {
        "name": "test-contract",
        "url": "https://docuseal.com/blobs_proxy/WyI5ZDZmNTEwOC0xNjMzLTQ1NDYtYTc5NC01MjQ1YWE4YjY3MjAiLCJibG9iIl0=--5fc1115040b1a9bbc11ea6f0c73ebd44dc15c6390b4065554845ab6f5cc67498/test-contract.pdf"
      }
    ]
    // ... additional data
  }
}
```

## Supported Event Types

- `form.completed`: Triggered when all signatories have completed the document
- `form.opened`: Triggered when a signatory opens the document for signing
- `form.declined`: Triggered when a signatory declines to sign the document

## Implementation Details

The webhook handler is implemented in `/src/routes/webhook/route.ts`. When a webhook is received:

1. The payload is validated against the expected schema
2. The event type is checked and routed to the appropriate handler
3. Contract status is updated in the database
4. Relevant notifications are sent to interested parties

## Security Considerations

In a production environment, you should:

1. Verify webhook signatures if DocuSeal provides them
2. Use HTTPS for all webhook endpoints
3. Implement rate limiting to prevent abuse
4. Store webhook events in a persistent queue before processing

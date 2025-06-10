import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import type { DocuSealWebhookPayload } from '../../routes/webhook/validate'
import { submitContract, type ContractInput } from '../../libs/docuseal'
import docuseal from '@docuseal/api'

// Mock axios and docuseal
vi.mock('axios')
vi.mock('@docuseal/api', () => ({
  default: {
    configure: vi.fn(),
    createSubmission: vi.fn()
  }
}))

// Set base URL for tests
const BASE_URL = 'http://localhost:3000'
const WEBHOOK_PATH = '/api/webhooks/docuseal'

/**
 * Sample DocuSeal webhook payload for a completed form
 */
const sampleFormCompletedPayload: DocuSealWebhookPayload = {
  event_type: 'form.completed',
  timestamp: '2025-06-07T11:31:35Z',
  data: {
    id: 2882519,
    submission_id: 2166170,
    email: 'test@example.com',
    phone: null,
    name: null,
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    ip: '127.0.0.1',
    sent_at: '2025-06-07T11:23:57.333Z',
    opened_at: '2025-06-07T11:24:43.087Z',
    completed_at: '2025-06-07T11:24:52.431Z',
    created_at: '2025-06-07T11:23:00.679Z',
    updated_at: '2025-06-07T11:24:52.433Z',
    external_id: null,
    metadata: {},
    status: 'completed',
    application_key: null,
    decline_reason: null,
    preferences: {
      email_message_uuid: '90e5dee7-c3ae-44e8-b75d-783f9aa6c3dd',
      send_email: true
    },
    values: [
      {
        field: 'Influencer Signature',
        value: 'https://docuseal.com/blobs_proxy/signature.png'
      }
    ],
    role: 'Influencer',
    documents: [
      {
        name: 'test-contract',
        url: 'https://docuseal.com/blobs_proxy/test-contract.pdf'
      }
    ],
    audit_log_url: 'https://docuseal.com/blobs_proxy/Audit%20Log%20-%20Sample%20Contract.pdf',
    submission_url: 'https://docuseal.com/e/vfrznq7xhc8sh9',
    template: {
      id: 1189705,
      name: 'Sample Contract',
      external_id: null,
      created_at: '2025-06-07T10:00:45.776Z',
      updated_at: '2025-06-07T11:21:25.325Z',
      folder_name: 'Influencer Flow AI'
    },
    submission: {
      id: 2166170,
      created_at: '2025-06-07T11:23:00.673Z',
      audit_log_url: 'https://docuseal.com/blobs_proxy/Audit%20Log%20-%20Sample%20Contract.pdf',
      combined_document_url: null,
      status: 'completed',
      url: 'https://docuseal.com/e/vfrznq7xhc8sh9'
    }
  }
}

/**
 * Sample DocuSeal webhook payload for an opened form
 */
const sampleFormOpenedPayload: DocuSealWebhookPayload = {
  ...sampleFormCompletedPayload,
  event_type: 'form.opened',
  data: {
    ...sampleFormCompletedPayload.data,
    status: 'opened',
    completed_at: null
  }
}

/**
 * Sample DocuSeal webhook payload for a declined form
 */
const sampleFormDeclinedPayload: DocuSealWebhookPayload = {
  ...sampleFormCompletedPayload,
  event_type: 'form.declined',
  data: {
    ...sampleFormCompletedPayload.data,
    status: 'declined',
    decline_reason: 'Terms not acceptable'
  }
}

/**
 * Sends a test webhook to the specified endpoint
 */
async function sendTestWebhook(payload: DocuSealWebhookPayload) {
  return axios.post(`${BASE_URL}${WEBHOOK_PATH}`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'DocuSeal-Webhook-Test'
    }
  })
}

describe('DocuSeal Webhook', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks()
  })

  afterEach(() => {
    // Clear mocks after each test
    vi.clearAllMocks()
  })

  it('should handle form.completed webhook', async () => {
    // Mock successful response
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      data: {
        message: 'Webhook processed successfully',
        event: 'form.completed',
        timestamp: sampleFormCompletedPayload.timestamp
      }
    }

    // Set up the mock to return our mock response
    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse)

    // Call the function with our sample payload
    const response = await sendTestWebhook(sampleFormCompletedPayload)

    // Verify axios was called with the right arguments
    expect(axios.post).toHaveBeenCalledWith(
      `${BASE_URL}${WEBHOOK_PATH}`,
      sampleFormCompletedPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DocuSeal-Webhook-Test'
        }
      }
    )

    // Verify the response
    expect(response.status).toBe(200)
    expect(response.data.message).toBe('Webhook processed successfully')
    expect(response.data.event).toBe('form.completed')
  })

  it('should handle form.opened webhook', async () => {
    // Mock successful response
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      data: {
        message: 'Webhook processed successfully',
        event: 'form.opened',
        timestamp: sampleFormOpenedPayload.timestamp
      }
    }

    // Set up the mock to return our mock response
    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse)

    // Call the function with our sample payload
    const response = await sendTestWebhook(sampleFormOpenedPayload)

    // Verify axios was called with the right arguments
    expect(axios.post).toHaveBeenCalledWith(`${BASE_URL}${WEBHOOK_PATH}`, sampleFormOpenedPayload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DocuSeal-Webhook-Test'
      }
    })

    // Verify the response
    expect(response.status).toBe(200)
    expect(response.data.message).toBe('Webhook processed successfully')
    expect(response.data.event).toBe('form.opened')
  })

  it('should handle form.declined webhook', async () => {
    // Mock successful response
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      data: {
        message: 'Webhook processed successfully',
        event: 'form.declined',
        timestamp: sampleFormDeclinedPayload.timestamp
      }
    }

    // Set up the mock to return our mock response
    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse)

    // Call the function with our sample payload
    const response = await sendTestWebhook(sampleFormDeclinedPayload)

    // Verify axios was called with the right arguments
    expect(axios.post).toHaveBeenCalledWith(
      `${BASE_URL}${WEBHOOK_PATH}`,
      sampleFormDeclinedPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DocuSeal-Webhook-Test'
        }
      }
    )

    // Verify the response
    expect(response.status).toBe(200)
    expect(response.data.message).toBe('Webhook processed successfully')
    expect(response.data.event).toBe('form.declined')
  })

  it('should handle errors gracefully', async () => {
    // Mock an error response
    const errorMessage = 'Network Error'
    vi.mocked(axios.post).mockRejectedValueOnce(new Error(errorMessage))

    // Call the function and expect it to throw
    await expect(sendTestWebhook(sampleFormCompletedPayload)).rejects.toThrow(errorMessage)

    // Verify axios was called
    expect(axios.post).toHaveBeenCalledWith(
      `${BASE_URL}${WEBHOOK_PATH}`,
      sampleFormCompletedPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DocuSeal-Webhook-Test'
        }
      }
    )
  })
})

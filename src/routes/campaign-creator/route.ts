import {
  createCampaignCreatorLink,
  deleteCampaignCreatorLink,
  getCampaignCreatorWithCampaignDetails,
  getCampaignCreators,
  updateCampaignCreatorLink
} from '@/api/campaign-creator'
import { getCompanyById } from '@/api/company'
import { sendOutreachEmailProgrammatic } from '@/api/email'
import { NotFoundError } from '@/errors/not-found-error'
import { SuccessResponse } from '@/libs/success-response'
import { validateRequest } from '@/middlewares/validate-request'
import { Router, type Request, type Response } from 'express'
import {
  CreatePaymentForCampaignCreatorSchema,
  LinkCreatorToCampaignSchema,
  ListCampaignCreatorsQuerySchema,
  SendOutreachEmailSchema,
  UpdateCampaignCreatorLinkSchema
} from './validate'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const validatedBody = validateRequest(LinkCreatorToCampaignSchema, req.body, req.path)

  try {
    const newLink = await createCampaignCreatorLink({
      campaignId: validatedBody.campaignId,
      creatorId: validatedBody.creatorId,
      status: validatedBody.status || 'pending',
      agreedDeliverables: validatedBody.agreedDeliverables || [],
      negotiatedRate: validatedBody.negotiatedRate,
      contractId: validatedBody.contractId,
      notes: validatedBody.notes
    })

    SuccessResponse.send({ res, data: newLink, status: 201 })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create campaign-creator link')
  }
})

router.get('/', async (req: Request, res: Response) => {
  const validatedQuery = validateRequest(ListCampaignCreatorsQuerySchema, req.query, req.path)

  try {
    const result = await getCampaignCreators({
      campaignId: validatedQuery.campaignId,
      creatorId: validatedQuery.creatorId,
      status: validatedQuery.status,
      page: validatedQuery.page,
      limit: validatedQuery.limit
    })

    SuccessResponse.send({ res, data: result })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch campaign-creator links')
  }
})

router.get('/:campaignCreatorMappingId', async (req: Request, res: Response) => {
  const campaignCreatorMappingId = req.params.campaignCreatorMappingId

  try {
    const link = await getCampaignCreatorWithCampaignDetails(campaignCreatorMappingId)

    if (!link) {
      throw new NotFoundError(
        'Campaign-Creator link not found',
        `campaignCreatorMappingId: ${campaignCreatorMappingId} not found`,
        req.path
      )
    }

    SuccessResponse.send({ res, data: link })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch campaign-creator link')
  }
})

router.put('/:linkId', async (req: Request, res: Response) => {
  const linkId = req.params.linkId
  const validatedBody = validateRequest(UpdateCampaignCreatorLinkSchema, req.body, req.path)

  try {
    const updatedLink = await updateCampaignCreatorLink(linkId, {
      status: validatedBody.status,
      agreedDeliverables: validatedBody.agreedDeliverables,
      negotiatedRate: validatedBody.negotiatedRate,
      contractId: validatedBody.contractId,
      notes: validatedBody.notes
    })

    SuccessResponse.send({ res, data: updatedLink })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update campaign-creator link')
  }
})

router.delete('/:linkId', async (req: Request, res: Response) => {
  const linkId = req.params.linkId

  try {
    const deletedLink = await deleteCampaignCreatorLink(linkId)

    if (!deletedLink) {
      throw new NotFoundError(
        'Campaign-Creator link not found',
        `Link with ID ${linkId} not found`,
        req.path
      )
    }

    SuccessResponse.send({ res, status: 204, data: {} })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete campaign-creator link')
  }
})

// Generate (Preview) outreach email content (without sending)
router.get('/:campaignCreatorMappingId/outreach/preview', async (req: Request, res: Response) => {
  const campaignCreatorMappingId = req.params.campaignCreatorMappingId
  const validatedBody = validateRequest(SendOutreachEmailSchema, req.body, req.path)

  try {
    // Get detailed campaign-creator information
    const campaignCreatorDetails =
      await getCampaignCreatorWithCampaignDetails(campaignCreatorMappingId)

    if (!campaignCreatorDetails) {
      throw new NotFoundError(
        'Campaign-Creator link not found',
        `Link with ID ${campaignCreatorMappingId} not found`,
        req.path
      )
    }

    // Extract data for email
    const {
      creator_name: creatorName,
      creator_email: creatorEmail,
      campaign_name: campaignName,
      campaign_description: campaignDescription,
      campaign_start_date: campaignStartDate,
      campaign_end_date: campaignEndDate,
      assigned_budget: assignedBudget,
      company_id: companyId
    } = campaignCreatorDetails

    // Get company details for brand name
    const company = await getCompanyById(companyId)
    const brandName = company?.name || 'Brand'

    // Prepare email data
    const emailData = {
      creatorName,
      creatorEmail,
      brandName,
      campaignName,
      campaignDetails: {
        description: campaignDescription,
        timeline:
          campaignStartDate && campaignEndDate
            ? `${new Date(campaignStartDate).toLocaleDateString()} - ${new Date(campaignEndDate).toLocaleDateString()}`
            : undefined,
        budget: assignedBudget ? `$${assignedBudget}` : undefined,
        deliverables: campaignCreatorDetails.campaign_creator_meta?.agreedDeliverables || []
      },
      personalizedMessage: validatedBody.personalizedMessage,
      negotiationLink: validatedBody.negotiationLink
    }

    // Generate email content without sending
    const subject = `Partnership Opportunity with ${emailData.brandName} - ${emailData.campaignName}`

    SuccessResponse.send({
      res,
      data: {
        message: 'Email content generated successfully',
        emailContent: {
          subject,
          recipient: {
            name: creatorName,
            email: creatorEmail
          },
          campaignDetails: emailData.campaignDetails,
          brandName,
          campaignName,
          personalizedMessage: validatedBody.personalizedMessage,
          negotiationLink: validatedBody.negotiationLink
        },
        campaignCreatorMappingId
      },
      status: 200
    })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to generate email content')
  }
})

// Send outreach email to creator
router.post('/:campaignCreatorMappingId/outreach/send', async (req: Request, res: Response) => {
  const campaignCreatorMappingId = req.params.campaignCreatorMappingId
  const validatedBody = validateRequest(SendOutreachEmailSchema, req.body, req.path)

  try {
    // Get detailed campaign-creator information
    const campaignCreatorDetails =
      await getCampaignCreatorWithCampaignDetails(campaignCreatorMappingId)

    if (!campaignCreatorDetails) {
      throw new NotFoundError(
        'Campaign-Creator link not found',
        `Link with ID ${campaignCreatorMappingId} not found`,
        req.path
      )
    }

    // Extract data for email
    const {
      creator_name: creatorName,
      creator_email: creatorEmail,
      campaign_name: campaignName,
      campaign_description: campaignDescription,
      campaign_start_date: campaignStartDate,
      campaign_end_date: campaignEndDate,
      assigned_budget: assignedBudget,
      company_id: companyId
    } = campaignCreatorDetails

    // Get company details for brand name
    const company = await getCompanyById(companyId)
    const brandName = company?.name || 'Brand'

    // Prepare email data
    const emailData = {
      creatorName,
      creatorEmail,
      brandName,
      campaignName,
      campaignDetails: {
        description: campaignDescription,
        timeline:
          campaignStartDate && campaignEndDate
            ? `${new Date(campaignStartDate).toLocaleDateString()} - ${new Date(campaignEndDate).toLocaleDateString()}`
            : undefined,
        budget: assignedBudget ? `$${assignedBudget}` : undefined,
        deliverables: campaignCreatorDetails.campaign_creator_meta?.agreedDeliverables || []
      },
      personalizedMessage: validatedBody.personalizedMessage,
      negotiationLink: validatedBody.negotiationLink
    }

    // Send outreach email
    const emailResult = await sendOutreachEmailProgrammatic(emailData)

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send outreach email')
    }

    SuccessResponse.send({
      res,
      data: {
        message: 'Outreach email sent successfully',
        emailId: emailResult.data?.emailId,
        recipient: creatorEmail,
        campaignCreatorMappingId
      },
      status: 200
    })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to send outreach email')
  }
})

// --- Nested Payment Routes for Campaign-Creator ---
// Note: This is a simplified implementation for MVP. A full payment system would require
// integration with payment processors and a dedicated payment table.

router.post('/:linkId/payments', async (req: Request, res: Response) => {
  const linkId = req.params.linkId
  const validatedBody = validateRequest(CreatePaymentForCampaignCreatorSchema, req.body, req.path)
  try {
    // First verify the campaign-creator link exists
    const link = await getCampaignCreatorWithCampaignDetails(linkId)
    if (!link) {
      throw new NotFoundError(
        'Campaign-Creator link not found',
        `Link with ID ${linkId} not found for creating payment`,
        req.path
      )
    }

    // For MVP, we'll store payment info in the campaign_creator meta field
    // In a production system, this would go to a dedicated payments table
    const currentMeta = link.meta || {}
    const payments = currentMeta.payments || []

    const newPayment = {
      id: `payment-uuid-${Date.now()}`,
      ...validatedBody,
      createdAt: new Date().toISOString()
    }

    payments.push(newPayment)

    // Update the campaign-creator link with the new payment
    await updateCampaignCreatorLink(linkId, {
      // Keep existing meta and add updated payments
    })

    SuccessResponse.send({ res, data: newPayment, status: 201 })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create payment')
  }
})

// TODO: Add GET, PUT, DELETE for /campaign-creator/:linkId/payments/:paymentId if needed

export { router as campaignCreatorRouter }

import {
  mapCreatorToCampaign,
  deleteCampaignCreatorLink,
  getCampaignCreatorWithCampaignDetails,
  getCampaignCreators,
  updateCampaignCreatorLink,
  updateCampaignCreatorState
} from '@/api/campaign-creator'
import { getCampaignById } from '@/api/campaign'
import { getCompanyById, findCompanyByUserId } from '@/api/company'
import { sendOutreachEmailProgrammatic } from '@/api/email'
import { generateUserOutreachEmail } from '@/api/outreach-email'
import { NotFoundError } from '@/errors/not-found-error'
import { BadRequestError } from '@/errors/bad-request-error'
import { ForbiddenError } from '@/errors/forbidden-error'
import { SuccessResponse } from '@/libs/success-response'
import { validateRequest } from '@/middlewares/validate-request'
import { Router, type Request, type Response } from 'express'
import {
  CreatePaymentForCampaignCreatorSchema,
  LinkCreatorToCampaignSchema,
  ListCampaignCreatorsQuerySchema,
  PreviewOutreachEmailSchema,
  SendOutreachEmailSchema,
  UpdateCampaignCreatorLinkSchema
} from './validate'
import configs from '@/configs'
import { sendContractViaEmail } from '@/libs/docuseal'
const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const validatedBody = validateRequest(LinkCreatorToCampaignSchema, req.body, req.path)

  const newLink = await mapCreatorToCampaign({
    campaignId: validatedBody.campaignId,
    creatorId: validatedBody.creatorId,
    status: validatedBody.status || 'pending',
    negotiatedRate: validatedBody.negotiatedRate,
    contractId: validatedBody.contractId,
    notes: validatedBody.notes
  })

  SuccessResponse.send({ res, data: newLink, status: 201 })
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

router.get('/:ccMappingId', async (req: Request, res: Response) => {
  const ccMappingId = req.params.ccMappingId

  try {
    const link = await getCampaignCreatorWithCampaignDetails(ccMappingId)

    if (!link) {
      throw new NotFoundError(
        'Campaign-Creator link not found',
        `ccMappingId: ${ccMappingId} not found`,
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
      contentDeliverables: validatedBody.contentDeliverables,
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
router.get('/:ccMappingId/outreach/preview', async (req: Request, res: Response) => {
  const ccMappingId = req.params.ccMappingId
  const validatedQuery = validateRequest(PreviewOutreachEmailSchema, req.query, req.path)

  try {
    // Get detailed campaign-creator information
    const campaignCreatorDetails = await getCampaignCreatorWithCampaignDetails(ccMappingId)

    if (!campaignCreatorDetails) {
      throw new NotFoundError(
        'Campaign-Creator link not found',
        `Link with ID ${ccMappingId} not found`,
        req.path
      )
    } // Extract data for email
    const {
      creator_name: creatorName,
      campaign_name: campaignName,
      campaign_description: campaignDescription,
      campaign_start_date: campaignStartDate,
      campaign_end_date: campaignEndDate,
      assigned_budget: assignedBudget,
      company_id: companyId
    } = campaignCreatorDetails

    // Use default email for creator outreach - TODO: Change
    const creatorEmail = 'gammagang100x@gmail.com'

    // Get company details for brand name
    const company = await getCompanyById(companyId)
    const brandName = company?.name || 'Brand' // Prepare email data
    const emailData = {
      subject: `Partnership Opportunity with ${brandName} - ${campaignName}`,
      recipient: {
        name: creatorName,
        email: creatorEmail
      },
      campaignDetails: {
        description: campaignDescription,
        timeline:
          campaignStartDate && campaignEndDate
            ? `${new Date(campaignStartDate).toLocaleDateString()} - ${new Date(campaignEndDate).toLocaleDateString()}`
            : undefined,
        budget: assignedBudget ? `$${assignedBudget}` : undefined,
        deliverables: campaignCreatorDetails.campaign_creator_meta?.contentDeliverables || ''
      },
      brandName,
      campaignName,
      personalizedMessage: validatedQuery.personalizedMessage,
      negotiationLink: `${configs.negotiationHostUrl}/agent-call?id=${ccMappingId}`,
      ccMappingId
    }

    // Generate email content using AI
    const generatedEmail = await generateUserOutreachEmail(emailData)
    console.log(' generatedEmail:', generatedEmail)

    SuccessResponse.send({
      res,
      data: {
        message: 'Email content generated successfully',
        ...generatedEmail
      }
    })
  } catch (error: any) {
    throw new Error(error.message || 'Failed to generate email content')
  }
})

// Send outreach email to creator
router.post('/:ccMappingId/outreach/send', async (req: Request, res: Response) => {
  const validatedBody = validateRequest(SendOutreachEmailSchema, req.body, req.path)
  const ccMappingId = req.params.ccMappingId
  try {
    // Send the email content from frontend
    const emailResult = await sendOutreachEmailProgrammatic({
      to: validatedBody.receiverEmail,
      subject: validatedBody.subject,
      text: validatedBody.body,
      html: validatedBody.body.replace(/\n/g, '<br>')
    })

    if (!emailResult.success) throw new Error(emailResult.error || 'Failed to send outreach email')
    const campaign = await updateCampaignCreatorState(ccMappingId, 'outreached')

    SuccessResponse.send({
      res,
      data: {
        message: 'Outreach email sent successfully',
        campaign
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
    const currentMeta = link.campaign_creator_meta || {}
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

// API To read ccMappingId and make a docuseal send contract
router.post('/:ccMappingId/send-contract', async (req: Request, res: Response) => {
  const ccMappingId = req.params.ccMappingId
  try {
    // Get campaign-creator mapping with all details
    const mapping = await getCampaignCreatorWithCampaignDetails(ccMappingId)
    if (!mapping) {
      throw new NotFoundError(
        'Campaign-Creator mapping not found',
        `Mapping with ID ${ccMappingId} not found`,
        req.path
      )
    }

    // Get company details for brand information
    const company = await getCompanyById(mapping.company_id)
    if (!company)
      throw new NotFoundError(
        'Company not found',
        `Company with ID ${mapping.company_id} not found`,
        req.path
      )

    // Parse meta fields (safely handle string or object formats)
    const parsedCompanyMeta = (() => {
      try {
        if (typeof company.meta === 'string' && company.meta) {
          return JSON.parse(company.meta)
        }
        return company.meta || {}
      } catch (e) {
        console.error('Error parsing company meta:', e)
        return {}
      }
    })()

    const campaignCreatorMeta = (() => {
      try {
        if (typeof mapping.campaign_creator_meta === 'string' && mapping.campaign_creator_meta) {
          return JSON.parse(mapping.campaign_creator_meta)
        }
        return mapping.campaign_creator_meta || {}
      } catch (e) {
        console.error('Error parsing campaign_creator_meta:', e)
        return {}
      }
    })()

    const creatorMeta = (() => {
      try {
        if (typeof mapping.creator_meta === 'string' && mapping.creator_meta) {
          return JSON.parse(mapping.creator_meta)
        }
        return mapping.creator_meta || {}
      } catch (e) {
        console.error('Error parsing creator_meta:', e)
        return {}
      }
    })()

    // Helper function to format date in YYYY-MM-DD format
    const formatDate = (date: string | null) => {
      if (!date) return new Date().toISOString().split('T')[0]

      try {
        return new Date(date).toISOString().split('T')[0]
      } catch (e) {
        console.error('Error formatting date:', e)
        return new Date().toISOString().split('T')[0]
      }
    }

    // Get the creator's handle based on their platform
    const getCreatorHandle = () => {
      if (mapping.creator_platform === 'instagram') {
        return creatorMeta.instagram_handle || mapping.creator_name
      }
      if (mapping.creator_platform === 'youtube') {
        return creatorMeta.youtube_handle || mapping.creator_name
      }
      if (mapping.creator_platform === 'tiktok') {
        return creatorMeta.tiktok_handle || mapping.creator_name
      }
      return mapping.creator_name
    }

    // Create contract data object with proper null/undefined handling
    const contractData = {
      campaign: {
        name: mapping.campaign_name || 'Untitled Campaign',
        startDate: formatDate(mapping.campaign_start_date),
        endDate: formatDate(mapping.campaign_end_date)
      },
      brand: {
        name: company.name || 'Your Brand',
        contactPerson:
          parsedCompanyMeta.contact_name || company.owner_name || 'Brand Representative',
        email: parsedCompanyMeta.contact_email || company.owner_name || 'contact@example.com'
      },
      creator: {
        name: mapping.creator_name || 'Creator',
        instaHandle: getCreatorHandle(),
        email: mapping.creator_email || creatorMeta.email || 'creator@example.com'
      },
      deliverables:
        campaignCreatorMeta.contentDeliverables || 'Content deliverables to be determined',
      compensation: {
        currency: 'INR',
        amount: mapping.assigned_budget || 0,
        paymentMethod: 'Bank Transfer'
      }
    }

    // Send the contract via DocuSeal
    const submission = await sendContractViaEmail(contractData)

    // Update mapping to record that contract was sent
    await updateCampaignCreatorState(ccMappingId, 'waiting for signature')

    SuccessResponse.send({ res, data: submission })
  } catch (error: any) {
    console.error('Contract generation error:', error)
    throw new Error(error.message || 'Failed to send contract via DocuSeal')
  }
})

// Creator lifecycle status endpoint
router.post('/:ccMappingId/status', async (req: Request, res: Response) => {
  const ccMappingId = req.params.ccMappingId
  const { status } = req.body

  try {
    // Validate status
    const validStatuses = [
      'pending',
      'approved',
      'rejected',
      'outreached',
      'contract sent',
      'waiting for signature'
    ]
    if (!validStatuses.includes(status)) {
      throw new BadRequestError(`Invalid status: ${status} is not allowed`, req.path)
    }

    // Check if the campaign-creator mapping exists
    const mapping = await getCampaignCreatorWithCampaignDetails(ccMappingId)
    if (!mapping) {
      throw new NotFoundError(
        'Campaign-Creator mapping not found',
        `Mapping with ID ${ccMappingId} not found`,
        req.path
      )
    }

    // Update the status
    await updateCampaignCreatorState(ccMappingId, status)

    SuccessResponse.send({ res, data: { message: 'Status updated successfully' } })
  } catch (error: any) {
    if (error instanceof NotFoundError || error instanceof BadRequestError) {
      throw error // Rethrow known errors
    }
    throw new Error(error.message || 'Failed to update status')
  }
})

// Get creator lifecycle status for campaign
router.get('/campaign/:campaignId/lifecycle-status', async (req: Request, res: Response) => {
  const campaignId = req.params.campaignId

  // Get the authenticated user's company
  const company = await findCompanyByUserId(req.user?.sub || '')
  if (!company?.id) throw new BadRequestError('No company found for the user', req.path)

  // Get campaign to verify ownership
  const campaign = await getCampaignById(campaignId)
  if (!campaign)
    throw new NotFoundError(
      'Campaign not found',
      `Campaign with ID ${campaignId} not found`,
      req.path
    )

  // Verify that the campaign belongs to the user's company
  if (campaign.company_id.toString() !== company.id.toString()) throw new ForbiddenError(req.path)

  // Get all creators in the campaign using the existing campaign-creator API
  const creators = await getCampaignCreators({
    campaignId,
    creatorId: undefined,
    status: undefined,
    page: 1,
    limit: 1000 // Get all creators
  })

  // Group creators by their current state and calculate counts
  const statusCounts = creators.items.reduce((acc: Record<string, number>, creator) => {
    const status = creator.current_state || 'unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  // Calculate total creators
  const totalCreators = creators.items.length

  // Define lifecycle stages in order
  const lifecycleStages = [
    'discovered',
    'outreached',
    'call complete',
    'waiting for contract',
    'waiting for signature',
    'onboarded',
    'fulfilled'
  ]

  // Build detailed status breakdown
  const statusBreakdown = lifecycleStages.map((stage) => ({
    stage,
    count: statusCounts[stage] || 0,
    percentage:
      totalCreators > 0 ? Math.round(((statusCounts[stage] || 0) / totalCreators) * 100) : 0
  }))

  // Add any other statuses not in the standard lifecycle
  Object.keys(statusCounts).forEach((status) => {
    if (!lifecycleStages.includes(status)) {
      statusBreakdown.push({
        stage: status,
        count: statusCounts[status],
        percentage: totalCreators > 0 ? Math.round((statusCounts[status] / totalCreators) * 100) : 0
      })
    }
  })

  SuccessResponse.send({
    res,
    data: {
      campaignId,
      campaignName: campaign.name,
      totalCreators,
      statusCounts,
      statusBreakdown,
      lastUpdated: new Date().toISOString()
    }
  })
})

export { router as campaignCreatorRouter }

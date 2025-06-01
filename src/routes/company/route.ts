import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import { CreateCompanyReqSchema, UpdateCompanyMeReqSchema } from './validate'
import { summarizeWebsite } from '@/api/summarize'
import { createCompany } from '@/api/company'

const companyRoutes = Router()

companyRoutes.post('/', async (req: Request, res: Response) => {
  const { name, website, category, description, phone } = req.body
  const body = { name, website, category, description, phone }

  const validatedBody = validateRequest(CreateCompanyReqSchema, body, req.path)

  try {
    const newCompany = await createCompany({
      name: validatedBody.name,
      website: validatedBody.website,
      category: validatedBody.category,
      owner: req.user!['sub'], // Replace with actual owner logic
      description: validatedBody.description || null,
      meta: { phone: validatedBody.phone }
    })

    SuccessResponse.send({ res, data: newCompany, status: 201 })
  } catch (error) {
    log.error('Failed to create company:', error)
    throw error
  }
})

companyRoutes.get('/', async (req: Request, res: Response) => {
  const sampleCompany = {
    id: 'company-uuid-123',
    name: 'Acme Corp',
    description: 'Leading online store',
    website: 'https://acme.corp',
    meta: { enrichedData: '...' }
  }
  SuccessResponse.send({ res, data: [sampleCompany] })
})

companyRoutes.get('/:companyId', async (req: Request, res: Response) => {
  const sampleCompany = {
    id: 'company-uuid-123',
    name: 'Acme Corp',
    description: 'Leading online store',
    website: 'https://acme.corp',
    meta: { enrichedData: '...' }
  }
  SuccessResponse.send({ res, data: sampleCompany })
})

companyRoutes.put('/:companyId', async (req: Request, res: Response) => {
  const validatedBody = validateRequest(UpdateCompanyMeReqSchema, req.body, req.path)

  const updatedCompany = {
    id: 'company-uuid-123',
    name: validatedBody.name || 'Acme Corp Updated',
    description: validatedBody.description || 'Leading online store, now updated',
    website: validatedBody.website || 'https://acme.corp',
    meta: { triggeredEnrichment: true, oldData: '...', newData: '...' }
  }
  SuccessResponse.send({ res, data: updatedCompany })
})

companyRoutes.get('/:companyId/analyze', async (req: Request, res: Response) => {
  log.info('Controller: GET /:companyId/analyze')
  const { companyId } = req.params
  const websiteUrl = req.query.url as string

  if (!websiteUrl) {
    return res.status(400).send({ message: 'Missing URL query parameter' })
  }

  try {
    // Use the summarizeWebsite function to analyze the website
    const result = await summarizeWebsite({ url: websiteUrl })

    // Map the AI response to frontend fields
    const analysisResult = {
      companyId,
      brandName: result.brandDetails.brandName || '',
      websiteUrl: websiteUrl,
      contactName: result.brandDetails.contactName || '',
      phone: result.brandDetails.phone || '',
      description: result.brandDetails.description || '',
      industry: result.brandDetails.industry || '',
      targetAudience: result.brandDetails.targetAudience || ''
    }

    SuccessResponse.send({ res, data: analysisResult })
  } catch (error) {
    log.error('Error analyzing website:', error)
    res.status(500).send({
      message: error instanceof Error ? error.message : 'Failed to analyze website',
      status: 'analysis_failed'
    })
  }
})

companyRoutes.get('/analyze', async (req: Request, res: Response) => {
  log.info('Controller: GET /analyze')
  const websiteUrl = req.query.url as string

  if (!websiteUrl) {
    return res.status(400).send({ message: 'Missing URL query parameter' })
  }

  try {
    // Use the summarizeWebsite function to analyze the website
    const result = await summarizeWebsite({ url: websiteUrl })

    // Map the AI response to frontend fields
    const analysisResult = {
      brandName: result.brandDetails.brandName || '',
      websiteUrl: websiteUrl,
      contactName: result.brandDetails.contactName || '',
      phone: result.brandDetails.phone || '',
      description: result.brandDetails.description || '',
      industry: result.brandDetails.industry || '',
      targetAudience: result.brandDetails.targetAudience || ''
    }

    SuccessResponse.send({ res, data: analysisResult })
  } catch (error) {
    log.error('Error analyzing website:', error)
    res.status(500).send({
      message: error instanceof Error ? error.message : 'Failed to analyze website',
      status: 'analysis_failed'
    })
  }
})

export { companyRoutes }

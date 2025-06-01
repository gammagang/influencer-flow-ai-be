import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import {
  AnalyzeWebsiteReqSchema,
  CreateCompanyReqSchema,
  UpdateCompanyMeReqSchema
} from './validate'
import { summarizeWebsite } from '@/api/summarize'
import { createCompany } from '@/api/company'

const companyRoutes = Router()

companyRoutes.post('/', async (req: Request, res: Response) => {
  const { name, website, category, description, phone, owner } = req.body
  const body = { name, website, category, description, phone, owner }

  const validatedBody = validateRequest(CreateCompanyReqSchema, body, req.path)

  try {
    const newCompany = await createCompany({
      name: validatedBody.name,
      website: validatedBody.website,
      category: validatedBody.category,
      owner: validatedBody.owner,
      description: validatedBody.description || null,
      user_id: req.user!['sub'],
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

companyRoutes.get('/analyze', async (req: Request, res: Response) => {
  const websiteUrl = req.query.url as string

  const params = validateRequest(AnalyzeWebsiteReqSchema, { websiteUrl }, req.path)

  try {
    const result = await summarizeWebsite(params.websiteUrl)

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

export { companyRoutes }

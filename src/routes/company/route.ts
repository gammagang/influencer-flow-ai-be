import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import { CreateCompanyReqSchema, UpdateCompanyMeReqSchema } from './validate'

const router = Router()

router.get(`/company/me`, async (req: Request, res: Response) => {
  log.info(`Controller: GET /company/me`)

  const sampleCompany = {
    id: 'company-uuid-123',
    name: 'Acme Corp',
    description: 'Leading online store',
    website: 'https://acme.corp',
    meta: { enrichedData: '...' }
  }
  SuccessResponse.send({ res, data: sampleCompany })
})

router.put(`/company/me`, async (req: Request, res: Response) => {
  log.info(`Controller: PUT /company/me`)
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

router.post('/company', async (req: Request, res: Response) => {
  log.info(`Controller: POST /company`)
  const validatedBody = validateRequest(CreateCompanyReqSchema, req.body, req.path)

  const newCompany = {
    id: 'company-uuid-new',
    name: validatedBody.name,
    description: validatedBody.description,
    website: validatedBody.website,
    meta: { initialEnrichmentStatus: 'pending' }
  }
  SuccessResponse.send({ res, data: newCompany, status: 201 })
})

router.put('/company/:companyId/analyze', async (req: Request, res: Response) => {
  log.info('Controller: PUT /company/:companyId/analyze')
  const { companyId } = req.params
  const websiteUrl = req.query.url

  if (!websiteUrl) {
    // Or handle with a more specific error, e.g., BadRequestError
    return res.status(400).send({ message: 'Missing URL query parameter' })
  }

  // TODO: Add AI LLM Integration to analyze the website URL
  // TODO: Save info in DB using companyId - @monish

  const analysisResult = {
    companyId,
    url: websiteUrl,
    status: 'analysis_pending',
    message: 'AI analysis will be performed here.'
  }
  SuccessResponse.send({ res, data: analysisResult })
})

export { router as companyRoutes }

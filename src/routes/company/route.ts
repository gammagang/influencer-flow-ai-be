import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import { CreateCompanyReqSchema, UpdateCompanyMeReqSchema } from './validate'
import { summarizeWebsite } from '@/api/summarize'

const router = Router()

router.get(`/me`, async (req: Request, res: Response) => {
  log.info(`Controller: GET /me`)

  const sampleCompany = {
    id: 'company-uuid-123',
    name: 'Acme Corp',
    description: 'Leading online store',
    website: 'https://acme.corp',
    meta: { enrichedData: '...' }
  }
  SuccessResponse.send({ res, data: sampleCompany })
})

router.put(`/me`, async (req: Request, res: Response) => {
  log.info(`Controller: PUT /me`)
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

router.post('', async (req: Request, res: Response) => {
  log.info(`Controller: POST `)
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

router.get('/:companyId/analyze', async (req: Request, res: Response) => {
  log.info('Controller: GET /:companyId/analyze')
  const { companyId } = req.params
  const websiteUrl = req.query.url as string

  if (!websiteUrl) {
    return res.status(400).send({ message: 'Missing URL query parameter' })
  }

  try {
    // Use the summarizeWebsite function to analyze the website
    const result = await summarizeWebsite({ url: websiteUrl })
    
    // Return the brand details with the company ID
    const analysisResult = {
      companyId,
      url: websiteUrl,
      status: 'analysis_complete',
      ...result
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

export { router as companyRoutes }

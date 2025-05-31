import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import { CreateCompanyReqSchema, UpdateCompanyMeReqSchema } from './validate'

const router = Router()

/**
 * @openapi
 * tags:
 *   name: Company
 *   description: Company profile management
 */

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

export { router as companyRoutes }

import { Router, Request, Response } from 'express'

import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { CreateUserReqSchema } from './validate'
import { validateRequest } from '@/middlewares/validate-request'

const router = Router()
const ENDPOINT = '/entity' as const

router.post(ENDPOINT, async (req: Request, res: Response) => {
  log.info('Controller', ENDPOINT)
  const user = validateRequest(CreateUserReqSchema, req.body, req.path)
  SuccessResponse.send({ res, data: user, status: 201 })
})

export { router as entityRoutes }

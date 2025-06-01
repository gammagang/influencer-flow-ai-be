import { Router, Request, Response } from 'express'

import { SuccessResponse } from '@/libs/success-response'

const router = Router()
// NOTE: All public routes will have no JWT middleware

router.post('/', async (req: Request, res: Response) => {
  SuccessResponse.send({ res, data: null, status: 201 })
})

export { router as publicRoutes }

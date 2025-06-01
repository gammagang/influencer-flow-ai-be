import { Router, Request, Response } from 'express'

import { SuccessResponse } from '@/libs/success-response'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  SuccessResponse.send({ res, data: null, status: 201 })
})

export { router as publicRoutes }

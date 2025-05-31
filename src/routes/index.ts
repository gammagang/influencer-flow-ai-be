import { Router } from 'express'
import { companyRoutes } from './company/route'
import { campaignsRouter } from './campaigns/route'

const router = Router()

router.use('/company', companyRoutes)
router.use('/campaigns', campaignsRouter)

export { router as allRoutes }

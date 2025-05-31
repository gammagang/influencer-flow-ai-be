import { Router } from 'express'
import { companyRoutes } from './company/route'
import { campaignsRouter } from './campaigns/route'
import { creatorsRouter } from './creators/route'

const router = Router()

router.use('/company', companyRoutes)
router.use('/campaigns', campaignsRouter)
router.use('/creators', creatorsRouter)

export { router as allRoutes }

import { Router } from 'express'
import { companyRoutes } from './company/route'
import { campaignsRouter } from './campaigns/route'
import { creatorsRouter } from './creators/route'
import { campaignCreatorRouter } from './campaign-creator/route'
import { contractsRouter } from './contracts/route'
import { contentRouter } from './content/route'

const router = Router()

router.use('/company', companyRoutes)
router.use('/campaigns', campaignsRouter)
router.use('/creators', creatorsRouter)
router.use('/campaign-creator', campaignCreatorRouter)
router.use('/contracts', contractsRouter)
router.use('/content', contentRouter)

export { router as allRoutes }

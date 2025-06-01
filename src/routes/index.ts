import { Router } from 'express'
import { companyRoutes } from './company/route'
import { campaignsRouter } from './campaigns/route'
import { creatorsRouter } from './creators/route'
import { campaignCreatorRouter } from './campaign-creator/route'
import { contractsRouter } from './contracts/route'
import { contentRouter } from './content/route'
import { webhooksRouter } from './webhooks/route'

const router = Router()

router.use(companyRoutes)
router.use(campaignsRouter)
router.use(creatorsRouter)
router.use(campaignCreatorRouter)
router.use('/contracts', contractsRouter)
router.use('/content', contentRouter)
router.use('/webhooks', webhooksRouter)

export { router as allRoutes }

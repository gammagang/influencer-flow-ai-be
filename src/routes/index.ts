import { Router } from 'express'
import { companyRoutes } from './company/route'
import { campaignsRouter } from './campaign/route'
import { creatorsRouter } from './creator/route'
import { campaignCreatorRouter } from './campaign-creator/route'
import { contractsRouter } from './contracts/route'
import { contentRouter } from './content/route'
import { webhooksRouter } from './webhook/route'

const router = Router()

router.use(companyRoutes)
router.use(campaignsRouter)
router.use(creatorsRouter)
router.use(campaignCreatorRouter)
router.use('/contracts', contractsRouter)
router.use('/content', contentRouter)
router.use('/webhook', webhooksRouter)

export { router as allRoutes }

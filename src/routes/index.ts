import { Router } from 'express'
import { campaignCreatorRouter } from './campaign-creator/route'
import { campaignsRouter } from './campaign/route'
import { companyRoutes } from './company/route'
import { contentRouter } from './content/route'
import { contractsRouter } from './contracts/route'
import { creatorsRouter } from './creator/route'
import { elevenLabsRouter } from './elevenlabs/route'
import { webhooksRouter } from './webhook/route'

const router = Router()

router.use('/company', companyRoutes)
router.use('/campaign', campaignsRouter)
router.use('/creator', creatorsRouter)
router.use('/campaign-creator', campaignCreatorRouter)
router.use('/contracts', contractsRouter)
router.use('/content', contentRouter)
router.use('/webhook', webhooksRouter)
router.use('/elevenlabs', elevenLabsRouter)

export { router as allRoutes }

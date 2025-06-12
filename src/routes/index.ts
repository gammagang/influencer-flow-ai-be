import { Router } from 'express'
import { campaignCreatorRouter } from './campaign-creator/route'
import { campaignsRouter } from './campaign/route'
import { companyRoutes } from './company/route'
import { contentRouter } from './content/route'
import { contractsRouter } from './contracts/route'
import { creatorsRouter } from './creator/route'
import { webhooksRouter } from './webhook/route'
import { emailRouter } from './email'
import { chatRouter } from './chat/route'

const allRoutes = Router()

allRoutes.use('/company', companyRoutes)
allRoutes.use('/campaign', campaignsRouter)
allRoutes.use('/creator', creatorsRouter)
allRoutes.use('/campaign-creator', campaignCreatorRouter)
allRoutes.use('/contracts', contractsRouter)
allRoutes.use('/content', contentRouter)
allRoutes.use('/webhook', webhooksRouter)
allRoutes.use('/email', emailRouter)
allRoutes.use('/chat', chatRouter)

export { allRoutes }

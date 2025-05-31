import { Router } from 'express'
import { entityRoutes } from './entity/route'

const router = Router()

router.use(entityRoutes)

export { router as allRoutes }

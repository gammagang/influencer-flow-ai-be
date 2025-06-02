import { sendContractEmail, sendEmail, sendOutreachEmail, sendTestEmail } from '@/api/email'
import { Router } from 'express'

const router = Router()

// Test email endpoint
router.post('/test', sendTestEmail)

// Send outreach email to creator
router.post('/outreach', sendOutreachEmail)

// Send contract email to creator
router.post('/contract', sendContractEmail)

// Send general email
router.post('/send', sendEmail)

export { router as emailRouter }

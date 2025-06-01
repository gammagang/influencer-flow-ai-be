import { Router } from 'express'
import { sendOutreachEmail, sendContractEmail, sendEmail, sendTestEmail } from '@/api/email'

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

import { Request, Response } from 'express'
import { z } from 'zod'
import { emailService, OutreachEmailData } from '@/libs/resend'
import { SuccessResponse } from '@/libs/success-response'
import { BadRequestError } from '@/errors/bad-request-error'
import { log } from '@/libs/logger'

// Schema for outreach email
const outreachEmailSchema = z.object({
  creatorName: z.string().min(1, 'Creator name is required'),
  creatorEmail: z.string().email('Valid email is required'),
  brandName: z.string().min(1, 'Brand name is required'),
  campaignName: z.string().min(1, 'Campaign name is required'),
  campaignDetails: z
    .object({
      budget: z.string().optional(),
      timeline: z.string().optional(),
      deliverables: z.array(z.string()).optional(),
      description: z.string().optional()
    })
    .optional(),
  personalizedMessage: z.string().optional(),
  negotiationLink: z.string().url().optional()
})

// Schema for contract email
const contractEmailSchema = z.object({
  creatorName: z.string().min(1, 'Creator name is required'),
  creatorEmail: z.string().email('Valid email is required'),
  brandName: z.string().min(1, 'Brand name is required'),
  campaignName: z.string().min(1, 'Campaign name is required'),
  contractLink: z.string().url('Valid contract link is required'),
  contractDetails: z.any().optional()
})

// Schema for general email
const generalEmailSchema = z
  .object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    from: z.string().email().optional(),
    subject: z.string().min(1, 'Subject is required'),
    html: z.string().optional(),
    text: z.string().optional(),
    cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    replyTo: z.union([z.string().email(), z.array(z.string().email())]).optional()
  })
  .refine((data) => data.html || data.text, {
    message: 'Either html or text content is required'
  })

/**
 * Send outreach email to creator
 * POST /api/email/outreach
 */
export const sendOutreachEmail = async (req: Request, res: Response) => {
  try {
    const validatedData = outreachEmailSchema.parse(req.body)

    log.info('Sending outreach email', {
      creatorEmail: validatedData.creatorEmail,
      campaignName: validatedData.campaignName,
      brandName: validatedData.brandName
    })

    const result = await emailService.sendOutreachEmail(validatedData as OutreachEmailData)

    SuccessResponse.send({
      res,
      data: {
        emailId: result?.id,
        message: 'Outreach email sent successfully',
        recipient: validatedData.creatorEmail
      },
      status: 201
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new BadRequestError('Invalid email data', JSON.stringify(error.errors))
    }

    log.error('Failed to send outreach email:', { error, body: req.body })
    throw error
  }
}

/**
 * Send contract email to creator
 * POST /api/email/contract
 */
export const sendContractEmail = async (req: Request, res: Response) => {
  try {
    const validatedData = contractEmailSchema.parse(req.body)

    log.info('Sending contract email', {
      creatorEmail: validatedData.creatorEmail,
      campaignName: validatedData.campaignName,
      brandName: validatedData.brandName
    })

    const result = await emailService.sendContractEmail(validatedData)

    SuccessResponse.send({
      res,
      data: {
        emailId: result?.id,
        message: 'Contract email sent successfully',
        recipient: validatedData.creatorEmail
      },
      status: 201
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new BadRequestError('Invalid contract email data', JSON.stringify(error.errors))
    }

    log.error('Failed to send contract email:', { error, body: req.body })
    throw error
  }
}

/**
 * Send general email
 * POST /api/email/send
 */
export const sendEmail = async (req: Request, res: Response) => {
  try {
    const validatedData = generalEmailSchema.parse(req.body)

    log.info('Sending general email', {
      to: validatedData.to,
      subject: validatedData.subject
    })

    const result = await emailService.sendEmail(validatedData)

    SuccessResponse.send({
      res,
      data: {
        emailId: result?.id,
        message: 'Email sent successfully',
        recipient: validatedData.to
      },
      status: 201
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new BadRequestError('Invalid email data', JSON.stringify(error.errors))
    }

    log.error('Failed to send email:', { error, body: req.body })
    throw error
  }
}

/**
 * Test email endpoint - sends a simple test email
 * POST /api/email/test
 */
export const sendTestEmail = async (req: Request, res: Response) => {
  try {
    const { to, name = 'User' } = req.body

    if (!to || !z.string().email().safeParse(to).success) {
      throw new BadRequestError('Valid email address is required in "to" field', req.path)
    }
    const testEmailData = {
      to,
      subject: 'Test Email from InfluencerFlow AI',
      html: `
        <h2>Hello ${name}!</h2>
        <p>This is a test email from the InfluencerFlow AI platform.</p>
        <p>If you're receiving this, it means our email system is working correctly!</p>
        <br>
        <a href="http://localhost:8080/agent-call?id=1" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Schedule Agent Call</a>
        <br>
        <p>Best regards,<br>The InfluencerFlow AI Team</p>
      `,
      text: `Hello ${name}!\n\nThis is a test email from the InfluencerFlow AI platform.\nIf you're receiving this, it means our email system is working correctly!\n\nSchedule Agent Call: http://localhost:3000/agent-call?cc_id=1\n\nBest regards,\nThe InfluencerFlow AI Team`
    }

    const result = await emailService.sendEmail(testEmailData)

    SuccessResponse.send({
      res,
      data: {
        emailId: result?.id,
        message: 'Test email sent successfully',
        recipient: to
      },
      status: 201
    })
  } catch (error) {
    log.error('Failed to send test email:', { error, body: req.body })
    throw error
  }
}

/**
 * Send outreach email programmatically (for use from other routes)
 * Returns result instead of sending HTTP response
 */
export const sendOutreachEmailProgrammatic = async (emailData: {
  to: string
  subject: string
  text: string
  html?: string
}) => {
  try {
    const result = await emailService.sendEmail({
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html || emailData.text.replace(/\n/g, '<br>')
    })

    return {
      success: true,
      data: {
        emailId: result?.id,
        message: 'Email sent successfully',
        recipient: emailData.to
      }
    }
  } catch (error) {
    log.error('Failed to send email programmatically:', { error, emailData })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

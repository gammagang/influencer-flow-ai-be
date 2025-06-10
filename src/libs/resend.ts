import { Resend } from 'resend'
import configs from '@/configs'
import { log } from './logger'

const resend = new Resend(configs.resendApiKey)

export interface EmailOptions {
  to: string | string[]
  from?: string
  subject: string
  html?: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string | string[]
}

export interface OutreachEmailData {
  creatorName: string
  creatorEmail: string
  brandName: string
  campaignName: string
  campaignDetails?: {
    budget?: string
    timeline?: string
    deliverables?: string[]
    description?: string
  }
  personalizedMessage?: string
  negotiationLink?: string
}

export class EmailService {
  private readonly defaultFrom = 'influencerflow@madhukm.com'
  async sendEmail(options: EmailOptions) {
    try {
      // Prepare the email payload - Resend requires either html/text or react
      const emailPayload: any = {
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject
      }

      // Add optional fields only if they exist
      if (options.html) emailPayload.html = options.html
      if (options.text) emailPayload.text = options.text
      if (options.cc) emailPayload.cc = options.cc
      if (options.bcc) emailPayload.bcc = options.bcc
      if (options.replyTo) emailPayload.replyTo = options.replyTo

      // Ensure we have either html or text content
      if (!emailPayload.html && !emailPayload.text) {
        throw new Error('Email must have either HTML or text content')
      }

      const { data, error } = await resend.emails.send(emailPayload)

      if (error) {
        log.error('Failed to send email via Resend:', { error, options })
        throw new Error(`Failed to send email: ${error.message}`)
      }

      log.info('Email sent successfully via Resend:', {
        emailId: data?.id,
        to: options.to,
        subject: options.subject
      })

      return data
    } catch (error) {
      log.error('Error sending email:', { error, options })
      throw error
    }
  }

  async sendOutreachEmail(data: OutreachEmailData) {
    const subject = `Partnership Opportunity with ${data.brandName} - ${data.campaignName}`

    const html = this.generateOutreachEmailHTML(data)
    const text = this.generateOutreachEmailText(data)

    return this.sendEmail({
      to: data.creatorEmail,
      subject,
      html,
      text
    })
  }

  async sendContractEmail(options: {
    creatorName: string
    creatorEmail: string
    brandName: string
    campaignName: string
    contractLink: string
  }) {
    const { creatorName, creatorEmail, brandName, campaignName, contractLink } = options

    const subject = `Contract Ready for Signature - ${campaignName}`

    const html = `
      <h2>Contract Ready for Signature</h2>
      <p>Dear ${creatorName},</p>
      <p>Your contract for the <strong>${campaignName}</strong> campaign with <strong>${brandName}</strong> is ready.</p>
      <p><a href="${contractLink}">Review & Sign Contract</a></p>
      <p>Best regards,<br>The ${brandName} Team</p>
    `

    const text = `
      Contract Ready for Signature - ${campaignName}

      Dear ${creatorName},

      Your contract for the ${campaignName} campaign with ${brandName} is ready.

      Please review and sign your contract here: ${contractLink}

      Best regards,
      The ${brandName} Team
    `

    return this.sendEmail({
      to: creatorEmail,
      subject,
      html,
      text
    })
  }

  private generateOutreachEmailHTML(data: OutreachEmailData): string {
    const {
      creatorName,
      brandName,
      campaignName,
      campaignDetails,
      personalizedMessage,
      negotiationLink
    } = data

    return `
      <h2>Partnership Opportunity</h2>
      <p>Hi ${creatorName},</p>
      
      <p>We're <strong>${brandName}</strong>, and we'd love to collaborate with you on our <strong>${campaignName}</strong> campaign.</p>
      
      ${personalizedMessage ? `<p><em>${personalizedMessage}</em></p>` : ''}
      
      <h3>Campaign Details:</h3>
      ${campaignDetails?.budget ? `<p><strong>Budget:</strong> ${campaignDetails.budget}</p>` : ''}
      ${campaignDetails?.timeline ? `<p><strong>Timeline:</strong> ${campaignDetails.timeline}</p>` : ''}
      ${campaignDetails?.deliverables?.length ? `<p><strong>Deliverables:</strong> ${campaignDetails.deliverables.join(', ')}</p>` : ''}
      ${campaignDetails?.description ? `<p><strong>Description:</strong> ${campaignDetails.description}</p>` : ''}
      
      <p>We believe your content style would be perfect for this campaign.</p>
      
      ${negotiationLink ? `<p><a href="${negotiationLink}">Discuss This Opportunity</a></p>` : ''}
      
      <p>Best regards,<br>The ${brandName} Team</p>
    `
  }

  private generateOutreachEmailText(data: OutreachEmailData): string {
    const {
      creatorName,
      brandName,
      campaignName,
      campaignDetails,
      personalizedMessage,
      negotiationLink
    } = data

    const emailText = `
      Partnership Opportunity - ${brandName} × ${creatorName}

      Hi ${creatorName},

      We're ${brandName}, and we'd love to collaborate with you on our ${campaignName} campaign.

      ${personalizedMessage ? `${personalizedMessage}\n` : ''}

      Campaign Details:
      ${campaignDetails?.budget ? `• Budget: ${campaignDetails.budget}\n` : ''}${campaignDetails?.timeline ? `• Timeline: ${campaignDetails.timeline}\n` : ''}${campaignDetails?.deliverables?.length ? `• Deliverables: ${campaignDetails.deliverables.join(', ')}\n` : ''}${campaignDetails?.description ? `• Description: ${campaignDetails.description}\n` : ''}

      We believe your content style would be perfect for this campaign.

      ${negotiationLink ? `To discuss this opportunity, please visit: ${negotiationLink}` : "Please let us know if you're interested."}

      Best regards,
      The ${brandName} Team
    `

    return emailText
  }
}

export const emailService = new EmailService()

import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

export type ContractInput = {
  campaignTitle: string
  campaignDescription: string
  startDate: string // ISO format: "YYYY-MM-DD"
  endDate: string // ISO format: "YYYY-MM-DD"
  brand: {
    name: string
    contactPerson: string
    email: string
  }
  influencer: {
    name: string
    instagramHandle: string
    email: string
    phone?: string
  }
  deliverables: string[] // Each deliverable as a bullet point
  compensation: {
    currency: string
    amount: number
    paymentMethod: string // e.g. "Stripe", "Razorpay"
  }
  jurisdiction: string // e.g. "Mumbai, India"
  signature: {
    brandSignatoryName: string
    influencerSignatoryName: string
  }
}

/**
 * Formats a date string from ISO format to DD/MM/YYYY
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch (error) {
    throw new Error(`Invalid date format: ${dateString}`)
  }
}

/**
 * Formats a currency amount with appropriate locale
 */
function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(amount)
  } catch (error) {
    return `${currency} ${amount}`
  }
}

/**
 * Generates a PDF contract document based on the provided contract input
 * @param contractInput - Contract details including campaign, brand, influencer, deliverables, etc.
 * @param outputPath - Path where the PDF file will be saved
 * @returns Promise that resolves with the PDF file path or rejects with an error
 */
export async function generateContract(
  contractInput: ContractInput,
  outputPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Validate required fields
      if (
        !contractInput.campaignTitle ||
        !contractInput.brand.name ||
        !contractInput.influencer.name
      )
        throw new Error('Missing required contract fields')

      // Create output directory if it doesn't exist
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

      // Initialize PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Contract - ${contractInput.campaignTitle}`,
          Author: 'InfluencerFlow AI',
          Subject: 'Brand-Influencer Campaign Agreement'
        }
      })

      // Pipe PDF output to file
      const stream = fs.createWriteStream(outputPath)
      doc.pipe(stream)

      // Set default font and size
      doc.font('Helvetica')

      // Header
      doc.fontSize(18).text('InfluencerFlow AI', { align: 'center' })
      doc.fontSize(14).text('Brand–Influencer Campaign Agreement', { align: 'center' })
      doc.moveDown()
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Campaign details
      doc.fontSize(12)
      doc.text(`Campaign: ${contractInput.campaignTitle}`)
      doc.text(`Campaign Description: ${contractInput.campaignDescription}`)
      doc.text(`Start Date: ${formatDate(contractInput.startDate)}`)
      doc.text(`End Date: ${formatDate(contractInput.endDate)}`)
      doc.moveDown()
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Section 1: Parties
      doc.fontSize(14).text('1. Parties')
      doc.moveDown(0.5)

      // Brand
      doc.fontSize(12).text('Brand:', { continued: true }).fontSize(10)
      doc.moveDown(0.5)
      doc.text(`Brand Name: ${contractInput.brand.name}`)
      doc.text(`Contact Person: ${contractInput.brand.contactPerson}`)
      doc.text(`Contact Email: ${contractInput.brand.email}`)
      doc.moveDown()

      // Influencer
      doc.fontSize(12).text('Influencer:', { continued: true }).fontSize(10)
      doc.moveDown(0.5)
      doc.text(`Name: ${contractInput.influencer.name}`)
      doc.text(`Instagram Handle: ${contractInput.influencer.instagramHandle}`)
      doc.text(`Email: ${contractInput.influencer.email}`)
      if (contractInput.influencer.phone) {
        doc.text(`Phone: ${contractInput.influencer.phone}`)
      }
      doc.moveDown()
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Section 2: Deliverables
      doc.fontSize(14).text('2. Deliverables')
      doc.moveDown(0.5)
      doc
        .fontSize(10)
        .text(
          'The Influencer agrees to produce and publish the following content on Instagram as part of this campaign:'
        )
      doc.moveDown(0.5)

      // Deliverables as bullet points
      contractInput.deliverables.forEach((deliverable, index) => {
        doc.text(`• ${deliverable}`, {
          indent: 10,
          align: 'left'
        })
        if (index < contractInput.deliverables.length - 1) {
          doc.moveDown(0.5)
        }
      })

      doc.moveDown()
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Section 3: Content Guidelines
      doc.fontSize(14).text('3. Content Guidelines')
      doc.moveDown(0.5)
      doc.fontSize(10)
      doc.text("• Content must comply with Instagram's community guidelines and applicable laws.", {
        indent: 10,
        align: 'left'
      })
      doc.moveDown(0.5)
      doc.text(
        '• Required hashtags, tags, and mentions must be included as specified by the Brand.',
        {
          indent: 10,
          align: 'left'
        }
      )
      doc.moveDown(0.5)
      doc.text(
        '• All content should be original and must not infringe on any third-party rights.',
        {
          indent: 10,
          align: 'left'
        }
      )
      doc.moveDown()
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Section 4: Compensation & Payment
      doc.fontSize(14).text('4. Compensation & Payment')
      doc.moveDown(0.5)
      doc.fontSize(10)

      // Format currency
      const formattedAmount = formatCurrency(
        contractInput.compensation.amount,
        contractInput.compensation.currency
      )

      doc.text(`• Total agreed compensation: ${formattedAmount}`, {
        indent: 10,
        align: 'left'
      })
      doc.moveDown(0.5)
      doc.text('• Payment will be made in two installments:', {
        indent: 10,
        align: 'left'
      })
      doc.text('   - 50% upon contract signing', {
        indent: 20,
        align: 'left'
      })
      doc.text('   - 50% upon content submission and Brand verification', {
        indent: 20,
        align: 'left'
      })
      doc.moveDown(0.5)
      doc.text(`• Payments will be processed via ${contractInput.compensation.paymentMethod}.`, {
        indent: 10,
        align: 'left'
      })

      doc.moveDown()
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Section 5: Usage Rights & Exclusivity
      doc.fontSize(14).text('5. Usage Rights & Exclusivity')
      doc.moveDown(0.5)
      doc.fontSize(10)
      doc.text(
        '• The Brand is granted a non-exclusive, royalty-free, worldwide license to use, display, and promote the campaign content on its owned channels and marketing materials for a period of 12 months from publication.',
        {
          indent: 10,
          align: 'left'
        }
      )
      doc.moveDown(0.5)
      doc.text('• The Influencer retains ownership of the content.', {
        indent: 10,
        align: 'left'
      })
      doc.moveDown(0.5)
      doc.text(
        '• The Influencer agrees not to promote direct competitors of the Brand in the same product category for 30 days following the campaign end date.',
        {
          indent: 10,
          align: 'left'
        }
      )

      doc.moveDown()
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Section 6: Confidentiality
      doc.fontSize(14).text('6. Confidentiality')
      doc.moveDown(0.5)
      doc.fontSize(10)
      doc.text(
        'Both parties agree to keep confidential any non-public information shared during the campaign, including compensation, strategy, and other sensitive details.'
      )

      doc.moveDown()
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Section 7: Termination
      doc.fontSize(14).text('7. Termination')
      doc.moveDown(0.5)
      doc.fontSize(10)
      doc.text(
        '• Either party may terminate this agreement with written notice if the other party breaches any material term.',
        {
          indent: 10,
          align: 'left'
        }
      )
      doc.moveDown(0.5)
      doc.text(
        '• In case of early termination after content creation but before posting, compensation will be adjusted based on deliverables provided.',
        {
          indent: 10,
          align: 'left'
        }
      )

      doc.moveDown()
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Section 8: Dispute Resolution
      doc.fontSize(14).text('8. Dispute Resolution')
      doc.moveDown(0.5)
      doc.fontSize(10)
      doc.text(
        `Any disputes shall be resolved amicably through mutual discussion. If unresolved, the matter will be subject to the jurisdiction of ${contractInput.jurisdiction}.`
      )

      doc.moveDown()
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Section 9: Miscellaneous
      doc.fontSize(14).text('9. Miscellaneous')
      doc.moveDown(0.5)
      doc.fontSize(10)
      doc.text(
        '• Any amendments to this contract must be made in writing and signed by both parties.',
        {
          indent: 10,
          align: 'left'
        }
      )
      doc.moveDown(0.5)
      doc.text(
        '• This agreement constitutes the entire understanding between both parties regarding this campaign.',
        {
          indent: 10,
          align: 'left'
        }
      )

      doc.moveDown()
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Section 10: Acceptance & Signatures
      doc.fontSize(14).text('10. Acceptance & Signatures')
      doc.moveDown(0.5)
      doc.fontSize(10)
      doc.text('By signing below, both parties agree to the terms outlined in this agreement.')
      doc.moveDown()

      // Brand signature
      doc.text('Brand Representative:')
      doc.text('Signature: ________________________', { indent: 10 })
      doc.text(`Name: ${contractInput.signature.brandSignatoryName}`, { indent: 10 })
      doc.moveDown()

      // Influencer signature
      doc.text('Influencer:')
      doc.text('Signature: ________________________', { indent: 10 })
      doc.text(`Name: ${contractInput.signature.influencerSignatoryName}`, { indent: 10 })

      // Add current date at the bottom
      const currentDate = new Date()
      const formattedCurrentDate = currentDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })

      doc.moveDown()
      doc.fontSize(8).text(`Contract generated on ${formattedCurrentDate}`, { align: 'center' })

      // Finalize the PDF
      doc.end()

      // Handle stream events
      stream.on('finish', () => {
        resolve(outputPath)
      })

      stream.on('error', (err) => {
        reject(new Error(`Error writing PDF to file: ${err.message}`))
      })
    } catch (error) {
      if (error instanceof Error) {
        reject(new Error(`Failed to generate contract: ${error.message}`))
      } else {
        reject(new Error('Failed to generate contract due to unknown error'))
      }
    }
  })
}

/**
 * Example usage:
 *
 * const contractInput: ContractInput = {
 *   campaignTitle: "Eduform Awareness Campaign",
 *   campaignDescription: "An Instagram campaign to raise awareness about Eduform's new learning features targeting college students.",
 *   startDate: "2025-06-15",
 *   endDate: "2025-06-30",
 *   brand: {
 *     name: "Eduform",
 *     contactPerson: "Priya Shah",
 *     email: "priya@eduform.com"
 *   },
 *   influencer: {
 *     name: "Amit Verma",
 *     instagramHandle: "@amitlearns",
 *     email: "amit@influencer.com",
 *     phone: "+91-9876543210"
 *   },
 *   deliverables: [
 *     "One 60s Reel highlighting the cool features of Eduform",
 *     "Three Stories of 10-15s each showcasing Eduform's interactive learning tools"
 *   ],
 *   compensation: {
 *     currency: "INR",
 *     amount: 20000,
 *     paymentMethod: "Razorpay"
 *   },
 *   jurisdiction: "Mumbai, India",
 *   signature: {
 *     brandSignatoryName: "Priya Shah",
 *     influencerSignatoryName: "Amit Verma"
 *   }
 * };
 *
 * generateContract(contractInput, './output/contract.pdf')
 *   .then(filePath => console.log(`Contract generated at: ${filePath}`))
 *   .catch(error => console.error(`Error: ${error.message}`));
 */

import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { ContractInput } from './docuseal'
import { log } from './logger'

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
  } catch {
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
    log.error(`Failed to format currency: ${error}`)
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

      // Set default font and size - Using Times-Roman as it's a standard built-in PDF font
      doc.font('Times-Roman').fontSize(12)

      // Header
      doc.fontSize(18).font('Times-Bold').text('InfluencerFlow AI', { align: 'center' })
      doc.fontSize(16).text('Brand–Influencer Campaign Agreement', { align: 'center' })
      doc.moveDown(1.5)

      // Campaign details
      doc.font('Times-Roman').fontSize(12)
      doc.text(`Campaign: ${contractInput.campaignTitle}`, { lineGap: 5 })
      doc.text(`Campaign Description: ${contractInput.campaignDescription}`, { lineGap: 5 })
      doc.text(`Start Date: ${formatDate(contractInput.startDate)}`, { lineGap: 5 })
      doc.text(`End Date: ${formatDate(contractInput.endDate)}`, { lineGap: 5 })
      doc.moveDown(2)

      // Section 1: Parties
      doc.fontSize(14).font('Times-Bold').text('1. Parties')
      doc.moveDown(0.5)

      // Brand
      doc.fontSize(12).font('Times-Bold').text('Brand:')
      doc.font('Times-Roman').fontSize(12)
      doc.moveDown(0.5)
      doc.text(`Brand Name: ${contractInput.brand.name}`, { indent: 20, lineGap: 3 })
      doc.text(`Contact Person: ${contractInput.brand.contactPerson}`, { indent: 20, lineGap: 3 })
      doc.text(`Contact Email: ${contractInput.brand.email}`, { indent: 20, lineGap: 3 })
      doc.moveDown()

      // Influencer
      doc.fontSize(12).font('Times-Bold').text('Influencer:')
      doc.font('Times-Roman').fontSize(12)
      doc.moveDown(0.5)
      doc.text(`Name: ${contractInput.influencer.name}`, { indent: 20, lineGap: 3 })
      doc.text(`Instagram Handle: ${contractInput.influencer.instagramHandle}`, {
        indent: 20,
        lineGap: 3
      })
      doc.text(`Email: ${contractInput.influencer.email}`, { indent: 20, lineGap: 3 })
      if (contractInput.influencer.phone) {
        doc.text(`Phone: ${contractInput.influencer.phone}`, { indent: 20, lineGap: 3 })
      }
      doc.moveDown(2)

      // Section 2: Deliverables
      doc.fontSize(14).font('Times-Bold').text('2. Deliverables')
      doc.moveDown(0.5)
      doc
        .font('Times-Roman')
        .fontSize(12)
        .text(
          'The Influencer agrees to produce and publish the following content on Instagram as part of this campaign:'
        )
      doc.moveDown(0.5)

      // Deliverables as bullet points
      contractInput.deliverables.forEach((deliverable, index) => {
        doc.text(`• ${deliverable}`, { indent: 10, align: 'left', lineGap: 5 })
        if (index < contractInput.deliverables.length - 1) doc.moveDown(0.5)
      })

      doc.moveDown(2)

      // Section 3: Content Guidelines
      doc.fontSize(14).font('Times-Bold').text('3. Content Guidelines')
      doc.moveDown(0.5)
      doc.fontSize(12).font('Times-Roman')
      doc.text("• Content must comply with Instagram's community guidelines and applicable laws.", {
        indent: 10,
        align: 'left',
        lineGap: 3
      })
      doc.moveDown(0.5)
      doc.text(
        '• Required hashtags, tags, and mentions must be included as specified by the Brand.',
        {
          indent: 10,
          align: 'left',
          lineGap: 3
        }
      )
      doc.moveDown(0.5)
      doc.text(
        '• All content should be original and must not infringe on any third-party rights.',
        {
          indent: 10,
          align: 'left',
          lineGap: 3
        }
      )
      doc.moveDown(2)

      // Section 4: Compensation & Payment
      doc.fontSize(14).font('Times-Bold').text('4. Compensation & Payment')
      doc.moveDown(0.5)
      doc.fontSize(12).font('Times-Roman')

      // Format currency
      const formattedAmount = contractInput.compensation.amount
        ? formatCurrency(
            parseInt(contractInput.compensation.amount.toString(), 10),
            contractInput.compensation.currency
          )
        : ''

      doc.text(`• Total agreed compensation: ${formattedAmount}`, { indent: 10, align: 'left' })
      doc.moveDown(0.5)
      doc.text('• Payment will be made in two installments:', {
        indent: 10,
        align: 'left'
      })
      doc.text('   - 50% upon contract signing', { indent: 20, align: 'left' })
      doc.text('   - 50% upon content submission and Brand verification', {
        indent: 20,
        align: 'left'
      })
      doc.moveDown(0.5)
      doc.text(`• Payments will be processed via ${contractInput.compensation.paymentMethod}.`, {
        indent: 10,
        align: 'left'
      })

      doc.moveDown(2)

      // Section 5: Usage Rights & Exclusivity
      doc.fontSize(14).font('Times-Bold').text('5. Usage Rights & Exclusivity')
      doc.moveDown(0.5)
      doc.fontSize(12).font('Times-Roman')
      doc.text(
        '• The Brand is granted a non-exclusive, royalty-free, worldwide license to use, display, and promote the campaign content on its owned channels and marketing materials for a period of 12 months from publication.',
        { indent: 10, align: 'left' }
      )
      doc.moveDown(0.5)
      doc.text('• The Influencer retains ownership of the content.', { indent: 10, align: 'left' })
      doc.moveDown(0.5)
      doc.text(
        '• The Influencer agrees not to promote direct competitors of the Brand in the same product category for 30 days following the campaign end date.',
        { indent: 10, align: 'left' }
      )

      doc.moveDown(2)

      // Section 6: Confidentiality
      doc.fontSize(14).font('Times-Bold').text('6. Confidentiality')
      doc.moveDown(0.5)
      doc.fontSize(12).font('Times-Roman')
      doc.text(
        'Both parties agree to keep confidential any non-public information shared during the campaign, including compensation, strategy, and other sensitive details.'
      )

      doc.moveDown(2)

      // Section 7: Termination
      doc.fontSize(14).font('Times-Bold').text('7. Termination')
      doc.moveDown(0.5)
      doc.fontSize(12).font('Times-Roman')
      doc.text(
        '• Either party may terminate this agreement with written notice if the other party breaches any material term.',
        { indent: 10, align: 'left' }
      )
      doc.moveDown(0.5)
      doc.text(
        '• In case of early termination after content creation but before posting, compensation will be adjusted based on deliverables provided.',
        { indent: 10, align: 'left' }
      )

      doc.moveDown(2)

      // Section 8: Dispute Resolution
      doc.fontSize(14).font('Times-Bold').text('8. Dispute Resolution')
      doc.moveDown(0.5)
      doc.fontSize(12).font('Times-Roman')
      doc.text(
        `Any disputes shall be resolved amicably through mutual discussion. If unresolved, the matter will be subject to the jurisdiction of ${contractInput.jurisdiction}.`
      )

      doc.moveDown(2)

      // Section 9: Miscellaneous
      doc.fontSize(14).font('Times-Bold').text('9. Miscellaneous')
      doc.moveDown(0.5)
      doc.fontSize(12).font('Times-Roman')
      doc.text(
        '• Any amendments to this contract must be made in writing and signed by both parties.',
        { indent: 10, align: 'left' }
      )
      doc.moveDown(0.5)
      doc.text(
        '• This agreement constitutes the entire understanding between both parties regarding this campaign.',
        { indent: 10, align: 'left' }
      )

      doc.moveDown(2)

      // Section 10: Acceptance & Signatures
      doc.fontSize(14).font('Times-Bold').text('10. Acceptance & Signatures')
      doc.moveDown(0.5)
      doc.fontSize(12).font('Times-Roman')
      doc.text('By signing below, both parties agree to the terms outlined in this agreement.')
      doc.moveDown(1.5)

      // Brand signature
      doc.text('Brand Representative:', { lineGap: 5 })
      doc.text('Signature: ________________________', { indent: 10, lineGap: 5 })
      doc.text(`Name: ${contractInput.signature.brandSignatoryName}`, { indent: 10 })
      doc.moveDown(1.5)

      // Influencer signature
      doc.text('Influencer:', { lineGap: 5 })
      doc.text('Signature: ________________________', { indent: 10, lineGap: 5 })
      doc.text(`Name: ${contractInput.signature.influencerSignatoryName}`, { indent: 10 }) // Add current date at the bottom left of the last page
      const currentDate = new Date()
      const formattedCurrentDate = currentDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })

      // Move to the absolute bottom of the page (footer area)
      // Ensure there's plenty of space below the signatures
      doc.y = doc.page.height - doc.page.margins.bottom - 10

      // Add the date at the bottom left with light gray color for subtlety
      doc
        .fontSize(8)
        .fillColor('#888888')
        .text(`Contract generated on ${formattedCurrentDate}`, { align: 'left' })

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
      if (error instanceof Error) reject(new Error(`Failed to generate contract: ${error.message}`))
      else reject(new Error('Failed to generate contract due to unknown error'))
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

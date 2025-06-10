import { describe, it, expect } from 'vitest'
import { generateContract } from '@/libs/pdf'
import path from 'path'
import fs from 'fs'
import { ContractInput } from '@/libs/docuseal'

describe('PDF Generator', () => {
  it('should generate a valid PDF contract file', async () => {
    // Sample contract input
    const contractInput: ContractInput = {
      campaignTitle: 'Eduform Awareness Campaign',
      campaignDescription:
        "An Instagram campaign to raise awareness about Eduform's new learning features targeting college students.",
      startDate: '2025-06-15',
      endDate: '2025-06-30',
      brand: {
        name: 'Eduform',
        contactPerson: 'Priya Shah',
        email: 'priya@eduform.com'
      },
      influencer: {
        name: 'Amit Verma',
        instagramHandle: '@amitlearns',
        email: 'amit@influencer.com',
        phone: '+91-9876543210'
      },
      deliverables: [
        'One 60s Reel highlighting the cool features of Eduform',
        "Three Stories of 10-15s each showcasing Eduform's interactive learning tools"
      ],
      compensation: {
        currency: 'INR',
        amount: 20000,
        paymentMethod: 'Razorpay'
      },
      jurisdiction: 'Mumbai, India',
      signature: {
        brandSignatoryName: 'Priya Shah',
        influencerSignatoryName: 'Amit Verma'
      }
    }

    // Output path for the test PDF
    const outputDir = path.join(__dirname, '../../../test-output')
    const outputPath = path.join(outputDir, 'test-contract.pdf')

    // Generate the PDF
    const filePath = await generateContract(contractInput, outputPath)

    // Verify the file exists
    expect(fs.existsSync(filePath)).toBe(true)

    // Get file stats
    const stats = fs.statSync(filePath)

    // Check if file has content
    expect(stats.size).toBeGreaterThan(0)
  })
})

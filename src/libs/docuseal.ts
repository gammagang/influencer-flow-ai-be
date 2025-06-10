import configs from '@/configs'
import docuseal from '@docuseal/api'

docuseal.configure({ key: configs.docusealApiKey, url: 'https://api.docuseal.com' })

const DOCUSEAL_TEMPLATE_ID = 1189705 as const

// Field names map (must match exactly with DocuSeal template field names)
const FieldNames = {
  // Common fields
  campaignTitle: 'Campaign Title',
  campaignDescription: 'Campaign Description',
  startDate: 'Start Date',
  endDate: 'End Date',
  jurisdiction: 'Jurisdiction',
  compensationAmount: 'Compensation Amount',
  paymentMethod: 'Payment Method',
  deliverables: 'Deliverables',

  // Brand fields
  brandName: 'Brand Name',
  brandContactPerson: 'Brand Contact Person',
  brandEmail: 'Brand Email',
  brandSignatoryName: 'Brand Signatory Name',

  // Influencer fields
  influencerName: 'Influencer Name',
  instagramHandle: 'Instagram Handle',
  influencerEmail: 'Influencer Email',
  phone: 'Phone',
  influencerSignatoryName: 'Influencer Signatory Name'
} as const

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
    amount: number | string
    paymentMethod: string // e.g. "Stripe", "Razorpay"
  }
  jurisdiction: string // e.g. "Mumbai, India"
  signature: {
    brandSignatoryName: string
    influencerSignatoryName: string
  }
}

/**
 * Creates a DocuSeal contract submission using the provided contract data
 * @param contractData The contract input data
 * @returns The created submission response from DocuSeal
 */
export const submitContract = async (contractData: ContractInput) => {
  // Format deliverables as a bulleted list string
  const deliverablesText = contractData.deliverables.map((item) => `• ${item}`).join('\n')

  // Format compensation amount with currency
  const formattedAmount = `${contractData.compensation.currency} ${contractData.compensation.amount}`

  // Common fields for both submitters (read-only for both)/
  const commonFields = [
    {
      name: FieldNames.campaignTitle,
      default_value: contractData.campaignTitle,
      readonly: true
    },
    {
      name: FieldNames.campaignDescription,
      default_value: contractData.campaignDescription,
      readonly: true
    },
    {
      name: FieldNames.startDate,
      default_value: contractData.startDate,
      readonly: true
    },
    {
      name: FieldNames.endDate,
      default_value: contractData.endDate,
      readonly: true
    },
    {
      name: FieldNames.jurisdiction,
      default_value: contractData.jurisdiction,
      readonly: true
    },
    {
      name: FieldNames.compensationAmount,
      default_value: formattedAmount,
      readonly: true
    },
    {
      name: FieldNames.paymentMethod,
      default_value: contractData.compensation.paymentMethod,
      readonly: true
    }
  ]

  // Brand-specific fields (editable by brand only)
  const brandFields = [
    {
      name: FieldNames.brandName,
      default_value: contractData.brand.name,
      readonly: false
    },
    {
      name: FieldNames.brandContactPerson,
      default_value: contractData.brand.contactPerson,
      readonly: false
    },
    {
      name: FieldNames.brandEmail,
      default_value: contractData.brand.email,
      readonly: false
    },
    {
      name: FieldNames.deliverables,
      default_value: deliverablesText,
      readonly: false
    },
    {
      name: FieldNames.brandSignatoryName,
      default_value: contractData.signature.brandSignatoryName,
      readonly: false
    }
  ]

  // Influencer-specific fields (editable by influencer only)
  const influencerFields = [
    {
      name: FieldNames.influencerName,
      default_value: contractData.influencer.name,
      readonly: false
    },
    {
      name: FieldNames.instagramHandle,
      default_value: contractData.influencer.instagramHandle,
      readonly: false
    },
    {
      name: FieldNames.influencerEmail,
      default_value: contractData.influencer.email,
      readonly: false
    },
    {
      name: FieldNames.phone,
      default_value: contractData.influencer.phone || '',
      readonly: false
    },
    {
      name: FieldNames.influencerSignatoryName,
      default_value: contractData.signature.influencerSignatoryName,
      readonly: false
    }
  ]

  // Create submission with brand and influencer as submitters
  const submission = await docuseal.createSubmission({
    template_id: DOCUSEAL_TEMPLATE_ID,
    order: 'random',
    submitters: [
      // Brand submitter
      {
        name: contractData.brand.contactPerson,
        email: contractData.brand.email,
        send_email: true,
        role: 'Brand',
        fields: [
          ...commonFields,
          ...brandFields,
          // Show influencer fields as read-only to brand
          ...influencerFields.map((field) => ({ ...field, readonly: true }))
        ]
      },
      // Influencer submitter
      {
        name: contractData.influencer.name,
        email: contractData.influencer.email,
        send_email: true,
        role: 'Influencer',
        fields: [
          //   ...commonFields,
          //   // Show brand fields as read-only to influencer
          //   ...brandFields.map((field) => ({ ...field, readonly: true })),
          //   ...influencerFields
        ]
      }
    ]
  })

  return submission
}

// Example usage:
// const contractData: ContractInput = {
//   campaignTitle: "Summer Fashion Collection",
//   campaignDescription: "Promote our new summer collection on Instagram",
//   startDate: "2025-06-15",
//   endDate: "2025-07-15",
//   brand: {
//     name: "FashionBrand",
//     contactPerson: "Jane Smith",
//     email: "jane@fashionbrand.com"
//   },
//   influencer: {
//     name: "John Influencer",
//     instagramHandle: "@johninfluencer",
//     email: "john@example.com",
//     phone: "+1234567890"
//   },
//   deliverables: [
//     "3 Instagram posts featuring the product",
//     "2 Instagram stories with swipe-up links",
//     "1 Instagram Reel of at least 30 seconds"
//   ],
//   compensation: {
//     currency: "USD",
//     amount: 1500,
//     paymentMethod: "Stripe"
//   },
//   jurisdiction: "Mumbai, India",
//   signature: {
//     brandSignatoryName: "Jane Smith",
//     influencerSignatoryName: "John Influencer"
//   }
// };
// const submission = await CreateContractSubmission(contractData);

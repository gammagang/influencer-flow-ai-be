import configs from '@/configs'
import docuseal from '@docuseal/api'
import { log } from './logger'

docuseal.configure({ key: configs.docuseal.apiKey, url: configs.docuseal.url })
const DOCUSEAL_TEMPLATE_ID = parseInt(configs.docuseal.templateId)

// Extract DocuSeal field type for type safety
type DocuSealField = {
  name: string
  default_value: string
  readonly?: boolean
}

// Field names map (must match exactly with DocuSeal template field names)
const FieldNames = {
  // Campaign fields
  campaignName: 'campaignName',
  campaignStartDate: 'campaignStartDate',
  campaignEndDate: 'campaignEndDate',

  // Brand fields
  brandName: 'brandName',
  brandContactPerson: 'brandContactPerson',
  brandEmail: 'brandEmail',
  deliverables: 'deliverables',
  compensation: 'compensation',
  brandSignature: 'brandSignature',
  brandSigningDate: 'brandSigningDate',

  // Creator fields (formerly Influencer)
  creatorName: 'creatorName',
  creatorInstaHandle: 'creatorInstaHandle',
  creatorEmail: 'creatorEmail',
  creatorSignature: 'creatorSignature',
  creatorSigningDate: 'creatorSigningDate'
} as const

export type ContractInput = {
  campaign: {
    name: string
    startDate: string // ISO format: "YYYY-MM-DD"
    endDate: string // ISO format: "YYYY-MM-DD"
  }
  brand: {
    name: string
    contactPerson: string
    email: string
  }
  creator: {
    name: string
    instaHandle: string
    email: string
  }
  deliverables: string
  compensation: {
    currency: string
    amount: number | string
    paymentMethod: string
  }
}

/**
 * Creates a DocuSeal contract submission using the provided contract data
 * @param contractData The contract input data
 * @returns The created submission response from DocuSeal
 */
export const sendContractViaEmail = async (contractData: ContractInput) => {
  // Format deliverables as a bulleted list string
  const deliverablesText = contractData.deliverables

  // Format compensation amount with currency
  const formattedAmount = `${contractData.compensation.currency} ${contractData.compensation.amount}`

  // Brand-specific fields
  const brandFields: DocuSealField[] = [
    { name: FieldNames.campaignName, default_value: contractData.campaign.name },
    { name: FieldNames.campaignStartDate, default_value: contractData.campaign.startDate },
    { name: FieldNames.campaignEndDate, default_value: contractData.campaign.endDate },
    { name: FieldNames.brandName, default_value: contractData.brand.name },
    { name: FieldNames.brandContactPerson, default_value: contractData.brand.contactPerson },
    { name: FieldNames.brandEmail, default_value: contractData.brand.email },
    { name: FieldNames.deliverables, default_value: deliverablesText },
    { name: FieldNames.compensation, default_value: formattedAmount }
  ]

  // Creator-specific fields
  const creatorFields: DocuSealField[] = [
    { name: FieldNames.creatorName, default_value: contractData.creator.name },
    { name: FieldNames.creatorInstaHandle, default_value: contractData.creator.instaHandle },
    { name: FieldNames.creatorEmail, default_value: contractData.creator.email }
  ]

  const submitters = [
    // Brand submitter
    {
      name: contractData.brand.contactPerson,
      email: contractData.brand.email,
      send_email: true,
      role: 'Brand',
      fields: [
        ...brandFields,
        // Show creator fields as read-only to brand
        ...creatorFields.map((field) => ({ ...field, readonly: true }))
      ]
    },
    // Creator submitter
    {
      name: contractData.creator.name,
      email: contractData.creator.email,
      send_email: true,
      role: 'Creator',
      fields: [
        // Show brand fields as read-only to creator
        ...brandFields.map((field) => ({ ...field, readonly: true })),
        ...creatorFields
      ]
    }
  ]

  log.info('Creating DocuSeal submission with fields:', submitters)

  // Create submission with brand and creator as submitters
  const submission = await docuseal.createSubmission({
    template_id: DOCUSEAL_TEMPLATE_ID,
    order: 'preserved',
    submitters
  })

  return submission
}

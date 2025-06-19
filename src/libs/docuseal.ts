import configs from '@/configs'
import docuseal from '@docuseal/api'
import { log } from './logger'

docuseal.configure({ key: configs.docuseal.apiKey, url: configs.docuseal.url })
const DOCUSEAL_TEMPLATE_ID = parseInt(configs.docuseal.templateId)

type DocuSealField = {
  name: string
  default_value: string
  readonly?: boolean
}

// Field names map (must match exactly with DocuSeal template field names)
/**
 * @docs Refer [Docuseal Prod](https://docuseal-0deg.onrender.com/templates/1/edit ) for exact field names
 */
const FieldNames = {
  // Brand fields
  campaignName: 'campaignName',
  campaignStartDate: 'campaignStartDate',
  campaignEndDate: 'campaignEndDate',
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
  contractId: number
  campaign: {
    name: string
    startDate: string
    endDate: string
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
  const contractId = contractData.contractId.toString()

  // Brand-specific fields
  const brandFields: DocuSealField[] = [
    { name: FieldNames.campaignName, default_value: contractData.campaign.name, readonly: true },
    {
      name: FieldNames.campaignStartDate,
      default_value: contractData.campaign.startDate,
      readonly: true
    },
    {
      name: FieldNames.campaignEndDate,
      default_value: contractData.campaign.endDate,
      readonly: true
    },
    { name: FieldNames.brandName, default_value: contractData.brand.name },
    {
      name: FieldNames.brandContactPerson,
      default_value: contractData.brand.contactPerson
    },
    { name: FieldNames.brandEmail, default_value: contractData.brand.email },
    { name: FieldNames.deliverables, default_value: contractData.deliverables },
    {
      name: FieldNames.compensation,
      default_value: contractData.compensation.amount.toString()
    }
  ]

  // Creator-specific fields
  const creatorFields: DocuSealField[] = [
    { name: FieldNames.creatorName, default_value: contractData.creator.name },
    { name: FieldNames.creatorInstaHandle, default_value: contractData.creator.instaHandle },
    { name: FieldNames.creatorEmail, default_value: contractData.creator.email }
  ]

  log.info('fields:', { brandFields, creatorFields })

  const submitters = [
    {
      name: contractData.brand.contactPerson,
      email: contractData.brand.email,
      send_email: false, // The brand owner can sign directly from the app
      role: 'Brand',
      fields: brandFields,
      metadata: { contractId }
    },
    {
      name: contractData.creator.name,
      // email: contractData.creator.email,
      email: 'gammagang100x@gmail.com', // For testing purposes, use a fixed email
      send_email: true,
      role: 'Creator',
      fields: creatorFields,
      metadata: { contractId }
    }
  ]

  log.info('Creating DocuSeal submission with fields:', submitters)

  // Create submission with brand and creator as submitters
  const submission = await docuseal.createSubmission({
    template_id: DOCUSEAL_TEMPLATE_ID,
    send_email: true,
    order: 'preserved',
    submitters
  })

  return submission
}

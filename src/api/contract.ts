import { sql } from '@/libs/db'
import { log } from '@/libs/logger'
import { DocuSealWebhookPayload } from '@/routes/public/validate'
import { CreateSubmissionResponse } from '@docuseal/api'

/**
 * Interface for contract data
 */
export interface Contract {
  id: number
  campaign_creator_id: number
  pdf_url: string | null
  status: DocuSealWebhookPayload['event_type'] | 'contract.created'
  sent_at: Date
  signed_by_brand_at: Date | null
  signed_by_creator_at: Date | null
  meta: { docusealSubmission?: CreateSubmissionResponse }
}

/**
 * Creates a new contract in the database
 */
export async function createContract(data: {
  campaign_creator_id: number
  status: string
  // docusealSubmission: CreateSubmissionResponse
}): Promise<Contract> {
  // const brandPdfUrl = data.docusealSubmission.submitters[0]?.embed_src ?? ''
  // // Store the docusealSubmission in meta object
  // const meta = {
  //   docusealSubmission: data.docusealSubmission
  // } as any

  const result = await sql<Contract[]>`
      INSERT INTO contract (
        campaign_creator_id,
        pdf_url,
        status,
        sent_at
      ) VALUES (
        ${data.campaign_creator_id},
        ${'TBD'},
        ${data.status},
        NOW()
      )
      RETURNING *
    `

  return result[0]
}

/**
 * Gets a contract by id
 */
export async function getContractById(id: number | string) {
  try {
    const result = await sql<Contract[]>`
      SELECT * FROM contract
      WHERE id = ${id}
    `

    return result.length ? result[0] : null
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Error getting contract with ID ${id}:`, error)
    throw new Error(`Failed to get contract: ${errorMessage}`)
  }
}

/**
 * Gets a contract by submissionId
 */
export async function getContractBySubmissionId(submissionId: number | string) {
  // Convert submissionId to string for consistent comparison
  const submissionIdStr = submissionId.toString()

  const result = await sql<Contract[]>`
      SELECT * FROM contract c
      WHERE c.meta->'docusealSubmission'->>'id' = ${submissionIdStr}
    `
  return result.length ? result[0] : null
}

/**
 * Gets contracts by campaign creator id
 */
export async function getContractsByCampaignCreatorId(campaignCreatorId: number | string) {
  try {
    return await sql<Contract[]>`
      SELECT * FROM contract
      WHERE campaign_creator_id = ${campaignCreatorId}
      ORDER BY sent_at DESC
    `
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Error getting contracts for campaign creator ${campaignCreatorId}:`, error)
    throw new Error(`Failed to get contracts: ${errorMessage}`)
  }
}

/**
 * Updates a contract's status
 */
export async function updateContractStatus(
  id: string,
  status: DocuSealWebhookPayload['event_type'],
  role: 'Brand' | 'Creator'
  // docs: { name: string; url: string }[] = []
) {
  const currentContract = await getContractById(id)
  if (!currentContract) throw new Error(`Contract with ID ${id} not found`)

  const isSigned = status === 'form.completed' || status === 'submission.completed'

  const result = await sql<Contract[]>`
      UPDATE contract
      SET status = ${status},
          signed_by_brand_at = ${role === 'Brand' && isSigned ? sql`NOW()` : null},
          signed_by_creator_at = ${role === 'Creator' && isSigned ? sql`NOW()` : null}
      WHERE id = ${id}
      RETURNING *
    `

  return result[0]
}
/**
 * Updates a contract submission's status
 */
export async function updateSubmissionStatus(
  submissionId: string | number,
  status: DocuSealWebhookPayload['event_type'],
  role: 'Brand' | 'Creator'
) {
  const contract = await getContractBySubmissionId(submissionId)
  if (!contract) throw new Error(`Contract with submission ID ${submissionId} not found`)

  const isSigned = status === 'form.completed' || status === 'submission.completed'

  const result = await sql<Contract[]>`
      UPDATE contract
      SET status = ${status},
          signed_by_brand_at = ${role === 'Brand' && isSigned ? sql`NOW()` : null},
          signed_by_creator_at = ${role === 'Creator' && isSigned ? sql`NOW()` : null}
      WHERE id = ${contract.id}
      RETURNING *
    `

  return result[0]
}

export async function addDocusealSubmissionToContract(
  id: number,
  docusealSubmission: CreateSubmissionResponse
) {
  const currentContract = await getContractById(id)
  if (!currentContract) throw new Error(`Contract with ID ${id} not found`)

  const result = await sql<Contract[]>`
      UPDATE contract
      SET 
        meta = ${sql.json({ docusealSubmission } as any)},
        pdf_url = ${docusealSubmission.submitters[0]?.embed_src ?? ''}
      WHERE id = ${id}
      RETURNING *
    `

  return result[0]
}

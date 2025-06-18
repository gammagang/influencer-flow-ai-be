import { sql } from '@/libs/db'
import { log } from '@/libs/logger'
import { CreateSubmissionResponse } from '@docuseal/api'

/**
 * Interface for contract data
 */
export interface Contract {
  id: number
  campaign_creator_id: number
  pdf_url: string | null
  status: string
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
        sent_at,
        meta
      ) VALUES (
        ${data.campaign_creator_id},
        "",
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
export async function getContractById(id: number) {
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
 * Gets contracts by campaign creator id
 */
export async function getContractsByCampaignCreatorId(campaignCreatorId: number) {
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
export async function updateContractStatus(id: number, status: string) {
  try {
    const result = await sql<Contract[]>`
      UPDATE contract
      SET status = ${status},
          signed_by_brand_at = ${status === 'signed_by_brand' ? sql`NOW()` : null},
          signed_by_creator_at = ${status === 'signed_by_creator' ? sql`NOW()` : null}
      WHERE id = ${id}
      RETURNING *
    `

    return result.length ? result[0] : null
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Error updating contract status for ID ${id}:`, error)
    throw new Error(`Failed to update contract status: ${errorMessage}`)
  }
}

/**
 * Updates contract meta information
 */
export async function addDocusealSubmissionToContract(
  id: number,
  docusealSubmission: CreateSubmissionResponse
) {
  const currentContract = await getContractById(id)
  if (!currentContract) throw new Error(`Contract with ID ${id} not found`)

  const result = await sql<Contract[]>`
      UPDATE contract
      SET meta = ${sql.json({ docusealSubmission } as any)}
      WHERE id = ${id}
      RETURNING *
    `

  return result[0]
}

/**
 * Marks a contract as signed by brand or creator
 */
export async function markContractSigned(id: number, signedBy: 'brand' | 'creator') {
  try {
    // const fieldName = signedBy === 'brand' ? 'signed_by_brand_at' : 'signed_by_creator_at'

    let query
    if (signedBy === 'brand') {
      query = sql<Contract[]>`
        UPDATE contract
        SET signed_by_brand_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `
    } else {
      query = sql<Contract[]>`
        UPDATE contract
        SET signed_by_creator_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `
    }

    const result = await query

    // If both parties have signed, update status to 'completed'
    const contract = result.length ? result[0] : null

    if (contract && contract.signed_by_brand_at && contract.signed_by_creator_at) {
      await updateContractStatus(id, 'completed')
      return await getContractById(id)
    }

    return contract
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Error marking contract ${id} as signed by ${signedBy}:`, error)
    throw new Error(`Failed to mark contract as signed: ${errorMessage}`)
  }
}

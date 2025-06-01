import { sql } from '@/libs/db'
import { CreateCampaignReq } from '@/routes/campaign/validate'

// This will contain the db calls to create, get, update campaign details

export async function createCampaign(campaign: CreateCampaignReq, companyId: string) {
  // For MVP, using a dummy company ID

  // Extract basic campaign fields
  const { name, description, startDate, endDate, ...metaFields } = campaign

  // Store additional fields in meta column
  const meta = {
    targetAudience: {
      ageRange: metaFields.ageRange,
      gender: metaFields.gender,
      interests: metaFields.interests,
      location: metaFields.location
    },
    deliverables: metaFields.deliverables,
    contentGuidelines: metaFields.contentGuidelines,
    budget: {
      total: metaFields.totalBudget,
      perCreator: metaFields.budgetPerCreator,
      paymentModel: metaFields.paymentModel
    },
    creatorCriteria: {
      followerRange: metaFields.followerRange,
      minEngagement: metaFields.minEngagement
    }
  }

  const result = await sql`
    INSERT INTO campaign (
      name,
      description,
      start_date,
      end_date,
      company_id,
      state,
      meta
    ) VALUES (
      ${name},
      ${description || null},
      ${startDate},
      ${endDate},
      ${companyId},
      'active',
      ${JSON.stringify(meta)}
    )
    RETURNING *
  `

  return result[0]
}

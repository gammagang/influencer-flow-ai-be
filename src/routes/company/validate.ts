import { z } from 'zod'

export const UpdateCompanyMeReqSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional() // Assuming website might be updated here too
})

export type UpdateCompanyMeReq = z.infer<typeof UpdateCompanyMeReqSchema>

export const CreateCompanyReqSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  website: z.string().url().optional()
})

export type CreateCompanyReq = z.infer<typeof CreateCompanyReqSchema>

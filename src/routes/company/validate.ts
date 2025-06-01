import { z } from 'zod'

export const UpdateCompanyMeReqSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional(),
  category: z.string().optional()
})

export type UpdateCompanyMeReq = z.infer<typeof UpdateCompanyMeReqSchema>

export const CreateCompanyReqSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  website: z.string().url({ message: 'Valid website URL is required' }),
  category: z.string().min(1, { message: 'Category is required' }),
  description: z.string().optional(),
  phone: z.string().optional()
})

export type CreateCompanyReq = z.infer<typeof CreateCompanyReqSchema>

export const AnalyzeWebsiteReqSchema = z.object({
  websiteUrl: z.string().url({ message: 'Valid website URL is required' })
})

export type AnalyzeWebsiteReq = z.infer<typeof AnalyzeWebsiteReqSchema>

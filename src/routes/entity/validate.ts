import { z } from 'zod'

export const CreateUserReqSchema = z.object({
  name: z.string().min(2).max(20),
  age: z.number().min(18),
  email: z.string().email()
})

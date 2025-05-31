export const Messages = {
  Success: 'success'
} as const
export type Messages = (typeof Messages)[keyof typeof Messages]

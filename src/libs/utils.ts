// Helper function to format date in YYYY-MM-DD format
export const formatDate = (date: string | null) => {
  if (!date) return new Date().toLocaleDateString('en-GB')

  try {
    return new Date(date).toLocaleDateString('en-GB')
  } catch (e) {
    console.error('Error formatting date:', e)
    return new Date().toLocaleDateString('en-GB')
  }
}

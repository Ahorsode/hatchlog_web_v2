export function toLocalDateTimeInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function parseFinancialLogDate(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Please choose a valid financial log date.')
  }

  return parsed
}

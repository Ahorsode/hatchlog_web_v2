/** Shared first-login password for workers invited via web, desktop, or mobile. */
export const WORKER_PLACEHOLDER_PASSWORD = '123456'

export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  let cleaned = phone.replace(/[^\d+]/g, '')

  if (cleaned.startsWith('0') && !cleaned.startsWith('+')) {
    cleaned = '+233' + cleaned.substring(1)
  } else if (!cleaned.startsWith('+') && cleaned.length >= 9) {
    cleaned = '+' + cleaned
  }

  return cleaned
}

export function buildPhoneLookupCandidates(phone: string): string[] {
  const candidates: string[] = []
  const add = (value: string) => {
    const candidate = value.trim()
    if (candidate && !candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  const trimmed = phone.trim()
  add(trimmed)

  const normalized = normalizePhoneNumber(trimmed)
  if (normalized) add(normalized)

  const digits = trimmed.replace(/[^\d]/g, '')
  add(digits)
  if (digits) add(`+${digits}`)

  if (digits.startsWith('0') && digits.length > 1) {
    const international = `233${digits.substring(1)}`
    add(international)
    add(`+${international}`)
  }

  if (digits.startsWith('233') && digits.length > 3) {
    add(`0${digits.substring(3)}`)
    add(`+${digits}`)
  }

  return candidates
}

export const MIN_PASSWORD_LENGTH = 4
export const MAX_PASSWORD_LENGTH = 128

const BANNED_PASSWORDS = new Set([
  '123456',
  'password',
  '12345678',
  'qwerty123',
])

export function isBannedPassword(password: string) {
  return BANNED_PASSWORDS.has(password.trim().toLowerCase())
}

export function passwordPolicyError(password: string | null | undefined) {
  if (!password) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
  }

  if (isBannedPassword(password)) {
    return 'This password is too common. Please choose a stronger password.'
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`
  }

  return null
}

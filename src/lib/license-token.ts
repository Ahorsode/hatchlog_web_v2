import { createHmac } from 'crypto'

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeHardwareFingerprint(hardwareId: string) {
  return hardwareId.trim().replace(/\s+/g, '').toUpperCase()
}

export function normalizeDesktopFarmId(farmId: string) {
  return farmId.trim().replace(/\s+/g, '').toUpperCase()
}

function getLicenseTokenSecret() {
  const secret = process.env.HATCHLOG_LICENSE_TOKEN_SECRET

  if (!secret || secret.length < 16) {
    throw new Error('Missing HATCHLOG_LICENSE_TOKEN_SECRET for license token generation')
  }

  return secret
}

function toUtcDateStamp(date: Date) {
  return date.toISOString().slice(0, 10)
}

function encodeReadableDigest(bytes: Buffer, length = 12) {
  let output = ''
  let bitBuffer = 0
  let bitCount = 0

  for (const byte of bytes) {
    bitBuffer = (bitBuffer << 8) | byte
    bitCount += 8

    while (bitCount >= 5 && output.length < length) {
      const index = (bitBuffer >> (bitCount - 5)) & 31
      output += TOKEN_ALPHABET[index]
      bitCount -= 5
    }

    if (output.length >= length) break
  }

  return output
}

function groupTokenBody(body: string) {
  return body.match(/.{1,4}/g)?.join('-') ?? body
}

export function generateActivationLicenseToken({
  hardwareId,
  targetExpiryDate,
  durationDays,
}: {
  hardwareId: string
  targetExpiryDate: Date
  durationDays: number
}) {
  const normalizedHardwareId = normalizeHardwareFingerprint(hardwareId)
  const expiryStamp = toUtcDateStamp(targetExpiryDate)
  const payload = `hatchlog-license-v1:${normalizedHardwareId}:${expiryStamp}`
  const digest = createHmac('sha256', getLicenseTokenSecret()).update(payload).digest()
  const tokenBody = groupTokenBody(encodeReadableDigest(digest))

  return `HL-${durationDays}D-${tokenBody}`
}

export function generateIssuedLicenseToken({
  hardwareId,
  desktopFarmId,
  targetExpiryDate,
  durationDays,
}: {
  hardwareId: string
  desktopFarmId: string
  targetExpiryDate: Date
  durationDays: number
}) {
  const normalizedHardwareId = normalizeHardwareFingerprint(hardwareId)
  const normalizedFarmId = normalizeDesktopFarmId(desktopFarmId)
  const expiryStamp = targetExpiryDate.toISOString()
  const payload = `hatchlog-manual-v1:${normalizedHardwareId}:${normalizedFarmId}:${expiryStamp}`
  const digest = createHmac('sha256', getLicenseTokenSecret()).update(payload).digest()
  const tokenBody = groupTokenBody(encodeReadableDigest(digest, 16))

  return `HL-${durationDays}D-${tokenBody}`
}

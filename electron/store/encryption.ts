import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const SALT_LENGTH = 16
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const keyPath = join(app.getPath('userData'), '.key')
  if (existsSync(keyPath)) {
    return readFileSync(keyPath)
  }
  const newKey = randomBytes(KEY_LENGTH)
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(keyPath, newKey)
  return newKey
}

export function encrypt(text: string): string {
  const key = getKey()
  const salt = randomBytes(SALT_LENGTH)
  const derivedKey = scryptSync(key, salt, KEY_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return salt.toString('hex') + iv.toString('hex') + authTag.toString('hex') + encrypted
}

export function decrypt(encryptedData: string): string {
  const key = getKey()
  const salt = Buffer.from(encryptedData.slice(0, SALT_LENGTH * 2), 'hex')
  const iv = Buffer.from(encryptedData.slice(SALT_LENGTH * 2, (SALT_LENGTH + IV_LENGTH) * 2), 'hex')
  const authTag = Buffer.from(encryptedData.slice((SALT_LENGTH + IV_LENGTH) * 2, (SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) * 2), 'hex')
  const encrypted = encryptedData.slice((SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) * 2)
  const derivedKey = scryptSync(key, salt, KEY_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// AES-256-GCM encryption for tokens at rest. Set TOKEN_ENC_KEY (any length — it's
// hashed to a 32-byte key). If unset, values are stored base64 (dev only) so the
// app still runs; production must set TOKEN_ENC_KEY.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const RAW = process.env.TOKEN_ENC_KEY || '';
const KEY = RAW ? createHash('sha256').update(RAW).digest() : null;
let warned = false;

/**
 * @param {string} plaintext
 * @returns {string}
 */
export function encrypt(plaintext) {
  if (!KEY) {
    if (!warned) {
      console.warn('[loop] TOKEN_ENC_KEY not set — secrets stored UNENCRYPTED (dev only).');
      warned = true;
    }
    return `plain:${Buffer.from(plaintext, 'utf8').toString('base64')}`;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * @param {string} value
 * @returns {string}
 */
export function decrypt(value) {
  if (value.startsWith('plain:')) return Buffer.from(value.slice(6), 'base64').toString('utf8');
  if (!KEY) throw new Error('TOKEN_ENC_KEY is required to decrypt stored installations');
  const [, ivB, tagB, ctB] = value.split(':');
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
}

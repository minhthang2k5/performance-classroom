import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
export const hashToken = value => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('base64url');
export function passwordVerifier(password) {
  const salt = crypto.randomBytes(16);
  const expected = crypto.scryptSync(password, salt, 32);
  return candidate => typeof candidate === 'string' && candidate.length <= 200 && crypto.timingSafeEqual(crypto.scryptSync(candidate, salt, 32), expected);
}
export function localAdminPassword(directory, configured) {
  if (configured) {
    if (configured.length < 8) throw new Error('ADMIN_PASSWORD cần ít nhất 8 ký tự.');
    return configured;
  }
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, 'local-admin.txt');
  if (!fs.existsSync(filename)) fs.writeFileSync(filename, `Lab-${crypto.randomBytes(6).toString('base64url')}\n`, { mode: 0o600 });
  return fs.readFileSync(filename, 'utf8').trim();
}

import { createHash } from 'node:crypto';
import { query } from './db';
export const adminTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export async function adminSessionActive(token: string) {
  return (await query('SELECT id FROM admin_sessions WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>NOW()', [adminTokenHash(token)])).rows.length === 1;
}
export async function revokeAdminSession(token: string) {
  await query('UPDATE admin_sessions SET revoked_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL', [adminTokenHash(token)]);
}

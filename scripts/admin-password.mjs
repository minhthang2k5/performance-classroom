import { fileURLToPath } from 'node:url';
import { localAdminPassword } from '../server/src/auth.mjs';
console.log(`Mật khẩu admin local: ${localAdminPassword(fileURLToPath(new URL('../server/data/',import.meta.url)),process.env.ADMIN_PASSWORD)}`);

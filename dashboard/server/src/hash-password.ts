#!/usr/bin/env node
/* Generate the value for DASHBOARD_PASSWORD_HASH.
 *
 *   node server/dist/hash-password.js 'your password here'
 *
 * Prints only the hash (saltHex:hashHex). Put that in .env.dashboard — never the
 * password itself. The format contains no `$`, so nothing in the docker/env
 * plumbing can mangle it.
 */

import { hashPassword } from './password';

function emit(password: string): void {
  if (!password) {
    console.error("usage: hash-password.js '<password>'   (or pipe it on stdin)");
    process.exit(64);
  }
  if (password.length < 12) {
    console.error('Refusing: use at least 12 characters. This will be internet-facing.');
    process.exit(65);
  }
  console.log(hashPassword(password));
}

const fromArgv = process.argv.slice(2).join(' ').trim();
if (fromArgv) {
  emit(fromArgv);
} else {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { buf += chunk; });
  process.stdin.on('end', () => emit(buf.trim()));
}

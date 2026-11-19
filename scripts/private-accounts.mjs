import { readFileSync } from 'node:fs';

export function readAccounts() {
  const file = new URL('../supabase/functions/member-login/.env.accounts.json', import.meta.url);
  return JSON.parse(readFileSync(file, 'utf8'));
}

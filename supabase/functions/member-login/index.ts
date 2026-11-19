import accounts from './.env.accounts.json' with { type: 'json' };
import { createLoginHandler } from './handler.js';

Deno.serve(createLoginHandler(accounts, (email: string, password: string) => {
  const key = Deno.env.get('SUPABASE_ANON_KEY') ||
    JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default;
  return fetch(new URL('/auth/v1/token?grant_type=password', Deno.env.get('SUPABASE_URL')), {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}));

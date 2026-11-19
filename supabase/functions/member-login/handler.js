const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Cache-Control': 'no-store',
};

export function createLoginHandler(accounts, authenticate) {
  return async function login(request) {
    const reply = (status, data = {}) => Response.json(data, { status, headers });
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'POST') return reply(405);
    const body = await request.json().catch(() => null);
    if (typeof body?.username !== 'string' || typeof body.password !== 'string' ||
        body.username.length > 256 || body.password.length > 4096) return reply(401);

    const username = body.username.normalize('NFC').trim();
    const account = accounts.find(entry => entry.username === username);
    try {
      const response = await authenticate(account?.email ?? 'unassigned@invalid.invalid', body.password);
      if (response.status === 429) return reply(429);
      if (response.status >= 500) return reply(503);
      if (!account || !response.ok) return reply(401);
      const { access_token, refresh_token } = await response.json();
      if (!access_token || !refresh_token) return reply(503);
      return reply(200, { access_token, refresh_token });
    } catch {
      return reply(503);
    }
  };
}

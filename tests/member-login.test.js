import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginHandler } from '../supabase/functions/member-login/handler.js';
import { signInMember } from '../src/member-login.js';

const accounts = [{ username: '가', email: 'a@example.invalid' }, { username: '나', email: 'b@example.invalid' }];
const request = username => new Request('https://example.test/login', {
  method: 'POST', body: JSON.stringify({ username, password: 'test-only' }),
});

test('both aliases reach their own Auth account and establish a client session', async () => {
  for (const { username, email } of accounts) {
    const tokens = { access_token: 'access', refresh_token: 'refresh' };
    const handler = createLoginHandler(accounts, (actualEmail, password) => {
      assert.equal(actualEmail, email);
      assert.equal(password, 'test-only');
      return Response.json({ ...tokens, user: { email } });
    });
    let stored;
    const client = {
      functions: { invoke: async (name, { body }) => {
        assert.equal(name, 'member-login');
        const response = await handler(request(body.username));
        assert.equal(response.status, 200);
        return { data: await response.json() };
      } },
      auth: { setSession: async data => { stored = data; return {}; } },
    };
    await signInMember(client, ' ' + username.normalize('NFD'), 'test-only');
    assert.deepEqual(stored, tokens);
  }
});

test('wrong password and unknown alias receive the same failure without tokens', async () => {
  const login = createLoginHandler(accounts, email => email === accounts[0].email
    ? Response.json({ message: 'bad password' }, { status: 400 })
    : Response.json({ access_token: 'unexpected', refresh_token: 'unexpected' }));
  for (const username of ['가', 'unknown']) {
    const response = await login(request(username));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {});
  }
});

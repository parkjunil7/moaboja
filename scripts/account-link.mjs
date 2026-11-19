import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { accounts } from '../src/accounts.js';
import './check-config.mjs';

const account = accounts.find(a => a.username === process.argv[2]);
if (!account) throw new Error('사용법: npm run account-link -- member-1 또는 member-2');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.APP_URL) throw new Error('.env 관리자 키와 APP_URL이 필요합니다.');
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const occupied = check(await admin.from('members').select('*').eq('slot', account.slot).maybeSingle());
let user;
if (occupied) {
  user = check(await admin.auth.admin.getUserById(occupied.user_id)).user;
  if (user.email !== account.email) throw new Error('다른 계정이 사용하는 자리입니다. 기존 계정을 교체하지 않습니다.');
} else {
  for (let page = 1; ; page++) {
    const { users } = check(await admin.auth.admin.listUsers({ page, perPage: 100 }));
    user = users.find(u => u.email === account.email);
    if (user || users.length < 100) break;
  }
  if (!user) user = check(await admin.auth.admin.createUser({ email: account.email, email_confirm: true })).user;
  check(await admin.from('members').insert({ slot: account.slot, user_id: user.id, name: account.name }));
}
const redirectTo = new URL('./?welcome=1', process.env.APP_URL).href;
const { properties } = check(await admin.auth.admin.generateLink({ type: 'recovery', email: account.email, options: { redirectTo } }));
const folder = resolve('artifacts', 'private');
await mkdir(folder, { recursive: true });
const path = resolve(folder, `${account.username}-비밀번호설정.html`);
// 앱이 직접 일회용 토큰을 검증하므로 기존 로그인 계정과 섞이지 않습니다.
// 토큰은 fragment에 넣어 GitHub Pages의 요청 URL/서버 로그에 전달하지 않습니다.
const setupUrl = new URL(redirectTo);
setupUrl.hash = new URLSearchParams({ setup_token: properties.hashed_token, setup_user: user.id }).toString();
const link = setupUrl.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
await writeFile(path, `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><title>모아보자 비밀번호 설정</title><body style="font-family:sans-serif;max-width:420px;margin:80px auto;padding:24px"><h1>${account.username}</h1><p>아래 버튼에서 본인만의 비밀번호를 설정하세요.</p><p><a rel="noreferrer" href="${link}">모아보자 비밀번호 설정</a></p><p>한 번만 쓸 수 있는 링크입니다. 만료되면 관리자가 다시 발급할 수 있어요. 이 파일은 해당 계정 주인에게만 전달하세요.</p></body></html>`, { mode: 0o600 });
console.log(`${account.username}: 계정 연결 완료. 비밀번호 설정 파일: ${path}`);

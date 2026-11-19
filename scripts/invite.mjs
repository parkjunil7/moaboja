import { createClient } from '@supabase/supabase-js';
import './check-config.mjs';
const [slotArg, email, name] = process.argv.slice(2);
const slot = Number(slotArg);
if (![1, 2].includes(slot) || !email?.includes('@') || !name) throw new Error('사용법: npm run invite -- 1 이메일 표시이름 (두 번째 멤버는 2)');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.APP_URL) throw new Error('.env의 관리자 키와 APP_URL이 필요합니다.');
const client = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: occupied, error: readError } = await client.from('members').select('slot').eq('slot',slot).maybeSingle();
if (readError) throw new Error(readError.message);
if (occupied) throw new Error('이미 사용 중인 멤버 자리입니다. 기존 계정을 교체하지 않습니다.');
// 기존 초대 후 멤버 INSERT만 실패한 경우에도 관리자 API로 계정을 찾아 재실행 가능.
let existing;
for (let page=1; ; page++) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
  if(error) throw new Error(error.message);
  existing = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if(existing || data.users.length < 100) break;
}
let user = existing;
if (!user) {
  const { data, error } = await client.auth.admin.inviteUserByEmail(email, { redirectTo: new URL('./?welcome=1',process.env.APP_URL.endsWith('/') ? process.env.APP_URL : process.env.APP_URL+'/').href });
  if (error) throw new Error(error.message);
  user = data.user;
}
const { error } = await client.from('members').insert({ slot, user_id: user.id, name });
if (error) throw new Error('멤버 등록 실패. 같은 명령을 다시 실행할 수 있습니다: '+error.message);
console.log(`${slot}번 멤버 등록 완료.${existing ? ' 기존 초대 계정을 연결했습니다.' : ' 초대 메일에서 비밀번호를 설정하세요.'}`);

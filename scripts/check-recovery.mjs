// 비밀번호를 변경하지 않고, 기존 계정 세션에서 대상 계정의 복구 인증을 검증합니다.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { accounts } from '../src/accounts.js';
import { verifyRecovery, recoveryError } from '../src/recovery.js';
import './check-config.mjs';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
const userClient=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,options);
const checked=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
try{
  const first=checked(await admin.auth.admin.generateLink({type:'magiclink',email:accounts[0].email}));
  checked(await userClient.auth.verifyOtp({type:'magiclink',token_hash:first.properties.hashed_token}));
  assert.equal(checked(await userClient.auth.getUser()).user.id,first.user.id);
  const recovery=checked(await admin.auth.admin.generateLink({type:'recovery',email:accounts[1].email}));
  const entry={token:recovery.properties.hashed_token,userId:recovery.user.id};
  assert.equal((await verifyRecovery(userClient,entry)).id,recovery.user.id);
  assert.equal(checked(await userClient.auth.getUser()).user.email,accounts[1].email);
  const ledger=checked(await userClient.rpc('get_ledger'));
  assert.equal(ledger.members.find(m=>m.user_id===recovery.user.id).name,'멤버2');
  await assert.rejects(verifyRecovery(userClient,entry),{message:recoveryError});
  console.log('기존 멤버1 세션 → 멤버2 복구 인증, 대상 멤버 확인, 링크 재사용 거부 통과. 비밀번호와 지출은 변경하지 않았습니다.');
}finally{
  await userClient.auth.signOut({scope:'local'});
}

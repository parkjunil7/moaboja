import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryEntry, verifyRecovery, recoveryError } from '../src/recovery.js';
const userId='22222222-2222-4222-8222-222222222222';
test('만료된 링크는 기존 로그인 재개보다 먼저 오류로 처리',()=>{
  assert.deepEqual(recoveryEntry('https://example.com/?welcome=1#error=access_denied&error_code=otp_expired'),{kind:'error'});
  assert.equal(recoveryEntry('https://example.com/?welcome=1').kind,'resume');
});
test('설정 링크는 일회용 토큰과 대상 계정을 함께 확인',async()=>{
  const entry=recoveryEntry(`https://example.com/?welcome=1#setup_token=one-use&setup_user=${userId}`);
  const client={auth:{verifyOtp:async params=>{assert.deepEqual(params,{token_hash:'one-use',type:'recovery'});return {data:{session:{},user:{id:userId}},error:null};}}};
  assert.equal((await verifyRecovery(client,entry)).id,userId);
});
test('소진한 토큰은 기존 세션으로 대체하지 않음',async()=>{
  await assert.rejects(verifyRecovery({auth:{verifyOtp:async()=>({data:{session:null,user:null},error:{code:'otp_expired'}})}},{token:'used',userId}),{message:recoveryError});
});
test('다른 계정 토큰이면 해당 세션을 종료하고 설정 차단',async()=>{
  let signedOut=false;
  const client={auth:{verifyOtp:async()=>({data:{session:{},user:{id:'other'}}}),signOut:async options=>{assert.deepEqual(options,{scope:'local'});signedOut=true;}}};
  await assert.rejects(verifyRecovery(client,{token:'wrong',userId}),/계정이 일치하지/);
  assert.ok(signedOut);
});

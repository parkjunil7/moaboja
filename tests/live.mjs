// 새 가계부 프로젝트에 두 초대 계정을 설정한 다음 실행하는 실제 API 통합 테스트.
// 2000년 1월에 테스트 내역을 만들고 finally에서 본 테스트의 UUID만 삭제합니다.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { accounts } from '../src/accounts.js';
import '../scripts/check-config.mjs';
const env=process.env;
const adminLink = process.argv.includes('--admin-link');
for(const name of adminLink ? ['SUPABASE_SERVICE_ROLE_KEY'] : ['TEST_USER_A_EMAIL','TEST_USER_A_PASSWORD','TEST_USER_B_EMAIL','TEST_USER_B_PASSWORD']) if(!env[name])throw new Error(`${name} 환경 변수가 필요합니다.`);
const options={auth:{persistSession:false,autoRefreshToken:false}};
const a=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,options),b=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,options);
async function call(client,name,args){const{data,error}=await client.rpc(name,args);if(error)throw new Error(error.message);return data;}
const expenseId=crypto.randomUUID(),transferId=crypto.randomUUID();let version=0,transferCreated=false;
try {
  for(const [index,client] of [a,b].entries()) {
    let result;
    if(adminLink) {
      const admin=createClient(env.VITE_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options);
      const {data,error}=await admin.auth.admin.generateLink({type:'magiclink',email:accounts[index].email});
      if(error)throw new Error(error.message);
      result=await client.auth.verifyOtp({token_hash:data.properties.hashed_token,type:'magiclink'});
    } else {
      const prefix=index===0?'A':'B';
      result=await client.auth.signInWithPassword({email:env[`TEST_USER_${prefix}_EMAIL`],password:env[`TEST_USER_${prefix}_PASSWORD`]});
    }
    if(result.error)throw new Error('테스트 계정 로그인 실패: '+result.error.message);
  }
  const data=await call(a,'get_ledger');
  assert.equal(data.members.length,2);
  assert.notEqual((await a.auth.getUser()).data.user.id,(await b.auth.getUser()).data.user.id,'서로 다른 두 계정을 입력하세요.');
  if(data.expenses.some(e=>e.spent_on.startsWith('2000-01'))||data.transfers.some(t=>t.month==='2000-01-01')) throw new Error('안전한 검증을 위해 2000년 1월에 기존 내역이 없어야 합니다.');
  const p={id:expenseId,version:0,spent_on:'2000-01-01',amount:60000,category_id:data.categories[0].id,item_id:'',description:'[자동 검증] 종료 시 삭제',payer:1,share1:30000,share2:30000};
  await call(a,'save_expense',{p});version=1;
  assert.ok((await call(b,'get_ledger')).expenses.some(e=>e.id===expenseId));
  assert.equal(Number(await call(b,'month_balance',{p_month:'2000-01-01'})),30000);
  await call(b,'save_expense',{p:{...p,version,share1:10000,share2:50000}});version=2;
  assert.equal(Number(await call(a,'month_balance',{p_month:'2000-01-01'})),50000);
  await call(b,'save_transfer',{p:{id:transferId,month:'2000-01-01',sent_on:'2000-01-02',sender:2,amount:50000}});transferCreated=true;
  assert.equal(Number(await call(a,'month_balance',{p_month:'2000-01-01'})),0);
  assert.equal((await call(b,'get_ledger')).expenses.filter(e=>e.spent_on.startsWith('2000-01')).reduce((n,e)=>n+e.amount,0),60000);
  console.log('실제 두 계정 공유·반반·직접 부담·송금 분리 검증 통과');
}finally{
  try{
    if(transferCreated)await call(a,'delete_transfer',{p_id:transferId});
    if(version)await call(a,'delete_expense',{p_id:expenseId,p_version:version});
  }finally{await a.auth.signOut();await b.auth.signOut();}
}

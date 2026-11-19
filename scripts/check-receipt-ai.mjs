// 관리자 키는 사용자 세션 발급에만 사용. 영수증 요청은 실제 멤버 JWT로 호출합니다.
// 지출/송금 쓰기, 비밀번호 변경, 이메일 발송은 하지 않습니다.
import {createClient} from '@supabase/supabase-js';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY,adminKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url?.includes('gqttecguoftuwjanunry.supabase.co')||!key||!adminKey)throw new Error('가계부 전용 설정이 필요합니다.');
const imagePath=process.argv[2];if(!imagePath)throw new Error('테스트 영수증 파일 경로가 필요합니다.');
const admin=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:members,error:membersError}=await admin.from('members').select('user_id,slot').order('slot');
if(membersError||members.length!==2)throw new Error('멤버 조회 실패');
const count=async()=>{const {count,error}=await admin.from('expenses').select('id',{count:'exact',head:true});if(error)throw new Error('지출 건수 확인 실패');return count;};
const before=await count();
const endpoint=url+'/functions/v1/receipt-ai';
const anonymous=await fetch(endpoint,{headers:{apikey:key}});assert.equal(anonymous.status,401);
console.log('비로그인 요청 거부 확인');
for(const member of members){
  const {data:account,error:accountError}=await admin.auth.admin.getUserById(member.user_id);if(accountError)throw new Error('계정 조회 실패');
  const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:'magiclink',email:account.user.email});if(linkError)throw new Error('테스트 로그인 발급 실패');
  const user=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const {data:auth,error:authError}=await user.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});
    if(authError||auth.user.id!==member.user_id)throw new Error('테스트 로그인 검증 실패');
    const headers={apikey:key,Authorization:'Bearer '+auth.session.access_token,'Content-Type':'application/json'};
    const status=await fetch(endpoint,{headers});const statusBody=await status.json();
    assert.equal(status.status,200);assert.equal(statusBody.ready,true);console.log(`멤버 ${member.slot}: AI 연결 준비 확인`);
    if(member.slot===1){
      const file=await readFile(imagePath);const started=Date.now();
      const res=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({image:'data:image/png;base64,'+file.toString('base64'),consent:true,request_id:crypto.randomUUID()}),signal:AbortSignal.timeout(75000)});
      const result=await res.json();
      console.log(JSON.stringify({status:res.status,seconds:(Date.now()-started)/1000,result},null,2));
      assert.equal(res.status,200);assert.equal(result.draft.amount,30000);assert.equal(result.draft.spent_on,'2017-12-16');assert.match(result.draft.description,/킹콩/);
    }
  }finally{await user.auth.signOut({scope:'local'});}
}
assert.equal(await count(),before);console.log('실제 AI 원본 영수증 검증 통과 · 지출 건수 변경 없음');

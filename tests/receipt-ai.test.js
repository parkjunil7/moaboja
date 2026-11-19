import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createReceiptHandler,ReceiptError,normalizeAIReceipt,makeOpenAIRequest,extractResponse,validateImage} from '../supabase/functions/receipt-ai/core.js';
const sample={is_receipt:true,is_refund:false,currency:'KRW',spent_on:'2017-12-16',merchant:'킹콩부대찌개(마포광흥점)',amount:30000,category_hint:'dining',item_hint:'식당',evidence:'2017년12월16일 / 판매금액 30,000 / 신용카드 30,000',warnings:[]};
const body=()=>({consent:true,request_id:crypto.randomUUID(),image:'data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64')});
const response=v=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(v)}]}],usage:{input_tokens:1200,output_tokens:400}});
const request=(b=body(),extra={})=>new Request('https://example.com/receipt-ai',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://parkjunil7.github.io'},body:JSON.stringify(b),...extra});
test('AI 결과: 오래된 실제 지출일과 최종 결제액 보존, 불확실한 값/환불/외화 제외',()=>{
  const d=normalizeAIReceipt(sample,'2026-11-19');assert.equal(d.spent_on,'2017-12-16');assert.equal(d.amount,30000);assert.equal(d.description,sample.merchant);
  assert.equal(normalizeAIReceipt({...sample,spent_on:'2026-02-30'}).spent_on,'');
  assert.equal(normalizeAIReceipt({...sample,spent_on:'2999-01-01'},'2026-11-19').spent_on,'');
  for(const delta of [{is_refund:true},{currency:'USD'},{amount:2.5},{amount:-30000},{amount:1e12}])assert.equal(normalizeAIReceipt({...sample,...delta}).amount,'');
  assert.throws(()=>normalizeAIReceipt({...sample,is_receipt:false}));
});
test('API 요청: 서버 모델 고정, 저장 비활성, 구조화 출력과 추론 포함 출력 한도',()=>{
  const req=makeOpenAIRequest(body().image);assert.equal(req.store,false);assert.equal(req.model,'gpt-6.2-sol');assert.equal(req.max_output_tokens,1800);assert.equal(req.text.format.strict,true);assert.equal(req.input[0].content[1].detail,'high');
});
test('AI 거절/미완료/잘못된 JSON을 지출 초안으로 만들지 않음',()=>{
  assert.equal(extractResponse(response(sample)).amount,30000);
  assert.throws(()=>extractResponse({status:'incomplete'}));
  assert.throws(()=>extractResponse({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}));
  assert.throws(()=>extractResponse({status:'completed',output:[]}));
});
test('사진 검증: 동의, 요청 ID, 용량, base64와 실제 파일 헤더 확인',()=>{
  assert.equal(validateImage(body()).slice(0,14),'data:image/png');
  for(const delta of [{consent:false},{request_id:'bad'},{image:'https://example.com/pic'},{image:'data:image/png;base64,'+Buffer.from('not-an-image').toString('base64')},{image:'a'.repeat(6_000_001)}])assert.throws(()=>validateImage({...body(),...delta}));
});
test('미로그인/미멤버/출처 불일치 요청은 OpenAI 호출 전에 차단',async()=>{
  let calls=0;
  for(const status of [401,403]){
    const handle=createReceiptHandler({apiKey:'test',authenticate:async()=>{throw new ReceiptError(status,'denied');},reserve:async()=>{calls++;},fetchImpl:async()=>{calls++;}});
    assert.equal((await handle(request())).status,status);
  }
  const handle=createReceiptHandler({apiKey:'test',authenticate:async()=>{calls++;},reserve:async()=>{calls++;}});
  assert.equal((await handle(request(body(),{headers:{origin:'https://evil.test'}}))).status,403);assert.equal(calls,0);
});
test('키 미설정/호출 한도/동의 누락은 비용 발생 전 거부',async()=>{
  let calls=0;
  const base={authenticate:async()=>({id:'user'}),reserve:async()=>{},fetchImpl:async()=>{calls++;}};
  assert.equal((await createReceiptHandler({...base,apiKey:''})(request())).status,503);
  assert.equal((await createReceiptHandler({...base,apiKey:'test'})(request({...body(),consent:false}))).status,400);
  assert.equal((await createReceiptHandler({...base,apiKey:'test',reserve:async()=>{throw new ReceiptError(429,'limit');}})(request())).status,429);
  assert.equal(calls,0);
});
test('정상 호출은 한 번만 실행하고 초안 반환, 외부 오류/비밀 키를 응답에 노출하지 않음',async()=>{
  let count=0;
  const base={apiKey:'sensitive-key',authenticate:async()=>({id:'u'}),reserve:async()=>{},today:()=> '2026-11-19'};
  const handle=createReceiptHandler({...base,fetchImpl:async(url,options)=>{count++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer sensitive-key');return Response.json(response(sample));}});
  const res=await handle(request());assert.equal(res.status,200);assert.equal((await res.json()).draft.amount,30000);assert.equal(count,1);
  const error=await createReceiptHandler({...base,fetchImpl:async()=>new Response('sensitive-key',{status:401})})(request());assert.equal(error.status,503);assert.ok(!(await error.text()).includes('sensitive-key'));
});
test('AI 횟수 DB: 일반 사용자의 직접 접근 거부, 중복/일일/월간 한도와 미멤버 거부',async()=>{
  const db=new PGlite(),a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create table public.members(user_id uuid primary key);grant select on public.members to service_role;insert into public.members values('${a}'),('${b}');`);
    const filename=(await readdir(new URL('../supabase/migrations/',import.meta.url))).find(n=>n.endsWith('_receipt_ai_limits.sql'));
    await db.exec(await readFile(new URL('../supabase/migrations/'+filename,import.meta.url),'utf8'));
    for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>db.query('select public.reserve_receipt_ai($1,$2)',[a,crypto.randomUUID()]));await assert.rejects(()=>db.query('select * from private.receipt_ai_requests'));await db.exec('reset role');}
    await db.exec('set role service_role');
    const call=async(user,id=crypto.randomUUID())=>(await db.query('select public.reserve_receipt_ai($1,$2) as allowed',[user,id])).rows[0].allowed;
    assert.equal(await call('00000000-0000-4000-8000-000000000003'),false);
    const id=crypto.randomUUID();assert.equal(await call(a,id),true);assert.equal(await call(a,id),false);
    for(let i=1;i<20;i++)assert.equal(await call(a),true);
    assert.equal(await call(a),false);assert.equal(await call(b),true);
    await db.exec('reset role');
    await db.exec(`insert into private.receipt_ai_requests(request_id,user_id,created_at) select gen_random_uuid(),'${a}',date_trunc('month',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' from generate_series(1,279)`);
    await db.exec('set role service_role');assert.equal(await call(b),false);
  }finally{await db.close();}
});

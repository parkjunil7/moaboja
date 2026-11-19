import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',OUTSIDER='00000000-0000-4000-8000-000000000003';
test('PostgreSQL: 멤버 권한, 금액 무결성, 중복, 정산',async t=>{
  const db=new PGlite();
  try {
    // Supabase가 제공하는 auth 스키마/JWT 세션만 대체. 가계부 SQL은 원본 그대로 실행.
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      insert into auth.users values('${A}'),('${B}'),('${OUTSIDER}');`);
    for(const file of ['001_ledger.sql','002_snapshot.sql','003_category_updates.sql','004_exercise_items.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
    await db.query('insert into public.members(slot,user_id,name) values(1,$1,\'나\'),(2,$2,\'짝꿍\')',[A,B]);
    async function as(user,sql,args=[],role='authenticated') {
      await db.exec(`set role ${role}`);
      try {await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);return (await db.query(sql,args)).rows;} finally {await db.exec('reset role');}
    }
    const rpc=(user,name,p)=>as(user,`select public.${name}($1::jsonb) as result`,[JSON.stringify(p)]);
    const categories=(await db.query('select * from public.categories')).rows;
    const dining=categories.find(c=>c.report_key==='dining'),fixed=categories.find(c=>c.report_key==='fixed');
    const items=(await db.query('select * from public.items')).rows;
    const templates=(await db.query('select * from public.templates')).rows;
    await t.test('새 기본 분류 적용, 기존 항목 보존, 마이그레이션 재실행 안전',async()=>{
      assert.deepEqual(items.filter(i=>i.category_id===fixed.id&&i.active).map(i=>i.name).sort(),['관리비','주차비']);
      assert.equal(items.filter(i=>i.category_id===fixed.id&&!i.active).length,3);
      assert.ok(items.some(i=>i.name==='외부 주차료'));
      assert.ok(items.some(i=>i.name==='빙과(빙수)'&&i.category_id===dining.id));
      const exercise=categories.find(c=>c.name==='운동·배움');
      assert.deepEqual(items.filter(i=>i.category_id===exercise.id&&i.active).map(i=>i.name).sort(),['기타 수업료','수영비','헬스비']);
      assert.equal(categories.slice().sort((a,b)=>a.position-b.position).at(-1).name,'기타');
      for(const file of ['003_category_updates.sql','004_exercise_items.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
      assert.equal(Number((await db.query('select count(*) as n from public.items')).rows[0].n),items.length);
    });
    const expense={id:'10000000-0000-4000-8000-000000000001',version:0,spent_on:'2025-01-12',amount:60000,category_id:dining.id,item_id:'',description:'저녁 식사',payer:1,share1:30000,share2:30000,note:''};
    await t.test('두 계정이 같은 기록 조회, 다른 멤버 이름과 결제자 공유',async()=>{
      await rpc(A,'save_expense',expense);
      const a=await as(A,'select * from public.expenses'),b=await as(B,'select * from public.expenses');
      assert.equal(a.length,1);assert.deepEqual(a,b);
      const snap=await as(B,'select public.get_ledger() as data');assert.equal(snap[0].data.members.length,2);assert.equal(snap[0].data.expenses.length,1);
    });
    await t.test('미초대 계정의 직접 읽기는 0행, RPC 읽기/쓰기는 거부',async()=>{
      assert.equal((await as(OUTSIDER,'select * from public.expenses')).length,0);
      assert.equal((await as(OUTSIDER,'select * from public.members')).length,0);
      await assert.rejects(()=>as(OUTSIDER,'select public.get_ledger()'),/멤버/);
      await assert.rejects(()=>rpc(OUTSIDER,'save_expense',expense),/멤버/);
      await assert.rejects(()=>as(null,'select * from public.expenses',[],'anon'),/permission denied/);
      await assert.rejects(()=>as(null,'select public.get_ledger()',[],'anon'),/permission denied/);
    });
    await t.test('클라이언트의 직접 INSERT와 멤버 변경 거부, 3번째 멤버 불가',async()=>{
      await assert.rejects(()=>as(A,"update public.members set name='변조' where slot=2"),/permission denied/);
      await assert.rejects(()=>as(A,'delete from public.expenses'),/permission denied/);
      await assert.rejects(()=>db.query("insert into public.members values(3,$1,'제삼자')",[OUTSIDER]),/check constraint/);
    });
    await t.test('반반 DB 정산은 30,000원, 직접 지정하면 50,000원',async()=>{
      assert.equal(Number((await as(A,"select public.month_balance('2025-01-01') as due"))[0].due),30000);
      await rpc(B,'save_expense',{...expense,version:1,share1:10000,share2:50000});
      assert.equal(Number((await as(A,"select public.month_balance('2025-01-01') as due"))[0].due),50000);
    });
    await t.test('불일치·음수·소수·미등록 결제자·미래 지출 거부',async()=>{
      for(const override of [{share1:1000,share2:1000},{share1:-1,share2:60001},{amount:1.5,share1:1,share2:0.5},{payer:3},{spent_on:'2999-01-01'}])
        await assert.rejects(()=>rpc(A,'save_expense',{...expense,id:crypto.randomUUID(),...override}));
      await assert.rejects(()=>rpc(A,'save_expense',{...expense,id:crypto.randomUUID(),item_id:items.find(i=>i.category_id===fixed.id).id}),/foreign key/);
    });
    await t.test('부분 송금은 정산만 차감, 다른 월·총지출 불변',async()=>{
      await rpc(B,'save_transfer',{id:crypto.randomUUID(),month:'2025-01-01',sent_on:'2025-02-02',sender:2,amount:20000});
      assert.equal(Number((await as(A,"select public.month_balance('2025-01-01') as due"))[0].due),30000);
      assert.equal(Number((await as(A,"select public.month_balance('2025-02-01') as due"))[0].due),0);
      assert.equal(Number((await as(B,'select sum(amount) as total from public.expenses'))[0].total),60000);
    });
    await t.test('초과 송금, 반대 방향, 0원, 월 중간일 정산 거부',async()=>{
      for(const override of [{amount:30001},{sender:1},{amount:0},{month:'2025-01-02'},{sender:3}])
        await assert.rejects(()=>rpc(A,'save_transfer',{id:crypto.randomUUID(),month:'2025-01-01',sent_on:'2025-02-02',sender:2,amount:30000,...override}));
    });
    await t.test('완료 후 이중 송금 거부, 지출 총액 불변',async()=>{
      await rpc(A,'save_transfer',{id:crypto.randomUUID(),month:'2025-01-01',sent_on:'2025-02-02',sender:2,amount:30000});
      assert.equal(Number((await as(B,"select public.month_balance('2025-01-01') as due"))[0].due),0);
      await assert.rejects(()=>rpc(B,'save_transfer',{id:crypto.randomUUID(),month:'2025-01-01',sent_on:'2025-02-02',sender:2,amount:30000}),/남은 정산액/);
      assert.equal(Number((await as(A,'select sum(amount) as total from public.expenses'))[0].total),60000);
    });
    await t.test('반복 지출 월 중복 방지, 다음 달은 허용',async()=>{
      const template=templates[0]; const p={...expense,id:crypto.randomUUID(),spent_on:'2025-02-02',category_id:template.category_id,item_id:template.item_id,template_id:template.id};
      await rpc(A,'save_expense',p);
      await assert.rejects(()=>rpc(B,'save_expense',{...p,id:crypto.randomUUID(),spent_on:'2025-02-20'}),/같은 반복/);
      await rpc(B,'save_expense',{...p,id:crypto.randomUUID(),spent_on:'2025-03-02'});
    });
    await t.test('낡은 버전의 수정·삭제 방지',async()=>{
      await assert.rejects(()=>rpc(A,'save_expense',{...expense,version:1}),/다른 기기/);
      await assert.rejects(()=>as(B,'select public.delete_expense($1,1)',[expense.id]),/다른 기기/);
    });
    await t.test('분류 이름 수정 시 보고 기준 유지, 세부 항목 추가',async()=>{
      await as(A,"select public.save_setting('category',$1::jsonb)",[JSON.stringify({id:dining.id,name:'맛있는 시간'})]);
      const row=(await as(B,'select * from public.categories where id=$1',[dining.id]))[0];assert.equal(row.name,'맛있는 시간');assert.equal(row.report_key,'dining');
      await as(B,"select public.save_setting('item',$1::jsonb)",[JSON.stringify({category_id:dining.id,name:'베이커리'})]);
      assert.equal((await as(A,"select * from public.items where name='베이커리'")).length,1);
    });
    await t.test('정산 후 원지출 삭제 시 반환할 금액으로 재계산',async()=>{
      await as(A,'select public.delete_expense($1,2)',[expense.id]);
      assert.equal(Number((await as(B,"select public.month_balance('2025-01-01') as due"))[0].due),-50000);
    });
  } finally {await db.close();}
});

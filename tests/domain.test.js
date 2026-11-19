import test from 'node:test';
import assert from 'node:assert/strict';
import { split,summarize,previousMonth,today } from '../src/domain.js';
const expense=(amount,payer,share1,spent_on='2025-01-12')=>({amount,payer,share1,spent_on});
test('60,000원 반반: 결제자에게 30,000원 정산',()=>{
  const s=summarize([expense(60000,1,30000)],[],'2025-01');
  assert.equal(s.due,30000); assert.equal(s.sender,2); assert.equal(s.receiver,1); assert.equal(s.total,60000);
});
test('원 단위 직접 지정과 한 사람 부담',()=>{
  assert.deepEqual(split(60000,'custom',1,10000),[10000,50000]);
  assert.equal(summarize([expense(60000,1,10000)],[],'2025-01').due,50000);
  assert.deepEqual(split(30000,'payer',2),[0,30000]);
  assert.equal(summarize([expense(30000,2,0)],[],'2025-01').remaining,0);
  assert.equal(summarize([expense(30000,1,0)],[],'2025-01').due,30000);
});
test('홀수 반반, 소수와 잘못된 금액 거부',()=>{
  assert.deepEqual(split(10001,'equal',2),[5001,5000]);
  for(const amount of [0,-1,1.2,NaN,1000000001]) assert.throws(()=>split(amount,'equal',1));
  for(const first of [-1,60001,0.5]) assert.throws(()=>split(60000,'custom',1,first));
});
test('송금은 지정 월의 정산에만 적용하고 총지출 불변',()=>{
  const rows=[expense(60000,1,30000),expense(10000,2,5000,'2025-02-02')];
  const transfers=[{month:'2025-01-01',amount:10000,sender:2}];
  const jan=summarize(rows,transfers,'2025-01'),feb=summarize(rows,transfers,'2025-02');
  assert.equal(jan.total,60000);assert.equal(jan.shared,60000);assert.equal(jan.remaining,20000);
  assert.equal(feb.due,-5000);assert.equal(feb.total,10000);
  assert.deepEqual(jan.paid,[60000,0]);assert.deepEqual(jan.burden,[30000,30000]);
});
test('반대 방향 송금과 정산 후 지출 수정도 재계산',()=>{
  assert.equal(summarize([expense(60000,2,30000)],[{month:'2025-01-01',sender:1,amount:30000}],'2025-01').remaining,0);
  assert.equal(summarize([],[{month:'2025-01-01',sender:2,amount:30000}],'2025-01').due,-30000);
});
test('전월 연도 경계와 한국 날짜 형식',()=>{assert.equal(previousMonth('2026-01'),'2025-12');assert.match(today(),/^\d{4}-\d{2}-\d{2}$/);});

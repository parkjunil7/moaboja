import test from 'node:test';
import assert from 'node:assert/strict';
import {answerPlan,offsetMonth} from '../supabase/functions/ledger-chat/answer.js';

const rows=[['10-19','interest',80000],['11-10','interest',95000],['11-15','interest',5000],['11-15','fee',13000],['12-03','interest',40000]];
const ledger={categories:[{id:'c',report_key:'interest'}],items:[{id:'interest',name:'전세대출 이자'},{id:'fee',name:'대출 보험료·보증료'}],
  expenses:rows.map(([day,item_id,amount])=>({spent_on:'2026-'+day,item_id,amount,category_id:'c',payer:1,share1:amount/2})),
  transfers:[{month:'2026-11-01',sender:2,amount:9000}],members:[{slot:1,name:'가'},{slot:2,name:'나'}]};
const ask=(mode,month)=>answerPlan({mode,month,scope:'interest'},ledger,'2026-11-19');
test('monthly interest excludes fees, transfers and other months',()=>assert.match(ask('actual','2026-11'),/100,000원.*2건/));
test('forecast uses monthly sums for recorded months only and discloses the basis',()=>{
  const reply=ask('forecast','2026-12');
  for(const part of ['90,000원','80,000원','100,000원','2개월','오늘까지']) assert.ok(reply.includes(part));
  assert.match(ask('forecast','2026-09'),/기록이 부족/);
  assert.equal(offsetMonth('2026-12',1),'2027-01');
});
test('monthly settlement reflects transfers',()=>assert.match(ask('settlement','2026-11'),/나 → 가 47,500원/));

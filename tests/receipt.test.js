import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceipt,receiptCategory,similarReceipt,reviewReceipt,receiptScore} from '../src/receipt.js';
import {receiptProjection} from '../src/receipt-image.js';
const today='2026-11-19';
test('영수증의 실제 결제액을 세금·할인·받은 돈보다 우선한다',()=>{
  const r=parseReceipt('모아 식당\n2026-11-18 12:34\n공급가액 54,545\n부가세 5,455\n합 계 65,000\n할인금액 5,000\n결제금액 60,000\n받은돈 100,000\n거스름돈 40,000',today);
  assert.equal(r.amount,60000);assert.equal(r.spent_on,'2026-11-18');assert.equal(r.description,'모아 식당');assert.equal(r.categoryHint,'dining');assert.equal(r.itemHint,'식당');
});
test('상호 라벨과 다음 줄의 합계, 한국어 날짜를 인식',()=>{
  const r=parseReceipt('고객용 영수증\n상호명: 모아 카페\n2026년 11월 18일\n합계금액\n8,500원',today);
  assert.equal(r.description,'모아 카페');assert.equal(r.amount,8500);assert.equal(r.spent_on,'2026-11-18');assert.equal(r.itemHint,'카페');
});
test('날짜와 금액이 애매하면 임의의 숫자로 채우지 않음',()=>{
  const r=parseReceipt('모아 식당\n2026-11-18\n2026-11-17\n결제금액 60,000\n결제금액 50,000',today);
  assert.equal(r.spent_on,'');assert.equal(r.amount,'');assert.equal(r.warnings.length,2);
});
test('승인번호·전화번호·물품 단가를 총액으로 추측하지 않음',()=>{
  const r=parseReceipt('영수증\n사업자 123-45-67890\n전화 02-1234-5678\n승인번호 98765432\n아메리카노 4,500',today);
  assert.equal(r.amount,'');assert.equal(r.spent_on,'');
});
test('미래 및 존재하지 않는 날짜는 비워 두고 분류 추정 실패도 보존',()=>{
  assert.equal(parseReceipt('2027-01-01\n2026-02-30',today).spent_on,'');
  assert.equal(parseReceipt('모아상점\n합계 4500',today).categoryHint,null);
});
test('빙수/주차 분류와 비활성 항목 제외, 사용자 분류 이름 변경 지원',()=>{
  const r=parseReceipt('설빙\n합계 15,000',today);
  const categories=[{id:'d',name:'먹는 돈',report_key:'dining'}];
  assert.deepEqual(receiptCategory(r,categories,[{id:'ice',category_id:'d',name:'빙과(빙수)',active:true}]),{category_id:'d',item_id:'ice'});
  assert.equal(receiptCategory(r,categories,[{id:'ice',category_id:'d',name:'빙과(빙수)',active:false}]).item_id,'');
  assert.equal(parseReceipt('모아주차장\n결제금액 3,000',today).itemHint,'외부 주차료');
});
test('같은 날짜/금액/상호는 중복 후보, 다른 금액·날짜는 별개',()=>{
  const a={spent_on:today,amount:60000,description:'모아 식당'};
  assert.equal(similarReceipt([a],{...a,description:'모아식당'}),true);
  assert.equal(similarReceipt([a],{...a,amount:30000}),false);
  assert.equal(similarReceipt([a],{...a,spent_on:'2026-11-18'}),false);
});
test('취소 전표와 음수는 양수 지출로 자동 변환하지 않음',()=>{
  assert.equal(parseReceipt('모아 식당\n결제금액 -60,000',today).amount,'');
  assert.equal(parseReceipt('모아 식당\n승인 취소\n결제금액 60,000',today).amount,'');
});

test('깨진 OCR 문자열은 상호로 자동 입력하지 않음',()=>{
  const r=parseReceipt('| III / | nl Ab | i / ||\n| ihe | Hall it! | |\nly 11000',today);
  assert.equal(r.description,'');assert.equal(r.amount,'');assert.equal(r.spent_on,'');
});

test('낮은 신뢰도 결과는 날짜·금액도 비워서 확인 화면 진입을 차단할 수 있음',()=>{
  const text='모아 식당\n2026-11-18\n결제금액 60,000';
  const bad=reviewReceipt({text,confidence:20},today);
  assert.equal(bad.amount,'');assert.equal(bad.spent_on,'');assert.equal(bad.description,'');
  const poor=reviewReceipt({text:'트24 (편의점)\n2004-06-20 17:34\n총: Nx) LHS LL',confidence:55},today);
  assert.equal(poor.spent_on,'');assert.equal(poor.amount,'');assert.equal(poor.description,'');
  const partial=reviewReceipt({text,confidence:70},today);
  assert.equal(partial.amount,60000);assert.equal(partial.description,'');assert.equal(partial.categoryHint,null);
  assert.ok(receiptScore({text,confidence:90})>receiptScore({text,confidence:20}));
});

test('원근 보정은 사다리꼴 네 모서리와 직사각형 중앙을 정확히 대응',()=>{
  const points=[{x:150,y:100},{x:450,y:130},{x:500,y:700},{x:80,y:650}];
  const project=receiptProjection(points);
  [[0,0],[1,0],[1,1],[0,1]].forEach(([u,v],i)=>{const p=project(u,v);assert.ok(Math.abs(p.x-points[i].x)<1e-8);assert.ok(Math.abs(p.y-points[i].y)<1e-8);});
  assert.deepEqual(receiptProjection([{x:0,y:0},{x:200,y:0},{x:200,y:400},{x:0,y:400}])(.5,.5),{x:100,y:200});
});

test('모서리 교차·중첩·잘못된 좌표는 원근 보정 전에 거부',()=>{
  assert.throws(()=>receiptProjection([{x:0,y:0},{x:200,y:400},{x:200,y:0},{x:0,y:400}]));
  assert.throws(()=>receiptProjection([{x:0,y:0},{x:0,y:0},{x:200,y:400},{x:0,y:400}]));
  assert.throws(()=>receiptProjection([{x:NaN,y:0}]));
});

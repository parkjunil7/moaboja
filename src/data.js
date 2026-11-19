import { createClient } from '@supabase/supabase-js';
import { today, previousMonth, summarize } from './domain.js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key && !url.includes('wphdhiowhivefokivfql') && !key.startsWith('sb_secret_'));
export const client = configured ? createClient(url, key, { auth: { storageKey: 'sai-ledger-auth', detectSessionInUrl: true } }) : null;
export async function snapshot() {
  const { data: { user }, error } = await client.auth.getUser();
  if(error || !user) throw new Error('다시 로그인해 주세요.');
  const {data,error:loadError} = await client.rpc('get_ledger');
  if(loadError) throw new Error(loadError.message);
  if(!data.members.some(m => m.user_id === user.id)) throw new Error('이 가계부에 초대된 멤버가 아닙니다.');
  return {...data,user};
}
export async function rpc(name,args) {
  const {data,error} = await client.rpc(name,args);
  if(error) throw new Error(error.message);
  return data;
}
export function createDemo() {
  const groups = [
    ['이자·금융비용','interest',['전세대출 이자','마이너스통장 이자','대출 보험료·보증료','추가 이자']],
    ['고정 생활비','fixed',['관리비','주차비']],
    ['생활비','groceries',['생수','식재료·식품','과자','음료수','생필품']],
    ['경조사비','other',['축의금','부의금','경조사 선물']],['외식비','dining',['식당','배달','카페','빙과(빙수)']],
    ['교통비','other',['대중교통','택시','주유','통행료','외부 주차료']],['여가·여행비','other',['영화','공연','숙박','여행 중 지출']],['기타','other',['의료·약국','가전·가구']],
    ['운동·배움','other',['헬스비','수영비','기타 수업료']]
  ];
  const categories=groups.map((g,i)=>({id:`c${i}`,name:g[0],report_key:g[1],position:i}));
  const items=groups.flatMap((g,i)=>g[2].map((name,j)=>({id:`i${i}-${j}`,category_id:`c${i}`,name})));
  const month=today().slice(0,7), prev=previousMonth(month);
  const samples=[['전세대출 이자',320000,0,1,0],['이번 달 관리비',185000,1,2,0],['주말 장보기',64800,2,1,1],['함께 먹은 저녁',60000,4,1,0],['커피 두 잔',10800,4,2,2],['생필품 채우기',28400,2,2,4],['영화 데이트',30000,6,1,0],['이번 달 주차비',33000,1,1,1]];
  const expenses=samples.map((s,i)=>({id:crypto.randomUUID(),spent_on:month+`-${String(Math.min(i+1,Number(today().slice(-2)))).padStart(2,'0')}`,amount:s[1],category_id:`c${s[2]}`,item_id:`i${s[2]}-${s[4]}`,description:s[0],payer:s[3],share1:s[1]/2,note:'',version:1}));
  expenses.push(...[[2,110000],[4,95000]].map(([c,amount])=>({id:crypto.randomUUID(),spent_on:prev+'-12',amount,category_id:`c${c}`,description:'지난달 예시 내역',payer:1,share1:amount/2,note:'',version:1})));
  return {user:{id:'demo1'},members:[{slot:1,user_id:'demo1',name:'나'},{slot:2,user_id:'demo2',name:'짝꿍'}],categories,items,expenses,transfers:[],templates:[{id:'t1',name:'관리비',category_id:'c1',item_id:'i1-0'},{id:'t2',name:'주차비',category_id:'c1',item_id:'i1-1'}]};
}
export function demoMutation(data,name,args) {
  const p=args.p;
  if(name==='save_expense') {
    if(p.template_id && data.expenses.some(e=>e.template_id===p.template_id && e.spent_on.slice(0,7)===p.spent_on.slice(0,7) && e.id!==p.id)) throw new Error('같은 템플릿이 해당 월에 이미 등록되어 있습니다.');
    if(p.share1+p.share2!==p.amount) throw new Error('부담액 합계를 확인하세요.');
    const index=data.expenses.findIndex(e=>e.id===p.id);
    const value={...p,version:p.version+1};
    if(index<0) data.expenses.unshift(value); else data.expenses[index]=value;
  } else if(name==='delete_expense') data.expenses=data.expenses.filter(e=>e.id!==args.p_id);
  else if(name==='save_transfer') {
    const summary=summarize(data.expenses,data.transfers,p.month.slice(0,7));
    if(p.sender!==summary.sender || p.amount>summary.remaining || p.amount<1) throw new Error('남은 정산액을 확인하세요.');
    data.transfers.unshift(p);
  } else if(name==='delete_transfer') data.transfers=data.transfers.filter(t=>t.id!==args.p_id);
  else if(name==='save_setting') {
    const table={category:'categories',item:'items',template:'templates'}[args.p_kind];
    const old=data[table].find(e=>e.id===p.id);
    if(old) Object.assign(old,p); else data[table].push({report_key:'other',id:crypto.randomUUID(),...p});
  }
}

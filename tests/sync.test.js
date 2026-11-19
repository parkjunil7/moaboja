import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = name => readFileSync(new URL('../src/'+name, import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => {resolve=done;});
  return {promise,resolve};
};
const ledger = () => ({user:{id:'one',updated_at:'first'},categories:[{id:'a'},{id:'b'}],expenses:[{id:'expense',amount:100}],transfers:[],members:[],items:[],templates:[]});

function appHarness() {
  const effects={renders:0,travelLoads:0},listeners=new Map();
  let read=async()=>ledger();
  const node={open:false,addEventListener(){}};
  const context=vm.createContext({
    effects,configured:false,today:()=> '2026-11-19',
    snapshot:()=>read(),
    document:{querySelector:selector=>selector==='travel-expenses'?{load:async()=>{effects.travelLoads++;}}:node,addEventListener:(name,fn)=>listeners.set(name,fn)},
    setInterval(){},
  });
  vm.runInContext(source('app.js').replace('boot().catch(showError);','')+`
    render=()=>{effects.renders++;state.data.categories.reverse();};
    globalThis.app={refresh,login,state};
  `,context);
  return {...context.app,effects,setRead:fn=>{read=fn;}};
}

test('자동 갱신: 동일 데이터와 인증 메타데이터 변경은 화면을 유지하고 여행 지출도 확인',async()=>{
  const app=appHarness();
  await app.refresh();
  const current=app.state.data;
  app.setRead(async()=>({...ledger(),user:{id:'one',updated_at:'later'}}));
  await app.refresh();
  await app.refresh();
  assert.equal(app.effects.renders,1);
  assert.equal(app.effects.travelLoads,2);
  assert.equal(app.state.data,current);
});

test('자동 갱신: 지출 추가·수정·삭제와 정산 변경을 반영',async()=>{
  const app=appHarness();
  const data=ledger();
  app.setRead(async()=>structuredClone(data));
  await app.refresh();
  data.expenses.push({id:'new',amount:200});await app.refresh();
  data.expenses[0].amount=300;await app.refresh();
  data.expenses.pop();await app.refresh();
  data.transfers.push({id:'transfer',amount:50});await app.refresh();
  assert.equal(app.effects.renders,5);
  assert.equal(app.state.data.expenses[0].amount,300);
  await app.refresh();
  assert.equal(app.effects.renders,5);
});

test('자동 갱신: 늦게 끝난 이전 요청과 로그아웃 전 요청은 화면을 덮어쓰지 않음',async()=>{
  const app=appHarness(),pending=deferred();
  app.setRead(()=>pending.promise);
  const older=app.refresh();
  app.setRead(async()=>({...ledger(),expenses:[]}));
  await app.refresh();
  pending.resolve(ledger());await older;
  assert.equal(app.state.data.expenses.length,0);
  assert.equal(app.effects.renders,1);
  const logoutPending=deferred();
  app.setRead(()=>logoutPending.promise);
  const afterLogout=app.refresh();
  app.state.data=null;app.login();
  logoutPending.resolve(ledger());await afterLogout;
  assert.equal(app.state.data,null);
  app.setRead(async()=>ledger());await app.refresh();
  assert.equal(app.effects.renders,2);
});

class Element {
  children=[];
  open=false;
  get childElementCount(){return this.children.length;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  set textContent(text){this.text=text;this.children=[];}
}

function travelHarness() {
  let Component;
  const state={rows:[
    {id:2,trip_key:'sapporo-2026',title:'Flight',category:'항공',amount:100},
    {id:1,trip_key:'jeju-2026',title:'Hotel',category:'숙소',amount:200},
  ],session:{user:{id:'traveler'}},fetch:null};
  const query={select(){return this;},order(){return this;},range(){return this;},abortSignal(){return state.fetch?state.fetch():Promise.resolve({data:structuredClone(state.rows)});}};
  vm.runInNewContext(source('travel-expenses.js'),{
    HTMLElement:Element,AbortController,setTimeout,won:String,
    document:{createElement:()=>new Element()},
    customElements:{define:(_,component)=>{Component=component;}},
    createClient:()=>({auth:{
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
      getSession:async()=>({data:{session:state.session}}),
    },from:()=>query}),
  });
  return {state,create:()=>new Component()};
}

test('여행 갱신: 변경 없으면 기존 DOM과 펼침 상태를 그대로 유지',async()=>{
  const {create}=travelHarness(),view=create();
  await view.load();
  const body=view.children[2],details=view.tripDetails.get('sapporo-2026');
  details.open=true;
  await view.load();
  assert.equal(view.children[2],body);
  assert.equal(view.tripDetails.get('sapporo-2026'),details);
  assert.equal(details.open,true);
  assert.equal(view.tripDetails.get('jeju-2026').open,false);
});

test('여행 갱신: 요청 중에도 내용을 유지하고 사용자가 바꾼 펼침 상태로 새 금액을 표시',async()=>{
  const {create,state}=travelHarness(),view=create();
  await view.load();
  const body=view.children[2],pending=deferred();
  state.fetch=()=>pending.promise;
  const loading=view.load();
  await Promise.resolve();
  assert.equal(view.children[2],body);
  view.tripDetails.get('sapporo-2026').open=true;
  state.rows[0].amount=500;
  pending.resolve({data:structuredClone(state.rows)});await loading;
  assert.notEqual(view.children[2],body);
  assert.equal(view.tripDetails.get('sapporo-2026').open,true);
  assert.match(view.tripDetails.get('sapporo-2026').children[0].text,/500/);
});

test('여행 갱신: 화면 재생성·순서 변경·수동 접기·실패 후 재시도에도 상태 유지',async()=>{
  const {create,state}=travelHarness(),first=create();
  await first.load();first.tripDetails.get('sapporo-2026').open=true;
  first.disconnectedCallback();state.rows.reverse();
  const next=create();await next.load();
  assert.equal(next.tripDetails.get('sapporo-2026').open,true);
  next.tripDetails.get('sapporo-2026').open=false;
  next.tripDetails.get('jeju-2026').open=true;
  state.fetch=async()=>({error:new Error('offline')});await next.load();
  state.fetch=null;await next.load();
  assert.equal(next.tripDetails.get('sapporo-2026').open,false);
  assert.equal(next.tripDetails.get('jeju-2026').open,true);
});

test('여행 갱신: 삭제와 빈 목록 반영, 로그인 만료 시 기존 내역 제거',async()=>{
  const {create,state}=travelHarness(),view=create();
  await view.load();state.rows=[];await view.load();
  assert.equal(view.tripDetails.size,0);
  assert.match(view.children[2].text,/없어요/);
  state.session=null;await view.load();
  const login=view.children[2];
  assert.match(login.children[0].text,/로그인/);
  await view.load();assert.equal(view.children[2],login);
});

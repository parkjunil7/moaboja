import './travel-expenses.js';
import './style.css';
import { loginEmail } from './accounts.js';
import { recoveryEntry, verifyRecovery, recoveryError } from './recovery.js';
import { reviewReceipt, receiptCategory, similarReceipt } from './receipt.js';
import { won,today,previousMonth,split,summarize } from './domain.js';
import { client,configured,snapshot,rpc,createDemo,demoMutation } from './data.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',swap:'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',plus:'M12 5v14M5 12h14',arrow:'M5 12h14m-5-5 5 5-5 5',chevron:'m9 5 7 7-7 7',leaf:'M20 3C8 2 2 7 5 15c5 8 16 2 15-12ZM5 20l9-10',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',refresh:'M20 7a9 9 0 1 0 1 8M20 3v5h-5',wallet:'M3 6h16v15H3zM3 6V3h13M15 12h6v4h-6z',coffee:'M4 7h12v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM16 8h2a3 3 0 1 1 0 6h-2M7 2v2M12 2v2',home:'m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7',bag:'M4 7h16l-1 14H5ZM8 7V5a4 4 0 0 1 8 0v2',heart:'M20 4c-3-3-7-1-8 2-1-3-5-5-8-2-4 5 2 11 8 16 6-5 12-11 8-16Z'};
const icon=(name,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.wallet}"/></svg>`;
const state={page:'dashboard',month:today().slice(0,7),data:null,demo:false,filterCategory:'',filterPayer:'',busy:false};
let lastSnapshot='',refreshRequest=0;
const memberName=slot=>state.data?.members.find(m=>m.slot===Number(slot))?.name || `멤버 ${slot}`;
const currentSlot=()=>state.data.members.find(m=>m.user_id===state.data.user.id)?.slot || 1;
const category=id=>state.data.categories.find(c=>c.id===id);
const selectableItems=(categoryId,selected)=>state.data.items.filter(i=>i.category_id===categoryId&&(i.active!==false||i.id===selected)).map(i=>i.active===false?{...i,name:i.name+' (이전 항목)'}:i);
const categoryIcon=c=>({interest:'wallet',fixed:'home',groceries:'bag',dining:'coffee'}[c?.report_key]||'heart');
const monthLabel=m=>`${m.slice(0,4)}년 ${Number(m.slice(5))}월`;
function toast(message,error=false) { const el=$('#toast'); el.textContent=message; el.className=error?'visible error':'visible'; clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.className='',5000); }
function showError(e) { toast(e.message||'처리하지 못했어요. 잠시 후 다시 시도해 주세요.',true); }
function options(rows,value,placeholder='') { return (placeholder?`<option value="">${placeholder}</option>`:'')+rows.map(r=>`<option value="${esc(r.id??r.slot)}" ${String(r.id??r.slot)===String(value)?'selected':''}>${esc(r.name)}</option>`).join(''); }
let modalCleanup=null;
function cleanModal(){modalCleanup?.();modalCleanup=null;}
function setModal(html) { cleanModal();$('#modal').innerHTML=html; $('#modal').showModal(); }
function closeModal() { cleanModal();$('#modal').close(); }
const field=(label,input,extra='')=>`<label class="field ${extra}"><span>${label}</span>${input}</label>`;
const modalHead=(eyebrow,title)=>`<div class="modal-head"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div><button class="icon-button" data-action="close" aria-label="닫기">${icon('close')}</button></div>`;
const loginCats=[
  {src:'./icons/moaboja-cat-v1-512.png',alt:'하트 동전을 안고 있는 고양이'},
  {src:'./icons/moaboja-cat-couple-v1-320.png',alt:'다정하게 안고 있는 고양이 두 마리'},
  {src:'./icons/moaboja-cat-wallet-v1-320.png',alt:'고양이 모양 동전 지갑'},
  {src:'./icons/moaboja-cat-bank-v1-320.png',alt:'식빵 고양이 저금통'},
];
async function nextLoginCat(button) {
  const next=(Number(button.dataset.catIndex)+1)%loginCats.length;
  const cat=loginCats[next],image=new Image();
  button.disabled=true;
  try {
    image.src=cat.src;
    await image.decode();
    const visible=button.querySelector('img');
    visible.src=cat.src;visible.alt=cat.alt;
    button.dataset.catIndex=String(next);
    button.setAttribute('aria-label',`다음 고양이 보기 · ${cat.alt} (${next+1}/4)`);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)button.animate([{transform:'scale(.94)'},{transform:'scale(1)'}],{duration:220,easing:'ease-out'});
  } finally {button.disabled=false;}
}
function login(message='') {
  lastSnapshot='';refreshRequest++;
  $('#app').innerHTML=`<main class="auth-screen">
    <section class="auth-card" aria-labelledby="login-title">
      <header class="auth-heading">
        <button class="auth-mascot" type="button" data-action="next-cat" data-cat-index="0"
          aria-label="다음 고양이 보기 · ${loginCats[0].alt} (1/4)" title="눌러서 다음 고양이 보기">
          <img src="${loginCats[0].src}" width="512" height="512" alt="${loginCats[0].alt}" fetchpriority="high">
        </button>
        <h1 id="login-title">모아보자!</h1>
        <p>우리 둘이 쓴 돈, 한곳에 모아보자.</p>
      </header>
      <div class="auth-panel">
        <h2 id="auth-form-title">로그인</h2>
        ${message?`<p class="notice warning" role="alert">${esc(message)}</p>`:''}
        <form id="login-form" aria-label="로그인">
          ${field('아이디','<input name="username" type="text" autocomplete="username" required>')}
          <div class="field">
            <label for="login-password">비밀번호</label>
            <div class="auth-password">
              <input id="login-password" name="password" type="password" autocomplete="current-password" required minlength="6">
              <button type="button" data-action="show-password" aria-label="비밀번호 표시" aria-pressed="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>
          <button type="submit" class="primary full" ${!configured?'disabled':''}>로그인</button>
        </form>
        <button class="text-button full" data-action="forgot" ${!configured?'disabled':''}>비밀번호 재설정</button>
        <div class="auth-preview">
          ${!configured?'<p>로그인 준비 중이에요. 먼저 둘러보세요.</p>':''}
          <button class="secondary full" data-action="demo">가계부 미리 보기</button>
        </div>
      </div>
    </section>
  </main>`;
}
function render() {
  if(!state.data) return login();
  state.data.categories.sort((a,b)=>Number(a.name==='기타')-Number(b.name==='기타') || (a.position??99)-(b.position??99));
  const tabs=[['dashboard','grid','대시보드'],['expenses','list','지출 내역'],['settlement','swap','정산'],['settings','settings','설정']];
  $('#app').innerHTML=`<div class="app-shell"><aside class="sidebar"><a class="brand" href="#" data-page="dashboard">모아보자</a><p class="nav-caption">함께하는 일상</p><nav aria-label="주 메뉴">${tabs.map(([key,ic,label])=>`<button data-page="${key}" class="nav-item ${state.page===key?'active':''}" ${state.page===key?'aria-current="page"':''}>${icon(ic)}<span>${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><div class="together"><div class="avatar-pair"><span>${esc(memberName(1).slice(0,1))}</span><span>${esc(memberName(2).slice(0,1))}</span></div><strong>우리의 생활, 함께 기록해요</strong><small>두 사람만의 작은 가계부</small></div><button class="text-button" data-action="logout">${state.demo?'둘러보기 종료':'로그아웃'}</button></div></aside><main class="main"><header class="topbar"><span class="breadcrumb">모아보자 <span>/</span> ${tabs.find(t=>t[0]===state.page)[2]}</span><div class="top-actions"><span class="sync"><i></i>${state.demo?'예시 데이터':'연결됨'}</span><button class="icon-button" data-action="refresh" aria-label="새로고침">${icon('refresh',17)}</button><span class="user-avatar" title="${esc(memberName(currentSlot()))}">${esc(memberName(currentSlot()).slice(0,1))}</span></div></header><div class="page-content">${state.demo?`<div class="demo-banner"><span>둘러보기 · 예시 데이터이며, 변경 내용은 서버에 저장되지 않아요.</span><button data-action="switch-demo">${esc(memberName(currentSlot()===1?2:1))} 시점으로 보기 ${icon('swap',15)}</button></div>`:''}${state.data.members.length<2?'<div class="notice warning">아직 한 명만 등록되어 있어요. 두 번째 멤버를 초대한 뒤 지출을 기록할 수 있습니다.</div>':''}<div class="page-heading"><div><p class="eyebrow">${{dashboard:'A LITTLE MORE TOGETHER',expenses:'EVERY LITTLE MOMENT',settlement:'KEEP THINGS BALANCED',settings:'MAKE IT OURS'}[state.page]}</p><h1>${{dashboard:'우리의 이번 달',expenses:'함께 쓴 지출',settlement:'가볍게, 정산',settings:'우리에게 맞게'}[state.page]}</h1><p class="muted">${{dashboard:'함께 쓴 돈과 나눌 금액을 한눈에 확인해요.',expenses:'작은 지출도 빠짐없이, 우리의 일상을 기록해요.',settlement:'실제로 보낸 금액을 기록하고 남은 정산액을 확인해요.',settings:'지출 분류와 매달 반복하는 항목을 관리해요.'}[state.page]}</p></div><button class="primary" data-action="add-expense" ${state.data.members.length<2?'disabled':''}>${icon('plus')} 지출 추가</button></div>${state.page!=='settings'?`<div class="month-row"><label class="month-picker"><span>조회 월</span><input type="month" aria-label="조회 월" id="month" value="${state.month}" required min="2000-01" max="2100-12"></label><span class="small muted">${state.month===today().slice(0,7)?'이번 달의 기록':'선택한 달의 기록'}</span></div>`:''}${({dashboard:dashboard,expenses:expensePage,settlement:settlementPage,settings:settingsPage})[state.page]() }<footer class="page-footer">모아보자 <span>·</span> 화이팅!</footer></div></main></div>`;
}
function stat(label,value,sub,cls='') {return `<article class="stat-card ${cls}"><span class="stat-label">${label}</span><strong>${won(value)}</strong><span class="small">${sub}</span></article>`;}
function dashboard() {
  const d=state.data,s=summarize(d.expenses,d.transfers,state.month), rows=d.expenses.filter(e=>e.spent_on.startsWith(state.month));
  const sum=(key,month)=>d.expenses.filter(e=>e.spent_on.startsWith(month)&&category(e.category_id)?.report_key===key).reduce((n,e)=>n+e.amount,0);
  const categories=d.categories.map(c=>({...c,amount:rows.filter(e=>e.category_id===c.id).reduce((n,e)=>n+e.amount,0)})).filter(c=>c.amount>0).sort((a,b)=>b.amount-a.amount);
  return `<section class="stats-grid">${stat('이번 달 총지출',s.total,`${rows.length}건의 실제 지출`, 'hero-stat')}${stat('공동 지출',s.shared,'두 사람 모두 부담한 지출')}${stat('이자·금융비용',sum('interest',state.month),'이번 달 금융비용 합계')}${stat('고정 생활비',sum('fixed',state.month),'관리비와 주차비 합계')}</section><section class="dashboard-middle"><article class="panel spending-panel"><div class="panel-title"><h2>어디에 썼을까요?</h2><span class="badge">분류별 지출</span></div>${categories.length?`<div class="stacked-bar">${categories.map((c,i)=>`<span style="flex:${c.amount};background:var(--chart-${i%8})" title="${esc(c.name)} ${won(c.amount)}"></span>`).join('')}</div><div class="category-breakdown">${categories.slice(0,5).map((c,i)=>`<div><span><i style="background:var(--chart-${i%8})"></i>${esc(c.name)}</span><strong>${won(c.amount)} <small>${Math.round(c.amount/s.total*100)}%</small></strong></div>`).join('')}${categories.length>5?`<p class="small muted">그 외 ${categories.length-5}개 분류 · ${won(categories.slice(5).reduce((n,c)=>n+c.amount,0))}</p>`:''}</div>`:empty('아직 지출이 없어요','첫 지출을 기록하고 이번 달을 시작해 보세요.')}</article><article class="settlement-card"><div class="panel-title"><h2>${icon('swap')} 이번 달 정산</h2><span class="settlement-label">${s.remaining?'정산할 금액':'정산 완료'}</span></div>${s.remaining?`<div class="settlement-people"><span>${esc(memberName(s.sender))}</span>${icon('arrow')}<span>${esc(memberName(s.receiver))}</span></div><strong class="settlement-amount">${won(s.remaining)}</strong><p>이만큼 보내면 이번 달 정산이 맞아요.</p>`:`<div class="settlement-zero">${icon('check',32)}<strong>딱 맞게 나눴어요</strong><p>지금은 정산할 금액이 없어요.</p></div>`}<button class="settlement-button" data-page="settlement">정산 자세히 보기 ${icon('arrow',18)}</button><small>송금 내역은 총지출에 포함되지 않아요.</small></article></section><section class="dashboard-bottom"><article class="panel"><div class="panel-title"><h2>두 사람의 지출</h2><span class="small muted">결제액과 실제 부담액</span></div><div class="member-cards">${d.members.map(m=>`<div class="member-summary"><div class="member-label"><span class="person-dot slot-${m.slot}">${esc(m.name.slice(0,1))}</span><strong>${esc(m.name)}</strong>${m.slot===currentSlot()?'<span class="me-badge">나</span>':''}</div><dl><div><dt>결제한 금액</dt><dd>${won(s.paid[m.slot-1])}</dd></div><div><dt>부담할 금액</dt><dd>${won(s.burden[m.slot-1])}</dd></div></dl></div>`).join('')}</div></article><article class="panel comparison"><div class="panel-title"><h2>지난달과 비교하면</h2></div>${[['groceries','장보기·생활비','bag'],['dining','외식비','coffee']].map(([key,label,ic])=>{const current=sum(key,state.month),prev=sum(key,previousMonth(state.month)),diff=current-prev;return `<div class="compare-row"><span class="category-icon ${key}">${icon(ic)}</span><div><strong>${label}</strong><small>지난달 ${won(prev)}</small></div><div class="compare-value"><strong>${won(current)}</strong><small class="${diff>0?'up':'down'}">${diff===0?'변동 없음':`${diff>0?'↑':'↓'} ${won(Math.abs(diff))}`}</small></div></div>`;}).join('')}</article></section><article class="panel recent"><div class="panel-title"><h2>최근 지출</h2><button class="text-button" data-page="expenses">전체 보기 ${icon('chevron',16)}</button></div>${expenseList(rows.slice().sort((a,b)=>b.spent_on.localeCompare(a.spent_on)).slice(0,5))}</article><article class="template-strip"><div>${icon('refresh',22)}<div><strong>매달 나가는 비용, 잊지 않도록</strong><p>실제 납부액을 확인한 뒤 이번 달 지출로 등록해요.</p></div></div><div class="template-buttons">${d.templates.map(t=>`<button class="secondary" data-template="${esc(t.id)}">${esc(t.name)} ${icon('plus',15)}</button>`).join('')}</div></article>`;
}
function empty(title,description) { return `<div class="empty">${icon('leaf',28)}<strong>${title}</strong><p>${description}</p></div>`; }
function expenseList(rows) { return rows.length?`<div class="expense-table"><div class="table-head"><span>지출 내역</span><span>결제자</span><span>부담 방식</span><span>금액</span></div>${rows.map(e=>{const c=category(e.category_id),item=state.data.items.find(i=>i.id===e.item_id);return `<button class="expense-row" data-expense="${esc(e.id)}"><div class="expense-main"><span class="category-icon ${c?.report_key}">${icon(categoryIcon(c))}</span><span><strong>${esc(e.description)}</strong><small>${e.spent_on.slice(5).replace('-','.')} <b>·</b> ${esc(c?.name)}${item?' / '+esc(item.name):''}</small></span></div><span class="payer-name">${esc(memberName(e.payer))}</span><span class="split-label">${e.share1===0||e.share1===e.amount?'한 사람 부담':e.share1===Math.ceil(e.amount/2)?'반반 부담':'직접 지정'}</span><strong class="expense-amount">${won(e.amount)} ${icon('chevron',14)}</strong></button>`;}).join('')}</div>`:empty('등록된 지출이 없어요','지출 추가 버튼으로 첫 기록을 남겨 보세요.'); }
function expensePage() {
  const rows=state.data.expenses.filter(e=>e.spent_on.startsWith(state.month)&&(!state.filterCategory||e.category_id===state.filterCategory)&&(!state.filterPayer||e.payer===Number(state.filterPayer))).sort((a,b)=>b.spent_on.localeCompare(a.spent_on));
  return `<article class="panel"><div class="filter-row"><div>${field('분류',`<select id="filter-category">${options(state.data.categories,state.filterCategory,'전체 분류')}</select>`)}${field('결제자',`<select id="filter-payer">${options(state.data.members,state.filterPayer,'두 사람 모두')}</select>`)}</div><p>${rows.length}건 <strong>${won(rows.reduce((n,e)=>n+e.amount,0))}</strong></p></div>${expenseList(rows)}</article>${state.demo ? '' : '<travel-expenses></travel-expenses>'}`;
}
function settlementPage() {
  const s=summarize(state.data.expenses,state.data.transfers,state.month), transfers=state.data.transfers.filter(t=>t.month===state.month+'-01');
  return `<section class="settlement-layout"><article class="settlement-card large"><p class="eyebrow">${monthLabel(state.month)} 남은 정산</p>${s.remaining?`<div class="settlement-people"><span>${esc(memberName(s.sender))}</span>${icon('arrow')}<span>${esc(memberName(s.receiver))}</span></div><strong class="settlement-amount">${won(s.remaining)}</strong><p>실제 송금을 마친 후 아래 버튼으로 기록해 주세요.</p><button class="settlement-button" data-action="transfer">${icon('check')} 송금 기록하기</button>`:`<div class="settlement-zero">${icon('check',36)}<strong>정산이 모두 맞았어요</strong><p>남은 정산액은 0원입니다.</p></div>`}<small>이 사이트에서는 실제 계좌 송금을 실행하지 않아요.</small></article><article class="panel"><div class="panel-title"><h2>정산은 이렇게 계산해요</h2></div>${state.data.members.map(m=>`<div class="calculation"><strong>${esc(m.name)}</strong><dl><div><dt>결제액</dt><dd>${won(s.paid[m.slot-1])}</dd></div><div><dt>− 부담액</dt><dd>${won(s.burden[m.slot-1])}</dd></div><div class="calc-result"><dt>${s.paid[m.slot-1]-s.burden[m.slot-1]>=0?'받을 금액':'보낼 금액'} <small>(송금 전)</small></dt><dd>${won(Math.abs(s.paid[m.slot-1]-s.burden[m.slot-1]))}</dd></div></dl></div>`).join('')}<p class="small muted">송금 기록은 선택한 월의 남은 정산액만 줄여요. 지출을 수정하면 정산도 다시 계산됩니다.</p></article></section><article class="panel"><div class="panel-title"><h2>정산 송금 내역</h2><span class="badge">${transfers.length}건</span></div>${transfers.length?transfers.map(t=>`<div class="transfer-row"><span class="category-icon fixed">${icon('swap')}</span><div><strong>${esc(memberName(t.sender))} → ${esc(memberName(t.sender===1?2:1))}</strong><small>${t.sent_on} ${t.note?'· '+esc(t.note):''}</small></div><strong>${won(t.amount)}</strong><button class="text-button danger" data-delete-transfer="${t.id}">삭제</button></div>`).join(''):empty('아직 기록한 송금이 없어요','실제로 송금한 뒤 기록하면 남은 금액에 반영돼요.')}</article>`;
}
function settingsPage() {
  return `<article class="panel member-settings"><div class="panel-title"><h2>함께 쓰는 사람</h2><span class="badge">${state.data.members.length} / 2명</span></div><div class="member-pills">${state.data.members.map(m=>`<span class="member-pill"><span class="person-dot slot-${m.slot}">${esc(m.name.slice(0,1))}</span><strong>${esc(m.name)}</strong><small>${m.slot===currentSlot()?'내 계정':'함께하는 멤버'}</small></span>`).join('')}</div><p class="small muted">두 사람의 지정된 아이디만 사용해요. 비밀번호를 잊으면 관리자에게 설정 링크를 요청하세요.</p><button class="text-button" data-action="logout">${state.demo?'둘러보기 종료':'로그아웃'}</button></article><article class="panel"><div class="panel-title"><div><h2>반복 지출 템플릿</h2><p class="muted small">자동 등록 없이, 납부액을 확인할 때마다 직접 등록해요.</p></div><button class="secondary" data-setting="template">${icon('plus',16)} 템플릿 추가</button></div><div class="templates-list">${state.data.templates.map(t=>`<div class="template-item"><span class="category-icon fixed">${icon('refresh')}</span><div><strong>${esc(t.name)}</strong><small>${esc(category(t.category_id)?.name)}</small></div><button class="text-button" data-setting="template" data-id="${t.id}">수정</button><button class="secondary" data-template="${t.id}">지출 등록</button></div>`).join('')}</div></article><article class="panel"><div class="panel-title"><div><h2>지출 분류</h2><p class="muted small">분류를 눌러 이름을 바꾸거나 세부 항목을 추가해 보세요.</p></div><button class="secondary" data-setting="category">${icon('plus',16)} 분류 추가</button></div><div class="categories-settings">${state.data.categories.map(c=>`<section><div class="category-heading"><span class="category-icon ${c.report_key}">${icon(categoryIcon(c))}</span><button class="text-button" data-setting="category" data-id="${c.id}">${esc(c.name)} <small>수정</small></button></div><div class="item-chips">${selectableItems(c.id).map(i=>`<button data-setting="item" data-id="${i.id}" data-category="${c.id}">${esc(i.name)}</button>`).join('')}<button class="add-chip" data-setting="item" data-category="${c.id}">${icon('plus',12)} 추가</button></div></section>`).join('')}</div><p class="small muted">기본 분류의 이름을 바꾸어도 기존 월별 비교 기준은 유지돼요. 새 대분류는 분류별 지출에 표시됩니다.</p></article>`;
}
function receiptModal(){
  if(state.data.members.length<2)return toast('두 번째 멤버를 먼저 초대해 주세요.',true);
  setModal(`${modalHead('RECEIPT','영수증으로 입력')}<div class="receipt-intro"><p>사진에서 날짜·상호·결제금액을 읽어요.<br>확인한 뒤에만 지출로 저장돼요.</p><fieldset class="receipt-method"><legend>인식 방법</legend><label><input type="radio" name="receipt-method" value="ai" ${state.demo?'disabled':'checked'}> AI로 읽기</label><label><input type="radio" name="receipt-method" value="local" ${state.demo?'checked':''}> 이 기기에서 읽기</label></fieldset>${state.demo?'<p class="small muted">예시 모드에서는 기기 인식만 가능해요. AI 인식은 로그인 후 이용할 수 있어요.</p>':''}<label id="receipt-consent" class="receipt-confirm"><input type="checkbox"><span>선택한 사진을 OpenAI로 보내 인식하는 데 동의해요. API 크레딧이 사용돼요.</span></label><p id="receipt-privacy" class="small muted"></p><div class="receipt-pickers"><button type="button" class="primary" id="receipt-camera">사진 찍기</button><button type="button" class="secondary" id="receipt-gallery">사진 선택</button></div><input id="receipt-camera-file" type="file" accept="image/*" capture="environment" hidden><input id="receipt-gallery-file" type="file" accept="image/*" hidden></div><div id="receipt-progress" hidden><progress max="100" value="0" aria-label="영수증 인식 진행률"></progress><p role="status" aria-live="polite"></p><button type="button" class="text-button" id="receipt-cancel">인식 취소</button></div><p id="receipt-error" class="form-error" role="alert"></p><div class="modal-footer"><button type="button" class="secondary" id="receipt-manual">직접 입력하기</button></div>`);
  const controller=new AbortController();let closed=false,reading=false;
  modalCleanup=()=>{closed=true;controller.abort();};
  const camera=$('#receipt-camera-file'),gallery=$('#receipt-gallery-file');
  const isAI=()=>!state.demo&&$('#modal input[name="receipt-method"]:checked').value==='ai';
  const update=()=>{const ai=isAI();$('#receipt-consent').hidden=!ai;$('#receipt-privacy').textContent=ai?'사진 전체가 선명하게 나오도록 찍어 주세요. 사진은 가계부 서버에 보관하지 않아요. 전송 후 취소해도 이미 사용된 크레딧은 차감될 수 있어요.':'사진은 이 기기에서만 읽어요. 영수증 네 모서리를 맞추면 기울기를 보정해요. 흐린 사진은 인식하지 못할 수 있어요.';$('#receipt-camera').disabled=$('#receipt-gallery').disabled=reading||(ai&&!$('#receipt-consent input').checked);};
  $('#receipt-consent input').onchange=update;document.querySelectorAll('#modal input[name="receipt-method"]').forEach(el=>el.onchange=update);update();
  $('#receipt-camera').onclick=()=>camera.click();$('#receipt-gallery').onclick=()=>gallery.click();
  $('#receipt-manual').onclick=()=>expenseModal();$('#receipt-cancel').onclick=()=>receiptModal();
  const progress=(text,value)=>{if(closed)return;$('#receipt-progress progress').value=value;$('#receipt-progress p').textContent=text;};
  const read=async event=>{
    let file=event.target.files?.[0];if(!file||reading)return;
    const ai=isAI();if(ai&&!$('#receipt-consent input').checked)return;
    reading=true;update();$('#receipt-error').textContent='';$('#modal .receipt-intro').hidden=true;
    try{
      let draft;
      if(ai){
        $('#receipt-progress').hidden=false;
        const {recognizeReceiptAI}=await import('./receipt-ai.js');if(closed)return;
        draft=await recognizeReceiptAI(file,{signal:controller.signal,onProgress:progress});
      }else{
        const {prepareReceipt}=await import('./receipt-editor.js');if(closed)return;
        const editor=document.createElement('div');editor.className='receipt-editor';$('#receipt-progress').before(editor);
        file=await prepareReceipt(file,editor,{signal:controller.signal});editor.remove();if(closed)return;
        $('#receipt-progress').hidden=false;
        const {recognizeReceipt}=await import('./receipt-ocr.js');
        const result=await recognizeReceipt(file,{signal:controller.signal,onProgress:progress});if(closed)return;
        draft=reviewReceipt(result,today());
        if(!draft.spent_on&&!draft.amount)throw new Error('날짜와 합계를 정확히 읽지 못했어요. AI 인식을 선택하거나 사진을 다시 찍어 주세요.');
        draft.text=result.text;
      }
      if(closed)return;draft.photo=file;expenseModal(null,null,draft);
    }catch(error){
      if(closed||error.name==='AbortError')return;
      $('#receipt-error').textContent=error.message||'사진을 읽지 못했어요. 다시 찍거나 직접 입력해 주세요.';
      $('#modal .receipt-intro').hidden=false;$('#modal .receipt-editor')?.remove();$('#receipt-progress').hidden=true;
      camera.value='';gallery.value='';reading=false;update();
    }
  };
  camera.onchange=read;gallery.onchange=read;
}
function expenseModal(id,templateId,receiptDraft) {
  const d=state.data, existing=d.expenses.find(e=>e.id===id), template=d.templates.find(t=>t.id===templateId);
  const e=existing||{id:crypto.randomUUID(),spent_on:today(),amount:'',category_id:template?.category_id||d.categories.find(c=>c.report_key==='groceries')?.id||d.categories[0]?.id,item_id:template?.item_id||'',description:template?.name||'',payer:currentSlot(),share1:0,note:'',version:0,template_id:templateId||null};
  if(d.members.length<2) return toast('두 번째 멤버를 먼저 초대해 주세요.',true);
  if(receiptDraft)Object.assign(e,{spent_on:receiptDraft.spent_on,amount:receiptDraft.amount,description:receiptDraft.description,...receiptCategory(receiptDraft,d.categories,d.items)});
  const mode=existing?'custom':'equal';
  setModal(`${modalHead(template?'RECURRING EXPENSE':'OUR EXPENSE',existing?'지출 수정':template?`${esc(template.name)} 등록`:'새 지출 기록')}<form id="expense-form">${!existing&&!template&&!receiptDraft?'<div class="receipt-entry"><button type="button" class="secondary full" id="receipt-start">영수증 찍어서 자동 입력</button></div>':''}${receiptDraft?`<div class="receipt-review notice"><strong>아직 저장되지 않았어요. 읽은 내용을 확인해 주세요.</strong>${receiptDraft.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}<p>분류는 추정값이에요. 실제 지출에 맞게 선택해 주세요.</p><details><summary>인식한 원문 보기</summary><pre>${esc(receiptDraft.text)}</pre></details><p id="receipt-duplicate" class="warning" hidden></p></div>`:''}${template?'<div class="notice">실제 납부액과 지출일을 확인해 주세요. 같은 템플릿은 한 달에 한 번만 등록할 수 있어요.</div>':''}<div class="form-grid">${field('지출일',`<input name="spent_on" type="date" value="${e.spent_on}" max="${today()}" required>`)}${field('결제한 금액',`<div class="input-suffix"><input name="amount" type="number" min="1" max="1000000000" step="1" inputmode="numeric" placeholder="0" value="${e.amount}" required><span>원</span></div>`)}${field('분류',`<select name="category_id" required>${options(d.categories,e.category_id,'분류 선택')}</select>`)}${field('세부 항목',`<select name="item_id">${options(selectableItems(e.category_id,existing?.item_id),e.item_id,'선택 안 함')}</select>`)}${field('내역',`<input name="description" value="${esc(e.description)}" placeholder="예: 주말 장보기" maxlength="120" required>`,'span-2')}${field('결제자',`<select name="payer">${options(d.members,e.payer)}</select>`,'span-2')}</div><fieldset class="split-field"><legend>어떻게 나눌까요?</legend><div class="segmented">${[['equal','반반 50:50'],['custom','직접 지정'],['payer','결제자 전액']].map(([v,label])=>`<label><input type="radio" name="mode" value="${v}" ${v===mode?'checked':''}><span>${label}</span></label>`).join('')}</div><div class="form-grid share-inputs">${field(`${esc(memberName(1))} 부담액`,`<div class="input-suffix"><input name="share1" type="number" min="0" step="1" inputmode="numeric" value="${e.share1}" required><span>원</span></div>`)}${field(`${esc(memberName(2))} 부담액`,`<div class="input-suffix"><input name="share2" type="number" min="0" step="1" inputmode="numeric" value="${existing?e.amount-e.share1:0}" required><span>원</span></div>`)}</div><p id="split-hint" class="small muted"></p></fieldset>${field('메모 <small>선택</small>',`<textarea name="note" maxlength="1000" placeholder="함께 기억할 내용을 남겨주세요">${esc(e.note)}</textarea>`)}${receiptDraft?'<label class="receipt-confirm"><input type="checkbox" name="receipt_checked" required><span>날짜·금액·내역과 분류를 확인했어요.</span></label>':''}<div class="form-error" role="alert"></div><div class="modal-footer">${existing?`<button type="button" class="text-button danger" id="delete-expense">삭제</button>`:'<button type="button" class="secondary" data-action="close">취소</button>'}<button class="primary" type="submit">${existing?'변경 저장':'지출 등록'} ${icon('check',18)}</button></div></form>`);
  const form=$('#expense-form');
  if($('#receipt-start'))$('#receipt-start').onclick=receiptModal;
  if(receiptDraft){const retry=document.createElement('button');retry.type='button';retry.className='secondary full';retry.textContent='다시 촬영·영역 조정';retry.onclick=receiptModal;form.querySelector('.receipt-review').append(retry);}
  if(receiptDraft?.photo){
    const photoUrl=URL.createObjectURL(receiptDraft.photo);
    const detail=document.createElement('details');detail.className='receipt-photo';
    const summary=document.createElement('summary');summary.textContent='영수증 사진 보기';
    const img=document.createElement('img');img.alt='선택한 영수증 원본';img.src=photoUrl;
    detail.append(summary,img);form.querySelector('.receipt-review').append(detail);
    modalCleanup=()=>URL.revokeObjectURL(photoUrl);
  }
  const update=()=>{
    const mode=form.elements.mode.value,amount=Number(form.elements.amount.value),payer=Number(form.elements.payer.value);
    if(receiptDraft){const warning=$('#receipt-duplicate');warning.hidden=!similarReceipt(state.data.expenses,{spent_on:form.elements.spent_on.value,amount,description:form.elements.description.value});warning.textContent='같은 날짜·금액·상호의 지출이 있어요. 중복 영수증인지 확인해 주세요.';}
    if(mode!=='custom') {const first=mode==='equal'?Math.ceil(amount/2):payer===1?amount:0;form.elements.share1.value=first;form.elements.share2.value=amount-first;}
    form.elements.share1.readOnly=mode!=='custom'; form.elements.share2.readOnly=mode!=='custom';
    const total=Number(form.elements.share1.value)+Number(form.elements.share2.value);
    $('#split-hint').textContent=total!==amount?`부담액 합계가 ${won(total)}입니다. 결제액 ${won(amount)}에 맞춰 주세요.`:mode==='equal'&&amount%2?`홀수 금액의 1원은 ${memberName(1)}님이 더 부담해요.`:`부담액 합계 ${won(total)} · 결제액과 일치해요`;
  };
  form.addEventListener('input',update); form.addEventListener('change',()=>{
    const selected=form.elements.category_id.value;
    const current=form.elements.item_id.value;
    form.elements.item_id.innerHTML=options(selectableItems(selected,existing?.item_id),current,'선택 안 함'); update();
  }); update();
  form.onsubmit=event=>{event.preventDefault(); runForm(form,async()=>{
    const f=Object.fromEntries(new FormData(form)); const amount=Number(f.amount);
    if(receiptDraft&&!form.elements.receipt_checked.checked)throw new Error('인식한 내용을 확인한 뒤 체크해 주세요.');
    delete f.receipt_checked;
    const [share1,share2]=split(amount,f.mode,Number(f.payer),f.share1);
    if(Number(f.share2)!==share2) throw new Error('두 사람의 부담액 합계를 결제액에 맞춰 주세요.');
    if(!f.description.trim()) throw new Error('내역을 입력해 주세요.');
    await mutate('save_expense',{p:{...e,...f,amount,payer:Number(f.payer),share1,share2}});
  },'지출을 저장했어요.');};
  if(existing) $('#delete-expense').onclick=()=>confirmAction('이 지출을 삭제할까요?','정산액도 다시 계산됩니다.',async()=>{await mutate('delete_expense',{p_id:e.id,p_version:e.version});},'지출을 삭제했어요.');
}
function transferModal() {
  const s=summarize(state.data.expenses,state.data.transfers,state.month);
  if(!s.remaining) return;
  const id=crypto.randomUUID();
  setModal(`${modalHead('SETTLE UP','정산 송금 기록')}<p class="notice">${esc(memberName(s.sender))} → ${esc(memberName(s.receiver))}<br>${monthLabel(state.month)} 남은 정산액: <strong>${won(s.remaining)}</strong></p><form id="transfer-form">${field('실제로 송금한 날짜',`<input name="sent_on" type="date" value="${today()}" max="${today()}" required>`)}${field('송금한 금액 (일부 정산 가능)',`<input name="amount" type="number" inputmode="numeric" step="1" min="1" max="${Math.min(s.remaining,1000000000)}" value="${Math.min(s.remaining,1000000000)}" required>`)}${field('메모 <small>선택</small>','<textarea name="note" maxlength="1000" placeholder="예: 이번 달 생활비 정산"></textarea>')}<p class="small muted">선택한 월의 정산에만 반영됩니다. 실제 송금을 마친 뒤 기록해 주세요.</p><div class="form-error" role="alert"></div><div class="modal-footer"><button type="button" class="secondary" data-action="close">취소</button><button class="primary">송금 기록 저장</button></div></form>`);
  const form=$('#transfer-form'); form.onsubmit=e=>{e.preventDefault();runForm(form,async()=>{const f=Object.fromEntries(new FormData(form));await mutate('save_transfer',{p:{...f,id,amount:Number(f.amount),sender:s.sender,month:state.month+'-01'}});},'송금을 기록했어요. 남은 정산액을 확인해 주세요.');};
}
function settingModal(kind,id,categoryId) {
  const table={category:'categories',item:'items',template:'templates'}[kind],existing=state.data[table].find(x=>x.id===id),e=existing||{category_id:categoryId||state.data.categories[0].id};
  const name={category:'분류',item:'세부 항목',template:'반복 템플릿'}[kind];
  setModal(`${modalHead('OUR SETTINGS',`${name} ${existing?'수정':'추가'}`)}<form id="setting-form">${field('이름',`<input name="name" value="${esc(e.name||'')}" maxlength="${kind==='template'?80:40}" required>`)}${kind==='template'?field('분류',`<select name="category_id">${options(state.data.categories,e.category_id)}</select>`)+field('세부 항목',`<select name="item_id">${options(selectableItems(e.category_id,existing?.item_id),e.item_id,'선택 안 함')}</select>`):''}<div class="form-error" role="alert"></div><div class="modal-footer"><button type="button" class="secondary" data-action="close">취소</button><button class="primary">저장</button></div></form>`);
  const form=$('#setting-form'); if(kind==='template') form.elements.category_id.onchange=()=>form.elements.item_id.innerHTML=options(selectableItems(form.elements.category_id.value,existing?.item_id),'','선택 안 함');
  form.onsubmit=event=>{event.preventDefault();runForm(form,async()=>{const f=Object.fromEntries(new FormData(form));if(!f.name.trim()) throw new Error('이름을 입력하세요.');await mutate('save_setting',{p_kind:kind,p:{...e,...f}});},'설정을 저장했어요.');};
}
function confirmAction(title,description,fn,success) {setModal(`${modalHead('PLEASE CONFIRM',title)}<p class="muted">${description}</p><form id="confirm-form"><div class="form-error" role="alert"></div><div class="modal-footer"><button type="button" class="secondary" data-action="close">취소</button><button class="primary danger-fill">삭제</button></div></form>`);const form=$('#confirm-form');form.onsubmit=e=>{e.preventDefault();runForm(form,fn,success);};}
async function mutate(name,args) {if(state.demo) demoMutation(state.data,name,args);else await rpc(name,args);}
async function refresh() {
  if(state.demo){render();return;}
  const request=++refreshRequest;
  const data=await snapshot();
  if(request!==refreshRequest||state.demo)return;
  // Compare the server snapshot before render() sorts categories. Auth metadata
  // can change independently of the ledger; only the user ID affects this UI.
  const signature=JSON.stringify({...data,user:{id:data.user.id}});
  if(!state.data||signature!==lastSnapshot){
    state.data=data;lastSnapshot=signature;render();
  }else{
    await $('travel-expenses')?.load();
  }
}
async function runForm(form,fn,message) {
  if(state.busy)return; state.busy=true; const button=form.querySelector('button[type="submit"],button.primary');if(button)button.disabled=true;
  form.querySelector('.form-error').textContent='';
  try {await fn();closeModal();toast(message);try{await refresh();}catch(e){render();toast('저장은 완료됐지만 새 내역을 불러오지 못했어요. 새로고침해 주세요.',true);}}catch(e){form.querySelector('.form-error').textContent=e.message;}finally{state.busy=false;if(button)button.disabled=false;}
}
function passwordModal(expectedUserId) {
  const member=state.data?.members.find(m=>m.user_id===expectedUserId);
  if(!member || state.data.user.id!==expectedUserId) throw new Error('설정할 계정이 일치하지 않아요. 새 설정 링크를 열어 주세요.');
  sessionStorage.setItem('moaboja-recovery-user',expectedUserId);
  setModal(`${modalHead('WELCOME',`${esc(member.name)}님 비밀번호 설정`)}<form id="password-form">${field('새 비밀번호 (6자 이상)','<input name="password" type="password" minlength="6" autocomplete="new-password" required>')}${field('새 비밀번호 확인','<input name="confirm" type="password" minlength="6" autocomplete="new-password" required>')}<div class="form-error" role="alert"></div><div class="modal-footer"><button class="primary">비밀번호 저장</button></div></form>`);
  const form=$('#password-form');form.onsubmit=e=>{e.preventDefault();runForm(form,async()=>{if(form.elements.password.value!==form.elements.confirm.value)throw new Error('비밀번호가 일치하지 않습니다.');const{data:{user},error:identityError}=await client.auth.getUser();if(identityError||user?.id!==expectedUserId)throw new Error('다른 계정으로 로그인 상태가 바뀌었어요. 이 계정의 설정 링크를 다시 열어 주세요.');const{error}=await client.auth.updateUser({password:form.elements.password.value});if(error)throw new Error(error.message);sessionStorage.removeItem('moaboja-recovery-user');history.replaceState(null,'',location.pathname);},'비밀번호를 저장했어요.');};
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button,a');if(!button)return;
  try {
    if(button.dataset.page){event.preventDefault();state.page=button.dataset.page;render();window.scrollTo(0,0);return;}
    if(button.dataset.expense)return expenseModal(button.dataset.expense);
    if(button.dataset.template)return expenseModal(null,button.dataset.template);
    if(button.dataset.setting)return settingModal(button.dataset.setting,button.dataset.id,button.dataset.category);
    if(button.dataset.deleteTransfer)return confirmAction('송금 기록을 삭제할까요?','실제 계좌 송금은 취소되지 않습니다. 남은 정산액은 다시 계산됩니다.',()=>mutate('delete_transfer',{p_id:button.dataset.deleteTransfer}),'송금 기록을 삭제했어요.');
    switch(button.dataset.action){
      case 'next-cat':await nextLoginCat(button);break;
      case 'show-password': {
        const password=$('#login-password');
        const show=password.type==='password';
        password.type=show?'text':'password';
        button.setAttribute('aria-pressed',String(show));
        break;
      }
      case 'close':if(!state.busy)closeModal();break;
      case 'demo':state.demo=true;state.data=createDemo();state.page='dashboard';render();break;
      case 'switch-demo':state.data.user.id=currentSlot()===1?'demo2':'demo1';render();break;
      case 'logout':if(!state.demo){const{error}=await client.auth.signOut();if(error)throw error;}state.data=null;state.demo=false;login();break;
      case 'add-expense':expenseModal();break;
      case 'transfer':transferModal();break;
      case 'refresh':button.disabled=true;try{await refresh();toast('최신 내역을 불러왔어요.');}finally{button.disabled=false;}break;
      case 'forgot':toast('이메일 없이 사용하는 계정이에요. 가계부 관리자에게 새 비밀번호 설정 링크를 요청해 주세요.');break;
    }
  }catch(e){button.disabled=false;showError(e);}
});
document.addEventListener('change',e=>{if(e.target.id==='month'&&/^\d{4}-\d{2}$/.test(e.target.value)){state.month=e.target.value;render();}if(e.target.id==='filter-category'){state.filterCategory=e.target.value;render();}if(e.target.id==='filter-payer'){state.filterPayer=e.target.value;render();}});
document.addEventListener('submit',async e=>{if(e.target.id!=='login-form')return;e.preventDefault();const button=e.target.querySelector('button[type="submit"]');button.disabled=true;try{const f=Object.fromEntries(new FormData(e.target));const{error}=await client.auth.signInWithPassword({email:loginEmail(f.username),password:f.password});if(error)throw new Error('아이디 또는 비밀번호를 확인해 주세요.');await refresh();}catch(error){showError(error);}finally{button.disabled=false;}});
$('#modal').addEventListener('cancel',e=>{if(state.busy)e.preventDefault();else cleanModal();});
$('#modal').addEventListener('close',cleanModal);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.data&&!state.demo&&!state.busy&&!$('#modal').open)refresh().catch(showError);});
setInterval(()=>{if(state.data&&!state.demo&&!state.busy&&!$('#modal').open&&document.visibilityState==='visible')refresh().catch(()=>{});},30000);
async function boot(){
  login(); if(!configured)return;
  const entry=recoveryEntry(location.href);
  if(entry.kind==='error'){
    history.replaceState(null,'',location.pathname);
    sessionStorage.removeItem('moaboja-recovery-user');
    login(recoveryError);return;
  }
  if(entry.kind==='setup'){
    history.replaceState(null,'',location.pathname+'?welcome=1');
    sessionStorage.removeItem('moaboja-recovery-user');
    try{
      await client.auth.getSession();
      const user=await verifyRecovery(client,entry);
      await refresh();passwordModal(user.id);
    }catch(e){state.data=null;login(e.message);return;}
  }else{
    const{data:{session},error}=await client.auth.getSession();
    if(error){login(recoveryError);return;}
    if(entry.kind==='resume' && (!session || sessionStorage.getItem('moaboja-recovery-user')!==session.user.id)){
      login(recoveryError);return;
    }
    if(session){try{await refresh();if(entry.kind==='legacy'||entry.kind==='resume')passwordModal(session.user.id);}catch(e){login(e.message);}}
  }
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&!state.demo){state.data=null;sessionStorage.removeItem('moaboja-recovery-user');closeModal();login();}});
}
boot().catch(showError);

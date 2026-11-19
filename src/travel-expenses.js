import { createClient } from '@supabase/supabase-js';
import { won } from './domain.js';

const trips = new Map([
  ['china-2026', '중국'], ['jeju-2026', '제주'], ['gangneung-2026', '강릉'], ['sapporo-2026', '삿포로']
]);
const categoryOrder = ['항공', '숙소', '관광', '교통', '식비', '기타'];
function categoryRank(row) {
  const index = categoryOrder.indexOf(row.category?.trim());
  return index < 0 ? categoryOrder.length : index;
}
let travel;
// Keep disclosure state across the ledger's periodic full-page renders.
const expandedTrips = new Set();

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

class TravelExpenses extends HTMLElement {
  tripDetails = new Map();

  rememberExpandedTrips() {
    for (const [key, details] of this.tripDetails) {
      if (details.open) expandedTrips.add(key);
      else expandedTrips.delete(key);
    }
  }

  connectedCallback() {
    this.className = 'panel travel-expenses';
    this.load();
  }

  disconnectedCallback() {
    this.rememberExpandedTrips();
    this.request?.abort();
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  showBody(body, tripDetails = new Map()) {
    // Read the live open state after fetching, including clicks during the request.
    this.rememberExpandedTrips();
    this.tripDetails = tripDetails;
    for (const [key, details] of tripDetails) details.open = expandedTrips.has(key);
    this.replaceChildren(element('h2', '여행별 지출'), element('p', '여행 전체 기간 · 정산 제외'), body);
  }

  async load() {
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    const body = element('div', '불러오는 중…');
    if (!this.childElementCount) this.showBody(body);
    try {
      travel ??= createClient('https://wphdhiowhivefokivfql.supabase.co',
        'sb_publishable_WtJZIOmD4Q6gSihH0xm2rw_ru_yf4Cy', {auth: {detectSessionInUrl: false}});
      this.subscription ??= travel.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' && this.needsLogin) {
          setTimeout(() => { if (this.isConnected) this.load(); }, 0);
        }
      }).data.subscription;
      const {data, error} = await travel.auth.getSession();
      if (request.signal.aborted) return;
      if (error) throw error;
      this.needsLogin = !data.session;
      if (this.needsLogin) {
        if (this.signature === 'signed-out') return;
        const link = element('a', '여행 사이트 로그인');
        link.href = 'https://parkjunil7.github.io/login.html?next=%2Fmoaboja%2F';
        body.replaceChildren(element('p', '이 브라우저에서 여행 계정으로 로그인하면 지출이 표시돼요.'), link);
        this.signature = 'signed-out';
        this.showBody(body);
        return;
      }
      const groups = new Map();
      let offset = 0;
      for (;;) {
        const {data: rows, error} = await travel.from('expenses')
          .select('id,trip_key,title,category,amount').order('id', {ascending:false})
          .range(offset, offset + 199).abortSignal(request.signal);
        if (request.signal.aborted) return;
        if (error) throw error;
        for (const row of rows) {
          if (!groups.has(row.trip_key)) groups.set(row.trip_key, []);
          groups.get(row.trip_key).push(row);
        }
        if (rows.length < 200) break;
        offset += rows.length;
      }
      const signature = JSON.stringify([data.session.user.id, [...groups]]);
      if (signature === this.signature) return;
      const tripDetails = new Map();
      body.textContent = groups.size ? '' : '등록된 여행 지출이 없어요.';
      for (const [key, rows] of groups) {
        const details = document.createElement('details');
        tripDetails.set(key, details);
        const name = trips.has(key) ? trips.get(key) + ' ' + key.slice(-4) : key || '기타 여행';
        details.append(element('summary', name + ' · ' + rows.length + '건 · ' + won(rows.reduce((total,row) => total + row.amount, 0))));
        rows.sort((a, b) => categoryRank(a) - categoryRank(b));
        const list = document.createElement('ul');
        for (const row of rows) {
          const item = document.createElement('li');
          item.append(element('span', row.title + ' · ' + row.category), element('strong', won(row.amount)));
          list.append(item);
        }
        details.append(list);
        body.append(details);
      }
      this.showBody(body, tripDetails);
      this.signature = signature;
    } catch {
      if (request.signal.aborted) return;
      const retry = element('button', '다시 불러오기');
      retry.className = 'text-button';
      retry.onclick = () => this.load();
      body.replaceChildren(element('p', '여행 지출을 불러오지 못했어요.'), retry);
      this.signature = null;
      this.showBody(body);
    }
  }
}
customElements.define('travel-expenses', TravelExpenses);

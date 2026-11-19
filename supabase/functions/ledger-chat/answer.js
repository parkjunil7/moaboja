const money = n => n.toLocaleString('ko-KR') + '원';
const monthLabel = month => month.replace('-', '년 ') + '월';
export function offsetMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}
const help = '궁금한 달과 지출 항목을 알려줘요. “이번 달 대출이자 얼마야?” 또는 “다음 달 외식비 예상해줘”처럼 물어볼 수 있어요.';
export function answerPlan(plan, ledger, today) {
  const {month, mode, scope, name} = plan;
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(month) || !['actual','forecast','settlement'].includes(mode)) return help;
  const items = new Map(ledger.items.map(item => [item.id,item]));
  const categories = new Map(ledger.categories.map(cat => [cat.id,cat]));
  let label, matches;
  if (mode === 'settlement') {
    const rows = ledger.expenses.filter(e => e.spent_on.startsWith(month));
    if (!rows.length) return monthLabel(month)+' 정산에 사용할 지출 기록이 아직 없어요.';
    const owed = rows.reduce((n,e)=>n + (e.payer === 1 ? e.amount : 0) - e.share1, 0);
    const sent = ledger.transfers.filter(t=>t.month.startsWith(month)).reduce((n,t)=>n+(t.sender===1?t.amount:-t.amount),0);
    const balance = owed + sent;
    const member = slot => ledger.members.find(m=>m.slot===slot)?.name || '멤버 '+slot;
    return monthLabel(month)+(balance ? ' 남은 정산은 '+member(balance>0?2:1)+' → '+member(balance>0?1:2)+' '+money(Math.abs(balance))+'이에요. 기록한 정산 송금까지 반영했어요.' : ' 정산은 모두 맞았어요.');
  }
  if (scope === 'interest') {
    label = '대출이자';
    matches = e => categories.get(e.category_id)?.report_key === 'interest' &&
      /이자/.test(items.get(e.item_id)?.name || e.description || '') &&
      !/보증료|보험료/.test(items.get(e.item_id)?.name || e.description || '');
  } else if (scope === 'all') {
    label='총지출'; matches = () => true;
  } else if (scope === 'category' && ledger.categories.some(c=>c.name===name)) {
    label=name; matches=e=>categories.get(e.category_id)?.name===name;
  } else if (scope === 'item' && ledger.items.some(i=>i.name===name)) {
    label=name; matches=e=>items.get(e.item_id)?.name===name;
  } else return help;
  const totals = new Map();
  for (const row of ledger.expenses.filter(matches)) {
    const key=row.spent_on.slice(0,7);
    const group=totals.get(key) || {sum:0,count:0};
    group.sum+=row.amount;
    group.count++;
    totals.set(key,group);
  }
  const heading=monthLabel(month)+' '+label;
  if (mode === 'actual') {
    const entry=totals.get(month);
    return entry ? heading+'로 기록한 금액은 '+money(entry.sum)+'이에요. 총 '+entry.count+'건을 더했어요.' : heading+'에 해당하는 지출 기록이 없어요.';
  }
  const latest=month>today.slice(0,7)?today.slice(0,7):offsetMonth(month,-1);
  const history=Array.from({length:3},(_,i)=>offsetMonth(latest,-i)).filter(m=>totals.has(m));
  if (!history.length) return heading+' 예상액을 계산할 기록이 부족해요. 기준 기간('+offsetMonth(latest,-2)+' ~ '+latest+')에 이 항목으로 기록한 지출이 없어요.';
  const estimate=Math.round(history.reduce((n,m)=>n+totals.get(m).sum,0)/history.length);
  const detail=history.reverse().map(m=>monthLabel(m)+' '+money(totals.get(m).sum)).join(' · ');
  return heading+' 예상액은 약 '+money(estimate)+'이에요.\n'+detail+'\n최근 3개월 중 기록이 있는 '+history.length+'개월의 월 합계 평균이에요.'+(history.includes(today.slice(0,7))?' 이번 달은 오늘까지 입력한 금액이에요.':'')+(scope==='interest'?' 금리나 대출 잔액이 달라지면 실제 납부액도 달라질 수 있어요.':'');
}

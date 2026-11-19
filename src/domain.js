export const won = value => new Intl.NumberFormat('ko-KR').format(value) + '원';
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
export function previousMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
}
export function split(amount, mode, payer, custom) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000) throw new Error('금액은 1원부터 10억원까지 원 단위로 입력해 주세요.');
  let first = mode === 'equal' ? Math.ceil(amount / 2) : mode === 'payer' ? (payer === 1 ? amount : 0) : Number(custom);
  if (!Number.isSafeInteger(first) || first < 0 || first > amount) throw new Error('각자 부담액은 0원 이상이고, 합계가 결제액과 같아야 합니다.');
  return [first, amount - first];
}
export function summarize(expenses, transfers, month) {
  const rows = expenses.filter(e => e.spent_on.slice(0, 7) === month);
  const paid = [0, 0], burden = [0, 0];
  for (const e of rows) { paid[e.payer - 1] += e.amount; burden[0] += e.share1; burden[1] += e.amount - e.share1; }
  const original = paid[0] - burden[0];
  const netTransfers = transfers.filter(t => t.month === month + '-01').reduce((n, t) => n + (t.sender === 1 ? t.amount : -t.amount), 0);
  const due = original + netTransfers;
  return { total: rows.reduce((n, e) => n + e.amount, 0), shared: rows.filter(e => e.share1 > 0 && e.share1 < e.amount).reduce((n, e) => n + e.amount, 0), paid, burden, original, due, sender: due > 0 ? 2 : 1, receiver: due > 0 ? 1 : 2, remaining: Math.abs(due) };
}

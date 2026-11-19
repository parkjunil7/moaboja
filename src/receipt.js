// OCR 문자열은 신뢰할 수 없는 입력입니다. 읽은 값을 확정하지 않고 검토할 초안만 만듭니다.
export function parseReceipt(text, today) {
  const lines=String(text??'').normalize('NFKC').split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
  const warnings=[];
  const dates=[];
  for(const line of lines) {
    const matches=[...line.matchAll(/\b(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})(?:일)?\b/g)];
    if(/일자|일시|날짜|거래일|date/i.test(line))matches.push(...line.matchAll(/\b(20\d{2})(\d{2})(\d{2})\b/g));
    for(const [,y,m,d] of matches){
      const iso=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
      const date=new Date(iso+'T00:00:00Z');
      if(!Number.isNaN(+date)&&date.toISOString().slice(0,10)===iso&&(!today||iso<=today))dates.push(iso);
    }
  }
  const uniqueDates=[...new Set(dates)];
  const spent_on=uniqueDates.length===1?uniqueDates[0]:'';
  if(!spent_on)warnings.push(uniqueDates.length>1?'날짜가 여러 개예요. 실제 지출일을 선택해 주세요.':'지출일을 확인하지 못했어요. 직접 입력해 주세요.');
  const candidates=[];
  const ignored=/부가세|공급가|과세|면세|할인|거스름|받은돈|받을돈|승인번호|사업자|전화|카드번호|할부|적립|봉사료/;
  for(let i=0;i<lines.length;i++){
    const compact=lines[i].replace(/\s/g,'');
    if(ignored.test(compact))continue;
    const rank=/최종결제|실결제|총결제|결제금액|청구금액|승인금액/.test(compact)?100:/합계금액|총합계|총금액|총액|total/i.test(compact)?90:/합계/.test(compact)?80:0;
    if(!rank)continue;
    let valueLine=lines[i];
    if(!/\d/.test(valueLine)&&/^[\s₩￦W\d,.원]+$/.test(lines[i+1]??''))valueLine=lines[i+1];
    if(/[-−]\s*\d/.test(valueLine))continue;
    const numbers=[...valueLine.matchAll(/(?:^|[^\d])((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?!\d)/g)].map(m=>Number(m[1].replaceAll(',',''))).filter(n=>Number.isSafeInteger(n)&&n>0&&n<=1_000_000_000);
    // 수량/금액처럼 숫자가 여럿이면 마지막 금액을 후보로 쓰되 확인 화면에서만 제안합니다.
    if(numbers.length)candidates.push({value:numbers.at(-1),rank});
  }
  const highest=Math.max(0,...candidates.map(c=>c.rank));
  const amounts=[...new Set(candidates.filter(c=>c.rank===highest).map(c=>c.value))];
  let amount=amounts.length===1?amounts[0]:'';
  if(/승인취소|결제취소|취소전표|환불/.test(lines.join('').replace(/\s/g,''))){amount='';warnings.push('취소·환불 표시가 있어요. 실제 지출 영수증인지 확인해 주세요.');}
  if(!amount)warnings.push(amounts.length>1?'결제금액 후보가 여러 개예요. 최종 금액을 확인해 주세요.':'합계 금액을 읽지 못했어요. 결제금액을 직접 입력해 주세요.');
  const explicit=lines.map(l=>l.match(/(?:상호명?|매장명|가맹점명)\s*[:：]?\s+(.+)/)?.[1]).find(Boolean);
  const excluded=/영수증|고객용|매출전표|신용카드|체크카드|현금영수증|사업자|대표|주소|전화|TEL|승인|거래|일시|일자|금액|합계|공급가|부가세|할인|감사합니다|RECEIPT|CUSTOMER|상품명|수량|단가/i;
  const merchant=(explicit||lines.slice(0,8).find(l=>/[가-힣a-zA-Z]/.test(l)&&!excluded.test(l)&&!/\d{3}[- ]\d{2,4}[- ]\d{4}|20\d{2}[-./]|\d{1,3},\d{3}/.test(l)&&l.length>=2&&l.length<=60)||'').replace(/^[\s*\[\]-]+|[\s*\[\]-]+$/g,'').slice(0,120);
  if(!merchant)warnings.push('상호명을 읽지 못했어요. 내역을 입력해 주세요.');
  const searchable=(merchant+' '+lines.join(' ')).replace(/\s/g,'');
  let categoryHint=null,itemHint=null;
  if(/빙수|설빙|빙과/.test(searchable)){categoryHint='dining';itemHint='빙과(빙수)';}
  else if(/카페|커피|스타벅스|투썸|메가MGC|컴포즈|CAFE|COFFEE/i.test(searchable)){categoryHint='dining';itemHint='카페';}
  else if(/배달의민족|요기요|쿠팡이츠/.test(searchable)){categoryHint='dining';itemHint='배달';}
  else if(/식당|음식점|레스토랑|국밥|치킨|피자|분식|김밥|돈까스|삼겹살|햄버거|RESTAURANT/i.test(searchable)){categoryHint='dining';itemHint='식당';}
  else if(/마트|슈퍼|이마트|홈플러스|식재료|생필품|편의점/.test(searchable)){categoryHint='groceries';}
  else if(/주차장|주차료|주차요금/.test(searchable)){categoryHint='교통비';itemHint='외부 주차료';}
  return {spent_on,amount,description:merchant,categoryHint,itemHint,warnings};
}

export function receiptCategory(draft,categories,items){
  const category=categories.find(c=>c.report_key===draft.categoryHint||c.name===draft.categoryHint);
  const item=category&&items.find(i=>i.category_id===category.id&&i.active!==false&&i.name===draft.itemHint);
  return {category_id:category?.id||'',item_id:item?.id||''};
}

export function similarReceipt(expenses,draft){
  const name=s=>String(s??'').normalize('NFKC').replace(/[\s\p{P}]/gu,'').toLowerCase();
  return Boolean(draft.spent_on&&Number(draft.amount)>0&&name(draft.description)&&expenses.some(e=>e.spent_on===draft.spent_on&&Number(e.amount)===Number(draft.amount)&&name(e.description)===name(draft.description)));
}

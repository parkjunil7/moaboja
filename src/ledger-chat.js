import {client} from './data.js';
import {today} from './domain.js';
import {answerPlan,offsetMonth} from '../supabase/functions/ledger-chat/answer.js';

const examples=['이번 달 대출이자 얼마야?', '다음 달 이자 예상해줘', '이번 달 정산 얼마야?'];
// 숫자와 근거 문장은 그대로 두고, 가끔 마지막 어미만 바꾼다.
function catReply(answer, turnNumber) {
  if ((turnNumber - 1) % 3 !== 0) return answer;
  const endings = [
    ['했어요.', '했다냥!'],
    ['맞았어요.', '맞았다냥!'],
    ['없어요.', '없다냥.'],
    ['있어요.', '있다냥.'],
    ['이에요.', '이라냥.'],
  ];
  for (const [ending, replacement] of endings) {
    if (answer.endsWith(ending)) return answer.slice(0, -ending.length) + replacement;
  }
  return answer;
}
let conversation;
export function resetChat() { conversation=undefined; }
export function mountChat(root,ledger,demo) {
  const owner=ledger.user.id;
  if(conversation?.owner!==owner) conversation={owner,turns:[],draft:'',previous:null,busy:false};
  const chat=conversation;
  function paint() {
    if(!root.isConnected || chat!==conversation) return;
    root.innerHTML=`<section class="panel cat-chat"><header><img src="./icons/moaboja-cat-v1-180.png" width="58" height="58" alt=""><h1>냥비서에게 물어봐</h1></header><p class="chat-intro">궁금한 달의 지출이나 정산액을 물어봐요.</p><div class="chat-log" role="log" aria-label="고양이와 대화"></div><div class="chat-examples"></div><form class="chat-form"><label for="cat-question">질문</label><div><input id="cat-question" maxlength="300" autocomplete="off" placeholder="그럼 다음 달 이자는?" required><button class="primary" type="submit">보내기</button></div></form><small class="chat-note"></small></section>`;
    const log=root.querySelector('.chat-log');
    for(const turn of chat.turns) {
      for(const [speaker,text] of [['나',turn.question],['고양이',turn.answer||'계산하고 있어요…']]) {
        const line=document.createElement('p');
        line.className=speaker==='나'?'question':'answer';
        line.textContent=text;
        line.setAttribute('aria-label',speaker+' · '+text);
        log.append(line);
      }
    }
    root.querySelector('.chat-note').textContent=demo?'예시 데이터로 아래 질문을 체험해 보세요.':'질문과 직전 조회 조건, 분류 이름을 OpenAI에 보내요. 금액은 가계부에서 계산해요.';
    const field=root.querySelector('input');
    field.value=chat.draft;
    field.oninput=()=>{chat.draft=field.value;};
    const form=root.querySelector('form');
    form.hidden=demo;
    form.querySelector('button').disabled=chat.busy;
    form.onsubmit=e=>{e.preventDefault();ask(field.value);};
    for(const [index,sample] of examples.entries()) {
      const chip=document.createElement('button');
      chip.className='secondary'; chip.textContent=sample; chip.disabled=chat.busy;
      chip.onclick=()=>ask(sample,index);
      root.querySelector('.chat-examples').append(chip);
    }
    log.scrollTop=log.scrollHeight;
  }
  async function ask(text,index) {
    const question=text.trim();
    if(chat.busy || !question) return;
    const turn={question,answer:''};
    chat.turns.push(turn);
    chat.busy=true; chat.draft=''; paint();
    try {
      if(demo) {
        const date=today(),month=date.slice(0,7);
        turn.answer=answerPlan({mode:['actual','forecast','settlement'][index],month:index===1?offsetMonth(month,1):month,scope:'interest'},ledger,date);
      } else {
        const {data,error}=await client.functions.invoke('ledger-chat',{body:{question,previous:chat.previous}});
        if(error) {
          const detail=await error.context?.json?.().catch(()=>null);
          throw new Error(detail?.error || '서버에 연결하지 못했어요. 잠시 후 다시 물어봐 주세요.');
        }
        turn.answer=data.answer;
        if(data.plan) chat.previous=data.plan;
      }
      turn.answer=catReply(turn.answer,chat.turns.length);
    } catch(err) {turn.answer=err.message;}
    finally {
      chat.busy=false;
      if(conversation===chat) chat.repaint?.();
    }
  }
  chat.repaint=paint;
  paint();
}

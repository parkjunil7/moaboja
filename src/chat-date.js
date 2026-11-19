const koreanDate = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', dateStyle: 'full',
});

// Match a whole date question so a date mentioned in a spending question
// still reaches the ledger query handler.
const dateQuestion = /^(?:오늘(?:은|이|의)?)?(?:날짜|며칠|몇일|몇월며칠|몇월몇일|무슨요일|어떤요일|요일)(?:가|는|은|을|를|이)?(?:좀)?(?:알려(?:줘요?|주세요|줄래요?)|말해(?:줘요?|주세요)|뭐(?:야|예요)|이?야|인가요|이지|지|예요|에요|일까)?$/u;

export function answerDate(question, now = new Date()) {
  const normalized = question.trim().replace(/[?!.~？。！]+$/u, '').replace(/\s+/gu, '');
  if (!dateQuestion.test(normalized)) return null;
  return '오늘은 ' + koreanDate.format(now) + '이에요.';
}

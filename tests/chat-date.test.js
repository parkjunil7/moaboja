import test from 'node:test';
import assert from 'node:assert/strict';
import {answerDate} from '../src/chat-date.js';

test('한국 자정에 오늘 날짜와 요일이 함께 바뀐다', () => {
  assert.match(answerDate('오늘 날짜 알려줘', new Date('2026-11-18T14:59:59Z')), /11월 18일 수요일/);
  for (const question of ['오늘 날짜 알려줘', '오늘이 며칠이야?', '오늘 무슨 요일인가요?', '오늘 날짜가 뭐예요?']) {
    assert.match(answerDate(question, new Date('2026-11-18T15:00:00Z')), /11월 19일 목요일/);
  }
});

test('지출 및 이전 달 질문은 가계부 처리기로 보낸다', () => {
  for (const question of ['오늘 날짜로 등록한 이자 얼마야?', '오늘 지출 알려줘', '그럼 다음 달은?', '12월 정산 날짜 알려줘']) {
    assert.equal(answerDate(question), null);
  }
});

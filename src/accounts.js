// 로그인용 별칭입니다. 접근 권한은 서버의 members 테이블에서 별도로 확인합니다.
export const accounts = Object.freeze([
  { slot: 1, username: 'member-1', name: '멤버1', email: 'member-1@example.invalid' },
  { slot: 2, username: 'member-2', name: '멤버2', email: 'member-2@example.invalid' },
]);
export function loginEmail(username) {
  const account = accounts.find(a => a.username === String(username ?? '').normalize('NFC').trim());
  if (!account) throw new Error('아이디 또는 비밀번호를 확인해 주세요.');
  return account.email;
}

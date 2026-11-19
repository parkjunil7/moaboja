export const recoveryError = '비밀번호 설정 링크가 만료됐거나 이미 사용됐어요. 새로 발급받은 설정 파일을 열어 주세요.';

export function recoveryEntry(href) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (hash.has('error') || hash.has('error_code') || url.searchParams.has('error')) return { kind: 'error' };
  if (hash.has('setup_token')) {
    const token = hash.get('setup_token'), userId = hash.get('setup_user');
    if (!token || !/^[0-9a-f-]{36}$/i.test(userId ?? '')) return { kind: 'error' };
    return { kind: 'setup', token, userId };
  }
  if (hash.get('type') === 'recovery' && hash.has('access_token')) return { kind: 'legacy' };
  return { kind: url.searchParams.has('welcome') ? 'resume' : 'none' };
}

export async function verifyRecovery(client, entry) {
  const { data, error } = await client.auth.verifyOtp({ token_hash: entry.token, type: 'recovery' });
  if (error || !data?.session || !data?.user) throw new Error(recoveryError);
  if (data.user.id !== entry.userId) {
    await client.auth.signOut({ scope: 'local' });
    throw new Error('설정 링크의 계정이 일치하지 않아요. 새 설정 파일을 요청해 주세요.');
  }
  return data.user;
}

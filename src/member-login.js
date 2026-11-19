export async function signInMember(client, username, password) {
  const { data, error } = await client.functions.invoke('member-login', {
    body: { username, password },
  });
  if (error) {
    const status = error.context?.status;
    if (status === 401) throw new Error('아이디 또는 비밀번호를 확인해 주세요.');
    if (status === 429) throw new Error('로그인 시도가 많아요. 잠시 후 다시 시도해 주세요.');
    throw new Error('로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  const session = await client.auth.setSession(data);
  if (session.error) throw new Error('로그인 세션을 시작하지 못했어요. 다시 시도해 주세요.');
}

export function validatePublicConfig(env) {
  const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error('가계부 전용 Supabase URL과 publishable key를 설정하세요.');
  const parsed=new URL(url);
  if(parsed.hostname==='wphdhiowhivefokivfql.supabase.co')throw new Error('여행 프로젝트는 사용할 수 없습니다. 새 Supabase 프로젝트를 연결하세요.');
  if(parsed.protocol!=='https:' && !['localhost','127.0.0.1'].includes(parsed.hostname))throw new Error('원격 Supabase는 HTTPS 주소를 사용하세요.');
  if(key.startsWith('sb_publishable_'))return;
  if(key.startsWith('ey')) {
    try{const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());if(claims.role==='anon')return;}catch{}
  }
  throw new Error('브라우저에는 publishable 또는 anon key만 사용할 수 있습니다. 비밀 키는 VITE_ 변수에 넣지 마세요.');
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePublicConfig} from '../scripts/public-config.mjs';
test('여행 DB 재사용과 비밀 키의 프런트엔드 빌드 차단',()=>{
  const env={VITE_SUPABASE_URL:'https://new-ledger.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
  assert.doesNotThrow(()=>validatePublicConfig(env));
  assert.throws(()=>validatePublicConfig({...env,VITE_SUPABASE_URL:'https://wphdhiowhivefokivfql.supabase.co'}),/여행 프로젝트/);
  assert.throws(()=>validatePublicConfig({...env,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'}),/비밀 키/);
  const jwt='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';
  assert.throws(()=>validatePublicConfig({...env,VITE_SUPABASE_PUBLISHABLE_KEY:jwt}),/비밀 키/);
});

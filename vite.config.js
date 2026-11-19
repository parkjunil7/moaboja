import { defineConfig, loadEnv } from 'vite';
import { validatePublicConfig } from './scripts/public-config.mjs';
import { prepareOcrAssets } from './scripts/ocr-assets.mjs';
export default defineConfig(async ({mode})=>{
  await prepareOcrAssets();
  const env={...loadEnv(mode,process.cwd(),'VITE_'),...process.env};
  if(env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY) validatePublicConfig(env);
  // Windows 제한 환경에서도 기존 결과물을 재귀 삭제하지 않고 갱신합니다. CI는 매번 새 checkout입니다.
  return { base: './', build: { emptyOutDir: false }, server: { port: 5173, strictPort: true }, preview: { port: 4173, strictPort: true } };
});

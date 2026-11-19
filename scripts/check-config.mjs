import { validatePublicConfig } from './public-config.mjs';
validatePublicConfig(process.env);
console.log('가계부 전용 공개 연결 설정 확인 완료');

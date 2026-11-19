// Volta/PATH가 오래된 Node를 선택해도 이미 설치된 최신 Node로 이 프로젝트만 실행합니다.
// 시스템 PATH나 다른 프로젝트의 Node 설정은 변경하지 않습니다.
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const commands={
  dev:['node_modules/vite/bin/vite.js','--host','127.0.0.1'],
  build:['node_modules/vite/bin/vite.js','build'],
  preview:['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1'],
  test:['--test','tests/*.test.js'],
  invite:['--env-file=.env','scripts/invite.mjs'],
  'account-link':['--env-file=.env','scripts/account-link.mjs'],
  'test:live':['--env-file=.env','tests/live.mjs'],
};
const command=commands[process.argv[2]];
if(!command)throw new Error('지원하지 않는 실행 명령입니다.');
function supported(version){
  const match=/^v?(\d+)\.(\d+)\./.exec(version.trim());
  return match && (Number(match[1])>22 || (Number(match[1])===22 && Number(match[2])>=12));
}
const candidates=[process.execPath];
if(process.platform==='win32'){
  candidates.push(join(process.env.ProgramW6432||process.env.ProgramFiles||'C:\\Program Files','nodejs','node.exe'));
}
let executable;
for(const candidate of [...new Set(candidates)]){
  const result=spawnSync(candidate,['--version'],{encoding:'utf8',windowsHide:true});
  if(result.status===0 && supported(result.stdout)){executable=candidate;break;}
}
if(!executable){
  console.error('Node.js 22.12 이상이 필요합니다. 최신 Node.js를 설치한 후 PowerShell을 다시 열어 주세요.');
  process.exit(1);
}
if(executable!==process.execPath)console.log('가계부는 설치된 최신 Node.js로 실행합니다.');
const child=spawn(executable,[...command,...process.argv.slice(3)],{cwd:root,stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
process.on('SIGINT',()=>child.kill('SIGINT'));
process.on('SIGTERM',()=>child.kill('SIGTERM'));

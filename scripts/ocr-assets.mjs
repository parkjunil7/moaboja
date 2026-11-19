import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// npm lockfile로 고정된 인식 코드/모델을 같은 사이트에서 제공합니다.
export async function prepareOcrAssets() {
  const target=resolve('public/ocr/v7');
  await mkdir(target,{recursive:true});
  await copyFile(resolve('node_modules/tesseract.js/dist/worker.min.js'),resolve(target,'worker.min.js'));
  const core=resolve('node_modules/tesseract.js-core');
  for(const file of await readdir(core)) {
    if(file.endsWith('.wasm.js')||file.endsWith('.wasm')) await copyFile(resolve(core,file),resolve(target,file));
  }
  for(const lang of ['kor','eng']) await copyFile(resolve(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`),resolve(target,`${lang}.traineddata.gz`));
  await copyFile(resolve('node_modules/tesseract.js/LICENSE.md'),resolve(target,'LICENSE-tesseract.txt'));
  await copyFile(resolve('node_modules/tesseract.js-core/LICENSE'),resolve(target,'LICENSE-core.txt'));
}

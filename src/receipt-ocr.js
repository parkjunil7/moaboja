const abortError=()=>new DOMException('인식을 취소했어요.','AbortError');
export async function recognizeReceipt(file,{signal,onProgress=()=>{}}={}){
  if(!file||!file.size)throw new Error('사진을 선택해 주세요.');
  if(file.size>20*1024*1024)throw new Error('사진은 20MB 이하로 선택해 주세요.');
  if(file.type&&!file.type.startsWith('image/'))throw new Error('JPG·PNG 등 사진 파일을 선택해 주세요.');
  if(/svg|gif/i.test(file.type))throw new Error('JPG·PNG·WebP 사진을 선택해 주세요.');
  if(signal?.aborted)throw abortError();
  let worker,url,canvas,timer,abortHandler;
  let stopped=false;
  const interrupted=new Promise((_,reject)=>{
    abortHandler=()=>{stopped=true;void worker?.terminate();reject(abortError());};
    signal?.addEventListener('abort',abortHandler,{once:true});
    timer=setTimeout(()=>{stopped=true;void worker?.terminate();reject(new Error('인식 시간이 오래 걸려 중단했어요. 영수증을 밝고 가깝게 다시 찍어 주세요.'));},120000);
  });
  const work=(async()=>{
    onProgress('사진을 준비하고 있어요.',5);
    url=URL.createObjectURL(file);
    const img=new Image();img.src=url;
    try{await img.decode();}catch{throw new Error('이 사진 형식을 열 수 없어요. JPG·PNG 사진이나 화면 캡처를 선택해 주세요.');}
    if(stopped)throw abortError();
    if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>50_000_000)throw new Error('사진 크기가 너무 커요. 영수증 부분만 잘라서 선택해 주세요.');
    const scale=Math.min(1,2600/Math.max(img.naturalWidth,img.naturalHeight));
    canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const {createWorker}=await import('tesseract.js');
    if(stopped)throw abortError();
    const base=new URL(import.meta.env.BASE_URL+'ocr/v7/',document.baseURI).href;
    onProgress('처음에는 인식 파일을 내려받아요. 잠시 기다려 주세요.',10);
    const starting=createWorker(['kor','eng'],1,{
      workerPath:base+'worker.min.js',corePath:base,langPath:base.replace(/\/$/,''),workerBlobURL:false,
      errorHandler:()=>{}, // 오류는 작업 Promise에서 받아 화면에 안내합니다.
      logger:m=>{if(!stopped){const reading=m.status==='recognizing text';onProgress(reading?'영수증 글자를 읽고 있어요.':'인식을 준비하고 있어요. 처음에는 시간이 걸릴 수 있어요.',reading?Math.round(40+m.progress*55):20);}},
    });
    starting.then(w=>{if(stopped)void w.terminate();},()=>{});
    worker=await starting;if(stopped)throw abortError();
    await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300'});
    const {data}=await worker.recognize(canvas,{rotateAuto:true});
    if(stopped)throw abortError();
    onProgress('읽은 내용을 정리하고 있어요.',100);
    return {text:data.text,confidence:data.confidence};
  })();
  try{return await Promise.race([work,interrupted]);}
  finally{stopped=true;clearTimeout(timer);signal?.removeEventListener('abort',abortHandler);if(worker)await worker.terminate();if(url)URL.revokeObjectURL(url);if(canvas){canvas.width=0;canvas.height=0;}}
}

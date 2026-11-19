import {client} from './data.js';

export async function recognizeReceiptAI(file,{signal,onProgress=()=>{}}={}){
  if(!file?.size||file.size>20*1024*1024)throw new Error('20MB 이하의 사진을 선택해 주세요.');
  if((file.type&&!file.type.startsWith('image/'))||/svg|gif/i.test(file.type))throw new Error('JPG·PNG·WebP 사진을 선택해 주세요.');
  const url=URL.createObjectURL(file),img=new Image();img.src=url;let canvas;
  try{
    onProgress('사진을 준비하고 있어요.',10);
    try{await img.decode();}catch{throw new Error('사진을 열 수 없어요. JPG·PNG 사진을 선택해 주세요.');}
    signal?.throwIfAborted();
    if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>50_000_000)throw new Error('사진이 너무 커요. 영수증 부분만 잘라서 선택해 주세요.');
    const scale=Math.min(1,2000/Math.max(img.naturalWidth,img.naturalHeight));
    canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const image=canvas.toDataURL('image/jpeg',.92);
    if(image.length>6_000_000)throw new Error('사진 용량이 너무 커요. 더 작은 사진을 선택해 주세요.');
    const {data:{session}}=await client.auth.getSession();
    if(!session)throw new Error('다시 로그인한 뒤 이용해 주세요.');
    signal?.throwIfAborted();onProgress('AI가 날짜·상호·결제금액을 읽고 있어요.',40);
    const signals=[AbortSignal.timeout(70_000)];if(signal)signals.push(signal);
    const response=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/receipt-ai',{
      method:'POST',signal:AbortSignal.any(signals),headers:{'Content-Type':'application/json','apikey':import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+session.access_token},
      body:JSON.stringify({image,consent:true,request_id:crypto.randomUUID()}),
    });
    let result;try{result=await response.json();}catch{throw new Error('AI 서버 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');}
    if(!response.ok)throw new Error(result.error||'AI 인식을 완료하지 못했어요.');
    if(!result.draft||!Array.isArray(result.draft.warnings))throw new Error('AI 인식 결과가 올바르지 않아요.');
    onProgress('읽은 내용을 확인해 주세요.',100);return result.draft;
  }catch(error){
    if(signal?.aborted)throw new DOMException('인식 취소','AbortError');
    if(error.name==='TimeoutError')throw new Error('AI 응답이 늦어 중단했어요. 잠시 후 다시 시도해 주세요.');
    throw error;
  }finally{URL.revokeObjectURL(url);if(canvas){canvas.width=canvas.height=0;}}
}

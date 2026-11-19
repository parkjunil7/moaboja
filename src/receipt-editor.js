import {rectifyReceipt} from './receipt-image.js';

export async function prepareReceipt(file,host,{signal}={}){
  if(!file?.size||file.size>20*1024*1024)throw new Error('20MB 이하의 사진을 선택해 주세요.');
  if((file.type&&!file.type.startsWith('image/'))||/svg|gif/i.test(file.type))throw new Error('JPG·PNG·WebP 사진을 선택해 주세요.');
  const url=URL.createObjectURL(file),img=new Image();img.src=url;
  try{await img.decode();}catch{throw new Error('사진을 열 수 없어요. JPG·PNG 사진을 선택해 주세요.');}finally{URL.revokeObjectURL(url);}
  if(signal?.aborted)throw new DOMException('취소','AbortError');
  if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>50_000_000)throw new Error('사진이 너무 커요. 영수증 부분만 잘라서 선택해 주세요.');
  let source=document.createElement('canvas');
  const scale=Math.min(1,3200/Math.max(img.naturalWidth,img.naturalHeight));
  source.width=Math.round(img.naturalWidth*scale);source.height=Math.round(img.naturalHeight*scale);
  const sctx=source.getContext('2d');sctx.fillStyle='white';sctx.fillRect(0,0,source.width,source.height);sctx.drawImage(img,0,0,source.width,source.height);
  host.innerHTML='<p><strong>영수증 네 모서리를 맞춰 주세요.</strong><br>번호를 선택한 뒤 사진을 누르거나 점을 끌어 옮기세요. 배경·화면 글자는 제외해 주세요.</p><div class="receipt-corners">'+['① 좌상','② 우상','③ 우하','④ 좌하'].map((n,i)=>`<button type="button" class="secondary" data-corner="${i}" aria-pressed="${i===0}">${n}</button>`).join('')+'</div><canvas class="receipt-crop" aria-label="영수증 영역 선택 사진"></canvas><p class="small muted">화면을 다시 찍은 사진은 줄무늬 때문에 잘 읽히지 않을 수 있어요. 원본 사진을 권장해요.</p><div class="receipt-pickers"><button type="button" class="secondary" id="receipt-rotate">90° 회전</button><button type="button" class="secondary" id="receipt-reset">영역 초기화</button></div><p class="form-error" role="alert"></p><button type="button" class="primary full" id="receipt-read-area">이 영역 인식하기</button>';
  const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d');let points,selected=0,dragging=false;
  canvas.tabIndex=0;
  canvas.setAttribute('aria-description','숫자 1~4로 모서리를 선택하고 방향키로 이동할 수 있어요.');
  const reset=()=>{points=[{x:.04*source.width,y:.04*source.height},{x:.96*source.width,y:.04*source.height},{x:.96*source.width,y:.96*source.height},{x:.04*source.width,y:.96*source.height}];};
  const draw=()=>{
    const factor=Math.min(560/source.width,580/source.height);canvas.width=Math.round(source.width*factor);canvas.height=Math.round(source.height*factor);
    ctx.drawImage(source,0,0,canvas.width,canvas.height);ctx.fillStyle='#0007';ctx.beginPath();ctx.rect(0,0,canvas.width,canvas.height);
    points.forEach((p,i)=>i?ctx.lineTo(p.x*factor,p.y*factor):ctx.moveTo(p.x*factor,p.y*factor));ctx.closePath();ctx.fill('evenodd');
    ctx.strokeStyle='#e4ff74';ctx.lineWidth=2;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x*factor,p.y*factor):ctx.moveTo(p.x*factor,p.y*factor));ctx.closePath();ctx.stroke();
    points.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x*factor,p.y*factor,13,0,2*Math.PI);ctx.fillStyle=i===selected?'#e4ff74':'#fff';ctx.fill();ctx.fillStyle='#172d24';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),p.x*factor,p.y*factor);});
    host.querySelectorAll('[data-corner]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.corner)===selected)));
  };
  reset();draw();
  canvas.onkeydown=e=>{if(/^[1-4]$/.test(e.key)){selected=Number(e.key)-1;draw();return;}const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(moves[e.key]){e.preventDefault();const [dx,dy]=moves[e.key],step=e.shiftKey?10:1;points[selected].x=Math.max(0,Math.min(source.width-1,points[selected].x+dx*step));points[selected].y=Math.max(0,Math.min(source.height-1,points[selected].y+dy*step));draw();}};
  host.querySelectorAll('[data-corner]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.corner);draw();});
  const position=e=>{const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(source.width-1,(e.clientX-r.left)/r.width*source.width)),y:Math.max(0,Math.min(source.height-1,(e.clientY-r.top)/r.height*source.height))};};
  canvas.onpointerdown=e=>{const p=position(e),r=canvas.getBoundingClientRect();const nearest=points.map((q,i)=>({i,d:Math.hypot((q.x-p.x)*r.width/source.width,(q.y-p.y)*r.height/source.height)})).sort((a,b)=>a.d-b.d)[0];if(nearest.d<28)selected=nearest.i;points[selected]=p;dragging=true;canvas.setPointerCapture(e.pointerId);draw();};
  canvas.onpointermove=e=>{if(dragging){points[selected]=position(e);draw();}};
  canvas.onpointerup=canvas.onpointercancel=()=>{dragging=false;};
  host.querySelector('#receipt-reset').onclick=()=>{reset();draw();};
  host.querySelector('#receipt-rotate').onclick=()=>{const rotated=document.createElement('canvas');rotated.width=source.height;rotated.height=source.width;const c=rotated.getContext('2d');c.translate(rotated.width,0);c.rotate(Math.PI/2);c.drawImage(source,0,0);source.width=source.height=0;source=rotated;reset();draw();};
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{signal?.removeEventListener('abort',abort);source.width=source.height=canvas.width=canvas.height=0;host.replaceChildren();};
    const abort=()=>{cleanup();reject(new DOMException('취소','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    host.querySelector('#receipt-read-area').onclick=async()=>{
      const button=host.querySelector('#receipt-read-area');button.disabled=true;
      try{const output=rectifyReceipt(source,points);const blob=await new Promise(r=>output.toBlob(r,'image/png'));output.width=output.height=0;if(signal?.aborted)return;if(!blob)throw new Error('사진을 준비하지 못했어요.');cleanup();resolve(new File([blob],'receipt-cropped.png',{type:'image/png'}));}
      catch(error){if(signal?.aborted)return;host.querySelector('.form-error').textContent=error.message;button.disabled=false;}
    };
  });
}

// 네 모서리(좌상, 우상, 우하, 좌하)를 직사각형으로 펴는 역방향 투영.
export function receiptProjection(points) {
  if(points.length!==4||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error('영수증 네 모서리를 맞춰 주세요.');
  for(let i=0;i<4;i++){
    const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];
    if((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)<=1)throw new Error('모서리가 겹치지 않도록 좌상·우상·우하·좌하 순서로 맞춰 주세요.');
  }
  const [a,b,c,d]=points,dx1=b.x-c.x,dx2=d.x-c.x,dx3=a.x-b.x+c.x-d.x;
  const dy1=b.y-c.y,dy2=d.y-c.y,dy3=a.y-b.y+c.y-d.y,det=dx1*dy2-dx2*dy1;
  if(Math.abs(det)<1e-8)throw new Error('영수증 영역을 넓게 선택해 주세요.');
  const g=(dx3*dy2-dx2*dy3)/det,h=(dx1*dy3-dx3*dy1)/det;
  return (u,v)=>{const z=g*u+h*v+1;return {x:((b.x-a.x+g*b.x)*u+(d.x-a.x+h*d.x)*v+a.x)/z,y:((b.y-a.y+g*b.y)*u+(d.y-a.y+h*d.y)*v+a.y)/z};};
}

export function rectifyReceipt(source,points){
  const project=receiptProjection(points),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const width=Math.max(distance(points[0],points[1]),distance(points[3],points[2]));
  const height=Math.max(distance(points[0],points[3]),distance(points[1],points[2]));
  if(Math.min(width,height)<50)throw new Error('영수증 영역이 너무 작아요. 더 가까이 찍은 사진을 선택해 주세요.');
  const scale=Math.min(3,1600/width,2600/Math.max(width,height));
  const out=document.createElement('canvas');out.width=Math.round(width*scale);out.height=Math.round(height*scale);
  const pixels=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
  const ctx=out.getContext('2d'),result=ctx.createImageData(out.width,out.height);
  for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){
    const p=project(x/(out.width-1),y/(out.height-1));
    const sx=Math.max(0,Math.min(source.width-1,p.x)),sy=Math.max(0,Math.min(source.height-1,p.y));
    const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
    const at=(xx,yy)=>4*(Math.min(yy,source.height-1)*source.width+Math.min(xx,source.width-1));
    const aa=at(ix,iy),bb=at(ix+1,iy),cc=at(ix,iy+1),dd=at(ix+1,iy+1),j=4*(y*out.width+x);
    for(let k=0;k<3;k++)result.data[j+k]=(1-fy)*((1-fx)*pixels[aa+k]+fx*pixels[bb+k])+fy*((1-fx)*pixels[cc+k]+fx*pixels[dd+k]);
    result.data[j+3]=255;
  }
  ctx.putImageData(result,0,0);return out;
}

export function enhanceReceipt(canvas){
  const ctx=canvas.getContext('2d'),image=ctx.getImageData(0,0,canvas.width,canvas.height),d=image.data;
  const histogram=new Uint32Array(256);
  for(let i=0;i<d.length;i+=4){const gray=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);histogram[gray]++;}
  const count=d.length/4;let sum=0,low=0,high=255;
  for(let i=0;i<256;i++){sum+=histogram[i];if(sum<count*.02)low=i;if(sum<count*.98)high=i;}
  const range=Math.max(30,high-low);
  for(let i=0;i<d.length;i+=4){const gray=Math.max(0,Math.min(255,(.299*d[i]+.587*d[i+1]+.114*d[i+2]-low)*255/range));d[i]=d[i+1]=d[i+2]=gray;}
  ctx.putImageData(image,0,0);
}

import { createClient } from 'npm:@supabase/supabase-js@2.78.0';
import { createReceiptHandler,ReceiptError } from './core.js';

const url=Deno.env.get('SUPABASE_URL')!;
const readKey=(name:string,legacy:string)=>{
  try{return JSON.parse(Deno.env.get(name)||'{}').default||Deno.env.get(legacy)||'';}catch{return Deno.env.get(legacy)||'';}
};
const publicKey=readKey('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY');
const adminKey=readKey('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
const admin=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});

Deno.serve(createReceiptHandler({
  apiKey:Deno.env.get('OPENAI_API_KEY')||'',
  async authenticate(req:Request){
    const bearer=req.headers.get('authorization')||'';
    if(!/^Bearer \S+$/.test(bearer))throw new ReceiptError(401,'로그인한 뒤 이용해 주세요.');
    const client=createClient(url,publicKey,{global:{headers:{Authorization:bearer}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await client.auth.getUser(bearer.slice(7));
    if(error||!data.user)throw new ReceiptError(401,'로그인이 만료됐어요. 다시 로그인해 주세요.');
    const {data:members,error:memberError}=await client.from('members').select('user_id').eq('user_id',data.user.id);
    if(memberError||members?.length!==1)throw new ReceiptError(403,'이 가계부의 멤버만 이용할 수 있어요.');
    return data.user;
  },
  async reserve(userId:string,requestId:string){
    const {data,error}=await admin.rpc('reserve_receipt_ai',{p_user_id:userId,p_request_id:requestId});
    if(error)throw new ReceiptError(503,'AI 이용 횟수를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    if(data!==true)throw new ReceiptError(429,'인식 횟수를 초과했거나 이미 처리한 요청이에요. 1인 하루 20회, 두 사람 합계 월 300회까지 이용할 수 있어요.');
  },
}));

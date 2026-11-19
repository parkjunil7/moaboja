begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to service_role;
create table private.receipt_ai_requests (
  request_id uuid primary key,
  user_id uuid not null references public.members(user_id),
  created_at timestamptz not null default now()
);
alter table private.receipt_ai_requests enable row level security;
revoke all on private.receipt_ai_requests from public,anon,authenticated;
grant select,insert,delete on private.receipt_ai_requests to service_role;
create index receipt_ai_created_idx on private.receipt_ai_requests(created_at);

create function public.reserve_receipt_ai(p_user_id uuid,p_request_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare
  day_start timestamptz := date_trunc('day',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  month_start timestamptz := date_trunc('month',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if p_request_id is null or not exists(select 1 from public.members where user_id=p_user_id) then return false; end if;
  -- 모든 서버 인스턴스에 공통으로 적용. 사진과 인식 본문은 저장하지 않습니다.
  perform pg_catalog.pg_advisory_xact_lock(673419028);
  if exists(select 1 from private.receipt_ai_requests where request_id=p_request_id) then return false; end if;
  if (select count(*) from private.receipt_ai_requests where created_at>=day_start and user_id=p_user_id)>=20 then return false; end if;
  if (select count(*) from private.receipt_ai_requests where created_at>=month_start)>=300 then return false; end if;
  insert into private.receipt_ai_requests(request_id,user_id) values(p_request_id,p_user_id);
  delete from private.receipt_ai_requests where created_at<now()-interval '90 days';
  return true;
end;
$$;
revoke all on function public.reserve_receipt_ai(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_receipt_ai(uuid,uuid) to service_role;
commit;

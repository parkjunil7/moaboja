-- 새 가계부 전용 Supabase 프로젝트의 SQL Editor에서 한 번 실행합니다.
begin;
create table public.ledger_lock (id boolean primary key default true check (id));
insert into public.ledger_lock values (true);

create table public.members (
  slot smallint primary key check (slot in (1,2)),
  user_id uuid not null unique references auth.users(id),
  name text not null check (length(trim(name)) between 1 and 30)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 40),
  report_key text not null default 'other' check (report_key in ('interest','fixed','groceries','dining','other')),
  position integer not null default 99
);
create table public.items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  name text not null check (length(trim(name)) between 1 and 40),
  unique(category_id,name), unique(id,category_id)
);
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  category_id uuid not null references public.categories(id),
  item_id uuid,
  foreign key(item_id,category_id) references public.items(id,category_id)
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null,
  period integer generated always as (extract(year from spent_on)::integer * 100 + extract(month from spent_on)::integer) stored,
  amount bigint not null check(amount between 1 and 1000000000),
  category_id uuid not null references public.categories(id),
  item_id uuid,
  description text not null check(length(trim(description)) between 1 and 120),
  payer smallint not null references public.members(slot),
  share1 bigint not null check(share1 >= 0 and share1 <= amount),
  note text not null default '' check(length(note) <= 1000),
  template_id uuid references public.templates(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  version integer not null default 1,
  foreign key(item_id,category_id) references public.items(id,category_id),
  unique(template_id,period)
);
create index expenses_date_idx on public.expenses(spent_on);
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  month date not null check(extract(day from month)=1),
  sent_on date not null,
  sender smallint not null references public.members(slot),
  amount bigint not null check(amount between 1 and 1000000000),
  note text not null default '' check(length(note) <= 1000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index transfers_month_idx on public.transfers(month);

create function public.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where user_id = (select auth.uid()));
$$;
create function public.require_member() returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member() then raise exception '가계부 멤버만 접근할 수 있습니다.' using errcode='42501'; end if;
end;
$$;

alter table public.ledger_lock enable row level security;
alter table public.members enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.templates enable row level security;
alter table public.expenses enable row level security;
alter table public.transfers enable row level security;
-- 읽기는 RLS, 쓰기는 검증을 수행하는 RPC만 허용. 멤버는 관리자 초대 스크립트만 등록.
revoke all on public.ledger_lock, public.members, public.categories, public.items, public.templates, public.expenses, public.transfers from anon, authenticated;
grant select on public.members, public.categories, public.items, public.templates, public.expenses, public.transfers to authenticated;
grant all on public.members, public.categories, public.items, public.templates, public.expenses, public.transfers to service_role;
create policy member_read on public.members for select to authenticated using(public.is_member());
create policy member_read on public.categories for select to authenticated using(public.is_member());
create policy member_read on public.items for select to authenticated using(public.is_member());
create policy member_read on public.templates for select to authenticated using(public.is_member());
create policy member_read on public.expenses for select to authenticated using(public.is_member());
create policy member_read on public.transfers for select to authenticated using(public.is_member());

create function public.save_expense(p jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := (p->>'id')::uuid; v_version integer := coalesce((p->>'version')::integer,0); v_amount bigint; v_share1 bigint; v_share2 bigint;
begin
  perform public.require_member();
  perform 1 from public.ledger_lock where id for update;
  if (select count(*) from public.members) <> 2 then raise exception '두 사람의 초대를 먼저 완료해 주세요.'; end if;
  v_amount := (p->>'amount')::bigint; v_share1 := (p->>'share1')::bigint; v_share2 := (p->>'share2')::bigint;
  if v_amount is null or v_share1 is null or v_share2 is null or v_share1 + v_share2 <> v_amount or v_share1 < 0 or v_share2 < 0
    or (p->>'amount') !~ '^[0-9]+$' or (p->>'share1') !~ '^[0-9]+$' or (p->>'share2') !~ '^[0-9]+$'
    then raise exception '부담액 합계는 결제액과 일치해야 하며 원 단위로 입력해야 합니다.'; end if;
  if (p->>'spent_on')::date > (now() at time zone 'Asia/Seoul')::date then raise exception '실제 지출일은 오늘 이후일 수 없습니다.'; end if;
  if v_version = 0 then
    insert into public.expenses(id,spent_on,amount,category_id,item_id,description,payer,share1,note,template_id,created_by)
    values(coalesce(v_id,gen_random_uuid()),(p->>'spent_on')::date,v_amount,(p->>'category_id')::uuid,nullif(p->>'item_id','')::uuid,
      trim(p->>'description'),(p->>'payer')::smallint,v_share1,coalesce(p->>'note',''),nullif(p->>'template_id','')::uuid,auth.uid()) returning id into v_id;
  else
    update public.expenses set spent_on=(p->>'spent_on')::date,amount=v_amount,category_id=(p->>'category_id')::uuid,
      item_id=nullif(p->>'item_id','')::uuid, description=trim(p->>'description'),payer=(p->>'payer')::smallint,share1=v_share1,
      note=coalesce(p->>'note',''),version=version+1
      where id=v_id and version=v_version;
    if not found then raise exception '다른 기기에서 변경된 내역입니다. 새로고침 후 다시 시도해 주세요.'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception '이미 등록된 내역이거나 같은 반복 템플릿이 해당 월에 등록되어 있습니다.' using errcode='23505';
end;
$$;

create function public.delete_expense(p_id uuid,p_version integer) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_member();
  perform 1 from public.ledger_lock where id for update;
  delete from public.expenses where id=p_id and version=p_version;
  if not found then raise exception '다른 기기에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.'; end if;
end;
$$;

-- 양수면 2번 멤버가 1번 멤버에게 보낼 금액. 음수면 반대 방향.
create function public.month_balance(p_month date) returns bigint language plpgsql stable security definer set search_path = '' as $$
declare result bigint;
begin
  perform public.require_member();
  select coalesce(sum((case when payer=1 then amount else 0 end)-share1),0) into result
    from public.expenses where spent_on >= date_trunc('month',p_month)::date and spent_on < (date_trunc('month',p_month)+interval '1 month')::date;
  select result + coalesce(sum(case when sender=1 then amount else -amount end),0) into result
    from public.transfers where month=date_trunc('month',p_month)::date;
  return result;
end;
$$;
create function public.save_transfer(p jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_due bigint; v_amount bigint := (p->>'amount')::bigint; v_sender smallint := (p->>'sender')::smallint; v_id uuid;
begin
  perform public.require_member();
  perform 1 from public.ledger_lock where id for update;
  v_due := public.month_balance((p->>'month')::date);
  if v_sender is null or v_sender not in (1,2) or v_amount is null or v_amount < 1 or v_amount > abs(v_due)
    or (p->>'amount') !~ '^[0-9]+$' or (v_due > 0 and v_sender <> 2) or (v_due < 0 and v_sender <> 1) then
    raise exception '송금 방향과 해당 월의 남은 정산액을 확인해 주세요.';
  end if;
  if (p->>'sent_on')::date > (now() at time zone 'Asia/Seoul')::date then raise exception '실제 송금일은 오늘 이후일 수 없습니다.'; end if;
  insert into public.transfers(id,month,sent_on,sender,amount,note,created_by)
    values(coalesce((p->>'id')::uuid,gen_random_uuid()),(p->>'month')::date,(p->>'sent_on')::date,v_sender,v_amount,coalesce(p->>'note',''),auth.uid()) returning id into v_id;
  return v_id;
end;
$$;
create function public.delete_transfer(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_member();
  perform 1 from public.ledger_lock where id for update;
  delete from public.transfers where id=p_id;
  if not found then raise exception '이미 삭제된 송금입니다.'; end if;
end;
$$;
create function public.save_setting(p_kind text,p jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
begin
  perform public.require_member();
  if p_kind='category' then
    insert into public.categories(id,name) values(v_id,trim(p->>'name')) on conflict(id) do update set name=excluded.name;
  elsif p_kind='item' then
    insert into public.items(id,category_id,name) values(v_id,(p->>'category_id')::uuid,trim(p->>'name')) on conflict(id) do update set name=excluded.name;
  elsif p_kind='template' then
    insert into public.templates(id,name,category_id,item_id) values(v_id,trim(p->>'name'),(p->>'category_id')::uuid,nullif(p->>'item_id','')::uuid)
      on conflict(id) do update set name=excluded.name,category_id=excluded.category_id,item_id=excluded.item_id;
  else raise exception '지원하지 않는 설정입니다.';
  end if;
  return v_id;
end;
$$;
revoke all on function public.is_member(),public.require_member(),public.save_expense(jsonb),public.delete_expense(uuid,integer),public.month_balance(date),public.save_transfer(jsonb),public.delete_transfer(uuid),public.save_setting(text,jsonb) from public,anon;
grant execute on function public.is_member(),public.save_expense(jsonb),public.delete_expense(uuid,integer),public.month_balance(date),public.save_transfer(jsonb),public.delete_transfer(uuid),public.save_setting(text,jsonb) to authenticated;

insert into public.categories(name,report_key,position) values
('이자·금융비용','interest',1),('고정 생활비','fixed',2),('생활비','groceries',3),('경조사비','other',4),
('외식비','dining',5),('교통비','other',6),('여가·여행비','other',7),('기타','other',8);
insert into public.items(category_id,name)
select c.id, unnest(v.names) from (values
('이자·금융비용',array['전세대출 이자','마이너스통장 이자','대출 보험료·보증료','추가 이자']),
('고정 생활비',array['관리비','주차비','전기·가스·수도','인터넷','정기 구독']),
('생활비',array['생수','식재료·식품','과자','음료수','생필품']),
('경조사비',array['축의금','부의금','경조사 선물']),
('외식비',array['식당','배달','카페']),('교통비',array['대중교통','택시','주유','통행료']),
('여가·여행비',array['영화','공연','숙박','여행 중 지출']),('기타',array['의료·약국','가전·가구'])
) as v(category,names) join public.categories c on c.name=v.category;
insert into public.templates(name,category_id,item_id) select name,category_id,id from public.items where name in ('관리비','주차비');
commit;

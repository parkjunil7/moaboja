-- 기존 데이터의 분류/금액을 보존하면서 입력에 보이는 기본 항목을 변경합니다.
-- 001, 002 적용 후 실행하세요. 이 파일은 재실행해도 같은 항목을 중복 생성하지 않습니다.
begin;
alter table public.items add column if not exists active boolean not null default true;

update public.items i set active=false
from public.categories c
where i.category_id=c.id and c.report_key='fixed'
  and i.name in ('전기·가스·수도','인터넷','정기 구독');

insert into public.items(category_id,name)
select id,'외부 주차료' from public.categories where name='교통비'
on conflict(category_id,name) do update set active=true;

insert into public.items(category_id,name)
select id,'빙과(빙수)' from public.categories where report_key='dining'
on conflict(category_id,name) do update set active=true;

insert into public.categories(name,report_key,position) values('운동·배움','other',8)
on conflict(name) do nothing;
update public.categories set position=9 where name='기타' and position=8;
insert into public.items(category_id,name)
select c.id,unnest(array['헬스비','수영비','운동 강습비','기타 수업료'])
from public.categories c where c.name='운동·배움'
on conflict(category_id,name) do update set active=true;
commit;

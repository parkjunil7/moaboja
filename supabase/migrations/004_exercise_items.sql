-- 기존 기록에 연결된 항목은 유지하고 새 입력에서 숨깁니다.
begin;
update public.items i set active=false
from public.categories c
where i.category_id=c.id and c.name='운동·배움' and i.name='운동 강습비';
update public.categories set position=1000000 where name='기타';
commit;

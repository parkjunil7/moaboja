-- 한 번의 읽기로 일관된 월별 집계를 구성합니다. PostgREST 1,000행 제한의 잘림을 피합니다.
create function public.get_ledger() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_member();
  return jsonb_build_object(
    'members',coalesce((select jsonb_agg(m order by slot) from public.members m),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(c order by position,name) from public.categories c),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(i order by name) from public.items i),'[]'::jsonb),
    'templates',coalesce((select jsonb_agg(t order by name) from public.templates t),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(e order by spent_on desc,created_at desc) from public.expenses e),'[]'::jsonb),
    'transfers',coalesce((select jsonb_agg(t order by sent_on desc,created_at desc) from public.transfers t),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_ledger() from public,anon;
grant execute on function public.get_ledger() to authenticated;

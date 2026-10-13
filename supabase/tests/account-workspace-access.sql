-- Synthetic fixtures; execute in a transaction and leave no persisted test data.
begin;
create temporary table wf_workspace_test(owner_a uuid,owner_b uuid,mutation uuid);
insert into wf_workspace_test values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
grant select on wf_workspace_test to authenticated;
insert into auth.users(id,email) select owner_a,'workspace-a@worldforge-test.invalid' from wf_workspace_test
  union all select owner_b,'workspace-b@worldforge-test.invalid' from wf_workspace_test;
select set_config('request.jwt.claim.sub',owner_a::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',owner_a,'aal','aal1')::text,true) from wf_workspace_test;
set local role authenticated;
do $$
declare
  v_payload jsonb := '{"activeId":"fixture","preferences":{"theme":"light","profileName":"Teste"},"worlds":[{"id":"fixture","data":{"metadata":{"nome":"Teste"},"reinos":[],"cidades":[],"npcs":[],"monstros":[],"missoes":[],"relacoes":[],"eventos":[],"estado_mundo":{"turno":1}}}]}';
  v_loaded jsonb; v_result jsonb; v_mutation uuid := (select mutation from wf_workspace_test);
begin
  v_loaded := public.wf_load_workspace();
  if v_loaded->>'revision' <> '0' or jsonb_array_length(v_loaded->'worlds') <> 0 then raise exception 'New account not empty';end if;
  v_result := public.wf_save_workspace(v_payload,0,v_mutation);
  if v_result->>'revision' <> '1' then raise exception 'Save not acknowledged';end if;
  v_result := public.wf_save_workspace(v_payload,0,v_mutation);
  if v_result->>'revision' <> '1' then raise exception 'Replay changed revision';end if;
  v_loaded := public.wf_load_workspace();
  if v_loaded->'preferences'->>'profileName' <> 'Teste' or jsonb_array_length(v_loaded->'worlds') <> 1 then raise exception 'Reload lost data';end if;
  begin
    perform public.wf_save_workspace(v_payload,0,gen_random_uuid());raise exception 'Stale revision accepted';
  exception when sqlstate 'PT409' then null;end;
  begin
    perform public.wf_save_workspace(jsonb_set(v_payload,'{preferences,theme}','"dark"'),0,v_mutation);raise exception 'Mutation reused with different payload';
  exception when invalid_parameter_value then null;end;
  begin
    perform public.wf_save_workspace(jsonb_set(v_payload,'{worlds}','[{"id":"bad"}]'),1,gen_random_uuid());raise exception 'Malformed world accepted';
  exception when invalid_parameter_value then null;end;
  begin
    update public.worldforge_worlds set name='Bypassed' where owner_id=auth.uid();raise exception 'Direct write bypassed revision';
  exception when insufficient_privilege then null;end;
  v_result := public.wf_save_workspace('{"activeId":null,"preferences":{"theme":"dark"},"worlds":[]}',1,gen_random_uuid());
  if v_result->>'revision' <> '2' or jsonb_array_length(public.wf_load_workspace()->'worlds') <> 0 then raise exception 'Deletion not atomic';end if;
end;
$$;
reset role;
select set_config('request.jwt.claim.sub',owner_b::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',owner_b,'aal','aal1')::text,true) from wf_workspace_test;
set local role authenticated;
do $$
begin
  if exists(select 1 from public.worldforge_account_state) or exists(select 1 from public.worldforge_worlds) then raise exception 'Another account visible';end if;
end;
$$;
reset role;
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
  select gen_random_uuid(),owner_a,'totp','verified',now(),now() from wf_workspace_test;
select set_config('request.jwt.claim.sub',owner_a::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',owner_a,'aal','aal1')::text,true) from wf_workspace_test;
set local role authenticated;
do $$
begin
  begin perform public.wf_load_workspace();raise exception 'MFA bypassed on read';exception when insufficient_privilege then null;end;
  begin perform public.wf_save_workspace('{"worlds":[],"activeId":null,"preferences":{}}',2,gen_random_uuid());raise exception 'MFA bypassed on write';exception when insufficient_privilege then null;end;
end;
$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_a,'aal','aal2')::text,true) from wf_workspace_test;
set local role authenticated;
do $$ begin if public.wf_load_workspace()->>'revision'<>'2' then raise exception 'AAL2 could not read';end if;end;$$;
reset role;
set local role anon;
do $$ begin begin perform public.wf_load_workspace();raise exception 'Anonymous read allowed';exception when insufficient_privilege then null;end;end;$$;
reset role;
rollback;

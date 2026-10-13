-- The account is the source of truth. Atomic saves use a revision and mutation ID.
create table public.worldforge_account_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 4194304),
  active_world_id text check (char_length(active_world_id) between 1 and 120),
  revision bigint not null default 0 check (revision >= 0),
  last_mutation_id uuid,
  last_payload_hash text,
  updated_at timestamptz not null default now()
);
alter table public.worldforge_account_state enable row level security;
create policy account_state_owner on public.worldforge_account_state
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy account_state_mfa on public.worldforge_account_state as restrictive
  for all to authenticated using ((select private.worldforge_mfa_satisfied()))
  with check ((select private.worldforge_mfa_satisfied()));
revoke all on public.worldforge_account_state from public, anon, authenticated;
grant select on public.worldforge_account_state to authenticated;
-- Older clients cannot bypass the account revision with direct REST mutations.
revoke insert, update, delete on public.worldforge_worlds from authenticated;

create function public.wf_load_workspace() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := (select auth.uid()); v_result jsonb;
begin
  if v_owner is null or not private.worldforge_mfa_satisfied() then
    raise exception 'Authentication and MFA required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'revision', coalesce(s.revision, 0), 'preferences', coalesce(s.preferences, '{}'::jsonb),
    'activeId', s.active_world_id,
    'worlds', coalesce((select jsonb_agg(jsonb_build_object(
      'id', w.local_id, 'name', w.name, 'data', w.world,
      'createdAt', w.created_at, 'updatedAt', w.updated_at) order by w.updated_at desc)
      from public.worldforge_worlds w where w.owner_id = v_owner), '[]'::jsonb)
  ) into v_result from (select v_owner as id) o
    left join public.worldforge_account_state s on s.owner_id = o.id;
  return v_result;
end;
$$;

-- Kept outside exposed schemas; no owner ID can be supplied by a client.
create function private.wf_save_workspace(p_payload jsonb, p_expected_revision bigint, p_mutation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid()); v_state public.worldforge_account_state%rowtype;
  v_worlds jsonb; v_preferences jsonb; v_entry jsonb; v_ids text[] := '{}'; v_hash text;
begin
  if v_owner is null or not private.worldforge_mfa_satisfied() then
    raise exception 'Authentication and MFA required' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text) > 20971520
    or p_mutation_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid workspace' using errcode = '22023';
  end if;
  v_worlds := p_payload->'worlds'; v_preferences := p_payload->'preferences';
  if v_worlds is null or jsonb_typeof(v_worlds) is distinct from 'array' or jsonb_array_length(v_worlds) > 100
    or v_preferences is null or jsonb_typeof(v_preferences) is distinct from 'object'
    or octet_length(v_preferences::text) > 4194304
    or exists(select 1 from jsonb_object_keys(v_preferences) k where k not in (
      'theme','sound','notifications','profileName','profileBio','profileAvatar','profileBanner','profileAccent','widgets')) then
    raise exception 'Invalid workspace data' using errcode = '22023';
  end if;
  for v_entry in select value from jsonb_array_elements(v_worlds) loop
    if jsonb_typeof(v_entry) is distinct from 'object' or jsonb_typeof(v_entry->'id') is distinct from 'string'
      or char_length(v_entry->>'id') not between 1 and 120 or (v_entry->>'id') = any(v_ids)
      or jsonb_typeof(v_entry->'data') is distinct from 'object'
      or jsonb_typeof(v_entry->'data'->'metadata'->'nome') is distinct from 'string'
      or char_length(v_entry->'data'->'metadata'->>'nome') not between 1 and 160
      or jsonb_typeof(v_entry->'data'->'reinos') is distinct from 'array'
      or jsonb_typeof(v_entry->'data'->'cidades') is distinct from 'array'
      or jsonb_typeof(v_entry->'data'->'npcs') is distinct from 'array'
      or jsonb_typeof(v_entry->'data'->'monstros') is distinct from 'array'
      or jsonb_typeof(v_entry->'data'->'missoes') is distinct from 'array'
      or jsonb_typeof(v_entry->'data'->'relacoes') is distinct from 'array'
      or jsonb_typeof(v_entry->'data'->'eventos') is distinct from 'array'
      or jsonb_typeof(v_entry->'data'->'estado_mundo') is distinct from 'object' then
      raise exception 'Invalid world' using errcode = '22023';
    end if;
    v_ids := array_append(v_ids, v_entry->>'id');
  end loop;
  if p_payload->>'activeId' is not null and not (p_payload->>'activeId' = any(v_ids)) then
    raise exception 'Invalid active world' using errcode = '22023';
  end if;
  v_hash := md5(p_payload::text);
  insert into public.worldforge_account_state(owner_id) values(v_owner) on conflict do nothing;
  select * into strict v_state from public.worldforge_account_state where owner_id = v_owner for update;
  if v_state.last_mutation_id = p_mutation_id then
    if v_state.last_payload_hash <> v_hash then
      raise exception 'Mutation ID already used' using errcode = '22023';
    end if;
    return jsonb_build_object('revision', v_state.revision, 'updatedAt', v_state.updated_at);
  end if;
  if v_state.revision <> p_expected_revision then
    raise sqlstate 'PT409' using message = 'Workspace changed in another session. Export your draft and reload.';
  end if;
  for v_entry in select value from jsonb_array_elements(v_worlds) loop
    insert into public.worldforge_worlds(owner_id, local_id, name, world, created_at, updated_at)
    values(v_owner, v_entry->>'id', v_entry->'data'->'metadata'->>'nome', v_entry->'data',
      coalesce((v_entry->>'createdAt')::timestamptz, now()), coalesce((v_entry->>'updatedAt')::timestamptz, now()))
    on conflict(owner_id, local_id) do update set name = excluded.name, world = excluded.world, updated_at = excluded.updated_at;
  end loop;
  delete from public.worldforge_worlds where owner_id = v_owner and not(local_id = any(v_ids));
  update public.worldforge_account_state set preferences = v_preferences,
    active_world_id = p_payload->>'activeId', revision = revision + 1,
    last_mutation_id = p_mutation_id, last_payload_hash = v_hash, updated_at = now()
    where owner_id = v_owner returning * into v_state;
  return jsonb_build_object('revision', v_state.revision, 'updatedAt', v_state.updated_at);
end;
$$;

create function public.wf_save_workspace(p_payload jsonb, p_expected_revision bigint, p_mutation_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.wf_save_workspace(p_payload, p_expected_revision, p_mutation_id);
$$;
revoke all on function public.wf_load_workspace(), public.wf_save_workspace(jsonb,bigint,uuid),
  private.wf_save_workspace(jsonb,bigint,uuid) from public, anon;
grant execute on function public.wf_load_workspace(), public.wf_save_workspace(jsonb,bigint,uuid),
  private.wf_save_workspace(jsonb,bigint,uuid) to authenticated;

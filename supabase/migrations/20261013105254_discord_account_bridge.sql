-- Bridge credentials are hashed. Neither clients nor the bot receive service_role.
create table public.worldforge_discord_bot_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  guild_id text not null check (guild_id ~ '^[0-9]{15,22}$'),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.worldforge_discord_links (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id text not null unique check (discord_user_id ~ '^[0-9]{15,22}$'),
  discord_name text not null check (char_length(discord_name) between 1 and 100),
  guild_id text not null check (guild_id ~ '^[0-9]{15,22}$'),
  bot_key_id uuid not null references public.worldforge_discord_bot_keys(id) on delete cascade,
  linked_at timestamptz not null default now()
);
create table public.worldforge_discord_challenges (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  bot_key_id uuid not null references public.worldforge_discord_bot_keys(id) on delete cascade,
  discord_user_id text not null check (discord_user_id ~ '^[0-9]{15,22}$'),
  discord_name text not null check (char_length(discord_name) between 1 and 100),
  guild_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz
);
create index worldforge_discord_challenges_user_created_idx
  on public.worldforge_discord_challenges (bot_key_id, discord_user_id, created_at desc);
create index worldforge_discord_challenges_expiry_idx on public.worldforge_discord_challenges (expires_at);
create table public.worldforge_discord_link_attempts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.worldforge_discord_bot_keys enable row level security;
alter table public.worldforge_discord_links enable row level security;
alter table public.worldforge_discord_challenges enable row level security;
alter table public.worldforge_discord_link_attempts enable row level security;
revoke all on public.worldforge_discord_bot_keys, public.worldforge_discord_links,
  public.worldforge_discord_challenges, public.worldforge_discord_link_attempts from public, anon, authenticated;
grant all on public.worldforge_discord_bot_keys, public.worldforge_discord_links,
  public.worldforge_discord_challenges, public.worldforge_discord_link_attempts to service_role;
grant select, delete on public.worldforge_discord_links to authenticated;
create policy "Read own Discord link" on public.worldforge_discord_links
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Disconnect own Discord link" on public.worldforge_discord_links
  for delete to authenticated using (owner_id = (select auth.uid()));

-- These routines are invokers and callable exclusively by the server role.
create function public.wf_discord_create_challenge(p_bot_key_id uuid, p_user_id text,
  p_name text, p_token_hash text) returns jsonb language plpgsql security invoker
  set search_path = '' as $$
declare v_guild text;
begin
  select guild_id into v_guild from public.worldforge_discord_bot_keys
    where id=p_bot_key_id and active;
  if v_guild is null then return jsonb_build_object('status',403); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_bot_key_id::text || ':' || p_user_id,0));
  if (select count(*) from public.worldforge_discord_challenges
      where bot_key_id=p_bot_key_id and discord_user_id=p_user_id
      and created_at > now()-interval '1 hour') >= 10 then
    return jsonb_build_object('status',429);
  end if;
  -- Keep recent used challenges for rate limits; purge expired history.
  delete from public.worldforge_discord_challenges where expires_at < now()-interval '1 day';
  insert into public.worldforge_discord_challenges(token_hash,bot_key_id,discord_user_id,discord_name,guild_id)
    values(p_token_hash,p_bot_key_id,p_user_id,left(p_name,100),v_guild);
  return jsonb_build_object('status',200,'expires_in',600);
end $$;

create function public.wf_discord_claim(p_owner_id uuid,p_token_hash text) returns jsonb
  language plpgsql security invoker set search_path = '' as $$
declare v_challenge public.worldforge_discord_challenges; v_attempts integer;
begin
  insert into public.worldforge_discord_link_attempts(owner_id,attempts)
    values(p_owner_id,1) on conflict(owner_id) do update set
      attempts=case when worldforge_discord_link_attempts.window_start < now()-interval '1 hour'
        then 1 else worldforge_discord_link_attempts.attempts+1 end,
      window_start=case when worldforge_discord_link_attempts.window_start < now()-interval '1 hour'
        then now() else worldforge_discord_link_attempts.window_start end
    returning attempts into v_attempts;
  if v_attempts>20 then return jsonb_build_object('status',429); end if;
  select c.* into v_challenge from public.worldforge_discord_challenges c
    join public.worldforge_discord_bot_keys k on k.id=c.bot_key_id and k.active
    where c.token_hash=p_token_hash and c.used_at is null and c.expires_at>now()
    for update of c;
  if not found then return jsonb_build_object('status',400); end if;
  if exists(select 1 from public.worldforge_discord_links where owner_id=p_owner_id
      or discord_user_id=v_challenge.discord_user_id) then
    return jsonb_build_object('status',409);
  end if;
  begin
    insert into public.worldforge_discord_links(owner_id,discord_user_id,discord_name,guild_id,bot_key_id)
      values(p_owner_id,v_challenge.discord_user_id,v_challenge.discord_name,v_challenge.guild_id,v_challenge.bot_key_id);
  exception when unique_violation then return jsonb_build_object('status',409);
  end;
  update public.worldforge_discord_challenges set used_at=now() where token_hash=p_token_hash;
  return jsonb_build_object('status',200,'discord_name',v_challenge.discord_name);
end $$;

create function public.wf_discord_worlds(p_bot_key_id uuid,p_user_id text) returns jsonb
  language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(w)), '[]'::jsonb) from (
    select w.id,w.name,w.updated_at,
      case when jsonb_typeof(w.world->'estado_mundo'->'turno')='number'
        then w.world->'estado_mundo'->'turno' else '1'::jsonb end as turn,
      jsonb_array_length(case when jsonb_typeof(w.world->'reinos')='array'
        then w.world->'reinos' else '[]'::jsonb end) as realms,
      jsonb_array_length(case when jsonb_typeof(w.world->'cidades')='array'
        then w.world->'cidades' else '[]'::jsonb end) as cities,
      jsonb_array_length(case when jsonb_typeof(w.world->'npcs')='array'
        then w.world->'npcs' else '[]'::jsonb end) as npcs
    from public.worldforge_worlds w
    join public.worldforge_discord_links l on l.owner_id=w.owner_id
    join public.worldforge_discord_bot_keys k on k.id=l.bot_key_id and k.active and k.guild_id=l.guild_id
    where l.discord_user_id=p_user_id and l.bot_key_id=p_bot_key_id
    order by w.updated_at desc limit 20
  ) w;
$$;
revoke all on function public.wf_discord_create_challenge(uuid,text,text,text),
  public.wf_discord_claim(uuid,text),public.wf_discord_worlds(uuid,text) from public,anon,authenticated;
grant execute on function public.wf_discord_create_challenge(uuid,text,text,text),
  public.wf_discord_claim(uuid,text),public.wf_discord_worlds(uuid,text) to service_role;

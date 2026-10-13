create or replace function private.worldforge_mfa_satisfied()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select auth.jwt()->>'aal')='aal2',false) or not exists(select 1 from auth.mfa_factors where user_id=(select auth.uid()) and status='verified');
$$;
revoke all on function private.worldforge_mfa_satisfied() from public,anon;
grant execute on function private.worldforge_mfa_satisfied() to authenticated,service_role;
do $$
declare item record;
begin
 for item in select tablename from pg_tables where schemaname='public' and tablename like 'worldforge_%'
 loop execute format('create policy wf_mfa_required on public.%I as restrictive for all to authenticated using ((select private.worldforge_mfa_satisfied())) with check ((select private.worldforge_mfa_satisfied()))',item.tablename);
 end loop;
end $$;
CREATE OR REPLACE FUNCTION public.worldforge_consume_community_limit(p_action text, p_limit integer, p_window interval)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := now();
  v_count integer;
begin
  if not private.worldforge_mfa_satisfied() then raise exception 'MFA required' using errcode='42501'; end if;
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in (
    'forum_post', 'forum_reply', 'community_report', 'showcase_publish',
    'guild_create', 'guild_invite', 'guild_join', 'guild_message'
  ) or p_limit < 1 or p_window <= interval '0 seconds' then
    raise exception 'Invalid community rate limit' using errcode = '22023';
  end if;

  insert into public.worldforge_community_rate_limits(user_id, action, window_started_at, request_count)
  values (v_user_id, p_action, v_now, 1)
  on conflict (user_id, action) do update
    set window_started_at = case
          when public.worldforge_community_rate_limits.window_started_at + p_window <= v_now then v_now
          else public.worldforge_community_rate_limits.window_started_at
        end,
        request_count = case
          when public.worldforge_community_rate_limits.window_started_at + p_window <= v_now then 1
          else public.worldforge_community_rate_limits.request_count + 1
        end
  returning request_count into v_count;

  if v_count > p_limit then
    raise exception 'Limite temporário atingido. Aguarde antes de tentar novamente.'
      using errcode = 'PT429';
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.worldforge_create_guild(p_name text, p_description text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_guild_id uuid;
begin
  if not private.worldforge_mfa_satisfied() then raise exception 'MFA required' using errcode='42501'; end if;
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(btrim(p_name)) not between 3 and 60
    or char_length(coalesce(p_description, '')) > 500 then
    raise exception 'Invalid guild details' using errcode = '22023';
  end if;
  insert into public.worldforge_guilds(owner_id, name, description)
  values ((select auth.uid()), btrim(p_name), coalesce(p_description, ''))
  returning id into v_guild_id;
  insert into public.worldforge_guild_members(guild_id, user_id, role)
  values (v_guild_id, (select auth.uid()), 'owner');
  return v_guild_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.worldforge_create_guild_invite(p_guild_id uuid, p_token uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if not private.worldforge_mfa_satisfied() then raise exception 'MFA required' using errcode='42501'; end if;
  if not public.worldforge_is_guild_owner(p_guild_id) then
    raise exception 'Only the guild owner can create invitations' using errcode = '42501';
  end if;
  if p_token is null then
    raise exception 'Invalid invitation token' using errcode = '22023';
  end if;
  delete from public.worldforge_guild_invites
  where guild_id = p_guild_id and expires_at <= now();
  insert into public.worldforge_guild_invites(guild_id, token, created_by, expires_at)
  values (p_guild_id, p_token, (select auth.uid()), v_expires_at);
  return v_expires_at;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.worldforge_join_guild(p_guild_id uuid, p_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_invite public.worldforge_guild_invites%rowtype;
begin
  if not private.worldforge_mfa_satisfied() then raise exception 'MFA required' using errcode='42501'; end if;
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform public.worldforge_consume_community_limit('guild_join', 10, interval '1 day');
  if public.worldforge_is_guild_member(p_guild_id) then
    return false;
  end if;
  select * into v_invite from public.worldforge_guild_invites
  where guild_id = p_guild_id and token = p_token
  for update;
  if not found or v_invite.expires_at <= now() or v_invite.uses >= v_invite.max_uses then
    return false;
  end if;
  insert into public.worldforge_guild_members(guild_id, user_id, role)
  values (p_guild_id, (select auth.uid()), 'member')
  on conflict (guild_id, user_id) do nothing;
  update public.worldforge_guild_invites set uses = uses + 1 where id = v_invite.id;
  return true;
end;
$function$
;

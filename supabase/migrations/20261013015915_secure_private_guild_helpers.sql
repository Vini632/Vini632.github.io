-- Keep policy helper functions outside the exposed public API schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.worldforge_is_guild_member(uuid) set schema private;
alter function public.worldforge_is_guild_owner(uuid) set schema private;

-- Public RPCs retain their existing signatures and behavior, but call private helpers.
create or replace function public.worldforge_create_guild_invite(p_guild_id uuid, p_token uuid)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if not private.worldforge_is_guild_owner(p_guild_id) then
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
$function$;

create or replace function public.worldforge_join_guild(p_guild_id uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_invite public.worldforge_guild_invites%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if private.worldforge_is_guild_member(p_guild_id) then
    return false;
  end if;
  select * into v_invite from public.worldforge_guild_invites
  where guild_id = p_guild_id and token = p_token
  for update;
  if not found or v_invite.expires_at <= now() or v_invite.uses >= v_invite.max_uses then
    raise exception 'Invitation is invalid, expired, or exhausted' using errcode = '22023';
  end if;
  insert into public.worldforge_guild_members(guild_id, user_id, role)
  values (p_guild_id, (select auth.uid()), 'member')
  on conflict (guild_id, user_id) do nothing;
  update public.worldforge_guild_invites set uses = uses + 1 where id = v_invite.id;
  return true;
end;
$function$;

grant execute on function private.worldforge_is_guild_member(uuid) to authenticated, service_role;
grant execute on function private.worldforge_is_guild_owner(uuid) to authenticated, service_role;

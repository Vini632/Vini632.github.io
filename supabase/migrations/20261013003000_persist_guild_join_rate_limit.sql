create or replace function public.worldforge_join_guild(p_guild_id uuid, p_token uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_invite public.worldforge_guild_invites%rowtype;
begin
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
$$;

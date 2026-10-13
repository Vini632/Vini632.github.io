-- Visibility only controls discovery; guild tables keep membership-only RLS.
alter table public.worldforge_guilds
  add column visibility text not null default 'private'
  constraint worldforge_guild_visibility_check check (visibility in ('private', 'listed'));
grant update (visibility) on public.worldforge_guilds to authenticated;

-- Keep the previous signature for cached clients. Both paths default to private.
create function public.worldforge_create_guild(p_name text, p_description text, p_visibility text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if p_visibility is null or p_visibility not in ('private','listed') then
    raise exception 'Invalid guild visibility' using errcode='22023';
  end if;
  v_id := public.worldforge_create_guild(p_name, p_description);
  update public.worldforge_guilds set visibility=p_visibility where id=v_id;
  return v_id;
end;
$$;
revoke all on function public.worldforge_create_guild(text,text,text) from public,anon;
grant execute on function public.worldforge_create_guild(text,text,text) to authenticated;

-- A narrow private helper can read only opted-in public descriptions.
-- It never returns owner IDs, memberships, invitations or mural content.
create function private.worldforge_guild_directory(p_search text, p_offset integer)
returns table(id uuid, name text, description text)
language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not private.worldforge_mfa_satisfied() then
    raise exception 'Authentication and MFA required' using errcode='42501';
  end if;
  if p_offset is null or p_offset < 0 or p_offset > 10000 or char_length(coalesce(p_search,'')) > 60 then
    raise exception 'Invalid directory filter' using errcode='22023';
  end if;
  return query select g.id,g.name,g.description
    from public.worldforge_guilds g
    where g.visibility='listed'
      and (coalesce(btrim(p_search),'')='' or strpos(lower(g.name || ' ' || g.description),lower(btrim(p_search)))>0)
    order by g.created_at desc,g.id limit 24 offset p_offset;
end;
$$;
revoke all on function private.worldforge_guild_directory(text,integer) from public,anon;
grant execute on function private.worldforge_guild_directory(text,integer) to authenticated;
create function public.worldforge_guild_directory(p_search text default '', p_offset integer default 0)
returns table(id uuid, name text, description text)
language sql stable security invoker set search_path='' as $$
  select * from private.worldforge_guild_directory(p_search,p_offset);
$$;
revoke all on function public.worldforge_guild_directory(text,integer) from public,anon;
grant execute on function public.worldforge_guild_directory(text,integer) to authenticated;
create index worldforge_guilds_listed_idx on public.worldforge_guilds(created_at desc,id) where visibility='listed';

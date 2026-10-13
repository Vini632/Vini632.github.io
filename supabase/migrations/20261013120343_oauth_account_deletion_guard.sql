create function worldforge_private.wf_active_auth_session(p_owner uuid,p_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions where user_id=p_owner and id=p_session and (not_after is null or not_after>now()));
$$;
revoke all on function worldforge_private.wf_active_auth_session(uuid,uuid) from public,anon,authenticated;
grant execute on function worldforge_private.wf_active_auth_session(uuid,uuid) to service_role;
create function public.wf_active_auth_session(p_owner uuid,p_session uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select worldforge_private.wf_active_auth_session(p_owner,p_session);
$$;
revoke all on function public.wf_active_auth_session(uuid,uuid) from public,anon,authenticated;
grant execute on function public.wf_active_auth_session(uuid,uuid) to service_role;
create index wf_discord_jobs_bot_key on public.worldforge_discord_jobs(bot_key_id);

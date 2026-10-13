create schema if not exists worldforge_private;
revoke all on schema worldforge_private from public, anon, authenticated;
grant usage on schema worldforge_private to service_role;

create table public.worldforge_discord_jobs (
 id uuid primary key default gen_random_uuid(),
 bot_key_id uuid not null references public.worldforge_discord_bot_keys(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null,
 discord_user_id text not null check (discord_user_id ~ '^[0-9]{15,22}$'),
 request_id uuid not null,
 action text not null check (action in ('status','setup','publish-panel','associate','permissions','ticket-config','settings','role-add','role-remove','timeout','kick','ban','clear','publish-official','ticket-close')),
 payload jsonb not null default '{}'::jsonb check (octet_length(payload::text)<12000),
 state text not null default 'pending' check (state in ('pending','running','done','failed','expired')),
 result jsonb,
 created_at timestamptz not null default now(),
 started_at timestamptz, finished_at timestamptz,
 unique(owner_id,request_id)
);
create index wf_discord_jobs_poll on public.worldforge_discord_jobs(bot_key_id,created_at) where state='pending';
create index wf_discord_jobs_owner on public.worldforge_discord_jobs(owner_id,created_at);
alter table public.worldforge_discord_jobs enable row level security;
create policy wf_discord_jobs_backend_only on public.worldforge_discord_jobs for all to anon,authenticated using(false) with check(false);
revoke all on public.worldforge_discord_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.worldforge_discord_jobs to service_role;

-- Only this narrowly scoped internal helper can inspect Auth session/factor rows.
create function worldforge_private.wf_staff_session(p_owner uuid,p_session uuid,p_discord text,p_key uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_owner and (s.not_after is null or s.not_after>now()))
 and exists(select 1 from auth.mfa_factors f where f.user_id=p_owner and f.status='verified')
 and (exists(select 1 from public.worldforge_discord_links l where l.owner_id=p_owner and l.discord_user_id=p_discord and l.bot_key_id=p_key)
 or exists(select 1 from auth.identities i where i.user_id=p_owner and i.provider='discord' and i.provider_id=p_discord));
$$;
revoke all on function worldforge_private.wf_staff_session(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function worldforge_private.wf_staff_session(uuid,uuid,text,uuid) to service_role;

create function public.wf_discord_enqueue(p_key uuid,p_owner uuid,p_session uuid,p_discord text,p_request uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare job public.worldforge_discord_jobs;
begin
 if not worldforge_private.wf_staff_session(p_owner,p_session,p_discord,p_key) then return jsonb_build_object('status',403); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,991));
 select * into job from public.worldforge_discord_jobs where owner_id=p_owner and request_id=p_request;
 if found then return jsonb_build_object('status',200,'id',job.id); end if;
 if (select count(*) from public.worldforge_discord_jobs where owner_id=p_owner and created_at>now()-interval '1 minute')>=12 then return jsonb_build_object('status',429); end if;
 insert into public.worldforge_discord_jobs(bot_key_id,owner_id,session_id,discord_user_id,request_id,action,payload)
 values(p_key,p_owner,p_session,p_discord,p_request,p_action,p_payload) returning * into job;
 return jsonb_build_object('status',200,'id',job.id);
end $$;
create function public.wf_discord_claim_job(p_key uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare job public.worldforge_discord_jobs;
begin
 delete from public.worldforge_discord_jobs where created_at<now()-interval '14 days';
 update public.worldforge_discord_jobs set state='expired',finished_at=now() where bot_key_id=p_key and state='pending' and created_at<now()-interval '2 minutes';
 select * into job from public.worldforge_discord_jobs where bot_key_id=p_key and state='pending' order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 if not worldforge_private.wf_staff_session(job.owner_id,job.session_id,job.discord_user_id,job.bot_key_id) then
   update public.worldforge_discord_jobs set state='failed',result='{"error":"Acesso revogado. Entre novamente e confira seu vínculo."}',finished_at=now() where id=job.id;
   return null;
 end if;
 update public.worldforge_discord_jobs set state='running',started_at=now() where id=job.id;
 return jsonb_build_object('id',job.id,'discord_user_id',job.discord_user_id,'action',job.action,'payload',job.payload);
end $$;
revoke all on function public.wf_discord_enqueue(uuid,uuid,uuid,text,uuid,text,jsonb),public.wf_discord_claim_job(uuid) from public,anon,authenticated;
grant execute on function public.wf_discord_enqueue(uuid,uuid,uuid,text,uuid,text,jsonb),public.wf_discord_claim_job(uuid) to service_role;

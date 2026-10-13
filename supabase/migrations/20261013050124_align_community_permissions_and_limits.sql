-- Align existing installations without exposing the private guild helpers.
grant select (author_id) on public.worldforge_guild_messages to authenticated;

create table if not exists public.worldforge_community_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, action)
);

alter table public.worldforge_community_rate_limits enable row level security;
revoke all on public.worldforge_community_rate_limits from public, anon, authenticated;

create or replace function public.worldforge_consume_community_limit(
  p_action text,
  p_limit integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := now();
  v_count integer;
begin
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
$$;

revoke all on function public.worldforge_consume_community_limit(text, integer, interval)
  from public, anon, authenticated;

create or replace function public.worldforge_enforce_community_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'worldforge_showcase' then
    if not new.published or (tg_op = 'UPDATE' and old.published) then
      return new;
    end if;
    perform public.worldforge_consume_community_limit('showcase_publish', 3, interval '1 hour');
  elsif tg_table_name = 'worldforge_forum_posts' then
    perform public.worldforge_consume_community_limit('forum_post', 5, interval '1 hour');
  elsif tg_table_name = 'worldforge_forum_replies' then
    perform public.worldforge_consume_community_limit('forum_reply', 30, interval '1 hour');
  elsif tg_table_name = 'worldforge_community_reports' then
    perform public.worldforge_consume_community_limit('community_report', 5, interval '1 hour');
  elsif tg_table_name = 'worldforge_guilds' then
    perform public.worldforge_consume_community_limit('guild_create', 3, interval '1 day');
  elsif tg_table_name = 'worldforge_guild_invites' then
    perform public.worldforge_consume_community_limit('guild_invite', 10, interval '1 hour');
  elsif tg_table_name = 'worldforge_guild_messages' then
    perform public.worldforge_consume_community_limit('guild_message', 30, interval '1 hour');
  else
    raise exception 'Community rate limit is not configured for this table'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.worldforge_enforce_community_rate_limit()
  from public, anon, authenticated;

drop trigger if exists worldforge_forum_posts_rate_limit on public.worldforge_forum_posts;
create trigger worldforge_forum_posts_rate_limit before insert on public.worldforge_forum_posts
  for each row execute function public.worldforge_enforce_community_rate_limit();
drop trigger if exists worldforge_forum_replies_rate_limit on public.worldforge_forum_replies;
create trigger worldforge_forum_replies_rate_limit before insert on public.worldforge_forum_replies
  for each row execute function public.worldforge_enforce_community_rate_limit();
drop trigger if exists worldforge_community_reports_rate_limit on public.worldforge_community_reports;
create trigger worldforge_community_reports_rate_limit before insert on public.worldforge_community_reports
  for each row execute function public.worldforge_enforce_community_rate_limit();
drop trigger if exists worldforge_showcase_insert_rate_limit on public.worldforge_showcase;
create trigger worldforge_showcase_insert_rate_limit before insert on public.worldforge_showcase
  for each row execute function public.worldforge_enforce_community_rate_limit();
drop trigger if exists worldforge_showcase_publish_rate_limit on public.worldforge_showcase;
create trigger worldforge_showcase_publish_rate_limit before update of published on public.worldforge_showcase
  for each row execute function public.worldforge_enforce_community_rate_limit();
drop trigger if exists worldforge_guilds_rate_limit on public.worldforge_guilds;
create trigger worldforge_guilds_rate_limit before insert on public.worldforge_guilds
  for each row execute function public.worldforge_enforce_community_rate_limit();
drop trigger if exists worldforge_guild_invites_rate_limit on public.worldforge_guild_invites;
create trigger worldforge_guild_invites_rate_limit before insert on public.worldforge_guild_invites
  for each row execute function public.worldforge_enforce_community_rate_limit();
drop trigger if exists worldforge_guild_messages_rate_limit on public.worldforge_guild_messages;
create trigger worldforge_guild_messages_rate_limit before insert on public.worldforge_guild_messages
  for each row execute function public.worldforge_enforce_community_rate_limit();

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
  if private.worldforge_is_guild_member(p_guild_id) then
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

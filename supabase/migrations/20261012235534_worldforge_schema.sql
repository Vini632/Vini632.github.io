-- WorldForge RPG: mundos privados por conta para hospedagem estática (GitHub Pages).
-- Execute uma vez no SQL Editor do projeto Supabase.

create table if not exists public.worldforge_worlds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null check (char_length(local_id) between 1 and 120),
  name text not null check (char_length(name) between 1 and 160),
  world jsonb not null check (jsonb_typeof(world) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, local_id)
);

create index if not exists worldforge_worlds_owner_updated_idx
  on public.worldforge_worlds (owner_id, updated_at desc);

alter table public.worldforge_worlds enable row level security;

revoke all on table public.worldforge_worlds from anon, authenticated;
grant select, insert, update, delete on table public.worldforge_worlds to authenticated;

drop policy if exists "Users can read their own worlds" on public.worldforge_worlds;
create policy "Users can read their own worlds"
  on public.worldforge_worlds for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Users can add their own worlds" on public.worldforge_worlds;
create policy "Users can add their own worlds"
  on public.worldforge_worlds for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can update their own worlds" on public.worldforge_worlds;
create policy "Users can update their own worlds"
  on public.worldforge_worlds for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete their own worlds" on public.worldforge_worlds;
create policy "Users can delete their own worlds"
  on public.worldforge_worlds for delete to authenticated
  using ((select auth.uid()) = owner_id);

create table if not exists public.worldforge_forum_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  category text not null check (category in ('geral', 'criacao', 'campanhas', 'procurando-mesa')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worldforge_forum_posts_created_idx
  on public.worldforge_forum_posts (created_at desc);
create index if not exists worldforge_forum_posts_author_idx
  on public.worldforge_forum_posts (author_id, created_at desc);

create table if not exists public.worldforge_forum_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.worldforge_forum_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worldforge_forum_replies_post_idx
  on public.worldforge_forum_replies (post_id, created_at);
create index if not exists worldforge_forum_replies_author_idx
  on public.worldforge_forum_replies (author_id, created_at desc);

create table if not exists public.worldforge_community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('forum_post', 'forum_reply', 'showcase')),
  content_id uuid not null,
  reason text not null check (reason in ('spam', 'abuse', 'privacy', 'rights', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists worldforge_community_reports_created_idx
  on public.worldforge_community_reports (created_at desc);

create table if not exists public.worldforge_showcase (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  local_world_id text not null check (char_length(local_world_id) between 1 and 120),
  creator_name text not null check (char_length(creator_name) between 1 and 40),
  world_name text not null check (char_length(world_name) between 1 and 160),
  summary text not null check (char_length(summary) between 20 and 600),
  realm_names text[] not null default '{}',
  city_names text[] not null default '{}',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, local_world_id),
  check (cardinality(realm_names) <= 12),
  check (cardinality(city_names) <= 12),
  check (pg_column_size(array_to_json(realm_names)) <= 12000),
  check (pg_column_size(array_to_json(city_names)) <= 12000)
);

create index if not exists worldforge_showcase_public_idx
  on public.worldforge_showcase (updated_at desc) where published;
create index if not exists worldforge_showcase_owner_idx
  on public.worldforge_showcase (owner_id, updated_at desc);

create table if not exists public.worldforge_guilds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.worldforge_guild_members (
  guild_id uuid not null references public.worldforge_guilds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create index if not exists worldforge_guild_members_user_idx
  on public.worldforge_guild_members (user_id, joined_at desc);

create table if not exists public.worldforge_guild_invites (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.worldforge_guilds(id) on delete cascade,
  token uuid not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  max_uses integer not null default 20 check (max_uses between 1 and 20),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);

create index if not exists worldforge_guild_invites_guild_idx
  on public.worldforge_guild_invites (guild_id, expires_at desc);

create table if not exists public.worldforge_guild_messages (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.worldforge_guilds(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worldforge_guild_messages_guild_idx
  on public.worldforge_guild_messages (guild_id, created_at desc);

alter table public.worldforge_forum_posts enable row level security;
alter table public.worldforge_forum_replies enable row level security;
alter table public.worldforge_community_reports enable row level security;
alter table public.worldforge_showcase enable row level security;
alter table public.worldforge_guilds enable row level security;
alter table public.worldforge_guild_members enable row level security;
alter table public.worldforge_guild_invites enable row level security;
alter table public.worldforge_guild_messages enable row level security;

revoke all on public.worldforge_forum_posts, public.worldforge_forum_replies,
  public.worldforge_community_reports, public.worldforge_showcase,
  public.worldforge_guilds, public.worldforge_guild_members,
  public.worldforge_guild_invites, public.worldforge_guild_messages
  from anon, authenticated;
grant select (id, author_name, category, title, body, created_at, updated_at)
  on public.worldforge_forum_posts to anon;
grant select (id, author_id, author_name, category, title, body, created_at, updated_at)
  on public.worldforge_forum_posts to authenticated;
grant select (id, author_name, body, created_at, updated_at)
  on public.worldforge_forum_replies to anon;
grant select (id, author_id, author_name, body, created_at, updated_at)
  on public.worldforge_forum_replies to authenticated;
grant select (id, creator_name, world_name, summary, realm_names, city_names, published, updated_at)
  on public.worldforge_showcase to anon;
grant select (id, owner_id, local_world_id, creator_name, world_name, summary, realm_names, city_names, published, updated_at)
  on public.worldforge_showcase to authenticated;
grant insert (author_id, author_name, category, title, body),
  update (author_name, category, title, body), delete
  on public.worldforge_forum_posts to authenticated;
grant insert (post_id, author_id, author_name, body),
  update (author_name, body), delete
  on public.worldforge_forum_replies to authenticated;
grant insert (reporter_id, content_type, content_id, reason, details)
  on public.worldforge_community_reports to authenticated;
grant insert (owner_id, local_world_id, creator_name, world_name, summary, realm_names, city_names, published),
  update (creator_name, world_name, summary, realm_names, city_names, published, updated_at),
  delete on public.worldforge_showcase to authenticated;
grant update (name, description), delete on public.worldforge_guilds to authenticated;
grant select on public.worldforge_guilds to authenticated;
grant select, delete on public.worldforge_guild_members to authenticated;
grant insert (guild_id, author_id, author_name, body),
  update (author_name, body), delete
  on public.worldforge_guild_messages to authenticated;

create or replace function public.worldforge_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.worldforge_touch_updated_at() from public, anon, authenticated;

drop trigger if exists worldforge_forum_posts_touch on public.worldforge_forum_posts;
create trigger worldforge_forum_posts_touch before update on public.worldforge_forum_posts
  for each row execute function public.worldforge_touch_updated_at();
drop trigger if exists worldforge_forum_replies_touch on public.worldforge_forum_replies;
create trigger worldforge_forum_replies_touch before update on public.worldforge_forum_replies
  for each row execute function public.worldforge_touch_updated_at();
drop trigger if exists worldforge_showcase_touch on public.worldforge_showcase;
create trigger worldforge_showcase_touch before update on public.worldforge_showcase
  for each row execute function public.worldforge_touch_updated_at();
drop trigger if exists worldforge_guild_messages_touch on public.worldforge_guild_messages;
create trigger worldforge_guild_messages_touch before update on public.worldforge_guild_messages
  for each row execute function public.worldforge_touch_updated_at();

drop policy if exists "Forum posts are publicly readable" on public.worldforge_forum_posts;
create policy "Forum posts are publicly readable"
  on public.worldforge_forum_posts for select to anon, authenticated using (true);
drop policy if exists "Authenticated users can create forum posts" on public.worldforge_forum_posts;
create policy "Authenticated users can create forum posts"
  on public.worldforge_forum_posts for insert to authenticated
  with check ((select auth.uid()) = author_id);
drop policy if exists "Authors can edit their forum posts" on public.worldforge_forum_posts;
create policy "Authors can edit their forum posts"
  on public.worldforge_forum_posts for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
drop policy if exists "Authors can delete their forum posts" on public.worldforge_forum_posts;
create policy "Authors can delete their forum posts"
  on public.worldforge_forum_posts for delete to authenticated
  using ((select auth.uid()) = author_id);

drop policy if exists "Forum replies are publicly readable" on public.worldforge_forum_replies;
create policy "Forum replies are publicly readable"
  on public.worldforge_forum_replies for select to anon, authenticated using (true);
drop policy if exists "Authenticated users can create forum replies" on public.worldforge_forum_replies;
create policy "Authenticated users can create forum replies"
  on public.worldforge_forum_replies for insert to authenticated
  with check ((select auth.uid()) = author_id);
drop policy if exists "Authors can edit their forum replies" on public.worldforge_forum_replies;
create policy "Authors can edit their forum replies"
  on public.worldforge_forum_replies for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
drop policy if exists "Authors can delete their forum replies" on public.worldforge_forum_replies;
create policy "Authors can delete their forum replies"
  on public.worldforge_forum_replies for delete to authenticated
  using ((select auth.uid()) = author_id);

drop policy if exists "Authenticated users can report community content" on public.worldforge_community_reports;
create policy "Authenticated users can report community content"
  on public.worldforge_community_reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id);

drop policy if exists "Published showcase worlds and own drafts are readable" on public.worldforge_showcase;
create policy "Published showcase worlds and own drafts are readable"
  on public.worldforge_showcase for select to anon, authenticated
  using (published or (select auth.uid()) = owner_id);
drop policy if exists "Owners can create showcase worlds" on public.worldforge_showcase;
create policy "Owners can create showcase worlds"
  on public.worldforge_showcase for insert to authenticated
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners can update showcase worlds" on public.worldforge_showcase;
create policy "Owners can update showcase worlds"
  on public.worldforge_showcase for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners can delete showcase worlds" on public.worldforge_showcase;
create policy "Owners can delete showcase worlds"
  on public.worldforge_showcase for delete to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.worldforge_is_guild_member(p_guild_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.worldforge_guild_members m
    where m.guild_id = p_guild_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.worldforge_is_guild_owner(p_guild_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.worldforge_guilds g
    where g.id = p_guild_id and g.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.worldforge_is_guild_member(uuid),
  public.worldforge_is_guild_owner(uuid) from public, anon;
grant execute on function public.worldforge_is_guild_member(uuid),
  public.worldforge_is_guild_owner(uuid) to authenticated;

drop policy if exists "Guilds are visible only to members" on public.worldforge_guilds;
create policy "Guilds are visible only to members"
  on public.worldforge_guilds for select to authenticated
  using (public.worldforge_is_guild_member(id));
drop policy if exists "Owners can update their guild" on public.worldforge_guilds;
create policy "Owners can update their guild"
  on public.worldforge_guilds for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners can delete their guild" on public.worldforge_guilds;
create policy "Owners can delete their guild"
  on public.worldforge_guilds for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Guild members can see their roster" on public.worldforge_guild_members;
create policy "Guild members can see their roster"
  on public.worldforge_guild_members for select to authenticated
  using (public.worldforge_is_guild_member(guild_id));
drop policy if exists "Guild owners and members can leave or remove members" on public.worldforge_guild_members;
create policy "Guild owners and members can leave or remove members"
  on public.worldforge_guild_members for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role = 'member')
    or (user_id <> (select auth.uid()) and public.worldforge_is_guild_owner(guild_id))
  );

drop policy if exists "Guild owners can see invite status" on public.worldforge_guild_invites;
create policy "Guild owners can see invite status"
  on public.worldforge_guild_invites for select to authenticated
  using (public.worldforge_is_guild_owner(guild_id));

drop policy if exists "Guild members can read messages" on public.worldforge_guild_messages;
create policy "Guild members can read messages"
  on public.worldforge_guild_messages for select to authenticated
  using (public.worldforge_is_guild_member(guild_id));
drop policy if exists "Guild members can post messages" on public.worldforge_guild_messages;
create policy "Guild members can post messages"
  on public.worldforge_guild_messages for insert to authenticated
  with check ((select auth.uid()) = author_id and public.worldforge_is_guild_member(guild_id));
drop policy if exists "Authors can edit guild messages" on public.worldforge_guild_messages;
create policy "Authors can edit guild messages"
  on public.worldforge_guild_messages for update to authenticated
  using ((select auth.uid()) = author_id and public.worldforge_is_guild_member(guild_id))
  with check ((select auth.uid()) = author_id and public.worldforge_is_guild_member(guild_id));
drop policy if exists "Authors or guild owners can delete guild messages" on public.worldforge_guild_messages;
create policy "Authors or guild owners can delete guild messages"
  on public.worldforge_guild_messages for delete to authenticated
  using (
    ((select auth.uid()) = author_id and public.worldforge_is_guild_member(guild_id))
    or public.worldforge_is_guild_owner(guild_id)
  );

create or replace function public.worldforge_create_guild(p_name text, p_description text default '')
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_guild_id uuid;
begin
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
$$;

create or replace function public.worldforge_create_guild_invite(p_guild_id uuid, p_token uuid)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_expires_at timestamptz := now() + interval '7 days';
begin
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
$$;

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
  if public.worldforge_is_guild_member(p_guild_id) then
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
$$;

revoke all on function public.worldforge_create_guild(text, text),
  public.worldforge_create_guild_invite(uuid, uuid),
  public.worldforge_join_guild(uuid, uuid) from public, anon;
grant execute on function public.worldforge_create_guild(text, text),
  public.worldforge_create_guild_invite(uuid, uuid),
  public.worldforge_join_guild(uuid, uuid) to authenticated;

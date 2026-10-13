-- Run with the SQL Editor/admin connection. Fixtures are always rolled back.
begin;
insert into auth.users(id, email) values
  ('2b8a1331-a50c-4826-906f-1905039bda01', 'owner@worldforge-regression.invalid'),
  ('2b8a1331-a50c-4826-906f-1905039bda02', 'member@worldforge-regression.invalid'),
  ('2b8a1331-a50c-4826-906f-1905039bda03', 'outsider@worldforge-regression.invalid');
select set_config('request.jwt.claim.sub', '2b8a1331-a50c-4826-906f-1905039bda01', true);
insert into public.worldforge_guilds(id, owner_id, name) values
  ('2b8a1331-a50c-4826-906f-1905039bda04', '2b8a1331-a50c-4826-906f-1905039bda01', 'Regression guild');
insert into public.worldforge_guild_members(guild_id, user_id, role) values
  ('2b8a1331-a50c-4826-906f-1905039bda04', '2b8a1331-a50c-4826-906f-1905039bda01', 'owner'),
  ('2b8a1331-a50c-4826-906f-1905039bda04', '2b8a1331-a50c-4826-906f-1905039bda02', 'member');
insert into public.worldforge_guild_messages(id, guild_id, author_id, author_name, body) values
  ('2b8a1331-a50c-4826-906f-1905039bda05', '2b8a1331-a50c-4826-906f-1905039bda04', '2b8a1331-a50c-4826-906f-1905039bda01', 'Owner', 'Private fixture');

set local role authenticated;
select set_config('request.jwt.claim.sub', '2b8a1331-a50c-4826-906f-1905039bda02', true);
do $$
declare v_count integer;
begin
  select count(author_id) into v_count from public.worldforge_guild_messages
  where guild_id = '2b8a1331-a50c-4826-906f-1905039bda04';
  if v_count <> 1 then raise exception 'Member cannot read message authors'; end if;
  delete from public.worldforge_guild_messages where id = '2b8a1331-a50c-4826-906f-1905039bda05';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Member deleted another author message'; end if;
  insert into public.worldforge_guild_messages(guild_id, author_id, author_name, body) values
    ('2b8a1331-a50c-4826-906f-1905039bda04', '2b8a1331-a50c-4826-906f-1905039bda02', 'Member', 'Own fixture');
  delete from public.worldforge_guild_messages where guild_id = '2b8a1331-a50c-4826-906f-1905039bda04';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Author cannot delete own message'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '2b8a1331-a50c-4826-906f-1905039bda03', true);
do $$
declare v_count integer; v_result boolean;
begin
  select count(author_id) into v_count from public.worldforge_guild_messages
  where guild_id = '2b8a1331-a50c-4826-906f-1905039bda04';
  if v_count <> 0 then raise exception 'Outsider can read private messages'; end if;
  begin
    insert into public.worldforge_guild_messages(guild_id, author_id, author_name, body) values
      ('2b8a1331-a50c-4826-906f-1905039bda04', '2b8a1331-a50c-4826-906f-1905039bda03', 'Outsider', 'Forbidden');
    raise exception 'Outsider can post private messages';
  exception when insufficient_privilege then null;
  end;
  for i in 1..5 loop
    insert into public.worldforge_forum_posts(author_id, author_name, category, title, body)
    values ('2b8a1331-a50c-4826-906f-1905039bda03', 'Fixture', 'geral', 'Regression topic', 'Fixture');
  end loop;
  begin
    insert into public.worldforge_forum_posts(author_id, author_name, category, title, body)
    values ('2b8a1331-a50c-4826-906f-1905039bda03', 'Fixture', 'geral', 'Blocked topic', 'Fixture');
    raise exception 'Sixth topic was not rate limited';
  exception when sqlstate 'PT429' then null;
  end;
  for i in 1..10 loop
    v_result := public.worldforge_join_guild('2b8a1331-a50c-4826-906f-1905039bda04', '2b8a1331-a50c-4826-906f-1905039bda06');
    if v_result is distinct from false then raise exception 'Invalid invitation was accepted'; end if;
  end loop;
  begin
    perform public.worldforge_join_guild('2b8a1331-a50c-4826-906f-1905039bda04', '2b8a1331-a50c-4826-906f-1905039bda06');
    raise exception 'Eleventh invitation attempt was not rate limited';
  exception when sqlstate 'PT429' then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '2b8a1331-a50c-4826-906f-1905039bda01', true);
do $$
declare v_count integer;
begin
  delete from public.worldforge_guild_messages where id = '2b8a1331-a50c-4826-906f-1905039bda05';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Owner cannot moderate messages'; end if;
end;
$$;
set local role anon;
do $$
begin
  begin
    perform author_id from public.worldforge_guild_messages limit 0;
    raise exception 'Anonymous message access was granted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  if not exists (select 1 from public.worldforge_community_rate_limits
    where user_id = '2b8a1331-a50c-4826-906f-1905039bda03' and action = 'guild_join' and request_count = 10) then
    raise exception 'Invalid invitations did not consume the quota';
  end if;
end;
$$;
rollback;
select 'Guild RLS, author permissions, topic quotas and invalid invitation quotas verified; fixtures rolled back' as verification;

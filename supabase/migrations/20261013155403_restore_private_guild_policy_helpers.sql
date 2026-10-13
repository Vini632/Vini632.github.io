-- Reconcile duplicated public helpers observed after the MFA rollout.
-- Preserve existing RPC authentication, quotas and invitation locking.
do $$
declare item record; definition text; predicate text; check_predicate text;
begin
  if to_regprocedure('private.worldforge_is_guild_member(uuid)') is null
    or to_regprocedure('private.worldforge_is_guild_owner(uuid)') is null then
    raise exception 'Private guild helpers must exist before reconciliation';
  end if;
  for item in
    select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('worldforge_create_guild_invite','worldforge_join_guild')
  loop
    definition := replace(replace(pg_get_functiondef(item.oid),
      'public.worldforge_is_guild_member(', 'private.worldforge_is_guild_member('),
      'public.worldforge_is_guild_owner(', 'private.worldforge_is_guild_owner(');
    execute definition;
  end loop;
  for item in
    select p.polname,p.polqual,p.polwithcheck,p.polrelid,c.relname
    from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in
      ('worldforge_guilds','worldforge_guild_members','worldforge_guild_messages','worldforge_guild_invites')
  loop
    predicate := pg_get_expr(item.polqual,item.polrelid);
    check_predicate := pg_get_expr(item.polwithcheck,item.polrelid);
    -- Qualify before execution: these helpers always belong to the private schema.
    predicate := replace(replace(replace(predicate,'public.worldforge_is_guild_','worldforge_is_guild_'),
      'worldforge_is_guild_member(', 'private.worldforge_is_guild_member('),
      'worldforge_is_guild_owner(', 'private.worldforge_is_guild_owner(');
    check_predicate := replace(replace(replace(check_predicate,'public.worldforge_is_guild_','worldforge_is_guild_'),
      'worldforge_is_guild_member(', 'private.worldforge_is_guild_member('),
      'worldforge_is_guild_owner(', 'private.worldforge_is_guild_owner(');
    -- Some installations already resolve these expressions to private helpers.
    predicate := replace(predicate,'private.private.','private.');
    check_predicate := replace(check_predicate,'private.private.','private.');
    if predicate is not null then
      execute format('alter policy %I on public.%I using (%s)',item.polname,item.relname,predicate);
    end if;
    if check_predicate is not null then
      execute format('alter policy %I on public.%I with check (%s)',item.polname,item.relname,check_predicate);
    end if;
  end loop;
end;
$$;
-- No CASCADE: unexpected dependencies abort instead of removing policies.
drop function if exists public.worldforge_is_guild_member(uuid);
drop function if exists public.worldforge_is_guild_owner(uuid);

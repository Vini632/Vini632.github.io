-- Synthetic fixtures only; all records, factors, invitations and counters roll back.
begin;
insert into auth.users(id,email) values
 ('a8549c14-a17d-4976-8050-f5fdf803ca01','directory-owner@worldforge-test.invalid'),
 ('a8549c14-a17d-4976-8050-f5fdf803ca02','directory-member@worldforge-test.invalid'),
 ('a8549c14-a17d-4976-8050-f5fdf803ca03','directory-outsider@worldforge-test.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','a8549c14-a17d-4976-8050-f5fdf803ca01',true);
select set_config('request.jwt.claims','{"sub":"a8549c14-a17d-4976-8050-f5fdf803ca01","aal":"aal1"}',true);
do $$
declare listed uuid; hidden uuid; legacy uuid; n integer;
begin
 listed:=public.worldforge_create_guild('WF directory fixture listed','Only this description is shared','listed');
 hidden:=public.worldforge_create_guild('WF directory fixture hidden','Private description','private');
 legacy:=public.worldforge_create_guild('WF directory fixture legacy','Old client signature');
 perform set_config('worldforge.test.listed',listed::text,true);
 perform set_config('worldforge.test.hidden',hidden::text,true);
 perform set_config('worldforge.test.legacy',legacy::text,true);
 if (select visibility from public.worldforge_guilds where id=legacy)<>'private' then raise exception 'Old clients must create hidden guilds'; end if;
 insert into public.worldforge_guild_messages(guild_id,author_id,author_name,body)
 values(listed,auth.uid(),'Fixture','Private mural');
 perform public.worldforge_create_guild_invite(listed,'a8549c14-a17d-4976-8050-f5fdf803ca04');
 begin
  perform public.worldforge_create_guild('WF invalid visibility','','public');
  raise exception 'Invalid visibility accepted';
 exception when invalid_parameter_value then null;
 end;
end;
$$;
-- A non-member can discover metadata, but cannot read private tables or change visibility.
select set_config('request.jwt.claim.sub','a8549c14-a17d-4976-8050-f5fdf803ca03',true);
select set_config('request.jwt.claims','{"sub":"a8549c14-a17d-4976-8050-f5fdf803ca03","aal":"aal1"}',true);
do $$
declare n integer; listed uuid:=current_setting('worldforge.test.listed')::uuid; row_data jsonb;
begin
 select count(*) into n from public.worldforge_guild_directory('WF directory fixture',0);
 if n<>1 then raise exception 'Directory must expose only the opted-in guild'; end if;
 select to_jsonb(d) into row_data from public.worldforge_guild_directory('fixture listed',0) d;
 if (select count(*) from jsonb_object_keys(row_data))<>3 or not row_data ?& array['id','name','description'] then
  raise exception 'Directory exposes more than approved metadata';
 end if;
 select count(*) into n from public.worldforge_guild_directory('no-match-directory-fixture',0);
 if n<>0 then raise exception 'Search filter ignored'; end if;
 select count(*) into n from public.worldforge_guild_directory('WF directory fixture',24);
 if n<>0 then raise exception 'Offset ignored'; end if;
 select count(*) into n from public.worldforge_guilds where id=listed;
 if n<>0 then raise exception 'Listed guild bypasses membership RLS'; end if;
 select count(author_id) into n from public.worldforge_guild_messages where guild_id=listed;
 if n<>0 then raise exception 'Directory grants private mural access'; end if;
 select count(*) into n from public.worldforge_guild_members where guild_id=listed;
 if n<>0 then raise exception 'Directory grants roster access'; end if;
 begin
  select count(id) into n from public.worldforge_guild_invites where guild_id=listed;
  if n<>0 then raise exception 'Directory grants invitation access'; end if;
 exception when insufficient_privilege then null; -- No client grants is also a valid denial.
 end;
 update public.worldforge_guilds set visibility='private' where id=listed;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Non-member changed visibility'; end if;
 begin
  perform public.worldforge_guild_directory('',-1);
  raise exception 'Negative offset accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
  perform public.worldforge_guild_directory(repeat('x',61),0);
  raise exception 'Oversized search accepted';
 exception when invalid_parameter_value then null;
 end;
end;
$$;
-- Joining still requires the invite, and members cannot change the owner's choice.
select set_config('request.jwt.claim.sub','a8549c14-a17d-4976-8050-f5fdf803ca02',true);
select set_config('request.jwt.claims','{"sub":"a8549c14-a17d-4976-8050-f5fdf803ca02","aal":"aal1"}',true);
do $$
declare n integer; listed uuid:=current_setting('worldforge.test.listed')::uuid;
begin
 if public.worldforge_join_guild(listed,'a8549c14-a17d-4976-8050-f5fdf803ca05') then raise exception 'Invalid invite accepted'; end if;
 if not public.worldforge_join_guild(listed,'a8549c14-a17d-4976-8050-f5fdf803ca04') then raise exception 'Valid invite refused'; end if;
 select count(author_id) into n from public.worldforge_guild_messages where guild_id=listed;
 if n<>1 then raise exception 'Member cannot read mural author'; end if;
 update public.worldforge_guilds set visibility='private' where id=listed;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Member changed visibility'; end if;
end;
$$;
select set_config('request.jwt.claim.sub','a8549c14-a17d-4976-8050-f5fdf803ca01',true);
select set_config('request.jwt.claims','{"sub":"a8549c14-a17d-4976-8050-f5fdf803ca01","aal":"aal1"}',true);
do $$
declare n integer;
begin
 update public.worldforge_guilds set visibility='private' where id=current_setting('worldforge.test.listed')::uuid;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Owner cannot hide guild'; end if;
 select count(*) into n from public.worldforge_guild_directory('WF directory fixture',0);
 if n<>0 then raise exception 'Hidden guild remains in directory'; end if;
 update public.worldforge_guilds set visibility='listed' where id=current_setting('worldforge.test.listed')::uuid;
end;
$$;
reset role;
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
values('a8549c14-a17d-4976-8050-f5fdf803ca06','a8549c14-a17d-4976-8050-f5fdf803ca01','totp','verified',now(),now());
set local role authenticated;
do $$
declare n integer;
begin
 begin
  perform public.worldforge_guild_directory('WF directory fixture',0);
  raise exception 'AAL1 directory access granted to MFA account';
 exception when insufficient_privilege then null;
 end;
 select count(*) into n from public.worldforge_guilds where id=current_setting('worldforge.test.listed')::uuid;
 if n<>0 then raise exception 'AAL1 bypasses restrictive MFA policy'; end if;
end;
$$;
select set_config('request.jwt.claims','{"sub":"a8549c14-a17d-4976-8050-f5fdf803ca01","aal":"aal2"}',true);
do $$
begin
 if (select count(*) from public.worldforge_guild_directory('WF directory fixture',0))<>1 then raise exception 'AAL2 directory access denied'; end if;
end;
$$;
set local role anon;
do $$
begin
 begin
  perform public.worldforge_guild_directory('',0);
  raise exception 'Anonymous directory access granted';
 exception when insufficient_privilege then null;
 end;
end;
$$;
reset role;
rollback;
select 'Directory, search, pagination, owner changes, invitation membership, private data and MFA verified; fixtures rolled back' as verification;

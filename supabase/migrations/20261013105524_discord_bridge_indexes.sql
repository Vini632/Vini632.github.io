create index worldforge_discord_links_bot_key_idx on public.worldforge_discord_links(bot_key_id);
-- Explicit deny policies describe the server-only tables; no client grants are added.
create policy "No client access to bot credentials" on public.worldforge_discord_bot_keys
  for all to anon, authenticated using(false) with check(false);
create policy "No client access to linking challenges" on public.worldforge_discord_challenges
  for all to anon, authenticated using(false) with check(false);
create policy "No client access to linking counters" on public.worldforge_discord_link_attempts
  for all to anon, authenticated using(false) with check(false);

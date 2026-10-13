-- The guild mural selects author_id to show message ownership controls.
-- Restore the missing column privilege; membership and MFA remain enforced by RLS.
grant select (author_id)
  on public.worldforge_guild_messages to authenticated;

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const schema = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');

test('community tables enable row-level security and server-side membership checks', () => {
  for (const table of [
    'worldforge_forum_posts',
    'worldforge_forum_replies',
    'worldforge_community_reports',
    'worldforge_showcase',
    'worldforge_guilds',
    'worldforge_guild_members',
    'worldforge_guild_invites',
    'worldforge_guild_messages'
  ]) {
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(schema, /create or replace function public\.worldforge_join_guild[\s\S]*?for update/i);
  assert.match(schema, /create policy "Guilds are visible only to members"[\s\S]*?worldforge_is_guild_member\(id\)/i);
});

test('anonymous reads omit account and local-world identifiers', () => {
  assert.match(schema, /grant select \(id, author_name, category, title, body, created_at, updated_at\)\s+on public\.worldforge_forum_posts to anon/i);
  assert.match(schema, /grant select \(id, author_name, body, created_at, updated_at\)\s+on public\.worldforge_forum_replies to anon/i);
  assert.match(schema, /grant select \(id, creator_name, world_name, summary, realm_names, city_names, published, updated_at\)\s+on public\.worldforge_showcase to anon/i);
  assert.doesNotMatch(schema, /grant select on public\.worldforge_forum_posts, public\.worldforge_forum_replies,[\s\S]*?to anon/i);
});

test('guild owners cannot remove their own owner membership through table delete', () => {
  assert.match(
    schema,
    /create policy "Guild owners and members can leave or remove members"[\s\S]*?user_id = \(select auth\.uid\(\)\) and role = 'member'[\s\S]*?user_id <> \(select auth\.uid\(\)\) and public\.worldforge_is_guild_owner\(guild_id\)/i
  );
});

test('authenticated guild members can query guild rows, protected by row-level security', () => {
  assert.match(schema, /grant select on public\.worldforge_guilds to authenticated/i);
  assert.match(schema, /create policy "Guilds are visible only to members"[\s\S]*?for select to authenticated[\s\S]*?worldforge_is_guild_member\(id\)/i);
});

test('authenticated guild members can read only message fields protected by membership RLS', () => {
  assert.match(
    schema,
    /grant select \(id, guild_id, author_name, body, created_at, updated_at\)\s+on public\.worldforge_guild_messages to authenticated/i
  );
  assert.match(
    schema,
    /create policy "Guild members can read messages"[\s\S]*?for select to authenticated[\s\S]*?worldforge_is_guild_member\(guild_id\)/i
  );
});

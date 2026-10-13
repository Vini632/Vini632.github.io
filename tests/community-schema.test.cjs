'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const schema = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
const clientSource = fs.readFileSync(path.join(__dirname, '..', 'community.js'), 'utf8');

test('every guild message column requested by the client is readable by authenticated members', () => {
  const requested = clientSource.match(/worldforge_guild_messages\?select=([^&]+)/)[1].split(',');
  const grants = [...schema.matchAll(/grant select \(([^)]+)\)\s+on public\.worldforge_guild_messages to authenticated/gi)];
  const readable = new Set(grants.flatMap(match => match[1].split(',').map(column => column.trim())));
  for (const column of [...requested, 'guild_id']) {
    assert.ok(readable.has(column), `Missing SELECT privilege for guild message column: ${column}`);
  }
});
const guildMessageGrantMigration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20261013000000_guild_message_read_grant.sql'),
  'utf8'
);
const forumReplyFilterGrantMigration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20261013001000_forum_reply_read_post_reference.sql'),
  'utf8'
);
const rateLimitMigration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20261013002000_community_rate_limits.sql'),
  'utf8'
);
const guildJoinRateLimitMigration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20261013003000_persist_guild_join_rate_limit.sql'),
  'utf8'
);
const alignmentMigration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20261013050124_align_community_permissions_and_limits.sql'),
  'utf8'
);

test('production alignment keeps helpers private and installs guild authors and invitation quotas', () => {
  assert.match(alignmentMigration, /grant select \(author_id\) on public\.worldforge_guild_messages to authenticated/i);
  assert.match(alignmentMigration, /private\.worldforge_is_guild_member\(p_guild_id\)/);
  assert.doesNotMatch(alignmentMigration, /public\.worldforge_is_guild_(?:member|owner)/);
  assert.match(alignmentMigration, /'guild_join', 10, interval '1 day'/);
  assert.doesNotMatch(schema, /public\.worldforge_is_guild_(?:member|owner)/);
  assert.match(schema, /revoke all on schema private from public, anon/i);
});

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
  assert.match(schema, /grant select \(id, post_id, author_name, body, created_at, updated_at\)\s+on public\.worldforge_forum_replies to anon/i);
  assert.match(schema, /grant select \(id, creator_name, world_name, summary, realm_names, city_names, published, updated_at\)\s+on public\.worldforge_showcase to anon/i);
  assert.doesNotMatch(schema, /grant select on public\.worldforge_forum_posts, public\.worldforge_forum_replies,[\s\S]*?to anon/i);
});

test('guild owners cannot remove their own owner membership through table delete', () => {
  assert.match(
    schema,
    /create policy "Guild owners and members can leave or remove members"[\s\S]*?user_id = \(select auth\.uid\(\)\) and role = 'member'[\s\S]*?user_id <> \(select auth\.uid\(\)\) and private\.worldforge_is_guild_owner\(guild_id\)/i
  );
});

test('authenticated guild members can query guild rows, protected by row-level security', () => {
  assert.match(schema, /grant select on public\.worldforge_guilds to authenticated/i);
  assert.match(schema, /create policy "Guilds are visible only to members"[\s\S]*?for select to authenticated[\s\S]*?worldforge_is_guild_member\(id\)/i);
});

test('authenticated guild members can read only message fields protected by membership RLS', () => {
  assert.match(
    schema,
    /grant select \(id, guild_id, author_id, author_name, body, created_at, updated_at\)\s+on public\.worldforge_guild_messages to authenticated/i
  );
  assert.match(
    schema,
    /create policy "Guild members can read messages"[\s\S]*?for select to authenticated[\s\S]*?worldforge_is_guild_member\(guild_id\)/i
  );
});

test('forum reply readers can filter by public topic id without exposing author ids', () => {
  assert.match(
    schema,
    /grant select \(id, post_id, author_name, body, created_at, updated_at\)\s+on public\.worldforge_forum_replies to anon/i
  );
  assert.match(
    schema,
    /grant select \(id, post_id, author_id, author_name, body, created_at, updated_at\)\s+on public\.worldforge_forum_replies to authenticated/i
  );
});

test('incremental migrations grant only the extra public lookup fields required by PostgREST', () => {
  assert.match(
    guildMessageGrantMigration,
    /grant select \(id, guild_id, author_name, body, created_at, updated_at\)\s+on public\.worldforge_guild_messages to authenticated/i
  );
  assert.match(
    forumReplyFilterGrantMigration,
    /grant select \(post_id\)\s+on public\.worldforge_forum_replies to anon, authenticated/i
  );
  assert.doesNotMatch(
    `${guildMessageGrantMigration}\n${forumReplyFilterGrantMigration}`,
    /grant select on public\.worldforge_(?:guild_messages|forum_replies) to anon/i
  );
});

test('community write limits are private, server-enforced, and return HTTP 429 when exceeded', () => {
  assert.match(rateLimitMigration, /create table if not exists public\.worldforge_community_rate_limits/);
  assert.match(rateLimitMigration, /alter table public\.worldforge_community_rate_limits enable row level security/i);
  assert.match(rateLimitMigration, /revoke all on public\.worldforge_community_rate_limits from public, anon, authenticated/i);
  assert.match(rateLimitMigration, /using errcode = 'PT429'/i);
  for (const [action, count, window] of [
    ['forum_post', 5, '1 hour'],
    ['forum_reply', 30, '1 hour'],
    ['community_report', 5, '1 hour'],
    ['showcase_publish', 3, '1 hour'],
    ['guild_create', 3, '1 day'],
    ['guild_invite', 10, '1 hour'],
    ['guild_message', 30, '1 hour']
  ]) {
    assert.match(rateLimitMigration, new RegExp(`'${action}', ${count}, interval '${window}'`));
  }
  assert.match(guildJoinRateLimitMigration, /'guild_join', 10, interval '1 day'/);
});

test('invalid guild invitations return false so failed attempts commit their rate-limit counter', () => {
  assert.match(
    guildJoinRateLimitMigration,
    /perform public\.worldforge_consume_community_limit\('guild_join', 10, interval '1 day'\)[\s\S]*?if not found[\s\S]*?return false;/i
  );
  assert.doesNotMatch(guildJoinRateLimitMigration, /Invitation is invalid/);
});

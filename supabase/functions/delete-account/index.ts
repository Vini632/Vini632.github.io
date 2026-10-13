import { createDeletionHandler } from './handler.mjs';

// Secrets are injected by Supabase and never sent to the static frontend.
function defaultKey(name: string) {
  try { const keys = JSON.parse(Deno.env.get(name) || '{}'); return keys.default || Object.values(keys)[0]; } catch { return undefined; }
}
Deno.serve(createDeletionHandler({
  url: Deno.env.get('SUPABASE_URL'),
  anonKey: defaultKey('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_ANON_KEY'),
  serviceKey: defaultKey('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}));

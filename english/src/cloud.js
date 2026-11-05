const PROJECT_URL = "https://urvtkpqpguxthjznmtyu.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_A_UWfFS6GHU8c_0kiy8Aqg_DcBO6dCb";

const client = window.supabase?.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
  },
});

function ready() {
  if (!client) throw new Error("Sincronização indisponível neste navegador.");
  return client;
}

export async function initCloud(onAuthChange) {
  const api = ready();
  const { data, error } = await api.auth.getSession();
  if (error) throw error;
  api.auth.onAuthStateChange((event, session) => {
    if (event !== "INITIAL_SESSION") onAuthChange(session);
  });
  return data.session;
}

export async function sendMagicLink(email) {
  const { error } = await ready().auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${location.origin}${location.pathname}#settings`,
    },
  });
  if (error) throw error;
}

export async function signOutCloud() {
  const { error } = await ready().auth.signOut();
  if (error) throw error;
}

export async function getCloudState() {
  const { data, error } = await ready()
    .from("worldforge_english_state")
    .select("payload, revision, updated_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function putCloudState(userId, payload, revision) {
  const { data, error } = await ready()
    .from("worldforge_english_state")
    .upsert(
      {
        user_id: userId,
        payload,
        revision,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("revision, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function createCloudBackup(userId, payload, label) {
  const { data, error } = await ready()
    .from("worldforge_english_backups")
    .insert({ user_id: userId, payload, label })
    .select("id, label, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function listCloudBackups() {
  const { data, error } = await ready()
    .from("worldforge_english_backups")
    .select("id, label, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

export async function getCloudBackup(id) {
  const { data, error } = await ready()
    .from("worldforge_english_backups")
    .select("payload")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data.payload;
}

export async function deleteCloudBackup(id) {
  const { error } = await ready()
    .from("worldforge_english_backups")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function pruneCloudBackups() {
  const { data, error } = await ready()
    .from("worldforge_english_backups")
    .select("id")
    .order("created_at", { ascending: false })
    .range(10, 99);
  if (error) throw error;
  const ids = (data || []).map((item) => item.id);
  if (!ids.length) return;
  const { error: deleteError } = await ready()
    .from("worldforge_english_backups")
    .delete()
    .in("id", ids);
  if (deleteError) throw deleteError;
}

export async function stateHash(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

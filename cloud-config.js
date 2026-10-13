/*
 * Configuração pública do Supabase para o WorldForge RPG.
 * Os valores aqui são públicos em um site estático. Use somente a publishable key
 * (ou a chave legacy anon), nunca a secret/service_role key.
 * enabled só deve ficar true depois de aplicar supabase/schema.sql e revisar os avisos.
 * communityEnabled só deve ficar true depois de verificar RLS e testar a migração comunitária em staging.
 */
window.WORLDFORGE_CLOUD_CONFIG = {
  url: 'https://urvtkpqpguxthjznmtyu.supabase.co',
  publishableKey: 'sb_publishable_A_UWfFS6GHU8c_0kiy8Aqg_DcBO6dCb',
  enabled: true,
  communityEnabled: false
};

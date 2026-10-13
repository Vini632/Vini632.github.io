/*
 * Configuração pública do Supabase para o WorldForge RPG.
 * Os valores aqui são públicos em um site estático. Use somente a publishable key
 * (ou a chave legacy anon), nunca a secret/service_role key.
 * enabled só deve ficar true depois de aplicar supabase/schema.sql e revisar os avisos.
 * communityEnabled libera o Fórum, a Vitrine e as Guildas após a instalação do esquema e das permissões comunitárias.
 * worldLibraryEnabled libera o catálogo público; salvar uma cópia ainda requer conta e a tabela worldforge_worlds.
 */
window.WORLDFORGE_CLOUD_CONFIG = {
  url: 'https://urvtkpqpguxthjznmtyu.supabase.co',
  publishableKey: 'sb_publishable_A_UWfFS6GHU8c_0kiy8Aqg_DcBO6dCb',
  enabled: true,
  // A entrega pela Brevo não foi confirmada. Login por senha continua disponível
  // para contas confirmadas; novos envios ficam suspensos na interface.
  mailDeliveryAvailable: false,
  communityEnabled: true,
  worldLibraryEnabled: true
};

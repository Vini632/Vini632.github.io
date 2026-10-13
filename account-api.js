(function(root) {
  'use strict';
  function authMessage(error, context = 'login') {
    const code = String(error?.code || '').toLowerCase();
    const text = String(error?.message || '').toLowerCase();
    if (error?.status === 429 || /rate_limit|over_email_send_rate_limit/.test(code)) return 'Muitas tentativas. Aguarde antes de tentar novamente.';
    if (/email_address_not_authorized|email_address_invalid/.test(code) || /email address not authorized/.test(text)) return 'Não foi possível enviar o e-mail para este endereço. Tente novamente mais tarde.';
    if (context === 'signup' && (/user_already_exists|email_exists|23505/.test(code) || /already registered|duplicate key|users_email_partial_key/.test(text))) return 'Esse e-mail já possui uma conta. Use Entrar ou Esqueci a senha.';
    if (/email_not_confirmed/.test(code) || /email not confirmed/.test(text)) return 'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.';
    if (/invalid_credentials/.test(code) || /invalid login credentials/.test(text)) return 'E-mail ou senha incorretos.';
    if (/same_password/.test(code) || /different from the old/.test(text)) return 'Escolha uma senha diferente da senha anterior.';
    if (/weak_password/.test(code)) return 'A senha não atende às regras de segurança. Use uma senha mais longa e diferente.';
    if (/otp_expired|bad_jwt|session_not_found|reauthentication_needed/.test(code) || error?.status === 401) return 'O acesso expirou ou não é válido. Solicite um novo link de recuperação ou entre novamente.';
    if (context === 'recover') return 'Não foi possível solicitar o link. Aguarde e tente novamente.';
    if (context === 'signup') return 'Não foi possível criar a conta. Confira os dados e tente novamente.';
    if (context === 'reset') return 'Não foi possível alterar a senha. Solicite um novo link e tente novamente.';
    return 'Não foi possível entrar. Confira os dados e sua conexão.';
  }
  function validatePassword(password, confirmation) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new Error('Use uma senha com 8 a 128 caracteres.');
    if (password !== confirmation) throw new Error('As senhas não coincidem.');
  }
  function createClient({ url, publishableKey, fetchImpl = root.fetch }) {
    const base = String(url).replace(/\/$/, '');
    async function request(path, { token, method = 'GET', body } = {}) {
      const response = await fetchImpl(base + path, {
        method, headers: { apikey: publishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(data?.message || data?.msg || data?.error_description || data?.error || 'Falha no serviço de conta.');
        error.code = data?.error_code || data?.code; error.status = response.status; error.signedOut = data?.signedOut === true;
        throw error;
      }
      return data;
    }
    async function verifySession(session) {
      if (!session?.access_token) throw new Error('Sessão de recuperação ausente.');
      let current = { ...session };
      if (Number(current.expires_at) <= Date.now() / 1000 + 30) {
        if (!current.refresh_token) throw new Error('Sessão de recuperação expirada.');
        const refreshed = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: current.refresh_token } });
        current = { ...current, ...refreshed, expires_at: Date.now() / 1000 + (Number(refreshed.expires_in) || 3600) };
      }
      const user = await request('/auth/v1/user', { token: current.access_token });
      if (!user?.id || (session.user?.id && session.user.id !== user.id)) throw new Error('Sessão de recuperação inválida.');
      return { ...current, user };
    }
    return {
      async sendRecoveryEmail(email, redirectTo) {
        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Informe um e-mail válido.');
        await request('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirectTo), { method: 'POST', body: { email: email.trim() } });
        return 'Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha. Confira também a pasta de spam.';
      },
      async readCallback(hash, search = '') {
        const fragment = new URLSearchParams(String(hash).replace(/^#/, ''));
        const query = new URLSearchParams(String(search).replace(/^\?/, ''));
        const source = ['access_token', 'error', 'error_code', 'token_hash', 'code'].some(key => fragment.has(key)) ? fragment : query;
        if (!['access_token', 'error', 'error_code', 'token_hash', 'code'].some(key => source.has(key))) return { handled: false };
        if (source.has('error') || source.has('error_code') || source.has('code')) return { handled: true, error: 'O link expirou ou não é válido. Solicite um novo link.' };
        const type = source.get('type');
        let session;
        if (source.has('token_hash')) {
          if (type !== 'recovery' && type !== 'signup' && type !== 'email') return { handled: true, error: 'Este link de acesso não é válido.' };
          session = await request('/auth/v1/verify', { method: 'POST', body: { token_hash: source.get('token_hash'), type } });
          session.expires_at = Date.now() / 1000 + (Number(session.expires_in) || 3600);
        } else {
          session = { access_token: source.get('access_token'), refresh_token: source.get('refresh_token'), expires_at: Date.now() / 1000 + (Number(source.get('expires_in')) || 3600) };
        }
        return { handled: true, recovery: type === 'recovery', session: await verifySession(session) };
      },
      verifySession,
      async updatePassword(session, password, confirmation) {
        validatePassword(password, confirmation);
        const verified = await verifySession(session);
        await request('/auth/v1/user', { token: verified.access_token, method: 'PUT', body: { password } });
        let signedOut = true;
        try { await request('/auth/v1/logout?scope=global', { token: verified.access_token, method: 'POST' }); } catch { signedOut = false; }
        return { signedOut };
      },
      async deleteAccount(session, password, confirmation) {
        if (confirmation !== 'DELETAR') throw new Error('Digite DELETAR para confirmar a exclusão.');
        if (!password || password.length > 128) throw new Error('Informe sua senha atual.');
        return request('/functions/v1/delete-account', { token: session.access_token, method: 'POST', body: { password, confirmation } });
      }
    };
  }
  const api = { authMessage, validatePassword, createClient };
  root.WORLDFORGE_ACCOUNT_API = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'object' ? window : globalThis);

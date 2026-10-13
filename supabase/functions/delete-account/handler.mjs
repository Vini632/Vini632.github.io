const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createDeletionHandler({ url, anonKey, serviceKey, fetchImpl = fetch }) {
  const base = String(url || '').replace(/\/$/, '');
  return async function handle(request) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = origin === 'https://worldforge.site' || origin === 'https://vini632.github.io' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin', ...(allowedOrigin ? { 'Access-Control-Allow-Origin': origin } : {}) };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowedOrigin) return reply(403, { error: 'Origem não permitida.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' } });
    if (request.method !== 'POST') return reply(405, { error: 'Método não permitido.' });
    if (!base || !anonKey || !serviceKey) return reply(503, { error: 'O serviço de exclusão está indisponível.' });
    const authorization = request.headers.get('Authorization') || '';
    if (!/^Bearer \S+$/i.test(authorization)) return reply(401, { error: 'Entre na sua conta antes de continuar.' });
    let signedOut = false;
    try {
      const raw = await request.text();
      if (raw.length > 4096) return reply(413, { error: 'Pedido muito grande.' });
      let input;
      try { input = JSON.parse(raw); } catch { return reply(400, { error: 'Pedido inválido.' }); }
      if (input?.confirmation !== 'DELETAR' || typeof input?.password !== 'string' || input.password.length > 128) return reply(400, { error: 'Confira os dados e digite DELETAR.' });
      const userResponse = await fetchImpl(base + '/auth/v1/user', { headers: { apikey: anonKey, Authorization: authorization } });
      if (!userResponse.ok) return reply(401, { error: 'Sua sessão expirou. Entre novamente.' });
      const user = await userResponse.json();
      if (!UUID.test(user?.id || '') || !user.email || user.is_anonymous) return reply(403, { error: 'Esta conta não pode ser excluída por este fluxo.' });
      let claims;
      try { claims=JSON.parse(atob(authorization.split(' ')[1].split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); }
      catch { return reply(401,{error:'Sessão inválida.'}); }
      if(claims.sub!==user.id || !UUID.test(claims.session_id||'')) return reply(401,{error:'Entre novamente.'});
      const sessionResponse=await fetchImpl(base+'/rest/v1/rpc/wf_active_auth_session',{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify({p_owner:user.id,p_session:claims.session_id})});
      if(!sessionResponse.ok || await sessionResponse.json()!==true) return reply(401,{error:'Sua sessão foi encerrada. Entre novamente.'});
      const hasMfa=user.factors?.some(f=>f.status==='verified');
      if(hasMfa && claims.aal!=='aal2') return reply(403,{error:'Verifique seu 2FA antes de excluir a conta.'});
      const passwordAccount=user.identities?.some(identity=>identity.provider==='email');
      let proof;
      if(!passwordAccount){
        const recentTotp=claims.amr?.some(item=>item.method==='totp' && item.timestamp>Date.now()/1000-300 && item.timestamp<=Date.now()/1000+30);
        if(!hasMfa || claims.aal!=='aal2' || !recentTotp) return reply(403,{error:'Para excluir uma conta de login externo, ative o 2FA e confirme um código recente.'});
        proof={access_token:authorization.split(' ')[1],user};
      }else{
      if(!input.password) return reply(400,{error:'Informe sua senha atual.'});
      const proofResponse = await fetchImpl(base + '/auth/v1/token?grant_type=password', {
        method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password: input.password })
      });
      input.password = '';
      if (!proofResponse.ok) return reply(proofResponse.status === 429 ? 429 : 403, { error: proofResponse.status === 429 ? 'Muitas tentativas. Aguarde e tente novamente.' : 'Não foi possível confirmar a senha atual.' });
      proof = await proofResponse.json();
      if (proof.user?.id !== user.id || !proof.access_token) return reply(403, { error: 'Não foi possível confirmar esta conta.' });
      }
      const logout = await fetchImpl(base + '/auth/v1/logout?scope=global', { method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${proof.access_token}` } });
      if (!logout.ok) return reply(502, { error: 'Não foi possível encerrar as sessões. A conta foi preservada.' });
      signedOut = true;
      const deleted = await fetchImpl(base + '/auth/v1/admin/users/' + encodeURIComponent(user.id), {
        method: 'DELETE', headers: { apikey: serviceKey, ...(serviceKey.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${serviceKey}` }), 'Content-Type': 'application/json' }, body: JSON.stringify({ should_soft_delete: false })
      });
      if (!deleted.ok) return reply(502, { error: 'As sessões foram encerradas, mas não foi possível excluir a conta. Entre novamente e tente mais tarde.', signedOut });
      return reply(200, { deleted: true });
    } catch {
      return reply(502, { error: 'O serviço não concluiu a operação. Tente novamente mais tarde.', signedOut });
    }
  };
}

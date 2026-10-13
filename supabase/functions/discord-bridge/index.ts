// All administrative credentials stay in this server function.
function defaultKey(name: string) {
  try { const keys = JSON.parse(Deno.env.get(name) || '{}'); return keys.default || Object.values(keys)[0]; }
  catch { return undefined; }
}
const url = Deno.env.get('SUPABASE_URL');
const publicKey = defaultKey('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = defaultKey('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const snowflake = /^[0-9]{15,22}$/;
async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2,'0')).join('');
}
async function db(path: string, options: RequestInit = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {...options, headers: {
    apikey: String(serviceKey), Authorization: `Bearer ${serviceKey}`,
    'Content-Type':'application/json', ...(options.headers || {})
  }});
  if (!response.ok) throw new Error('database');
  return response.status === 204 ? null : response.json();
}
async function rpc(name: string, args: unknown) {
  return db(`rpc/${name}`, {method:'POST',body:JSON.stringify(args)});
}
async function boundedBody(req: Request) {
  if (!req.body) throw new Error('body');
  const reader = req.body.getReader(), chunks: Uint8Array[] = [];
  let length=0;
  while (true) {
    const {done,value}=await reader.read(); if(done) break;
    length+=value.length;
    if(length>65536) {await reader.cancel();throw new Error('body');}
    chunks.push(value);
  }
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
Deno.serve(async req => {
  const origin=req.headers.get('Origin');
  const allowed=!origin || origin==='https://vini632.github.io' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const headers: Record<string,string> = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin && allowed) headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Headers']='authorization,apikey,content-type';
  headers['Access-Control-Allow-Methods']='POST,OPTIONS';
  const reply=(status: number, body: unknown)=>new Response(JSON.stringify(body),{status,headers});
  if(!allowed) return reply(403,{error:'Origem não permitida.'});
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
  if(req.method!=='POST') return reply(405,{error:'Método não permitido.'});
  if(!url || !publicKey || !serviceKey) return reply(503,{error:'Integração indisponível.'});
  const token=req.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if(!token || token.length>8192) return reply(401,{error:'Entre novamente na sua conta.'});
  let body;
  try {body=await boundedBody(req);} catch {return reply(400,{error:'Pedido inválido.'});}
  if(!body || typeof body!=='object' || Array.isArray(body)) return reply(400,{error:'Pedido inválido.'});
  try {
    if(token.startsWith('wfbot_')) {
      if(!/^wfbot_[A-Za-z0-9_-]{43}$/.test(token)) return reply(401,{error:'Bot não autorizado.'});
      const keys=await db(`worldforge_discord_bot_keys?token_hash=eq.${await hash(token)}&active=eq.true&select=id,guild_id&limit=1`);
      const key=keys?.[0];
      if(!key) return reply(401,{error:'Bot não autorizado.'});
      if(body.guild_id!==key.guild_id) return reply(403,{error:'Servidor não autorizado.'});
      if(body.action==='bot-dashboard-health') {await db('worldforge_discord_jobs?select=id&limit=0');return reply(200,{ready:true});}
      if(body.action==='bot-claim-job') return reply(200,{job:await rpc('wf_discord_claim_job',{p_key:key.id})});
      if(body.action==='bot-complete-job') {
        if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id)||!['done','failed'].includes(body.state)||JSON.stringify(body.result).length>60000) return reply(400,{error:'Resultado inválido.'});
        await db(`worldforge_discord_jobs?id=eq.${body.id}&bot_key_id=eq.${key.id}&state=eq.running`,{method:'PATCH',body:JSON.stringify({state:body.state,result:body.result,finished_at:new Date().toISOString()})});
        return reply(200,{success:true});
      }
      if(typeof body.discord_user_id!=='string' || !snowflake.test(body.discord_user_id)) return reply(400,{error:'Usuário inválido.'});
      if(body.action==='bot-create-link') {
        if(typeof body.discord_name!=='string' || !body.discord_name.trim() || body.discord_name.length>100) return reply(400,{error:'Nome inválido.'});
        const code=[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');
        const result=await rpc('wf_discord_create_challenge',{p_bot_key_id:key.id,p_user_id:body.discord_user_id,p_name:body.discord_name,p_token_hash:await hash(code)});
        if(result.status!==200) return reply(result.status,{error:'Aguarde antes de solicitar outro código.'});
        return reply(200,{code,expires_in:600});
      }
      if(body.action!=='bot-worlds' && body.action!=='bot-unlink') return reply(400,{error:'Ação inválida.'});
      const filter=`discord_user_id=eq.${body.discord_user_id}&bot_key_id=eq.${key.id}&guild_id=eq.${key.guild_id}`;
      const links=await db(`worldforge_discord_links?${filter}&select=discord_name&limit=1`);
      if(!links.length) return reply(404,{error:'Conta não vinculada.'});
      if(body.action==='bot-unlink') {
        await db(`worldforge_discord_links?${filter}`,{method:'DELETE'});
        return reply(200,{success:true});
      }
      const worlds=await rpc('wf_discord_worlds',{p_bot_key_id:key.id,p_user_id:body.discord_user_id});
      return reply(200,{discord_name:links[0].discord_name,worlds});
    }
    // Validate JWT with Auth, never trust user IDs supplied by the browser.
    const auth=await fetch(`${url}/auth/v1/user`,{headers:{apikey:String(publicKey),Authorization:`Bearer ${token}`}});
    if(!auth.ok) return reply(401,{error:'Sua sessão expirou. Entre novamente.'});
    const user=await auth.json();
    if(!user.id || !user.email_confirmed_at) return reply(403,{error:'Confirme sua conta antes de vincular o Discord.'});
    let validatedClaims;
    try{validatedClaims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{return reply(401,{error:'Sessão inválida.'});}
    if(validatedClaims.sub!==user.id || !/^[a-f0-9-]{36}$/.test(validatedClaims.session_id||'') || await rpc('wf_active_auth_session',{p_owner:user.id,p_session:validatedClaims.session_id})!==true) return reply(401,{error:'Sua sessão foi encerrada. Entre novamente.'});
    if(user.factors?.some((f:{status:string})=>f.status==='verified') && validatedClaims.aal!=='aal2') return reply(403,{error:'Verifique seu 2FA para continuar.'});
    if(typeof body.action==='string' && body.action.startsWith('panel-')) {
      // Auth validated the signature above. Decode only this validated JWT, never browser-supplied claims.
      const claims=validatedClaims;
      if(claims.sub!==user.id || claims.aal!=='aal2' || !/^[a-f0-9-]{36}$/.test(claims.session_id||'') || !user.factors?.some((f: {status:string})=>f.status==='verified')) return reply(403,{error:'Ative e verifique o 2FA para acessar a administração.'});
      if(body.action==='panel-result') {
        if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id)) return reply(400,{error:'Pedido inválido.'});
        const rows=await db(`worldforge_discord_jobs?id=eq.${body.id}&owner_id=eq.${encodeURIComponent(user.id)}&select=id,action,state,result,created_at,started_at,finished_at&limit=1`);
        return rows.length?reply(200,{job:rows[0]}):reply(404,{error:'Pedido não encontrado.'});
      }
      if(body.action==='panel-history') {
        const rows=await db(`worldforge_discord_jobs?owner_id=eq.${encodeURIComponent(user.id)}&action=neq.status&select=id,action,state,result,created_at,finished_at&order=created_at.desc&limit=20`);
        return reply(200,{jobs:rows});
      }
      if(body.action!=='panel-request') return reply(400,{error:'Ação inválida.'});
      const actions=['status','setup','publish-panel','associate','permissions','ticket-config','settings','role-add','role-remove','timeout','kick','ban','clear','publish-official','ticket-close'];
      if(!actions.includes(body.command) || !/^[a-f0-9-]{36}$/.test(body.request_id||'') || !body.payload || typeof body.payload!=='object' || Array.isArray(body.payload) || JSON.stringify(body.payload).length>8000) return reply(400,{error:'Pedido inválido.'});
      const links=await db(`worldforge_discord_links?owner_id=eq.${encodeURIComponent(user.id)}&select=discord_user_id,bot_key_id,guild_id&limit=1`);
      const identity=user.identities?.find((i:{provider:string})=>i.provider==='discord');
      const discordId=links[0]?.discord_user_id || identity?.identity_data?.sub;
      if(!snowflake.test(discordId||'')) return reply(403,{error:'Vincule seu Discord nas configurações do WorldForge ou entre pelo Discord.'});
      const keys=await db(`worldforge_discord_bot_keys?active=eq.true&guild_id=eq.1559443784255803464${links[0]?'&id=eq.'+links[0].bot_key_id:''}&select=id&order=created_at.desc&limit=1`);
      if(!keys.length) return reply(503,{error:'O bot ainda não está conectado a este painel.'});
      const result=await rpc('wf_discord_enqueue',{p_key:keys[0].id,p_owner:user.id,p_session:claims.session_id,p_discord:discordId,p_request:body.request_id,p_action:body.command,p_payload:body.payload});
      return result.status===200?reply(200,{id:result.id}):reply(result.status,{error:result.status===429?'Aguarde antes de enviar mais ações.':'Sessão ou vínculo sem autorização. Entre novamente.'});
    }
    if(body.action==='user-link') {
      if(typeof body.code!=='string' || !/^[a-f0-9]{32}$/.test(body.code)) return reply(400,{error:'Código inválido. Copie o código de /vincular.'});
      const result=await rpc('wf_discord_claim',{p_owner_id:user.id,p_token_hash:await hash(body.code)});
      const errors: Record<number,string>={400:'Código inválido, usado ou expirado. Solicite outro com /vincular.',409:'Uma dessas contas já está vinculada. Desvincule antes de conectar outra.',429:'Limite de tentativas atingido. Tente mais tarde.'};
      return result.status===200 ? reply(200,{success:true,discord_name:result.discord_name}) : reply(result.status,{error:errors[result.status]||'Não foi possível vincular.'});
    }
    if(body.action!=='user-status' && body.action!=='user-unlink') return reply(400,{error:'Ação inválida.'});
    if(body.action==='user-unlink') {
      await db(`worldforge_discord_links?owner_id=eq.${encodeURIComponent(user.id)}`,{method:'DELETE'});
      return reply(200,{success:true});
    }
    const links=await db(`worldforge_discord_links?owner_id=eq.${encodeURIComponent(user.id)}&select=discord_user_id,discord_name,guild_id,linked_at&limit=1`);
    return reply(200,{link:links[0]||null});
  } catch {
    // No request bodies, credentials, JWTs, or linking codes in logs.
    return reply(503,{error:'Não foi possível conectar ao serviço. Tente mais tarde.'});
  }
});

import { createClient } from '@supabase/supabase-js';

const config = window.WORLDFORGE_CLOUD_CONFIG;
const client = createClient(config.url, config.publishableKey, {
  auth: { storageKey: 'worldforge.cloud-session.v1', flowType: 'pkce', detectSessionInUrl: false,
    persistSession: true, autoRefreshToken: true }
});
const checked = ({data,error}) => { if(error) throw error; return data; };
let providers;
let dialogBusy = false;
function friendly(error) {
  if(/mfa_verification_failed|invalid.*code/i.test(error?.code+' '+error?.message)) return 'Código incorreto ou expirado. Confira o relógio do autenticador e tente novamente.';
  if(error?.status===429) return 'Aguarde um pouco antes de tentar novamente.';
  if(error?.code==='cancelled') return 'Verificação cancelada.';
  return 'Não foi possível concluir. Confira sua conexão e tente novamente.';
}
async function settings() {
  if(!providers) {
    const response = await fetch(config.url+'/auth/v1/settings', {headers:{apikey:config.publishableKey}});
    if(!response.ok) throw new Error('Não foi possível consultar os provedores de acesso.');
    providers = (await response.json()).external || {};
  }
  return providers;
}
async function oauth(provider) {
  if(!window.isSecureContext)throw new Error('Abra o WorldForge com HTTPS para entrar na sua conta.');
  if(!['discord','google'].includes(provider) || !(await settings())[provider]) throw new Error('Este provedor ainda precisa ser ativado pelo responsável do WorldForge.');
  checked(await client.auth.signInWithOAuth({provider,options:{redirectTo:location.origin+'/', scopes:provider==='discord'?'identify email':undefined}}));
}
async function callback(code) { return checked(await client.auth.exchangeCodeForSession(code)).session; }
async function session() {
  if(!window.isSecureContext)throw new Error('Abra o WorldForge com HTTPS para acessar sua conta.');
  const current=checked(await client.auth.getSession()).session;
  if(!current) throw new Error('Entre na sua conta para continuar.');
  checked(await client.auth.getUser());
  return current;
}
async function factors() { return checked(await client.auth.mfa.listFactors()).totp || []; }
async function assurance() { return checked(await client.auth.mfa.getAuthenticatorAssuranceLevel()); }

// Secrets used to enroll a factor exist only in this dialog and are never saved by the UI.
async function mfa({enroll=false,force=false,remove=false}={}) {
  if(dialogBusy) throw new Error('Conclua a verificação que já está aberta.');
  dialogBusy=true;
  let list,verified,level;
  try{
    await session();list=await factors();verified=list.filter(f=>f.status==='verified');level=await assurance();
    if(!enroll && !remove && !force && (!verified.length || level.currentLevel==='aal2')){dialogBusy=false;return session();}
    if(!verified.length && !enroll)throw new Error('Ative a autenticação em duas etapas nas configurações da sua conta.');
  }catch(error){dialogBusy=false;throw error;}
  let newFactor,completed=false;
  const dialog=document.createElement('dialog');dialog.className='wf-auth-dialog';
  const heading=document.createElement('h2');heading.textContent=enroll?'Proteja sua conta com 2FA':remove?'Desativar autenticação em duas etapas':'Confirme que é você';
  const description=document.createElement('p');description.textContent=enroll?'Adicione esta conta ao Google Authenticator, Microsoft Authenticator ou outro app TOTP. Guarde a chave em um local seguro para não perder o acesso.':'Digite o código de seis números do seu aplicativo autenticador.';
  const form=document.createElement('form');form.method='dialog';
  const feedback=document.createElement('p');feedback.className='wf-auth-feedback';feedback.setAttribute('role','status');
  const label=document.createElement('label');label.textContent='Código do autenticador';
  const input=document.createElement('input');input.type='text';input.inputMode='numeric';input.autocomplete='one-time-code';input.pattern='[0-9]{6}';input.maxLength=6;input.required=true;
  label.append(input);
  const select=document.createElement('select');select.setAttribute('aria-label','Aplicativo autenticador');
  for(const factor of verified){const option=document.createElement('option');option.value=factor.id;option.textContent=factor.friendly_name||'Autenticador';select.append(option);}
  if(verified.length>1 && !enroll) form.append(select);
  const submit=document.createElement('button');submit.type='submit';submit.className='button button-primary';submit.textContent=enroll?'Ativar 2FA':remove?'Confirmar e desativar':'Verificar';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='button button-quiet';cancel.textContent='Cancelar';
  form.append(label,feedback,submit,cancel);dialog.append(heading,description,form);document.body.append(dialog);
  try {
    if(enroll){
      if(verified.length) throw new Error('Sua conta já possui 2FA.');
      for(const orphan of list.filter(f=>f.status==='unverified')) checked(await client.auth.mfa.unenroll({factorId:orphan.id}));
      newFactor=checked(await client.auth.mfa.enroll({factorType:'totp',friendlyName:'WorldForge'}));
      const qr=document.createElement('img');qr.alt='QR code para configurar seu autenticador';qr.className='wf-auth-qr';qr.src=newFactor.totp.qr_code;
      const key=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Usar chave manual';const code=document.createElement('code');code.textContent=newFactor.totp.secret;key.append(summary,code);form.prepend(qr,key);
    }
    dialog.showModal();input.focus();
    await new Promise((resolve,reject)=>{
      let busy=false;
      const abort=()=>{if(busy)return;const error=new Error('Verificação cancelada.');error.code='cancelled';reject(error);};
      cancel.onclick=abort;dialog.addEventListener('cancel',event=>{event.preventDefault();abort();});
      form.onsubmit=async event=>{
        event.preventDefault();if(busy || !form.reportValidity())return;
        busy=true;submit.disabled=cancel.disabled=true;feedback.textContent='Verificando…';
        try{
          const factorId=newFactor?.id||select.value||verified[0].id;
          checked(await client.auth.mfa.challengeAndVerify({factorId,code:input.value}));
          input.value='';
          if(remove) for(const factor of verified) checked(await client.auth.mfa.unenroll({factorId:factor.id}));
          completed=true;resolve();
        }catch(error){feedback.textContent=friendly(error);input.value='';input.focus();}
        finally{busy=false;submit.disabled=cancel.disabled=false;}
      };
    });
    return session();
  } finally {
    dialog.close();dialog.remove();dialogBusy=false;
    if(newFactor && !completed) await client.auth.mfa.unenroll({factorId:newFactor.id}).catch(()=>{});
  }
}
client.auth.onAuthStateChange((event,current)=>{
  // Dispatch outside the SDK's auth lock; listeners must not call Auth synchronously.
  setTimeout(()=>window.dispatchEvent(new CustomEvent('worldforge-auth-session',{detail:{event,session:current}})),0);
});
window.WORLDFORGE_AUTH={client,settings,oauth,callback,session,mfa,factors,assurance,friendly,checked};

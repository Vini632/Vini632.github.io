(() => {
  'use strict';
  const auth=window.WORLDFORGE_AUTH,config=window.WORLDFORGE_CLOUD_CONFIG,$=s=>document.querySelector(s);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={'setup':'Montar estrutura','publish-panel':'Atualizar painel','associate':'Associar canal','permissions':'Revisar permissões','ticket-config':'Configurar atendimento','settings':'Salvar configuração','role-add':'Adicionar cargo','role-remove':'Remover cargo','timeout':'Silenciar membro','kick':'Expulsar membro','ban':'Banir membro','clear':'Excluir mensagens','publish-official':'Publicar conteúdo oficial','ticket-close':'Encerrar ticket'};
  const states={pending:'Na fila',running:'Em execução',done:'Concluída',failed:'Não concluída',expired:'Expirada'};
  let snapshot,currentOwner,busy=false,connected=false;
  const pendingKey='worldforge.bot.pending.v1';
  const feedback=(message,error=false)=>{$('#feedback').textContent=message;$('#feedback').classList.toggle('error',error);};
  function switchView(name){document.querySelectorAll('[data-page]').forEach(page=>page.hidden=page.dataset.page!==name);document.querySelectorAll('nav [data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===name));if(name==='history'&&connected)history().catch(error=>feedback(error.message,true));}
  async function api(body){
    const session=await auth.session();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(config.url+'/functions/v1/discord-bridge',{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'O serviço não confirmou esta solicitação.');
      return result;
    }finally{clearTimeout(timer);}
  }
  function pending(){try{const value=JSON.parse(sessionStorage.getItem(pendingKey));return value?.owner===currentOwner?value:null;}catch{return null;}}
  function savePending(value){sessionStorage.setItem(pendingKey,JSON.stringify(value));}
  async function waitFor(id){
    const end=Date.now()+110000;
    while(Date.now()<end){
      const {job}=await api({action:'panel-result',id});
      if(job.state==='done')return job.result;
      if(job.state==='failed'||job.state==='expired')throw Object.assign(new Error(job.result?.error||'O pedido expirou sem executar. Confira se o bot está online.'),{terminal:true});
      if(job.state==='running' && Date.now()-Date.parse(job.started_at)>90000)throw new Error('O resultado não foi confirmado. Confira o histórico e o servidor antes de repetir a ação.');
      feedback(job.state==='pending'?'Pedido recebido. Aguardando o bot…':'O bot está executando sua solicitação…');
      await new Promise(resolve=>setTimeout(resolve,3000));
    }
    throw new Error('O bot ainda não confirmou o resultado. Retome a consulta; a ação não será enviada novamente.');
  }
  async function request(command,payload={},resume=false){
    let stored=resume?pending():null;
    if(command!=='status'&&!resume&&pending())throw new Error('Existe uma ação aguardando resultado. Retome a consulta antes de enviar outra.');
    const job=stored||{owner:currentOwner,command,payload,request_id:crypto.randomUUID(),createdAt:Date.now()};
    if(command!=='status')savePending(job);
    if(!job.id){
      if(resume && Date.now()-job.createdAt>120000)throw new Error('A conexão caiu antes de confirmar o pedido. Confira o histórico antes de iniciar outra ação.');
      const result=await api({action:'panel-request',command:job.command,payload:job.payload,request_id:job.request_id});job.id=result.id;
      if(command!=='status')savePending(job);
    }
    try{const result=await waitFor(job.id);if(command!=='status')sessionStorage.removeItem(pendingKey);return result;}
    catch(error){if(error.terminal && command!=='status')sessionStorage.removeItem(pendingKey);throw error;}
  }
  async function connect(){
    if(busy)return;
    busy=true;document.body.classList.add('busy');$('#refresh').disabled=true;
    try{
      const session=await auth.session();currentOwner=session.user.id;
      const factors=await auth.factors();const verified=factors.some(f=>f.status==='verified');
      $('#login-link').hidden=true;$('#discord-login').hidden=true;$('#enable-mfa').hidden=verified;$('#verify-mfa').hidden=!verified;
      if(!verified){feedback('Ative o 2FA para proteger o acesso da equipe.');return;}
      const level=await auth.assurance();if(level.currentLevel!=='aal2'){feedback('Verifique seu aplicativo autenticador para continuar.');return;}
      feedback('Conferindo seu acesso no Discord…');snapshot=await request('status');connected=true;render();
      $('#access').hidden=true;$('#workspace').hidden=false;$('#bot-status').textContent='Bot conectado';$('#bot-status').classList.add('online');$('#connection').textContent='Discord vinculado · 2FA verificado';feedback('Permissões atualizadas.');
      if(pending())showResume();
    }catch(error){connected=false;$('#workspace').hidden=true;$('#access').hidden=false;feedback(error.message,true);$('#bot-status').textContent='Acesso não confirmado';$('#bot-status').classList.remove('online');}
    finally{busy=false;document.body.classList.remove('busy');$('#refresh').disabled=!connected;}
  }
  function fillOptions(){
    for(const select of document.querySelectorAll('[data-options]')){
      const old=select.value;select.replaceChildren();
      if(select.dataset.empty){const option=document.createElement('option');option.value='';option.textContent=select.dataset.empty;select.append(option);}
      let entries;
      if(select.dataset.options==='panels')entries=snapshot.panels.map(p=>({id:p.section,name:p.section}));
      else if(select.dataset.options==='roles')entries=snapshot.roles.filter(r=>!r.managed);
      else entries=snapshot.channels.filter(c=>select.dataset.options!=='text-channels'||c.type==='text');
      for(const entry of entries){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;select.append(option);}
      if([...select.options].some(o=>o.value===old))select.value=old;
    }
    for(const field of ['log_channel','welcome_channel','auto_role']){const select=$(`form[data-command="settings"] input[value="${field}"]`)?.form.elements.value;if(select)select.value=snapshot.settings[field]||'';}
    const tickets=$('form[data-command="ticket-config"]');if(tickets)tickets.elements.role_id.value=snapshot.ticket_config?.staff_role_id||'';
  }
  function render(){
    $('#server-name').textContent=snapshot.guild.name;$('#actor-name').textContent=snapshot.actor.name;
    $('#metrics').innerHTML=[['Membros',snapshot.guild.members??'—'],['Canais',snapshot.guild.channels],['Painéis oficiais',snapshot.panels.filter(p=>p.channel_id&&p.kind!=='preserved').length],['Tickets abertos',snapshot.tickets.length]].map(([label,value])=>`<article class="metric"><small>${escape(label)}</small><strong>${escape(value)}</strong></article>`).join('');
    $('#structure').innerHTML=snapshot.plan.map(line=>`<div>${escape(line.replace(/\*\*/g,''))}</div>`).join('');
    $('#panels').innerHTML=snapshot.panels.map(panel=>`<article class="card"><span class="panel-kind">${panel.kind==='forum'?'FÓRUM':panel.kind==='preserved'?'AUTOMAÇÃO PRESERVADA':'PAINEL PERMANENTE'}</span><h3>${escape(panel.title)}</h3><span class="channel-name">${escape(panel.section)} · ${panel.channel_id?'Associado':'Canal ausente'}</span><div class="actions">${panel.channel_id?`<a class="quiet" href="https://discord.com/channels/${escape(snapshot.guild.id)}/${escape(panel.channel_id)}" target="_blank" rel="noopener noreferrer">Abrir canal ↗</a>`:''}${panel.kind!=='preserved'&&snapshot.permissions.administrator?`<button class="primary" data-publish="${escape(panel.section)}">Atualizar painel</button>`:''}</div></article>`).join('');
    $('#tickets-list').innerHTML=snapshot.tickets.length?snapshot.tickets.map(ticket=>`<div class="ticket-row"><div><strong>${escape(ticket.kind)}</strong><small>${escape(ticket.created_at)}</small></div><div class="actions"><a class="quiet" href="https://discord.com/channels/${escape(snapshot.guild.id)}/${escape(ticket.channel_id)}" target="_blank" rel="noopener noreferrer">Abrir ↗</a>${snapshot.permissions.ticket_staff?`<button class="danger" data-close-ticket="${escape(ticket.channel_id)}">Encerrar</button>`:''}</div></div>`).join(''):'<p class="empty">Nenhum atendimento aberto.</p>';
    document.querySelectorAll('.admin-only').forEach(item=>item.hidden=!snapshot.permissions.administrator);
    document.querySelectorAll('[data-permission]').forEach(item=>item.hidden=item.dataset.permission==='moderation'?!['moderate_members','kick_members','ban_members'].some(p=>snapshot.permissions[p]):!snapshot.permissions[item.dataset.permission]);
    $('#native-settings').hidden=!snapshot.native_welcome||!snapshot.permissions.administrator;
    if(snapshot.native_welcome)$('#welcome-note').textContent='Automação nativa ativada pelo responsável do bot. Escolha cargos sem poderes de moderação.';
    const select=$('#moderation-form').elements.command;
    for(const option of select.options)option.disabled=!snapshot.permissions[{timeout:'moderate_members',kick:'kick_members',ban:'ban_members'}[option.value]];
    if(select.selectedOptions[0]?.disabled)select.value=[...select.options].find(o=>!o.disabled)?.value||'';
    $('#timeout-field').hidden=select.value!=='timeout';$('#moderation-form').elements.minutes.required=select.value==='timeout';
    fillOptions();
  }
  function describe(command,payload){
    if(command==='setup')return snapshot.plan.map(x=>x.replace(/\*\*/g,'')).join('\n');
    const keyNames={section:'Seção',channel_id:'Canal',role_id:'Cargo',member_id:'Membro',minutes:'Minutos',reason:'Motivo',count:'Mensagens',field:'Configuração',value:'Valor',state:'Estado',title:'Título',details:'Conteúdo',link:'Link'};
    return Object.entries(payload).filter(([key])=>key!=='confirmed').map(([key,value])=>{
      const resource=(snapshot.channels.find(c=>c.id===value)||snapshot.roles.find(r=>r.id===value))?.name;
      return `${keyNames[key]||key}: ${resource?resource+' ('+value+')':value||'Desativar'}`;
    }).join('\n');
  }
  async function confirmAction(command,payload){
    if(!connected||busy)return;
    const dialog=$('#confirm-dialog');$('#confirm-title').textContent=labels[command]||command;
    const preview=$('#confirm-preview');preview.replaceChildren();
    if(command==='publish-official'){
      const card=document.createElement('article');card.className='publication-preview';const img=document.createElement('img');img.src='../discord-bot/assets/banner.png';img.alt='Arte oficial WorldForge';
      const body=document.createElement('div'),title=document.createElement('h3'),state=document.createElement('small'),content=document.createElement('p'),link=document.createElement('small');title.textContent=payload.title;state.textContent=payload.state+' · '+payload.section;content.textContent=payload.details;link.textContent=payload.link||'';body.append(title,state,content,link);card.append(img,body);preview.append(card);
    }else preview.textContent=describe(command,payload);
    $('#confirm-note').textContent=command==='permissions'?'Essa alteração restringe a publicação dos outros cargos nos canais oficiais. Revise o cargo da equipe.':command==='clear'?'Mensagens recentes serão excluídas permanentemente. Esta ação não pode ser desfeita.':'Esta ação será executada no servidor World Forge RPG e registrada no histórico.';
    dialog.showModal();
    const accepted=await new Promise(resolve=>{
      $('#confirm-yes').onclick=()=>resolve(true);$('#confirm-no').onclick=()=>resolve(false);dialog.oncancel=event=>{event.preventDefault();resolve(false);};
    });dialog.close();if(!accepted)return;
    await execute(command,payload);
  }
  function showResume(){
    if($('#resume-job'))return;
    const button=document.createElement('button');button.id='resume-job';button.className='quiet';button.textContent='Retomar consulta da ação pendente';button.onclick=()=>execute(pending()?.command,{},true);$('#feedback').after(button);
  }
  async function execute(command,payload,resume=false){
    if(busy||!command)return;busy=true;document.body.classList.add('busy');$('#refresh').disabled=true;
    try{const result=await request(command,payload,resume);feedback(result.message||'Ação concluída.');$('#resume-job')?.remove();if(result.report?.length){$('#confirm-preview').textContent=result.report.join('\n');$('#confirm-title').textContent='Resultado da operação';$('#confirm-note').textContent='Confira a estrutura no Discord.';$('#confirm-dialog').showModal();$('#confirm-yes').onclick=$('#confirm-no').onclick=()=>$('#confirm-dialog').close();$('#confirm-dialog').oncancel=null;} }
    catch(error){feedback(error.message||'Não foi possível conectar. A ação não será repetida automaticamente.',true);if(pending())showResume();}
    finally{busy=false;document.body.classList.remove('busy');$('#refresh').disabled=!connected;}
  }
  async function history(){
    const {jobs}=await api({action:'panel-history'});
    $('#history-list').innerHTML=jobs.length?jobs.map(job=>`<div class="history-row"><div><strong>${escape(labels[job.action]||job.action)}</strong><small>${escape(new Date(job.created_at).toLocaleString('pt-BR'))} · ${escape(job.id)}</small><small>${escape(job.result?.error||job.result?.message||'')}</small></div><span class="badge">${escape(states[job.state]||job.state)}</span></div>`).join(''):'<p class="empty">Você ainda não enviou ações pelo painel.</p>';
    if(pending() && Date.now()-pending().createdAt>120000){
      const button=document.createElement('button');button.className='quiet';button.textContent='Já conferi o servidor; liberar nova solicitação';button.onclick=()=>{sessionStorage.removeItem(pendingKey);$('#resume-job')?.remove();button.remove();feedback('Nova solicitação liberada. Confira o servidor antes de repetir uma operação.');};$('#history-list').append(button);
    }
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.view||button.dataset.go)switchView(button.dataset.view||button.dataset.go);
    if(button.dataset.publish)confirmAction('publish-panel',{section:button.dataset.publish}).catch(error=>feedback(error.message,true));
    if(button.dataset.closeTicket)confirmAction('ticket-close',{channel_id:button.dataset.closeTicket}).catch(error=>feedback(error.message,true));
  });
  document.addEventListener('submit',event=>{
    const form=event.target;if(!form.matches('[data-command],#moderation-form,#roles-form'))return;event.preventDefault();
    const data=Object.fromEntries(new FormData(form));const command=form.dataset.command||data.command;delete data.command;
    for(const key of ['minutes','count'])if(key in data)data[key]=Number(data[key]);
    if(command==='publish-official')data.confirmed=form.elements.confirmed.checked;
    confirmAction(command,data).catch(error=>feedback(error.message,true));
  });
  $('#moderation-form').elements.command.onchange=event=>{const timeout=event.target.value==='timeout';$('#timeout-field').hidden=!timeout;$('#moderation-form').elements.minutes.required=timeout;};
  $('#setup').onclick=()=>confirmAction('setup',{}).catch(error=>feedback(error.message,true));$('#refresh').onclick=connect;
  $('#history-refresh').onclick=()=>history().catch(error=>feedback(error.message,true));
  $('#login-link').onclick=()=>sessionStorage.setItem('worldforge.auth-return','/bot/');
  $('#discord-login').onclick=async()=>{try{sessionStorage.setItem('worldforge.auth-return','/bot/');await auth.oauth('discord');}catch(error){feedback(error.message,true);}};
  $('#enable-mfa').onclick=async()=>{try{await auth.mfa({enroll:true});await connect();}catch(error){feedback(error.message,true);}};
  $('#verify-mfa').onclick=async()=>{try{await auth.mfa({force:true});await connect();}catch(error){feedback(error.message,true);}};
  window.addEventListener('worldforge-auth-session',event=>{if(event.detail.event==='SIGNED_OUT'){connected=false;snapshot=null;$('#workspace').hidden=true;$('#access').hidden=false;$('#refresh').disabled=true;$('#login-link').hidden=false;feedback('Sessão encerrada. Entre novamente.',true);}});
  connect();
})();

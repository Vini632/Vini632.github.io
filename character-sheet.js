(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const identity = [['sistema','Sistema de regras'],['jogador','Jogador / responsável'],['ancestralidade','Ancestralidade / espécie'],['classe','Classe / arquétipo'],['origem','Origem / antecedente'],['alinhamento','Alinhamento / convicção']];
  const numbers = [['nivel','Nível',1],['experiencia','Experiência',0],['vida_atual','Vida atual',-9999],['vida_maxima','Vida máxima',0],['vida_temporaria','Vida temporária',0],['defesa','Defesa',0],['iniciativa','Iniciativa',-9999],['deslocamento','Deslocamento (unidade do sistema)',0],['moedas','Moedas',0]];
  const narrative = [['aparencia','Aparência'],['historia','História'],['ideais','Ideais'],['vinculos','Vínculos'],['defeitos','Defeitos'],['equipamentos','Inventário e equipamentos'],['habilidades','Habilidades e perícias'],['magias','Magias e recursos'],['anotacoes','Notas da sessão']];
  let dialog, context, baseline = '', importSequence = 0;
  function dirty() { return Boolean(dialog?.open && context && JSON.stringify(read()) !== baseline); }
  window.addEventListener('beforeunload', event => {
    if (!dirty()) return;
    event.preventDefault(); event.returnValue = '';
  });
  function defaults() {
    return {version:1,...Object.fromEntries([...identity,...narrative].map(([key])=>[key,''])),
      sistema:'Livre',nivel:1,experiencia:0,vida_atual:10,vida_maxima:10,vida_temporaria:0,defesa:10,iniciativa:0,deslocamento:9,moedas:0,
      atributos:['Força','Destreza','Constituição','Inteligência','Sabedoria','Carisma'].map(nome=>({nome,valor:10}))};
  }
  function attributeRow(attribute, index) {
    return `<div class="sheet-attribute"><label><span class="sr-only">Nome do atributo ${index+1}</span><input class="text-field" data-attribute-name value="${esc(attribute.nome)}" maxlength="40" required></label><label><span class="sr-only">Valor do atributo ${index+1}</span><input class="text-field" data-attribute-value type="number" min="-999" max="999" step="1" value="${attribute.valor}" required></label><button class="sheet-remove" type="button" data-sheet-action="remove-attribute" aria-label="Remover atributo ${index+1}">×</button></div>`;
  }
  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id='character-sheet-dialog'; dialog.className='sheet-dialog'; dialog.setAttribute('aria-labelledby','sheet-title');
    document.body.append(dialog);
    dialog.addEventListener('cancel', event=>{ event.preventDefault(); close(); });
    dialog.addEventListener('close', ()=>{ importSequence++; context=null; dialog.innerHTML=''; });
    dialog.addEventListener('input', ()=>feedback('Alterações ainda não salvas.'));
    dialog.addEventListener('submit', event=>{ event.preventDefault(); if(event.target.id==='character-sheet-form') save(); });
    dialog.addEventListener('click', event=>{
      const button=event.target.closest('[data-sheet-action]'); if(!button)return;
      const action=button.dataset.sheetAction;
      if(action==='close')return close();
      if(action==='add-attribute'){
        const rows=dialog.querySelectorAll('.sheet-attribute');
        if(rows.length>=12)return feedback('Você pode usar até 12 atributos.',true);
        dialog.querySelector('#sheet-attributes').insertAdjacentHTML('beforeend',attributeRow({nome:'',valor:0},rows.length));
        dialog.querySelector('.sheet-attribute:last-child input').focus(); feedback('Alterações ainda não salvas.');
      }
      if(action==='remove-attribute'){button.closest('.sheet-attribute').remove();feedback('Alterações ainda não salvas.');}
      if(action==='export') withDraft(sheet=>download({format:'worldforge-character-sheet',version:1,personagem:context.npc.nome,ficha:sheet}));
      if(action==='import')dialog.querySelector('#sheet-import').click();
      if(action==='print')withDraft(print);
    });
    dialog.addEventListener('change',async event=>{
      if(event.target.id!=='sheet-import')return;
      const input=event.target,file=input.files[0],sequence=++importSequence,current=context; input.value='';
      if(!file)return;
      try {
        if(file.size>128*1024)throw new Error('A ficha deve ter no máximo 128 KB.');
        const data=JSON.parse(await file.text());
        if(!dialog.open||context!==current||sequence!==importSequence)return;
        if(data.format!=='worldforge-character-sheet'||data.version!==1)throw new Error('Selecione um arquivo de ficha exportado pelo WorldForge.');
        window.WORLDFORGE_VALIDATE_SHEET(data.ficha);
        if(!confirm('Carregar esta ficha em '+context.npc.nome+'? Os campos atuais serão substituídos. Salve para confirmar.'))return;
        fill(data.ficha); feedback('Ficha importada para revisão. Clique em Salvar ficha para confirmar.');
      } catch(error){
        if(!dialog.open||context!==current||sequence!==importSequence)return;
        feedback(error.message||'Não foi possível importar a ficha.',true);
      }
    });
  }
  function fill(sheet) {
    const form=dialog.querySelector('form');
    [...identity,...numbers,...narrative].forEach(([key])=>{form.elements[key].value=sheet[key];});
    dialog.querySelector('#sheet-attributes').innerHTML=sheet.atributos.map(attributeRow).join('');
  }
  function read() {
    const form=dialog.querySelector('form'), sheet={version:1};
    [...identity,...narrative].forEach(([key])=>{sheet[key]=form.elements[key].value.trim();});
    numbers.forEach(([key])=>{sheet[key]=Number(form.elements[key].value);});
    sheet.atributos=[...dialog.querySelectorAll('.sheet-attribute')].map(row=>({nome:row.querySelector('[data-attribute-name]').value.trim(),valor:Number(row.querySelector('[data-attribute-value]').value)}));
    return sheet;
  }
  function withDraft(action) {
    if(!context)return;
    const form=dialog.querySelector('form');
    // Reveal invalid fields inside collapsed sections before browser validation.
    form.querySelectorAll(':invalid').forEach(input=>{const details=input.closest('details');if(details)details.open=true;});
    if(!form.reportValidity())return;
    try {action(window.WORLDFORGE_VALIDATE_SHEET(read()));} catch(error){feedback(error.message||'Revise a ficha.',true);}
  }
  function save() {
    withDraft(sheet=>{
      context.save(sheet);
      baseline=JSON.stringify(sheet);
      feedback('Ficha salva neste mundo. Use Dados & backup para enviar a cópia à nuvem.');
    });
  }
  function close() {
    if(dirty() && !confirm('Fechar sem salvar as alterações da ficha?'))return;
    dialog.close();
  }
  function feedback(message,error=false) {
    const status=dialog?.querySelector('#sheet-feedback');if(!status)return;
    status.textContent=message; status.classList.toggle('is-error',error);
  }
  function download(data) {
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link=document.createElement('a'); link.href=url;link.download='ficha-'+context.npc.nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').slice(0,70)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    feedback('Ficha exportada. Alterações no mundo só são gravadas ao salvar.');
  }
  function print(sheet) {
    document.querySelector('.sheet-print')?.remove();
    const page=document.createElement('article');page.className='sheet-print';
    page.innerHTML=`<h1>${esc(context.npc.nome)}</h1><p>${esc(context.worldName)} · ${esc(context.location)} · ${esc(sheet.sistema)}</p><div class="sheet-print-grid">${[...identity,...numbers].map(([key,label])=>`<p><b>${label}</b><br>${esc(sheet[key])||'—'}</p>`).join('')}</div><h2>Atributos</h2><div class="sheet-print-grid">${sheet.atributos.map(a=>`<p><b>${esc(a.nome)}</b><br>${a.valor}</p>`).join('')}</div>${narrative.filter(([key])=>sheet[key]).map(([key,label])=>`<section><h2>${label}</h2><p>${esc(sheet[key])}</p></section>`).join('')}`;
    document.body.append(page);document.body.classList.add('has-sheet-print');
    const cleanup=()=>{page.remove();document.body.classList.remove('has-sheet-print');};
    window.addEventListener('afterprint',cleanup,{once:true});
    window.print();
  }
  function open(options) {
    ensureDialog(); if(dialog.open)return;
    context=options;
    const sheet=options.npc.ficha ? JSON.parse(JSON.stringify(options.npc.ficha)) : defaults();
    const input=([key,label,min])=>`<label class="field-label">${label}<input class="text-field" name="${key}" ${min===undefined?'maxlength="120"':`type="number" min="${min}" max="999999" step="1" required`}></label>`;
    dialog.innerHTML=`<form id="character-sheet-form" novalidate><header class="sheet-header"><div><div class="eyebrow">ARQUIVO DE PERSONAGEM</div><h2 id="sheet-title">${esc(options.npc.nome)}</h2><p>${esc(options.npc.papel)} · ${esc(options.location)}</p></div><button type="button" class="sheet-close" data-sheet-action="close" aria-label="Fechar ficha">×</button></header><div class="sheet-tools"><span class="entity-tag">${esc(options.worldName)}</span><div><button class="button button-quiet button-small" type="button" data-sheet-action="import">Importar</button><button class="button button-quiet button-small" type="button" data-sheet-action="export">Exportar JSON</button><button class="button button-quiet button-small" type="button" data-sheet-action="print">Imprimir / PDF</button></div></div><p class="sheet-intro">Uma ficha livre para sua mesa. Ajuste atributos e valores conforme seu sistema; as regras de combate não são calculadas automaticamente.</p><div class="sheet-body"><section class="sheet-section"><h3><span>01</span> Identidade</h3><div class="sheet-grid">${identity.map(input).join('')}</div></section><section class="sheet-section"><h3><span>02</span> Combate e progressão</h3><div class="sheet-grid sheet-combat">${numbers.map(input).join('')}</div></section><section class="sheet-section"><div class="sheet-section-heading"><h3><span>03</span> Atributos</h3><button class="button button-quiet button-small" type="button" data-sheet-action="add-attribute">+ Atributo</button></div><p class="sheet-help">Renomeie, adicione ou remova atributos para adaptar a ficha ao seu sistema.</p><div id="sheet-attributes" class="sheet-attributes"></div></section><section class="sheet-section"><h3><span>04</span> História e recursos</h3>${narrative.map(([key,label])=>`<details class="sheet-notes" ${key==='historia'?'open':''}><summary>${label}</summary><label class="field-label"><span class="sr-only">${label}</span><textarea name="${key}" class="text-field" rows="4" maxlength="6000" placeholder="Escreva aqui…"></textarea></label></details>`).join('')}</section></div><footer class="sheet-footer"><p id="sheet-feedback" role="status" aria-live="polite">${options.npc.ficha?'Ficha carregada.':'Preencha e salve para criar a ficha deste personagem.'}</p><button type="submit" class="button button-primary">Salvar ficha</button></footer><input id="sheet-import" type="file" accept=".json,application/json" hidden></form>`;
    fill(sheet);baseline=JSON.stringify(read());dialog.showModal();
  }
  window.WORLDFORGE_SHEETS=Object.freeze({open});
})();

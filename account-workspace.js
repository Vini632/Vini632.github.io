(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WORLDFORGE_WORKSPACE=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function create({load,save,getOwner,apply,onStatus=()=>{},validate=()=>{},delay=300}){
    let owner=null,epoch=0,revision=0,ready=false,next=null,attempt=null,running=null,timer=null,error=null;
    const clone=value=>JSON.parse(JSON.stringify(value));
    const current=()=>owner&&getOwner()===owner;
    const dirty=()=>Boolean(next||attempt);
    const notify=()=>onStatus({ready,dirty:dirty(),saving:Boolean(running),error,revision,owner});
    const cancelTimer=()=>{if(timer)clearTimeout(timer);timer=null;};
    function reset(){cancelTimer();epoch++;owner=null;ready=false;next=null;attempt=null;error=null;running=null;notify();}
    async function open(id){
      if(!id||getOwner()!==id)throw new Error('Entre na sua conta.');
      if(owner===id&&ready)return;
      reset();owner=id;const generation=epoch;notify();
      try{
        const data=await load();
        if(generation!==epoch||!current())return;
        if(!Number.isSafeInteger(data?.revision)||data.revision<0||!Array.isArray(data.worlds))throw new Error('A conta retornou dados inválidos.');
        validate(data);revision=data.revision;apply(clone(data));ready=true;notify();
      }catch(cause){if(generation===epoch){error=cause;notify();}throw cause;}
    }
    function queue(data){
      if(!ready||!current())return false;
      try{validate(data);next=clone(data);cancelTimer();if(error?.status!==409&&error?.code!=='PT409'){error=null;timer=setTimeout(()=>flush().catch(()=>{}),delay);}notify();return true;}
      catch(cause){error=cause;notify();return false;}
    }
    async function flush(){
      cancelTimer();
      if(running){await running;if(dirty())return flush();return;}
      if(!dirty())return;
      if(!ready||!current())throw new Error('A conta mudou. Entre novamente.');
      if(error?.status===409||error?.code==='PT409')throw error;
      const generation=epoch;error=null;
      const work=(async()=>{
        while((attempt||next)&&generation===epoch&&current()){
          if(!attempt){attempt={data:next,revision,mutationId:crypto.randomUUID()};next=null;}
          const sent=attempt;
          const result=await save(clone(sent.data),sent.revision,sent.mutationId,owner);
          if(generation!==epoch||!current())return;
          if(!Number.isSafeInteger(result?.revision)||result.revision<=revision)throw new Error('O servidor não confirmou o salvamento.');
          revision=result.revision;attempt=null;
        }
      })();
      running=work;notify();
      try{await work;}
      catch(cause){if(generation===epoch){if([400,413,422].includes(cause.status)&&attempt){if(!next)next=attempt.data;attempt=null;}error=cause;notify();}throw cause;}
      finally{if(generation===epoch){running=null;if(!dirty())cancelTimer();notify();}}
    }
    async function reload(){if(dirty())throw new Error('Exporte seu rascunho antes de recarregar a conta.');const id=owner;reset();await open(id);}
    return {open,queue,flush,reload,reset,get state(){return {owner,ready,dirty:dirty(),saving:Boolean(running),error,revision};}};
  }
  return Object.freeze({create});
});

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WORLDFORGE_WORKSPACE=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function create({load,save,getOwner,apply,getRevision,onStatus=()=>{},onRefresh=()=>{},validate=()=>{},delay=300,retryDelay=1500,maxRetryDelay=30000}){
    let owner=null,epoch=0,revision=0,ready=false,next=null,attempt=null,running=null,timer=null,error=null,retries=0,retrying=false,refreshing=null;
    const clone=value=>JSON.parse(JSON.stringify(value));
    const current=()=>owner&&getOwner()===owner;
    const dirty=()=>Boolean(next||attempt);
    const notify=()=>onStatus({ready,dirty:dirty(),saving:Boolean(running),error,retrying,revision,owner});
    const cancelTimer=()=>{if(timer)clearTimeout(timer);timer=null;retrying=false;};
    const transient=cause=>cause instanceof TypeError||['TimeoutError','AbortError'].includes(cause?.name)||cause?.status===408||cause?.status===429||cause?.status>=500;
    function scheduleRetry(){
      if(!dirty()||!ready||!current()||!transient(error))return;
      retrying=true;
      timer=setTimeout(()=>{timer=null;retrying=false;flush().catch(()=>{});},Math.min(maxRetryDelay,retryDelay*2**Math.min(retries++,10)));
      timer.unref?.();notify();
    }
    function reset(){cancelTimer();epoch++;owner=null;ready=false;next=null;attempt=null;error=null;running=null;refreshing=null;retries=0;notify();}
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
          revision=result.revision;attempt=null;retries=0;
        }
      })();
      running=work;notify();
      try{await work;}
      catch(cause){if(generation===epoch){if([400,413,422].includes(cause.status)&&attempt){if(!next)next=attempt.data;attempt=null;}error=cause;notify();}throw cause;}
      finally{if(generation===epoch){running=null;if(!dirty())cancelTimer();else if(error)scheduleRetry();notify();}}
    }
    async function refresh(){
      if(!ready||!current()||dirty()||running||refreshing)return false;
      const generation=epoch,previousRevision=revision;
      const work=(async()=>{
        if(getRevision){
          const latest=await getRevision();
          if(generation!==epoch||!current()||dirty()||revision!==previousRevision||latest<=revision)return false;
          if(!Number.isSafeInteger(latest)||latest<0)throw new Error('A conta retornou uma revisão inválida.');
        }
        const data=await load();
        if(generation!==epoch||!current()||dirty()||revision!==previousRevision)return false;
        if(!Number.isSafeInteger(data?.revision)||data.revision<0||!Array.isArray(data.worlds))throw new Error('A conta retornou dados inválidos.');
        if(data.revision<=revision)return false;
        validate(data);apply(clone(data));revision=data.revision;notify();onRefresh();return true;
      })();
      refreshing=work;
      try{return await work;}finally{if(generation===epoch)refreshing=null;}
    }
    async function reload(){if(dirty())throw new Error('Exporte seu rascunho antes de recarregar a conta.');const id=owner;reset();await open(id);}
    return {open,queue,flush,refresh,reload,reset,get state(){return {owner,ready,dirty:dirty(),saving:Boolean(running),error,retrying,revision};}};
  }
  return Object.freeze({create});
});

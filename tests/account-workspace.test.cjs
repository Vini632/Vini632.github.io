const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../account-workspace.js');
const fs=require('node:fs'),vm=require('node:vm');
const empty=()=>({revision:0,worlds:[],activeId:null,preferences:{}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('saves are serialized and a reload reads the server instead of browser data',async()=>{
  let remote=empty(),owner='account-a',active=0,max=0,calls=[];
  const store=create({getOwner:()=>owner,load:async()=>remote,apply(){},delay:100000,
    save:async(data,revision,id,account)=>{active++;max=Math.max(max,active);assert.equal(account,owner);assert.equal(revision,remote.revision);calls.push(id);await tick();remote={...data,revision:revision+1};active--;return {revision:remote.revision};}});
  await store.open(owner);store.queue({...empty(),preferences:{theme:'light'}});
  const first=store.flush();store.queue({...empty(),preferences:{theme:'dark'}});await first;
  assert.equal(max,1);assert.equal(remote.preferences.theme,'dark');assert.equal(store.state.dirty,false);assert.equal(calls.length,2);
  let loaded;const other=create({getOwner:()=>owner,load:async()=>remote,save(){},apply:data=>loaded=data});
  await other.open(owner);assert.equal(loaded.preferences.theme,'dark');
});

test('an ambiguous network failure retries the same mutation and preserves the draft',async()=>{
  let ids=[],fail=true;
  const store=create({getOwner:()=> 'a',load:async()=>empty(),apply(){},delay:100000,save:async(data,revision,id)=>{ids.push(id);if(fail){fail=false;throw new TypeError('network');}return {revision:1};}});
  await store.open('a');store.queue({...empty(),preferences:{profileName:'Explorador'}});
  await assert.rejects(store.flush());assert.equal(store.state.dirty,true);
  await store.flush();assert.equal(ids[0],ids[1]);assert.equal(store.state.dirty,false);
});

test('a conflict cannot silently overwrite another device',async()=>{
  let calls=0;
  const store=create({getOwner:()=> 'a',load:async()=>empty(),apply(){},delay:100000,save:async()=>{calls++;throw Object.assign(new Error('conflict'),{status:409});}});
  await store.open('a');store.queue(empty());await assert.rejects(store.flush());await assert.rejects(store.flush());
  assert.equal(calls,1);assert.equal(store.state.dirty,true);await assert.rejects(store.reload());store.reset();
});

test('late account responses cannot replace another account or flush its data',async()=>{
  let owner='a',resolveLoad,applied=[];
  const store=create({getOwner:()=>owner,load:()=>new Promise(resolve=>resolveLoad=resolve),save(){},apply:data=>applied.push(data),delay:100000});
  const loading=store.open('a');owner='b';store.reset();resolveLoad(empty());await loading;
  assert.equal(applied.length,0);assert.equal(store.queue(empty()),false);
});

test('changes made while loading do not mutate the server and validation failures stay visible',async()=>{
  const store=create({getOwner:()=> 'a',load:async()=>empty(),apply(){},save(){},validate:data=>{if(data.preferences.bad)throw new Error('bad data');},delay:100000});
  assert.equal(store.queue(empty()),false);await store.open('a');assert.equal(store.queue({...empty(),preferences:{bad:true}}),false);assert.equal(store.state.error.message,'bad data');
});

test('a failed load for the previous account cannot close the next account workspace',async()=>{
  const source=fs.readFileSync('app.js','utf8');
  const enter=source.slice(source.indexOf('  async function enterWorkspace('),source.indexOf('  function goBotPanel('));
  let fail,started,closed=0;
  const began=new Promise(resolve=>started=resolve);
  const context={cloudSession:{user:{id:'a'}},window:{WORLDFORGE_AUTH:{mfa:async()=>({user:{id:'a'}})}},
    saveCloudSession(){},setLandingFeedback(){},showLanding(){closed++;},
    accountWorkspace:{open(){started();return new Promise((_,reject)=>fail=reject);},state:{ready:true}}};
  vm.createContext(context);vm.runInContext(enter,context);
  const pending=context.enterWorkspace();await began;
  context.cloudSession={user:{id:'b'}};fail(new Error('old load failed'));await pending;
  assert.equal(closed,0);
});

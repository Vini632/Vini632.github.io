const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const validateWorld=require('../world-validation.js');
const catalog=require('../world-catalog.js');
const source=fs.readFileSync('app.js','utf8');
function context(){
  const sandbox={TextEncoder,validateWorld,isWorldData:()=>true,createLibraryId:()=> 'new-copy',normalizeWorld:data=>data,
    pendingLibraryBackup:null,$:()=>({showModal(){},close(){}})};
  vm.createContext(sandbox);
  const validate=source.slice(source.indexOf('  function validateAccountData('),source.indexOf('  function applyAccountData('));
  const importer=source.split('\n').find(line=>line.includes('function importLibraryData('));
  const restore=source.slice(source.indexOf('  function applyLibraryBackup('),source.indexOf('  async function readImportFile('));
  Object.assign(sandbox,{library:{worlds:[],activeId:null},activeWorldId:null,world:null,prefs:{profileName:'Before'},defaultPrefs:{theme:'dark',widgets:{}},
    persistLibrary:()=>true,renderAll(){},setView(){},toast(){},accountPayload:()=>({worlds:sandbox.library.worlds,activeId:sandbox.activeWorldId,preferences:sandbox.prefs}),
    applyAccountData:data=>{sandbox.library={worlds:data.worlds};sandbox.activeWorldId=data.activeId;sandbox.prefs=data.preferences;}});
  vm.runInContext(validate+importer+restore,sandbox);return sandbox;
}
test('account draft backups preserve the profile and selected world for explicit import',()=>{
  const ctx=context(),world=JSON.parse(JSON.stringify(catalog[0].world));
  ctx.importLibraryData({format:'worldforge-account-backup',version:1,activeId:'world-a',worlds:[{id:'world-a',data:world}],preferences:{profileName:'Nunes',theme:'light'}});
  assert.equal(ctx.pendingLibraryBackup.activeWorldId,'world-a');assert.equal(ctx.pendingLibraryBackup.accountPreferences.profileName,'Nunes');
  assert.equal(ctx.applyLibraryBackup('replace'),true);assert.equal(ctx.prefs.profileName,'Nunes');assert.equal(ctx.activeWorldId,'world-a');
});
test('profile-only backups work while malformed preferences cannot reach the save queue',()=>{
  const ctx=context();
  ctx.importLibraryData({format:'worldforge-account-backup',version:1,activeId:null,worlds:[],preferences:{profileName:'Nunes'}});
  assert.equal(ctx.pendingLibraryBackup.worlds.length,0);
  assert.equal(ctx.applyLibraryBackup('replace'),true);assert.equal(ctx.prefs.profileName,'Nunes');assert.equal(ctx.activeWorldId,null);
  for(const preferences of [{profileName:22},{adminKey:'not-allowed'},{sound:'yes'}]){
    assert.throws(()=>ctx.importLibraryData({format:'worldforge-account-backup',version:1,activeId:null,worlds:[],preferences}));
  }
});
test('a rejected backup save restores worlds, selection and profile together',()=>{
  const ctx=context();ctx.persistLibrary=()=>false;
  ctx.importLibraryData({format:'worldforge-account-backup',version:1,activeId:null,worlds:[],preferences:{profileName:'After'}});
  assert.equal(ctx.applyLibraryBackup('replace'),false);assert.equal(ctx.prefs.profileName,'Before');
});
test('legacy profile preferences can migrate even when there were no local worlds',async()=>{
  const ctx=context();let saved;
  Object.assign(ctx,{legacyLibrary:{worlds:[]},legacyPrefs:{profileName:'Recuperado'},legacyImported:false,
    prefs:{profileName:'Explorador',widgets:{}},defaultPrefs:{profileName:'Explorador',widgets:{}},
    accountWorkspace:{flush:async()=>{}},persistLibrary:()=>{saved=ctx.accountPayload();return true;}});
  const migration=source.slice(source.indexOf('  async function migrateLegacyData('),source.indexOf("  const RECOVERY_SESSION_KEY="));
  vm.runInContext(migration,ctx);await ctx.migrateLegacyData();
  assert.equal(saved.preferences.profileName,'Recuperado');assert.equal(saved.worlds.length,0);assert.equal(ctx.legacyImported,true);
});

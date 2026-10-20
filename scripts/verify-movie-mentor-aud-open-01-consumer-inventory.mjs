// AUD-OPEN-01 verifier-only exact-head source consumer inventory.
// Run from repository root after checkout; no production mutation or network access.
import {readdir,readFile} from "node:fs/promises";
import {join,relative} from "node:path";
import assert from "node:assert/strict";
const root=process.cwd();
const needle="recoverMovieMentorCompletedChargebacks";
const skip=new Set([".git","node_modules",".next","dist","build","coverage"]);
const files=[],failures=[],matches=[];
async function walk(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(entry.isSymbolicLink())continue;
  if(entry.isDirectory()){if(!skip.has(entry.name))await walk(join(dir,entry.name));continue;}
  if(!entry.isFile()||!/[.]([cm]?js)$/.test(entry.name))continue;
  files.push(join(dir,entry.name));
 }
}
await walk(root);
files.sort();
for(const path of files){
 const name=relative(root,path).replaceAll("\\","/");
 try{
  const source=await readFile(path,"utf8");
  const hits=[...source.matchAll(/recoverMovieMentorCompletedChargebacks/g)];
  if(hits.length)matches.push({path:name,occurrences:hits.length,lines:hits.map(m=>source.slice(0,m.index).split("\n").length)});
 }catch(error){failures.push({path:name,error:String(error)});}
}
console.log("AUD-OPEN-01 EXACT-HEAD CONSUMER INVENTORY",JSON.stringify({filesEnumerated:files.length,filesRead:files.length-failures.length,failures,matches},null,2));
assert.equal(failures.length,0,"All enumerated JavaScript source files must be readable");
assert(matches.some(m=>m.path==="ai/MovieMentorCompletedChargebackRecovery.js"),"Recovery definition must be present");
assert(matches.some(m=>m.path==="ai/MovieMentorProductionCommercialHttpIngress.js"),"Startup consumer must be present");
assert(matches.some(m=>m.path==="ai/MovieMentorCommercialProviderIngressAuthority.js"),"Ingress consumer must be present");
console.log("AUD-OPEN-01 SOURCE INVENTORY COMPLETE; match classification and financial implications require independent review.");

const startup=await readFile(join(root,"ai/MovieMentorProductionCommercialHttpIngress.js"),"utf8");
const ingress=await readFile(join(root,"ai/MovieMentorCommercialProviderIngressAuthority.js"),"utf8");
const recovery=await readFile(join(root,"ai/MovieMentorCompletedChargebackRecovery.js"),"utf8");
assert.match(startup,/await recoverMovieMentorCompletedChargebacks\\s*\\(/,"Startup recovery invocation must remain visible");
assert.match(ingress,/setTimeout\\(retry,/,"Ingress error retry timer must remain visible");
assert.match(ingress,/await recoverMovieMentorCompletedChargebacks\\s*\\(/,"Ingress retry recovery invocation must remain visible");
assert.match(recovery,/async function recoverMovieMentorCompletedChargebacks\\s*\\(/,"Recovery definition must remain visible");
const provenance=Object.freeze({
 startup:{path:"ai/MovieMentorProductionCommercialHttpIngress.js",kind:"mount-time-invocation"},
 ingress:{path:"ai/MovieMentorCommercialProviderIngressAuthority.js",kind:"error-contingent-retry"},
 recovery:{path:"ai/MovieMentorCompletedChargebackRecovery.js",kind:"callable-operation-not-scheduler"},
 independentScheduler:{proven:false,reason:"source classification alone cannot certify deployment or external scheduler absence"},
 scope:"verifier-only source inventory; no runtime trigger or autonomous settlement verdict"
});
console.log("AUD-OPEN-01 TRIGGER PROVENANCE CLASSIFICATION",JSON.stringify(provenance));

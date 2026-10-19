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

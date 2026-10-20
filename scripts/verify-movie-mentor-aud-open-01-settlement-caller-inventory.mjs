// AUD-OPEN-01 verifier-only inventory of settlement-authority callers.
// Enumerates repository JavaScript sources; does not certify dynamic callers or external consumers.
import assert from "node:assert/strict";
import {readdir,readFile} from "node:fs/promises";
import {join,relative} from "node:path";
const root=process.cwd();
const skip=new Set([".git","node_modules",".next","dist","build","coverage"]);
const files=[],failures=[],matches=[];
async function walk(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(entry.isSymbolicLink())continue;
  if(entry.isDirectory()){if(!skip.has(entry.name))await walk(join(dir,entry.name));continue;}
  if(entry.isFile()&&/[.]([cm]?js)$/.test(entry.name))files.push(join(dir,entry.name));
 }
}
await walk(root);files.sort();
for(const path of files){
 const name=relative(root,path).replaceAll("\\","/");
 try{
  const source=await readFile(path,"utf8");
  const hits=[...source.matchAll(/\bterminallySettlePreservedValue\b/g)];
  if(!hits.length)continue;
  const lines=source.split("\n");
  matches.push({path:name,occurrences:hits.length,sites:hits.map(h=>{
   const line=source.slice(0,h.index).split("\n").length;
   const excerpt=lines.slice(Math.max(0,line-2),Math.min(lines.length,line+3)).join(" ").slice(0,700);
   return {line,excerpt,classification:name==="ai/MovieMentorProductionCommercialValueDispositionComposition.js"?"authority-definition-or-recursion":name.startsWith("scripts/")?"test-or-verifier":"production-consumer-requires-review"};
  })});
 }catch(error){failures.push({path:name,error:String(error)});}
}
console.log("AUD-OPEN-01 SETTLEMENT CALLER INVENTORY",JSON.stringify({filesEnumerated:files.length,filesRead:files.length-failures.length,failures,matches},null,2));
assert.equal(failures.length,0,"all enumerated JavaScript source files must be readable");
assert(matches.some(m=>m.path==="ai/MovieMentorProductionCommercialValueDispositionComposition.js"),"production authority definition required");
assert(matches.some(m=>m.path==="ai/MovieMentorCompletedChargebackRecovery.js"),"chargeback recovery caller required");
console.log("SETTLEMENT CALLER INVENTORY GREEN: exact source references enumerated; manual classification, dynamic calls, external callers and return-shape compatibility remain unproven");

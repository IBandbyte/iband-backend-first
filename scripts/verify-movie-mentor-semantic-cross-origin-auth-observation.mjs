import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { interpretMovieMentorSemantics } from "../ai/MovieMentorSemanticInterpreter.js";
const names=["IBAND_AI_PROVIDER","IBAND_AI_BASE_URL","IBAND_AI_API_KEY","IBAND_AI_TIMEOUT_MS"];
const old=Object.fromEntries(names.map(k=>[k,process.env[k]]));
let observed=null;
const target=createServer(async(req,res)=>{let body="";for await(const part of req)body+=part;observed={authorization:req.headers.authorization??null,body,method:req.method};res.writeHead(422,{"Content-Type":"application/json"});res.end('{"error":{"message":"local rejection"}}')});
const source=createServer((req,res)=>{res.writeHead(307,{Location:`http://127.0.0.1:${target.address().port}/other-origin`});res.end()});
try{
target.listen(0,"127.0.0.1");await once(target,"listening");source.listen(0,"127.0.0.1");await once(source,"listening");
process.env.IBAND_AI_PROVIDER="generic-http";process.env.IBAND_AI_BASE_URL=`http://127.0.0.1:${source.address().port}/provider`;process.env.IBAND_AI_API_KEY="warp85-disposable-token";process.env.IBAND_AI_TIMEOUT_MS="3000";
await assert.rejects(()=>interpretMovieMentorSemantics({message:"Fictional scene."}),error=>error?.code==="SEMANTIC_PROVIDER_REDIRECT_FORBIDDEN","semantic redirect must fail closed");
assert.equal(observed,null,"redirected destination must receive neither POST body nor Authorization");
console.log("WARP85 SECURITY GREEN: cross-origin redirect forbidden before any body or Authorization reached the destination.");
}finally{for(const k of names)old[k]===undefined?delete process.env[k]:process.env[k]=old[k];await Promise.all([source,target].map(s=>new Promise(resolve=>s.close(resolve))))}

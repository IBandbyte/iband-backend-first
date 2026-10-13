import assert from "node:assert/strict";
import { executeStructuredAI } from "../ai/StructuredAIProviderClient.js";
const names=["IBAND_AI_PROVIDER","IBAND_AI_BASE_URL","IBAND_AI_API_KEY","IBAND_AI_MODEL","IBAND_AI_TIMEOUT_MS"];const old=Object.fromEntries(names.map(k=>[k,process.env[k]]));const originalFetch=globalThis.fetch;let calls=0,redirectSetting=null;
try{
process.env.IBAND_AI_PROVIDER="generic-http";process.env.IBAND_AI_BASE_URL="https://example.invalid/warp87";process.env.IBAND_AI_API_KEY="warp87-disposable";process.env.IBAND_AI_TIMEOUT_MS="3000";
globalThis.fetch=async(url,options)=>{calls++;redirectSetting=options.redirect;return new Response("",{status:307,headers:{Location:"https://another.example.invalid/redirected"}})};
await assert.rejects(()=>executeStructuredAI({task:"warp87-redirect-test",systemInstructions:"Return a structured result.",input:{scene:"fictional"},schema:{type:"object",properties:{ok:{type:"boolean"}},required:["ok"],additionalProperties:false},schemaName:"warp87_redirect"}),error=>error?.code==="AI_PROVIDER_REDIRECT_FORBIDDEN");
assert.equal(calls,1,"structured client must not follow the redirect");assert.equal(redirectSetting,"manual");
console.log("WARP87 GREEN: structured AI rejects 307 without redirect follow-up; isolated mock only.");
}finally{globalThis.fetch=originalFetch;for(const k of names)old[k]===undefined?delete process.env[k]:process.env[k]=old[k]}

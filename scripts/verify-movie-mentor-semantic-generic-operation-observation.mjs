import assert from "node:assert/strict";
import { interpretMovieMentorSemantics } from "../ai/MovieMentorSemanticInterpreter.js";
const names=["IBAND_AI_PROVIDER","IBAND_AI_BASE_URL","IBAND_AI_API_KEY","IBAND_AI_TIMEOUT_MS"];const old=Object.fromEntries(names.map(k=>[k,process.env[k]]));const originalFetch=globalThis.fetch;let captured=null;
try{
process.env.IBAND_AI_PROVIDER="generic-http";process.env.IBAND_AI_BASE_URL="https://example.invalid/warp86";process.env.IBAND_AI_API_KEY="warp86-disposable";process.env.IBAND_AI_TIMEOUT_MS="3000";
globalThis.fetch=async(url,options)=>{captured={url,options};return new Response('{"error":{"message":"intentional mocked rejection"}}',{status:422,headers:{"Content-Type":"application/json"}})};
await assert.rejects(()=>interpretMovieMentorSemantics({message:"Fictional scene."},{providerOperation:{providerOperationId:"warp86-operation",executionId:"warp86-execution",slotId:"warp86-slot",task:"movie-mentor-semantic"}}));
assert.ok(captured,"semantic provider transport must be invoked");
const body=JSON.parse(captured.options.body);
assert.equal(body.task,"movie-mentor-semantic-interpretation");
assert.equal(captured.options.headers["Idempotency-Key"],undefined);
assert.equal(body.providerOperationId,undefined);
assert.equal(body.providerOperation,undefined);
console.log("WARP86 OBSERVATION GREEN: generic semantic transport omits durable operation identity; no duplicate-dispatch verdict.");
}finally{globalThis.fetch=originalFetch;for(const k of names)old[k]===undefined?delete process.env[k]:process.env[k]=old[k]}

import assert from "node:assert/strict";
import {assertMovieMentorCreatorGatewayAtomicMountReadiness} from "../ai/MovieMentorCreatorGatewayAtomicMountGate.js";

// RED-first. Pure gate tests: no server import, HTTP listener, Mongo connection or writes.
let mounted=0;
const mount=()=>{mounted++};
for(const readiness of [undefined,null,{},()=>null,async()=>null,async()=>({})]){
 await assert.rejects(()=>assertMovieMentorCreatorGatewayAtomicMountReadiness({atomicCreatorStateReadiness:readiness}),e=>e?.code==="MOVIE_MENTOR_CREATOR_GATEWAY_ATOMIC_MOUNT_NOT_READY");
 assert.equal(mounted,0);
}
const adapter=async()=>({kind:"accepted"});
const proven=await assertMovieMentorCreatorGatewayAtomicMountReadiness({atomicCreatorStateReadiness:async()=>adapter});
assert.equal(proven.atomicAcceptCreatorStateOperation,adapter);
assert.equal(Object.isFrozen(proven),true);
assert.equal(mounted,0);
mount();
assert.equal(mounted,1);
console.log("GREEN: creator gateway atomic readiness gate rejects missing/unusable adapters before any mount.");

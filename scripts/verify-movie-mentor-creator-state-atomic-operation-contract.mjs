import assert from "node:assert/strict";
import {acceptCreatorStateOperation} from "../ai/MovieMentorCreatorStateOperationLedger.js";

// Isolated atomic adapter contract. No MongoDB or production network.
const records=new Map();let writes=0;
const owner=async({principalId,projectId})=>({authorized:true,principalId,projectId});
const atomicAccept=async({envelope,proposedState})=>{
 const entry=records.get(envelope.projectId)||{revision:0,operations:new Map()};
 const prior=entry.operations.get(envelope.operationId);
 if(prior)return prior.digest===envelope.requestDigest?{kind:"replay",result:prior.result}:{kind:"conflict"};
 if(entry.revision!==envelope.expectedRevision)return{kind:"revision-conflict"};
 const result={projectId:envelope.projectId,revision:entry.revision+1,state:proposedState};
 entry.revision=result.revision;entry.operations.set(envelope.operationId,{digest:envelope.requestDigest,result});records.set(envelope.projectId,entry);writes++;
 return{kind:"accepted",result};
};
const operation={principalId:"owner",projectId:"project",operationId:"operation-1",source:"creator-memory",expectedRevision:0,state:{memoryContext:{hello:"world"}}};
const args={operation,proposedState:operation.state,assertCurrentOwnership:owner,atomicAccept};
const first=await acceptCreatorStateOperation(args);
assert.equal(first.kind,"accepted");assert.equal(first.result.revision,1);
const retry=await acceptCreatorStateOperation(args);
assert.equal(retry.kind,"replay");assert.deepEqual(retry.result,first.result);assert.equal(writes,1);
await assert.rejects(()=>acceptCreatorStateOperation({...args,operation:{...operation,state:{memoryContext:{hello:"changed"}}}}),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_OPERATION_ID_CONFLICT");
await assert.rejects(()=>acceptCreatorStateOperation({...args,operation:{...operation,operationId:"operation-2"}}),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT");
await assert.rejects(()=>acceptCreatorStateOperation({...args,assertCurrentOwnership:async()=>({authorized:false})}),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_OWNER_REQUIRED");
assert.equal(writes,1);
console.log("GREEN: atomic adapter contract accepts once, returns replay result, rejects conflict/stale revision/revoked owner without extra write.");
console.log("LIMITATION: in-memory atomic adapter, not MongoDB concurrency or durable restart certification.");

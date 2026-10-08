import assert from "node:assert/strict";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

// Audit-only issuer-boundary court: real production lease authority with an isolated mock store.
// This does NOT establish atomic creator-state commit or production MongoDB integration.
const record={schema:6,executionId:"execution-proof-court",creatorTurnId:"turn-proof-court",principalId:"principal-proof-court",projectId:"project-proof-court",reservationId:"reservation-proof-court",requestDigest:"digest-proof-court",phase:"active",ownerId:"A",leaseGeneration:1,leaseReference:"ref-A",fencingToken:"token-A",leaseExpiresAt:new Date(Date.now()+60000).toISOString(),maxProviderCalls:5,providerCallsClaimed:0};
let durable={...record};
const store={readExecution:async()=>({...durable}),readExecutionByCreatorTurn:async()=>({...durable}),createExecution:async()=>null,replaceExecution:async()=>null,claimProviderCall:async()=>null};
const authority=createMovieMentorInferenceExecutionLeaseAuthority({store});
const issued=await authority.findExecutionByCreatorTurn({creatorTurnId:record.creatorTurnId,principalId:record.principalId,projectId:record.projectId,requestDigest:record.requestDigest});
assert.equal(issued.authorized,true);
const genuine=await authority.assertFence(issued);
assert.equal(genuine.authorized,true);
const copied=await authority.assertFence({...issued});
assert.deepEqual({authorized:copied.authorized,reason:copied.reason},{authorized:false,reason:"execution-owner-proof-required"});
const forged=await authority.assertFence({...issued,ownerId:"B",leaseGeneration:2,fencingToken:"token-B"});
assert.equal(forged.authorized,false);
assert.equal(forged.reason,"execution-owner-proof-required");
durable={...durable,ownerId:"B",leaseGeneration:2,leaseReference:"ref-B",fencingToken:"token-B"};
const stale=await authority.assertFence(issued);
assert.equal(stale.authorized,false);
assert.equal(stale.reason,"execution-lease-fenced");
const stalePreviouslyRefreshed=await authority.assertFence(genuine);
assert.equal(stalePreviouslyRefreshed.authorized,false);
assert.equal(stalePreviouslyRefreshed.reason,"execution-lease-fenced");
console.log(JSON.stringify({court:"production-lease-evidence-issuer-boundary",issued:true,genuine:"accepted",copied:copied.reason,forged:forged.reason,stale:stale.reason,stalePreviouslyRefreshed:stalePreviouslyRefreshed.reason,classification:"real lease authority with mock durable store; NOT atomic production commit or real MongoDB"}));
console.log("PASS: genuine issued evidence required; copied and forged proofs rejected; takeover fences old evidence");

import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorInferenceExecutionClosureAuthority,MOVIE_MENTOR_INFERENCE_EXECUTION_CLOSURE_POLICY_VERSION as CURRENT_POLICY} from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
async function attempt(policy){
 const record={schema:6,phase:"closed",executionId:"execution-policy",creatorTurnId:"turn-policy",principalId:"creator-policy",projectId:"project-policy",reservationId:"reservation-policy",requestDigest:"request-policy",ownerId:"owner-policy",leaseGeneration:1,leaseReference:"lease-policy",fencingToken:"fence-policy",providerCalls:[],providerCallsClaimed:0,providerEffectRealityRevision:0,frozenProviderCallCount:0,frozenProviderCallSetDigest:digest([]),closureReference:"closure-policy",closurePolicyVersion:policy,closureCertificateDigest:""};
 const certificate={executionId:record.executionId,creatorTurnId:record.creatorTurnId,principalId:record.principalId,projectId:record.projectId,reservationId:record.reservationId,requestDigest:record.requestDigest,closureReference:record.closureReference,frozenProviderCallSetDigest:record.frozenProviderCallSetDigest,closurePolicyVersion:record.closurePolicyVersion,realities:[]};
 record.closureCertificateDigest=digest(certificate);
 let quarantineCalls=0;
 const store={readExecution:async()=>structuredClone(record),beginClosing:async()=>null,recoverExpiredIntoClosing:async()=>null,completeClosing:async()=>null,quarantineExecution:async()=>{quarantineCalls++;return {...record,phase:"quarantined",quarantineReason:"closure-policy-stale",quarantinedFromPhase:"closed"};}};
 const authority=createMovieMentorInferenceExecutionClosureAuthority({store,effectStore:{readEffect:async()=>null}});
 return {result:await authority.assertCurrentClosure({executionId:record.executionId,closureReference:record.closureReference,closureCertificateDigest:record.closureCertificateDigest}),quarantineCalls};
}
const stale=await attempt("superseded-policy");
assert.equal(stale.result.authorized,false,"current closure authority must not be re-minted from a superseded closure policy");
const current=await attempt(CURRENT_POLICY);
assert.equal(current.result.authorized,true,"current closure policy remains eligible for current authority");
console.log("GREEN: current closure authority is bound to current closure policy.");
console.log("LAW: CURRENT SCHEMA IS NECESSARY, NOT SUFFICIENT. SUPERSEDED CLOSURE POLICY MAY REMAIN HISTORY BUT MAY NOT RE-MINT CURRENT AUTHORITY.");

import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createMovieMentorInferenceExecutionClosureAuthority} from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";
const authoritySource=readFileSync(new URL("../ai/MovieMentorInferenceExecutionClosureAuthority.js",import.meta.url),"utf8");
const storeSource=readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
assert.match(authoritySource,/requireDurablyExpired\s*:\s*true/,"expired recovery must delegate expiry authority to durable storage");
assert.match(storeSource,/recoverExpiredIntoClosing[\s\S]*?\$\$NOW/,"expired recovery store must compare lease expiry against durable database time");
const realNow=Date.parse("2030-01-01T00:00:00.000Z"),ahead=new Date(realNow+120000);
let durable={schema:6,executionId:"execution-1",creatorTurnId:"turn-1",principalId:"p",projectId:"pr",reservationId:"r",requestDigest:"d",phase:"active",ownerId:"worker-A",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",leaseAcquiredAt:new Date(realNow-1000).toISOString(),leaseExpiresAt:new Date(realNow+60000).toISOString(),maxProviderCalls:5,providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:0,resultCandidateBarrierRevision:0};
const store={
 readExecution:async()=>structuredClone(durable),
 beginClosing:async()=>structuredClone(durable),
 recoverExpiredIntoClosing:async input=>{assert.equal(input.requireDurablyExpired,true);if(Date.parse(durable.leaseExpiresAt)>realNow)return structuredClone(durable);throw new Error("not exercised");},
 completeClosing:async()=>null,quarantineExecution:async()=>null
};
const authority=createMovieMentorInferenceExecutionClosureAuthority({store,effectStore:{readEffect:async()=>null},now:()=>new Date(ahead),randomId:()=>"court"});
const result=await authority.recoverExpiredIntoClosing({executionId:"execution-1"});
assert.equal(result.authorized,false,"ahead process clock must not move a still-live durable execution into CLOSING");
assert.equal(durable.phase,"active");
console.log("LAW: PROCESS-LOCAL CLOCK SKEW MAY NOT DECIDE DURABLE EXPIRED-EXECUTION CLOSURE RECOVERY.");
console.log("expired execution closure cross-clock authority: GREEN");

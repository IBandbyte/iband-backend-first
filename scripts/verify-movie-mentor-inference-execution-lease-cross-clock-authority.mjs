import assert from "node:assert/strict";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
const clone=v=>v?structuredClone(v):null;
let durable=null,id=0;
const realNow=Date.parse("2030-01-01T00:00:00.000Z");
const store={
 async readExecution(id){return durable?.executionId===id?clone(durable):null;},
 async readExecutionByCreatorTurn({creatorTurnId,principalId,projectId}={}){return durable&&durable.creatorTurnId===creatorTurnId&&durable.principalId===principalId&&durable.projectId===projectId?clone(durable):null;},
 async createExecution(next){if(durable)return null;durable={domain:"iband.movie-mentor.inference-execution-store",schema:6,...clone(next)};return clone(durable);},
 async replaceExecution(next,expected={}){if(!durable||durable.phase!==expected.expectedPhase||durable.leaseGeneration!==expected.expectedLeaseGeneration||durable.leaseReference!==expected.expectedLeaseReference)return null;if(expected.expectedLeaseExpiresAt&&durable.leaseExpiresAt!==expected.expectedLeaseExpiresAt)return null;if(next.leaseGeneration===durable.leaseGeneration+1&&Date.parse(durable.leaseExpiresAt)>realNow)return null;durable=clone(next);return clone(durable);},
 async claimProviderCall(){throw new Error("not exercised");}
};
let clockA=realNow,clockB=realNow+120000;
const A=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(clockA),leaseMs:60000,randomId:()=>`id-${++id}`});
const B=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(clockB),leaseMs:60000,randomId:()=>`id-${++id}`});
const opened=await A.openExecution({creatorTurnId:"turn-1",principalId:"p",projectId:"pr",reservationId:"r",requestDigest:"d",ownerId:"worker-A"});
assert.equal(opened.authorized,true);
const takeover=await B.acquireExecution({executionId:opened.executionId,ownerId:"worker-B"});
assert.equal(takeover.authorized,false,"ahead process clock must not mint successor execution lease while durable lease is still live");
assert.equal(durable.ownerId,"worker-A");assert.equal(durable.leaseGeneration,1);
console.log("LAW: PROCESS-LOCAL CLOCK SKEW MAY NOT DECIDE DURABLE INFERENCE EXECUTION LEASE TAKEOVER.");
console.log("inference execution lease cross-clock authority: GREEN");

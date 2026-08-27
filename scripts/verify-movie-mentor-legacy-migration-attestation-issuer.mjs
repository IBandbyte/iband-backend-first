import assert from "node:assert/strict";
import {createMovieMentorLegacyMigrationAttestationIssuer} from "../ai/MovieMentorLegacyMigrationAttestationIssuer.js";
const principal={authenticated:true,principalId:"owner"}; const project={id:"legacy-A",identity:{domain:"iband.movie-mentor.project",schema:0,issuance:"legacy-preserved"}};
const consumption={challengeId:"challenge-A",consumptionId:"consume-A",principalId:"owner",projectId:"legacy-A",projectIdentity:project.identity,status:"consumed"};
const issuances=new Map();let ids=0,ackLoss=false;
const deps={now:()=>Date.parse("2026-08-27T22:30:00Z"),randomId:()=>`adoption-${++ids}`,readConsumption:async({consumptionId})=>consumptionId==="consume-A"?structuredClone(consumption):null,readIssuanceByConsumptionId:async({consumptionId})=>issuances.get(consumptionId)||null,createIssuance:async record=>{if(issuances.has(record.consumptionId))return{created:false};issuances.set(record.consumptionId,structuredClone(record));if(ackLoss)throw new Error("ACK LOST");return{created:true};}};
const issuer=createMovieMentorLegacyMigrationAttestationIssuer(deps);
const first=await issuer.issue({consumptionId:"consume-A",principal,project});assert.equal(first.status,"issued");const adoptionId=first.attestation.adoptionId;
const retry=await issuer.issue({consumptionId:"consume-A",principal,project});assert.equal(retry.status,"already-issued");assert.equal(retry.attestation.adoptionId,adoptionId);assert.equal(ids,1);
await assert.rejects(()=>issuer.issue({consumptionId:"missing",principal,project}),e=>e.code==="MOVIE_MENTOR_LEGACY_ATTESTATION_CONSUMPTION_NOT_PROVEN");
await assert.rejects(()=>issuer.issue({consumptionId:"consume-A",principal:{authenticated:true,principalId:"attacker"},project}),e=>e.code==="MOVIE_MENTOR_LEGACY_ATTESTATION_CONSUMPTION_CONFLICT");
await assert.rejects(()=>issuer.issue({consumptionId:"consume-A",principal,project:{...project,id:"other"}}),e=>e.code==="MOVIE_MENTOR_LEGACY_ATTESTATION_CONSUMPTION_CONFLICT");
await assert.rejects(()=>issuer.issue({consumptionId:"consume-A",principal,project:{...project,identity:{...project.identity,schema:1}}}),e=>e.code==="MOVIE_MENTOR_LEGACY_ATTESTATION_IDENTITY_CONFLICT");

// Double issuer catastrophe: both observe no issuance, but durable unique consumption coordinate permits one creation.
const raceMap=new Map();let raceIds=0;let barrier=0;let release;const gate=new Promise(r=>release=r);
const raceDeps={...deps,randomId:()=>`race-${++raceIds}`,readIssuanceByConsumptionId:async({consumptionId})=>{if(!raceMap.has(consumptionId)&&barrier<2){barrier++;if(barrier===2)release();await gate;}return raceMap.get(consumptionId)||null;},createIssuance:async record=>{if(raceMap.has(record.consumptionId))return{created:false};raceMap.set(record.consumptionId,structuredClone(record));return{created:true};}};
const A=createMovieMentorLegacyMigrationAttestationIssuer(raceDeps),B=createMovieMentorLegacyMigrationAttestationIssuer(raceDeps);
const [ra,rb]=await Promise.all([A.issue({consumptionId:"consume-A",principal,project}),B.issue({consumptionId:"consume-A",principal,project})]);
assert.equal(raceMap.size,1);assert.equal(ra.attestation.adoptionId,rb.attestation.adoptionId);assert.equal([ra.status,rb.status].filter(x=>x==="issued").length,1);assert.equal([ra.status,rb.status].filter(x=>x==="issued-after-race").length,1);

// ACK loss: durable issuance exists, response vanished; reread returns same adoptionId, never mints replacement.
const ackMap=new Map();let ackIds=0;const ackIssuer=createMovieMentorLegacyMigrationAttestationIssuer({...deps,randomId:()=>`ack-${++ackIds}`,readIssuanceByConsumptionId:async({consumptionId})=>ackMap.get(consumptionId)||null,createIssuance:async record=>{ackMap.set(record.consumptionId,structuredClone(record));throw new Error("ACK LOST");}});
const ack=await ackIssuer.issue({consumptionId:"consume-A",principal,project});assert.equal(ack.status,"issued-after-ack-loss");assert.equal(ackIds,1);assert.equal(ackMap.size,1);
console.log("Movie Mentor legacy migration attestation issuer torture passed: recovery handoff, exactly-once adoption identity, double-issuer race, and ACK-loss reality.");

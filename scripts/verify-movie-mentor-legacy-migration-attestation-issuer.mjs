import assert from "node:assert/strict";
import {createMovieMentorLegacyMigrationAttestationIssuer} from "../ai/MovieMentorLegacyMigrationAttestationIssuer.js";
const principal={authenticated:true,principalId:"owner"}; const project={id:"legacy-A",identity:{domain:"iband.movie-mentor.project",schema:0,issuance:"legacy-preserved"}};
const consumption={challengeId:"challenge-A",consumptionId:"consume-A",principalId:"owner",projectId:"legacy-A",projectIdentity:project.identity,status:"consumed"};
const readConsumption=async({consumptionId})=>consumptionId==="consume-A"?structuredClone(consumption):null;

// Baseline exact issuance and idempotent retry.
const issuances=new Map();let ids=0;
const issuer=createMovieMentorLegacyMigrationAttestationIssuer({now:()=>Date.parse("2026-08-27T22:30:00Z"),randomId:()=>`adoption-${++ids}`,readConsumption,readIssuanceByConsumptionId:async({consumptionId})=>issuances.get(consumptionId)||null,createIssuance:async r=>{if(issuances.has(r.consumptionId))return{created:false,conflict:"consumption-already-issued",record:issuances.get(r.consumptionId)};issuances.set(r.consumptionId,structuredClone(r));return{created:true};}});
const first=await issuer.issue({consumptionId:"consume-A",principal,project});assert.equal(first.status,"issued");const firstId=first.attestation.adoptionId;const retry=await issuer.issue({consumptionId:"consume-A",principal,project});assert.equal(retry.status,"already-issued");assert.equal(retry.attestation.adoptionId,firstId);assert.equal(ids,1);
await assert.rejects(()=>issuer.issue({consumptionId:"missing",principal,project}),e=>e.code==="MOVIE_MENTOR_LEGACY_ATTESTATION_CONSUMPTION_NOT_PROVEN");

// Collision retry law: unrelated adoption-ID collision is the ONLY classified outcome that authorizes a fresh candidate.
const collisionMap=new Map();let collisionIds=0,collisionCreates=0;
const collisionIssuer=createMovieMentorLegacyMigrationAttestationIssuer({randomId:()=>`candidate-${++collisionIds}`,readConsumption,readIssuanceByConsumptionId:async({consumptionId})=>collisionMap.get(consumptionId)||null,createIssuance:async r=>{collisionCreates++;if(collisionCreates===1)return{created:false,conflict:"adoption-id-collision",record:{consumptionId:"somebody-else"}};collisionMap.set(r.consumptionId,structuredClone(r));return{created:true};}});
const collisionResult=await collisionIssuer.issue({consumptionId:"consume-A",principal,project});assert.equal(collisionResult.status,"issued");assert.equal(collisionIds,2);assert.equal(collisionCreates,2);assert.match(collisionResult.attestation.adoptionId,/candidate-2$/);

// Collision then concurrent winner: before remint, reread discovers another issuer won THIS consumption; converge, no second candidate.
let concurrentIds=0,concurrentCreates=0;const winner={...consumption,attestation:{verified:true,adoptionId:"winner-adoption",projectIdentity:project.identity}};
const concurrentIssuer=createMovieMentorLegacyMigrationAttestationIssuer({randomId:()=>`loser-${++concurrentIds}`,readConsumption,readIssuanceByConsumptionId:async()=>concurrentCreates>0?winner:null,createIssuance:async()=>{concurrentCreates++;return{created:false,conflict:"adoption-id-collision",record:{consumptionId:"other"}};}});
const concurrent=await concurrentIssuer.issue({consumptionId:"consume-A",principal,project});assert.equal(concurrent.status,"issued-after-race");assert.equal(concurrent.attestation.adoptionId,"winner-adoption");assert.equal(concurrentIds,1);assert.equal(concurrentCreates,1);

// Crash after create / ACK loss: durable record exists; reconstruct exact winner, never remint.
const ackMap=new Map();let ackIds=0,ackCreates=0;const ackIssuer=createMovieMentorLegacyMigrationAttestationIssuer({randomId:()=>`ack-${++ackIds}`,readConsumption,readIssuanceByConsumptionId:async({consumptionId})=>ackMap.get(consumptionId)||null,createIssuance:async r=>{ackCreates++;ackMap.set(r.consumptionId,structuredClone(r));throw new Error("ACK LOST AFTER COMMIT");}});
const ack=await ackIssuer.issue({consumptionId:"consume-A",principal,project});assert.equal(ack.status,"issued-after-ack-loss");assert.equal(ackIds,1);assert.equal(ackCreates,1);assert.equal(ack.attestation.adoptionId,ackMap.get("consume-A").attestation.adoptionId);

// Unknown failure with NO durable same-consumption reality: original failure escapes and absolutely no remint occurs.
let unknownIds=0,unknownCreates=0;const unknownIssuer=createMovieMentorLegacyMigrationAttestationIssuer({randomId:()=>`unknown-${++unknownIds}`,readConsumption,readIssuanceByConsumptionId:async()=>null,createIssuance:async()=>{unknownCreates++;throw new Error("MONGO NETWORK ABYSS");}});
await assert.rejects(()=>unknownIssuer.issue({consumptionId:"consume-A",principal,project}),/MONGO NETWORK ABYSS/);assert.equal(unknownIds,1);assert.equal(unknownCreates,1);

// Collision exhaustion: bounded candidates; never loops forever and never pretends success.
let exhaustIds=0,exhaustCreates=0;const exhausted=createMovieMentorLegacyMigrationAttestationIssuer({maxAdoptionIdAttempts:4,randomId:()=>`collision-${++exhaustIds}`,readConsumption,readIssuanceByConsumptionId:async()=>null,createIssuance:async()=>{exhaustCreates++;return{created:false,conflict:"adoption-id-collision",record:{consumptionId:"unrelated"}};}});
await assert.rejects(()=>exhausted.issue({consumptionId:"consume-A",principal,project}),e=>e.code==="MOVIE_MENTOR_LEGACY_ATTESTATION_ADOPTION_ID_COLLISION_EXHAUSTED");assert.equal(exhaustIds,4);assert.equal(exhaustCreates,4);

console.log("Movie Mentor legacy migration attestation issuer torture passed: collision retry law, concurrent-winner convergence, crash reconstruction, unknown-failure no-remint, and collision exhaustion.");

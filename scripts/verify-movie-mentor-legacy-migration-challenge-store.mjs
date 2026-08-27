import assert from "node:assert/strict";
import fs from "node:fs/promises";
const source = await fs.readFile(new URL("../ai/MovieMentorLegacyMigrationChallengeStore.js", import.meta.url), "utf8");
assert.match(source,/movie_mentor_legacy_migration_challenges/); assert.match(source,/challengeId: 1 \}, \{ unique: true/); assert.match(source,/consumptionId: 1 \}, \{ unique: true, sparse: true/); assert.match(source,/expiresAt:\{\$gt:at\}/); assert.match(source,/readMovieMentorLegacyMigrationConsumption/); assert.match(source,/reconcileMovieMentorLegacyMigrationConsumption/); assert.match(source,/crashRecovery:"consumptionId"/);

const records=new Map(), consumptionIds=new Map();
function create(c){if(records.has(c.challengeId))throw new Error("duplicate-challenge");records.set(c.challengeId,structuredClone({...c,status:"issued",consumptionId:null}));}
function consume({challengeId,principalId,projectId,consumptionId,at}){const r=records.get(challengeId);if(!r||r.status!=="issued"||r.principalId!==principalId||r.projectId!==projectId||Date.parse(r.expiresAt)<=at||consumptionIds.has(consumptionId))return false;r.status="consumed";r.consumptionId=consumptionId;r.consumedAt=new Date(at).toISOString();consumptionIds.set(consumptionId,r.challengeId);return true;}
function revoke({challengeId,at}){const r=records.get(challengeId);if(!r||r.status!=="issued")return false;r.status="revoked";r.revokedAt=new Date(at).toISOString();return true;}
function recover({consumptionId,challengeId,principalId,projectId}){const id=consumptionIds.get(consumptionId);if(!id)return{reconciled:false,status:"not-found"};const r=records.get(id);if(r.status!=="consumed")return{reconciled:false,status:"not-found"};if((challengeId&&r.challengeId!==challengeId)||(principalId&&r.principalId!==principalId)||(projectId&&r.projectId!==projectId))return{reconciled:false,status:"coordinate-conflict"};return{reconciled:true,status:"consumed-by-this-operation",record:structuredClone(r)};}
const now=Date.parse("2026-08-27T22:00:00Z"); const base={challengeId:"challenge-A",principalId:"owner",projectId:"project-A",nonce:"nonce-A",issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+60000).toISOString()};
create(base);assert.throws(()=>create(base),/duplicate-challenge/);assert.equal(consume({challengeId:"challenge-A",principalId:"owner",projectId:"project-A",consumptionId:"consume-A",at:now+1}),true);assert.equal(consume({challengeId:"challenge-A",principalId:"owner",projectId:"project-A",consumptionId:"consume-B",at:now+2}),false);assert.equal(revoke({challengeId:"challenge-A",at:now+3}),false);
create({...base,challengeId:"challenge-B"});assert.equal(revoke({challengeId:"challenge-B",at:now+1}),true);assert.equal(consume({challengeId:"challenge-B",principalId:"owner",projectId:"project-A",consumptionId:"consume-C",at:now+2}),false);
create({...base,challengeId:"challenge-expired",expiresAt:new Date(now+10).toISOString()});assert.equal(consume({challengeId:"challenge-expired",principalId:"owner",projectId:"project-A",consumptionId:"consume-D",at:now+11}),false);
create({...base,challengeId:"challenge-C"});assert.equal(consume({challengeId:"challenge-C",principalId:"owner",projectId:"project-A",consumptionId:"consume-A",at:now+2}),false);
create({...base,challengeId:"challenge-race"});const outcomes=[()=>consume({challengeId:"challenge-race",principalId:"owner",projectId:"project-A",consumptionId:"race-consume",at:now+5}),()=>revoke({challengeId:"challenge-race",at:now+5})].map(fn=>fn());assert.equal(outcomes.filter(Boolean).length,1);

// 3C.1 crash reality: CAS commits, process dies before response. New process knows only operation identity.
create({...base,challengeId:"challenge-crash",nonce:"crash"});
assert.equal(consume({challengeId:"challenge-crash",principalId:"owner",projectId:"project-A",consumptionId:"crash-operation-77",at:now+7}),true);
// Simulated process death: discard every local result/reference. Recovery starts only from durable consumptionId.
const recovered=recover({consumptionId:"crash-operation-77"});assert.equal(recovered.reconciled,true);assert.equal(recovered.record.challengeId,"challenge-crash");assert.equal(recovered.record.status,"consumed");
// Optional coordinates strengthen reconstruction and must all agree.
assert.equal(recover({consumptionId:"crash-operation-77",challengeId:"challenge-crash",principalId:"owner",projectId:"project-A"}).reconciled,true);
assert.equal(recover({consumptionId:"crash-operation-77",challengeId:"wrong"}).status,"coordinate-conflict");
assert.equal(recover({consumptionId:"crash-operation-77",principalId:"attacker"}).status,"coordinate-conflict");
assert.equal(recover({consumptionId:"crash-operation-77",projectId:"project-B"}).status,"coordinate-conflict");
assert.equal(recover({consumptionId:"never-committed"}).status,"not-found");
// A reconstructed terminal operation cannot reopen or reconsume its challenge.
assert.equal(consume({challengeId:"challenge-crash",principalId:"owner",projectId:"project-A",consumptionId:"second-after-crash",at:now+8}),false);
assert.equal(revoke({challengeId:"challenge-crash",at:now+9}),false);

console.log("Movie Mentor durable challenge store verification passed, including terminal CAS crash recovery by globally unique consumption identity.");

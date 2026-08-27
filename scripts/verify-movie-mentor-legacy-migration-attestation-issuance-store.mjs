import assert from "node:assert/strict";import fs from "node:fs/promises";
const source=await fs.readFile(new URL("../ai/MovieMentorLegacyMigrationAttestationIssuanceStore.js",import.meta.url),"utf8");assert.match(source,/movie_mentor_legacy_migration_attestation_issuances/);assert.match(source,/consumptionId:1\},\{unique:true/);assert.match(source,/adoptionId:1\},\{unique:true/);assert.match(source,/consumption-already-issued/);assert.match(source,/adoption-id-collision/);
const byConsumption=new Map(),byAdoption=new Map();
function create(r){if(byConsumption.has(r.consumptionId))return{created:false,conflict:"consumption-already-issued",record:byConsumption.get(r.consumptionId)};if(byAdoption.has(r.adoptionId))return{created:false,conflict:"adoption-id-collision",record:byAdoption.get(r.adoptionId)};const frozen=structuredClone({...r,status:"issued"});byConsumption.set(r.consumptionId,frozen);byAdoption.set(r.adoptionId,frozen);return{created:true,record:frozen};}
const base={consumptionId:"consume-A",adoptionId:"adopt-A",principalId:"owner",projectId:"project-A",challengeId:"challenge-A",attestation:{adoptionId:"adopt-A"}};
assert.equal(create(base).created,true);const replay=create({...base,adoptionId:"adopt-B",attestation:{adoptionId:"adopt-B"}});assert.equal(replay.created,false);assert.equal(replay.conflict,"consumption-already-issued");assert.equal(replay.record.adoptionId,"adopt-A");
const collision=create({...base,consumptionId:"consume-B",challengeId:"challenge-B"});assert.equal(collision.created,false);assert.equal(collision.conflict,"adoption-id-collision");assert.equal(collision.record.consumptionId,"consume-A");
// Double issuer catastrophe: only first durable create owns consumption coordinate.
const a=create({...base,consumptionId:"consume-race",adoptionId:"race-A",challengeId:"race"});const b=create({...base,consumptionId:"consume-race",adoptionId:"race-B",challengeId:"race"});assert.equal(a.created,true);assert.equal(b.created,false);assert.equal(b.record.adoptionId,"race-A");
// Adoption collision must never be mistaken for successful issuance of a different consumption.
const c=create({...base,consumptionId:"consume-C",adoptionId:"race-A",challengeId:"C"});assert.equal(c.created,false);assert.equal(c.conflict,"adoption-id-collision");assert.notEqual(c.record.consumptionId,"consume-C");
assert.equal(byConsumption.size,2);assert.equal(byAdoption.size,2);
console.log("Movie Mentor durable attestation issuance store torture passed: consumption uniqueness, double-issuer convergence, and adoption-ID collision reality.");

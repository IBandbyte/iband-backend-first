import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorCommercialPurchaseIntentAuthority} from "../ai/MovieMentorCommercialPurchaseIntentAuthority.js";
import {createMovieMentorCommercialPaymentEvidenceAuthority} from "../ai/MovieMentorCommercialPaymentEvidenceAuthority.js";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
function digest(v){return crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");}
const records=new Map();const store={async create(r){const out=Object.freeze({...r,status:"created",createdAt:new Date().toISOString()});records.set(r.commercialIntentId,out);return out;},async resolve({commercialIntentId}){return records.get(commercialIntentId)||null;}};
let policy={packageId:"creator-20",provider:"test-provider",providerProductId:"prod_creator20_v1",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"2026-08-29.1"};
const authority=createMovieMentorCommercialPurchaseIntentAuthority({store,resolveCommercialPolicy:async({packageId})=>packageId===policy.packageId?policy:null,createCommercialIntentId:()=>"intent_durable_1"});
await assert.rejects(()=>authority.createPurchaseIntent({principalId:"",packageId:"creator-20"}),e=>e.code==="MOVIE_MENTOR_PURCHASE_INTENT_REQUEST_INVALID");
await assert.rejects(()=>authority.createPurchaseIntent({principalId:"principal_A",packageId:"invented"}),e=>e.code==="MOVIE_MENTOR_PURCHASE_INTENT_POLICY_INVALID");
const intent=await authority.createPurchaseIntent({principalId:"principal_A",packageId:"creator-20",units:999999,amountMinor:1,currency:"USD"});
assert.equal(intent.principalId,"principal_A");assert.equal(intent.units,20);assert.equal(intent.amountMinor,1200);assert.equal(intent.currency,"GBP");assert.equal(intent.providerProductId,"prod_creator20_v1");assert.equal(intent.policyVersion,"2026-08-29.1");
const originalDigest=intent.policyDigest;policy={...policy,providerProductId:"prod_creator20_v2",amountMinor:1800,units:30,policyVersion:"2026-09-01.1"};const resolved=await authority.resolvePurchaseIntent({commercialIntentId:intent.commercialIntentId});assert.equal(resolved.policyDigest,originalDigest);assert.equal(resolved.units,20);assert.equal(resolved.amountMinor,1200);assert.equal(resolved.providerProductId,"prod_creator20_v1");
const evidence=createMovieMentorCommercialPaymentEvidenceAuthority({verifyDelivery:async({delivery})=>({verified:delivery.signature==="valid",payload:delivery.payload}),normalizeEvent:async({verifiedDelivery})=>verifiedDelivery.payload,resolvePurchaseIntent:authority.resolvePurchaseIntent,resolveCommercialPolicy:async()=>policy});
const event={eventId:"evt_old_terms",provider:"test-provider",eventKind:"payment-completed",commercialIntentId:intent.commercialIntentId,commerciallyFinal:true,providerProductId:"prod_creator20_v1",amountMinor:1200,currency:"GBP",environment:"live"};const verified=await evidence.verifyCommercialDelivery({delivery:{signature:"valid",payload:event}});assert.equal(verified.units,20,"5A.7 must honor immutable intent snapshot, not later policy");
await assert.rejects(()=>evidence.verifyCommercialDelivery({delivery:{signature:"valid",payload:{...event,providerProductId:"prod_creator20_v2",amountMinor:1800}}}),e=>e.code==="MOVIE_MENTOR_COMMERCIAL_EVIDENCE_PRODUCT_MISMATCH");
const bad={...resolved,policyDigest:digest({...policy})};records.set(resolved.commercialIntentId,bad);await assert.rejects(()=>evidence.verifyCommercialDelivery({delivery:{signature:"valid",payload:event}}),e=>e.code==="MOVIE_MENTOR_COMMERCIAL_EVIDENCE_INTENT_SNAPSHOT_INVALID");

const oldMongo=process.env.MONGO_URI;process.env.MONGO_URI="mongodb://configured.example/test";
const production=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>policy});
assert.equal(production.ready,true);assert.equal(typeof production.authority.getStatus,"function");
const productionStatus=production.authority.getStatus();assert.equal(productionStatus.domain,"iband.movie-mentor.production-commercial-purchase-intent-authority");assert.equal(productionStatus.durablePurchaseIntent,true);assert.equal(productionStatus.immutableCommercialTerms,true);assert.equal(productionStatus.serverOwnedPolicy,true);assert.equal(productionStatus.processLocalFallback,false);
if(oldMongo===undefined)delete process.env.MONGO_URI;else process.env.MONGO_URI=oldMongo;

console.log("✓ production purchase-intent composition exports the capability proof it owns");
console.log("PASS Door 5A.9 — authenticated principal plus package request creates durable server-owned immutable commercial intent; creator cannot dictate price/units; later policy cannot rewrite an existing purchase; 5A.7 verifies against the frozen intent snapshot.");

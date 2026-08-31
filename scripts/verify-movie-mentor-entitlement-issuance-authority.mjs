import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorEntitlementIssuanceAuthority} from "../ai/MovieMentorEntitlementIssuanceAuthority.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";
async function rejectsCode(fn,code){await assert.rejects(fn,e=>e?.code===code);}
const base={verified:true,evidenceId:"evt-1",evidenceSource:"test-provider",evidenceKind:"paid-purchase",principalId:"creator-1",units:20,commercialReference:"order-1",evidenceDigest:"sha256:abc",verifiedAt:new Date().toISOString()};
function memoryStore(){const receipts=new Map();const balances=new Map();return{balances,async issue(e){const key=`${e.evidenceSource}:${e.evidenceId}`;const old=receipts.get(key);if(old){const same=old.principalId===e.principalId&&old.units===e.units&&old.commercialReference===e.commercialReference&&old.evidenceDigest===e.evidenceDigest&&old.evidenceKind===e.evidenceKind;if(!same)throw Object.assign(new Error("conflict"),{code:"MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_EVIDENCE_CONFLICT"});return{issued:true,idempotent:true,receipt:old};}const current=balances.get(e.principalId)||{status:"active",remainingUnits:0,revision:0};if(current.status!=="active")return{issued:false,reason:"entitlement-suspended"};current.remainingUnits+=e.units;current.revision+=1;balances.set(e.principalId,current);const receipt={issuanceId:`issue-${receipts.size+1}`,...e,entitlementRevisionBefore:current.revision-1,entitlementRevisionAfter:current.revision,status:"issued",issuedAt:new Date().toISOString()};receipts.set(key,receipt);return{issued:true,idempotent:false,receipt};}};}
{const store=memoryStore(),authority=createMovieMentorEntitlementIssuanceAuthority({store,allowedEvidenceSources:["test-provider"],allowedEvidenceKinds:["paid-purchase"]});const first=await authority.issueVerifiedEvidence({evidence:base});assert.equal(first.authorized,true);assert.equal(first.idempotent,false);assert.equal(store.balances.get("creator-1").remainingUnits,20);const replay=await authority.issueVerifiedEvidence({evidence:base});assert.equal(replay.idempotent,true);assert.equal(store.balances.get("creator-1").remainingUnits,20);await rejectsCode(()=>authority.issueVerifiedEvidence({evidence:{...base,units:21}}),"MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_EVIDENCE_CONFLICT");await rejectsCode(()=>authority.issueVerifiedEvidence({evidence:{...base,verified:false,evidenceId:"evt-2"}}),"MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_EVIDENCE_UNVERIFIED");await rejectsCode(()=>authority.issueVerifiedEvidence({evidence:{...base,evidenceId:"evt-2",units:-1}}),"MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_EVIDENCE_INVALID");await rejectsCode(()=>authority.issueVerifiedEvidence({evidence:{...base,evidenceId:"evt-2",evidenceSource:"evil"}}),"MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_SOURCE_UNSUPPORTED");store.balances.set("creator-2",{status:"suspended",remainingUnits:0,revision:4});await rejectsCode(()=>authority.issueVerifiedEvidence({evidence:{...base,evidenceId:"evt-3",principalId:"creator-2"}}),"MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_DENIED");assert.equal(store.balances.get("creator-2").status,"suspended");}
{const store=memoryStore(),authority=createMovieMentorEntitlementIssuanceAuthority({store});const results=await Promise.all([authority.issueVerifiedEvidence({evidence:base}),authority.issueVerifiedEvidence({evidence:base})]);assert.equal(results.filter(r=>r.idempotent===false).length,1);assert.equal(results.filter(r=>r.idempotent===true).length,1);assert.equal(store.balances.get("creator-1").remainingUnits,20);}
{const a=process.env.MONGO_URI,b=process.env.MONGODB_URI;delete process.env.MONGO_URI;delete process.env.MONGODB_URI;const c=createMovieMentorProductionEntitlementIssuanceComposition();assert.equal(c.ready,false);assert.equal(c.reason,"entitlement-issuance-store-not-configured");if(a===undefined)delete process.env.MONGO_URI;else process.env.MONGO_URI=a;if(b===undefined)delete process.env.MONGODB_URI;else process.env.MONGODB_URI=b;}

const capability=Object.freeze({configured:true,readiness:"configured",entitlementCollection:"movie_mentor_inference_entitlement",issuanceCollection:"movie_mentor_entitlement_issuance",atomicity:"mongo-transaction",evidenceIdentityUnique:true,entitlementMutationAtomic:true,issuanceReceiptDurable:true,processLocalFallback:false});
{
 const methodOnly={async issue(){throw new Error("must never be reached");}};
 const composition=createMovieMentorProductionEntitlementIssuanceComposition({store:methodOnly});
 assert.equal(composition.ready,false);
 assert.equal(composition.reason,"entitlement-issuance-injected-capability-not-proven");
}
{
 const incomplete={async issue(){throw new Error("must never be reached");},getStatus(){return {...capability,issuanceReceiptDurable:false};}};
 const composition=createMovieMentorProductionEntitlementIssuanceComposition({store:incomplete});
 assert.equal(composition.ready,false);
 assert.equal(composition.reason,"entitlement-issuance-injected-capability-not-proven");
}
{
 const uncertain={async issue(){throw new Error("must never be reached");},getStatus(){throw new Error("status unavailable");}};
 const composition=createMovieMentorProductionEntitlementIssuanceComposition({store:uncertain});
 assert.equal(composition.ready,false);
 assert.equal(composition.reason,"entitlement-issuance-injected-capability-not-proven");
}
{
 const proven={async issue(){return{issued:false,reason:"unused"};},getStatus(){return capability;}};
 const composition=createMovieMentorProductionEntitlementIssuanceComposition({store:proven});
 assert.equal(composition.ready,true);
 assert.equal(composition.storeStatus.atomicity,"mongo-transaction");
 assert.equal(composition.storeStatus.issuanceReceiptDurable,true);
}

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorEntitlementIssuanceMongoStore.js",import.meta.url),"utf8"),compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionEntitlementIssuanceComposition.js",import.meta.url),"utf8"),spendSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js",import.meta.url),"utf8"),budgetSource=fs.readFileSync(new URL("../ai/MovieMentorBudgetSpendingGuardAgent.js",import.meta.url),"utf8");assert.match(storeSource,/withTransaction/);assert.match(storeSource,/evidenceSource:1,evidenceId:1/);assert.match(storeSource,/remainingUnits:n\.units/);assert.match(storeSource,/\$inc:\{remainingUnits:n\.units,entitlementRevision:1\}/);assert.match(storeSource,/entitlement-suspended/);assert.match(storeSource,/entitlementMutationAtomic:true/);assert.match(storeSource,/issuanceReceiptDurable:true/);assert.match(storeSource,/processLocalFallback:false/);assert.match(storeSource,/Object\.freeze\(\{issue,getStatus\}\)/);assert.doesNotMatch(storeSource,/stripe/i);assert.match(compositionSource,/ownedStatus\(store\)/);assert.match(compositionSource,/entitlement-issuance-injected-capability-not-proven/);assert.doesNotMatch(compositionSource,/readiness:"injected"/);assert.match(spendSource,/remainingUnits:-n\.units,reservedUnits:n\.units/);assert.match(spendSource,/withTransaction/);assert.match(budgetSource,/READ-ONLY BUDGET AND SPENDING-GUARD INTELLIGENCE ONLY/);assert.match(budgetSource,/does not change provider\/model routing, quotas, plans, prices, billing settings or production configuration/);
console.log("✓ injected issuance method shape grants zero production capability credit");
console.log("✓ injected issuance store must own and expose exact durable transaction + receipt proof");
console.log("✓ missing, incomplete or uncertain capability provenance fails closed before authority composition");
console.log("LAW: entitlement issuance may create future spend authority, so only the issuance store may prove its irreversible capability contract");
console.log("Movie Mentor 5A.6 entitlement issuance authority torture: PASS");

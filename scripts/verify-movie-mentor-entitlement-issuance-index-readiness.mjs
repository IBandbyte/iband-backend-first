import assert from "node:assert/strict";
import {createMovieMentorEntitlementIssuanceMongoStore,getMovieMentorEntitlementIssuanceMongoStoreStatus} from "../ai/MovieMentorEntitlementIssuanceMongoStore.js";

let indexReady=false;
let indexCalls=0;
let transactionCalls=0;
function query(value){return{session(){return this;},lean(){return this;},async exec(){return value;}};}
const entitlementModel=Object.freeze({
 async createIndexes(){indexCalls+=1;},
 findOne(){return query(null);},
 async create(){transactionCalls+=1;if(!indexReady){const error=new Error("physical entitlement uniqueness indexes are not ready");error.code="INDEX_NOT_READY";throw error;}return[];}
});
const issuanceModel=Object.freeze({
 async createIndexes(){indexCalls+=1;indexReady=true;},
 findOne(){return query(null);},
 async create(){transactionCalls+=1;return[];}
});
const session=Object.freeze({
 async withTransaction(fn){await fn();},
 async endSession(){}
});
const store=createMovieMentorEntitlementIssuanceMongoStore({modelSet:{entitlementModel,issuanceModel},startSession:async()=>session});
const evidence={evidenceId:"evt-paid-index",evidenceSource:"stripe",evidenceKind:"payment-completed",evidenceDigest:"digest-index",principalId:"creator-index",units:20,commercialReference:"intent-index"};

await assert.rejects(
 ()=>store.issue(evidence),
 error=>error?.code!=="INDEX_NOT_READY"&&error?.message!=="Entitlement issuance failed: physical entitlement uniqueness indexes are not ready",
 "entitlement issuance must explicitly initialize physical uniqueness indexes before transaction mutation; any later domain failure is acceptable only after readiness crossed first"
);
assert.equal(indexCalls,2,"entitlement issuance store must explicitly prove physical indexes for entitlement and issuance models");
assert.equal(transactionCalls,1,"court must reach exactly one post-readiness mutation attempt so index ordering is genuinely exercised");
const status=getMovieMentorEntitlementIssuanceMongoStoreStatus();
assert.equal(status.uniquenessReadinessRequired,true,"production entitlement composition must be able to require physical uniqueness readiness");
assert.equal(status.physicalUniqueIndexReadiness,true,"entitlement issuance store must explicitly own physical unique-index readiness");

console.log("entitlement issuance index-readiness torture: GREEN");
console.log("LAW: ENTITLEMENT AND ISSUANCE UNIQUENESS ARE NOT AUTHORITATIVE UNTIL THEIR PHYSICAL INDEXES ARE READY; VERIFIED PAYMENT EVIDENCE MAY NOT CROSS AN ENTITLEMENT OR ISSUANCE WRITE BOUNDARY FIRST.");

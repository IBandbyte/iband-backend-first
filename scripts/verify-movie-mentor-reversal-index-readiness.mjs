import assert from "node:assert/strict";
import {createMovieMentorCommercialReversalMongoStore,getMovieMentorCommercialReversalMongoStoreStatus} from "../ai/MovieMentorCommercialReversalMongoStore.js";

let indexReady=false;
let indexCalls=0;
let pendingMutationCalls=0;
function query(value){return{lean(){return this;},async exec(){return value;}};}
const entitlementModel=Object.freeze({async createIndexes(){indexCalls+=1;}});
const reversalModel=Object.freeze({async createIndexes(){indexCalls+=1;},findOne(){return query(null);}});
const pendingModel=Object.freeze({
 async createIndexes(){indexCalls+=1;indexReady=true;},
 findOne(){return query(null);},
 async create(record){pendingMutationCalls+=1;if(!indexReady){const error=new Error("physical reversal uniqueness indexes are not ready");error.code="INDEX_NOT_READY";throw error;}return Object.freeze({...record});}
});
const store=createMovieMentorCommercialReversalMongoStore({modelSet:{entitlementModel,reversalModel,pendingModel}});
const evidence={evidenceId:"evt-refund-index",evidenceSource:"stripe",evidenceKind:"refund",providerPaymentReference:"pi-index",reversalAmountMinor:2000,currency:"GBP",verifiedAt:"2026-09-10T09:00:00.000Z"};

await assert.doesNotReject(
 ()=>store.preservePending(evidence),
 "verified reversal history must wait for physical reversal/pending uniqueness readiness before durable preservation"
);
assert.equal(indexCalls,3,"reversal store must explicitly prove physical indexes for entitlement, final reversal and pending-history models");
assert.equal(pendingMutationCalls,1,"pending reversal mutation may cross only after physical indexes are ready");
const status=getMovieMentorCommercialReversalMongoStoreStatus();
assert.equal(status.uniquenessReadinessRequired,true,"production reversal composition must be able to require physical uniqueness readiness");
assert.equal(status.physicalUniqueIndexReadiness,true,"reversal store must explicitly own physical unique-index readiness");

console.log("commercial reversal index-readiness torture: GREEN");
console.log("LAW: REVERSAL AND PENDING-REVERSAL UNIQUENESS ARE NOT AUTHORITATIVE UNTIL THEIR PHYSICAL INDEXES ARE READY; VERIFIED REVERSAL HISTORY MAY NOT CROSS A DURABLE WRITE BOUNDARY FIRST.");

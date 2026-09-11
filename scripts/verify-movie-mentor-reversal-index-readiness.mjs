import assert from "node:assert/strict";
import {createMovieMentorCommercialReversalMongoStore,getMovieMentorCommercialReversalMongoStoreStatus} from "../ai/MovieMentorCommercialReversalMongoStore.js";

let indexReady=false;
let indexCalls=0;
let physicalIndexReads=0;
let pendingMutationCalls=0;
function query(value){return{lean(){return this;},async exec(){return value;}};}
const entitlementIndexes=Object.freeze([{name:"principalId_1",key:Object.freeze({principalId:1}),unique:true}]);
const reversalIndexes=Object.freeze([
 Object.freeze({name:"reversalId_1",key:Object.freeze({reversalId:1}),unique:true}),
 Object.freeze({name:"evidenceSource_1_evidenceId_1",key:Object.freeze({evidenceSource:1,evidenceId:1}),unique:true}),
]);
const pendingIndexes=Object.freeze([{name:"evidenceSource_1_evidenceId_1",key:Object.freeze({evidenceSource:1,evidenceId:1}),unique:true}]);
const entitlementModel=Object.freeze({async createIndexes(){indexCalls+=1;},collection:Object.freeze({async indexes(){physicalIndexReads+=1;return indexReady?entitlementIndexes:[];}})});
const reversalModel=Object.freeze({async createIndexes(){indexCalls+=1;},collection:Object.freeze({async indexes(){physicalIndexReads+=1;return indexReady?reversalIndexes:[];}}),findOne(){return query(null);}});
const pendingModel=Object.freeze({
 async createIndexes(){indexCalls+=1;indexReady=true;},
 collection:Object.freeze({async indexes(){physicalIndexReads+=1;return indexReady?pendingIndexes:[];}}),
 findOne(){return query(null);},
 async create(record){pendingMutationCalls+=1;if(!indexReady){const error=new Error("physical reversal uniqueness indexes are not ready");error.code="INDEX_NOT_READY";throw error;}return Object.freeze({...record});}
});
const store=createMovieMentorCommercialReversalMongoStore({modelSet:{entitlementModel,reversalModel,pendingModel}});
const evidence={evidenceId:"evt-refund-index",evidenceSource:"stripe",evidenceKind:"refund",providerPaymentReference:"pi-index",reversalAmountMinor:2000,currency:"GBP",verifiedAt:"2026-09-10T09:00:00.000Z"};

await assert.doesNotReject(
 ()=>store.preservePending(evidence),
 "verified reversal history must wait for index initialization and exact observed physical uniqueness before durable preservation"
);
assert.equal(indexCalls,3,"reversal store must initialize indexes for entitlement, final reversal and pending-history models");
assert.equal(physicalIndexReads,3,"reversal store must inspect each owned collection's physical index catalogue");
assert.equal(pendingMutationCalls,1,"pending reversal mutation may cross only after exact physical identities are observed");
const status=getMovieMentorCommercialReversalMongoStoreStatus();
assert.equal(status.uniquenessReadinessRequired,true,"production reversal composition must be able to require physical uniqueness readiness");
assert.equal(status.physicalUniqueIndexReadiness,true,"reversal store must explicitly own physical unique-index readiness");
assert.equal(status.physicalUniqueIndexObservationRequired,true,"reversal store must distinguish collection observation from model index initialization");

console.log("commercial reversal index-readiness torture: GREEN");
console.log("LAW: INITIALIZATION PREPARES REVERSAL INDEXES; EACH OWNED COLLECTION MUST THEN PROVE ITS OWN OBSERVED PHYSICAL AUTHORITY BEFORE DURABLE HISTORY OR SUSPENSION MAY CROSS.");

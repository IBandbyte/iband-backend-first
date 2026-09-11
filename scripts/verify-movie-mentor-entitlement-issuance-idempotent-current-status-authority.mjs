import assert from "node:assert/strict";
import {createMovieMentorEntitlementIssuanceMongoStore} from "../ai/MovieMentorEntitlementIssuanceMongoStore.js";

function query(value){return{session(){return this;},lean(){return this;},async exec(){return value?structuredClone(value):null;}};}
function session(){return{async withTransaction(fn){await fn();},async endSession(){}};}
const entitlementIndexes=Object.freeze([{name:"principalId_1",key:Object.freeze({principalId:1}),unique:true}]);
const issuanceIndexes=Object.freeze([
 Object.freeze({name:"issuanceId_1",key:Object.freeze({issuanceId:1}),unique:true}),
 Object.freeze({name:"evidenceSource_1_evidenceId_1",key:Object.freeze({evidenceSource:1,evidenceId:1}),unique:true}),
]);
const evidence={evidenceId:"evt-replay",evidenceSource:"test-provider",evidenceKind:"paid-purchase",evidenceDigest:"digest-replay",principalId:"creator-1",units:20,commercialReference:"order-1"};
const receipt={domain:"iband.movie-mentor.inference-spend",schema:1,issuanceId:"issue-1",...evidence,entitlementRevisionBefore:1,entitlementRevisionAfter:2,status:"issued",issuedAt:new Date("2035-01-01T00:00:00.000Z")};

async function attempt(entitlementStatus){
 let entitlementReads=0;
 const I={async createIndexes(){},collection:{async indexes(){return issuanceIndexes;}},findOne:()=>query(receipt)};
 const E={async createIndexes(){},collection:{async indexes(){return entitlementIndexes;}},findOne(){entitlementReads+=1;return query({domain:"iband.movie-mentor.inference-spend",schema:1,principalId:evidence.principalId,status:entitlementStatus,remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:3});}};
 const store=createMovieMentorEntitlementIssuanceMongoStore({modelSet:{entitlementModel:E,issuanceModel:I},startSession:async()=>session()});
 try{return{ok:true,result:await store.issue(evidence),entitlementReads};}catch(error){return{ok:false,error,entitlementReads};}
}
const active=await attempt("active");
assert.equal(active.ok,true,"exact commercial evidence replay may remain idempotent while entitlement is active");
assert.equal(active.result?.idempotent,true);
assert.ok(active.entitlementReads>0,"idempotent issuance replay must consult current durable entitlement status");
const suspended=await attempt("suspended");
assert.equal(suspended.ok,false,"historical issuance receipt must not be presented as current issuance authority after entitlement suspension");
assert.equal(suspended.error?.code,"MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_IDEMPOTENT_STATUS_FENCED");
console.log("GREEN: idempotent entitlement issuance replay revalidates current durable entitlement status after proving its own physical store authority.");
console.log("LAW: AN ISSUANCE RECEIPT MAY SURVIVE SUSPENSION AS HISTORY; IT MAY NOT BORROW CURRENT ENTITLEMENT AUTHORITY.");

import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutBindingMongoStore,getMovieMentorCommercialCheckoutBindingMongoStoreStatus} from "../ai/MovieMentorCommercialCheckoutBindingMongoStore.js";

let indexReady=false;
let createIndexesCalls=0;
let durableMutationCalls=0;
const row=Object.freeze({
 domain:"iband.movie-mentor.commercial-checkout-binding",
 schema:1,
 commercialIntentId:"intent-index-court",
 provider:"stripe",
 idempotencyKey:"movie-mentor:intent-index-court",
 status:"pending",
 checkoutReference:null,
 checkoutUrl:null,
 providerPaymentReference:null,
 createdAtAuthority:new Date("2026-09-10T00:00:00.000Z")
});
const modelRef=Object.freeze({
 async createIndexes(){createIndexesCalls+=1;indexReady=true;return[];},
 findOneAndUpdate(){
  durableMutationCalls+=1;
  return {lean(){return this;},async exec(){
   if(!indexReady){const error=new Error("physical unique indexes are not ready");error.code="INDEX_NOT_READY";throw error;}
   return row;
  }};
 }
});

const store=createMovieMentorCommercialCheckoutBindingMongoStore({modelRef});
await assert.doesNotReject(
 ()=>store.begin({commercialIntentId:"intent-index-court",provider:"stripe",idempotencyKey:"movie-mentor:intent-index-court"}),
 "checkout-binding durable mutation must wait for explicit physical unique-index creation before an upsert can cross the irreversible boundary"
);
assert.equal(createIndexesCalls,1,"checkout-binding store must explicitly prove physical unique-index readiness");
assert.equal(durableMutationCalls,1,"the durable upsert may run only after uniqueness readiness has completed");

let failedMutationCalls=0;
const unavailableModel=Object.freeze({
 async createIndexes(){throw new Error("index build unavailable");},
 findOneAndUpdate(){failedMutationCalls+=1;throw new Error("mutation must remain unreachable");}
});
const unavailableStore=createMovieMentorCommercialCheckoutBindingMongoStore({modelRef:unavailableModel});
await assert.rejects(
 ()=>unavailableStore.begin({commercialIntentId:"intent-index-failure",provider:"stripe",idempotencyKey:"movie-mentor:intent-index-failure"}),
 error=>error?.code==="MOVIE_MENTOR_CHECKOUT_BINDING_INDEX_AUTHORITY_UNAVAILABLE"&&error?.retryable===true,
 "index-readiness failure must fail closed with no durable checkout mutation"
);
assert.equal(failedMutationCalls,0,"no checkout mutation may execute when physical uniqueness cannot be proven");

const status=getMovieMentorCommercialCheckoutBindingMongoStoreStatus();
assert.equal(status.uniquenessReadinessRequired,true,"production composition must be able to require checkout-binding uniqueness readiness as a capability");
assert.equal(status.physicalUniqueIndexReadiness,true,"store capability must explicitly claim physical unique-index readiness ownership");

console.log("checkout-binding index-readiness torture: GREEN");
console.log("LAW: A SCHEMA-DECLARED UNIQUE INDEX IS NOT DURABLE UNIQUENESS AUTHORITY UNTIL THE PHYSICAL INDEX IS READY; CHECKOUT BINDING, PROVIDER CHECKOUT REFERENCE, AND PAYMENT REFERENCE MUTATIONS MUST FAIL CLOSED BEFORE THAT BOUNDARY.");

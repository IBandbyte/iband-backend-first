import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutBindingMongoStore,getMovieMentorCommercialCheckoutBindingMongoStoreStatus} from "../ai/MovieMentorCommercialCheckoutBindingMongoStore.js";

let indexReady=false;
let initCalls=0;
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
 async init(){initCalls+=1;indexReady=true;return modelRef;},
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
 "checkout-binding durable mutation must wait for physical unique-index readiness before an upsert can cross the irreversible boundary"
);
assert.equal(initCalls,1,"checkout-binding store must explicitly initialize its model/index authority");
assert.equal(durableMutationCalls,1,"the durable upsert may run only after uniqueness readiness has completed");
assert.equal(getMovieMentorCommercialCheckoutBindingMongoStoreStatus().uniquenessReadinessRequired,true,"production composition must be able to require checkout-binding uniqueness readiness as a capability");

console.log("checkout-binding index-readiness torture: GREEN");
console.log("LAW: A SCHEMA-DECLARED UNIQUE INDEX IS NOT DURABLE UNIQUENESS AUTHORITY UNTIL THE PHYSICAL INDEX IS READY; CHECKOUT BINDING, PROVIDER CHECKOUT REFERENCE, AND PAYMENT REFERENCE MUTATIONS MUST FAIL CLOSED BEFORE THAT BOUNDARY.");

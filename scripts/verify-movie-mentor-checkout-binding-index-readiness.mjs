import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutBindingMongoStore,getMovieMentorCommercialCheckoutBindingMongoStoreStatus} from "../ai/MovieMentorCommercialCheckoutBindingMongoStore.js";

let indexReady=false;
let createIndexesCalls=0;
let physicalIndexReads=0;
let durableMutationCalls=0;
const physicalIndexes=Object.freeze([
 Object.freeze({name:"commercialIntentId_1",key:Object.freeze({commercialIntentId:1}),unique:true}),
 Object.freeze({name:"provider_1_checkoutReference_1",key:Object.freeze({provider:1,checkoutReference:1}),unique:true,partialFilterExpression:Object.freeze({checkoutReference:Object.freeze({$type:"string"})})}),
 Object.freeze({name:"provider_1_providerPaymentReference_1",key:Object.freeze({provider:1,providerPaymentReference:1}),unique:true,partialFilterExpression:Object.freeze({providerPaymentReference:Object.freeze({$type:"string"})})}),
]);
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
 collection:Object.freeze({async indexes(){physicalIndexReads+=1;return indexReady?physicalIndexes:[];}}),
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
 "checkout-binding durable mutation must wait for explicit index creation and observed exact physical uniqueness before an upsert can cross the irreversible boundary"
);
assert.equal(createIndexesCalls,1,"checkout-binding store must explicitly initialize its declared indexes");
assert.equal(physicalIndexReads,1,"checkout-binding store must independently inspect the physical index catalogue after initialization");
assert.equal(durableMutationCalls,1,"the durable upsert may run only after physical uniqueness authority has been observed");

let failedMutationCalls=0;
const unavailableModel=Object.freeze({
 async createIndexes(){throw new Error("index build unavailable");},
 collection:Object.freeze({async indexes(){throw new Error("physical catalogue must remain unreachable after failed initialization");}}),
 findOneAndUpdate(){failedMutationCalls+=1;throw new Error("mutation must remain unreachable");}
});
const unavailableStore=createMovieMentorCommercialCheckoutBindingMongoStore({modelRef:unavailableModel});
await assert.rejects(
 ()=>unavailableStore.begin({commercialIntentId:"intent-index-failure",provider:"stripe",idempotencyKey:"movie-mentor:intent-index-failure"}),
 error=>error?.code==="MOVIE_MENTOR_CHECKOUT_BINDING_INDEX_AUTHORITY_UNAVAILABLE"&&error?.retryable===true,
 "index-initialization failure must fail closed with no durable checkout mutation"
);
assert.equal(failedMutationCalls,0,"no checkout mutation may execute when uniqueness cannot be initialized and proven");

const status=getMovieMentorCommercialCheckoutBindingMongoStoreStatus();
assert.equal(status.uniquenessReadinessRequired,true,"production composition must be able to require checkout-binding uniqueness readiness as a capability");
assert.equal(status.physicalUniqueIndexReadiness,true,"store capability must explicitly claim physical unique-index readiness ownership");
assert.equal(status.physicalUniqueIndexObservationRequired,true,"store capability must distinguish observed physical authority from model initialization");

console.log("checkout-binding index-readiness torture: GREEN");
console.log("LAW: INITIALIZATION PREPARES THE INDEXES; OBSERVATION PROVES THE PHYSICAL AUTHORITY; NEITHER MAY BE BORROWED FROM THE OTHER.");

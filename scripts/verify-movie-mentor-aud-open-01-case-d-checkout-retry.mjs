import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorCommercialCheckoutBindingMongoStore} from "../ai/MovieMentorCommercialCheckoutBindingMongoStore.js";
import {createMovieMentorCommercialCheckoutProviderRegistry} from "../ai/MovieMentorCommercialCheckoutProviderRegistry.js";
const uri=process.env.MONGO_URI;
assert.ok(uri&&/(?:127\\.0\\.0\\.1|localhost):27017\\/iband_aud_open_01(?:\\?|$)/.test(uri),"isolated MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try {
 const store=createMovieMentorCommercialCheckoutBindingMongoStore();
 const db=mongoose.connection.db;
 const coll=db.collection("movie_mentor_commercial_checkout_binding");
 const principal="case-d-checkout-principal";
 const make=(id,principalId)=>({domain:"iband.movie-mentor.commercial-checkout-binding",schema:1,commercialIntentId:id,provider:"stripe",idempotencyKey:"key-"+id,status:"completed",checkoutReference:"cs-"+id,checkoutUrl:"https://example.invalid/"+id,providerPaymentReference:null,createdAtAuthority:new Date(),completedAtAuthority:new Date(),principalId});
 await coll.insertMany([make("case-d-open-a",principal),make("case-d-open-b",principal),make("case-d-other","other-principal")]);
 const calls=[];let failOnce=true;
 const registry=createMovieMentorCommercialCheckoutProviderRegistry({providers:{stripe:{
 getStatus:()=>({provider:"stripe",productionCommercialCheckoutProvider:true,createCheckout:true,resolveCheckout:true,revokeCheckout:true,processLocalFallback:false}),
 createCheckout:async()=>{throw Error("not used");},
 resolveCheckout:async()=>{throw Error("not used");},
 revokeCheckout:async({checkoutReference})=>{calls.push(checkoutReference);if(checkoutReference==="cs-case-d-open-b"&&failOnce){failOnce=false;throw Error("CASE_D_PROVIDER_REVOCATION_INTERRUPTED");}return {revoked:true,provider:"stripe",checkoutReference};}
 }}});
 async function revokeForPrincipal(){
  const found=await store.listUnpaidCompleted();
  for(const binding of found){const raw=await coll.findOne({commercialIntentId:binding.commercialIntentId});if(raw?.principalId!==principal)continue;await registry.revokeProviderCheckout({provider:binding.provider,checkoutReference:binding.checkoutReference});}
 }
 await assert.rejects(revokeForPrincipal,/CASE_D_PROVIDER_REVOCATION_INTERRUPTED/);
 assert.deepEqual(calls,["cs-case-d-open-a","cs-case-d-open-b"]);
 const still=await store.listUnpaidCompleted();
 assert.equal(still.length,3,"unpaid checkout records remain discoverable after interrupted provider revocation");
 await revokeForPrincipal();
 assert.deepEqual(calls,["cs-case-d-open-a","cs-case-d-open-b","cs-case-d-open-a","cs-case-d-open-b"]);
 assert.equal(calls.includes("cs-case-d-other"),false);
 console.log("CASE D CHECKOUT PHYSICAL GREEN: MongoDB unpaid-checkout discovery and exact provider acknowledgement retry");
 console.log("NOT PROVEN: real provider-side durable revocation, end-to-end ingress, or autonomous credit settlement");
}finally{await mongoose.disconnect();}

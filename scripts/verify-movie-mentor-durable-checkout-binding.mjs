import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

const intent=Object.freeze({commercialIntentId:"ci_catastrophe_17",principalId:"creator_17",packageId:"launch",provider:"stripe",providerProductId:"price_server_owned",amountMinor:1000,currency:"GBP",environment:"test",units:10,policyVersion:"v1",policyDigest:"digest",status:"created"});
let durable=null,providerCalls=0,failCompletionOnce=true;
const store={
 async begin({commercialIntentId,provider,idempotencyKey}){if(!durable)durable={commercialIntentId,provider,idempotencyKey,status:"pending",checkoutReference:null,checkoutUrl:null,expiresAt:null};assert.equal(durable.idempotencyKey,"movie-mentor:ci_catastrophe_17");return Object.freeze({...durable});},
 async complete(input){if(failCompletionOnce){failCompletionOnce=false;throw Object.assign(new Error("simulated crash after provider success"),{code:"MOVIE_MENTOR_CHECKOUT_BINDING_AUTHORITY_UNAVAILABLE"});}durable={...durable,status:"completed",checkoutReference:input.checkoutReference,checkoutUrl:input.checkoutUrl,expiresAt:input.expiresAt};return Object.freeze({...durable});},
 async resolve(){return durable?Object.freeze({...durable}):null;}
};
const providerSessions=new Map();
async function createProviderCheckout({intent:providerIntent,idempotencyKey}){providerCalls++;assert.equal(providerIntent.commercialIntentId,intent.commercialIntentId);assert.equal(idempotencyKey,"movie-mentor:ci_catastrophe_17");if(!providerSessions.has(idempotencyKey))providerSessions.set(idempotencyKey,Object.freeze({authorized:true,commercialIntentId:intent.commercialIntentId,provider:"stripe",checkoutReference:"cs_same_session",checkoutUrl:"https://checkout.example/same",expiresAt:null}));return providerSessions.get(idempotencyKey);}
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({resolvePurchaseIntent:async()=>intent,createProviderCheckout,checkoutBindingStore:store});
await assert.rejects(()=>authority.initiateCheckout({principalId:"creator_17",commercialIntentId:intent.commercialIntentId}),error=>error.code==="MOVIE_MENTOR_CHECKOUT_BINDING_AUTHORITY_UNAVAILABLE");
assert.equal(durable.status,"pending","Provider-success/local-crash must leave durable uncertainty, not fabricated completion.");
const recovered=await authority.initiateCheckout({principalId:"creator_17",commercialIntentId:intent.commercialIntentId});
assert.equal(recovered.checkoutReference,"cs_same_session");assert.equal(durable.status,"completed");assert.equal(providerCalls,2,"Retry may re-contact provider but must use same deterministic idempotency authority.");
const replay=await authority.initiateCheckout({principalId:"creator_17",commercialIntentId:intent.commercialIntentId});
assert.equal(replay.recovered,true);assert.equal(providerCalls,2,"Completed durable binding must suppress another provider side effect.");

const storeSource=await fs.readFile(new URL("../ai/MovieMentorCommercialCheckoutBindingMongoStore.js",import.meta.url),"utf8");
const composition=await fs.readFile(new URL("../ai/MovieMentorProductionCommercialCheckoutComposition.js",import.meta.url),"utf8");
const registry=await fs.readFile(new URL("../ai/MovieMentorCommercialCheckoutProviderRegistry.js",import.meta.url),"utf8");
const stripe=await fs.readFile(new URL("../ai/MovieMentorStripeCommercialProviderAdapter.js",import.meta.url),"utf8");
const server=await fs.readFile(new URL("../server.js",import.meta.url),"utf8");
assert.match(storeSource,/unique:true/);assert.match(storeSource,/status:\{type:String,enum:\["pending","completed"\]/);assert.match(storeSource,/processLocalFallback:false/);assert.match(composition,/createMovieMentorCommercialCheckoutBindingMongoStore/);assert.match(registry,/idempotencyKey/);assert.match(stripe,/key!==`movie-mentor:\$\{id\}`/);assert.match(server,/app\.use\(commercialMount\.creatorBasePath,commercialMount\.creatorRouter\)/);
const originIndex=server.indexOf("browserOriginAuthority.authorizeRequest");const creatorIndex=server.indexOf("app.use(commercialMount.creatorBasePath");assert(originIndex>=0&&creatorIndex>originIndex,"Creator commercial router must mount behind browser-origin authority.");
console.log("PASS 5A.17: durable checkout binding survives provider-success/local-crash uncertainty, retry converges through one server-owned idempotency key, completed durable reality suppresses duplicate provider side effects, and creator commerce no longer bypasses browser-origin authority.");

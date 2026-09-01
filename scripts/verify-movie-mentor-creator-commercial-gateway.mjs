import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorCreatorCommercialRequestAuthority} from "../ai/MovieMentorCreatorCommercialRequestAuthority.js";
import {createMovieMentorCommercialRouter} from "../movieMentorCommercial.js";
import {createMovieMentorProductionCreatorCommercialComposition} from "../ai/MovieMentorProductionCreatorCommercialComposition.js";
import {createMovieMentorProductionCommercialPolicyComposition} from "../ai/MovieMentorProductionCommercialPolicyComposition.js";
import {createMovieMentorProductionAuthenticationComposition} from "../ai/MovieMentorProductionAuthenticationComposition.js";

function response(){return{statusCode:200,payload:null,status(code){this.statusCode=code;return this;},json(value){this.payload=value;return this;}};}
function principalAdapter(){return async({request})=>{if(!request?.headers?.authorization){const error=new Error("credential required");error.code="MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED";throw error;}return Object.freeze({authenticated:true,principalId:"creator-1",authenticationSource:"synthetic"});};}

const requestAuthority=createMovieMentorCreatorCommercialRequestAuthority({verifyCredential:async()=>({verified:true}),derivePrincipal:principalAdapter()});
let intentInput=null,checkoutInput=null,packageListCalls=0;
const purchaseIntentAuthority={async createPurchaseIntent(input){intentInput=input;return Object.freeze({commercialIntentId:"intent-1",principalId:input.principalId,packageId:input.packageId,status:"created"});}};
const checkoutAuthority={async initiateCheckout(input){checkoutInput=input;return Object.freeze({authorized:true,commercialIntentId:input.commercialIntentId,provider:"provider-a",checkoutReference:"session-1",checkoutUrl:"https://checkout.example/session-1"});}};
const listCommercialPackages=async()=>{packageListCalls+=1;return Object.freeze([Object.freeze({packageId:"creator-20",displayName:"Creator 20",currency:"GBP",amountMinor:2000,units:20})]);};

assert.throws(()=>createMovieMentorCommercialRouter({requestAuthority,purchaseIntentAuthority,checkoutAuthority}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PACKAGE_CATALOGUE_AUTHORITY_REQUIRED");
const router=createMovieMentorCommercialRouter({requestAuthority,purchaseIntentAuthority,checkoutAuthority,listCommercialPackages});
const packagesLayer=router.stack.find(layer=>layer.route?.path==="/packages");
const purchaseLayer=router.stack.find(layer=>layer.route?.path==="/purchase-intents");
const checkoutLayer=router.stack.find(layer=>layer.route?.path==="/checkout");
let res=response();await packagesLayer.route.stack[0].handle({headers:{}},res);assert.equal(res.statusCode,401);assert.equal(packageListCalls,0);
res=response();await packagesLayer.route.stack[0].handle({headers:{authorization:"Bearer valid"}},res);assert.equal(res.statusCode,200);assert.equal(packageListCalls,1);assert.equal(res.payload.status,"commercial-packages-authorized");assert.equal(res.payload.packages[0].packageId,"creator-20");
res=response();await purchaseLayer.route.stack[0].handle({headers:{},body:{packageId:"creator-20"}},res);assert.equal(res.statusCode,401);assert.equal(intentInput,null);
res=response();await purchaseLayer.route.stack[0].handle({headers:{authorization:"Bearer valid"},body:{packageId:"creator-20",principalId:"victim",amountMinor:1,units:999999,providerProductId:"attacker"}},res);assert.equal(res.statusCode,201);assert.deepEqual(intentInput,{principalId:"creator-1",packageId:"creator-20"});assert.equal(res.payload.intent.principalId,"creator-1");
res=response();await checkoutLayer.route.stack[0].handle({headers:{authorization:"Bearer valid"},body:{commercialIntentId:"intent-1",principalId:"victim",amountMinor:1,units:999999}},res);assert.equal(res.statusCode,200);assert.deepEqual(checkoutInput,{principalId:"creator-1",commercialIntentId:"intent-1"});assert.equal(res.payload.checkout.authorized,true);
res=response();await checkoutLayer.route.stack[0].handle({headers:{authorization:"Bearer valid"},body:{}},res);assert.equal(res.statusCode,422);
assert.throws(()=>createMovieMentorCommercialRouter({requestAuthority,purchaseIntentAuthority,listCommercialPackages}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_AUTHORITY_REQUIRED");

const authVerifier=Object.freeze({version:"1.0.0",domain:"iband.movie-mentor.journey-recovery-clerk-credential-verifier",provider:"clerk",algorithm:"RS256",networkMode:"pinned-public-key",authorizedParties:Object.freeze(["https://app.example.com"]),verifyCredential:async()=>({verified:true})});
const authentication=createMovieMentorProductionAuthenticationComposition({env:{MOVIE_MENTOR_CLERK_JWT_KEY:"PUBLIC",MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:'["https://app.example.com"]',MOVIE_MENTOR_CLERK_ISSUER:"issuer",MOVIE_MENTOR_AUDIENCE:"audience"},createVerifier:()=>authVerifier});
const authProof=authentication.getStatus();
const purchaseProof=Object.freeze({domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false});
const checkoutProof=Object.freeze({domain:"iband.movie-mentor.production-commercial-checkout-authority",production:true,durableCheckoutBinding:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false});
const catalogueProof=Object.freeze({domain:"iband.movie-mentor.production-commercial-package-catalogue-authority",production:true,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true,configurationSource:"MOVIE_MENTOR_COMMERCIAL_POLICY_JSON"});
const provenPurchase=Object.freeze({...purchaseIntentAuthority,getStatus:()=>purchaseProof});
const provenCheckout=Object.freeze({...checkoutAuthority,getStatus:()=>checkoutProof});
const provenCatalogue=Object.freeze({listCommercialPackages,getStatus:()=>catalogueProof});

assert.throws(()=>createMovieMentorProductionCreatorCommercialComposition({authentication:{ready:true,verifyCredential:authentication.verifyCredential,expectedIssuer:"issuer",expectedAudience:"audience"},purchaseIntentAuthority:provenPurchase,checkoutAuthority:provenCheckout,packageCatalogueAuthority:provenCatalogue}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_AUTHENTICATION_REQUIRED");
assert.throws(()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority,checkoutAuthority:provenCheckout,packageCatalogueAuthority:provenCatalogue}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_PURCHASE_INTENT_REQUIRED");
assert.throws(()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority:provenPurchase,checkoutAuthority,packageCatalogueAuthority:provenCatalogue}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_CHECKOUT_REQUIRED");
assert.throws(()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority:provenPurchase,checkoutAuthority:provenCheckout,packageCatalogueAuthority:{listCommercialPackages}}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_PACKAGE_CATALOGUE_REQUIRED");
assert.throws(()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority:{...provenPurchase,getStatus:()=>({...purchaseProof,durablePurchaseIntent:false})},checkoutAuthority:provenCheckout,packageCatalogueAuthority:provenCatalogue}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_PURCHASE_INTENT_REQUIRED");
assert.throws(()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority:provenPurchase,checkoutAuthority:{...provenCheckout,getStatus(){throw new Error("status unavailable");}},packageCatalogueAuthority:provenCatalogue}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_CHECKOUT_REQUIRED");
assert.throws(()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority:provenPurchase,checkoutAuthority:provenCheckout,packageCatalogueAuthority:{...provenCatalogue,getStatus:()=>({...catalogueProof,creatorMutable:true})}}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_PACKAGE_CATALOGUE_REQUIRED");
const production=createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority:provenPurchase,checkoutAuthority:provenCheckout,packageCatalogueAuthority:provenCatalogue});assert.equal(production.ready,true);assert.equal(production.mounted,false);assert.equal(production.authenticationStatus,authProof);assert.equal(production.purchaseIntentStatus.durablePurchaseIntent,true);assert.equal(production.checkoutStatus.durableCheckoutBinding,true);assert.equal(production.catalogueStatus.serverOwned,true);

const policy=createMovieMentorProductionCommercialPolicyComposition({env:{MOVIE_MENTOR_COMMERCIAL_POLICY_JSON:JSON.stringify([{packageId:"creator-20",displayName:"Creator 20",provider:"provider-a",providerProductId:"prod-20",amountMinor:2000,currency:"GBP",environment:"live",units:20,policyVersion:"v1"}])}});assert.equal(policy.ready,true);assert.equal(typeof policy.catalogueAuthority.listCommercialPackages,"function");assert.equal(policy.catalogueAuthority.getStatus().serverOwned,true);assert.equal(policy.catalogueAuthority.getStatus().creatorMutable,false);

const creatorSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCreatorCommercialComposition.js",import.meta.url),"utf8");assert.match(creatorSource,/authenticationStatus=ownedStatus\(authentication\)/);assert.match(creatorSource,/authenticationProven\(authentication,authenticationStatus\)/);assert.match(creatorSource,/ownedStatus\(purchaseIntentAuthority\)/);assert.match(creatorSource,/ownedStatus\(checkoutAuthority\)/);assert.match(creatorSource,/ownedStatus\(packageCatalogueAuthority\)/);assert.doesNotMatch(creatorSource,/typeof listCommercialPackages!=="function"/);
const httpSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");assert.match(httpSource,/packageCatalogueAuthority:policy\.catalogueAuthority/);
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");assert.doesNotMatch(server,/createMovieMentorProductionCreatorCommercialComposition/);assert.doesNotMatch(server,/app\.use\("\/api\/movie-mentor-commercial"/);

console.log("✓ creator gateway consumes exact owner-proven production authentication rather than ready+method shape");
console.log("✓ method-shaped purchase, checkout and package catalogue neighbours grant zero production credit");
console.log("✓ incomplete or uncertain neighbouring provenance fails closed");
console.log("✓ server-owned policy composition owns and exports package-catalogue capability proof");
console.log("✓ unauthenticated creator cannot enumerate packages or create commercial authority");
console.log("✓ browser-supplied principal, amount, units and product cannot enter purchase-intent authority");
console.log("LAW: the creator may select a package or durable intent reference; every production authority crossing the creator gateway must carry the proof owned by its source composition");
console.log("5A.12 creator commercial gateway torture: GREEN");

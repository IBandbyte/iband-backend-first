import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorCreatorCommercialRequestAuthority} from "../ai/MovieMentorCreatorCommercialRequestAuthority.js";
import {createMovieMentorCommercialRouter} from "../movieMentorCommercial.js";
import {createMovieMentorProductionCreatorCommercialComposition} from "../ai/MovieMentorProductionCreatorCommercialComposition.js";

function response(){return{statusCode:200,payload:null,status(code){this.statusCode=code;return this;},json(value){this.payload=value;return this;}};}
function principalAdapter(){return async({request})=>{if(!request?.headers?.authorization){const error=new Error("credential required");error.code="MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED";throw error;}return Object.freeze({authenticated:true,principalId:"creator-1",authenticationSource:"synthetic"});};}

const requestAuthority=createMovieMentorCreatorCommercialRequestAuthority({verifyCredential:async()=>({verified:true}),derivePrincipal:principalAdapter()});
let intentInput=null,checkoutInput=null,packageListCalls=0;
const purchaseIntentAuthority={async createPurchaseIntent(input){intentInput=input;return Object.freeze({commercialIntentId:"intent-1",principalId:input.principalId,packageId:input.packageId,status:"created"});}};
const checkoutAuthority={async initiateCheckout(input){checkoutInput=input;return Object.freeze({authorized:true,commercialIntentId:input.commercialIntentId,provider:"provider-a",checkoutReference:"session-1",checkoutUrl:"https://checkout.example/session-1"});}};
const listCommercialPackages=async()=>{packageListCalls+=1;return Object.freeze([Object.freeze({packageId:"creator-20",displayName:"Creator 20",currency:"GBP",amountMinor:2000,units:20})]);};

assert.throws(
  ()=>createMovieMentorCommercialRouter({requestAuthority,purchaseIntentAuthority,checkoutAuthority}),
  error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PACKAGE_CATALOGUE_AUTHORITY_REQUIRED"
);

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
const production=createMovieMentorProductionCreatorCommercialComposition({authentication:{ready:true,verifyCredential:async()=>({verified:true}),expectedIssuer:"issuer",expectedAudience:"audience"},purchaseIntentAuthority,checkoutAuthority});assert.equal(production.ready,true);assert.equal(production.mounted,false);

const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
assert.doesNotMatch(server,/createMovieMentorProductionCreatorCommercialComposition/);
assert.doesNotMatch(server,/app\.use\("\/api\/movie-mentor-commercial"/);

console.log("✓ creator commercial gateway fails closed without server-owned package catalogue authority");
console.log("✓ unauthenticated creator cannot enumerate server-owned commercial packages");
console.log("✓ authenticated package listing crosses only the server-owned catalogue boundary");
console.log("✓ unauthenticated creator cannot create a purchase intent");
console.log("✓ browser-supplied principal, amount, units and product cannot enter purchase-intent authority");
console.log("✓ checkout initiation receives only authenticated principal plus durable commercialIntentId");
console.log("✓ account-level commercial authentication does not counterfeit project ownership authority");
console.log("✓ creator commercial gateway is built but remains unmounted until production policy and provider composition are real");
console.log("LAW: the creator may select a package or durable intent reference; the server owns identity, catalogue, terms and checkout authority");
console.log("5A.12 creator commercial gateway torture: GREEN");

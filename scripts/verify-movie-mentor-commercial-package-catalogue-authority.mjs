import assert from "node:assert/strict";
import {createMovieMentorCommercialRouter} from "../movieMentorCommercial.js";

const SAFE_PACKAGES=Object.freeze([Object.freeze({packageId:"starter",amountMinor:900,currency:"GBP",units:100,policyVersion:"launch-v1"})]);
function response(){return{statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function route(router,method,path){const layer=router.stack.find(entry=>entry.route?.path===path&&entry.route?.methods?.[method]);assert(layer,`${method.toUpperCase()} ${path} must exist.`);return layer.route.stack[0].handle;}
let authCalls=0;
const router=createMovieMentorCommercialRouter({
 requestAuthority:{async authorize({request}){authCalls+=1;if(request?.headers?.authorization!=="Bearer creator-token"){const error=new Error("Bearer credential required.");error.code="MOVIE_MENTOR_COMMERCIAL_BEARER_REQUIRED";throw error;}return{principalId:"creator-1"};}},
 purchaseIntentAuthority:{async createPurchaseIntent(){return{id:"intent-1"};}},
 checkoutAuthority:{async initiateCheckout(){return{id:"checkout-1"};}},
 listCommercialPackages(){return SAFE_PACKAGES;}
});
const packagesRoute=route(router,"get","/packages");
let res=response();await packagesRoute({headers:{}},res);assert.equal(res.statusCode,401,"Package catalogue must require authenticated creator authority.");assert.equal(res.body.success,false);
res=response();await packagesRoute({headers:{authorization:"Bearer creator-token"}},res);assert.equal(res.statusCode,200);assert.deepEqual(res.body,{success:true,status:"commercial-packages-authorized",packages:SAFE_PACKAGES});assert.equal(authCalls,2);
const serialized=JSON.stringify(res.body);assert(!serialized.includes("providerProductId"),"Catalogue must not expose provider product authority.");assert(!serialized.includes('"provider"'),"Catalogue must not expose provider selection.");assert.match(serialized,/amountMinor/);assert.match(serialized,/currency/);assert.match(serialized,/units/);assert.match(serialized,/policyVersion/);
assert.throws(()=>createMovieMentorCommercialRouter({requestAuthority:{authorize(){}},purchaseIntentAuthority:{createPurchaseIntent(){}},checkoutAuthority:{initiateCheckout(){}}}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PACKAGE_CATALOGUE_AUTHORITY_REQUIRED");
console.log("PASS 5A.20: authenticated creator package catalogue projects only server-owned safe commercial policy fields.");

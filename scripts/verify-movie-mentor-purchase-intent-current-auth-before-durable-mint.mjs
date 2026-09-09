import assert from "node:assert/strict";
import {createMovieMentorCreatorCommercialRequestAuthority} from "../ai/MovieMentorCreatorCommercialRequestAuthority.js";
import {createMovieMentorCommercialPurchaseIntentAuthority} from "../ai/MovieMentorCommercialPurchaseIntentAuthority.js";
import {createMovieMentorCommercialRouter} from "../movieMentorCommercial.js";

function response(){return{statusCode:200,payload:null,status(code){this.statusCode=code;return this;},json(value){this.payload=value;return this;}};}

let currentTime=new Date("2030-01-01T00:00:00.000Z");
let authReads=0;
const requestAuthority=createMovieMentorCreatorCommercialRequestAuthority({
  verifyCredential:async()=>({verified:true}),
  now:()=>currentTime,
  derivePrincipal:async({request,now})=>{
    authReads++;
    assert.equal(request.headers.authorization,"Bearer expiring-purchase-token");
    if(now.getTime()>=Date.parse("2030-01-01T00:00:05.000Z")){
      const error=new Error("credential expired across purchase-intent policy I/O");
      error.code="MOVIE_MENTOR_AUTH_EXPIRED";
      throw error;
    }
    return Object.freeze({authenticated:true,principalId:"creator-purchase-mint-auth",authenticationSource:"clerk",expiresAt:"2030-01-01T00:00:05.000Z"});
  }
});

let durableCreates=0;
const store={
  async create(record){durableCreates++;return Object.freeze({...record,status:"created"});},
  async resolve(){return null;},
  async resolveAttempt(){return null;}
};
const resolveCommercialPolicy=async({packageId})=>{
  assert.equal(packageId,"creator-20");
  currentTime=new Date("2030-01-01T00:00:06.000Z");
  return Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod-20",amountMinor:2000,currency:"GBP",environment:"live",units:20,policyVersion:"v1"});
};
const purchaseIntentAuthority=createMovieMentorCommercialPurchaseIntentAuthority({store,resolveCommercialPolicy,createCommercialIntentId:()=>"intent-current-auth-mint-1"});
const checkoutAuthority={async initiateCheckout(){throw new Error("outside court");}};
const router=createMovieMentorCommercialRouter({requestAuthority,purchaseIntentAuthority,checkoutAuthority,listCommercialPackages:async()=>[]});
const layer=router.stack.find(entry=>entry.route?.path==="/purchase-intents");
const res=response();
await layer.route.stack[0].handle({headers:{authorization:"Bearer expiring-purchase-token"},body:{packageId:"creator-20",purchaseAttemptId:"attempt-current-auth-mint-1"}},res);

assert.equal(authReads,2,"durable purchase-intent mint must re-earn current authentication after policy I/O");
assert.equal(durableCreates,0,"expired authentication must prevent the irreversible durable purchase-intent write");
assert.equal(res.statusCode,401,"expired current authentication must fail closed before durable purchase-intent mint");
assert.equal(res.payload?.success,false);
assert.equal(res.payload?.code,"MOVIE_MENTOR_AUTH_EXPIRED");
console.log("✓ server-owned policy resolution cannot carry stale ingress authentication into durable purchase-intent minting");
console.log("✓ expired current authentication blocks store.create rather than merely hiding the resulting intent");
console.log("LAW: INGRESS AUTHENTICATION DOES NOT CROSS PURCHASE-POLICY I/O; DURABLE PURCHASE-INTENT MINTING MUST RE-EARN CURRENT PRINCIPAL AUTHORITY BEFORE STORE.CREATE.");
console.log("purchase-intent current-auth pre-durable-mint torture: GREEN");

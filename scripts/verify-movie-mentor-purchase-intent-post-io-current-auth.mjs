import assert from "node:assert/strict";
import {createMovieMentorCreatorCommercialRequestAuthority} from "../ai/MovieMentorCreatorCommercialRequestAuthority.js";
import {createMovieMentorCommercialPurchaseIntentAuthority} from "../ai/MovieMentorCommercialPurchaseIntentAuthority.js";
import {createMovieMentorCommercialRouter} from "../movieMentorCommercial.js";

function response(){return{statusCode:200,payload:null,status(code){this.statusCode=code;return this;},json(value){this.payload=value;return this;}};}

let currentTime=new Date("2030-01-01T00:00:00.000Z");
let authReads=0;
let durableWrites=0;
const requestAuthority=createMovieMentorCreatorCommercialRequestAuthority({
  verifyCredential:async()=>({verified:true}),
  now:()=>currentTime,
  derivePrincipal:async({request,now})=>{
    authReads++;
    assert.equal(request.headers.authorization,"Bearer expiring-purchase-response-token");
    if(now.getTime()>=Date.parse("2030-01-01T00:00:05.000Z")){
      const error=new Error("credential expired after durable purchase-intent mint I/O");
      error.code="MOVIE_MENTOR_AUTH_EXPIRED";
      throw error;
    }
    return Object.freeze({authenticated:true,principalId:"creator-purchase-response-auth",authenticationSource:"clerk",expiresAt:"2030-01-01T00:00:05.000Z"});
  }
});

const store={
  async create(record,{currentPrincipalAuthority=null,expectedPrincipalId=null}={}){
    if(currentPrincipalAuthority){
      const current=await currentPrincipalAuthority();
      assert.equal(current?.principalId,expectedPrincipalId);
    }
    durableWrites++;
    const created=Object.freeze({...record,status:"created"});
    currentTime=new Date("2030-01-01T00:00:06.000Z");
    return created;
  },
  async resolve(){return null;}
};
const purchaseIntentAuthority=createMovieMentorCommercialPurchaseIntentAuthority({
  store,
  resolveCommercialPolicy:async()=>Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod-20",amountMinor:2000,currency:"GBP",environment:"live",units:20,policyVersion:"v1"}),
  createCommercialIntentId:()=>"intent-post-io-auth-1"
});
const checkoutAuthority={async initiateCheckout(){throw new Error("outside court");}};
const router=createMovieMentorCommercialRouter({requestAuthority,purchaseIntentAuthority,checkoutAuthority,listCommercialPackages:async()=>[]});
const layer=router.stack.find(entry=>entry.route?.path==="/purchase-intents");
const res=response();
await layer.route.stack[0].handle({headers:{authorization:"Bearer expiring-purchase-response-token"},body:{packageId:"creator-20"}},res);

assert.equal(durableWrites,1,"durable purchase history may already exist when post-I/O request authority expires");
assert.equal(authReads,4,"creator-facing purchase-intent exposure must re-earn current request authentication after mint I/O");
assert.equal(res.statusCode,401,"expired post-I/O authentication must block creator-facing purchase-intent exposure");
assert.equal(res.payload?.success,false);
assert.equal(res.payload?.code,"MOVIE_MENTOR_AUTH_EXPIRED");
console.log("✓ durable purchase history may survive after an authorized irreversible mint");
console.log("✓ creator-facing purchase-intent exposure re-earns current request authority after mint I/O");
console.log("LAW: DURABLE PURCHASE HISTORY MAY SURVIVE; CREATOR-FACING PURCHASE-INTENT EXPOSURE MUST RE-EARN CURRENT REQUEST AUTHORITY AFTER MINT I/O.");
console.log("purchase-intent post-I/O current-auth torture: GREEN");

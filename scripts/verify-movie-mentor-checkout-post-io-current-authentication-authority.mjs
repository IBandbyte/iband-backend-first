import assert from "node:assert/strict";
import {createMovieMentorCreatorCommercialRequestAuthority} from "../ai/MovieMentorCreatorCommercialRequestAuthority.js";
import {createMovieMentorCommercialRouter} from "../movieMentorCommercial.js";

function response(){return{statusCode:200,payload:null,status(code){this.statusCode=code;return this;},json(value){this.payload=value;return this;}};}

let currentTime=new Date("2030-01-01T00:00:00.000Z");
let authReads=0;
const requestAuthority=createMovieMentorCreatorCommercialRequestAuthority({
  verifyCredential:async()=>({verified:true}),
  now:()=>currentTime,
  derivePrincipal:async({request,now})=>{
    authReads++;
    assert.equal(request.headers.authorization,"Bearer expiring-token");
    if(now.getTime()>=Date.parse("2030-01-01T00:00:05.000Z")){
      const error=new Error("credential expired during checkout I/O");
      error.code="MOVIE_MENTOR_AUTH_EXPIRED";
      throw error;
    }
    return Object.freeze({authenticated:true,principalId:"creator-post-io-auth",authenticationSource:"clerk",expiresAt:"2030-01-01T00:00:05.000Z"});
  }
});

let checkoutCalls=0;
const checkoutAuthority={
  async initiateCheckout({principalId,commercialIntentId}){
    checkoutCalls++;
    assert.equal(principalId,"creator-post-io-auth");
    assert.equal(commercialIntentId,"intent-post-io-auth-1");
    currentTime=new Date("2030-01-01T00:00:06.000Z");
    return Object.freeze({authorized:true,commercialIntentId,provider:"provider-a",checkoutReference:"checkout-post-io-auth-1",checkoutUrl:"https://provider.example/checkout-post-io-auth-1"});
  }
};
const purchaseIntentAuthority={async createPurchaseIntent(){throw new Error("outside court");}};
const router=createMovieMentorCommercialRouter({requestAuthority,purchaseIntentAuthority,checkoutAuthority,listCommercialPackages:async()=>[]});
const checkoutLayer=router.stack.find(layer=>layer.route?.path==="/checkout");
const res=response();
await checkoutLayer.route.stack[0].handle({headers:{authorization:"Bearer expiring-token"},body:{commercialIntentId:"intent-post-io-auth-1"}},res);

assert.equal(checkoutCalls,1,"court requires checkout I/O to complete after initial authentication");
assert.equal(authReads,2,"creator-facing checkout exposure must re-earn current authentication after checkout I/O");
assert.equal(res.statusCode,401,"expired authentication must fail closed before checkout URL exposure");
assert.equal(res.payload?.success,false);
assert.equal(res.payload?.code,"MOVIE_MENTOR_AUTH_EXPIRED");
console.log("✓ checkout I/O may complete without lending stale ingress authentication to creator-facing exposure");
console.log("✓ credential expiry during checkout I/O is rejected before the checkout URL crosses HTTP");
console.log("LAW: INGRESS AUTHENTICATION DOES NOT CROSS CHECKOUT I/O; CREATOR-FACING CHECKOUT EXPOSURE MUST RE-EARN CURRENT REQUEST AUTHORITY.");
console.log("checkout-post-io current-authentication authority torture: GREEN");
